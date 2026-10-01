// @vitest-environment node
/**
 * PATCH /api/follow?id=<แถว> action `replace_schedule` — แก้ตารางทั้งชุด (เจ้าของ Choice 1 ต.ค. 2569)
 * 🔴 ด่าน: สายที่โทรไปแล้ว/เลยเวลาแล้ว/อยู่คนละชุด = 409 ไม่แตะอะไร · เอาออก = ยกเลิก · ย้ายเวลา = แก้แถวเดิม ·
 *    สายใหม่ลอกคน/ทีม/ชุดจากแถวที่เปิดแก้ · เลขรอบนับต่อจากสายที่โทรไปแล้ว · ส่งแผนใหม่เฉพาะสาย AI
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const replan = vi.fn();

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a), isPgUndefinedTable: () => false }));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));
vi.mock('../../api/_lib/followStaffName.js', () => ({ staffNameOfPhone: vi.fn(async () => null) }));
vi.mock('../../api/_lib/lumosDispatchMode.js', () => ({ isAutoDispatchEnabled: vi.fn(async () => true) }));
vi.mock('../../api/_lib/lumosDispatch.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../api/_lib/lumosDispatch.js')>();
  return { ...mod, replanFollowSetWithLumos: (...a: unknown[]) => replan(...a) };
});

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import followHandler from '../../api/_handlers/follow.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NEW = '33333333-3333-4333-8333-333333333333';
const G = '44444444-4444-4444-8444-444444444444';
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const anchor = {
  id: A,
  recipient_name: 'นายทดสอบ ระบบ',
  recipient_phone: '+66812345678',
  topic: 'ติดตามเริ่มงาน',
  note: null,
  staff_phone: '+66898888888',
  scheduled_at: inHours(5),
  group_id: G,
  call_times: null,
  call_round: 3,
  call_mode: 'ai',
  unit_name: 'สมิติเวช',
  site_code: 'LBD001',
  follow_team: 'replacement',
  cancelled_at: null,
  completed_at: null,
};

function req(body: Record<string, unknown>) {
  const token = signAuthToken({ sub: 'u-admin', email: 'admin@example.com', role: 'admin' });
  return {
    method: 'PATCH',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query: { id: A },
    body: { action: 'replace_schedule', ...body },
  };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}

function stub(targets: unknown[]) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/q\.first_result_at as q_result_at/i.test(sql)) return Promise.resolve({ rows: targets });
    if (/^\s*select \* from .*follow_entries where id = \$1/i.test(sql)) return Promise.resolve({ rows: [anchor] });
    if (/insert into .*follow_entries/i.test(sql)) return Promise.resolve({ rows: [{ ...anchor, id: NEW }] });
    if (/max\(call_round\) as max_round/i.test(sql)) return Promise.resolve({ rows: [{ max_round: 2, n: '2' }] });
    return Promise.resolve({ rows: [] });
  });
}
const calls = (re: RegExp) => dbQuery.mock.calls.filter((c) => re.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  replan.mockReset().mockResolvedValue({ rounds: 2, plans: 1, cancelledOld: true, pushedPlans: 1, states: {} });
});

describe('replace_schedule', () => {
  const targets = [
    { ...anchor, q_status: 'pending', q_result_at: null },
    { ...anchor, id: B, scheduled_at: inHours(8), call_mode: 'manual', call_round: 4, q_status: null, q_result_at: null },
  ];

  it('🔴 เอาออก = ยกเลิก · ย้ายเวลา = แก้แถวเดิม · สายใหม่ลอกทีม/ชุด · เลขรอบนับต่อ · ส่งแผนเฉพาะสาย AI', async () => {
    stub(targets);
    const { res, status, json } = mockRes();
    const moved = inHours(6);
    const added = inHours(30);
    await followHandler(
      req({ replace_ids: [A, B], rounds: [{ id: A, scheduled_at: moved, call_mode: 'ai' }, { scheduled_at: added, call_mode: 'ai' }] }),
      res,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ kept: 1, cancelled: 1, created: 1, group_id: G }));

    // ยกเลิกสาย B ทั้งในฐานและในคิว
    expect(calls(/set cancelled_at = now\(\)/i)[0][1][0]).toEqual([B]);
    expect(calls(/update .*lumos_dispatch_queue set status = 'cancelled'/i)[0][1][0]).toEqual([`follow-${B}`]);
    // ย้ายเวลา A
    const move = calls(/set scheduled_at = \$2, call_mode = \$3, group_id = \$4/i)[0][1];
    expect(move.slice(0, 4)).toEqual([A, new Date(moved).toISOString(), 'ai', G]);
    // สายใหม่ลอกทีมส่งคนแทน (insert แบบมีช่องทีม)
    const insert = calls(/insert into .*follow_entries/i)[0];
    expect(String(insert[0])).toMatch(/follow_team/);
    expect(insert[1]).toContain('replacement');
    expect(insert[1]).toContain(G);
    // เลขรอบ: สายที่โทรไปแล้วสูงสุด 2 ⇒ สายในตารางใหม่ได้ 3, 4 ตามเวลา
    const rounds = calls(/set call_round = \$2 where id = \$1/i).map((c) => c[1]);
    expect(rounds).toEqual([
      [A, 3],
      [NEW, 4],
    ]);
    // ส่งแผนใหม่: สาย AI ที่อยู่ต่อ + สายใหม่ · ปลดสายที่เอาออกจากแผนเดิม
    expect(replan).toHaveBeenCalledWith(expect.objectContaining({ memberIds: [A, NEW], cancelledIds: [B] }));
  });

  it('🔴 สายที่เลยเวลาแล้ว/โทรไปแล้ว อยู่ในชุดที่ส่งมา ⇒ 409 ไม่แตะอะไร', async () => {
    stub([{ ...targets[0], q_status: 'completed', q_result_at: inHours(-1) }, targets[1]]);
    const { res, status } = mockRes();
    await followHandler(req({ replace_ids: [A, B], rounds: [{ id: A, scheduled_at: inHours(6) }] }), res);
    expect(status).toHaveBeenCalledWith(409);
    expect(calls(/^\s*update/i)).toHaveLength(0);
    expect(replan).not.toHaveBeenCalled();
  });

  it('สายของคนอื่น/ชุดอื่น ⇒ 409', async () => {
    stub([targets[0], { ...targets[1], recipient_phone: '+66899999999' }]);
    const { res, status } = mockRes();
    await followHandler(req({ replace_ids: [A, B], rounds: [{ id: A, scheduled_at: inHours(6) }] }), res);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('AI → คนโทร: ถอนออกจากคิว + ติดธง manual + ปลดออกจากแผนเดิม', async () => {
    stub(targets);
    const { res, status } = mockRes();
    await followHandler(
      req({ replace_ids: [A, B], rounds: [{ id: A, scheduled_at: anchor.scheduled_at, call_mode: 'manual' }, { id: B, scheduled_at: targets[1].scheduled_at, call_mode: 'manual' }] }),
      res,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(calls(/set dispatch_state = 'manual' where id = any/i)[0][1][0]).toEqual([A]);
    expect(replan).toHaveBeenCalledWith(expect.objectContaining({ memberIds: [], cancelledIds: [A] }));
  });

  it('เวลาที่ผ่านมาแล้ว ⇒ 400 ก่อนแตะฐาน', async () => {
    stub(targets);
    const { res, status } = mockRes();
    await followHandler(req({ replace_ids: [A], rounds: [{ id: A, scheduled_at: inHours(-2) }] }), res);
    expect(status).toHaveBeenCalledWith(400);
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
