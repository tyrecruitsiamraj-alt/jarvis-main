import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { JobRequest, JobUrgency } from '@/types';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { toYmdBangkok } from '@/lib/dateTh';

export const URGENCY_LEAD_DAYS = 7;

/** สถานะใบขอ — คำนวณจากวันที่กรอก vs วันที่ต้องการ */
export type RequestStatusKind = 'retroactive' | 'urgent' | 'advance';

export type UrgencyFilter = 'all' | RequestStatusKind;

export type NoteFilter = 'all' | 'has' | 'empty';
export type ReplacementFilter = 'all' | 'send' | 'no_send' | 'unset';

export const REPLACEMENT_FILTER_OPTIONS: { value: ReplacementFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'send', label: 'ส่งคนแทน' },
  { value: 'no_send', label: 'ไม่ส่งคนแทน' },
  { value: 'unset', label: 'ยังไม่ระบุ' },
];

export type AgeDaysFilter = 'all' | 'advance' | 'today' | '1-7' | '8-15' | '16-30' | '30+';

export type AgeDaysDisplayBucket = '1-7' | '8-15' | '16-30' | '30+' | 'advance';

export const AGE_DAYS_DISPLAY_BUCKETS: { id: AgeDaysDisplayBucket; label: string }[] = [
  { id: 'advance', label: 'ล่วงหน้า' },
  { id: '1-7', label: '1–7 วัน' },
  { id: '8-15', label: '8–15 วัน' },
  { id: '16-30', label: '16–30 วัน' },
  { id: '30+', label: '30 วันขึ้นไป' },
];

export type JobListSort = 'assignee_age' | 'age_desc' | 'age_asc' | 'newest' | 'oldest';

export const AGE_DAYS_FILTER_OPTIONS: { value: AgeDaysFilter; label: string }[] = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'advance', label: 'ล่วงหน้า' },
  { value: 'today', label: 'วันนี้' },
  { value: '1-7', label: '1–7 วัน' },
  { value: '8-15', label: '8–15 วัน' },
  { value: '16-30', label: '16–30 วัน' },
  { value: '30+', label: '30 วันขึ้นไป' },
];

/** ค่าที่เลือกได้ในตัวกรองแบบหลายค่า (ไม่รวม 'all' — [] = ทั้งหมด) */
export const AGE_DAYS_MULTI_OPTIONS = AGE_DAYS_FILTER_OPTIONS.filter((o) => o.value !== 'all');

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

/** แปลงค่าวันที่เป็น YYYY-MM-DD ตามปฏิทินท้องถิ่น (ไม่ใช้ UTC slice) */
function calendarYmdFromValue(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const t = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const d = parseISO(t);
  if (Number.isNaN(d.getTime())) return null;
  return toYmdBangkok(d);
}

function parseJobDate(value?: string | null): Date | null {
  const ymd = calendarYmdFromValue(value);
  if (!ymd) return null;
  const d = parseISO(ymd);
  return Number.isNaN(d.getTime()) ? null : d;
}

function submittedDate(job: JobRequest): Date | null {
  return (
    parseJobDate(job.submittedAt) ??
    parseJobDate(job.request_date) ??
    parseJobDate(job.created_at)
  );
}

function submittedDateYmd(job: JobRequest): string | null {
  const d = submittedDate(job);
  return d ? toYmdBangkok(d) : null;
}

/** วันอ้างอิง「ขอมา」— ย้อนหลังใช้วันที่กรอก · ฉุกเฉิน/ล่วงหน้าใช้วันที่ต้องการ */
export function effectiveRequestDateYmd(job: JobRequest, today = new Date()): string | null {
  const submitYmd = submittedDateYmd(job);
  const requiredYmd = calendarYmdFromValue(job.required_date);
  if (!submitYmd) return requiredYmd;
  if (!requiredYmd) return submitYmd;
  const meta = computeJobUrgency(job, today);
  if (meta.kind === 'retroactive') return submitYmd;
  return requiredYmd;
}

function todayStart(today = new Date()): Date {
  return parseISO(toYmdBangkok(today));
}

/** คีย์ล่วงหน้า (≥7 วัน) และยังไม่ถึงวันที่ต้องการ — ยังไม่นับวันผ่านมา */
export function isAdvanceBeforeRequiredDate(job: JobRequest, today = new Date()): boolean {
  const meta = computeJobUrgency(job, today);
  return meta.kind === 'advance' && meta.daysUntilRequired > 0;
}

/**
 * ช่อง「ผ่านมา」แสดง 'ล่วงหน้า' เมื่อยังไม่ถึงวันที่ต้องการ
 * (ทั้งล่วงหน้าและฉุกเฉิน แต่ไม่รวมย้อนหลังที่นับจากวันที่กรอก)
 */
export function isBeforeRequiredForAge(job: JobRequest, today = new Date()): boolean {
  const meta = computeJobUrgency(job, today);
  return meta.kind !== 'retroactive' && meta.daysUntilRequired > 0;
}

