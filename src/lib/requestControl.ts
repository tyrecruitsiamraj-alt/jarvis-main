import type { JobRequest } from '@/types';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { effectiveRequestDateYmd } from '@/lib/jobUrgency';
import { classifyLifecycleKind, type LifecycleKind } from '@/lib/dashboard/lifecycle';
import { computeJobSla, effectiveRequestKind, type SlaStatus } from '@/lib/jobSla';

export type RequestControlStatus =
  | 'fully_closed'
  | 'partial'
  | 'cancelled_full'
  | 'partially_filled_cancelled_remaining'
  | 'open';

export type PositionBreakdown = {
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
};

export type RequestControlRecord = {
  id: string;
  requestNo: string;
  requestDate: string;
  requiredDate: string | null;
  effectiveRequestDate: string;
  closureDate: string | null;
  cancelDate: string | null;
  requestPositions: number;
  filledPositions: number;
  cancelledPositions: number;
  remainingPositions: number;
  isFullyClosed: boolean;
  isPartial: boolean;
  isCancelled: boolean;
  controlStatus: RequestControlStatus;
  requestKind: ReturnType<typeof effectiveRequestKind>;
  lifecycleKind: LifecycleKind;
  requestActionName?: string;
  ownerName?: string;
  screenerName?: string;
  oplName?: string;
  unitName?: string;
  destination?: string;
  slaStartDate?: string;
  slaDueDate?: string;
  slaDays?: number;
  daysUsed?: number | null;
  daysOverdue?: number;
  slaStatus?: SlaStatus;
  job: JobRequest;
};

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

/** แยกตำแหน่งจากฟิลด์ staffing หรือ fallback จาก status/position_units */
export function positionBreakdownFromJob(job: JobRequest): PositionBreakdown {
  if (
    job.request_positions != null &&
    job.request_positions > 0 &&
    (job.filled_positions != null || job.cancelled_positions != null)
  ) {
    const requestPositions = Math.round(job.request_positions);
    const filledPositions = Math.min(Math.round(job.filled_positions ?? 0), requestPositions);
    const cancelledPositions = Math.min(
      Math.round(job.cancelled_positions ?? 0),
      Math.max(requestPositions - filledPositions, 0),
    );
    const remainingPositions = Math.max(requestPositions - filledPositions - cancelledPositions, 0);
    return { requestPositions, filledPositions, cancelledPositions, remainingPositions };
  }

  const units = jobPositionUnits(job);
  if (job.status === 'cancelled') {
    return {
      requestPositions: units,
      filledPositions: 0,
      cancelledPositions: units,
      remainingPositions: 0,
    };
  }
  if (job.status === 'closed') {
    return {
      requestPositions: units,
      filledPositions: units,
      cancelledPositions: 0,
      remainingPositions: 0,
    };
  }

  // TODO: ถ้าไม่มี request_qty/inform_qty จาก SQL ให้ถือว่า position_units = คงเหลือ
  return {
    requestPositions: units,
    filledPositions: 0,
    cancelledPositions: 0,
    remainingPositions: units,
  };
}

export function resolveRequestControlStatus(b: PositionBreakdown): RequestControlStatus {
  const { requestPositions, filledPositions, cancelledPositions, remainingPositions } = b;
  if (requestPositions > 0 && filledPositions >= requestPositions) return 'fully_closed';
  if (filledPositions === 0 && cancelledPositions >= requestPositions && requestPositions > 0) {
    return 'cancelled_full';
  }
  if (filledPositions > 0 && cancelledPositions > 0 && remainingPositions === 0) {
    return 'partially_filled_cancelled_remaining';
  }
  if (filledPositions > 0 && remainingPositions > 0) return 'partial';
  return 'open';
}

export const REQUEST_CONTROL_STATUS_LABELS: Record<RequestControlStatus, string> = {
  fully_closed: 'ปิดครบใบขอ',
  partial: 'Partial Closed / ยังไม่จบ',
  cancelled_full: 'ยกเลิกทั้งใบ',
  partially_filled_cancelled_remaining: 'ปิดบางส่วน + ยกเลิกส่วนที่เหลือ',
  open: 'รอดำเนินการ',
};

