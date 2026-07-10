import { describe, it, expect } from 'vitest';
import { enrichActivityTrendWithThroughput, sumThroughputInRange } from '../../src/lib/dashboard/throughput';
import type { DashboardActivityTrendPoint } from '../../src/lib/dashboard/types';

describe('throughput', () => {
  it('enriches monthly trend with requested and closed positions', () => {
    const points: DashboardActivityTrendPoint[] = [
      { date: '2026-07-01', label: 'ก.ค.', resignations: 0, replacements: 0, newOpenings: 0 },
    ];
    const enriched = enrichActivityTrendWithThroughput(points, [
      { requestDate: '2026-07-02', closureDate: null, positionUnits: 2, isOpen: true },
      { requestDate: '2026-07-03', closureDate: '2026-07-10', positionUnits: 1, isOpen: false },
      { requestDate: '2026-06-20', closureDate: '2026-07-05', positionUnits: 3, isOpen: false },
    ]);
    expect(enriched[0]?.requestedPositions).toBe(3);
    expect(enriched[0]?.closedPositions).toBe(4);
    expect(enriched[0]?.remainingPositions).toBe(-1);
    expect(enriched[0]?.closeRatePercent).toBe(133.3);
  });

  it('splits closed into same-period vs backlog', () => {
    const summary = sumThroughputInRange(
      [
        { requestDate: '2026-07-02', closureDate: '2026-07-10', positionUnits: 2, isOpen: false },
        { requestDate: '2026-06-20', closureDate: '2026-07-05', positionUnits: 3, isOpen: false },
        { requestDate: '2026-07-03', closureDate: null, positionUnits: 1, isOpen: true },
      ],
      '2026-07-01',
      '2026-07-31',
    );
    expect(summary.requested).toBe(3);
    expect(summary.closed).toBe(5);
    expect(summary.remaining).toBe(1);
    expect(summary.closedSamePeriod).toBe(2);
    expect(summary.closedBacklog).toBe(3);
  });
});
