import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest } from '@/types';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { classifyLifecycleKind, type LifecycleKind } from '@/lib/dashboard/lifecycle';
import { computeJobUrgency } from '@/lib/jobUrgency';

export type RequestKind = 'retroactive' | 'urgent' | 'advance' | 'unknown';
export type LedgerEventType = 'informed' | 'cancelled';

export type RequestResolutionStatus =
  | 'open'
  | 'partial'
  | 'fully_fulfilled'
  | 'cancelled_full'
  | 'partially_fulfilled_cancelled_remaining'
  | 'resolved_other';

export type DataQualityMode = 'event_based' | 'snapshot_fallback' | 'mixed' | 'insufficient';

export type SlaTrackStatus =
  | 'on_track'
  | 'at_risk'
  | 'breached'
  | 'fulfilled_on_time'
  | 'fully_closed_on_time'
  | 'resolved_on_time'
  | 'closed_late'
  | 'resolved_late';

export type RequestLedgerRecord = {
  requestNo: string;
  requestId: string;
  source: 'jarvis' | 'siamraj' | 'mock';
  submittedDate: string | null;
  requiredDate: string | null;
  effectiveRequestDate: string | null;
  requestKind: RequestKind;
  lifecycleKind: LifecycleKind;
  requestActionName: string;
  requestActionCode?: string;
  requestPositions: number;
  unitName: string;
  siteCode?: string;
  departmentCode?: string;
  customerName?: string;
  ownerName?: string;
  recruiterName?: string;
  screenerName?: string;
  oplName?: string;
  rawStatus?: string;
  slaStartDate: string | null;
  slaDueDate: string | null;
  slaDays: number | null;
};

export type FulfillmentLedgerEvent = {
  requestNo: string;
  requestId?: string;
  eventDate: string | null;
  eventType: LedgerEventType;
  positionQty: number;
  sourceTable?: string;
  sourceId?: string;
  isDateReliable: boolean;
  reliabilityNote?: string;
};

export type RequestComputedState = RequestLedgerRecord & {
  fulfilledPositionsTotal: number;
  cancelledPositionsTotal: number;
  remainingPositions: number;
  fulfilledPositionsThisPeriod: number;
  cancelledPositionsThisPeriod: number;
  fulfilledPositionsThisPeriodFromBacklog: number;
  fulfilledPositionsThisPeriodFromCurrent: number;
  cancelledPositionsThisPeriodFromBacklog: number;
  cancelledPositionsThisPeriodFromCurrent: number;
  startingFulfilledPositions: number;
  startingCancelledPositions: number;
  startingRemainingPositions: number;
  endingFulfilledPositions: number;
  endingCancelledPositions: number;
  endingRemainingPositions: number;
  contributesToStartingBacklog: boolean;
  contributesToNewDemand: boolean;
  fullyFulfilledDate: string | null;
  resolvedDate: string | null;
  isFullyFulfilled: boolean;
  isResolved: boolean;
  status: RequestResolutionStatus;
  fullClosureSlaStatus: SlaTrackStatus;
  fulfillmentSlaStatus: SlaTrackStatus;
  resolutionSlaStatus: SlaTrackStatus;
  daysToSlaDue: number | null;
  daysOverdue: number;
  dataQuality: DataQualityMode;
  dataQualityNote?: string;
  job?: JobRequest;
};

export type BacklogReconciliation = {
  startingBacklogPositions: number;
  newRequestPositions: number;
  fulfilledPositionsThisPeriod: number;
  cancelledPositionsThisPeriod: number;
  endingBacklogPositions: number;
  calculatedEndingBacklogPositions: number;
  diff: number;
  diffReason?: string;
};