export function jobToRequestControlRecord(job: JobRequest, today = new Date()): RequestControlRecord {
  const breakdown = positionBreakdownFromJob(job);
  const controlStatus = resolveRequestControlStatus(breakdown);
  const effectiveRequestDate = effectiveRequestDateYmd(job, today) || job.request_date?.slice(0, 10) || '';
  const sla = computeJobSla(job, controlStatus, today);
  const requestKind = effectiveRequestKind(job, today);

  return {
    id: job.id,
    requestNo: job.request_no?.trim() || job.externalId || job.id,
    requestDate: safeYmd(job.request_date) || effectiveRequestDate,
    requiredDate: safeYmd(job.required_date),
    effectiveRequestDate,
    closureDate: safeYmd(job.closed_date),
    cancelDate: safeYmd(job.cancel_date),
    requestPositions: breakdown.requestPositions,
    filledPositions: breakdown.filledPositions,
    cancelledPositions: breakdown.cancelledPositions,
    remainingPositions: breakdown.remainingPositions,
    isFullyClosed: controlStatus === 'fully_closed',
    isPartial: controlStatus === 'partial',
    isCancelled: controlStatus === 'cancelled_full' || controlStatus === 'partially_filled_cancelled_remaining',
    controlStatus,
    requestKind,
    lifecycleKind: classifyLifecycleKind(job),
    requestActionName: job.request_action_name,
    ownerName: job.recruiter_name?.trim() || undefined,
    screenerName: job.screener_name?.trim() || undefined,
    oplName: job.opl_name?.trim() || undefined,
    unitName: job.unit_name,
    destination: job.location_address,
    slaStartDate: sla.slaStartDate ?? undefined,
    slaDueDate: sla.slaDueDate ?? undefined,
    slaDays: sla.slaDays,
    daysUsed: sla.daysUsed,
    daysOverdue: sla.daysOverdue,
    slaStatus: sla.slaStatus,
    job,
  };
}

export function jobsToRequestControlRecords(jobs: JobRequest[], today = new Date()): RequestControlRecord[] {
  const byKey = new Map<string, RequestControlRecord>();
  for (const job of jobs) {
    const key = job.request_no?.trim() || job.externalId || job.id;
    const rec = jobToRequestControlRecord(job, today);
    const prev = byKey.get(key);
    if (!prev || rec.filledPositions + rec.requestPositions > prev.filledPositions + prev.requestPositions) {
      byKey.set(key, rec);
    }
  }
  return [...byKey.values()];
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function mergeRequestControlJobs(openJobs: JobRequest[], extraJobs: JobRequest[] = []): JobRequest[] {
  const map = new Map<string, JobRequest>();
  const keyOf = (j: JobRequest) => j.request_no?.trim() || j.externalId || j.id;
  for (const j of [...openJobs, ...extraJobs]) {
    const key = keyOf(j);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, j);
      continue;
    }
    map.set(key, {
      ...prev,
      ...j,
      request_positions: j.request_positions ?? prev.request_positions,
      filled_positions: j.filled_positions ?? prev.filled_positions,
      cancelled_positions: j.cancelled_positions ?? prev.cancelled_positions,
      recruiter_name: j.recruiter_name ?? prev.recruiter_name,
      screener_name: j.screener_name ?? prev.screener_name,
      opl_name: j.opl_name ?? prev.opl_name,
    });
  }
  return [...map.values()];
}

export function filterRecordsByEffectiveDate(
  records: RequestControlRecord[],
  from: string,
  to: string,
): RequestControlRecord[] {
  return records.filter((r) => inYmdRange(r.effectiveRequestDate, from, to));
}

export function filterRecordsCarriedOver(
  records: RequestControlRecord[],
  periodFrom: string,
): RequestControlRecord[] {
  return records.filter(
    (r) => r.effectiveRequestDate < periodFrom && r.remainingPositions > 0,
  );
}

export function filterRecordsFilledInPeriod(
  records: RequestControlRecord[],
  from: string,
  to: string,
): RequestControlRecord[] {
  return records.filter((r) => {
    if (r.filledPositions <= 0) return false;
    const activity = r.closureDate || r.effectiveRequestDate;
    return activity ? inYmdRange(activity, from, to) : false;
  });
}

export function filterRecordsFullyClosedInPeriod(
  records: RequestControlRecord[],
  from: string,
  to: string,
): RequestControlRecord[] {
  return records.filter(
    (r) =>
      r.isFullyClosed &&
      r.closureDate != null &&
      inYmdRange(r.closureDate, from, to),
  );
}

export function filterRecordsCancelledInPeriod(
  records: RequestControlRecord[],
  from: string,
  to: string,
): RequestControlRecord[] {
  return records.filter((r) => {
    if (r.cancelledPositions <= 0) return false;
    const d = r.cancelDate || r.closureDate;
    return d ? inYmdRange(d, from, to) : false;
  });
}

export function sumPositions(records: RequestControlRecord[], pick: (r: RequestControlRecord) => number): number {
  return records.reduce((s, r) => s + pick(r), 0);
}

export function countRequests(records: RequestControlRecord[], pred: (r: RequestControlRecord) => boolean): number {
  return records.filter(pred).length;
}
