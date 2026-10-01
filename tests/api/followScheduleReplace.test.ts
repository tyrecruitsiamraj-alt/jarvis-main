// @vitest-environment node
/**
 * ═══ แก้ตารางทั้งชุดหลังบันทึก (เจ้าของ Choice 1 ต.ค. 2569 "แก้ตารางหลังบันทึกไม่ได้ → แก้") ═══
 *
 * 🔴 ด่าน:
 * 1. ตัวอ่าน body: เวลาต้องเป็นอนาคต · ไม่ซ้ำนาที · สายเดิมต้องอยู่ในชุดที่แก้ · โหมด ai/manual
 * 2. ส่งแผนใหม่: ยกเลิกแผนเดิม **ทุกตัวก่อน** แล้วค่อยส่ง · ยกเลิกไม่สำเร็จ = ไม่ส่ง · แผนละวัน (หัวขบวน = สายแรกของวัน)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();
const cancelPushedReminder = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }) as unknown);

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  cancelPushedReminder: (...a: unknown[]) => cancelPushedReminder(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

const { parseFollowScheduleReplace } = await import('../../api/_handlers/follow.js');
const { replanFollowSetWithLumos } = await import('../../api/_lib/lumosDispatch.js');

const NOW = new Date('2026-10-01T03:00:00Z');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('parseFollowScheduleReplace', () => {
  const at = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

  it('อ่านสายเดิม/สายใหม่ · เรียงตามเวลา · ค่าเริ่มต้น = AI', () => {
    const r = parseFollowScheduleReplace(
      { replace_ids: [A, B], rounds: [{ id: B, scheduled_at: at(5) }, { scheduled_at: at(2), call_mode: 'manual' }] },
      NOW,
    );
    expect(r.error).toBeNull();
    expect(r.value?.replaceIds).toEqual([A, B]);
    expect(r.value?.rounds.map((x) => [x.id, x.callMode])).toEqual([
      [null, 'manual'],
      [B, 'ai'],
    ]);
  });

  it('🔴 เวลาที่ผ่านมาแล้ว (หรืออีกไม่ถึง 1 นาที) ตั้งไม่ได้', () => {
    expect(parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: at(-1) }] }, NOW).error).toMatch(/ผ่านมาแล้ว/);
    expect(
      parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: new Date(NOW.getTime() + 30_000).toISOString() }] }, NOW).error,
    ).toMatch(/ผ่านมาแล้ว/);
  });

  it('สองสายเวลาเดียวกัน (ระดับนาที) ไม่ได้', () => {
    expect(
      parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: at(2) }, { scheduled_at: at(2) }] }, NOW).error,
    ).toMatch(/เวลาเดียวกัน/);
  });

  it('🔴 สายเดิมต้องอยู่ในชุดที่แก้ · ห้ามซ้ำ · โหมดต้องรู้จัก · ต้องมีอะไรให้แก้', () => {
    expect(parseFollowScheduleReplace({ replace_ids: [A], rounds: [{ id: B, scheduled_at: at(2) }] }, NOW).error).toMatch(/ไม่ได้อยู่ในชุด/);
    expect(
      parseFollowScheduleReplace({ replace_ids: [A], rounds: [{ id: A, scheduled_at: at(2) }, { id: A, scheduled_at: at(3) }] }, NOW).error,
    ).toMatch(/ซ้ำ/);
    expect(parseFollowScheduleReplace({ replace_ids: [], rounds: [{ scheduled_at: at(2), call_mode: 'robot' }] }, NOW).error).toMatch(/call_mode/);
    expect(parseFollowScheduleReplace({ replace_ids: [], rounds: [] }, NOW).error).toMatch(/ไม่มีอะไรให้แก้/);
    expect(parseFollowScheduleReplace({ replace_ids: ['x'], rounds: [] }, NOW).error).toMatch(/replace_ids/);
  });

  it('เอาออกทุกสาย (rounds ว่าง แต่มีชุดที่แก้) = ใช้ได้ (ยกเลิกสายที่เหลือทั้งหมด)', () => {
    expect(parseFollowScheduleReplace({ replace_ids: [A], rounds: [] }, NOW).error).toBeNull();
  });
});

describe('replanFollowSetWithLumos', () => {
  const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);
  const row = (id: string, at: Date, round: number) => ({
    id,
    recipient_name: 'นายทดสอบ ระบบ',
    recipient_phone: '+66812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'สมิติเวช',
    scheduled_at: at.toISOString(),
    call_times: null,
    call_round: round,
  });
  // วันพรุ่งนี้ 2 สาย + มะรืน 1 สาย (เวลาไทย)
  const day = (offsetDays: number, hh: number) => {
    const d = new Date(Date.now() + offsetDays * 86_400_000);
    const ymd = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    return new Date(`${ymd}T${String(hh).padStart(2, '0')}:00:00+07:00`);
  };
  const members = [row('m1', day(1, 9), 3), row('m2', day(1, 13), 4), row('m3', day(2, 9), 5)];

  function stub(opts: { oldRefs: string[]; members: unknown[]; queued: string[]; pending: string[] }) {
    dbQuery.mockReset();
    dbQuery.mockImplementation((sql: string) => {
      if (/select distinct coalesce\(plan_ref, person_ref\) as ref/i.test(sql)) {
        return Promise.resolve({ rows: opts.oldRefs.map((ref) => ({ ref })) });
      }
      if (/from .*follow_entries f/i.test(sql) && /select f\.id/i.test(sql)) return Promise.resolve({ rows: opts.members });
      if (/select person_ref from .*lumos_dispatch_queue/i.test(sql) && /status = 'pending'/i.test(sql)) {
        return Promise.resolve({ rows: opts.pending.map((person_ref) => ({ person_ref })) });
      }
      if (/select person_ref from .*lumos_dispatch_queue/i.test(sql)) {
        return Promise.resolve({ rows: opts.queued.map((person_ref) => ({ person_ref })) });
      }
      return Promise.resolve({ rows: [] });
    });
  }

  beforeEach(() => {
    pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt' }] });
    cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
    getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
  });

  const refs = ['follow-m1', 'follow-m2', 'follow-m3'];

  it('🔴 ยกเลิกแผนเดิมทุกตัวก่อน แล้วส่งแผนละวัน (2 แผน) · หัวขบวน = สายแรกของวัน', async () => {
    const order: string[] = [];
    cancelPushedReminder.mockImplementation(async (ref: string) => {
      order.push(`cancel:${ref}`);
      return { accepted: 1 };
    });
    pushReminders.mockImplementation(async (_rec: unknown, key: string) => {
      order.push(`push:${key.split(':')[0]}`);
      return { results: [{ event_id: 'e' }] };
    });
    stub({ oldRefs: ['follow-old1', 'follow-old2'], members, queued: refs, pending: refs });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1', 'm2', 'm3'], cancelledIds: ['gone'], resolveStaffName: async () => 'ขวัญ' });
    expect(order).toEqual(['cancel:follow-old1', 'cancel:follow-old2', 'push:follow-m1', 'push:follow-m3']);
    expect(out).toMatchObject({ rounds: 3, plans: 2, cancelledOld: true, pushedPlans: 2 });
    const firstPlan = pushReminders.mock.calls[0][0] as { reminders?: Array<{ steps: unknown[] }> };
    const steps = (firstPlan.reminders?.[0] ?? (firstPlan as unknown as { steps: unknown[] })) as { steps: unknown[] };
    expect(steps.steps).toHaveLength(2);
  });

  it('🔴 ยกเลิกแผนเดิมไม่สำเร็จ (ไม่ใช่ 404) ⇒ ไม่ส่งใหม่ (กันโทรซ้ำสองสาย)', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('502 upstream'));
    stub({ oldRefs: ['follow-old1'], members, queued: refs, pending: refs });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1', 'm2', 'm3'], cancelledIds: [], resolveStaffName: async () => null });
    expect(out.cancelledOld).toBe(false);
    expect(out.reason).toMatch(/โทรซ้ำ/);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('Lumos ไม่มีแผนเดิมแล้ว (404) = ส่งต่อได้', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('ยกเลิก Lumos reminder ล้มเหลว: 404 Not Found'));
    stub({ oldRefs: ['follow-old1'], members, queued: refs, pending: refs });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1', 'm2', 'm3'], cancelledIds: [], resolveStaffName: async () => null });
    expect(out.pushedPlans).toBe(2);
  });

  it('สายที่ยังไม่มีคิว (สายใหม่) ต้องเข้าคิวก่อนส่ง · สายที่โดนพัก/กันไว้ไม่อยู่ในแผน', async () => {
    stub({ oldRefs: [], members, queued: ['follow-m1', 'follow-m2'], pending: ['follow-m1', 'follow-m2'] });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1', 'm2', 'm3'], cancelledIds: [], resolveStaffName: async () => null });
    const sqls = dbQuery.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((q) => /insert into .*lumos_dispatch_queue/i.test(q))).toBe(true);
    // m3 ไม่ได้อยู่ใน pending (ในเทสต์นี้) ⇒ แผนเหลือวันเดียว
    expect(out).toMatchObject({ rounds: 2, plans: 1 });
  });

  it('🔴 สลับคนโทร → AI กลับ: แถวคิวที่ยกเลิกไว้ไม่นับว่ามีคิว ⇒ ผ่าน insertQueueItems (revive) แล้วอยู่ในแผน', async () => {
    // คิวของ m1 ถูกยกเลิกตอนสลับเป็นคนโทร ⇒ query "มีคิวแล้ว" ต้องไม่คืน m1 (กรอง cancelled ใน SQL)
    stub({ oldRefs: [], members: [members[0]], queued: [], pending: ['follow-m1'] });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1'], cancelledIds: [], resolveStaffName: async () => null });
    const sqls = dbQuery.mock.calls.map((c) => String(c[0]));
    const existing = sqls.find((q) => /select person_ref from .*lumos_dispatch_queue/i.test(q) && !/status = 'pending'/i.test(q));
    expect(existing).toMatch(/status <> 'cancelled'/);
    expect(sqls.some((q) => /insert into .*lumos_dispatch_queue/i.test(q))).toBe(true);
    expect(out).toMatchObject({ rounds: 1, plans: 1, pushedPlans: 1 });
  });

  it('ปิด push อยู่: ไม่แตะ Lumos', async () => {
    getLumosPushConfig.mockReturnValue(null);
    stub({ oldRefs: ['follow-old1'], members, queued: refs, pending: refs });
    const out = await replanFollowSetWithLumos({ memberIds: ['m1'], cancelledIds: [], resolveStaffName: async () => null });
    expect(out.reason).toBe('push ปิดอยู่');
    expect(cancelPushedReminder).not.toHaveBeenCalled();
    expect(pushReminders).not.toHaveBeenCalled();
  });
});