export type RequestControlSummaryV3 = {
  startingBacklogPositions: number;
  startingBacklogRequests: number;
  newRequestPositions: number;
  newRequestRequests: number;
  totalWorkloadPositions: number;
  totalWorkloadRequests: number;
  fulfilledPositionsThisPeriod: number;
  fulfilledRequestsTouchedThisPeriod: number;
  fulfilledPositionsThisPeriodFromBacklog: number;
  fulfilledPositionsThisPeriodFromCurrent: number;
  fullyFulfilledRequestsThisPeriod: number;
  fullyFulfilledPositionsThisPeriod: number;
  fullyFulfilledRequestsThisPeriodFromBacklog: number;
  resolvedRequestsThisPeriod: number;
  resolvedPositionsThisPeriod: number;
  cancelledPositionsThisPeriod: number;
  cancelledRequestsThisPeriod: number;
  cancelledPositionsThisPeriodFromBacklog: number;
  cancelledPositionsThisPeriodFromCurrent: number;
  endingBacklogPositions: number;
  endingBacklogRequests: number;
  partialRequests: number;
  partialPositions: number;
  fillRatePercent: number;
  fullClosureRatePercent: number;
  resolutionRatePercent: number;
  cancellationRatePercent: number;
  backlogBurnRatePercent: number;
  newDemandAbsorptionRatePercent: number;
  netBacklogChange: number;
  dataQualityMode: DataQualityMode;
  reconciliation: BacklogReconciliation;
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function pct(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 1000) / 10 : 0;
}

function addCalendarDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function slaDaysForKind(kind: RequestKind): number {
  return kind === 'retroactive' ? 7 : 15;
}

export function classifyRequestKind(
  submittedDate: string | null,
  requiredDate: string | null,
): RequestKind {
  if (!submittedDate || !requiredDate) return 'unknown';
  if (requiredDate < submittedDate) return 'retroactive';
  const lead = differenceInCalendarDays(parseISO(requiredDate), parseISO(submittedDate));
  if (lead < 7) return 'urgent';
  return 'advance';
}

export function resolveEffectiveRequestDate(
  requestKind: RequestKind,
  submittedDate: string | null,
  requiredDate: string | null,
): string | null {
  if (requestKind === 'retroactive') return submittedDate;
  if (requestKind === 'urgent' || requestKind === 'advance') return requiredDate ?? submittedDate;
  return requiredDate ?? submittedDate;
}

export function resolveSlaDates(
  requestKind: RequestKind,
  submittedDate: string | null,
  requiredDate: string | null,
): { slaStartDate: string | null; slaDueDate: string | null; slaDays: number | null } {
  const slaDays = slaDaysForKind(requestKind);
  const slaStartDate =
    requestKind === 'retroactive' ? submittedDate : requiredDate ?? submittedDate;
  const slaDueDate = slaStartDate ? addCalendarDays(slaStartDate, slaDays) : null;
  return { slaStartDate, slaDueDate, slaDays };
}

export function resolveResolutionStatus(
  requestPositions: number,
  fulfilledPositions: number,
  cancelledPositions: number,
): RequestResolutionStatus {
  const fulfilled = Math.min(Math.max(fulfilledPositions, 0), requestPositions);
  const cancelled = Math.min(Math.max(cancelledPositions, 0), Math.max(requestPositions - fulfilled, 0));
  const remainingPositions = Math.max(requestPositions - fulfilled - cancelled, 0);

  if (requestPositions > 0 && fulfilled >= requestPositions) return 'fully_fulfilled';
  if (fulfilled === 0 && cancelled >= requestPositions && requestPositions > 0) return 'cancelled_full';
  if (fulfilled > 0 && cancelled > 0 && remainingPositions === 0 && fulfilled < requestPositions) {
    return 'partially_fulfilled_cancelled_remaining';
  }
  if (fulfilled > 0 && remainingPositions > 0) return 'partial';
  if (fulfilled === 0 && cancelled === 0 && remainingPositions > 0) return 'open';
  if (remainingPositions === 0) return 'resolved_other';
  return 'open';
}

