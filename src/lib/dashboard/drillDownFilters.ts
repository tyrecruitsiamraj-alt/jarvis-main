import type { JobRequest } from '@/types';
import { jobRequestDateYmd } from '@/components/shared/DateRangeCalendarPicker';
import { effectiveRequestDateYmd, matchesDashboardAgeBucket } from '@/lib/jobUrgency';
import {
  classifyRequestActivity,
  mapJobToTaskStatus,
  type RequestActivityKind,
} from '@/lib/dashboard/buildDashboardData';
import { buildOrganizationKeyResolver } from '@/lib/unitGroupName';
import type { DashboardAgeDaysBreakdown, DashboardTaskStatus } from '@/lib/dashboard/types';
import type { RequestControlRecord } from '@/lib/requestControl';
import {
  filterRecordsByEffectiveDate,
  filterRecordsCancelledInPeriod,
  filterRecordsCarriedOver,
  filterRecordsFilledInPeriod,
  filterRecordsFullyClosedInPeriod,
} from '@/lib/requestControl';

function safeYmd(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const ymd = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : null;
}

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

/** ใบขอที่ปิดในช่วง — ใช้ drill-down การ์ด "ปิดใบงาน" ให้ตรงกับ throughput */
export function filterJobsClosedInPeriod(
  jobs: JobRequest[],
  from: string,
  to: string,
  today = new Date(),
): JobRequest[] {
  return jobs.filter((j) => {
    if (j.status !== 'closed' && j.status !== 'cancelled') return false;
    const closureDate = safeYmd(j.closed_date) || effectiveRequestDateYmd(j, today);
    return closureDate ? inYmdRange(closureDate, from, to) : false;
  });
}

export function recordsToJobs(records: RequestControlRecord[]): JobRequest[] {
  return records.map((r) => r.job);
}

export function filterRecordsForControlKpi(
  records: RequestControlRecord[],
  kpiId: string,
  period: { from: string; to: string } | null,
): RequestControlRecord[] {
  if (!period) {
    switch (kpiId) {
      case 'remaining':
        return records.filter((r) => r.remainingPositions > 0);
      default:
        return records;
    }
  }
  const { from, to } = period;
  const backlog = filterRecordsCarriedOver(records, from);
  const fresh = filterRecordsByEffectiveDate(records, from, to);

  switch (kpiId) {
    case 'total_workload':
      return [...backlog, ...fresh];
    case 'new_requests':
      return fresh;
    case 'filled':
    case 'fulfilled':
      return filterRecordsFilledInPeriod(records, from, to);
    case 'fully_closed':
      return filterRecordsFullyClosedInPeriod(records, from, to);
    case 'partial':
      return records.filter((r) => r.isPartial);
    case 'cancelled':
      return filterRecordsCancelledInPeriod(records, from, to);
    case 'remaining':
      // ใช้ใบเปิดตาม effective date — ไม่ใช้ controlRecords ที่อาจถูกใบปิดทับแล้วเหลือ 0
      return filterRecordsByEffectiveDate(
        records.filter((r) => r.remainingPositions > 0 && r.job?.status !== 'closed' && r.job?.status !== 'cancelled'),
        from,
        to,
      );
    case 'completed':
    case 'success_rate':
      return filterRecordsFilledInPeriod(records, from, to);
    case 'total':
      return filterRecordsByEffectiveDate(records, from, to);
    default:
      return records;
  }
}

export function filterRecordsForCohort(
  records: RequestControlRecord[],
  rowId: string,
  period: { from: string; to: string },
): RequestControlRecord[] {
  const { from, to } = period;
  if (rowId === 'backlog_from_previous_period') return filterRecordsCarriedOver(records, from);
  if (rowId === 'new_this_period') return filterRecordsByEffectiveDate(records, from, to);
  return [...filterRecordsCarriedOver(records, from), ...filterRecordsByEffectiveDate(records, from, to)];
}

