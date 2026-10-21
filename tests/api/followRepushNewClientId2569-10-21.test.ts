// @vitest-environment node
/**
 * ═══ ส่งแผนซ้ำต้องใช้รหัสใหม่ — ยกเลิกแล้ว AI ยังโทร (เจ้าของ 21 ต.ค. 2569 "แก้ที่เรา + ส่งรายชื่อ") ═══
 *
 * วัดจริง 4 วัน: แผนที่ส่งซ้ำด้วย client_contact_id เดิม ⇒ โทรหลังยกเลิก 51/61 สาย · ส่งครั้งเดียว 1/45
 * 🔴 ด่าน:
 * 1. ยกเลิกยิงรหัสที่ Lumos ถืออยู่จริง (`lumos_client_id` -g<เวลา>) ไม่ใช่รหัสแถว
 * 2. ไม่มี/รหัสแปลก/ยังไม่ migrate 159 ⇒ ใช้รหัสแถวแบบเดิม
 * 3. ผลโทรที่มากับรหัส -g<เวลา> ต้องเข้าแถวของ step นั้น (plan_ref = รหัสแผนของเรา)
 * 4. รอบโทรซ้ำ -r<n> ยังไปทางเดิม (ไม่จับด้วย step ของหัวขบวน)
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbQuery = vi.fn();
const cancelPushedReminder = vi.fn();

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: (...a: unknown[]) => dbQuery(...a),
  isPgUndefinedTable: () => false,
}));
vi.mock('../../api/_lib/lumosPushClient.js', () => ({
  pushReminders: vi.fn(),
  cancelPushedReminder: (...a: unknown[]) => cancelPushedReminder(...a),
  getLumosPushConfig: () => ({ baseUrl: 'x', connectionId: 'y', apiKey: 'z' }),
  pushInterviews: vi.fn(),
  cancelPushedInterview: vi.fn(),
  getEventStatus: vi.fn(),
}));

const { cancelFollowPlanAtLumos, lumosClientIdOfPlan } = await import('../../api/_lib/followLumosCancel.js');
const { followGenerationClientId, followPlanRefOfClientId, applyLumosResult } = await import('../../api/_lib/lumosDispatch.js');

beforeEach(() => {
  dbQuery.mockReset();
  cancelPushedReminder.mockReset().mockResolvedValue({ accepted: 1 });
});

function stubClientId(id: string | null | 'no-column') {
  dbQuery.mockImplementation((sql: string) => {
    if (/as closed/.test(sql)) return Promise.resolve({ rows: [{ closed: false }] });
    if (/select lumos_client_id/.test(sql)) {
      if (id === 'no-column') return Promise.reject(Object.assign(new Error('column does not exist'), { code: '42703' }));
      return Promise.resolve({ rows: id ? [{ lumos_client_id: id }] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

describe('รหัสแผนรุ่นใหม่', () => {
  it('followGenerationClientId = <แผน>-g<วินาที> · ตัดกลับได้', () => {
    const id = followGenerationClientId('follow-abc', new Date('2026-10-21T00:00:00Z'));
    expect(id).toBe(`follow-abc-g${Date.UTC(2026, 9, 21) / 1000}`);
    expect(followPlanRefOfClientId(id)).toBe('follow-abc');
    expect(followPlanRefOfClientId('follow-abc-r2')).toBe('follow-abc');
    expect(followPlanRefOfClientId('follow-abc')).toBe('follow-abc');
    // เลนอื่นไม่ตัด -g
    expect(followPlanRefOfClientId('job::card-1-g5')).toBe('job::card-1-g5');
  });
});

describe('cancelFollowPlanAtLumos ยิงรหัสที่ Lumos ถือ', () => {
  it('🔴 มีรหัส -g ⇒ DELETE รหัสนั้น', async () => {
    stubClientId('follow-7d23-g1792488600');
    expect(await cancelFollowPlanAtLumos('follow-7d23')).toBe('cancelled');
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-7d23-g1792488600');
  });

  it('ไม่มีรหัส ⇒ รหัสแถวแบบเดิม', async () => {
    stubClientId(null);
    await cancelFollowPlanAtLumos('follow-7d23');
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-7d23');
  });

  it('รหัสไม่ใช่ของแผนนี้ ⇒ ไม่เชื่อ ใช้รหัสแถว', async () => {
    stubClientId('follow-other-g1');
    expect(await lumosClientIdOfPlan('follow-7d23')).toBe('follow-7d23');
  });

  it('ยังไม่ migrate 159 ⇒ รหัสแถว', async () => {
    stubClientId('no-column');
    await cancelFollowPlanAtLumos('follow-7d23');
    expect(cancelPushedReminder).toHaveBeenCalledWith('follow-7d23');
  });
});

describe('applyLumosResult กับรหัส -g', () => {
  it('🔴 ผลของ step 1 มากับ follow-x-g… ⇒ จับด้วย plan_ref follow-x + step 1', async () => {
    dbQuery.mockImplementation((sql: string) =>
      Promise.resolve({ rows: /plan_ref = \$2 and step_position = \$5/.test(sql) ? [{ id: 9 }] : [] }),
    );
    const ok = await applyLumosResult('reminder', 'follow-x-g1792488600', 'failed', { step_position: 1 });
    expect(ok).toBe(true);
    const call = dbQuery.mock.calls.find((c) => /plan_ref = \$2 and step_position = \$5/.test(String(c[0])));
    expect(call?.[1]?.[1]).toBe('follow-x');
    expect(call?.[1]?.[4]).toBe(1);
  });

  it('รอบโทรซ้ำ -r2 ⇒ ไม่จับด้วย step ของหัวขบวน (ไปทางรหัสใน payload แบบเดิม)', async () => {
    dbQuery.mockImplementation((sql: string, params: unknown[]) =>
      Promise.resolve({ rows: /payload->>'client_contact_id' = \$2/.test(sql) && params[1] === 'follow-y' ? [{ id: 3 }] : [] }),
    );
    const ok = await applyLumosResult('reminder', 'follow-y-r2', 'completed', { step_position: 0 });
    expect(ok).toBe(true);
    const planCall = dbQuery.mock.calls.find((c) => /plan_ref = \$2 and step_position = \$5/.test(String(c[0])));
    expect(planCall?.[1]?.[1]).toBe('follow-y-r2');
  });
});