export const RESOLUTION_STATUS_LABELS: Record<RequestResolutionStatus, string> = {
  open: 'รอดำเนินการ',
  partial: 'หาได้บางส่วน',
  fully_fulfilled: 'ปิดครบใบขอ',
  cancelled_full: 'ยกเลิกทั้งใบ',
  partially_fulfilled_cancelled_remaining: 'หาได้บางส่วน + ยกเลิกส่วนที่เหลือ',
  resolved_other: 'จบงานแล้ว',
};

function requestPositionsFromJob(job: JobRequest): number {
  if (job.request_positions != null && job.request_positions > 0) {
    return Math.round(job.request_positions);
  }
  const units = jobPositionUnits(job);
  return units > 0 ? units : 1;
}

export function buildFulfillmentEventsFromJob(job: JobRequest): FulfillmentLedgerEvent[] {
  const requestNo = job.request_no?.trim() || job.externalId || job.id;
  const events: FulfillmentLedgerEvent[] = [];

  if (job.fulfillment_events?.length) {
    for (const ev of job.fulfillment_events) {
      events.push({
        requestNo,
        requestId: job.id,
        eventDate: safeYmd(ev.eventDate),
        eventType: ev.eventType,
        positionQty: Math.max(ev.positionQty, 0),
        sourceTable: ev.sourceTable,
        sourceId: ev.sourceId,
        isDateReliable: ev.isDateReliable ?? Boolean(safeYmd(ev.eventDate)),
        reliabilityNote: ev.reliabilityNote,
      });
    }
    return events;
  }

  const filled = Math.round(job.filled_positions ?? 0);
  const cancelled = Math.round(job.cancelled_positions ?? 0);
  const informDate = safeYmd(job.inform_date);
  const closedDate = safeYmd(job.closed_date);
  const cancelDate = safeYmd(job.cancel_date);

  if (filled > 0) {
    const eventDate = informDate ?? closedDate;
    events.push({
      requestNo,
      requestId: job.id,
      eventDate,
      eventType: 'informed',
      positionQty: filled,
      isDateReliable: Boolean(eventDate),
      reliabilityNote: eventDate ? undefined : 'ไม่มีวันที่แจ้งเข้า ใช้ inform_qty snapshot',
    });
  }

  if (cancelled > 0) {
    const eventDate = cancelDate ?? closedDate;
    events.push({
      requestNo,
      requestId: job.id,
      eventDate,
      eventType: 'cancelled',
      positionQty: cancelled,
      isDateReliable: Boolean(eventDate),
      reliabilityNote: eventDate ? undefined : 'ไม่มีวันที่ยกเลิก ใช้สถานะล่าสุด',
    });
  }

  if (job.status === 'cancelled' && cancelled === 0 && filled === 0) {
    events.push({
      requestNo,
      requestId: job.id,
      eventDate: cancelDate ?? closedDate,
      eventType: 'cancelled',
      positionQty: requestPositionsFromJob(job),
      isDateReliable: Boolean(cancelDate ?? closedDate),
      reliabilityNote: 'ยกเลิกทั้งใบจาก status',
    });
  }

  return events;
}

