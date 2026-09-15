// @vitest-environment node
/**
 * ═══ แก้รายการติดตามแล้วต้อง **ส่งแผนใหม่ให้ Lumos** (เจ้าของสั่ง 13 ก.ย. 2569) ═══
 *
 * ของเดิมแก้แค่คิวฝั่งเรา ⇒ Lumos ถือของก่อนแก้ · วัดกับงานวันที่ 14 ก.ย. เจอ 3 ใน 10 คนเพี้ยน
 * (รอบหายไป 1 คน · เวลาเป็น 20:00 แทน 08:00 อีก 1 คน · อีกคนโดนโทรตามเวลาเดิมไปแล้ว)
 *
 * 🔴 ด่านที่ห้ามหลุด:
 * 1. **ยกเลิกของเดิมก่อนเสมอ** แล้วค่อยส่งใหม่ — ห้ามยิงทับ (ไม่รู้ว่าเขาทับหรือสร้างเพิ่ม)
 * 2. ยกเลิกไม่สำเร็จ ⇒ **ห้ามส่งใหม่** ไม่งั้นคนจริงโดนโทรสองสาย
 * 3. Idempotency-Key ต้องเป็นคีย์ใหม่ ไม่งั้นถูกตัดซ้ำแล้วแผนใหม่ไม่เข้าระบบเขา
 * 4. รอบที่โทรไปแล้ว/ยกเลิกแล้ว ห้ามกลับเข้าแผนใหม่
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbQuery = vi.fn();
const pushReminders = vi.fn();
const cancelPushedReminder = vi.fn();
const getLumosPushConfig = vi.fn(() => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }));

vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: (...a: unknown[]) => pushReminders(...a),
  cancelPushedReminder: (...a: unknown[]) => cancelPushedReminder(...a),
  getLumosPushConfig: () => getLumosPushConfig(),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

const { resyncFollowPlanWithLumos } = await import('../../api/_lib/lumosDispatch.js');

const staffName = async () => 'ขวัญ';

/**
 * ⚠️ **เวลาต้องเป็นอนาคตเสมอ ห้ามฝังวันที่ตายตัว** (เจอจริง 15 ก.ย. 2569)
 * ตัวประกอบ payload ดันเวลาที่ผ่านมาแล้วไปเป็น "ตอนนี้ + 10 นาที" ตามกติกาของ Lumos
 * ⇒ เทสต์ที่ฝังวันที่ไว้จะพังเองเมื่อวันนั้นผ่านไป โดยที่โค้ดไม่ได้เสีย
 */
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000);
const hhmm = (d: Date) =>
  d.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const ROUND_1 = inHours(2);
const ROUND_2 = inHours(3);

/** แถวของแผน: รอบแรก (หัวขบวน) + รอบถัดไปอีกหนึ่งชั่วโมง */
const members = [
  {
    id: 'r1',
    recipient_name: 'นายทดสอบ ระบบ',
    recipient_phone: '+66812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'สมิติเวช',
    scheduled_at: ROUND_1.toISOString(),
    call_times: null,
    call_round: 1,
  },
  {
    id: 'r2',
    recipient_name: 'นายทดสอบ ระบบ',
    recipient_phone: '+66812345678',
    topic: 'ติดตามเริ่มงาน',
    note: null,
    staff_phone: '+66898888888',
    unit_name: 'สมิติเวช',
    scheduled_at: ROUND_2.toISOString(),
    call_times: null,
    call_round: 2,
  },
];

/** คิวคืน plan_ref เดิม แล้วคืนสมาชิกของแผนตามที่กำหนด */
function stubPlan(rows: unknown[], planRef = 'follow-r1') {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/select plan_ref/i.test(sql)) return Promise.resolve({ rows: [{ plan_ref: planRef }] });
    if (/from .*follow_entries/i.test(sql) && /select f\.id/i.test(sql)) {
      return Promise.resolve({ rows });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt-new' }] });
  cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
});

