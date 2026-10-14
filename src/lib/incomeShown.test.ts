import { describe, expect, it } from 'vitest';
import { incomeLinesShown, incomeShownOf, spokenMonthlyIncome } from '@/lib/incomeShown';

/** รายได้รวม หรือ เฉลี่ย — เลือกทีละใบขอ (เจ้าของ Choice 14 ต.ค. 2569) */
describe('incomeShown', () => {
  it('ไม่ตั้ง/ค่าแปลก = ทั้งสอง (ใบเก่าไม่เปลี่ยน)', () => {
    expect(incomeShownOf(null)).toBe('both');
    expect(incomeShownOf({ income_shown: 'x' })).toBe('both');
    expect(incomeShownOf({ income_shown: 'average' })).toBe('average');
  });

  it('เลือกตัวไหนขึ้นตัวนั้น · ตัวที่เลือกไม่มีข้อมูล = ใช้อีกตัว', () => {
    const has = { total: true, average: true };
    expect(incomeLinesShown('both', has)).toEqual({ total: true, average: true });
    expect(incomeLinesShown('total', has)).toEqual({ total: true, average: false });
    expect(incomeLinesShown('average', has)).toEqual({ total: false, average: true });
    expect(incomeLinesShown('average', { total: true, average: false })).toEqual({ total: true, average: false });
    expect(incomeLinesShown('total', { total: false, average: true })).toEqual({ total: false, average: true });
  });

  it('AI พูดเฉลี่ยเฉพาะเมื่อเลือกเฉลี่ยและมีเลข', () => {
    expect(spokenMonthlyIncome('average', 20000, 12700)).toBe(12700);
    expect(spokenMonthlyIncome('average', 20000, null)).toBe(20000);
    expect(spokenMonthlyIncome('both', 20000, 12700)).toBe(20000);
    expect(spokenMonthlyIncome('total', 20000, 12700)).toBe(20000);
  });
});
