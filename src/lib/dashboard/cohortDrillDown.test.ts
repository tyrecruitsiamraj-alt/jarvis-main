import { describe, expect, it } from 'vitest';
import { buildCohortDrillDown } from '@/lib/dashboard/cohortDrillDown';
import { sumCohortStockByRequestDate, type ThroughputRecord } from '@/lib/dashboard/throughput';

function rec(p: Partial<ThroughputRecord> & { requestDate: string; positionUnits: number }): ThroughputRecord {
  return {
    requestNo: 'OPL6907001',
    jobId: 'siamraj-sql:OPL6907001',
    requestNoDisplay: 'OPL6907001',
    unitName: 'ฮอนด้า',
    siteCode: 'S001',
    departmentCode: 'LBD',
    closureDate: null,
    isOpen: false,
    kind: 'filled',
    ...p,
  };
}

/** ใบขอหนึ่งใบครบสามถัง: ขอ 10 = ปิด 4 · ยกเลิก 3 · เหลือ 3 */
const oneFullRequest: ThroughputRecord[] = [
  rec({ requestDate: '2026-08-01', positionUnits: 4, kind: 'filled', closureDate: '2026-08-05' }),
  rec({ requestDate: '2026-08-01', positionUnits: 3, kind: 'cancelled', closureDate: '2026-08-06' }),
  rec({ requestDate: '2026-08-01', positionUnits: 3, kind: 'remaining', isOpen: true }),
];

