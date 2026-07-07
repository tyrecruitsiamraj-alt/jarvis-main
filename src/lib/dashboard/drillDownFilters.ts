import type { JobRequest } from '@/types';
import { jobRequestDateYmd } from '@/components/shared/DateRangeCalendarPicker';
import { matchesDashboardAgeBucket } from '@/lib/jobUrgency';
import {
  classifyRequestActivity,
  mapJobToTaskStatus,
  type RequestActivityKind,
} from '@/lib/dashboard/buildDashboardData';
import type { DashboardAgeDaysBreakdown, DashboardTaskStatus } from '@/lib/dashboard/types';

export function filterJobsForDashboardKpi(
  jobs: JobRequest[],
  kpiId: string,
  today = new Date(),
): JobRequest[] {
  switch (kpiId) {
    case 'total':
      return jobs;
    case 'open':
      return jobs.filter((j) => {
        const st = mapJobToTaskStatus(j, today);
        return st === 'pending' || st === 'in_progress' || st === 'at_risk' || st === 'overdue';
      });
    case 'overdue':
      return jobs.filter((j) => mapJobToTaskStatus(j, today) === 'overdue');
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

import { buildOrganizationKeyResolver } from '@/lib/unitGroupName';

export function filterJobsForUnitName(jobs: JobRequest[], unitName: string): JobRequest[] {
  const resolve = buildOrganizationKeyResolver([...jobs.map((j) => j.unit_name), unitName]);
  const target = resolve(unitName);
  return jobs.filter((j) => resolve(j.unit_name) === target);
}

export function filterJobsForRecruiter(
  jobs: JobRequest[],
  recruiterName: string,
): JobRequest[] {
  return jobs.filter((j) => (j.recruiter_name?.trim() || 'ยังไม่มอบหมาย') === recruiterName);
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