export function buildRequestLedgerFromJob(job: JobRequest, today = new Date()): RequestLedgerRecord {
  const submittedDate = safeYmd(job.submittedAt) || safeYmd(job.request_date) || safeYmd(job.created_at);
  const requiredDate = safeYmd(job.required_date);
  const urgency = computeJobUrgency(job, today);
  const requestKind: RequestKind =
    urgency.kind === 'retroactive' || urgency.kind === 'urgent' || urgency.kind === 'advance'
      ? urgency.kind
      : classifyRequestKind(submittedDate, requiredDate);
  const effectiveRequestDate = resolveEffectiveRequestDate(requestKind, submittedDate, requiredDate);
  const { slaStartDate, slaDueDate, slaDays } = resolveSlaDates(requestKind, submittedDate, requiredDate);

  return {
    requestNo: job.request_no?.trim() || job.externalId || job.id,
    requestId: job.id,
    source: job.source === 'siamraj' ? 'siamraj' : job.readOnly ? 'mock' : 'jarvis',
    submittedDate,
    requiredDate,
    effectiveRequestDate,
    requestKind,
    lifecycleKind: classifyLifecycleKind(job),
    requestActionName: job.request_action_name?.trim() || '',
    requestActionCode: job.request_action_code,
    requestPositions: requestPositionsFromJob(job),
    unitName: job.unit_name || '—',
    siteCode: job.site_code,
    departmentCode: job.department_code,
    customerName: job.unit_name,
    ownerName: job.recruiter_name?.trim() || undefined,
    recruiterName: job.recruiter_name?.trim() || undefined,
    screenerName: job.screener_name?.trim() || undefined,
    oplName: job.opl_name?.trim() || undefined,
    rawStatus: job.siamraj_status ?? job.status,
    slaStartDate,
    slaDueDate,
    slaDays,
  };
}

function sumEvents(
  events: FulfillmentLedgerEvent[],
  type: LedgerEventType,
  opts: { from?: string; to?: string; before?: string; reliableOnly?: boolean },
): number {
  return events
    .filter((e) => e.eventType === type)
    .filter((e) => {
      if (opts.reliableOnly && !e.isDateReliable) return false;
      if (!e.eventDate) return !opts.reliableOnly;
      if (opts.before && e.eventDate >= opts.before) return false;
      if (opts.from && e.eventDate < opts.from) return false;
      if (opts.to && e.eventDate > opts.to) return false;
      return true;
    })
    .reduce((s, e) => s + e.positionQty, 0);
}

function resolveCompletionDate(
  events: FulfillmentLedgerEvent[],
  threshold: number,
  types: LedgerEventType[],
): string | null {
  const dated = events
    .filter((e) => types.includes(e.eventType) && e.eventDate && e.isDateReliable)
    .sort((a, b) => a.eventDate!.localeCompare(b.eventDate!));
  let cumulative = 0;
  for (const e of dated) {
    cumulative += e.positionQty;
    if (cumulative >= threshold) return e.eventDate;
  }
  return null;
}

function computeSlaStatus(
  kind: 'fulfillment' | 'full_closure' | 'resolution',
  ledger: RequestLedgerRecord,
  status: RequestResolutionStatus,
  completionDate: string | null,
  todayYmd: string,
): SlaTrackStatus {
  const { slaDueDate } = ledger;
  if (!slaDueDate) return 'on_track';

  const isResolved =
    status === 'fully_fulfilled' ||
    status === 'cancelled_full' ||
    status === 'partially_fulfilled_cancelled_remaining' ||
    status === 'resolved_other';

  if (kind === 'full_closure' && status === 'fully_fulfilled' && completionDate) {
    return completionDate > slaDueDate ? 'closed_late' : 'fully_closed_on_time';
  }
  if (kind === 'resolution' && isResolved && completionDate) {
    return completionDate > slaDueDate ? 'resolved_late' : 'resolved_on_time';
  }
  if (kind === 'fulfillment' && completionDate && status !== 'open') {
    return completionDate > slaDueDate ? 'closed_late' : 'fulfilled_on_time';
  }

  const daysToDue = differenceInCalendarDays(parseISO(slaDueDate), parseISO(todayYmd));
  if (daysToDue < 0) return 'breached';
  if (daysToDue <= 3) return 'at_risk';
  return 'on_track';
}

