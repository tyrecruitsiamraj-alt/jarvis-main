// @vitest-environment node
/**
 * ช่องของแต่ละรอบโทรหน้า Follow (เจ้าของสั่ง 18 ส.ค. 2569)
 *
 * ทำไมต้องคุม: แถวเดียวมี **สองแกน** ปนกัน (สถานะสาย vs ผลปิดงาน) คนอ่านง่ายมาก
 * ที่จะเข้าใจว่าทุกช่องบวกกันได้ "ทั้งหมด" ซึ่งไม่จริง · และ 'ลา'/'อื่น ๆ' ต้องไม่ถูก
 * เหมาเป็น "ไม่ไป" เพราะยังไม่รู้ผลจริง
 */
import { describe, expect, it } from 'vitest';
import {
  countFollowRoundBuckets,
  FOLLOW_ROUND_BUCKETS,
  followRoundSlot,
  inFollowRoundBucket,
  type FollowRoundRow,
} from '../../src/lib/followRoundBuckets';

const row = (o: Partial<FollowRoundRow> = {}): FollowRoundRow => ({ call_status: 'pending', ...o });

describe('ช่องทั้ง 7', () => {
  it('เรียงตามที่เจ้าของสั่ง', () => {
    expect([...FOLLOW_ROUND_BUCKETS]).toEqual([
      'all', 'waiting', 'calling', 'connected', 'unreached', 'went', 'not_went',
    ]);
  });

  it('"ทั้งหมด" รับทุกคน', () => {
    expect(inFollowRoundBucket(row(), 'all')).toBe(true);
    expect(inFollowRoundBucket(row({ cancelled: true }), 'all')).toBe(true);
  });
});

describe('แกนสถานะสาย', () => {
  it('🔴 รอโทร = ยังไม่ถูกดึง · กำลังโทร = ดึงไปแล้วยังไม่มีผล (ห้ามปนกัน)', () => {
    expect(inFollowRoundBucket(row({ call_status: 'pending' }), 'waiting')).toBe(true);
    expect(inFollowRoundBucket(row({ call_status: 'pending' }), 'calling')).toBe(false);
    expect(inFollowRoundBucket(row({ call_status: 'delivered' }), 'calling')).toBe(true);
    expect(inFollowRoundBucket(row({ call_status: 'delivered' }), 'waiting')).toBe(false);
  });

  it('มีผลแล้วไม่อยู่ทั้งรอโทรและกำลังโทร', () => {
    const r = row({ call_status: 'completed', call_outcome: 'confirmed' });
    expect(inFollowRoundBucket(r, 'waiting')).toBe(false);
    expect(inFollowRoundBucket(r, 'calling')).toBe(false);
    expect(inFollowRoundBucket(r, 'connected')).toBe(true);
  });

  it('โทรติด/โทรไม่ติด ใช้กติกาเดียวกับที่อื่นทั้งระบบ', () => {
    expect(inFollowRoundBucket(row({ call_outcome: 'declined' }), 'connected')).toBe(true);
    expect(inFollowRoundBucket(row({ call_outcome: 'no_answer' }), 'unreached')).toBe(true);
  });

  it('🔴 ยกเลิกแล้วไม่ตกไปอยู่ "รอโทร"', () => {
    const r = row({ cancelled: true, call_status: 'pending' });
    expect(inFollowRoundBucket(r, 'waiting')).toBe(false);
    expect(inFollowRoundBucket(r, 'calling')).toBe(false);
  });
});

describe('แกนผลปิดงาน', () => {
  it('เสร็จสิ้น = ไป', () => {
    expect(inFollowRoundBucket(row({ outcome_code: 'done' }), 'went')).toBe(true);
    expect(inFollowRoundBucket(row({ outcome_code: 'done' }), 'not_went')).toBe(false);
  });

  it('ไม่ไปเริ่มงาน / ยกเลิกงาน = ไม่ไป', () => {
    for (const c of ['no_show_start', 'job_cancelled']) {
      expect(inFollowRoundBucket(row({ outcome_code: c }), 'not_went')).toBe(true);
      expect(inFollowRoundBucket(row({ outcome_code: c }), 'went')).toBe(false);
    }
  });

  it('🔴 "ลา" กับ "อื่น ๆ" ไม่เข้าทั้งสองช่อง — ยังไม่รู้ผลจริง ห้ามเหมา', () => {
    for (const c of ['leave', 'other']) {
      expect(inFollowRoundBucket(row({ outcome_code: c }), 'went')).toBe(false);
      expect(inFollowRoundBucket(row({ outcome_code: c }), 'not_went')).toBe(false);
    }
  });

  it('ยังไม่ปิดงาน = ไม่เข้าทั้งสองช่อง', () => {
    expect(inFollowRoundBucket(row({ outcome_code: null }), 'went')).toBe(false);
    expect(inFollowRoundBucket(row({ outcome_code: 'อะไรไม่รู้' }), 'not_went')).toBe(false);
  });
});

