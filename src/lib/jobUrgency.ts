import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest, JobUrgency } from '@/types';

export const URGENCY_LEAD_DAYS = 7;

export type JobUrgencyMeta = {
  urgency: JobUrgency;
  /** วันที่ส่ง → วันที่ต้องการ (lead time ตอนส่ง) */
  leadDays: number;
  /** วันที่ต้องการ − วันนี้ */
  daysUntilRequired: number;
  /** เริ่มเป็นล่วงหน้า แต่เหลือ < 7 วัน → ยกระดับเป็นฉุกเฉิน */
  escalated: boolean;
};

function parseJobDate(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = parseISO(value.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function submittedDate(job: JobRequest): Date | null {
  return parseJobDate(job.submittedAt) ?? parseJobDate(job.created_at) ?? parseJobDate(job.request_date);
}

export function getJobRequestSubmittedDate(job: JobRequest): Date | null {
  return submittedDate(job);
}

export function getJobRequestAgeDays(job: JobRequest, today = new Date()): number | null {
  const submitted = submittedDate(job);
  if (!submitted) return null;
  const todayStart = parseISO(today.toISOString().slice(0, 10));
  return differenceInCalendarDays(todayStart, submitted);
}

export function compareJobsByOldestRequestFirst(a: JobRequest, b: JobRequest): number {
  const da = submittedDate(a);
  const db = submittedDate(b);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return da.getTime() - db.getTime();
}

export function compareJobsByAgeDaysDesc(a: JobRequest, b: JobRequest, today = new Date()): number {
  const ageA = getJobRequestAgeDays(a, today) ?? -1;
  const ageB = getJobRequestAgeDays(b, today) ?? -1;
  if (ageA !== ageB) return ageB - ageA;
  return compareJobsByOldestRequestFirst(a, b);
}

export function computeJobUrgency(job: JobRequest, today = new Date()): JobUrgencyMeta {
  const submitted = submittedDate(job);
  const required = parseJobDate(job.required_date);
  const todayStart = parseISO(today.toISOString().slice(0, 10));

  const leadDays =
    submitted && required ? differenceInCalendarDays(required, submitted) : URGENCY_LEAD_DAYS;
  const daysUntilRequired = required ? differenceInCalendarDays(required, todayStart) : 0;

  const baseUrgency: JobUrgency = leadDays < URGENCY_LEAD_DAYS ? 'urgent' : 'advance';
  const escalated = baseUrgency === 'advance' && daysUntilRequired < URGENCY_LEAD_DAYS;
  const urgency: JobUrgency = escalated ? 'urgent' : baseUrgency;

  return { urgency, leadDays, daysUntilRequired, escalated };
}

export function withComputedUrgency(job: JobRequest, today = new Date()): JobRequest {
  const meta = computeJobUrgency(job, today);
  if (job.urgency === meta.urgency && !meta.escalated) return job;
  return { ...job, urgency: meta.urgency };
}

export function enrichJobsWithUrgency(jobs: JobRequest[], today = new Date()): JobRequest[] {
  return jobs.map((j) => withComputedUrgency(j, today));
}

export function urgencyDisplayLabel(meta: JobUrgencyMeta): string {
  if (meta.escalated) return 'งานด่วน';
  return meta.urgency === 'urgent' ? 'ฉุกเฉิน' : 'ล่วงหน้า';
}
