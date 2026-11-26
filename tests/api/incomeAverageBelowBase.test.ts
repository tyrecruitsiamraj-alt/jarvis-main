// @vitest-environment node
/**
 * รายได้เฉลี่ยต่ำกว่าฐานเงินเดือน = บอกแค่ฐาน (เจ้าของ Choice 27 พ.ย. 2569 "รายได้เฉลี่ยต่ำกว่าฐาน = ไม่พูด")
 * ของจริง LAO6911017: ทีมเลือก "รายได้เฉลี่ย" · เฉลี่ยสลิปคนเก่า 9,180 · ฐาน 14,000
 * AI พูด "รายได้ประมาณ 9,180 ฐานเงินเดือน 14,000" ผู้สมัครถาม "รายได้ 9,000 แต่ฐานเงินเดือน 100,000 มันคือยังไง"
 */
import { describe, expect, it } from 'vitest';
import { averageBelowBase, incomeLinesShown, spokenMonthlyIncome } from '../../src/lib/incomeShown';
import { buildApplyQuestions } from '../../api/_lib/lumosCallScript';

describe('averageBelowBase', () => {
  it('เฉลี่ยต่ำกว่าฐาน = true · เท่า/สูงกว่า = false', () => {
    expect(averageBelowBase(9180, 14000)).toBe(true);
    expect(averageBelowBase(14000, 14000)).toBe(false);
    expect(averageBelowBase(16500, 14000)).toBe(false);
  });
  it('ไม่รู้ฐานหรือไม่มีเฉลี่ย = ตัดสินไม่ได้ (false)', () => {
    expect(averageBelowBase(9180, null)).toBe(false);
    expect(averageBelowBase(null, 14000)).toBe(false);
    expect(averageBelowBase(0, 14000)).toBe(false);
  });
});

describe('spokenMonthlyIncome', () => {
  it('🔴 เลือกเฉลี่ยแต่ต่ำกว่าฐาน = null (ผู้เรียกพูดแค่ฐาน)', () => {
    expect(spokenMonthlyIncome('average', 19000, 9180, 14000)).toBeNull();
  });
  it('เลือกเฉลี่ยและไม่ต่ำกว่าฐาน = เฉลี่ย · ไม่ส่งฐาน = เฉลี่ยตามเดิม', () => {
    expect(spokenMonthlyIncome('average', 19000, 16500, 14000)).toBe(16500);
    expect(spokenMonthlyIncome('average', 19000, 9180)).toBe(9180);
  });
  it('เลือกรายได้รวม = รวมเสมอ', () => {
    expect(spokenMonthlyIncome('total', 19000, 9180, 14000)).toBe(19000);
  });
});

describe('incomeLinesShown (การ์ด/หน้าสมัคร)', () => {
  it('🔴 เลือกเฉลี่ยแต่ต่ำกว่าฐาน = ไม่ขึ้นทั้งรวมและเฉลี่ย (เหลือฐานบรรทัดเดียว)', () => {
    expect(incomeLinesShown('average', { total: true, average: true, averageBelowBase: true })).toEqual({ total: false, average: false });
  });
  it('เลือกรวม = รวม แม้เฉลี่ยต่ำกว่าฐาน · เลือกเฉลี่ยปกติ = เฉลี่ย', () => {
    expect(incomeLinesShown('total', { total: true, average: true, averageBelowBase: true })).toEqual({ total: true, average: false });
    expect(incomeLinesShown('average', { total: true, average: true })).toEqual({ total: false, average: true });
  });
});

describe('บท AI ของใบที่เฉลี่ยต่ำกว่าฐาน (ค่าที่ตัวโหลดส่งเข้ามา)', () => {
  it('baseOnly = พูดฐาน 14,000 ไม่มีบรรทัด "รายได้ประมาณ" และไม่มี 9,180', () => {
    const text = buildApplyQuestions({ candidateName: 'สมชาย', monthlyIncome: 14000, baseSalary: 14000, baseOnly: true }).join('\n');
    expect(text).toContain('14,000');
    expect(text).not.toContain('รายได้ประมาณ');
    expect(text).not.toContain('9,180');
  });
});
