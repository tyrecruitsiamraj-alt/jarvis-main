import { useMemo } from 'react';
import type { JobRequest } from '@/types';
import {
  departmentFilterOptions,
  filterUnitRequestsByDepartment,
  filterUnitRequestsByJobSubtype,
  jobSubtypeFilterOptions,
} from '@/lib/siamrajUnitFilters';
import {
  matchesAgeDaysFilter,
  matchesNoteFilter,
  matchesUrgencyFilter,
  type AgeDaysFilter,
  type NoteFilter,
  type UrgencyFilter,
} from '@/lib/jobUrgency';
import {
  buildRecruiterNameOptions,
  buildScreenerNameOptions,
  countUnassignedRecruiters,
  countUnassignedScreeners,
  matchesRecruiterFilter,
  matchesScreenerFilter,
} from '@/lib/jobStaffNames';

export type UnitRequestStatusFilter = 'all' | 'active' | 'closed';

export type UnitRequestFilterState = {
  departmentFilter: string;
  jobSubtypeFilter: string;
  recruiterFilter: string;
  screenerFilter: string;
  urgencyFilter: UrgencyFilter;
  noteFilter: NoteFilter;
  ageDaysFilter: AgeDaysFilter;
  statusFilter: UnitRequestStatusFilter;
};

export const UNIT_REQUEST_FILTER_DEFAULTS: UnitRequestFilterState = {
  departmentFilter: 'all',
  jobSubtypeFilter: 'all',
  recruiterFilter: 'all',
  screenerFilter: 'all',
  urgencyFilter: 'all',
  noteFilter: 'all',
  ageDaysFilter: 'all',
  statusFilter: 'all',
};

type OmitFilters = Partial<Record<keyof UnitRequestFilterState, true>>;

function effectiveFilters(
  filters: UnitRequestFilterState,
  omit?: OmitFilters,
): UnitRequestFilterState {
  if (!omit) return filters;
  const next = { ...filters };
  for (const key of Object.keys(omit) as (keyof UnitRequestFilterState)[]) {
    if (omit[key]) next[key] = UNIT_REQUEST_FILTER_DEFAULTS[key];
  }
  return next;
}

/** Pure filter — ใช้ซ้ำใน Dashboard breakdown (ข้ามบางฟิลเตอร์ชั่วคราว) */
export function filterUnitRequests(
  jobs: JobRequest[],
  siamrajPrimary: boolean,
  filters: UnitRequestFilterState,
  omit?: OmitFilters,
): JobRequest[] {
  const f = effectiveFilters(filters, omit);

  let list = siamrajPrimary ? filterUnitRequestsByDepartment(jobs, f.departmentFilter) : jobs;
  if (siamrajPrimary) list = filterUnitRequestsByJobSubtype(list, f.jobSubtypeFilter);

  return list.filter((j) => {
    if (!matchesRecruiterFilter(j, f.recruiterFilter)) return false;
    if (!matchesScreenerFilter(j, f.screenerFilter)) return false;
    if (!matchesUrgencyFilter(j, f.urgencyFilter)) return false;
    if (!matchesNoteFilter(j, f.noteFilter)) return false;
    if (!matchesAgeDaysFilter(j, f.ageDaysFilter)) return false;
    if (f.statusFilter === 'all') return true;
    if (f.statusFilter === 'closed') return j.status === 'closed';
    return j.status !== 'closed';
  });
}

export function useSiamrajUnitRequestFilters(
  jobs: JobRequest[],
  siamrajPrimary: boolean,
  filters: UnitRequestFilterState,
  staffRosterRev = 0,
) {
  const departmentOptions = useMemo(
    () => (siamrajPrimary ? departmentFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const departmentScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByDepartment(jobs, filters.departmentFilter) : jobs),
    [jobs, siamrajPrimary, filters.departmentFilter],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(departmentScopedJobs) : []),
    [departmentScopedJobs, siamrajPrimary],
  );

  const subtypeScopedJobs = useMemo(
    () =>
      siamrajPrimary
        ? filterUnitRequestsByJobSubtype(departmentScopedJobs, filters.jobSubtypeFilter)
        : departmentScopedJobs,
    [departmentScopedJobs, siamrajPrimary, filters.jobSubtypeFilter],
  );

  const recruiters = useMemo(() => {
    void staffRosterRev;
    return buildRecruiterNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const screeners = useMemo(() => {
    void staffRosterRev;
    return buildScreenerNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const recruiterFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => matchesScreenerFilter(j, filters.screenerFilter));
  }, [subtypeScopedJobs, filters.screenerFilter]);

  const screenerFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => matchesRecruiterFilter(j, filters.recruiterFilter));
  }, [subtypeScopedJobs, filters.recruiterFilter]);

  const unassignedRecruiterCount = useMemo(
    () => countUnassignedRecruiters(recruiterFilterScope),
    [recruiterFilterScope],
  );

  const unassignedScreenerCount = useMemo(
    () => countUnassignedScreeners(screenerFilterScope),
    [screenerFilterScope],
  );

  const filteredJobs = useMemo(
    () => filterUnitRequests(jobs, siamrajPrimary, filters),
    [jobs, siamrajPrimary, filters],
  );

  return {
    departmentOptions,
    jobSubtypeOptions,
    recruiters,
    screeners,
    unassignedRecruiterCount,
    unassignedScreenerCount,
    filteredJobs,
    subtypeScopedJobs,
    departmentScopedJobs,
  };
}
