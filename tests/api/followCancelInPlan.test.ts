// @vitest-environment node
/**
 * ═══ ยกเลิกรอบ / ตอบว่าไม่ไป ต้องไปถึงแผนที่ Lumos ถืออยู่ (ไล่ทดสอบ 1 ต.ค. 2569) ═══
 *
 * เจ้าของ Choice: "กดยกเลิกรอบแล้ว AI ยังโทร → แก้" · "ตอบว่าไม่ไป แต่ยังโดนโทรรอบต่อไป → แก้"
 * วัดจริงก่อนแก้: รอบหลังของชุดที่ถูกยกเลิกยังถูกโทร 3 สาย · คนตอบไม่ไปแล้วรอบที่เหลือถูกโทรต่อ 3 จาก 3
 *
 * 🔴 ด่าน:
 * 1. แถวในแผนหลายรอบ → ห้ามยกเลิกด้วยรหัสของรอบเอง · ส่งรอบที่เหลือเป็นแผนใหม่ (ยกเลิกแผนเดิมก่อน)
 * 2. ไม่เหลือรอบที่ส่งได้ → ยกเลิกแผนเดิมทั้งก้อน
 * 3. แผนเดี่ยว → ยกเลิกด้วยรหัสของแถวเหมือนเดิม
 * 4. ตอบไม่ไป → ยกเลิกพี่น้องในคิว + ยกเลิก record ที่ Lumos ตามรหัสที่ Lumos รู้จัก (ไม่ซ้ำ)
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

const { cancelFollowReminder } = await import('../../api/_lib/lumosDispatch.js');
const { cancelFollowSetAfterDecline } = await import('../../api/_lib/callFollowup.js');

const staffName = async () => 'ขวัญ';
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const member = (id: string, h: number, round: number) => ({
  id,
  recipient_name: 'นายทดสอบ ระบบ',
  recipient_phone: '+66812345678',
  topic: 'ติดตามเริ่มงาน',
  note: null,
  staff_phone: '+66898888888',
  unit_name: 'สมิติเวช',
  scheduled_at: inHours(h),
  call_times: null,
  call_round: round,
});

/** คิวของแถวที่ยกเลิก: plan_ref + จำนวนรอบอื่นในแผน · สมาชิกที่ยังส่งได้ (ไม่รวมแถวที่ยกเลิก) */
function stubCancel(opts: { planRef: string | null; others: number; remaining: unknown[] }) {
  dbQuery.mockReset();
  dbQuery.mockImplementation((sql: string) => {
    if (/as others/i.test(sql)) return Promise.resolve({ rows: [{ plan_ref: opts.planRef, others: String(opts.others) }] });
    if (/set status = 'cancelled'/i.test(sql)) return Promise.resolve({ rows: [{ id: 1 }] });
    if (/select plan_ref from/i.test(sql)) return Promise.resolve({ rows: [{ plan_ref: opts.planRef }] });
    if (/from .*follow_entries/i.test(sql) && /select f\.id/i.test(sql)) return Promise.resolve({ rows: opts.remaining });
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  pushReminders.mockReset().mockResolvedValue({ results: [{ event_id: 'evt-new' }] });
  cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
  getLumosPushConfig.mockReturnValue({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' });
});

describe('cancelFollowReminder — ยกเลิกรอบเดียว', () => {
  it('🔴 รอบหลังของแผนหลายรอบ: ยกเลิกแผนเดิม (รหัสหัวขบวน) แล้วส่งรอบที่เหลือเป็นแผนใหม่ — ไม่ยิงรหัสของรอบเอง', async () => {
    stubCancel({ planRef: 'follow-r1', others: 2, remaining: [member('r1', 2, 1), member('r3', 4, 3)] });
    await cancelFollowReminder('r2', staffName);
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-r1');
    expect(cancelPushedReminder).not.toHaveBeenCalledWith('follow-r2');
    expect(pushReminders).toHaveBeenCalledTimes(1);
    const record = pushReminders.mock.calls[0][0] as { reminders?: Array<{ steps: unknown[] }> };
    const sent = (record.reminders?.[0] ?? (record as unknown as { steps: unknown[] })) as { steps: unknown[] };
    expect(sent.steps).toHaveLength(2);
  });

  it('🔴 หัวขบวนถูกยกเลิก: รอบที่เหลือไม่หายเงียบ — ได้แผนใหม่ที่มีรอบที่เหลือ', async () => {
    stubCancel({ planRef: 'follow-r1', others: 1, remaining: [member('r2', 3, 2)] });
    await cancelFollowReminder('r1', staffName);
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-r1');
    expect(pushReminders).toHaveBeenCalledTimes(1);
  });

  it('🔴 ไม่เหลือรอบที่ส่งได้ (ที่เหลือโทรไปแล้ว/เลยเวลา): ยกเลิกแผนเดิมทั้งก้อน ไม่ส่งอะไรใหม่', async () => {
    stubCancel({ planRef: 'follow-r1', others: 1, remaining: [] });
    await cancelFollowReminder('r2', staffName);
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-r1');
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('ไม่เหลือรอบ + Lumos ไม่มีแผนนั้นแล้ว (404) = ไม่ถือว่าพัง', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('ยกเลิก Lumos reminder ล้มเหลว: 404 Not Found'));
    stubCancel({ planRef: 'follow-r1', others: 1, remaining: [] });
    await expect(cancelFollowReminder('r2', staffName)).resolves.toBe(true);
  });

  it('แผนเดี่ยว (ไม่มีรอบอื่นในแผน): ยกเลิกด้วยรหัสของแถวเหมือนเดิม', async () => {
    stubCancel({ planRef: null, others: 0, remaining: [] });
    await cancelFollowReminder('solo', staffName);
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-solo');
    expect(pushReminders).not.toHaveBeenCalled();
  });

  it('ปิด push อยู่: ยกเลิกคิวฝั่งเราอย่างเดียว ไม่แตะ Lumos', async () => {
    getLumosPushConfig.mockReturnValue(null);
    stubCancel({ planRef: 'follow-r1', others: 2, remaining: [member('r1', 2, 1)] });
    await expect(cancelFollowReminder('r2', staffName)).resolves.toBe(true);
    expect(cancelPushedReminder).not.toHaveBeenCalled();
    expect(pushReminders).not.toHaveBeenCalled();
  });
});

describe('cancelFollowSetAfterDecline — ตอบว่าไม่ไป', () => {
  function stubDecline(cancelled: Array<{ person_ref: string; plan_ref: string | null }>) {
    dbQuery.mockReset();
    dbQuery.mockImplementation((sql: string) => {
      if (/set status = 'cancelled'/i.test(sql)) return Promise.resolve({ rows: cancelled });
      return Promise.resolve({ rows: [] });
    });
  }

  it('🔴 ยกเลิกพี่น้องในคิว แล้วยกเลิกที่ Lumos ตามรหัสที่ Lumos รู้จัก — แผนเดียวกันยิงครั้งเดียว', async () => {
    stubDecline([
      { person_ref: 'follow-r2', plan_ref: 'follow-r1' },
      { person_ref: 'follow-r3', plan_ref: 'follow-r1' },
      { person_ref: 'follow-d2', plan_ref: null },
    ]);
    const n = await cancelFollowSetAfterDecline('follow-r1', '11111111-1111-4111-8111-111111111111');
    expect(n).toBe(3);
    expect(cancelPushedReminder.mock.calls.map((c) => c[0]).sort()).toEqual(['follow-d2', 'follow-r1']);
  });

  it('SQL: เฉพาะแถวที่ยังรอโทร · ไม่ยกเลิกแถวที่ตอบเอง · จับทั้งชุด (group_id) และแผน (plan_ref)', async () => {
    stubDecline([]);
    await cancelFollowSetAfterDecline('follow-r1', null);
    const sql = String(dbQuery.mock.calls[0][0]);
    expect(sql).toMatch(/q\.status = 'pending'/);
    expect(sql).toMatch(/q\.person_ref <> \$1/);
    expect(sql).toMatch(/group_id = \$2::uuid/);
    expect(sql).toMatch(/q\.plan_ref = \(/);
    expect(dbQuery.mock.calls[0][1]).toEqual(['follow-r1', null]);
  });

  it('ไม่มีพี่น้องที่ยังรอโทร = ไม่แตะ Lumos', async () => {
    stubDecline([]);
    await cancelFollowSetAfterDecline('follow-r1', null);
    expect(cancelPushedReminder).not.toHaveBeenCalled();
  });

  it('Lumos ตอบ error = แค่ log ไม่ทำให้การรับผลล้ม', async () => {
    cancelPushedReminder.mockRejectedValue(new Error('502 upstream'));
    stubDecline([{ person_ref: 'follow-r2', plan_ref: 'follow-r1' }]);
    await expect(cancelFollowSetAfterDecline('follow-r1', null)).resolves.toBe(1);
  });

  it('ไม่ใช่แถวติดตาม = ไม่ทำอะไร', async () => {
    stubDecline([]);
    await expect(cancelFollowSetAfterDecline('app-123', null)).resolves.toBe(0);
    expect(dbQuery).not.toHaveBeenCalled();
  });
});