describe('buildCohortDrillDown', () => {
  it('เข้ามา = ทุกใบในช่วง · อัตรารวมทั้งใบ', () => {
    const r = buildCohortDrillDown(oneFullRequest, '2026-08-01', '2026-08-31', 'total_requests');
    expect(r.requestCount).toBe(1);
    expect(r.positions).toBe(10);
    expect(r.rows[0].requestPositions).toBe(10);
    expect(r.rows[0].positions).toBe(10);
  });

  it('ปิดแล้ว / ยกเลิก / คงเหลือ = เฉพาะอัตราของถังนั้น', () => {
    expect(buildCohortDrillDown(oneFullRequest, '2026-08-01', '2026-08-31', 'closed').positions).toBe(4);
    expect(buildCohortDrillDown(oneFullRequest, '2026-08-01', '2026-08-31', 'cancelled').positions).toBe(3);
    expect(buildCohortDrillDown(oneFullRequest, '2026-08-01', '2026-08-31', 'remaining').positions).toBe(3);
  });

  it('ใบที่ไม่มีอัตราในถังนั้นต้องไม่ขึ้นในรายการ', () => {
    const records = [
      ...oneFullRequest,
      rec({ requestNo: 'DSO6907009', jobId: 'siamraj-sql:DSO6907009', requestNoDisplay: 'DSO6907009', requestDate: '2026-08-02', positionUnits: 5, kind: 'filled' }),
    ];
    const cancelled = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'cancelled');
    expect(cancelled.rows.map((x) => x.requestNo)).toEqual(['OPL6907001']);
    const closed = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed');
    expect(closed.rows.map((x) => x.requestNo)).toEqual(['OPL6907001', 'DSO6907009']);
  });

  it('🔴 ตัวเลขต้องเท่ากับที่การ์ดใช้ (sumCohortStockByRequestDate) เป๊ะ ๆ ทุกถัง', () => {
    const records: ThroughputRecord[] = [
      ...oneFullRequest,
      rec({ requestNo: 'LAO6907002', jobId: 'siamraj-sql:LAO6907002', requestNoDisplay: 'LAO6907002', departmentCode: 'LBA', requestDate: '2026-08-10', positionUnits: 6, kind: 'filled' }),
      rec({ requestNo: 'LAO6907002', jobId: 'siamraj-sql:LAO6907002', requestNoDisplay: 'LAO6907002', departmentCode: 'LBA', requestDate: '2026-08-10', positionUnits: 2, kind: 'cancelled' }),
      rec({ requestNo: 'SQ6907003', jobId: 'siamraj-sql:SQ6907003', requestNoDisplay: 'SQ6907003', requestDate: '2026-08-20', positionUnits: 9, kind: 'remaining', isOpen: true }),
      // นอกช่วง — ต้องไม่ถูกนับทั้งสองฝั่ง
      rec({ requestNo: 'OPL6906001', jobId: 'siamraj-sql:OPL6906001', requestNoDisplay: 'OPL6906001', requestDate: '2026-07-31', positionUnits: 99, kind: 'filled' }),
    ];
    const card = sumCohortStockByRequestDate(records, '2026-08-01', '2026-08-31');
    const intake = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'total_requests');
    const closed = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed');
    const cancelled = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'cancelled');
    const remaining = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'remaining');

    expect(intake.positions).toBe(card.requestPositions);
    expect(intake.requestCount).toBe(card.requestCount);
    expect(closed.positions).toBe(card.filledPositions);
    expect(closed.requestCount).toBe(card.filledRequestCount);
    expect(cancelled.positions).toBe(card.cancelledPositions);
    expect(cancelled.requestCount).toBe(card.cancelledRequestCount);
    expect(remaining.positions).toBe(card.remainingPositions);
    expect(remaining.requestCount).toBe(card.remainingRequestCount);
  });

  it('ช่วงทั้งปีก็ต้องได้รายการครบ ไม่ใช่เฉพาะเดือนปัจจุบัน', () => {
    const records: ThroughputRecord[] = [
      rec({ requestNo: 'A1', jobId: 'siamraj-sql:A1', requestNoDisplay: 'A1', requestDate: '2026-01-15', positionUnits: 2, kind: 'filled' }),
      rec({ requestNo: 'A2', jobId: 'siamraj-sql:A2', requestNoDisplay: 'A2', requestDate: '2026-06-15', positionUnits: 3, kind: 'filled' }),
      rec({ requestNo: 'A3', jobId: 'siamraj-sql:A3', requestNoDisplay: 'A3', requestDate: '2026-12-31', positionUnits: 4, kind: 'filled' }),
    ];
    const year = buildCohortDrillDown(records, '2026-01-01', '2026-12-31', 'closed');
    expect(year.requestCount).toBe(3);
    expect(year.positions).toBe(9);
    const month = buildCohortDrillDown(records, '2026-06-01', '2026-06-30', 'closed');
    expect(month.rows.map((r) => r.requestNo)).toEqual(['A2']);
  });

  it('🔴 อัตราที่ไม่มีเลขที่ใบยังนับในยอด แต่ต้องรายงานว่าลิสต์ไม่ได้', () => {
    const records: ThroughputRecord[] = [
      rec({ requestNo: undefined, jobId: undefined, requestNoDisplay: undefined, requestDate: '2026-08-03', positionUnits: 7, kind: 'cancelled' }),
      rec({ requestNo: 'B1', jobId: 'siamraj-sql:B1', requestNoDisplay: 'B1', requestDate: '2026-08-03', positionUnits: 1, kind: 'cancelled' }),
    ];
    const r = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'cancelled');
    expect(r.positions).toBe(8);
    expect(r.requestCount).toBe(1);
    expect(r.positionsWithoutRequestNo).toBe(7);
    // ถังอื่นต้องไม่เอาอัตราของถังยกเลิกไปนับ
    expect(buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed').positionsWithoutRequestNo).toBe(0);
  });

  it('🔴 เลขท้ายซ้ำข้าม BU ต้องแยกกันคนละใบ (คีย์เป็นเลขเต็ม)', () => {
    const records: ThroughputRecord[] = [
      rec({ requestNo: 'OPL6907002', jobId: 'siamraj-sql:OPL6907002', requestNoDisplay: 'OPL6907002', unitName: 'ฮอนด้า', departmentCode: 'LBD', requestDate: '2026-08-04', positionUnits: 2, kind: 'filled' }),
      rec({ requestNo: 'LAO6907002', jobId: 'siamraj-sql:LAO6907002', requestNoDisplay: 'LAO6907002', unitName: 'ทาทา สตีล', departmentCode: 'LBA', requestDate: '2026-08-04', positionUnits: 5, kind: 'filled' }),
    ];
    const r = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed');
    expect(r.requestCount).toBe(2);
    expect(r.rows.map((x) => x.jobId)).toEqual([
      'siamraj-sql:LAO6907002',
      'siamraj-sql:OPL6907002',
    ]);
    expect(r.rows.find((x) => x.jobId === 'siamraj-sql:OPL6907002')?.unitName).toBe('ฮอนด้า');
  });

  it('แถวเก่าที่ไม่มี kind ใช้ isOpen ตัดสิน (เปิด = คงเหลือ · ปิด = หาได้)', () => {
    const records: ThroughputRecord[] = [
      { requestNo: 'C1', requestDate: '2026-08-05', closureDate: null, positionUnits: 3, isOpen: true },
      { requestNo: 'C2', requestDate: '2026-08-05', closureDate: '2026-08-09', positionUnits: 4, isOpen: false },
    ];
    expect(buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'remaining').positions).toBe(3);
    expect(buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed').positions).toBe(4);
  });

  it('เรียงใบเก่าสุดขึ้นก่อน · ไม่มี requestNoDisplay ให้ถอยไปใช้เลขดิบ', () => {
    const records: ThroughputRecord[] = [
      rec({ requestNo: 'Z9', jobId: null as unknown as string, requestNoDisplay: undefined, requestDate: '2026-08-20', positionUnits: 1, kind: 'filled' }),
      rec({ requestNo: 'A1', requestNoDisplay: undefined, requestDate: '2026-08-02', positionUnits: 1, kind: 'filled' }),
    ];
    const r = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed');
    expect(r.rows.map((x) => x.requestNoDisplay)).toEqual(['A1', 'Z9']);
  });

  it('ช่วงว่าง = ไม่มีแถว แต่ต้องไม่พัง', () => {
    const r = buildCohortDrillDown([], '2026-08-01', '2026-08-31', 'total_requests');
    expect(r.rows).toEqual([]);
    expect(r.positions).toBe(0);
    expect(r.requestCount).toBe(0);
  });
});