describe('นับทั้งรอบ', () => {
  it('คืนครบทุกช่องเสมอ แม้เป็น 0 (ช่อง 0 ก็ต้องโชว์)', () => {
    const c = countFollowRoundBuckets([]);
    expect(Object.keys(c).sort()).toEqual([...FOLLOW_ROUND_BUCKETS].sort());
    expect(Object.values(c).every((v) => v === 0)).toBe(true);
  });

  it('🔴 ช่องต่าง ๆ ซ้อนกันได้ — บวกกันแล้วไม่เท่า "ทั้งหมด"', () => {
    // คนเดียว: โทรติด + ปิดงานว่าไป → อยู่ทั้งสองช่อง
    const c = countFollowRoundBuckets([
      row({ call_status: 'completed', call_outcome: 'confirmed', outcome_code: 'done' }),
    ]);
    expect(c.all).toBe(1);
    expect(c.connected).toBe(1);
    expect(c.went).toBe(1);
    const sum = c.waiting + c.calling + c.connected + c.unreached + c.went + c.not_went;
    expect(sum).toBeGreaterThan(c.all);
  });
});

/**
 * 🐛 บั๊กที่เจอ 23 ส.ค. 2569 (Phase 7) — ช่อง "ไป" เคยเช็คแค่ `'done'` (คำชุดเก่า)
 * ไม่รับ `went`/`arrived` ของ migration 101 ⇒ ตั้งแต่เปลี่ยนชุดคำ **เลขช่องนี้ต่ำกว่าจริง
 * ทุกแถว** และเทสต์ชุดเดิมไม่จับเพราะไม่มีเคสของคำใหม่เลย
 */
describe('ช่อง "ไป/ไม่ไป" ต้องรับชุดคำใหม่ของ migration 101', () => {
  const closed = (code: string) => ({
    call_status: 'completed',
    call_outcome: 'confirmed',
    outcome_code: code,
  });

  it('went / arrived / done เข้าช่อง "ไป" ทั้งสามคำ', () => {
    for (const code of ['went', 'arrived', 'done']) {
      expect(inFollowRoundBucket(closed(code), 'went')).toBe(true);
      expect(inFollowRoundBucket(closed(code), 'not_went')).toBe(false);
    }
  });

  it('cancelled / job_cancelled / no_show_start เข้าช่อง "ไม่ไป"', () => {
    for (const code of ['cancelled', 'job_cancelled', 'no_show_start']) {
      expect(inFollowRoundBucket(closed(code), 'not_went')).toBe(true);
      expect(inFollowRoundBucket(closed(code), 'went')).toBe(false);
    }
  });

  it('ลา / เลื่อน / อื่น ๆ ไม่เข้าทั้งสองช่อง (ยังไม่รู้ผลจริง)', () => {
    for (const code of ['leave', 'postponed', 'other']) {
      expect(inFollowRoundBucket(closed(code), 'went')).toBe(false);
      expect(inFollowRoundBucket(closed(code), 'not_went')).toBe(false);
    }
  });

  it('นิยาม "สำเร็จ" มาจากแหล่งเดียว — ตรงกับที่แท็บ success ใช้', async () => {
    const { FOLLOW_OUTCOME_SUCCESS } = await import('../../src/lib/followOutcome.js');
    for (const code of FOLLOW_OUTCOME_SUCCESS) {
      expect(inFollowRoundBucket(closed(code), 'went')).toBe(true);
    }
  });
});

describe('🔴 แดชบอร์ดการโทร — สายที่คนเลือกไว้ชนะ attempt_count (feedback 2 ก.ย. 2569)', () => {
  /**
   * เคสจริงที่ทำให้แดชบอร์ดผิด: โหมด "ระบุเวลาเอง" สร้างหนึ่งแถวต่อหนึ่งรอบ
   * แต่ละแถวมีคิวของตัวเอง ⇒ attempt_count เป็น 1 หมด ⇒ ทุกรอบไปกองที่ครั้งที่ 1
   * (วัดฐานจริง 2 ก.ย.: 7 สายขึ้นครั้งที่ 1 ทั้งหมด ทั้งที่เป็นสายที่ 1 สี่ · สายที่ 2 สาม)
   */
  it('call_round = 2 แต่ attempt_count = 1 → ต้องอยู่ครั้งที่ 2', () => {
    expect(followRoundSlot({ call_round: 2, call_attempt: 1, call_status: 'completed' })).toBe(2);
  });

  it('แถวเก่าที่ไม่มี call_round → ถอยไปใช้ attempt_count เหมือนเดิม', () => {
    expect(followRoundSlot({ call_attempt: 3, call_status: 'completed' })).toBe(3);
  });

  it('ยังไม่เคยเข้าคิวและไม่มีผล = ยังไม่อยู่รอบไหน', () => {
    expect(followRoundSlot({ call_attempt: null, call_status: 'pending', call_outcome: null })).toBeNull();
  });

  it('เกิน 3 รวบเป็น 3 (เพดานเริ่มต้นคือ 3 ครั้ง)', () => {
    expect(followRoundSlot({ call_round: 7, call_status: 'completed' })).toBe(3);
  });
});
