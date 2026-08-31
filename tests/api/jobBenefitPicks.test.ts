import { describe, expect, it } from 'vitest';

import {
  isPenaltyRate,
  mergePickedIntoLines,
  rateLineChoices,
} from '../../src/lib/jobBenefitPicks';

/**
 * ติ๊กสวัสดิการจาก **ตารางอัตราตามใบขอ (ERP)** — เจ้าของชี้ตารางนี้มาเอง 31 ส.ค. 2569
 *
 * 🔴 สองข้อที่ห้ามพลาด: อัตราเบิกห้ามหลุด · ค่าตั้งต้นต้องไม่ติ๊กอะไรเลย
 * (ตารางมีค่าปรับปนอยู่ — ติ๊กไว้ให้ล่วงหน้า = "ค่าปรับขาดงาน" หลุดขึ้นประกาศหาคน)
 */
const LINES = [
  { seq: 1, fee_name: 'เงินเดือน', is_wage: true, payment_rate: 16304, draw_rate: 23861 },
  { seq: 2, fee_name: 'เงินชดเชยลาป่วย (ปกส)', is_wage: false, payment_rate: 543.47, draw_rate: 0 },
  { seq: 3, fee_name: 'มาสาย', is_wage: false, payment_rate: 67.93, draw_rate: 0 },
  { seq: 4, fee_name: 'ค่าปรับขาดงาน (ตามอัตรา)', is_wage: false, payment_rate: 851.05, draw_rate: 851.05 },
  { seq: 5, fee_name: 'ค่าล่วงเวลา 1.5 เท่า', is_wage: false, payment_rate: 101.9, draw_rate: 149.13 },
  { seq: 6, fee_name: 'ค่าโทรศัพท์', is_wage: false, payment_rate: 0, draw_rate: 0 },
];

describe('ตัวเลือกที่สร้างจากตารางอัตรา', () => {
  it('เอามาครบทุกบรรทัด เรียงตามตารางเดิม', () => {
    expect(rateLineChoices(LINES).map((c) => c.key)).toEqual([
      '1|เงินเดือน',
      '2|เงินชดเชยลาป่วย (ปกส)',
      '3|มาสาย',
      '4|ค่าปรับขาดงาน (ตามอัตรา)',
      '5|ค่าล่วงเวลา 1.5 เท่า',
      '6|ค่าโทรศัพท์',
    ]);
  });

  it('🔴 อัตราเบิกห้ามโผล่ในป้ายเด็ดขาด — ใช้อัตราจ่ายเท่านั้น', () => {
    const labels = rateLineChoices(LINES).map((c) => c.label).join(' | ');
    expect(labels).toContain('16,304');
    expect(labels).not.toContain('23,861');
    expect(labels).not.toContain('149.13');
  });

  it('บรรทัดที่ไม่มีตัวเลข ขึ้นแค่ชื่อ ไม่ขึ้น "0 บาท"', () => {
    const phone = rateLineChoices(LINES).find((c) => c.key.includes('ค่าโทรศัพท์'));
    expect(phone?.label).toBe('ค่าโทรศัพท์');
  });

  it('🔴 `name` ต้องเป็นชื่อดิบ ไม่มีตัวเลขปน — เอาไปเป็นป้ายของรายการรายได้', () => {
    const ot = rateLineChoices(LINES).find((c) => c.key.includes('ค่าล่วงเวลา 1.5'));
    expect(ot?.name).toBe('ค่าล่วงเวลา 1.5 เท่า');
    expect(ot?.label).toBe('ค่าล่วงเวลา 1.5 เท่า 101.9 บาท');
    expect(ot?.amount).toBe(101.9);
  });

  it('🔴 ติดธงค่าปรับให้จอเตือนได้', () => {
    const flagged = rateLineChoices(LINES).filter((c) => c.isPenalty).map((c) => c.key);
    expect(flagged).toEqual(['3|มาสาย', '4|ค่าปรับขาดงาน (ตามอัตรา)']);
  });

  it('ติดธงค่าจ้างหลัก — มีช่องรายได้ของตัวเองแล้ว', () => {
    expect(rateLineChoices(LINES).filter((c) => c.isWage).map((c) => c.key)).toEqual(['1|เงินเดือน']);
  });

  it('ชื่อซ้ำกันคนละบรรทัด ต้องแยกกันได้ (ERP มี "เงินเดือน" สองบรรทัดจริง)', () => {
    const dup = rateLineChoices([
      { seq: 1, fee_name: 'เงินเดือน', is_wage: true, payment_rate: 12000, draw_rate: 0 },
      { seq: 2, fee_name: 'เงินเดือน', is_wage: false, payment_rate: 400, draw_rate: 0 },
    ]);
    expect(dup).toHaveLength(2);
    expect(dup[0].key).not.toBe(dup[1].key);
  });

  it('ไม่มีตารางอัตรา = ไม่มีอะไรให้ติ๊ก (จอต้องมีข้อความบอก)', () => {
    expect(rateLineChoices(null)).toEqual([]);
    expect(rateLineChoices([])).toEqual([]);
  });

  it('คำที่นับว่าเป็นค่าปรับ', () => {
    expect(isPenaltyRate('มาสาย')).toBe(true);
    expect(isPenaltyRate('ค่าปรับขาดงาน')).toBe(true);
    expect(isPenaltyRate('ค่าล่วงเวลา 1.5 เท่า')).toBe(false);
    expect(isPenaltyRate(null)).toBe(false);
  });
});

describe('รวมของที่ติ๊กเข้ากับของที่พิมพ์เอง', () => {
  it('ต่อท้ายของที่พิมพ์ ไม่ทับกัน', () => {
    expect(mergePickedIntoLines(['มีรถรับส่ง'], ['ค่าโทรศัพท์'])).toEqual([
      'มีรถรับส่ง',
      'ค่าโทรศัพท์',
    ]);
  });

  it('ติ๊กของที่พิมพ์ไว้แล้ว ไม่ขึ้นซ้ำสองรอบ', () => {
    expect(mergePickedIntoLines(['ค่าโทรศัพท์'], ['ค่าโทรศัพท์'])).toEqual(['ค่าโทรศัพท์']);
  });

  it('🔴 ไม่ติ๊กอะไรเลย = ได้เท่าที่พิมพ์ (ค่าตั้งต้นต้องไม่เพิ่มอะไรเอง)', () => {
    expect(mergePickedIntoLines(['ชุดฟอร์ม'], [])).toEqual(['ชุดฟอร์ม']);
    expect(mergePickedIntoLines([], [])).toEqual([]);
  });
});