/**
 * วันผ่านมาสำหรับคอลัมน์「ผ่านมา」
 * - ล่วงหน้า (ยังไม่ถึงวันที่ต้องการ): นับจากวันที่กรอก
 * - ล่วงหน้า + ฉุกเฉิน (ถึง/เลยวันที่ต้องการแล้ว): วันนี้ − วันที่ต้องการ
 * - ฉุกเฉิน/ย้อนหลัง: วันนี้ − วันที่กรอก
 */
export function getJobRequestAgeDays(job: JobRequest, today = new Date()): number | null {
  const meta = computeJobUrgency(job, today);
  const today0 = todayStart(today);

  if (isAdvanceBeforeRequiredDate(job, today)) {
    const submitted = submittedDate(job);
    if (!submitted) return null;
    return Math.max(0, differenceInCalendarDays(today0, submitted));
  }

  if (meta.kind === 'retroactive') {
    const submitted = submittedDate(job);
    if (!submitted) return null;
    return differenceInCalendarDays(today0, submitted);
  }

  const required = parseJobDate(job.required_date);
  if (!required) return null;
  return Math.max(0, differenceInCalendarDays(today0, required));
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

/**
 * คอลัมน์「ผ่านมา」— มีแค่ 2 แบบ (แยกจากช่องสถานะใบขอ):
 * - ยังไม่ถึงวันที่ต้องการ (ล่วงหน้า/ฉุกเฉินที่ยังไม่ถึงวัน) → 'ล่วงหน้า'
 * - อื่น ๆ → จำนวนวัน:
 *     · ย้อนหลัง: นับจากวันที่กรอก (กรอกวันนี้ = 0 วัน, +1 ทุกวัน)
 *     · ถึง/เลยวันที่ต้องการ: นับจากวันที่ต้องการ
 */
export function getJobRequestAgeLabel(job: JobRequest, today = new Date()): string {
  // ยังไม่ถึงวันที่ต้องการ → ล่วงหน้า (ย้อนหลังนับจากวันที่กรอกเสมอ)
  if (isBeforeRequiredForAge(job, today)) return 'ล่วงหน้า';
  const days = getJobRequestAgeDays(job, today);
  if (days == null) return '—';
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
  const beforeRequired = isBeforeRequiredForAge(job, today);
  if (filter === 'advance') return beforeRequired;
  // ใบที่ยังไม่ถึงวันที่ต้องการถือเป็น "ล่วงหน้า" เท่านั้น ไม่เข้ากล่องตัวเลข/วันนี้
  if (beforeRequired) return false;
  const days = getJobRequestAgeDays(job, today);
  if (days == null) return false;
  switch (filter) {
    case 'today':
      return days <= 0;
    case '1-7':
      return days >= 1 && days <= 7;
    case '8-15':
      return days >= 8 && days <= 15;
    case '16-30':
      return days >= 16 && days <= 30;
    case '30+':
      return days > 30;
    default:
      return true;
  }
}

/** ตัวกรองอายุแบบหลายค่า — [] = ทั้งหมด, มิฉะนั้นเข้าเงื่อนไขข้อใดข้อหนึ่ง (OR) */
export function matchesAnyAgeDaysFilter(
  job: JobRequest,
  filters: AgeDaysFilter[],
  today = new Date(),
): boolean {
  if (filters.length === 0) return true;
  return filters.some((f) => matchesAgeDaysFilter(job, f, today));
}

function getDashboardElapsedDays(job: JobRequest, today = new Date()): number | null {
  return getJobRequestAgeDays(job, today);
}

function isDashboardAdvanceBucket(job: JobRequest, today = new Date()): boolean {
  return isAdvanceBeforeRequiredDate(job, today);
}

export function matchesDashboardAgeBucket(
  job: JobRequest,
  bucket: AgeDaysDisplayBucket,
  today = new Date(),
): boolean {
  if (bucket === 'advance') return isDashboardAdvanceBucket(job, today);
  if (isDashboardAdvanceBucket(job, today)) return false;
  const days = getDashboardElapsedDays(job, today);
  if (days == null) return false;
  switch (bucket) {
    case '1-7':
      return days >= 0 && days <= 7;
    case '8-15':
      return days >= 8 && days <= 15;
    case '16-30':
      return days >= 16 && days <= 30;
    case '30+':
      return days > 30;
    default:
      return false;
  }
}

/** นับตำแหน่งที่ต้องการต่อกล่อง — รวมแล้วเท่า KPI งานทั้งหมด */
export function countAgeDaysBreakdown(
  jobs: JobRequest[],
  today = new Date(),
): Record<AgeDaysDisplayBucket, number> {
  const counts: Record<AgeDaysDisplayBucket, number> = {
    '1-7': 0,
    '8-15': 0,
    '16-30': 0,
    '30+': 0,
    advance: 0,
  };
  for (const j of jobs) {
    const units = jobPositionUnits(j);
    let matched = false;
    for (const bucket of AGE_DAYS_DISPLAY_BUCKETS) {
      if (matchesDashboardAgeBucket(j, bucket.id, today)) {
        counts[bucket.id] += units;
        matched = true;
        break;
      }
    }
    if (!matched) counts['1-7'] += units;
  }
  return counts;
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

export function matchesReplacementFilter(job: JobRequest, filter: ReplacementFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'send') return job.send_replacement === true;
  if (filter === 'no_send') return job.send_replacement === false;
  return job.send_replacement == null;
}