describe('ป้ายล่วงหน้า/ฉุกเฉินบน drill-down (เจ้าของสั่ง 18 ส.ค. 2569)', () => {
  it('ติดป้ายตามที่ API ส่งมา และพา requiredDate มาด้วย', () => {
    const records: ThroughputRecord[] = [
      rec({ requestNo: 'U1', requestDate: '2026-08-01', positionUnits: 1, kind: 'filled', leadKind: 'urgent', requiredDate: '2026-08-03' }),
      rec({ requestNo: 'A1', requestDate: '2026-08-02', positionUnits: 1, kind: 'filled', leadKind: 'advance', requiredDate: '2026-09-01' }),
      rec({ requestNo: 'R1', requestDate: '2026-08-03', positionUnits: 1, kind: 'filled', leadKind: 'retroactive', requiredDate: '2026-07-20' }),
    ];
    const r = buildCohortDrillDown(records, '2026-08-01', '2026-08-31', 'closed');
    expect(r.rows.map((x) => [x.requestNo, x.leadKind])).toEqual([
      ['U1', 'urgent'],
      ['A1', 'advance'],
      ['R1', 'retroactive'],
    ]);
    expect(r.rows[0].requiredDate).toBe('2026-08-03');
  });

  it('🔴 แถวเก่าที่ไม่มี leadKind ต้องไม่พัง และไม่เดาเป็นฉุกเฉิน', () => {
    const r = buildCohortDrillDown(
      [rec({ requestNo: 'OLD', requestDate: '2026-08-05', positionUnits: 2, kind: 'filled', leadKind: undefined, requiredDate: undefined })],
      '2026-08-01',
      '2026-08-31',
      'closed',
    );
    expect(r.rows[0].leadKind).toBe('advance');
    expect(r.rows[0].requiredDate).toBeNull();
  });
});
