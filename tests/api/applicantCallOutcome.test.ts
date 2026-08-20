import { describe, expect, it } from 'vitest';
import {
  isInterestedOutcome,
  isKnownOutcome,
  isNotInterestedOutcome,
  splitInterested,
} from '../../src/lib/applicantCallOutcome';

/**
 * แท็บ "รายชื่อที่สนใจ" ของกล่องงาน — เจ้าของเคาะ 13 ส.ค. 2569 ว่าหมายถึง
 * **คนที่ตอบสนใจตอนโทร** ไม่ใช่สถานะใบสมัคร
 *
 * เกณฑ์ที่เลือกเทสต์: พังแล้วเงียบ — ถ้ากติกาเพี้ยน ลิสต์จะยังขึ้นปกติ
 * แต่มีคนที่ไม่ได้สนใจโผล่ในแท็บ (เจ้าหน้าที่โทรไปเสนองานให้คนที่ปฏิเสธไปแล้ว)
 * หรือคนที่สนใจจริงหายไป (ดีลหลุดโดยไม่มีใครรู้)
 */

describe('isInterestedOutcome — ใครนับว่าสนใจ', () => {
  it('confirmed = สนใจ', () => {
    expect(isInterestedOutcome('confirmed')).toBe(true);
  });

  it('**acknowledged (รับทราบ) ไม่ใช่สนใจ** — รับสายแล้วรับรู้ ไม่ได้แปลว่าเอางาน', () => {
    expect(isInterestedOutcome('acknowledged')).toBe(false);
  });

  it('ผลอื่นทั้งหมดไม่ใช่สนใจ', () => {
    for (const o of [
      'declined',
      'reschedule_requested',
      'no_answer',
      'busy',
      'unresponsive',
      'failed',
      'wrong_person',
      'cancelled',
    ]) {
      expect(isInterestedOutcome(o)).toBe(false);
    }
  });

  it('ไม่มีผลโทร / ค่าที่ไม่รู้จัก = ไม่ใช่สนใจ (ไม่เดาแทนคน)', () => {
    expect(isInterestedOutcome(null)).toBe(false);
    expect(isInterestedOutcome(undefined)).toBe(false);
    expect(isInterestedOutcome('')).toBe(false);
    expect(isInterestedOutcome('completed')).toBe(false); // ค่าเพี้ยนที่เคยเจอจริงในฐาน
  });
});

describe('isKnownOutcome — กันค่าแปลกปลอมขึ้นหน้าจอ', () => {
  it('รู้จักเฉพาะ outcome จริงของระบบ', () => {
    expect(isKnownOutcome('confirmed')).toBe(true);
    expect(isKnownOutcome('wrong_person')).toBe(true);
    // เจอจริงในฐาน 1 แถว — ถ้าหลุดขึ้นหน้าจอจะพังตอน index เข้า map ป้าย/สี
    expect(isKnownOutcome('completed')).toBe(false);
    expect(isKnownOutcome(null)).toBe(false);
  });
});

describe('splitInterested — แบ่งลิสต์ตามแท็บ', () => {
  const items = [
    { id: '1', last_call_outcome: 'confirmed' },
    { id: '2', last_call_outcome: 'declined' },
    { id: '3', last_call_outcome: null },
    { id: '4' },
    { id: '5', last_call_outcome: 'confirmed' },
  ];

  it('"ทั้งหมด" ต้องได้ทุกคนเสมอ ไม่ว่าผลโทรเป็นอะไร', () => {
    expect(splitInterested(items).all).toHaveLength(5);
  });

  it('"ที่สนใจ" ได้เฉพาะคนที่ตอบ confirmed', () => {
    expect(splitInterested(items).interested.map((i) => i.id)).toEqual(['1', '5']);
  });

  it('ลิสต์ว่างไม่พัง', () => {
    expect(splitInterested([])).toEqual({ all: [], interested: [], notInterested: [] });
  });

  it('ไม่มีใครสนใจ → ได้ลิสต์ว่าง ไม่ใช่ทั้งลิสต์', () => {
    const none = [{ id: 'a', last_call_outcome: 'no_answer' }];
    expect(splitInterested(none).interested).toEqual([]);
  });
});

/**
 * แท็บ "ไม่สนใจ" (เจ้าของสั่ง 20 ส.ค. 2569) — declined/wrong_person เท่านั้น
 * 🔴 โทรไม่ติด/ไม่รับ (no_answer/busy/unresponsive) ห้ามนับเป็นไม่สนใจ — ต้องตามต่อ
 */
describe('splitInterested — ไม่สนใจ', () => {
  it('declined กับ wrong_person เข้าไม่สนใจ · confirmed เข้าสนใจ · ที่เหลือแค่ทั้งหมด', () => {
    const items = [
      { id: 'yes', last_call_outcome: 'confirmed' },
      { id: 'no1', last_call_outcome: 'declined' },
      { id: 'no2', last_call_outcome: 'wrong_person' },
      { id: 'wait', last_call_outcome: 'no_answer' },
      { id: 'none', last_call_outcome: null },
    ];
    const { all, interested, notInterested } = splitInterested(items);
    expect(all).toHaveLength(5);
    expect(interested.map((x) => x.id)).toEqual(['yes']);
    expect(notInterested.map((x) => x.id)).toEqual(['no1', 'no2']);
  });

  it('🔴 no_answer/busy/unresponsive ไม่นับเป็นไม่สนใจ', () => {
    for (const o of ['no_answer', 'busy', 'unresponsive', 'failed', 'cancelled']) {
      expect(isNotInterestedOutcome(o), o).toBe(false);
    }
    expect(isNotInterestedOutcome('declined')).toBe(true);
    expect(isNotInterestedOutcome('wrong_person')).toBe(true);
    expect(isNotInterestedOutcome(null)).toBe(false);
  });
});
