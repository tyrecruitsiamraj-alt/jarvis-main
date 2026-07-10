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
