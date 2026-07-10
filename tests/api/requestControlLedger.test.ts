import { describe, it, expect } from 'vitest';
import type { JobRequest } from '@/types';
import { classifyLifecycleKind } from '../../src/lib/dashboard/lifecycle';
import {
  buildFulfillmentEventsFromJob,
  classifyRequestKind,
  computeRequestControlSummaryV3,
  computeRequestStateForPeriod,
  makeCancelledEvent,
  makeInformedEvents,
  makeTestLedger,
  resolveEffectiveRequestDate,
  resolveResolutionStatus,
  resolveSlaDates,
} from '../../src/lib/dashboard/requestControlLedger';

const JULY = { from: '2026-07-01', to: '2026-07-31' };

function job(partial: Partial<JobRequest> & { unit_name: string }): JobRequest {
  return {
    id: partial.id ?? 'j1',
    job_type: 'thai_executive',
    job_category: 'private',
    status: 'open',
    urgency: 'advance',
    total_income: 0,
    location_address: 'BKK',
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
    request_date: '2026-07-01',
    required_date: '2026-07-20',
    created_at: '2026-07-01',
    ...partial,
  };
}

function stateFor(
  ledger: ReturnType<typeof makeTestLedger>,
  events: ReturnType<typeof makeInformedEvents>,
  extraCancel: ReturnType<typeof makeCancelledEvent>[] = [],
) {
  return computeRequestStateForPeriod(ledger, [...events, ...extraCancel], JULY.from, JULY.to)!;
}

