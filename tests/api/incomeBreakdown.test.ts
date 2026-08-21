import { describe, it, expect } from 'vitest';
import {
  BENEFIT_LINE_MAX,
  INCOME_LINE_MAX,
  INCOME_OTHER_LABEL,
  buildIncomeDisplay,
  cleanBenefitLines,
  cleanIncomeBreakdown,
  normalizeIncomeLines,
  sumIncomeLines,
} from '@/lib/incomeBreakdown';

/**
 * เจ้าของสั่ง 20 ส.ค. 2569: รายได้แบบแยกส่วนบนประกาศ + ยอดรวมปรับเองได้
 * เคาะเป็น Choice แล้ว: ยอดรวม > ผลบวก → เติมบรรทัด "อื่น ๆ" ให้ balance ·
 * สวัสดิการเป็น freetext จำกัดจำนวน
 */
describe('buildIncomeDisplay', () => {
  const lines = [
    { label: 'ฐานเงินเดือน', amount: 15000 },
    { label: 'เบี้ยขยัน', amount: 2000 },
    { label: 'ค่าโทรศัพท์', amount: 1000 },
  ];

  it('🔴 เคสที่เจ้าของยกตัวอย่าง: รวมได้ 18,000 ใส่ 20,000 → เติม "อื่น ๆ" 2,000 เลข balance', () => {
    const out = buildIncomeDisplay({ period: 'monthly', lines, total: 20000 })!;
    expect(out.total).toBe(20000);
    expect(out.lines).toHaveLength(4);
    expect(out.lines[3]).toEqual({ label: INCOME_OTHER_LABEL, amount: 2000 });
    // 🔴 ผลบวกของบรรทัดที่ผู้สมัครเห็นต้องเท่ายอดรวมเป๊ะ
    expect(sumIncomeLines(out.lines)).toBe(out.total);
  });

  it('ไม่ใส่ยอดรวม = ใช้ผลบวกของรายการ ไม่มีบรรทัดอื่น ๆ', () => {
    const out = buildIncomeDisplay({ period: 'monthly', lines, total: null })!;
    expect(out.total).toBe(18000);
    expect(out.lines).toHaveLength(3);
  });

  it('🔴 ยอดรวมน้อยกว่าผลบวก = ไม่ยอมรับ ใช้ผลบวกแทน (เลขห้ามโกหกลง)', () => {
    const out = buildIncomeDisplay({ period: 'monthly', lines, total: 10000 })!;
    expect(out.total).toBe(18000);
    expect(sumIncomeLines(out.lines)).toBe(18000);
  });

  it('ยอดรวมเท่าผลบวกพอดี = ไม่เติมบรรทัดอื่น ๆ', () => {
    const out = buildIncomeDisplay({ period: 'daily', lines: [{ label: 'ค่าแรง', amount: 450 }], total: 450 })!;
    expect(out.lines).toHaveLength(1);
    expect(out.total).toBe(450);
    expect(out.period).toBe('daily');
  });

  it('ไม่มีรายการเลย = null (ถอยไปแสดงรายได้แบบเดิม)', () => {
    expect(buildIncomeDisplay(null)).toBeNull();
    expect(buildIncomeDisplay({ period: 'monthly', lines: [], total: 20000 })).toBeNull();
  });
});

describe('normalizeIncomeLines / cleanIncomeBreakdown', () => {
  it('ตัดบรรทัดว่าง เลขติดลบ/ศูนย์/เพี้ยน และตัดความยาวป้าย', () => {
    const out = normalizeIncomeLines([
      { label: '  ฐานเงินเดือน  ', amount: 15000 },
      { label: '', amount: 999 },
      { label: 'ติดลบ', amount: -5 },
      { label: 'ศูนย์', amount: 0 },
      { label: 'ยาว'.repeat(40), amount: 100 },
      'ไม่ใช่ object',
      null,
    ]);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ label: 'ฐานเงินเดือน', amount: 15000 });
    expect(out[1].label.length).toBeLessThanOrEqual(30);
  });

  it(`จำกัดไม่เกิน ${INCOME_LINE_MAX} รายการ`, () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ label: `รายการ${i}`, amount: 100 }));
    expect(normalizeIncomeLines(many)).toHaveLength(INCOME_LINE_MAX);
  });

  it('cleanIncomeBreakdown: ค่าที่เพี้ยนคืน null · period เพี้ยนถอยเป็น monthly', () => {
    expect(cleanIncomeBreakdown(null)).toBeNull();
    expect(cleanIncomeBreakdown('junk')).toBeNull();
    expect(cleanIncomeBreakdown({ period: 'weekly', lines: [{ label: 'ฐาน', amount: 1 }], total: 'x' })).toEqual({
      period: 'monthly',
      lines: [{ label: 'ฐาน', amount: 1 }],
      total: null,
    });
  });
});

describe('cleanBenefitLines (สวัสดิการ freetext จำกัดจำนวน)', () => {
  it(`ตัดว่าง/ซ้ำ · จำกัด ${BENEFIT_LINE_MAX} รายการ · ป้ายยาวสุด 30 ตัวอักษร`, () => {
    const out = cleanBenefitLines([
      ' ชุดฟอร์ม ',
      'ชุดฟอร์ม',
      '',
      'ที่พักฟรีสำหรับพนักงานที่มาจากต่างจังหวัดไกล ๆ มาก ๆ',
      'รถรับส่ง',
      'ประกันสังคม',
      'โบนัส',
      'อาหารกลางวัน',
      'เกินโควตา',
    ]);
    expect(out.length).toBeLessThanOrEqual(BENEFIT_LINE_MAX);
    expect(out[0]).toBe('ชุดฟอร์ม');
    expect(new Set(out).size).toBe(out.length);
    for (const b of out) expect(b.length).toBeLessThanOrEqual(30);
  });

  it('ไม่ใช่ array = []', () => {
    expect(cleanBenefitLines(null)).toEqual([]);
    expect(cleanBenefitLines('ชุดฟอร์ม')).toEqual([]);
  });
});
