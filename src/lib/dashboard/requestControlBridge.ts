import type {
  DashboardFlowView,
  DashboardFulfillmentBreakdown,
  DashboardRequestControlSummary,
  DashboardSlaSummary,
} from './types';
import type { RequestControlRecord, RequestControlStatus } from '@/lib/requestControl';
import type {
  RequestComputedState,
  RequestControlSummaryV3,
  RequestResolutionStatus,
  SlaTrackStatus,
} from './requestControlLedger';
import { RESOLUTION_STATUS_LABELS } from './requestControlLedger';
import type { DashboardSlaStatus } from './types';

const STATUS_MAP: Record<RequestResolutionStatus, RequestControlStatus> = {
  open: 'open',
  partial: 'partial',
  fully_fulfilled: 'fully_closed',
  cancelled_full: 'cancelled_full',
  partially_fulfilled_cancelled_remaining: 'partially_filled_cancelled_remaining',
  resolved_other: 'open',
};

const SLA_MAP: Record<SlaTrackStatus, DashboardSlaStatus> = {
  on_track: 'on_track',
  at_risk: 'at_risk',
  breached: 'breached',
  fulfilled_on_time: 'closed_on_time',
  fully_closed_on_time: 'closed_on_time',
  resolved_on_time: 'closed_on_time',
  closed_late: 'closed_late',
  resolved_late: 'closed_late',
};

export function mapSummaryV3ToDashboard(summary: RequestControlSummaryV3): DashboardRequestControlSummary {
  return {
    carriedOverPositions: summary.startingBacklogPositions,
    carriedOverRequests: summary.startingBacklogRequests,
    newRequestPositions: summary.newRequestPositions,
    newRequestRequests: summary.newRequestRequests,
    totalWorkloadPositions: summary.totalWorkloadPositions,
    totalWorkloadRequests: summary.totalWorkloadRequests,
    filledPositionsThisPeriod: summary.fulfilledPositionsThisPeriod,
    filledPositionsFromOldRequests: summary.fulfilledPositionsThisPeriodFromBacklog,
    filledPositionsFromCurrentMonthRequests: summary.fulfilledPositionsThisPeriodFromCurrent,
    fullyClosedPositionsThisPeriod: summary.fullyFulfilledPositionsThisPeriod,
    fullyClosedRequestsThisPeriod: summary.fullyFulfilledRequestsThisPeriod,
    partialRequests: summary.partialRequests,
    partialPositions: summary.partialPositions,
    cancelledPositionsThisPeriod: summary.cancelledPositionsThisPeriod,
    cancelledRequestsThisPeriod: summary.cancelledRequestsThisPeriod,
    remainingPositions: summary.endingBacklogPositions,
    remainingRequests: summary.endingBacklogRequests,
    endingBacklogPositions: summary.endingBacklogPositions,
    endingBacklogRequests: summary.endingBacklogRequests,
    startingBacklogPositions: summary.startingBacklogPositions,
    netBacklogChange: summary.netBacklogChange,
    resignationRequestPositions: 0,
    fillRatePercent: summary.fillRatePercent,
    fullCloseRatePercent: summary.fullClosureRatePercent,
    fullClosureRatePercent: summary.fullClosureRatePercent,
    backlogBurnRatePercent: summary.backlogBurnRatePercent,
    newDemandAbsorptionRatePercent: summary.newDemandAbsorptionRatePercent,
    resignationPressureRatio: 0,
    cancellationRatePercent: summary.cancellationRatePercent,
    fulfilledRequestsTouchedThisPeriod: summary.fulfilledRequestsTouchedThisPeriod,
    resolvedRequestsThisPeriod: summary.resolvedRequestsThisPeriod,
    resolvedPositionsThisPeriod: summary.resolvedPositionsThisPeriod,
    resolutionRatePercent: summary.resolutionRatePercent,
    dataQualityMode: summary.dataQualityMode,
    reconciliationDiff: summary.reconciliation.diff,
    reconciliationNote: summary.reconciliation.diffReason,
  };
}

export function mapFlowV3(summary: RequestControlSummaryV3): DashboardFlowView {
  return {
    startingBacklogPositions: summary.startingBacklogPositions,
    newRequestPositions: summary.newRequestPositions,
    totalWorkloadPositions: summary.totalWorkloadPositions,
    filledPositions: summary.fulfilledPositionsThisPeriod,
    cancelledPositions: summary.cancelledPositionsThisPeriod,
    endingBacklogPositions: summary.endingBacklogPositions,
    netBacklogChange: summary.netBacklogChange,
    reconciliationDiff: summary.reconciliation.diff,
    dataQualityMode: summary.dataQualityMode,
  };
}

