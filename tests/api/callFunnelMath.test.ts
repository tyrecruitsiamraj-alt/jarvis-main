import { describe, expect, it } from 'vitest';
import { conversionRates, resolvedCallBase } from '@/lib/callFunnelMath';

/**
 * contract ของฐานตัวเลข funnel — กันถดถอยของบั๊กที่เจอกับข้อมูลจริง (7 ส.ค. 2569):
 * ผลกลับ 458 สาย เป็นสายที่คนกดยกเลิก 409 → ถ้าใครเผลอเอา 458 เป็นฐาน
 * จะได้ "โทรติด 7%" ทั้งที่สายที่โทรจริง 49 สายติด 61% — เลขชุดนี้ใช้ตัดสินใจเปิด auto
 */

describe('callFunnelMath — ฐานของเปอร์เซ็นต์', () => {
  it('เคสจริงที่เคยพลาด: หักสายยกเลิกออกจากฐานเสมอ (458 - 409 = 49)', () => {
    const funnel = {
      withResult: 458,
      connected: 30,
      needsHuman: 0,
      byOutcome: { cancelled: 409, confirmed: 3, acknowledged: 24, declined: 3 },
    };
    expect(resolvedCallBase(funnel)).toBe(49);
    const rates = conversionRates(funnel);
    expect(rates).not.toBeNull();
    // ฐานต้องเป็น 49 ไม่ใช่ 458 — เปอร์เซ็นต์จึงเล่าความจริง
    expect(rates!.base).toBe(49);
    expect(rates!.connectedPct).toBe(61);
    expect(rates!.confirmedPct).toBe(6);
    // ถ้าใครเปลี่ยนฐานกลับไปเป็น withResult ดิบ ๆ ค่านี้จะกลายเป็น 7 แล้วเทสต์นี้พัง
    expect(rates!.connectedPct).not.toBe(7);
  });

  it('ไม่มี cancelled ในผล = ฐานเท่า withResult (ไม่พังกับข้อมูลเก่า)', () => {
    expect(resolvedCallBase({ withResult: 10, byOutcome: {} })).toBe(10);
  });

  it('ยกเลิกหมดทุกสาย → ไม่มีฐานให้คิด ต้องคืน null ไม่ใช่หารศูนย์', () => {
    expect(
      conversionRates({ withResult: 5, connected: 0, needsHuman: 0, byOutcome: { cancelled: 5 } }),
    ).toBeNull();
  });

  it('ยังไม่มีผลกลับเลย → null', () => {
    expect(
      conversionRates({ withResult: 0, connected: 0, needsHuman: 0, byOutcome: {} }),
    ).toBeNull();
  });

  it('ปัดเป็นจำนวนเต็มและไม่เกิน 100 เมื่อทุกสายติด', () => {
    const rates = conversionRates({
      withResult: 3,
      connected: 3,
      needsHuman: 0,
      byOutcome: { confirmed: 3 },
    });
    expect(rates!.connectedPct).toBe(100);
    expect(rates!.confirmedPct).toBe(100);
  });
});