export function computeRequestStateForPeriod(
  ledger: RequestLedgerRecord,
  events: FulfillmentLedgerEvent[],
  from: string,
  to: string,
  today = new Date(),
): RequestComputedState | null {
  const eff = ledger.effectiveRequestDate;
  if (!eff) return null;

  const todayYmd = today.toISOString().slice(0, 10);
  const hasReliableInformed = events.some((e) => e.eventType === 'informed' && e.isDateReliable && e.eventDate);
  const hasSnapshotOnly = events.length > 0 && !hasReliableInformed && events.some((e) => e.eventType === 'informed');

  let dataQuality: DataQualityMode = 'event_based';
  if (events.length === 0) dataQuality = 'insufficient';
  else if (hasSnapshotOnly) dataQuality = 'snapshot_fallback';
  else if (events.some((e) => !e.isDateReliable)) dataQuality = 'mixed';

  const fulfilledTotal = sumEvents(events, 'informed', {});
  const cancelledTotal = sumEvents(events, 'cancelled', {});

  const startingFulfilled = sumEvents(events, 'informed', { before: from, reliableOnly: true });
  const startingCancelled = sumEvents(events, 'cancelled', { before: from, reliableOnly: true });
  const endingFulfilled = sumEvents(events, 'informed', { to, reliableOnly: true });
  const endingCancelled = sumEvents(events, 'cancelled', { to, reliableOnly: true });

  let fulfilledThisPeriod = sumEvents(events, 'informed', { from, to, reliableOnly: true });
  let cancelledThisPeriod = sumEvents(events, 'cancelled', { from, to, reliableOnly: true });

  if (dataQuality === 'snapshot_fallback') {
    fulfilledThisPeriod = 0;
    cancelledThisPeriod = 0;
  }

  const fulfilled = Math.min(fulfilledTotal, ledger.requestPositions);
  const cancelled = Math.min(cancelledTotal, Math.max(ledger.requestPositions - fulfilled, 0));
  const remainingPositions = Math.max(ledger.requestPositions - fulfilled - cancelled, 0);

  const startingRemaining = Math.max(ledger.requestPositions - startingFulfilled - startingCancelled, 0);
  const endingRemaining = Math.max(ledger.requestPositions - endingFulfilled - endingCancelled, 0);

  const isBeforePeriod = eff < from;
  const isInPeriod = inYmdRange(eff, from, to);

  const status = resolveResolutionStatus(ledger.requestPositions, fulfilledTotal, cancelledTotal);
  const isFullyFulfilled = status === 'fully_fulfilled';
  const isResolved =
    status === 'fully_fulfilled' ||
    status === 'cancelled_full' ||
    status === 'partially_fulfilled_cancelled_remaining' ||
    status === 'resolved_other';

  const fullyFulfilledDate = isFullyFulfilled
    ? resolveCompletionDate(events, ledger.requestPositions, ['informed'])
    : null;
  const resolvedDate = isResolved
    ? resolveCompletionDate(events, ledger.requestPositions, ['informed', 'cancelled']) ??
      fullyFulfilledDate
    : null;

  const fulfillmentCompletion = resolveCompletionDate(
    events,
    Math.min(fulfilledTotal, ledger.requestPositions),
    ['informed'],
  );

  const daysToSlaDue = ledger.slaDueDate
    ? differenceInCalendarDays(parseISO(ledger.slaDueDate), parseISO(todayYmd))
    : null;

  return {
    ...ledger,
    fulfilledPositionsTotal: fulfilledTotal,
    cancelledPositionsTotal: cancelledTotal,
    remainingPositions,
    fulfilledPositionsThisPeriod: fulfilledThisPeriod,
    cancelledPositionsThisPeriod: cancelledThisPeriod,
    fulfilledPositionsThisPeriodFromBacklog: isBeforePeriod ? fulfilledThisPeriod : 0,
    fulfilledPositionsThisPeriodFromCurrent: isInPeriod ? fulfilledThisPeriod : 0,
    cancelledPositionsThisPeriodFromBacklog: isBeforePeriod ? cancelledThisPeriod : 0,
    cancelledPositionsThisPeriodFromCurrent: isInPeriod ? cancelledThisPeriod : 0,
    startingFulfilledPositions: startingFulfilled,
    startingCancelledPositions: startingCancelled,
    startingRemainingPositions: startingRemaining,
    endingFulfilledPositions: endingFulfilled,
    endingCancelledPositions: endingCancelled,
    endingRemainingPositions: eff <= to ? endingRemaining : 0,
    contributesToStartingBacklog: isBeforePeriod && startingRemaining > 0,
    contributesToNewDemand: isInPeriod,
    fullyFulfilledDate,
    resolvedDate,
    isFullyFulfilled,
    isResolved,
    status,
    fullClosureSlaStatus: computeSlaStatus('full_closure', ledger, status, fullyFulfilledDate, todayYmd),
    fulfillmentSlaStatus: computeSlaStatus('fulfillment', ledger, status, fulfillmentCompletion, todayYmd),
    resolutionSlaStatus: computeSlaStatus('resolution', ledger, status, resolvedDate, todayYmd),
    daysToSlaDue,
    daysOverdue: daysToSlaDue != null && daysToSlaDue < 0 ? -daysToSlaDue : 0,
    dataQuality,
    dataQualityNote:
      dataQuality === 'snapshot_fallback'
        ? 'ประมาณการจากสถานะล่าสุด — ไม่มีวันที่แจ้งเข้า'
        : undefined,
  };
}

