import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest } from '@/types';
import { computeJobUrgency, URGENCY_LEAD_DAYS } from '@/lib/jobUrgency';

export type TrackingBucket = {
  key: string;
  label: string;
  jobs: JobRequest[];
  count: number;
};

function parseYmd(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = parseISO(value.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function todayStart(today = new Date()): Date {
  return parseISO(today.toISOString().slice(0, 10));
}

export function isOpenJob(job: JobRequest): boolean {
  return job.status !== 'closed' && job.status !== 'cancelled';
}

export function getJobAgeDays(job: JobRequest, today = new Date()): number {
  const d = parseYmd(job.request_date) ?? parseYmd(job.submittedAt) ?? parseYmd(job.created_at);
  return d ? differenceInCalendarDays(todayStart(today), d) : 0;
}

export function isOverdueJob(job: JobRequest, today = new Date()): boolean {
  if (!isOpenJob(job)) return false;
  const required = parseYmd(job.required_date);
  if (!required) return false;
  return differenceInCalendarDays(required, todayStart(today)) < 0;
}

export function isDueWithinDays(job: JobRequest, days: number, today = new Date()): boolean {
  if (!isOpenJob(job)) return false;
  const required = parseYmd(job.required_date);
  if (!required) return false;
  const left = differenceInCalendarDays(required, todayStart(today));
  return left >= 0 && left < days;
}

export function isEscalatedJob(job: JobRequest, today = new Date()): boolean {
  return computeJobUrgency(job, today).escalated;
}

export function isUrgentJob(job: JobRequest, today = new Date()): boolean {
  return computeJobUrgency(job, today).urgency === 'urgent';
}

export function isAdvanceJob(job: JobRequest, today = new Date()): boolean {
  const meta = computeJobUrgency(job, today);
  return meta.urgency === 'advance' && !meta.escalated;
}

export function isDueThisMonth(job: JobRequest, today = new Date()): boolean {
  if (!isOpenJob(job)) return false;
  const required = parseYmd(job.required_date);
  if (!required) return false;
  return required.getMonth() === today.getMonth() && required.getFullYear() === today.getFullYear();
}

export const SIAMRAJ_STATUS_LABELS: Record<string, string> = {
  OP: 'เปิด (OP)',
  PA: 'รออนุมัติ (PA)',
  RE: 'รอดำเนินการ (RE)',
  IP: 'กำลังดำเนินการ (IP)',
  A: 'อนุมัติแล้ว (A)',
  CL: 'ปิด (CL)',
};

export function siamrajStatusLabel(code: string): string {
  return SIAMRAJ_STATUS_LABELS[code.toUpperCase()] ?? code;
}

export function bucketsFromField(
  jobs: JobRequest[],
  field: (job: JobRequest) => string | null | undefined,
  labelFn?: (key: string) => string,
): TrackingBucket[] {
  const map = new Map<string, JobRequest[]>();
  for (const job of jobs) {
    const raw = field(job)?.trim();
    if (!raw) continue;
    const bucket = map.get(raw);
    if (bucket) bucket.push(job);
    else map.set(raw, [job]);
  }
  return [...map.entries()]
    .map(([key, list]) => ({
      key,
      label: labelFn ? labelFn(key) : key,
      jobs: list,
      count: list.length,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th'));
}

export function buildTrackingSnapshot(jobs: JobRequest[], today = new Date()) {
  const open = jobs.filter(isOpenJob);
  const closed = jobs.filter((j) => j.status === 'closed');
  const cancelled = jobs.filter((j) => j.status === 'cancelled');
  const urgent = jobs.filter((j) => isUrgentJob(j, today));
  const advance = jobs.filter((j) => isAdvanceJob(j, today));
  const escalated = jobs.filter((j) => isEscalatedJob(j, today));
  const overdue = open.filter((j) => isOverdueJob(j, today));
  const dueSoon = open.filter((j) => isDueWithinDays(j, URGENCY_LEAD_DAYS, today));
  const stale = open.filter((j) => getJobAgeDays(j, today) > 14);
  const thisMonth = open.filter((j) => isDueThisMonth(j, today));
  const needStaff = open.filter((j) => j.need_staff === true);

  return {
    total: jobs.length,
    open,
    closed,
    cancelled,
    urgent,
    advance,
    escalated,
    overdue,
    dueSoon,
    stale,
    thisMonth,
    needStaff,
    openUrgent: open.filter((j) => isUrgentJob(j, today)),
    openAdvance: open.filter((j) => isAdvanceJob(j, today)),
    byRequestAction: bucketsFromField(open, (j) => j.request_action_name),
    bySiamrajStatus: bucketsFromField(open, (j) => j.siamraj_status, siamrajStatusLabel),
    byJobRole: bucketsFromField(open, (j) => j.job_description_code_1),
  };
}