export function mapFulfillmentBreakdownV3(summary: RequestControlSummaryV3): DashboardFulfillmentBreakdown {
  return {
    filledSamePeriod: summary.fulfilledPositionsThisPeriodFromCurrent,
    filledBacklog: summary.fulfilledPositionsThisPeriodFromBacklog,
    fullyClosedSamePeriod: summary.fullyFulfilledRequestsThisPeriod - summary.fullyFulfilledRequestsThisPeriodFromBacklog,
    fullyClosedBacklog: summary.fullyFulfilledRequestsThisPeriodFromBacklog,
  };
}

export function mapSlaSummaryFromStates(states: RequestComputedState[]): DashboardSlaSummary {
  const openish = states.filter((s) => !s.isFullyFulfilled && s.remainingPositions > 0);
  const onTrack = openish.filter((s) => s.fullClosureSlaStatus === 'on_track').length;
  const atRisk = openish.filter((s) => s.fullClosureSlaStatus === 'at_risk').length;
  const breached = openish.filter((s) => s.fullClosureSlaStatus === 'breached').length;
  const closedOnTime = states.filter((s) => s.fullClosureSlaStatus === 'fully_closed_on_time').length;
  const closedLate = states.filter(
    (s) => s.fullClosureSlaStatus === 'closed_late' || s.resolutionSlaStatus === 'resolved_late',
  ).length;
  return {
    onTrack,
    atRisk,
    breached,
    closedOnTime,
    closedLate,
    breachRatePercent: openish.length > 0 ? Math.round((breached / openish.length) * 1000) / 10 : 0,
  };
}

export function stateToRequestControlRecord(state: RequestComputedState): RequestControlRecord {
  const controlStatus = STATUS_MAP[state.status] ?? 'open';
  const job = state.job!;
  return {
    id: state.requestId,
    requestNo: state.requestNo,
    requestDate: state.submittedDate || state.effectiveRequestDate || '',
    requiredDate: state.requiredDate,
    effectiveRequestDate: state.effectiveRequestDate || '',
    closureDate: state.fullyFulfilledDate ?? state.resolvedDate,
    cancelDate: state.cancelledPositionsTotal > 0 ? state.resolvedDate : null,
    requestPositions: state.requestPositions,
    filledPositions: state.fulfilledPositionsTotal,
    cancelledPositions: state.cancelledPositionsTotal,
    remainingPositions: state.remainingPositions,
    isFullyClosed: state.isFullyFulfilled,
    isPartial: state.status === 'partial',
    isCancelled:
      state.status === 'cancelled_full' || state.status === 'partially_fulfilled_cancelled_remaining',
    controlStatus,
    requestKind: state.requestKind,
    lifecycleKind: state.lifecycleKind,
    requestActionName: state.requestActionName,
    ownerName: state.ownerName,
    screenerName: state.screenerName,
    oplName: state.oplName,
    unitName: state.unitName,
    destination: job.location_address,
    slaStartDate: state.slaStartDate ?? undefined,
    slaDueDate: state.slaDueDate ?? undefined,
    slaDays: state.slaDays ?? undefined,
    daysUsed: null,
    daysOverdue: state.daysOverdue,
    slaStatus: SLA_MAP[state.fullClosureSlaStatus],
    job,
  };
}

export function resolutionStatusLabel(status: RequestResolutionStatus): string {
  if (status === 'fully_fulfilled' || status === 'cancelled_full' || status === 'partially_fulfilled_cancelled_remaining') {
    return status === 'fully_fulfilled' ? 'ปิดครบใบขอ' : RESOLUTION_STATUS_LABELS[status];
  }
  if (stateIsResolved(status)) return 'จบงานแล้ว';
  return RESOLUTION_STATUS_LABELS[status];
}

function stateIsResolved(status: RequestResolutionStatus): boolean {
  return (
    status === 'fully_fulfilled' ||
    status === 'cancelled_full' ||
    status === 'partially_fulfilled_cancelled_remaining' ||
    status === 'resolved_other'
  );
}

export function statesToRequestControlRecords(states: RequestComputedState[]): RequestControlRecord[] {
  return states.filter((s) => s.job).map(stateToRequestControlRecord);
}
