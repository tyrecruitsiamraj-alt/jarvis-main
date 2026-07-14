import { describe, it, expect } from 'vitest';
import { enrichActivityTrendWithThroughput, applyOpenQueueRemainingToActivityTrend, sumCohortStockByRequestDate, sumThroughputInRange } from '../../src/lib/dashboard/throughput';
import type { DashboardActivityTrendPoint } from '../../src/lib/dashboard/types';

describe('throughput', () => {
  it('enriches monthly trend by request-month cohort (filled/cancelled/remaining)', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-06-01', label: 'มิ.ย.', resignations: 0, replacements: 0, newOpenings: 0 },
      { date: '2026-07-01', label: 'ก.ค.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const enriched = enrichActivityTrendWithThroughput(points, [
      // มิ.ย. เข้า 60 · ปิดรวม 30 (บางส่วนปิดใน ก.ค.) · ยกเลิก 20 · คงเหลือ 10
      { requestDate: '2026-06-05', closureDate: '2026-06-20', positionUnits: 20, isOpen: false, kind: 'filled', requestActionName: 'ลาออก' },
      { requestDate: '2026-06-08', closureDate: '2026-07-05', positionUnits: 10, isOpen: false, kind: 'filled', requestActionName: 'เปลี่ยนตัว' },
      { requestDate: '2026-06-05', closureDate: '2026-06-20', positionUnits: 20, isOpen: false, kind: 'cancelled', requestActionName: 'เพิ่มอัตรา' },
      { requestDate: '2026-06-05', closureDate: null, positionUnits: 10, isOpen: true, kind: 'remaining', requestActionName: 'เปิดไซต์' },
      // ก.ค. เข้า 40 · ปิด 20 · ยกเลิก 0 · คงเหลือ 20 (ปิดของมิ.ย. ไม่ไปโผล่ใน ก.ค.)
      { requestDate: '2026-07-02', closureDate: '2026-07-10', positionUnits: 20, isOpen: false, kind: 'filled', requestActionName: 'ลาออก' },
      { requestDate: '2026-07-03', closureDate: null, positionUnits: 20, isOpen: true, kind: 'remaining', requestActionName: 'ลาออก' },
    ]);

    expect(enriched[0]?.requestedPositions).toBe(60);
    expect(enriched[0]?.filledPositions).toBe(30);
    expect(enriched[0]?.cancelledPositions).toBe(20);
    expect(enriched[0]?.remainingPositions).toBe(10);
    expect(enriched[0]?.resignations).toBe(20);
    expect(enriched[0]?.replacements).toBe(10);
    expect(enriched[0]?.increaseHeadcount).toBe(20);
    expect(enriched[0]?.newSite).toBe(10);
    expect(
      (enriched[0]?.resignations ?? 0) +
        (enriched[0]?.replacements ?? 0) +
        (enriched[0]?.increaseHeadcount ?? 0) +
        (enriched[0]?.newSite ?? 0) +
        (enriched[0]?.other ?? 0),
    ).toBe(enriched[0]?.requestedPositions);

    expect(enriched[1]?.requestedPositions).toBe(40);
    expect(enriched[1]?.filledPositions).toBe(20);
    expect(enriched[1]?.cancelledPositions).toBe(0);
    expect(enriched[1]?.remainingPositions).toBe(20);
    expect(enriched[1]?.resignations).toBe(40);
  });

  it('keeps intake fixed while remaining drops when more of the cohort is filled', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-06-01', label: 'มิ.ย.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const before = enrichActivityTrendWithThroughput(points, [
      { requestDate: '2026-06-01', closureDate: null, positionUnits: 60, isOpen: true, kind: 'remaining' },
    ]);
    expect(before[0]?.requestedPositions).toBe(60);
    expect(before[0]?.remainingPositions).toBe(60);

    const after = enrichActivityTrendWithThroughput(points, [
      { requestDate: '2026-06-01', closureDate: '2026-07-10', positionUnits: 40, isOpen: false, kind: 'filled' },
      { requestDate: '2026-06-01', closureDate: null, positionUnits: 20, isOpen: true, kind: 'remaining' },
    ]);
    expect(after[0]?.requestedPositions).toBe(60);
    expect(after[0]?.filledPositions).toBe(40);
    expect(after[0]?.remainingPositions).toBe(20);
  });

  it('overlays remaining from open staffing queue only', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-06-01', label: 'มิ.ย.', resignations: 0, replacements: 0, newOpenings: 0, remainingPositions: 300 },
      { date: '2026-07-01', label: 'ก.ค.', resignations: 0, replacements: 0, newOpenings: 0, remainingPositions: 0 },
    ];
    const overlay = applyOpenQueueRemainingToActivityTrend(points, [
      {
        id: 'a',
        job_type: 'thai_executive',
        job_category: 'private',
        status: 'open',
        urgency: 'advance',
        total_income: 0,
        location_address: 'Bangkok',
        penalty_per_day: 0,
        days_without_worker: 0,
        total_penalty: 0,
        request_date: '2026-06-10',
        required_date: '2026-06-10',
        created_at: '2026-06-10',
        unit_name: 'A',
        request_positions: 10,
        filled_positions: 4,
        cancelled_positions: 0,
        position_units: 6,
      },
      {
        id: 'b',
        job_type: 'thai_executive',
        job_category: 'private',
        status: 'open',
        urgency: 'advance',
        total_income: 0,
        location_address: 'Bangkok',
        penalty_per_day: 0,
        days_without_worker: 0,
        total_penalty: 0,
        request_date: '2026-07-02',
        required_date: '2026-07-02',
        created_at: '2026-07-02',
        unit_name: 'B',
        request_positions: 5,
        filled_positions: 0,
        cancelled_positions: 0,
        position_units: 5,
      },
    ] as never);
    expect(overlay[0]?.remainingPositions).toBe(6);
    expect(overlay[1]?.remainingPositions).toBe(5);
  });

  it('splits closed into same-period vs backlog by closure date', () => {
    const summary = sumThroughputInRange(
      [
        { requestDate: '2026-07-02', closureDate: '2026-07-10', positionUnits: 2, isOpen: false, kind: 'filled' },
        { requestDate: '2026-06-20', closureDate: '2026-07-05', positionUnits: 3, isOpen: false, kind: 'filled' },
        { requestDate: '2026-07-03', closureDate: null, positionUnits: 1, isOpen: true, kind: 'remaining' },
        { requestDate: '2026-07-04', closureDate: '2026-07-08', positionUnits: 1, isOpen: false, kind: 'cancelled' },
      ],
      '2026-07-01',
      '2026-07-31',
    );
    expect(summary.requested).toBe(4); // 2+1+1
    expect(summary.closed).toBe(5); // filled only (2+3), cancel excluded
    expect(summary.remaining).toBe(1);
    expect(summary.closedSamePeriod).toBe(2);
    expect(summary.closedBacklog).toBe(3);
  });

  it('sums cohort stock KPIs by request date including closed/cancelled', () => {
    const summary = sumCohortStockByRequestDate(
      [
        { requestNo: 'A', requestDate: '2026-01-10', closureDate: '2026-01-20', positionUnits: 2, isOpen: false, kind: 'filled' },
        { requestNo: 'B', requestDate: '2026-01-12', closureDate: '2026-02-01', positionUnits: 1, isOpen: false, kind: 'cancelled' },
        { requestNo: 'C', requestDate: '2026-01-15', closureDate: null, positionUnits: 3, isOpen: true, kind: 'remaining' },
        { requestNo: 'D', requestDate: '2026-02-01', closureDate: null, positionUnits: 9, isOpen: true, kind: 'remaining' },
      ],
      '2026-01-01',
      '2026-01-31',
    );
    expect(summary.requestPositions).toBe(6);
    expect(summary.filledPositions).toBe(2);
    expect(summary.cancelledPositions).toBe(1);
    expect(summary.remainingPositions).toBe(3);
    expect(summary.requestCount).toBe(3);
  });

  it('maps Thai/odd lifecycleKind labels into intake buckets so types sum to requested', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-01-01', label: 'ม.ค.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const enriched = enrichActivityTrendWithThroughput(points, [
      {
        requestDate: '2026-01-10',
        closureDate: null,
        positionUnits: 100,
        isOpen: true,
        kind: 'remaining',
        lifecycleKind: 'ลาออก' as never,
      },
      {
        requestDate: '2026-01-12',
        closureDate: '2026-01-20',
        positionUnits: 50,
        isOpen: false,
        kind: 'filled',
        requestActionName: 'เปลี่ยนตัว',
      },
      {
        requestDate: '2026-01-15',
        closureDate: null,
        positionUnits: 76,
        isOpen: true,
        kind: 'remaining',
        requestActionName: 'ประเภทแปลกๆ',
      },
    ]);
    expect(enriched[0]?.requestedPositions).toBe(226);
    expect(enriched[0]?.resignations).toBe(100);
    expect(enriched[0]?.replacements).toBe(50);
    expect(enriched[0]?.other).toBe(76);
    expect(
      (enriched[0]?.resignations ?? 0) +
        (enriched[0]?.replacements ?? 0) +
        (enriched[0]?.increaseHeadcount ?? 0) +
        (enriched[0]?.newSite ?? 0) +
        (enriched[0]?.other ?? 0),
    ).toBe(226);
  });
});
