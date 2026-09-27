import { describe, expect, it } from 'vitest';
import type { ResignedIncomeMonth } from '@/types';
import {
  lastMonthsOfPay,
  minusMonthsYmd,
  payPeriodDays,
  payPeriodKind,
  resignCutOf,
  resignedMonthlyNetAverage,
} from '@/lib/resignedIncome';

/**
 * รายได้คนเก่า "3 เดือนจริง" (เจ้าของเคาะ 26 ก.ย. 2569) — ด่านที่ห้ามหลุด:
 * 1. งวดครึ่งเดือนต้องได้ 6 งวด · เต็มเดือน 3 งวด (ของเดิมได้ 3 งวด = ~1.5 เดือน)
 * 2. หน้าต่างนับจากงวดล่าสุดของคนนั้น ไม่ใช่วันนี้
 * 3. ค่าเฉลี่ยตัดงวดไม่เต็มทิ้ง · สองงวดครึ่งเดือนรวมเป็นหนึ่งเดือนตรงกับ eSlip
 */

const p = (from: string, to: string, net: number | null = 10000): ResignedIncomeMonth => ({
  from,
  to,
  pay: net,
  deduct: 0,
  net,
});

describe('minusMonthsYmd — ถอยหลังแบบปฏิทิน', () => {
  it('ข้ามปีได้ และวันที่เกินสิ้นเดือนถูกหนีบ', () => {
    expect(minusMonthsYmd('2026-07-31', 3)).toBe('2026-04-30');
    expect(minusMonthsYmd('2026-05-31', 3)).toBe('2026-02-28');
    expect(minusMonthsYmd('2026-02-15', 3)).toBe('2025-11-15');
  });
  it('รูปไม่ถูก = null', () => {
    expect(minusMonthsYmd('31/07/2569', 3)).toBeNull();
  });
});

describe('lastMonthsOfPay — ตัดหน้าต่าง 3 เดือน', () => {
  it('🔴 งวดครึ่งเดือน = 6 งวด (ไม่ใช่ 3)', () => {
    const rows = [
      p('2026-07-16', '2026-07-31'),
      p('2026-07-01', '2026-07-15'),
      p('2026-06-16', '2026-06-30'),
      p('2026-06-01', '2026-06-15'),
      p('2026-05-16', '2026-05-31'),
      p('2026-05-01', '2026-05-15'),
      p('2026-04-16', '2026-04-30'),
      p('2026-04-01', '2026-04-15'),
    ];
    const kept = lastMonthsOfPay(rows);
    expect(kept).toHaveLength(6);
    expect(kept[kept.length - 1].from).toBe('2026-05-01');
  });

  it('งวดเต็มเดือน = 3 งวด', () => {
    const rows = [
      p('2026-07-01', '2026-07-31'),
      p('2026-06-01', '2026-06-30'),
      p('2026-05-01', '2026-05-31'),
      p('2026-04-01', '2026-04-30'),
      p('2026-03-01', '2026-03-31'),
    ];
    expect(lastMonthsOfPay(rows).map((r) => r.from)).toEqual(['2026-07-01', '2026-06-01', '2026-05-01']);
  });

  it('หน้าต่างนับจากงวดล่าสุดของคนนั้น — คนที่ออกไปนานแล้วก็ยังเห็น 3 เดือนสุดท้าย', () => {
    const rows = [p('2025-12-01', '2025-12-31'), p('2025-11-01', '2025-11-30'), p('2025-10-01', '2025-10-31')];
    expect(lastMonthsOfPay(rows)).toHaveLength(3);
  });

  it('งวดไม่รู้วันถูกตัด · ไม่รู้วันทุกงวด = คืน 3 งวดแรก', () => {
    const blank = { from: null, to: null, pay: 1, deduct: 0, net: 1 };
    expect(lastMonthsOfPay([p('2026-07-01', '2026-07-31'), blank])).toHaveLength(1);
    expect(lastMonthsOfPay([blank, blank, blank, blank])).toHaveLength(3);
  });
});

