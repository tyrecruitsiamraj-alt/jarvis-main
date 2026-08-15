// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/_lib/postgres.js', () => ({
  dbQuery: vi.fn(),
  isPgUniqueViolation: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505',
  isPgUndefinedTable: (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01',
}));
vi.mock('../../api/_lib/schema.js', () => ({ tableInAppSchema: (n: string) => n }));

import { dbQuery } from '../../api/_lib/postgres.js';
import {
  acquireCallHold,
  callHoldKey,
  isCallHoldSource,
  getActiveCallHoldsByPhones,
  isCallResultOutcome,
  recordCallResult,
  releaseAllCallHoldsForUser,
  releaseCallHold,
  tallyCallResultsSince,
  transferCallHold,
  CALL_RESULT_OUTCOMES,
} from '../../api/_lib/candidateCallHolds.js';
import { toE164Thai } from '../../api/_lib/thaiPhone.js';

const HOLD_ID = '33333333-3333-4333-8333-333333333333';

function row(over: Record<string, unknown> = {}) {
  return {
    id: HOLD_ID,
    phone_e164: '+66812345678',
    source: 'board',
    candidate_ref: '1834',
    candidate_name: 'ฉัตรชัย สุคันธวณิช',
    job_id: 'siamraj-sql:DS5812003',
    request_no: 'DS5812003',
    held_by_user_id: 'user-1',
    held_by_name: 'ตั้ม',
    held_at: '2026-08-06T07:02:00.000Z',
    expires_at: '2026-08-07T07:02:00.000Z',
    released_at: null,
    release_reason: null,
    result_outcome: null,
    result_scope: null,
    result_note: null,
    ...over,
  };
}

const uniqueViolation = Object.assign(new Error('duplicate key'), { code: '23505' });
const undefinedTable = Object.assign(new Error('relation does not exist'), { code: '42P01' });
const undefinedColumn = Object.assign(new Error('column does not exist'), { code: '42703' });

function sqlOf(i: number) {
  return String(vi.mocked(dbQuery).mock.calls[i]?.[0] ?? '');
}
function paramsOf(i: number) {
  return (vi.mocked(dbQuery).mock.calls[i]?.[1] ?? []) as unknown[];
}

describe('source ของล็อก (11 ส.ค. 2569 รอบหก: เพิ่ม application)', () => {
  it('รับสามค่า: board · irecruit · application', () => {
    expect(isCallHoldSource('board')).toBe(true);
    expect(isCallHoldSource('irecruit')).toBe(true);
    expect(isCallHoldSource('application')).toBe(true);
  });

  it('ค่าขยะไม่ผ่าน — กันคนยัด source ประดิษฐ์เข้าฐาน', () => {
    expect(isCallHoldSource('follow')).toBe(false);
    expect(isCallHoldSource('')).toBe(false);
    expect(isCallHoldSource(null)).toBe(false);
    expect(isCallHoldSource(1)).toBe(false);
  });

  it("mapRow ไม่ coerce 'application' ทิ้งเป็น 'board' — ป้ายที่มาบนหน้าโทรจะผิดทันที", async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [row({ source: 'application' })],
    } as never);
    const holds = await getActiveCallHoldsByPhones(['0812345678']);
    expect(holds.get('+66812345678')?.source).toBe('application');
  });
});

describe('กุญแจล็อกคือเบอร์ ไม่ใช่ ref', () => {
  it('callHoldKey ใช้สูตรเดียวกับที่ใส่ลง payload ของ Lumos', () => {
    // ล็อกกับ payload ต้องแปลงเบอร์เหมือนกันเป๊ะ ไม่งั้นเทียบไม่ตรง = โทรทับกันเงียบ ๆ
    for (const raw of ['0812345678', '081-234-5678', '66812345678', '+66812345678']) {
      expect(callHoldKey(raw)).toBe(toE164Thai(raw));
    }
    expect(callHoldKey('0812345678')).toBe('+66812345678');
  });

  it('เบอร์ที่แปลงไม่ได้ = ล็อกไม่ได้', () => {
    expect(callHoldKey('123')).toBeNull();
    expect(callHoldKey('')).toBeNull();
    expect(callHoldKey(null)).toBeNull();
  });
});

