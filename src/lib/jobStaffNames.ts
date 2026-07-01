import type { JobRequest } from '@/types';
import { getJobStaffApiCache } from '@/lib/jobStaffRemote';

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
