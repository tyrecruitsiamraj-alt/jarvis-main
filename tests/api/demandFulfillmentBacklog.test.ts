import { describe, it, expect } from 'vitest';
import {
  buildExecutiveInsights,
  buildFlowView,
  buildRequestControlSummary,
} from '../../src/lib/dashboard/buildRequestControlSummaries';
import { buildPriorityWorkQueue, computePriorityTier } from '../../src/lib/dashboard/priorityWorkQueue';
import type { DashboardWorkItem } from '../../src/lib/dashboard/types';
import type { RequestControlRecord } from '../../src/lib/requestControl';

function record(partial: Partial<RequestControlRecord> & { id: string }): RequestControlRecord {
  return {
    requestNo: partial.requestNo ?? partial.id,
    requestDate: '2026-07-01',
    requiredDate: '2026-07-10',
    effectiveRequestDate: '2026-07-01',
    closureDate: null,
    cancelDate: null,
    requestPositions: 1,
    filledPositions: 0,
    cancelledPositions: 0,
    remainingPositions: 1,
    isFullyClosed: false,
    isPartial: false,
    isCancelled: false,
    controlStatus: 'open',
    requestKind: 'advance',
    lifecycleKind: 'replacement',
    unitName: 'Unit A',
    ownerName: 'Owner A',
    job: {} as RequestControlRecord['job'],
    ...partial,
  };
}

function workItem(partial: Partial<DashboardWorkItem> & { id: string }): DashboardWorkItem {
  return {
    requestNo: partial.id,
    unitName: 'Unit A',
    destination: 'BKK',
    ownerName: 'Owner',
    screenerName: '—',
    status: 'pending',
    slaStatus: 'on_track',
    priority: 5,
    requestDate: '2026-07-01',
    requiredDate: '2026-07-10',
    updatedAt: '2026-07-01',
    nextAction: 'ดู',
    requestAction: '',
    sendReplacement: null,
    resignedName: '',
    isResignation: false,
    requestPositions: 1,
    filledPositions: 0,
    cancelledPositions: 0,
    remainingPositions: 1,
    effectiveRequestDate: '2026-07-01',
    slaDueDate: '2026-07-20',
    daysOverdue: 0,
    lifecycleKind: 'เปลี่ยนตัว',
    requestKind: 'ล่วงหน้า',
    controlStatus: 'รอดำเนินการ',
    ...partial,
  };
}

describe('demandFulfillmentBacklog', () => {
  it('computes flow view and extended rates', () => {
    const records = [
      record({ id: 'old', effectiveRequestDate: '2026-06-01', remainingPositions: 10, requestPositions: 10 }),
      record({ id: 'new', effectiveRequestDate: '2026-07-05', requestPositions: 20, remainingPositions: 20 }),
      record({
        id: 'filled-old',
        effectiveRequestDate: '2026-06-01',
        filledPositions: 5,
        remainingPositions: 0,
        closureDate: '2026-07-08',
        isFullyClosed: true,
        controlStatus: 'fully_closed',
      }),
      record({
        id: 'filled-new',
        effectiveRequestDate: '2026-07-03',
        filledPositions: 8,
        remainingPositions: 0,
        closureDate: '2026-07-09',
      }),
      record({
        id: 'resign',
        effectiveRequestDate: '2026-07-02',
        lifecycleKind: 'resignation',
        requestPositions: 6,
        remainingPositions: 6,
      }),
    ];
    const summary = buildRequestControlSummary(records, '2026-07-01', '2026-07-31');
    const flow = buildFlowView(summary);

    expect(flow.startingBacklogPositions + flow.newRequestPositions).toBe(flow.totalWorkloadPositions);
    expect(flow.endingBacklogPositions).toBe(
      flow.totalWorkloadPositions - flow.filledPositions - flow.cancelledPositions,
    );
    expect(summary.fillRatePercent).toBeGreaterThan(0);
    expect(summary.fullClosureRatePercent).toBe(summary.fullCloseRatePercent);
    expect(summary.resignationPressureRatio).toBeGreaterThan(0);
  });

  it('generates executive insight sentences', () => {
    const summary = buildRequestControlSummary(
      [
        record({ id: '1', effectiveRequestDate: '2026-06-01', remainingPositions: 5, requestPositions: 5 }),
        record({ id: '2', effectiveRequestDate: '2026-07-02', requestPositions: 10, remainingPositions: 10, lifecycleKind: 'resignation' }),
      ],
      '2026-07-01',
      '2026-07-31',
    );
    const insights = buildExecutiveInsights(summary, [
      record({ id: 'b1', unitName: 'Site X', slaStatus: 'breached', remainingPositions: 2 }),
      record({ id: 'b2', unitName: 'Site X', slaStatus: 'breached', remainingPositions: 1 }),
    ]);
    expect(insights.sentences.length).toBeGreaterThan(0);
    expect(insights.sentences.some((s) => s.includes('Site X'))).toBe(true);
  });

  it('prioritizes breached SLA before at-risk and backlog', () => {
    const items = [
      workItem({ id: 'backlog', effectiveRequestDate: '2026-05-01', remainingPositions: 10, slaStatus: 'on_track' }),
      workItem({ id: 'risk', slaStatus: 'at_risk', remainingPositions: 2 }),
      workItem({ id: 'breach', slaStatus: 'breached', remainingPositions: 1 }),
    ];
    const ordered = buildPriorityWorkQueue(items, [], '2026-07-01');
    expect(ordered[0]?.id).toBe('breach');
    expect(ordered[1]?.id).toBe('risk');
    expect(computePriorityTier(items[0]!, '2026-07-01', new Set())).toBeGreaterThan(
      computePriorityTier(items[2]!, '2026-07-01', new Set()),
    );
  });
});