describe('จับล็อก — คนแรกชนะ', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('ว่างอยู่ = จับได้', async () => {
    // call 0 = กวาดหมดอายุ · call 1 = insert
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row()] });

    const out = await acquireCallHold({
      phone: '081-234-5678',
      source: 'board',
      candidateRef: '1834',
      jobId: 'siamraj-sql:DS5812003',
      userId: 'user-1',
      userName: 'ตั้ม',
    });

    expect(out.ok).toBe(true);
    if (out.ok) expect(out.hold.phone).toBe('+66812345678');
    // ต้อง insert ด้วยเบอร์ที่ normalize แล้ว ไม่ใช่เบอร์ดิบ
    expect(paramsOf(1)[0]).toBe('+66812345678');
  });

  it('มีคนถืออยู่ = unique violation → คืนว่าใครถือ ไม่ใช่โยน error', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [] })                       // กวาด
      .mockImplementationOnce(() => { throw uniqueViolation; })   // insert ชน
      .mockResolvedValueOnce({ rows: [row({ held_by_name: 'หนิง' })] }); // อ่านว่าใครถือ

    const out = await acquireCallHold({
      phone: '0812345678', source: 'board', candidateRef: '1834',
      jobId: 'siamraj-sql:DS5812003', userId: 'user-2',
    });

    expect(out.ok).toBe(false);
    if (!out.ok && out.reason === 'taken') expect(out.hold.heldByName).toBe('หนิง');
  });

  it('ไม่มีเบอร์ = ตอบ no_phone ไม่แตะ DB', async () => {
    const out = await acquireCallHold({
      phone: '123', source: 'board', candidateRef: '1834', jobId: 'j1',
    });
    expect(out).toEqual({ ok: false, reason: 'no_phone' });
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('กวาดล็อกหมดอายุก่อนจับทุกครั้ง — หมดอายุแล้วถือว่าว่าง', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [row()] });
    await acquireCallHold({ phone: '0812345678', source: 'board', candidateRef: '1', jobId: 'j1' });
    expect(sqlOf(0)).toContain("release_reason = 'expired'");
    expect(sqlOf(0)).toContain('expires_at <= now()');
  });

  it('ไม่ระบุใบขอ = โยน error (ต้องรู้ว่าโทรเรื่องใบไหน)', async () => {
    await expect(
      acquireCallHold({ phone: '0812345678', source: 'board', candidateRef: '1', jobId: '  ' }),
    ).rejects.toThrow('ต้องระบุใบขอ');
  });
});