export function buildRequestStates(
  jobs: JobRequest[],
  from: string,
  to: string,
  today = new Date(),
): RequestComputedState[] {
  const byKey = new Map<string, { ledger: RequestLedgerRecord; events: FulfillmentLedgerEvent[]; job: JobRequest }>();
  for (const job of jobs) {
    const key = job.request_no?.trim() || job.externalId || job.id;
    const ledger = buildRequestLedgerFromJob(job, today);
    const events = buildFulfillmentEventsFromJob(job);
    const prev = byKey.get(key);
    if (!prev || ledger.requestPositions >= prev.ledger.requestPositions) {
      byKey.set(key, { ledger, events, job });
    }
  }

  const states: RequestComputedState[] = [];
  for (const { ledger, events, job } of byKey.values()) {
    const state = computeRequestStateForPeriod(ledger, events, from, to, today);
    if (state) states.push({ ...state, job });
  }
  return states;
}

export function buildBacklogReconciliation(summary: RequestControlSummaryV3): BacklogReconciliation {
  const calculated =
    summary.startingBacklogPositions +
    summary.newRequestPositions -
    summary.fulfilledPositionsThisPeriod -
    summary.cancelledPositionsThisPeriod;
  const diff = summary.endingBacklogPositions - calculated;
  return {
    startingBacklogPositions: summary.startingBacklogPositions,
    newRequestPositions: summary.newRequestPositions,
    fulfilledPositionsThisPeriod: summary.fulfilledPositionsThisPeriod,
    cancelledPositionsThisPeriod: summary.cancelledPositionsThisPeriod,
    endingBacklogPositions: summary.endingBacklogPositions,
    calculatedEndingBacklogPositions: calculated,
    diff,
    diffReason:
      diff !== 0
        ? 'ข้อมูล event ไม่ครบหรือใช้ snapshot fallback ทำให้สมการงานค้างไม่ลงตัว'
        : undefined,
  };
}

