import { buildDateRangeYmd, parseYmd, toYmdLocal } from '@/lib/dateTh';
import type { JobRequest, WorkCalendarEntry } from '@/types';

/** สถานะ WL ที่ถือว่าส่งคนไปปฏิบัติงานแล้ว — ไม่นับค่าปรับวันนั้น */
export const WL_COVERAGE_STATUSES = new Set<WorkCalendarEntry['status']>(['normal_work']);

export function normalizeUnitKey(name?: string | null): string {
  return (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** วันที่มี WL ไปหน่วยงาน (client_name ตรง unit_name) */
export function buildWlCoverageByUnit(
  entries: WorkCalendarEntry[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of entries) {
    if (!WL_COVERAGE_STATUSES.has(e.status)) continue;
    const key = normalizeUnitKey(e.client_name);
    if (!key) continue;
    const ymd = e.work_date?.slice(0, 10);
    if (!ymd || !parseYmd(ymd)) continue;
    const set = map.get(key) ?? new Set<string>();
    set.add(ymd);
    map.set(key, set);
  }
  return map;
}

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return parseYmd(ymd) ? ymd : null;
}

function penaltyCountEndYmd(job: JobRequest, today: Date): string | null {
  if (job.status === 'cancelled') return null;
  if (job.status === 'closed') return safeYmd(job.closed_date) ?? safeYmd(job.required_date);
  return toYmdLocal(today);
}

/**
 * นับวันขาดคน: ตั้งแต่วันที่ต้องการคน (required_date) ถึงวันนี้/วันปิดงาน
 * ยกเว้นวันที่มี WL status normal_work ไปหน่วยงานเดียวกัน
 */
export function countPenaltyDays(
  job: JobRequest,
  coverageByUnit: Map<string, Set<string>>,
  today = new Date(),
): number {
  const start = safeYmd(job.required_date);
  const end = penaltyCountEndYmd(job, today);
  if (!start || !end || end < start) return 0;

  const unitKey = normalizeUnitKey(job.unit_name);
  const covered = unitKey ? coverageByUnit.get(unitKey) : undefined;

  let days = 0;
  for (const ymd of buildDateRangeYmd(start, end)) {
    if (!covered?.has(ymd)) days += 1;
  }
  return days;
}

export function computeJobPenaltyFields(
  job: JobRequest,
  coverageByUnit: Map<string, Set<string>>,
  today = new Date(),
): Pick<JobRequest, 'days_without_worker' | 'total_penalty'> {
  const days = countPenaltyDays(job, coverageByUnit, today);
  const rate = Math.max(0, job.penalty_per_day ?? 0);
  return {
    days_without_worker: days,
    total_penalty: rate * days,
  };
}

/** คำนวณค่าปรับ/ลดมูลค่าจากตาราง WL — ใช้กับใบขอที่ยังไม่ปิดหรือปิดแล้ว */
export function enrichJobsWithPenalty(
  jobs: JobRequest[],
  workCalendar: WorkCalendarEntry[],
  today = new Date(),
): JobRequest[] {
  if (jobs.length === 0) return jobs;
  const coverage = buildWlCoverageByUnit(workCalendar);
  return jobs.map((job) => {
    if (job.status === 'cancelled') return job;
    const penalty = computeJobPenaltyFields(job, coverage, today);
    return { ...job, ...penalty };
  });
}