describe('บันทึกผลโทร', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('ผลโทรใช้ศัพท์ชุดเดียวกับ Lumos outcome — funnel นับรวมกันได้', () => {
    // ถ้าเพิ่มค่าใหม่ต้องเป็นค่าที่ Lumos ส่งกลับได้จริงด้วย
    expect([...CALL_RESULT_OUTCOMES]).toEqual([
      'confirmed', 'declined', 'reschedule_requested', 'no_answer', 'wrong_person',
    ]);
    expect(isCallResultOutcome('confirmed')).toBe(true);
    expect(isCallResultOutcome('สนใจ')).toBe(false);
  });

  it('บันทึกผลแล้วปล่อยล็อกในคำสั่งเดียว (ผลจบ = ไม่ต้องถือต่อ)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row({ released_at: 'x', release_reason: 'result', result_outcome: 'confirmed' })] });

    await recordCallResult({ holdId: HOLD_ID, outcome: 'confirmed' });

    const sql = sqlOf(0);
    expect(sql).toContain('released_at    = now()');
    expect(sql).toContain("release_reason = 'result'");
    // อัปเดตได้เฉพาะล็อกที่ยังไม่ปล่อย — กันบันทึกผลทับซ้อน
    expect(sql).toContain('released_at is null');
  });

  it('"ไม่สนใจ" ต้องแยก 2 แบบ: ไม่เอางานนี้ vs ไม่หางานแล้ว', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });

    await recordCallResult({ holdId: HOLD_ID, outcome: 'declined', scope: 'job' });
    expect(paramsOf(0)[2]).toBe('job');

    vi.mocked(dbQuery).mockReset();
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    await recordCallResult({ holdId: HOLD_ID, outcome: 'declined', scope: 'all' });
    expect(paramsOf(0)[2]).toBe('all');
  });

  it('ปฏิเสธแบบไม่ระบุ scope = ถือเป็น "job" (ปลอดภัยกว่า ไม่ตัดคนออกจากระบบเอง)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    await recordCallResult({ holdId: HOLD_ID, outcome: 'declined' });
    expect(paramsOf(0)[2]).toBe('job');
  });

  it('"สนใจ + นัดได้เลย" ต้องเขียนทั้ง scope และวันนัดลงฐาน (14 ส.ค. 2569)', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    const r = await recordCallResult({
      holdId: HOLD_ID,
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-20',
      now: '2026-08-14T03:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    expect(sqlOf(0)).toContain('appointment_at = $6');
    expect(paramsOf(0)[2]).toBe('scheduled');
    expect(String(paramsOf(0)[5])).toContain('2026-08-20');
  });

  it('"สนใจ แต่ยังนัดไม่ได้" → scope ลงฐาน แต่วันนัดเป็น null', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    const r = await recordCallResult({
      holdId: HOLD_ID,
      outcome: 'confirmed',
      scope: 'unscheduled',
      appointmentAt: '2026-08-20',
      now: '2026-08-14T03:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    expect(paramsOf(0)[2]).toBe('unscheduled');
    expect(paramsOf(0)[5]).toBeNull();
  });

  it('"นัดได้เลย" โดยไม่ใส่วันนัด → ไม่บันทึกอะไรเลย ต้องตอบเหตุผลกลับ', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    const r = await recordCallResult({
      holdId: HOLD_ID,
      outcome: 'confirmed',
      scope: 'scheduled',
      now: '2026-08-14T03:00:00.000Z',
    });
    expect(r.ok).toBe(false);
    // ⚠️ ต้องไม่แตะฐานเลย — ไม่ใช่บันทึกผลแล้วค่อยบ่นเรื่องวันนัด
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });

  it('⚠️ ยังไม่รัน 088: ถอยไปชุดไม่มี result_at แต่วันนัดยังลง (085 มี)', async () => {
    vi.mocked(dbQuery)
      .mockRejectedValueOnce(undefinedColumn) // ชั้น 088+085 (มี result_at)
      .mockResolvedValueOnce({ rows: [row()] }); // ชั้น 085 (ไม่มี result_at)
    const r = await recordCallResult({
      holdId: HOLD_ID,
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-20',
      now: '2026-08-14T03:00:00.000Z',
    });
    expect(r.ok).toBe(true);
    expect(sqlOf(0)).toContain('result_at');
    expect(sqlOf(1)).not.toContain('result_at');
    expect(sqlOf(1)).toContain('appointment_at = $6');
  });

  it('⚠️ ยังไม่รัน 085: ไม่มีวันนัดให้เสีย → ถอยไปบันทึกแบบเดิมได้ (สามชั้น)', async () => {
    vi.mocked(dbQuery)
      .mockRejectedValueOnce(undefinedColumn) // ชั้น 088+085
      .mockRejectedValueOnce(undefinedColumn) // ชั้น 085
      .mockResolvedValueOnce({ rows: [row()] }); // ชั้นก่อน 085
    const r = await recordCallResult({ holdId: HOLD_ID, outcome: 'no_answer' });
    expect(r.ok).toBe(true);
    expect(sqlOf(2)).not.toContain('appointment_at');
    expect(sqlOf(2)).not.toContain('result_at');
  });

  it('⚠️ ยังไม่รัน 085 แต่มีวันนัด → ห้ามบันทึกแบบทิ้งวันนัดเงียบ ๆ', async () => {
    // เจ้าหน้าที่จะเห็นว่า "บันทึกแล้ว" ทั้งที่วันนัดหายไป — แพตเทิร์นเดียวกับ
    // ฟอร์มเพิ่มผู้สมัครที่เลือกคืน 503 แทนการบันทึกแบบทิ้งฟิลด์
    vi.mocked(dbQuery)
      .mockRejectedValueOnce(undefinedColumn) // ชั้น 088+085
      .mockRejectedValueOnce(undefinedColumn); // ชั้น 085
    const r = await recordCallResult({
      holdId: HOLD_ID,
      outcome: 'confirmed',
      scope: 'scheduled',
      appointmentAt: '2026-08-20',
      now: '2026-08-14T03:00:00.000Z',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('085');
    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(2);
  });

  it('ผลที่ไม่ใช่ปฏิเสธไม่มี scope', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [row()] });
    await recordCallResult({ holdId: HOLD_ID, outcome: 'no_answer' });
    expect(paramsOf(0)[2]).toBeNull();
  });
});

