// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));
// นโยบายมาจากที่เก็บ (migration 073) แล้ว — mock ให้คืนค่าเริ่มต้นคงที่
// เทสต์ไฟล์นี้นับลำดับคิวรีด้วย sqlOf(i) ถ้าปล่อยให้ store ยิง select จริงลำดับจะเลื่อนหมด
// (พฤติกรรมของ store เองมีเทสต์แยกที่ callFollowupPolicyStore.test.ts)
vi.mock('../../api/_lib/callFollowupPolicyStore.js', async () => {
  const { DEFAULT_CALL_FOLLOWUP_POLICY } = await import('../../src/lib/callFollowupPolicy.js');
  return { getCallFollowupPolicy: async () => DEFAULT_CALL_FOLLOWUP_POLICY };
});

const { dbQuery } = await import('../../api/_lib/postgres.js');
const {
  applyCallFollowupToQueueRow,
  applyHumanCallFollowup,
  isPhoneSuppressed,
  listSuppressedPhones,
  pickRequestedCallbackAt,
  suppressPhone,
} = await import('../../api/_lib/callFollowup.js');

const undefinedTable = Object.assign(new Error('no relation'), { code: '42P01' });
const undefinedColumn = Object.assign(new Error('no column'), { code: '42703' });

const sqlOf = (i: number) => String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
const paramsOf = (i: number) => (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
const allSql = () => vi.mocked(dbQuery).mock.calls.map((c) => String(c[0]));

describe('pickRequestedCallbackAt — Lumos ใช้ชื่อฟิลด์ไม่นิ่ง', () => {
  it('รับได้ทุกชื่อที่เจอ', () => {
    expect(pickRequestedCallbackAt({ requested_callback_at: '2026-08-07T03:00:00Z' })).toBe(
      '2026-08-07T03:00:00Z',
    );
    expect(pickRequestedCallbackAt({ callback_at: 'x' })).toBe('x');
    expect(pickRequestedCallbackAt({ reschedule_at: 'y' })).toBe('y');
    expect(pickRequestedCallbackAt({ detail: { callbackAt: 'z' } })).toBe('z');
  });

  it('ไม่มีก็คืน null ไม่พัง', () => {
    expect(pickRequestedCallbackAt(null)).toBeNull();
    expect(pickRequestedCallbackAt('x')).toBeNull();
    expect(pickRequestedCallbackAt({})).toBeNull();
    expect(pickRequestedCallbackAt({ callback_at: '   ' })).toBeNull();
  });
});

describe('ผลจาก AI → ตั้งคิวโทรซ้ำ / ตกถังคนตาม', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('ไม่รับสายครั้งแรก → ตั้งกลับเป็น pending + นับ attempt + ตั้งเวลานัด', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 7, attempt_count: 1, payload: {} }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({ queueId: 7, outcome: 'no_answer' });

    expect(d?.action).toBe('retry');
    const sql = sqlOf(1);
    expect(sql).toContain("status = 'pending'");
    expect(sql).toContain('attempt_count = attempt_count + 1');
    expect(sql).toContain('next_attempt_at');
    // ต้องรีเซ็ต result/delivery_count ไม่งั้น takePendingLumosItems จะไม่หยิบแถวนี้อีก
    expect(sql).toContain('result = null');
    expect(sql).toContain('delivery_count = 0');
    expect(sql).toContain("followup_state = 'retry_scheduled'");
  });

  it('ไม่รับสายครบเพดาน → needs_human ไม่ตั้งคิวใหม่', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 7, attempt_count: 3, payload: {} }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({ queueId: 7, outcome: 'no_answer' });

    expect(d?.action).toBe('needs_human');
    const sql = sqlOf(1);
    expect(sql).toContain("followup_state = $3");
    expect(sql).not.toContain("status = 'pending'");
    expect(paramsOf(1)[2]).toBe('needs_human');
  });

  it('ขอเลื่อนพร้อมเวลา → ใช้เวลานั้นเป็น next_attempt_at', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 9, attempt_count: 1, payload: {} }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({
      queueId: 9,
      outcome: 'reschedule_requested',
      result: { outcome: 'reschedule_requested', callback_at: '2026-08-07T07:00:00.000Z' },
      now: new Date('2026-08-06T03:00:00.000Z'),
    });

    expect(d?.action).toBe('retry');
    expect(paramsOf(1)[1]).toBe('2026-08-07T07:00:00.000Z');
  });

  it('สนใจ → ปิดเรื่อง ไม่โทรซ้ำ', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 1, attempt_count: 1, payload: {} }] })
      .mockResolvedValueOnce({ rows: [] });
    const d = await applyCallFollowupToQueueRow({ queueId: 1, outcome: 'confirmed' });
    expect(d?.action).toBe('closed');
    expect(paramsOf(1)[2]).toBe('closed');
  });

  /**
   * 🔴 เจ้าของสั่ง 17 ก.ย. 2569: *"อย่าพึ่งบล็อคเบอร์"*
   *
   * เคสจริง: เบอร์ที่คุยสำเร็จมาสามวันติด โดนรอบเดียวที่ Lumos อ่านว่า "โทรผิดเบอร์"
   * แล้วถูกพัก 7 วัน ⇒ สายวันถัดไปไม่ถูกส่งเลย · สองเทสต์นี้กันไม่ให้กติกาเดิมกลับมา
   */
  it('🔴 เบอร์ผิด → needs_human เฉย ๆ **ห้ามพักเบอร์** (AI บล็อกเบอร์เองไม่ได้)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 3, attempt_count: 1, payload: { recipient_phone: '0812345678' } }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({ queueId: 3, outcome: 'wrong_person' });

    expect(d?.action).toBe('needs_human');
    expect(allSql().some((q) => q.includes('candidate_call_suppression'))).toBe(false);
  });

  it('🔴 เบอร์ผิด → **ห้ามยกเลิกทั้งชุดตาราง** (เดาพลาดครั้งเดียวสายที่เหลือหายหมด)', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [
          { id: 4, attempt_count: 1, payload: {}, person_ref: 'follow-abc', job_ref: 'follow' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ group_id: 'g1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await applyCallFollowupToQueueRow({ queueId: 4, outcome: 'wrong_person' });

    // กันเทสต์ผ่านแบบหลอก ๆ — ต้องพิสูจน์ว่าเดินถึงขั้นหา group_id จริง
    expect(allSql().some((q) => q.includes('group_id'))).toBe(true);
    expect(allSql().some((q) => q.includes("status = 'cancelled'"))).toBe(false);
  });

  /**
   * 🔴 บั๊กจริงที่เจอ 21 ก.ย. 2569 — คิว follow ค้าง 46 แถวเพราะเหตุนี้
   *
   * เส้นที่คนใช้สร้างรายการจริง (ตั้งหลายรอบในคำขอเดียว) ไม่ส่ง `group_id` มา
   * ⇒ แถวตั้งตารางถูกมองเป็นสายเดี่ยว ⇒ ผลไม่รับสายเข้าทาง retry ⇒ ดีดกลับเป็น
   * `pending` โดยไม่มีใครดันแผนใหม่ไป Lumos = สายที่ไม่มีวันโทร
   */
  it('🔴 แถวตั้งตารางที่ไม่มี group_id แต่มี call_round → ห้าม retry นอกตาราง', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [
          { id: 9, attempt_count: 1, payload: {}, person_ref: 'follow-xyz', job_ref: 'follow' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ group_id: null, call_round: 1, call_times: null }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({ queueId: 9, outcome: 'no_answer' });

    // นโยบายยังตัดสินว่า retry (ของมันถูก) แต่ปลายทางต้องไม่ดีดแถวกลับเป็น pending
    expect(d?.action).toBe('retry');
    expect(allSql().some((q) => q.includes("status = 'pending'"))).toBe(false);
    expect(allSql().some((q) => q.includes("followup_state = 'retry_scheduled'"))).toBe(false);
    expect(sqlOf(2)).toContain('last_outcome');
  });

  it('🔴 ไม่มีทั้ง group_id และ call_round แต่มี call_times → ยังนับเป็นตาราง', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [
          { id: 10, attempt_count: 1, payload: {}, person_ref: 'follow-xyz', job_ref: 'follow' },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ group_id: null, call_round: null, call_times: ['07:00', '08:00'] }] })
      .mockResolvedValueOnce({ rows: [] });

    await applyCallFollowupToQueueRow({ queueId: 10, outcome: 'unresponsive' });

    expect(allSql().some((q) => q.includes("status = 'pending'"))).toBe(false);
  });

  it('สายเดี่ยวจริง (ไม่ใช่ follow) → ยัง retry ตามเดิม', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [
          { id: 12, attempt_count: 1, payload: {}, person_ref: 'appl-77', job_ref: 'siamraj-sql:DS1' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyCallFollowupToQueueRow({ queueId: 12, outcome: 'no_answer' });

    expect(d?.action).toBe('retry');
    expect(sqlOf(1)).toContain("status = 'pending'");
  });

  it('ตารางยังไม่รัน 113 (ไม่มี call_round/call_times) → ถอยไปดู group_id อย่างเดียว', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({
        rows: [
          { id: 13, attempt_count: 1, payload: {}, person_ref: 'follow-old', job_ref: 'follow' },
        ],
      })
      .mockImplementationOnce(() => {
        throw undefinedColumn;
      })
      .mockResolvedValueOnce({ rows: [{ group_id: 'g9' }] })
      .mockResolvedValueOnce({ rows: [] });

    await applyCallFollowupToQueueRow({ queueId: 13, outcome: 'no_answer' });

    expect(allSql().some((q) => q.includes("status = 'pending'"))).toBe(false);
  });

  it('outcome ที่ไม่รู้จัก → ไม่ทำอะไร ไม่แตะ DB', async () => {
    await expect(applyCallFollowupToQueueRow({ queueId: 1, outcome: 'ไม่รู้' })).resolves.toBeNull();
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('คอลัมน์ยังไม่ migrate → ข้ามเงียบ ไม่พัง (โค้ดขึ้นก่อน migration 070)', async () => {
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedColumn;
    });
    await expect(applyCallFollowupToQueueRow({ queueId: 1, outcome: 'no_answer' })).resolves.toBeNull();
  });
});

