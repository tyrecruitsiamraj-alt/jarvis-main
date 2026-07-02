import type { JobRequest } from '@/types';
import { getJobStaffApiCache } from '@/lib/jobStaffRemote';

/** ค่า filter สำหรับงานที่ยังไม่ได้กำหนดเจ้าหน้าที่ */
export const STAFF_ASSIGNEE_UNASSIGNED = '__unassigned__';

export const STAFF_ASSIGNEE_UNASSIGNED_LABEL = 'ยังไม่ถูก Assign';

function uniqueSorted(names: string[]): string[] {
  const m = new Map<string, string>();
  for (const n of names) {
    const t = n.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!m.has(k)) m.set(k, t);
  }
  return [...m.values()].sort((a, b) => a.localeCompare(b, 'th'));
}

/**
 * @param extraJobs แนะนำส่งรายการงานจาก `/api/jobs` เพื่อดึงชื่อสรรหาจากงานจริง
 */
export function buildRecruiterNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.recruiter_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.recruiters ?? [];
  const ex = new Set((api?.pickerExcludedRecruiters ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...fromJobs]).filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function buildScreenerNameOptions(extraJobs?: JobRequest[]): string[] {
  const fromJobs = (extraJobs ?? [])
    .map((j) => j.screener_name)
    .filter((n): n is string => Boolean(n?.trim()));
  const api = getJobStaffApiCache();
  const roster = api?.screeners ?? [];
  const ex = new Set((api?.pickerExcludedScreeners ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...fromJobs]).filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function nameListedInOptions(trimmed: string, options: string[]): boolean {
  const k = trimmed.toLowerCase();
  return options.some((o) => o.trim().toLowerCase() === k);
}

export function isRecruiterUnassigned(job: JobRequest): boolean {
  return !job.recruiter_name?.trim();
}

export function isScreenerUnassigned(job: JobRequest): boolean {
  return !job.screener_name?.trim();
}

export function matchesRecruiterFilter(job: JobRequest, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === STAFF_ASSIGNEE_UNASSIGNED) return isRecruiterUnassigned(job);
  return job.recruiter_name === filter;
}

export function matchesScreenerFilter(job: JobRequest, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === STAFF_ASSIGNEE_UNASSIGNED) return isScreenerUnassigned(job);
  return job.screener_name === filter;
}

export function countUnassignedRecruiters(jobs: JobRequest[]): number {
  return jobs.filter(isRecruiterUnassigned).length;
}

export function countUnassignedScreeners(jobs: JobRequest[]): number {
  return jobs.filter(isScreenerUnassigned).length;
}