describe('คืนงาน', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('คืนได้ 3 เหตุผล และเฉพาะล็อกที่ยังถืออยู่', async () => {
    for (const reason of ['manual', 'transferred', 'to_ai'] as const) {
      vi.mocked(dbQuery).mockReset();
      vi.mocked(dbQuery).mockResolvedValue({ rows: [row({ released_at: 'x', release_reason: reason })] });
      const out = await releaseCallHold(HOLD_ID, reason);
      expect(out?.releaseReason).toBe(reason);
      expect(paramsOf(0)).toEqual([HOLD_ID, reason]);
      expect(sqlOf(0)).toContain('released_at is null');
    }
  });
});

describe('ทนตารางยังไม่ถูก migrate', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('อ่านล็อกไม่ได้ = คืน map ว่าง ไม่ทำให้หน้า Matching ล่ม', async () => {
    // ยิง DB 2 ครั้ง (กวาดหมดอายุ + อ่านล็อก) — ต้องทนทั้งสองครั้ง
    vi.mocked(dbQuery)
      .mockImplementationOnce(() => { throw undefinedTable; })
      .mockImplementationOnce(() => { throw undefinedTable; });
    let threw = false;
    let map = new Map<string, unknown>();
    try {
      map = await getActiveCallHoldsByPhones(['0812345678']);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(map.size).toBe(0);
  });

  it('ไม่มีเบอร์ให้ถาม = ไม่ยิง DB', async () => {
    await expect(getActiveCallHoldsByPhones([null, '', '123'])).resolves.toEqual(new Map());
    expect(vi.mocked(dbQuery)).not.toHaveBeenCalled();
  });
});

