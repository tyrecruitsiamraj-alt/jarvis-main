import { describe, expect, it } from 'vitest';
import {
  bookingActionFor,
  bookingTargetFromHold,
  bookingTargetFromPersonRef,
} from '../../src/lib/callResultBooking';

describe('bookingTargetFromPersonRef — ต้องตรงกับ splitPersonRef ฝั่ง api เป๊ะ', () => {
  it('card- = ผู้สมัครในบอร์ดของเรา · ir- = iRecruit', () => {
    expect(bookingTargetFromPersonRef('card-1805')).toEqual({
      source: 'board',
      candidateRef: '1805',
    });
    expect(bookingTargetFromPersonRef('ir-209375')).toEqual({
      source: 'irecruit',
      candidateRef: '209375',
    });
  });

  it('⚠️ ตัดคำนำหน้าให้ถูกความยาว — เลขที่ได้ต้องไม่กร่อนหรือเหลือขีด', () => {
    // เจตนา: ดักบั๊ก slice ผิดตัวเลข (card- = 5 ตัว · ir- = 3 ตัว)
    expect(bookingTargetFromPersonRef('card-3')?.candidateRef).toBe('3');
    expect(bookingTargetFromPersonRef('ir-3')?.candidateRef).toBe('3');
  });

  it('follow- ไม่ใช่ผู้สมัครในระบบ → จองไม่ได้', () => {
    expect(bookingTargetFromPersonRef('follow-abc')).toBeNull();
  });

  it('ค่าที่ไม่รู้จัก/ว่าง → null ไม่เดาว่าเป็นบอร์ด', () => {
    expect(bookingTargetFromPersonRef('')).toBeNull();
    expect(bookingTargetFromPersonRef('1805')).toBeNull();
    expect(bookingTargetFromPersonRef('cardish-1')).toBeNull();
    // มีคำนำหน้าแต่ไม่มีเลขต่อท้าย = ไม่รู้ว่าใคร
    expect(bookingTargetFromPersonRef('card-')).toBeNull();
    expect(bookingTargetFromPersonRef('ir-  ')).toBeNull();
  });
});

describe('bookingTargetFromHold — ล็อกโทรเป็นได้ทั้ง 3 ต้นทาง แต่จองได้ 2', () => {
  it('board / irecruit จองได้ตรงตัว', () => {
    expect(bookingTargetFromHold('board', '1805')).toEqual({
      source: 'board',
      candidateRef: '1805',
    });
    expect(bookingTargetFromHold('irecruit', '209375')).toEqual({
      source: 'irecruit',
      candidateRef: '209375',
    });
  });

  it('⚠️ application จองไม่ได้ — ref ของใบสมัครเป็นคนละชุดกับ card_id ของบอร์ด', () => {
    expect(bookingTargetFromHold('application', 'abc-123')).toBeNull();
  });

  it('ref ว่าง = ไม่รู้ว่าใคร', () => {
    expect(bookingTargetFromHold('board', '   ')).toBeNull();
  });
});

describe('bookingActionFor — invariant: ปิดปุ่มเมื่อไหร่ ต้องมีเหตุผลให้อ่านเสมอ', () => {
  const target = { source: 'board', candidateRef: '1805' } as const;

  it('invariant ครบทุกเคส', () => {
    const cases = [
      { target, jobId: 'siamraj-sql:OPL6908018' },
      { target, jobId: '' },
      { target, jobId: null },
      { target: null, jobId: 'siamraj-sql:OPL6908018' },
      { target: null, jobId: 'siamraj-sql:OPL6908018', personRef: 'follow-9' },
      { target, jobId: 'siamraj-sql:OPL6908018', alreadyBooked: true },
      { target, jobId: 'siamraj-sql:OPL6908018', busy: true },
      // จองไม่ได้อยู่แล้ว + กำลังบันทึก = ต้องยังมีเหตุผล ไม่ใช่เงียบ
      { target: null, jobId: null, busy: true },
    ];
    for (const c of cases) {
      const a = bookingActionFor(c);
      expect(a.disabled).toBe(a.reason !== null);
      if (a.disabled) expect(a.reason?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('เคสปกติ: รู้ทั้งคนและใบขอ → กดได้ ไม่มีเหตุผลค้าง', () => {
    const a = bookingActionFor({ target, jobId: 'siamraj-sql:OPL6908018' });
    expect(a.disabled).toBe(false);
    expect(a.reason).toBeNull();
  });

  it('ไม่มีใบขอ → บอกว่าไม่รู้จะจองให้ใบไหน (ไม่ใช่บอกว่าไม่รู้จักคน)', () => {
    const a = bookingActionFor({ target, jobId: null });
    expect(a.reason).toContain('ใบขอ');
  });

  it('มาจากหน้า Follow → เหตุผลต้องบอกว่าเป็นรายชื่อจาก Follow ไม่ใช่ข้อความกลาง ๆ', () => {
    const a = bookingActionFor({
      target: null,
      jobId: 'siamraj-sql:OPL6908018',
      personRef: 'follow-9',
    });
    expect(a.reason).toContain('Follow');
  });

  it('ไม่รู้ต้นทาง (ไม่ใช่ follow) → เหตุผลคนละอันกับเคส Follow', () => {
    const a = bookingActionFor({ target: null, jobId: 'siamraj-sql:OPL6908018' });
    expect(a.reason).not.toContain('Follow');
    expect(a.reason).toContain('จองตัวไม่ได้');
  });

  it('ล็อกโทรที่มาจากใบสมัคร → เหตุผลต้องบอกว่าเป็นใบสมัคร ไม่ใช่ "ไม่รู้ว่ามาจากไหน"', () => {
    const a = bookingActionFor({
      target: null,
      jobId: 'siamraj-sql:OPL6908018',
      holdSource: 'application',
    });
    expect(a.reason).toContain('ใบสมัคร');
    expect(a.reason).not.toContain('ไม่รู้ว่าคนนี้');
  });

  it('⚠️ เหตุผลของ Follow ต้องชนะ holdSource — คนละที่มา ห้ามสลับข้อความกัน', () => {
    const a = bookingActionFor({
      target: null,
      jobId: 'x',
      personRef: 'follow-9',
      holdSource: 'application',
    });
    expect(a.reason).toContain('Follow');
  });

  it('จองไปแล้วในรอบนี้ → ปิดพร้อมบอกว่าจองแล้ว (กันกดซ้ำจนได้ 409 ที่แปลคนละเรื่อง)', () => {
    const a = bookingActionFor({ target, jobId: 'x', alreadyBooked: true });
    expect(a.disabled).toBe(true);
    expect(a.reason).toContain('จองตัวไว้แล้ว');
  });

  it('⚠️ "จองแล้ว" ต้องชนะ "กำลังบันทึก" — ไม่งั้นแถวที่จองเสร็จแล้วกลับมากดได้อีก', () => {
    const a = bookingActionFor({ target, jobId: 'x', alreadyBooked: true, busy: true });
    expect(a.reason).toContain('จองตัวไว้แล้ว');
  });
});
