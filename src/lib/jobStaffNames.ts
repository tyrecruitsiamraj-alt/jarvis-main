import { mockJobRequests } from '@/data/mockData';
import type { JobRequest } from '@/types';
import {
  filterRecruiterNamesForStaffDropdown,
  filterScreenerNamesForStaffDropdown,
  getJobs,
  getRecruitersRoster,
  getScreenersRoster,
} from '@/lib/demoStorage';
import { getJobStaffApiCache } from '@/lib/jobStaffRemote';
import { isDemoMode } from '@/lib/demoMode';
import { mergeJobSources } from '@/lib/mergeJobs';

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

function jobsForStaffNames(extraJobs?: JobRequest[]): JobRequest[] {
  if (extraJobs && extraJobs.length > 0) return extraJobs;
  return mergeJobSources([], getJobs());
}

/**
 * @param extraJobs ถ้าโหมด API แนะนำส่งรายการงานจาก `/api/jobs` เพื่อดึงชื่อสรรหาจากงานจริง (ไม่ใช่แค่ localStorage)
 */
export function buildRecruiterNameOptions(extraJobs?: JobRequest[]): string[] {
  const merged = jobsForStaffNames(extraJobs);
  const fromJobs = merged.map((j) => j.recruiter_name).filter((n): n is string => Boolean(n?.trim()));
  const fromMock = isDemoMode()
    ? (mockJobRequests.map((j) => j.recruiter_name).filter(Boolean) as string[])
    : [];

  if (isDemoMode()) {
    return filterRecruiterNamesForStaffDropdown(
      uniqueSorted([...getRecruitersRoster(), ...fromMock, ...fromJobs]),
    );
  }

  const api = getJobStaffApiCache();
  const roster = api?.recruiters ?? [];
  const ex = new Set((api?.pickerExcludedRecruiters ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...fromJobs]).filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function buildScreenerNameOptions(extraJobs?: JobRequest[]): string[] {
  const merged = jobsForStaffNames(extraJobs);
  const fromJobs = merged.map((j) => j.screener_name).filter((n): n is string => Boolean(n?.trim()));
  const fromMock = isDemoMode()
    ? (mockJobRequests.map((j) => j.screener_name).filter(Boolean) as string[])
    : [];

  if (isDemoMode()) {
    return filterScreenerNamesForStaffDropdown(
      uniqueSorted([...getScreenersRoster(), ...fromMock, ...fromJobs]),
    );
  }

  const api = getJobStaffApiCache();
  const roster = api?.screeners ?? [];
  const ex = new Set((api?.pickerExcludedScreeners ?? []).map((s) => s.toLowerCase()));
  return uniqueSorted([...roster, ...fromJobs]).filter((n) => !ex.has(n.trim().toLowerCase()));
}

export function nameListedInOptions(trimmed: string, options: string[]): boolean {
  const k = trimmed.toLowerCase();
  return options.some((o) => o.trim().toLowerCase() === k);
}