describe('requestControlLedger acceptance', () => {
  it('Case 1: partial fill in period', () => {
    const ledger = makeTestLedger({
      requestNo: 'A',
      effectiveRequestDate: '2026-07-01',
      requestPositions: 5,
    });
    const state = stateFor(ledger, makeInformedEvents('A', [{ date: '2026-07-10', qty: 3 }]));
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.newRequestPositions).toBe(5);
    expect(summary.fulfilledPositionsThisPeriod).toBe(3);
    expect(summary.fullyFulfilledRequestsThisPeriod).toBe(0);
    expect(summary.resolvedRequestsThisPeriod).toBe(0);
    expect(state.endingRemainingPositions).toBe(2);
    expect(state.status).toBe('partial');
  });

  it('Case 2: fully fulfilled in period', () => {
    const ledger = makeTestLedger({
      requestNo: 'B',
      effectiveRequestDate: '2026-07-01',
      requestPositions: 5,
    });
    const state = stateFor(ledger, makeInformedEvents('B', [{ date: '2026-07-12', qty: 5 }]));
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.fulfilledPositionsThisPeriod).toBe(5);
    expect(summary.fullyFulfilledRequestsThisPeriod).toBe(1);
    expect(summary.resolvedRequestsThisPeriod).toBe(1);
    expect(state.endingRemainingPositions).toBe(0);
    expect(state.status).toBe('fully_fulfilled');
  });

  it('Case 3: partial fill then cancel remaining', () => {
    const ledger = makeTestLedger({
      requestNo: 'C',
      effectiveRequestDate: '2026-07-01',
      requestPositions: 5,
    });
    const state = stateFor(
      ledger,
      makeInformedEvents('C', [{ date: '2026-07-08', qty: 2 }]),
      [makeCancelledEvent('C', '2026-07-15', 3)],
    );
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.fulfilledPositionsThisPeriod).toBe(2);
    expect(summary.cancelledPositionsThisPeriod).toBe(3);
    expect(summary.fullyFulfilledRequestsThisPeriod).toBe(0);
    expect(summary.resolvedRequestsThisPeriod).toBe(1);
    expect(state.endingRemainingPositions).toBe(0);
    expect(state.status).toBe('partially_fulfilled_cancelled_remaining');
  });

  it('Case 4: backlog partial fulfillment', () => {
    const ledger = makeTestLedger({
      requestNo: 'D',
      effectiveRequestDate: '2026-06-10',
      submittedDate: '2026-06-10',
      requestPositions: 5,
    });
    const state = stateFor(
      ledger,
      makeInformedEvents('D', [
        { date: '2026-06-20', qty: 2 },
        { date: '2026-07-05', qty: 2 },
      ]),
    );
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.startingBacklogPositions).toBe(3);
    expect(summary.fulfilledPositionsThisPeriodFromBacklog).toBe(2);
    expect(state.endingRemainingPositions).toBe(1);
    expect(state.isFullyFulfilled).toBe(false);
    expect(state.isResolved).toBe(false);
    expect(state.status).toBe('partial');
  });

  it('Case 5: backlog fully fulfilled in period', () => {
    const ledger = makeTestLedger({
      requestNo: 'E',
      effectiveRequestDate: '2026-06-10',
      requestPositions: 5,
    });
    const state = stateFor(ledger, makeInformedEvents('E', [{ date: '2026-07-08', qty: 5 }]));
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.startingBacklogPositions).toBe(5);
    expect(summary.fulfilledPositionsThisPeriodFromBacklog).toBe(5);
    expect(summary.fullyFulfilledRequestsThisPeriodFromBacklog).toBe(1);
    expect(summary.resolvedRequestsThisPeriod).toBe(1);
    expect(state.endingRemainingPositions).toBe(0);
  });

  it('Case 6: backlog full cancel in period', () => {
    const ledger = makeTestLedger({
      requestNo: 'F',
      effectiveRequestDate: '2026-06-10',
      requestPositions: 5,
    });
    const state = stateFor(ledger, [], [makeCancelledEvent('F', '2026-07-03', 5)]);
    const summary = computeRequestControlSummaryV3([state], JULY.from, JULY.to);

    expect(summary.startingBacklogPositions).toBe(5);
    expect(summary.cancelledPositionsThisPeriodFromBacklog).toBe(5);
    expect(summary.fullyFulfilledRequestsThisPeriod).toBe(0);
    expect(summary.resolvedRequestsThisPeriod).toBe(1);
    expect(state.status).toBe('cancelled_full');
  });

  it('Case 7: retroactive request kind and SLA', () => {
    const kind = classifyRequestKind('2026-07-10', '2026-07-01');
    expect(kind).toBe('retroactive');
    expect(resolveEffectiveRequestDate(kind, '2026-07-10', '2026-07-01')).toBe('2026-07-10');
    const sla = resolveSlaDates(kind, '2026-07-10', '2026-07-01');
    expect(sla.slaStartDate).toBe('2026-07-10');
    expect(sla.slaDueDate).toBe('2026-07-17');
  });

  it('Case 8: urgent request kind and SLA', () => {
    const kind = classifyRequestKind('2026-07-01', '2026-07-05');
    expect(kind).toBe('urgent');
    expect(resolveEffectiveRequestDate(kind, '2026-07-01', '2026-07-05')).toBe('2026-07-05');
    const sla = resolveSlaDates(kind, '2026-07-01', '2026-07-05');
    expect(sla.slaStartDate).toBe('2026-07-05');
    expect(sla.slaDueDate).toBe('2026-07-20');
  });

  it('Case 9: advance request kind and SLA', () => {
    const kind = classifyRequestKind('2026-07-01', '2026-07-20');
    expect(kind).toBe('advance');
    expect(resolveEffectiveRequestDate(kind, '2026-07-01', '2026-07-20')).toBe('2026-07-20');
    const sla = resolveSlaDates(kind, '2026-07-01', '2026-07-20');
    expect(sla.slaStartDate).toBe('2026-07-20');
    expect(sla.slaDueDate).toBe('2026-08-04');
  });

  it('Case 10-13: lifecycle mapping', () => {
    expect(classifyLifecycleKind(job({ unit_name: 'U', request_action_name: 'เพิ่มอัตรา' }))).toBe(
      'increase_headcount',
    );
    expect(classifyLifecycleKind(job({ unit_name: 'U', request_action_name: 'เปิดไซต์' }))).toBe('new_site');
    expect(classifyLifecycleKind(job({ unit_name: 'U', request_action_name: 'เปลี่ยนตัว' }))).toBe('replacement');
    expect(classifyLifecycleKind(job({ unit_name: 'U', request_action_name: 'ลาออก' }))).toBe('resignation');
  });

  it('Case 14: snapshot fallback without event date', () => {
    const j = job({
      unit_name: 'U',
      request_positions: 5,
      filled_positions: 3,
    });
    const events = buildFulfillmentEventsFromJob(j);
    expect(events[0]?.positionQty).toBe(3);
    expect(events[0]?.isDateReliable).toBe(false);
    const ledger = makeTestLedger({ requestNo: 'snap', effectiveRequestDate: '2026-07-01', requestPositions: 5 });
    const state = computeRequestStateForPeriod(ledger, events, JULY.from, JULY.to)!;
    expect(state.fulfilledPositionsTotal).toBe(3);
    expect(state.dataQuality).toBe('snapshot_fallback');
    expect(state.fulfilledPositionsThisPeriod).toBe(0);
  });

  it('resolution status rules', () => {
    expect(resolveResolutionStatus(5, 3, 0)).toBe('partial');
    expect(resolveResolutionStatus(5, 5, 0)).toBe('fully_fulfilled');
    expect(resolveResolutionStatus(5, 2, 3)).toBe('partially_fulfilled_cancelled_remaining');
    expect(resolveResolutionStatus(5, 0, 5)).toBe('cancelled_full');
  });
});
