// @vitest-environment node
/**
 * แท็บการติดตาม: ปุ่มเหลือ 3 + "ลบออก" ส่งกลับแท็บผู้สมัคร (เจ้าของสั่ง 1 ต.ค. 2569)
 *
 * เจ้าของ: *"ต้องมีแค่ ปุ่มโทรเพื่อ Stamp เวลา ปุ่มดูรายละเอียด และลบออกเพื่อส่งกลับไปหน้าผู้สมัคร"*
 * Choice: ส่งกลับเป็น **ใบว่าง ใครก็เก็บได้** — ปลดจอง + ปลดล็อกเบอร์ + ถอด Lead · AI ไม่โทรเอง
 *
 * 🔴 ด่าน:
 * - ยิงเส้นเดียว (`/api/application-call-choice` choice=release) server ทำครบ
 * - **ห้ามแตะ `call_choice`/`unclaimed_at`** — แตะเมื่อไหร่ใบเข้ากอง "เลือกวิธีโทร" แล้ว worker ส่ง AI เองใน 1 วัน
 * - ใบที่คนอื่นจองไว้ห้ามแตะ (ข้ามพร้อมเหตุผล) · คืนเฉพาะล็อกที่คนกดถือเอง
 */
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RM_ROW_ACTIONS, RM_ROW_ACTION_LABEL } from '../../src/lib/recruitRm.js';
import { summarizeCallChoice } from '../../src/lib/callChoiceSummary.js';

const dbQuery = vi.fn();
const releaseHolds = vi.fn();
const acquire = vi.fn();

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
  isPgUniqueViolation: () => false,
}));
vi.mock('../../api/_lib/audit.js', () => ({ auditFromAuthed: vi.fn(async () => undefined) }));
vi.mock('../../api/_lib/applicationScope.js', () => ({ isApplicationInWriteScope: vi.fn(async () => true) }));
vi.mock('../../api/_lib/candidateCallHolds.js', () => ({
  acquireCallHold: (...a: unknown[]) => acquire(...a),
  releaseApplicationCallHolds: (...a: unknown[]) => releaseHolds(...a),
}));
vi.mock('../../api/_lib/lumosDispatch.js', () => ({ enqueueLumosInterviewForApplications: vi.fn() }));

import { signAuthToken, AUTH_COOKIE_NAME } from '../../api/_lib/auth.js';
import handler from '../../api/_handlers/application-call-choice.js';

const MINE = '11111111-1111-4111-8111-111111111111';
const THEIRS = '22222222-2222-4222-8222-222222222222';

const row = (id: string, claimedBy: string | null) => ({
  id,
  full_name: id === MINE ? 'ใบของฉัน' : 'ใบของคนอื่น',
  phone: '0812345678',
  job_id: 'J1',
  department_code: 'LBD',
  job_title: null,
  unit_name: null,
  position_interest: null,
  claimed_by: claimedBy,
  claimed_by_name: claimedBy ? 'someone' : null,
});

function req(body: Record<string, unknown>) {
  const token = signAuthToken({ sub: 'u-me', email: 'me@example.com', role: 'admin' });
  return {
    method: 'POST',
    headers: { cookie: `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}` },
    query: {},
    body,
  };
}
function mockRes() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return { res: { status, json, setHeader: vi.fn() }, status, json };
}
const updates = () => dbQuery.mock.calls.filter((c) => /^\s*update /i.test(String(c[0])));

beforeEach(() => {
  process.env.AUTH_JWT_SECRET = 'test-secret-key-at-least-32-characters-long';
  process.env.NODE_ENV = 'development';
  delete process.env.VERCEL_ENV;
  dbQuery.mockReset();
  releaseHolds.mockReset().mockResolvedValue(1);
  acquire.mockReset();
});

