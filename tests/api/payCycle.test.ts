/** รอบรับเงิน — ย้ายออกจากสวัสดิการ (เจ้าของ 4 ต.ค. 2569) */
import { describe, expect, it } from 'vitest';
import { cleanPayCycles, isLegacyDailyPayLine, payCycleText, payCyclesOf } from '@/lib/payCycle';
import { benefitDisplayLabels, EXTRA_BENEFITS } from '@/lib/extraBenefits';
import { cleanFieldOverrides } from '../../api/_lib/siamrajUnitNotes';

describe('payCycle', () => {
  it('ล้างค่า: รู้จักเฉพาะ 3 แบบ ไม่ซ้ำ เรียงตามลำดับ', () => {
    expect(cleanPayCycles(['daily', 'x', 'monthly', 'daily'])).toEqual(['monthly', 'daily']);
    expect(cleanPayCycles('daily')).toEqual([]);
  });
  it('ที่ตั้งไว้ชนะ · ใบเก่าที่ติ๊กจ่ายรายวันในสวัสดิการ = รายวัน', () => {
    expect(payCyclesOf({ field_overrides: { pay_cycles: ['weekly'] }, extra_benefits: ['จ่ายรายวัน'] })).toEqual(['weekly']);
    expect(payCyclesOf({ extra_benefits: ['daily_pay'] })).toEqual(['daily']);
    expect(payCyclesOf({ extra_benefits: ['ชุดฟอร์ม'] })).toEqual([]);
    expect(isLegacyDailyPayLine('จ่ายรายวัน ทุกวันศุกร์')).toBe(true);
  });
  it('คำบนจอ', () => {
    expect(payCycleText(['monthly', 'daily'])).toBe('รับเงินรายเดือน · รายวัน');
    expect(payCycleText([])).toBe('');
  });
  it('🔴 จ่ายรายวันไม่อยู่ในรายการสวัสดิการให้ติ๊ก และไม่โชว์เป็นสวัสดิการ', () => {
    expect(EXTRA_BENEFITS.some((b) => b.label === 'จ่ายรายวัน')).toBe(false);
    expect(benefitDisplayLabels(['daily_pay', 'จ่ายรายวัน', 'uniform'])).toEqual(['ชุดฟอร์ม']);
  });
  it('🔴 API รับ pay_cycles และไม่ล็อกสวัสดิการ 5 รายการแล้ว', () => {
    const out = cleanFieldOverrides({
      pay_cycles: ['daily', 'bogus'],
      benefits: Array.from({ length: 8 }, (_, i) => `สวัสดิการ ${i + 1}`),
    });
    expect(out?.pay_cycles).toEqual(['daily']);
    expect(out?.benefits).toHaveLength(8);
    expect(cleanFieldOverrides({ pay_cycles: [] })?.pay_cycles).toBeNull();
  });
});