export function filterRecordsForSlaBucket(
  records: RequestControlRecord[],
  bucket: string,
): RequestControlRecord[] {
  return records.filter((r) => r.slaStatus === bucket);
}

export function filterRecordsForFilledBreakdown(
  records: RequestControlRecord[],
  segment: 'same' | 'backlog',
  period: { from: string; to: string },
): RequestControlRecord[] {
  const filled = filterRecordsFilledInPeriod(records, period.from, period.to);
  if (segment === 'same') {
    return filled.filter((r) => inYmdRange(r.effectiveRequestDate, period.from, period.to));
  }
  return filled.filter((r) => r.effectiveRequestDate < period.from);
}

export function filterRecordsForFullyClosedBreakdown(
  records: RequestControlRecord[],
  segment: 'same' | 'backlog',
  period: { from: string; to: string },
): RequestControlRecord[] {
  const closed = filterRecordsFullyClosedInPeriod(records, period.from, period.to);
  if (segment === 'same') {
    return closed.filter((r) => inYmdRange(r.effectiveRequestDate, period.from, period.to));
  }
  return closed.filter((r) => r.effectiveRequestDate < period.from);
}

export function filterJobsForDashboardKpi(
  jobs: JobRequest[],
  kpiId: string,
  today = new Date(),
): JobRequest[] {
  switch (kpiId) {
    case 'total':
      return jobs;
    case 'remaining':
    case 'open':
      return jobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled');
    case 'completed':
    case 'success_rate':
      return jobs.filter((j) => mapJobToTaskStatus(j, today) === 'completed');
    default:
      return jobs;
  }
}

/** เหลือหา — ชุดเดียวกับ KPI: ใบเปิด · ถ้างวดมี = เฉพาะใบที่เข้ามาในงวด */
export function filterJobsForRemainingKpi(
  openJobs: JobRequest[],
  period: { from: string; to: string } | null,
  today = new Date(),
): JobRequest[] {
  let jobs = openJobs.filter((j) => j.status !== 'closed' && j.status !== 'cancelled');
  if (period) {
    jobs = jobs.filter((j) => {
      const ymd = effectiveRequestDateYmd(j, today);
      return ymd ? inYmdRange(ymd, period.from, period.to) : false;
    });
  }
  return jobs;
}

export function filterJobsForAgeBucket(
  jobs: JobRequest[],
  bucket: DashboardAgeDaysBreakdown['bucket'],
  today = new Date(),
): JobRequest[] {
  return jobs.filter((j) => matchesDashboardAgeBucket(j, bucket, today));
}

export function filterJobsForTaskStatus(
  jobs: JobRequest[],
  status: DashboardTaskStatus,
  today = new Date(),
): JobRequest[] {
  return jobs.filter((j) => mapJobToTaskStatus(j, today) === status);
}

export function filterJobsForUnitName(jobs: JobRequest[], unitName: string): JobRequest[] {
  const resolve = buildOrganizationKeyResolver([...jobs.map((j) => j.unit_name), unitName]);
  const target = resolve(unitName);
  return jobs.filter((j) => resolve(j.unit_name) === target);
}

export function filterJobsForRecruiter(
  jobs: JobRequest[],
  recruiterName: string,
  role: 'recruiter' | 'screener' = 'recruiter',
): JobRequest[] {
  return jobs.filter((j) => {
    const field = role === 'screener' ? j.screener_name : j.recruiter_name;
    return (field?.trim() || 'ยังไม่มอบหมาย') === recruiterName;
  });
}

export function filterJobsForActivity(
  jobs: JobRequest[],
  kind: RequestActivityKind,
  month?: string,
): JobRequest[] {
  return jobs.filter((j) => {
    if (classifyRequestActivity(j) !== kind) return false;
    if (!month) return true;
    const ymd = jobRequestDateYmd(j);
    return ymd ? ymd.startsWith(month) : false;
  });
}