describe('ปุ่มของแท็บการติดตาม', () => {
  it('🔴 เหลือ 3 ปุ่ม: โทร (จดเวลา) · ดูรายละเอียด · ลบออก — ไม่มีเก็บ Lead/เก็บไปโทรเอง', () => {
    expect(RM_ROW_ACTIONS.contact).toEqual(['dial', 'view', 'release']);
    expect(RM_ROW_ACTION_LABEL.dial).toBe('กดโทร (จดเวลา)');
    expect(RM_ROW_ACTION_LABEL.release).toBe('ลบออก — ส่งกลับแท็บผู้สมัคร');
  });

  it('แท็บอื่น: ผู้สมัครแบบ iRecruit + ส่ง AI โทร (4 ต.ค. 2569) · ติดตามนัดหมายเหลือโทร + บันทึกผล', () => {
    expect(RM_ROW_ACTIONS.candidates).toEqual(['bookmark', 'call', 'ai', 'view']);
    // "เอาออกจากรายการ" ไม่เคยต่อกับระบบ — ถอดออก (QA 5 ต.ค. 2569)
    // 7 ต.ค. 2569: ถอดเก็บไปโทรเอง (ปุ่มที่กดไม่ได้ทุกแถวของใบคีย์เอง)
    expect(RM_ROW_ACTIONS.appointments).toEqual(['rule']);
  });

  it('หน้าเว็บยิงเส้นเดียว choice=release แล้วโหลดใหม่ — ไม่ยิงปลดจอง/ถอด Lead/คืนล็อกแยกกันเอง', () => {
    const ws = readFileSync(new URL('../../src/components/recruit-rm/RmWorkspace.tsx', import.meta.url), 'utf8');
    const block = ws.slice(ws.indexOf("if (action === 'release')"), ws.indexOf("todo(`\"${RM_ROW_ACTION_LABEL[action]}\""));
    expect(block).toContain("chooseApplicationCall([row.id], 'release')");
    expect(block).not.toMatch(/claimJobApplication|setJobApplicationLead|releaseCallHold/);
    expect(block).toContain('load()');
  });

  it('ข้อความหลังกดบอกผล + เหตุผลของใบที่ข้าม', () => {
    expect(summarizeCallChoice({ choice: 'release', done: 1, skipped: [] })).toBe('ส่งกลับแท็บผู้สมัคร 1 คนแล้ว');
    expect(
      summarizeCallChoice({ choice: 'release', done: 0, skipped: [{ name: 'ก', reason: 'มีเจ้าหน้าที่คนอื่นเก็บไว้' }] }),
    ).toBe('ยังส่งกลับแท็บผู้สมัครไม่ได้เลย · ข้าม 1 คน — ก: มีเจ้าหน้าที่คนอื่นเก็บไว้');
  });
});