describe('resyncFollowPlanWithLumos', () => {
  it('🔴 ยกเลิกของเดิมก่อน แล้วส่งแผนใหม่ที่มีครบทุกรอบ', async () => {
    stubPlan(members);
    const out = await resyncFollowPlanWithLumos('r2', staffName);

    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-r1');
    expect(out).toMatchObject({ rounds: 2, cancelled: true, pushed: true });

    const record = pushReminders.mock.calls[0][0] as { reminders?: Array<{ steps: unknown[] }> };
    const sent = (record.reminders?.[0] ?? (record as unknown as { steps: unknown[] })) as {
      steps: Array<{ scheduled_at: string }>;
    };
    expect(sent.steps).toHaveLength(2);
    expect(sent.steps.map((s) => hhmm(new Date(s.scheduled_at)))).toEqual([hhmm(ROUND_1), hhmm(ROUND_2)]);
  });

  it('🔴 ยกเลิกของเดิมต้องเกิด **ก่อน** ส่งใหม่ — ไม่ใช่ยิงทับ', async () => {
    const order: string[] = [];
    cancelPushedReminder.mockImplementation(async () => {
      order.push('cancel');
      return { accepted: 1 };
    });
    pushReminders.mockImplementation(async () => {
      order.push('push');
      return { results: [{ event_id: 'e' }] };
    });
    stubPlan(members);
    await resyncFollowPlanWithLumos('r1', staffName);
    expect(order).toEqual(['cancel', 'push']);
  });

  it('🔴 ยกเลิกไม่สำเร็จ ⇒ ไม่ส่งใหม่ (ไม่งั้นคนจริงโดนโทรสองสาย)', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('502 upstream ตาย'));
    stubPlan(members);
    const out = await resyncFollowPlanWithLumos('r1', staffName);
    expect(out.cancelled).toBe(false);
    expect(out.pushed).toBe(false);
    expect(out.reason).toMatch(/โทรซ้ำ/);
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('Lumos ไม่มี record นี้ (404) ⇒ ถือว่าไม่มีของเก่าค้าง ส่งใหม่ได้', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('ยกเลิก Lumos reminder ล้มเหลว: 404 Not Found'));
    stubPlan(members);
    const out = await resyncFollowPlanWithLumos('r1', staffName);
    expect(out.cancelled).toBe(true);
    expect(out.pushed).toBe(true);
  });

  it('🔴 Idempotency-Key ต้องเป็นคีย์ใหม่ ไม่ใช่ follow-<id> เดิม', async () => {
    stubPlan(members);
    await resyncFollowPlanWithLumos('r1', staffName);
    const key = pushReminders.mock.calls[0][1] as string;
    expect(key).not.toBe('follow-r1');
    expect(key.startsWith('follow-r1:v')).toBe(true);
  });

  it('ไม่มีรอบที่ยังส่งได้ ⇒ ไม่แตะ Lumos เลย และบอกเหตุผล', async () => {
    stubPlan([]);
    const out = await resyncFollowPlanWithLumos('r1', staffName);
    expect(out).toMatchObject({ rounds: 0, cancelled: false, pushed: false });
    expect(out.reason).toMatch(/ไม่มีรอบ/);
    expect(cancelPushedReminder).not.toHaveBeenCalled();
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('🔴 ดึงเฉพาะรอบที่ยัง pending และยังไม่ถูกยกเลิก/ปิดงาน', async () => {
    stubPlan(members);
    await resyncFollowPlanWithLumos('r1', staffName);
    const select = dbQuery.mock.calls
      .map((c) => String(c[0]))
      .find((sql) => /select f\.id/i.test(sql))!;
    expect(select).toMatch(/q\.status = 'pending'/);
    expect(select).toMatch(/f\.cancelled_at is null/);
    expect(select).toMatch(/f\.completed_at is null/);
    // 🔴 รอบที่เลยเวลานัดแล้วห้ามกลับเข้าแผน — ไม่งั้นโดนโทรซ้ำทันที
    expect(select).toMatch(/f\.scheduled_at > now\(\)/);
  });

  it('push ปิดอยู่ ⇒ ไม่ทำอะไร และบอกตรง ๆ', async () => {
    getLumosPushConfig.mockReturnValue(null as never);
    stubPlan(members);
    const out = await resyncFollowPlanWithLumos('r1', staffName);
    expect(out.reason).toMatch(/push ปิด/);
    expect(cancelPushedReminder).not.toHaveBeenCalled();
  });
});
