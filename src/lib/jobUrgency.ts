import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest, JobUrgency } from '@/types';

export const URGENCY_LEAD_DAYS = 7;

export type UrgencyFilter = 'all' | 'urgent' | 'advance' | 'escalated';

export type NoteFilter = 'all' | 'has' | 'empty';

export type AgeDaysFilter = 'all' | 'today' | '1-7' | '8-14' | '15-30' | '30+';

export type JobListSort = 'assignee_age' | 'age_desc' | 'age_asc' | 'newest' | 'oldest';

export const AGE_DAYS_FILTER_OPTIONS: { value: AgeDaysFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'today', label: 'วันนี้' },
  { value: '1-7', label: '1–7 วัน' },
  { value: '8-14', label: '8–14 วัน' },
  { value: '15-30', label: '15–30 วัน' },
  { value: '30+', label: '30 วันขึ้นไป' },
];

export const JOB_LIST_SORT_OPTIONS: { value: JobListSort; label: string }[] = [
  { value: 'assignee_age', label: 'ผู้รับผิดชอบ · ผ่านมามากสุด' },
  { value: 'age_desc', label: 'ผ่านมามาก → น้อย' },
  { value: 'age_asc', label: 'ผ่านมาน้อย → มาก' },
  { value: 'newest', label: 'กรอกใหม่สุด' },
  { value: 'oldest', label: 'กรอกเก่าสุด' },
];

export const URGENCY_FILTER_OPTIONS: { value: UrgencyFilter; label: string; hint?: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  {
    value: 'urgent',
    label: 'ฉุกเฉิน',
    hint: 'วันที่ส่งถึงวันที่ต้องการน้อยกว่า 7 วัน',
  },
  {
    value: 'advance',
    label: 'ล่วงหน้า',
    hint: 'วันที่ส่งถึงวันที่ต้องการ 7 วันขึ้นไป',
  },
  {
    value: 'escalated',
    label: 'เกินกำหนด',
    hint: 'เดิมเป็นล่วงหน้า แต่เหลือเวลาถึงวันที่ต้องการน้อยกว่า 7 วัน',
  },
];

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

export function hasJobAssignee(job: JobRequest): boolean {
  return Boolean(job.recruiter_name?.trim() || job.screener_name?.trim());
}

export function compareJobsByAgeDaysDesc(a: JobRequest, b: JobRequest, today = new Date()): number {
  const ageA = getJobRequestAgeDays(a, today) ?? -1;
  const ageB = getJobRequestAgeDays(b, today) ?? -1;
  if (ageA !== ageB) return ageB - ageA;
  return compareJobsByOldestRequestFirst(a, b);
}

/** มีผู้รับผิดชอบก่อน แล้วเรียงตามวันที่ผ่านมา (มาก → น้อย) */
export function compareJobsByAssigneeThenAgeDaysDesc(
  a: JobRequest,
  b: JobRequest,
  today = new Date(),
): number {
  const aAssigned = hasJobAssignee(a);
  const bAssigned = hasJobAssignee(b);
  if (aAssigned !== bAssigned) return aAssigned ? -1 : 1;
  return compareJobsByAgeDaysDesc(a, b, today);
}

export function compareJobsForListSort(
  a: JobRequest,
  b: JobRequest,
  sort: JobListSort,
  today = new Date(),
): number {
  switch (sort) {
    case 'assignee_age':
      return compareJobsByAssigneeThenAgeDaysDesc(a, b, today);
    case 'age_desc':
      return compareJobsByAgeDaysDesc(a, b, today);
    case 'age_asc':
      return -compareJobsByAgeDaysDesc(a, b, today);
    case 'newest':
      return compareJobsByOldestRequestFirst(b, a);
    case 'oldest':
      return compareJobsByOldestRequestFirst(a, b);
    default:
      return compareJobsByAssigneeThenAgeDaysDesc(a, b, today);
  }
}

export function matchesAgeDaysFilter(job: JobRequest, filter: AgeDaysFilter, today = new Date()): boolean {
  if (filter === 'all') return true;
  const days = getJobRequestAgeDays(job, today);
  if (days == null) return false;
  switch (filter) {
    case 'today':
      return days <= 0;
    case '1-7':
      return days >= 1 && days <= 7;
    case '8-14':
      return days >= 8 && days <= 14;
    case '15-30':
      return days >= 15 && days <= 30;
    case '30+':
      return days >= 30;
    default:
      return true;
  }
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
  if (meta.escalated) return 'เกินกำหนด';
  return meta.urgency === 'urgent' ? 'ฉุกเฉิน' : 'ล่วงหน้า';
}

export function matchesUrgencyFilter(job: JobRequest, filter: UrgencyFilter): boolean {
  if (filter === 'all') return true;
  const meta = computeJobUrgency(job);
  if (filter === 'escalated') return meta.escalated;
  if (filter === 'urgent') return meta.urgency === 'urgent' && !meta.escalated;
  if (filter === 'advance') return meta.urgency === 'advance';
  return true;
}

export function matchesNoteFilter(job: JobRequest, filter: NoteFilter): boolean {
  const note = (job.list_note || '').trim();
  if (filter === 'has') return note.length > 0;
  if (filter === 'empty') return note.length === 0;
  return true;
}
