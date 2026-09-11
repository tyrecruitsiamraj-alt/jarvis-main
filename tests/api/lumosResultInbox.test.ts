// @vitest-environment node
/**
 * กล่องรับผลดิบจาก Lumos (11 ก.ย. 2569)
 *
 * เจ้าของถาม *"งงเพราะอะไรผลรอบแรกไม่ขึ้น"* แล้วตอบไม่ได้ เพราะของเดิมจับคู่ไม่ได้
 * แล้วทิ้งเงียบ ⇒ แยกไม่ออกว่า **เขาไม่ส่ง** หรือ **ส่งแล้วเราจับคู่ไม่ได้**
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbQuery = vi.fn();
vi.mock('../../api/_lib/postgres.js', () => ({ dbQuery: (...a: unknown[]) => dbQuery(...a) }));

const { readInboxFields, recordLumosResultInbox } = await import(
  '../../api/_lib/lumosResultInbox.js'
);

beforeEach(() => dbQuery.mockReset().mockResolvedValue({ rows: [] }));

describe('readInboxFields', () => {
  it('แกะค่าที่ใช้ค้นบ่อยออกมา', () => {
    expect(
      readInboxFields({
        client_contact_id: 'follow-a',
        plan_id: 'p1',
        step_id: 's1',
        step_position: 1,
        status: 'completed',
        outcome: 'confirmed',
      }),
    ).toEqual({
      clientRef: 'follow-a',
      planId: 'p1',
      stepId: 's1',
      stepPosition: 1,
      status: 'completed',
      outcome: 'confirmed',
    });
  });

  it('step_position = 0 ต้องเก็บได้ (0 เป็นค่าจริง ไม่ใช่ "ไม่มี")', () => {
    expect(readInboxFields({ step_position: 0 }).stepPosition).toBe(0);
    expect(readInboxFields({ step_position: '0' }).stepPosition).toBe(0);
  });

  it('เลนสัมภาษณ์ใช้ client_candidate_id — รับได้ทั้งสองชื่อ', () => {
    expect(readInboxFields({ client_candidate_id: 'cand-1' }).clientRef).toBe('cand-1');
  });

  it('🔴 ไม่รู้จักก็เป็น null ห้ามเดา', () => {
    const out = readInboxFields({ step_position: -1, plan_id: '   ' });
    expect(out.stepPosition).toBeNull();
    expect(out.planId).toBeNull();
    expect(readInboxFields('ขยะ').clientRef).toBeNull();
  });
});

/**
 * ⚠️ สองข้อที่ทำให้เทสต์นี้ตกแบบงง ๆ ตอนเขียนครั้งแรก (11 ก.ย. 2569)
 *   1. ใช้ `mockImplementation` (ค้างข้ามการเรียก) ⇒ มี promise ที่ถูก reject ค้างไว้
 *      โดยไม่มีใคร await · vitest จับเป็น unhandled แล้วนับเป็นเทสต์ตก ทั้งที่โค้ดกลืนแล้ว
 *      ⇒ ใช้ `mockImplementationOnce` แทน (โยนครั้งเดียวพอดีกับที่เรียก)
 *   2. `expect(...).resolves` ก็โดนแบบเดียวกัน ⇒ ใช้ try/catch ตรง ๆ อ่านง่ายกว่าด้วย
 */
async function expectNoThrow(rec: Parameters<typeof recordLumosResultInbox>[0]): Promise<void> {
  let threw: unknown = null;
  try {
    await recordLumosResultInbox(rec);
  } catch (e) {
    threw = e;
  }
  expect(threw).toBeNull();
}

describe('recordLumosResultInbox', () => {
  const rec = {
    channel: 'reminder' as const,
    clientRef: 'follow-a',
    planId: 'p1',
    stepId: 's1',
    stepPosition: 0,
    status: 'completed',
    outcome: 'confirmed',
    matched: false,
    unmatchedReason: 'ไม่พบแถวคิว',
    payload: { a: 1 },
  };

  it('จดลงตารางพร้อมธง matched และเหตุผล', async () => {
    await recordLumosResultInbox(rec);
    expect(dbQuery).toHaveBeenCalledTimes(1);
    const params = dbQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe('follow-a');
    expect(params[4]).toBe(0);
    expect(params[7]).toBe(false);
    expect(String(params[8])).toContain('ไม่พบแถวคิว');
  });

  it('🔴 ยังไม่ได้รัน migration 119 ⇒ เตือนแล้วไปต่อ ห้ามทำให้การรับผลล้ม', async () => {
    dbQuery.mockImplementationOnce(async () => {
      throw new Error('relation "lumos_result_inbox" does not exist');
    });
    await expectNoThrow(rec);
  });

  it('🔴 ฐานล่มก็ห้ามโยนต่อ — Lumos จะยิงซ้ำ การรับผลสำคัญกว่าการจด', async () => {
    dbQuery.mockImplementationOnce(async () => {
      throw new Error('connection terminated');
    });
    await expectNoThrow(rec);
  });
});
