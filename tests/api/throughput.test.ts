import { describe, it, expect } from 'vitest';
import { enrichActivityTrendWithThroughput, sumThroughputInRange } from '../../src/lib/dashboard/throughput';
import type { DashboardActivityTrendPoint } from '../../src/lib/dashboard/types';

describe('throughput', () => {
  it('enriches monthly trend by request-month cohort (filled/cancelled/remaining)', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-06-01', label: 'มิ.ย.', resignations: 0, replacements: 0, newOpenings: 0 },
      { date: '2026-07-01', label: 'ก.ค.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const enriched = enrichActivityTrendWithThroughput(points, [
      // มิ.ย. เข้า 60 · ปิดรวม 30 (บางส่วนปิดใน ก.ค.) · ยกเลิก 20 · คงเหลือ 10
      { requestDate: '2026-06-05', closureDate: '2026-06-20', positionUnits: 20, isOpen: false, kind: 'filled' },
      { requestDate: '2026-06-08', closureDate: '2026-07-05', positionUnits: 10, isOpen: false, kind: 'filled' },
      { requestDate: '2026-06-05', closureDate: '2026-06-20', positionUnits: 20, isOpen: false, kind: 'cancelled' },
      { requestDate: '2026-06-05', closureDate: null, positionUnits: 10, isOpen: true, kind: 'remaining' },
      // ก.ค. เข้า 40 · ปิด 20 · ยกเลิก 0 · คงเหลือ 20 (ปิดของมิ.ย. ไม่ไปโผล่ใน ก.ค.)
      { requestDate: '2026-07-02', closureDate: '2026-07-10', positionUnits: 20, isOpen: false, kind: 'filled' },
      { requestDate: '2026-07-03', closureDate: null, positionUnits: 20, isOpen: true, kind: 'remaining' },
    ]);

    expect(enriched[0]?.requestedPositions).toBe(60);
    expect(enriched[0]?.filledPositions).toBe(30);
    expect(enriched[0]?.cancelledPositions).toBe(20);
    expect(enriched[0]?.remainingPositions).toBe(10);

    expect(enriched[1]?.requestedPositions).toBe(40);
    expect(enriched[1]?.filledPositions).toBe(20);
    expect(enriched[1]?.cancelledPositions).toBe(0);
    expect(enriched[1]?.remainingPositions).toBe(20);
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
});