describe('payPeriodKind', () => {
  it('ครึ่งเดือน 13–16 วัน · เต็มเดือน 28–31 วัน · อื่น ๆ = ไม่เต็ม', () => {
    expect(payPeriodDays('2026-07-01', '2026-07-15')).toBe(15);
    expect(payPeriodKind('2026-07-01', '2026-07-15')).toBe('half');
    expect(payPeriodKind('2026-02-16', '2026-02-28')).toBe('half');
    expect(payPeriodKind('2026-07-01', '2026-07-31')).toBe('month');
    expect(payPeriodKind('2026-02-01', '2026-02-28')).toBe('month');
    expect(payPeriodKind('2026-07-10', '2026-07-15')).toBe('partial');
    expect(payPeriodKind(null, '2026-07-15')).toBeNull();
  });
});

describe('resignedMonthlyNetAverage — ปุ่ม "ใช้รายได้คนเก่า"', () => {
  it('🔴 สองงวดครึ่งเดือน 10,000 + 10,000 = เดือนละ 20,000 (ตรงกับ eSlip)', () => {
    const avg = resignedMonthlyNetAverage([p('2026-07-16', '2026-07-31'), p('2026-07-01', '2026-07-15')]);
    expect(avg).toMatchObject({ amount: 20000, fullPeriods: 2, monthsCovered: 1, skipped: 0 });
  });

  it('งวดไม่เต็ม (เพิ่งออก) ถูกตัดทิ้ง ไม่ดึงค่าเฉลี่ยลง', () => {
    const avg = resignedMonthlyNetAverage([
      p('2026-07-16', '2026-07-20', 2500),
      p('2026-07-01', '2026-07-15', 10000),
      p('2026-06-16', '2026-06-30', 10000),
    ]);
    expect(avg).toMatchObject({ amount: 20000, fullPeriods: 2, skipped: 1 });
  });

  it('เต็มเดือนปนครึ่งเดือนได้ (ครึ่งเดือนนับ 0.5)', () => {
    const avg = resignedMonthlyNetAverage([p('2026-07-01', '2026-07-31', 21000), p('2026-06-16', '2026-06-30', 9000)]);
    expect(avg?.amount).toBe(20000);
    expect(avg?.monthsCovered).toBe(1.5);
  });

  it('🔴 วันที่งวดดูเต็มแต่ออกกลางงวด / จ่ายหลังวันออก = ตัดทิ้ง (ใช้วันออกงานจากใบขอ)', () => {
    const rows = [
      p('2026-09-16', '2026-09-30', 900), // หลังวันออก
      p('2026-09-01', '2026-09-15', 3000), // ออกวันที่ 10 = กลางงวด
      p('2026-08-16', '2026-08-31', 10000),
      p('2026-08-01', '2026-08-15', 10000),
    ];
    expect(resignCutOf(rows[0], '2026-09-10')).toBe('after');
    expect(resignCutOf(rows[1], '2026-09-10')).toBe('mid');
    expect(resignCutOf(rows[2], '2026-09-10')).toBeNull();
    expect(resignCutOf(p('2026-09-01', '2026-09-15'), '2026-09-15')).toBeNull(); // ออกวันสุดท้ายของงวด = เต็ม
    expect(resignedMonthlyNetAverage(rows, '2026-09-10')).toMatchObject({ amount: 20000, fullPeriods: 2, skipped: 2 });
    // ไม่รู้วันออก = ตัดตามวันที่งวดอย่างเดียว (พฤติกรรมเดิม)
    expect(resignedMonthlyNetAverage(rows)?.fullPeriods).toBe(4);
  });

  it('ไม่มีงวดเต็มเลย / ไม่มีข้อมูล = null (ปุ่มกดไม่ได้)', () => {
    expect(resignedMonthlyNetAverage([p('2026-07-10', '2026-07-15')])).toBeNull();
    expect(resignedMonthlyNetAverage(null)).toBeNull();
    expect(resignedMonthlyNetAverage([p('2026-07-01', '2026-07-15', null)])).toBeNull();
  });
});