describe('POST /api/application-call-choice choice=release', () => {
  it('🔴 ใบของฉัน ⇒ ปลดจอง + ถอด Lead ในคำสั่งเดียว + คืนล็อกของฉัน · ไม่แตะ call_choice/unclaimed_at/status', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/^\s*select a\.id, a\.full_name/i.test(sql)) return Promise.resolve({ rows: [row(MINE, 'u-me')] });
      if (/^\s*update /i.test(sql)) return Promise.resolve({ rows: [{ id: MINE }] });
      return Promise.resolve({ rows: [] });
    });
    const { res, status, json } = mockRes();
    await handler(req({ ids: [MINE], choice: 'release' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ choice: 'release', done: 1, skipped: [] });
    const [sql, params] = updates()[0] as [string, unknown[]];
    expect(sql).toMatch(/claimed_by = null/);
    expect(sql).toMatch(/is_lead = false/);
    expect(sql).toMatch(/where id = \$1 and \(claimed_by is null or claimed_by = \$2\)/);
    expect(sql).not.toMatch(/call_choice|unclaimed_at|status =/);
    expect(params).toEqual([MINE, 'u-me']);
    expect(releaseHolds).toHaveBeenCalledWith(MINE, 'u-me');
    expect(acquire).not.toHaveBeenCalled();
  });

  it('ใบ Lead ที่ไม่มีใครจอง ⇒ ถอด Lead ได้ (Lead เป็นสถานะระดับระบบ)', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/^\s*select a\.id, a\.full_name/i.test(sql)) return Promise.resolve({ rows: [row(MINE, null)] });
      if (/^\s*update /i.test(sql)) return Promise.resolve({ rows: [{ id: MINE }] });
      return Promise.resolve({ rows: [] });
    });
    const { res, json } = mockRes();
    await handler(req({ ids: [MINE], choice: 'release' }) as never, res as never);
    expect(json).toHaveBeenCalledWith({ choice: 'release', done: 1, skipped: [] });
  });

  it('🔴 ใบที่คนอื่นจองไว้ ⇒ ข้ามพร้อมเหตุผล ไม่ยิง update ไม่คืนล็อก', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/^\s*select a\.id, a\.full_name/i.test(sql)) return Promise.resolve({ rows: [row(THEIRS, 'u-other')] });
      return Promise.resolve({ rows: [] });
    });
    const { res, json } = mockRes();
    await handler(req({ ids: [THEIRS], choice: 'release' }) as never, res as never);
    expect(json).toHaveBeenCalledWith({
      choice: 'release',
      done: 0,
      skipped: [{ name: 'ใบของคนอื่น', reason: 'มีเจ้าหน้าที่คนอื่นเก็บไว้ — ลบออกได้เฉพาะใบที่ตัวเองเก็บ' }],
    });
    expect(updates()).toHaveLength(0);
    expect(releaseHolds).not.toHaveBeenCalled();
  });

  it('แข่งกันแล้วคนอื่นจองไปก่อน (update ไม่โดนแถว) ⇒ ข้าม ไม่คืนล็อก', async () => {
    dbQuery.mockImplementation((sql: string) => {
      if (/^\s*select a\.id, a\.full_name/i.test(sql)) return Promise.resolve({ rows: [row(MINE, null)] });
      return Promise.resolve({ rows: [] });
    });
    const { res, json } = mockRes();
    await handler(req({ ids: [MINE], choice: 'release' }) as never, res as never);
    expect(json).toHaveBeenCalledWith({
      choice: 'release',
      done: 0,
      skipped: [{ name: 'ใบของฉัน', reason: 'มีเจ้าหน้าที่คนอื่นเก็บไปก่อน' }],
    });
    expect(releaseHolds).not.toHaveBeenCalled();
  });

  it('choice อื่นยังโดน 400', async () => {
    const { res, status } = mockRes();
    await handler(req({ ids: [MINE], choice: 'nope' }) as never, res as never);
    expect(status).toHaveBeenCalledWith(400);
  });
});

describe('ปุ่มบนแถวต้องต่อกับระบบจริงทุกปุ่ม (QA 5 ต.ค. 2569)', () => {
  const ws = readFileSync(new URL('../../src/components/recruit-rm/RmWorkspace.tsx', import.meta.url), 'utf8');
  it('🔴 "เก็บเข้า Lead" บนแถวผู้สมัครยิง setJobApplicationLead ไม่ตกไปที่ "ยังไม่ได้ต่อ"', () => {
    const block = ws.slice(ws.indexOf("if (action === 'bookmark')"), ws.indexOf("if (action === 'call')"));
    expect(block).toContain('setJobApplicationLead(row.id, true)');
    expect(block).toContain('return;');
  });
  it('ทุกปุ่มในทุกแท็บมีทางของตัวเองใน onRowAction', () => {
    const handled = new Set([...ws.matchAll(/action === '(\w+)'/g)].map((m) => m[1]));
    for (const actions of Object.values(RM_ROW_ACTIONS)) for (const a of actions) expect(handled, a).toContain(a);
  });
});