describe('ผลที่คนกดเอง → เดินนโยบายเดียวกัน', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('มีแถวคิวอยู่ → อัปเดตให้ AI รับช่วงโทรซ้ำต่อได้', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 11, attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyHumanCallFollowup({
      phone: '0812345678',
      jobId: 'siamraj-sql:DS1',
      candidateRef: '1834',
      source: 'board',
      outcome: 'no_answer',
    });

    expect(d?.action).toBe('retry');
    expect(sqlOf(1)).toContain("status = 'pending'");
  });

  it('จับแถวคิวด้วย person_ref เต็มตัว ไม่ใช่ like — กัน card-1805 ชน ir-1805/card-11805', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 11, attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    await applyHumanCallFollowup({
      phone: '0812345678',
      jobId: 'siamraj-sql:DS1',
      candidateRef: '1805',
      source: 'board',
      outcome: 'no_answer',
    });

    // คิวรีหาแถวต้องเทียบ person_ref = 'card-1805' เป๊ะ (ไม่มี %)
    expect(sqlOf(0)).toContain('person_ref = $2');
    expect(sqlOf(0)).not.toContain('like');
    expect(paramsOf(0)[1]).toBe('card-1805');
  });

  it('source iRecruit → person_ref = ir-<ref>', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await applyHumanCallFollowup({
      phone: '0812345678',
      jobId: 'j',
      candidateRef: '1805',
      source: 'irecruit',
      outcome: 'declined',
      declinedScope: 'job',
    });

    expect(paramsOf(0)[1]).toBe('ir-1805');
  });

  it('ไม่มี source → ข้ามการหาแถวคิว (application ยังไม่มีคิว) แต่ยังพักเบอร์ถ้าไม่หางานแล้ว', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] }); // insert suppression เท่านั้น

    const d = await applyHumanCallFollowup({
      phone: '0812345678',
      jobId: 'j',
      candidateRef: '1',
      outcome: 'declined',
      declinedScope: 'all',
    });

    expect(d?.action).toBe('suppress');
    // ไม่มี select หาแถวคิว — คิวรีแรกคือ suppression เลย
    expect(allSql().every((q) => !q.includes('select id, attempt_count'))).toBe(true);
  });

  it('ไม่มีแถวคิว แต่บอกว่าไม่หางานแล้ว → ยังพักเบอร์ให้ถูก', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [] }) // หาแถวคิวไม่เจอ
      .mockResolvedValueOnce({ rows: [] }); // insert suppression

    const d = await applyHumanCallFollowup({
      phone: '081-234-5678',
      jobId: 'siamraj-sql:DS1',
      candidateRef: '1834',
      source: 'board',
      outcome: 'declined',
      declinedScope: 'all',
      byName: 'ตั้ม',
    });

    expect(d?.action).toBe('suppress');
    const call = vi.mocked(dbQuery).mock.calls.find((c) =>
      String(c[0]).includes('candidate_call_suppression'),
    );
    expect((call?.[1] as unknown[])[0]).toBe('+66812345678');
    expect((call?.[1] as unknown[])[2]).toBe('not_looking');
    expect((call?.[1] as unknown[])[4]).toBe('ตั้ม');
  });

  it('ไม่สนใจงานนี้ → ปิดแค่ใบนี้ ไม่พักเบอร์', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [{ id: 12, attempt_count: 1 }] })
      .mockResolvedValueOnce({ rows: [] });

    const d = await applyHumanCallFollowup({
      phone: '0812345678',
      jobId: 'j',
      candidateRef: '1',
      source: 'board',
      outcome: 'declined',
      declinedScope: 'job',
    });

    expect(d?.action).toBe('closed');
    expect(allSql().some((q) => q.includes('candidate_call_suppression'))).toBe(false);
  });
});

describe('พักเบอร์', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('เบอร์แปลงเป็น E.164 ไม่ได้ → ไม่เขียน', async () => {
    await expect(suppressPhone({ phone: '123', until: 'x', reason: 'manual' })).resolves.toBe(false);
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('ต่ออายุแล้วเลือกวันที่ไกลกว่า (greatest) — ไม่ให้การพักถูกย่อลง', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await suppressPhone({ phone: '0812345678', until: '2026-09-01T00:00:00Z', reason: 'not_looking' });
    expect(sqlOf(0)).toContain('greatest');
  });

  it('isPhoneSuppressed: เช็คเฉพาะที่ยังไม่หมดอายุ', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ phone_e164: '+66812345678' }] });
    await expect(isPhoneSuppressed('0812345678')).resolves.toBe(true);
    expect(sqlOf(0)).toContain('suppressed_until > now()');
  });

  it('ตารางยังไม่ migrate → ไม่มีใครถูกพัก (พฤติกรรมเดิม)', async () => {
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedTable;
    });
    await expect(isPhoneSuppressed('0812345678')).resolves.toBe(false);

    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedTable;
    });
    await expect(listSuppressedPhones()).resolves.toEqual(new Set());
  });
});
