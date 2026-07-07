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
  buildOplNameOptions,
  countUnassignedRecruiters,
  countUnassignedScreeners,
  countUnassignedOpls,
  matchesRecruiterFilter,
  matchesScreenerFilter,
  matchesOplFilter,
} from '@/lib/jobStaffNames';
import {
  groupedUnitFilterOptions,
  matchesUnitOrganizationFilter,
} from '@/lib/unitGroupName';

export type UnitRequestStatusFilter = 'all' | 'active' | 'closed';

export type UnitRequestFilterState = {
  unitFilter: string;
  departmentFilter: string;
  jobSubtypeFilter: string;
  recruiterFilter: string;
  screenerFilter: string;
  oplFilter: string;
  urgencyFilter: UrgencyFilter;
  noteFilter: NoteFilter;
  ageDaysFilter: AgeDaysFilter;
  statusFilter: UnitRequestStatusFilter;
};

export const UNIT_REQUEST_FILTER_DEFAULTS: UnitRequestFilterState = {
  unitFilter: 'all',
  departmentFilter: 'all',
  jobSubtypeFilter: 'all',
  recruiterFilter: 'all',
  screenerFilter: 'all',
  oplFilter: 'all',
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
  const unitScopeNames = jobs.map((j) => j.unit_name);

  let list = siamrajPrimary ? filterUnitRequestsByDepartment(jobs, f.departmentFilter) : jobs;
  if (siamrajPrimary) list = filterUnitRequestsByJobSubtype(list, f.jobSubtypeFilter);

  return list.filter((j) => {
    if (f.unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, f.unitFilter, unitScopeNames)) return false;
    if (!matchesRecruiterFilter(j, f.recruiterFilter)) return false;
    if (!matchesScreenerFilter(j, f.screenerFilter)) return false;
    if (!matchesOplFilter(j, f.oplFilter)) return false;
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

  const unitOptions = useMemo(
    () => groupedUnitFilterOptions(subtypeScopedJobs),
    [subtypeScopedJobs],
  );

  const recruiters = useMemo(() => {
    void staffRosterRev;
    return buildRecruiterNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const screeners = useMemo(() => {
    void staffRosterRev;
    return buildScreenerNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const opls = useMemo(() => {
    void staffRosterRev;
    return buildOplNameOptions(jobs);
  }, [staffRosterRev, jobs]);

  const unitScopeNames = useMemo(
    () => subtypeScopedJobs.map((j) => j.unit_name),
    [subtypeScopedJobs],
  );

  const recruiterFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (filters.unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesScreenerFilter(j, filters.screenerFilter)) return false;
      if (!matchesOplFilter(j, filters.oplFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, filters.unitFilter, filters.screenerFilter, filters.oplFilter, unitScopeNames]);

  const screenerFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (filters.unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesRecruiterFilter(j, filters.recruiterFilter)) return false;
      if (!matchesOplFilter(j, filters.oplFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, filters.unitFilter, filters.recruiterFilter, filters.oplFilter, unitScopeNames]);

  const oplFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (filters.unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesRecruiterFilter(j, filters.recruiterFilter)) return false;
      if (!matchesScreenerFilter(j, filters.screenerFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, filters.unitFilter, filters.recruiterFilter, filters.screenerFilter, unitScopeNames]);

  const unassignedRecruiterCount = useMemo(
    () => countUnassignedRecruiters(recruiterFilterScope),
    [recruiterFilterScope],
  );

  const unassignedScreenerCount = useMemo(
    () => countUnassignedScreeners(screenerFilterScope),
    [screenerFilterScope],
  );

  const unassignedOplCount = useMemo(
    () => countUnassignedOpls(oplFilterScope),
    [oplFilterScope],
  );

  const filteredJobs = useMemo(
    () => filterUnitRequests(jobs, siamrajPrimary, filters),
    [jobs, siamrajPrimary, filters],
  );

  return {
    departmentOptions,
    jobSubtypeOptions,
    unitOptions,
    recruiters,
    screeners,
    opls,
    unassignedRecruiterCount,
    unassignedScreenerCount,
    unassignedOplCount,
    filteredJobs,
    subtypeScopedJobs,
    departmentScopedJobs,
  };
}