export function computeRequestControlSummaryV3(
  states: RequestComputedState[],
  from: string,
  to: string,
): RequestControlSummaryV3 {
  const startingBacklogPositions = states
    .filter((s) => s.contributesToStartingBacklog)
    .reduce((sum, s) => sum + s.startingRemainingPositions, 0);
  const startingBacklogRequests = states.filter((s) => s.contributesToStartingBacklog).length;

  const newStates = states.filter((s) => s.contributesToNewDemand);
  const newRequestPositions = newStates.reduce((sum, s) => sum + s.requestPositions, 0);
  const newRequestRequests = newStates.length;

  const totalWorkloadPositions = startingBacklogPositions + newRequestPositions;
  const totalWorkloadRequests = startingBacklogRequests + newRequestRequests;

  const fulfilledPositionsThisPeriod = states.reduce((s, r) => s + r.fulfilledPositionsThisPeriod, 0);
  const fulfilledRequestsTouchedThisPeriod = states.filter((r) => r.fulfilledPositionsThisPeriod > 0).length;
  const fulfilledPositionsThisPeriodFromBacklog = states.reduce(
    (s, r) => s + r.fulfilledPositionsThisPeriodFromBacklog,
    0,
  );
  const fulfilledPositionsThisPeriodFromCurrent = states.reduce(
    (s, r) => s + r.fulfilledPositionsThisPeriodFromCurrent,
    0,
  );

  const cancelledPositionsThisPeriod = states.reduce((s, r) => s + r.cancelledPositionsThisPeriod, 0);
  const cancelledRequestsThisPeriod = states.filter((r) => r.cancelledPositionsThisPeriod > 0).length;
  const cancelledPositionsThisPeriodFromBacklog = states.reduce(
    (s, r) => s + r.cancelledPositionsThisPeriodFromBacklog,
    0,
  );
  const cancelledPositionsThisPeriodFromCurrent = states.reduce(
    (s, r) => s + r.cancelledPositionsThisPeriodFromCurrent,
    0,
  );

  const fullyFulfilledThisPeriod = states.filter(
    (s) => s.isFullyFulfilled && s.fullyFulfilledDate && inYmdRange(s.fullyFulfilledDate, from, to),
  );
  const fullyFulfilledRequestsThisPeriod = fullyFulfilledThisPeriod.length;
  const fullyFulfilledPositionsThisPeriod = fullyFulfilledThisPeriod.reduce(
    (s, r) => s + r.requestPositions,
    0,
  );
  const fullyFulfilledRequestsThisPeriodFromBacklog = fullyFulfilledThisPeriod.filter(
    (s) => s.effectiveRequestDate && s.effectiveRequestDate < from,
  ).length;

  const resolvedThisPeriod = states.filter(
    (s) => s.isResolved && s.resolvedDate && inYmdRange(s.resolvedDate, from, to),
  );
  const resolvedRequestsThisPeriod = resolvedThisPeriod.length;
  const resolvedPositionsThisPeriod = resolvedThisPeriod.reduce((s, r) => s + r.requestPositions, 0);

  const endingBacklogPositions = states
    .filter((s) => s.effectiveRequestDate && s.effectiveRequestDate <= to && s.endingRemainingPositions > 0)
    .reduce((sum, s) => sum + s.endingRemainingPositions, 0);
  const endingBacklogRequests = states.filter(
    (s) => s.effectiveRequestDate && s.effectiveRequestDate <= to && s.endingRemainingPositions > 0,
  ).length;

  const partialStates = states.filter((s) => s.status === 'partial');
  const partialRequests = partialStates.length;
  const partialPositions = partialStates.reduce((s, r) => s + r.remainingPositions, 0);

  const netBacklogChange = endingBacklogPositions - startingBacklogPositions;

  const qualityCounts = states.reduce(
    (acc, s) => {
      acc[s.dataQuality] = (acc[s.dataQuality] ?? 0) + 1;
      return acc;
    },
    {} as Record<DataQualityMode, number>,
  );
  let dataQualityMode: DataQualityMode = 'event_based';
  if (states.length === 0 || (qualityCounts.insufficient ?? 0) === states.length) {
    dataQualityMode = 'insufficient';
  } else if ((qualityCounts.snapshot_fallback ?? 0) > 0 && !(qualityCounts.event_based ?? 0)) {
    dataQualityMode = 'snapshot_fallback';
  } else if ((qualityCounts.snapshot_fallback ?? 0) > 0 || (qualityCounts.mixed ?? 0) > 0) {
    dataQualityMode = 'mixed';
  }

  const summary: RequestControlSummaryV3 = {
    startingBacklogPositions,
    startingBacklogRequests,
    newRequestPositions,
    newRequestRequests,
    totalWorkloadPositions,
    totalWorkloadRequests,
    fulfilledPositionsThisPeriod,
    fulfilledRequestsTouchedThisPeriod,
    fulfilledPositionsThisPeriodFromBacklog,
    fulfilledPositionsThisPeriodFromCurrent,
    fullyFulfilledRequestsThisPeriod,
    fullyFulfilledPositionsThisPeriod,
    fullyFulfilledRequestsThisPeriodFromBacklog,
    resolvedRequestsThisPeriod,
    resolvedPositionsThisPeriod,
    cancelledPositionsThisPeriod,
    cancelledRequestsThisPeriod,
    cancelledPositionsThisPeriodFromBacklog,
    cancelledPositionsThisPeriodFromCurrent,
    endingBacklogPositions,
    endingBacklogRequests,
    partialRequests,
    partialPositions,
    fillRatePercent: pct(fulfilledPositionsThisPeriod, totalWorkloadPositions),
    fullClosureRatePercent: pct(fullyFulfilledRequestsThisPeriod, totalWorkloadRequests),
    resolutionRatePercent: pct(resolvedRequestsThisPeriod, totalWorkloadRequests),
    cancellationRatePercent: pct(cancelledPositionsThisPeriod, totalWorkloadPositions),
    backlogBurnRatePercent: pct(fulfilledPositionsThisPeriodFromBacklog, startingBacklogPositions),
    newDemandAbsorptionRatePercent: pct(fulfilledPositionsThisPeriodFromCurrent, newRequestPositions),
    netBacklogChange,
    dataQualityMode,
    reconciliation: {
      startingBacklogPositions: 0,
      newRequestPositions: 0,
      fulfilledPositionsThisPeriod: 0,
      cancelledPositionsThisPeriod: 0,
      endingBacklogPositions: 0,
      calculatedEndingBacklogPositions: 0,
      diff: 0,
    },
  };
  summary.reconciliation = buildBacklogReconciliation(summary);
  return summary;
}

