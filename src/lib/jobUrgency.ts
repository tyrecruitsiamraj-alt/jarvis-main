import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest, JobUrgency } from '@/types';

export const URGENCY_LEAD_DAYS = 7;

/** สถานะใบขอ — คำนวณจากวันที่กรอก vs วันที่ต้องการ */
export type RequestStatusKind = 'retroactive' | 'urgent' | 'advance';

export type UrgencyFilter = 'all' | RequestStatusKind;

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
    value: 'retroactive',
    label: 'ฉุกเฉิน/ย้อนหลัง',
    hint: 'วันที่ต้องการอยู่ก่อนวันที่กรอกใบขอ (ขอคนย้อนหลัง)',
  },
  {
    value: 'urgent',
    label: 'ฉุกเฉิน',
    hint: 'วันที่กรอกถึงวันที่ต้องการน้อยกว่า 7 วัน',
  },
  {
    value: 'advance',
    label: 'ล่วงหน้า',
    hint: 'วันที่กรอกถึงวันที่ต้องการ 7 วันขึ้นไป',
  },
];

export type JobUrgencyMeta = {
  kind: RequestStatusKind;
  /** วันที่ต้องการ − วันที่กรอก (ติดลบ = ย้อนหลัง) */
  leadDays: number;
  /** วันที่ต้องการ − วันนี้ */
  daysUntilRequired: number;
  /** วันนี้ − วันที่ต้องการ (≥ 1 = เลยกำหนดแล้ว) */
  daysPastRequired: number;
  wasAdvanceAtSubmit: boolean;
};

function parseJobDate(value?: string | null): Date | null {
  if (!value || typeof value !== 'string') return null;
  const d = parseISO(value.slice(0, 10));
  return Number.isNaN(d.getTime()) ? null : d;
}

function submittedDate(job: JobRequest): Date | null {
  return parseJobDate(job.submittedAt) ?? parseJobDate(job.created_at) ?? parseJobDate(job.request_date);
}

function todayStart(today = new Date()): Date {
  return parseISO(today.toISOString().slice(0, 10));
}

export function getJobRequestSubmittedDate(job: JobRequest): Date | null {
  return submittedDate(job);
}

export function computeJobUrgency(job: JobRequest, today = new Date()): JobUrgencyMeta {
  const submitted = submittedDate(job);
  const required = parseJobDate(job.required_date);
  const today0 = todayStart(today);

  if (!submitted || !required) {
    return {
      kind: 'advance',
      leadDays: URGENCY_LEAD_DAYS,
      daysUntilRequired: 0,
      daysPastRequired: 0,
      wasAdvanceAtSubmit: true,
    };
  }

  const leadDays = differenceInCalendarDays(required, submitted);
  const daysUntilRequired = differenceInCalendarDays(required, today0);
  const daysPastRequired = differenceInCalendarDays(today0, required);
  const wasAdvanceAtSubmit = leadDays >= URGENCY_LEAD_DAYS;

  if (leadDays < 0) {
    return { kind: 'retroactive', leadDays, daysUntilRequired, daysPastRequired, wasAdvanceAtSubmit: false };
  }

  if (leadDays < URGENCY_LEAD_DAYS) {
    return { kind: 'urgent', leadDays, daysUntilRequired, daysPastRequired, wasAdvanceAtSubmit: false };
  }

  return { kind: 'advance', leadDays, daysUntilRequired, daysPastRequired, wasAdvanceAtSubmit: true };
}

/** วันที่ใช้กับคอลัมน์「ผ่านมา」— ล่วงหน้ายังไม่นับ */
export function getJobRequestAgeDays(job: JobRequest, today = new Date()): number | null {
  const meta = computeJobUrgency(job, today);
  if (meta.kind === 'advance') return null;
  const submitted = submittedDate(job);
  if (!submitted) return null;
  return differenceInCalendarDays(todayStart(today), submitted);
}

export function getJobRequestAgeLabel(job: JobRequest, today = new Date()): string {
  const meta = computeJobUrgency(job, today);
  if (meta.kind === 'advance') return 'ล่วงหน้าก่อน';
  const days = getJobRequestAgeDays(job, today);
  if (days == null) return '—';
  if (days <= 0) return 'วันนี้';
  return `${days} วัน`;
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
  const meta = computeJobUrgency(job, today);
  if (meta.kind === 'advance') return false;
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

function urgencyBucket(meta: JobUrgencyMeta): JobUrgency {
  return meta.kind === 'advance' ? 'advance' : 'urgent';
}

export function withComputedUrgency(job: JobRequest, today = new Date()): JobRequest {
  const meta = computeJobUrgency(job, today);
  const urgency = urgencyBucket(meta);
  if (job.urgency === urgency) return job;
  return { ...job, urgency };
}

export function enrichJobsWithUrgency(jobs: JobRequest[], today = new Date()): JobRequest[] {
  return jobs.map((j) => withComputedUrgency(j, today));
}

export function requestStatusLabel(kind: RequestStatusKind): string {
  switch (kind) {
    case 'retroactive':
      return 'ฉุกเฉิน/ย้อนหลัง';
    case 'urgent':
      return 'ฉุกเฉิน';
    case 'advance':
      return 'ล่วงหน้า';
    default:
      return kind;
  }
}

export function urgencyDisplayLabel(meta: JobUrgencyMeta): string {
  return requestStatusLabel(meta.kind);
}

export function matchesUrgencyFilter(job: JobRequest, filter: UrgencyFilter): boolean {
  if (filter === 'all') return true;
  return computeJobUrgency(job).kind === filter;
}

export function matchesNoteFilter(job: JobRequest, filter: NoteFilter): boolean {
  const note = (job.list_note || '').trim();
  if (filter === 'has') return note.length > 0;
  if (filter === 'empty') return note.length === 0;
  return true;
}