describe('บอร์ดหัวหน้า — สรุปยอด / โอนงาน / เทกอง', () => {
  beforeEach(() => vi.mocked(dbQuery).mockReset());

  it('สรุปยอดวันนี้: แยก "ไม่เอางานนี้" กับ "ไม่หางานแล้ว" ออกจากกัน', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [
        { result_outcome: 'confirmed', result_scope: null, n: '2' },
        { result_outcome: 'declined', result_scope: 'job', n: '3' },
        { result_outcome: 'declined', result_scope: 'all', n: '1' },
        { result_outcome: 'no_answer', result_scope: null, n: '4' },
      ],
    });

    const t = await tallyCallResultsSince('2026-08-06');

    expect(t.byOutcome.confirmed).toBe(2);
    expect(t.byOutcome.declined).toBe(4);
    expect(t.declinedByScope).toEqual({ job: 3, all: 1 });
    expect(t.byOutcome.no_answer).toBe(4);
    expect(t.total).toBe(10);
    // ค่าที่ไม่มีต้องเป็น 0 ไม่ใช่ undefined (หน้าเว็บเอาไปบวกตรง ๆ)
    expect(t.byOutcome.wrong_person).toBe(0);
  });

  it('สรุปยอด: ส่ง userId มา = กรองเฉพาะของคนนั้น', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [] });
    await tallyCallResultsSince('2026-08-06', 'user-1');
    expect(sqlOf(0)).toContain('held_by_user_id');
    expect(paramsOf(0)).toEqual(['2026-08-06T00:00:00+07:00', 'user-1']);
  });

  it('สรุปยอด: ค่าผลแปลก ๆ ใน DB ถูกข้าม ไม่ทำให้ยอดเพี้ยน', async () => {
    vi.mocked(dbQuery).mockResolvedValue({
      rows: [
        { result_outcome: 'confirmed', result_scope: null, n: '1' },
        { result_outcome: 'ไม่รู้จัก', result_scope: null, n: '9' },
      ],
    });
    const t = await tallyCallResultsSince('2026-08-06');
    expect(t.total).toBe(1);
  });

  it('โอนงาน: ปล่อยแถวเดิมเป็น transferred แล้วสร้างแถวใหม่ให้คนรับ นับเวลาใหม่ 1 วัน', async () => {
    vi.mocked(dbQuery)
      .mockResolvedValueOnce({ rows: [row()] })                       // getCallHoldById
      .mockResolvedValueOnce({ rows: [] })                            // update ปล่อยแถวเดิม
      .mockResolvedValueOnce({ rows: [row({ held_by_name: 'หนิง' })] }); // insert แถวใหม่

    const moved = await transferCallHold({ holdId: HOLD_ID, toUserId: 'user-2', toName: 'หนิง' });

    expect(sqlOf(1)).toContain("release_reason = 'transferred'");
    expect(sqlOf(2)).toContain('insert into');
    expect(sqlOf(2)).toContain("now() + interval '1 day'");
    // เบอร์/ผู้สมัคร/ใบขอ ต้องยกมาจากแถวเดิมทั้งชุด
    expect(paramsOf(2).slice(0, 6)).toEqual([
      '+66812345678',
      'board',
      '1834',
      'ฉัตรชัย สุคันธวณิช',
      'siamraj-sql:DS5812003',
      'DS5812003',
    ]);
    expect(paramsOf(2)[6]).toBe('user-2');
    expect(moved?.heldByName).toBe('หนิง');
  });

  it('โอนงาน: ล็อกที่ปล่อยไปแล้ว โอนไม่ได้ (ไม่แตะ DB ต่อ)', async () => {
    vi.mocked(dbQuery).mockResolvedValueOnce({
      rows: [row({ released_at: '2026-08-06T09:00:00.000Z', release_reason: 'result' })],
    });
    await expect(
      transferCallHold({ holdId: HOLD_ID, toUserId: 'user-2', toName: 'หนิง' }),
    ).resolves.toBeNull();
    expect(vi.mocked(dbQuery)).toHaveBeenCalledTimes(1);
  });

  it('เทกอง: ปล่อยทุกล็อกของคนนั้น พร้อมเหตุผลที่เลือก', async () => {
    vi.mocked(dbQuery).mockResolvedValue({ rows: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });

    const n = await releaseAllCallHoldsForUser('user-1', 'to_ai');

    expect(n).toBe(3);
    expect(sqlOf(0)).toContain('held_by_user_id = $1');
    expect(sqlOf(0)).toContain('released_at is null');
    expect(paramsOf(0)).toEqual(['user-1', 'to_ai']);
  });

  it('ตารางยังไม่ migrate: สรุปยอดเป็นศูนย์ · เทกองเป็น 0 ไม่โยน error', async () => {
    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedTable;
    });
    await expect(tallyCallResultsSince('2026-08-06')).resolves.toMatchObject({ total: 0 });

    vi.mocked(dbQuery).mockImplementationOnce(() => {
      throw undefinedTable;
    });
    await expect(releaseAllCallHoldsForUser('user-1', 'manual')).resolves.toBe(0);
  });
});