export function makeInformedEvents(
  requestNo: string,
  datedQty: Array<{ date: string; qty: number }>,
): FulfillmentLedgerEvent[] {
  return datedQty.map((d, i) => ({
    requestNo,
    eventDate: d.date,
    eventType: 'informed' as const,
    positionQty: d.qty,
    isDateReliable: true,
    sourceId: String(i),
  }));
}

export function makeCancelledEvent(
  requestNo: string,
  date: string,
  qty: number,
): FulfillmentLedgerEvent {
  return {
    requestNo,
    eventDate: date,
    eventType: 'cancelled',
    positionQty: qty,
    isDateReliable: true,
  };
}

export function makeTestLedger(partial: Partial<RequestLedgerRecord> & { requestNo: string }): RequestLedgerRecord {
  const submitted = partial.submittedDate ?? '2026-07-01';
  const required = partial.requiredDate ?? '2026-07-20';
  const requestKind = partial.requestKind ?? classifyRequestKind(submitted, required);
  const effectiveRequestDate =
    partial.effectiveRequestDate ?? resolveEffectiveRequestDate(requestKind, submitted, required);
  const sla = resolveSlaDates(requestKind, submitted, required);
  return {
    requestId: partial.requestId ?? partial.requestNo,
    source: 'mock',
    lifecycleKind: 'other',
    requestActionName: '',
    requestPositions: 1,
    unitName: 'Test Unit',
    ...partial,
    requestKind,
    effectiveRequestDate,
    slaStartDate: partial.slaStartDate ?? sla.slaStartDate,
    slaDueDate: partial.slaDueDate ?? sla.slaDueDate,
    slaDays: partial.slaDays ?? sla.slaDays,
  };
}
