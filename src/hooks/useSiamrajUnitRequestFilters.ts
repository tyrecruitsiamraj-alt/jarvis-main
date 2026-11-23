import { useMemo } from 'react';
import type { JobRequest } from '@/types';
import {
  departmentFilterOptions,
  filterUnitRequestsByAnyDepartment,
  filterUnitRequestsByAnyJobSubtype,
  jobSubtypeFilterOptions,
} from '@/lib/siamrajUnitFilters';
import {
  matchesAgeDaysFilter,
  matchesAnyUrgencyFilter,
  matchesNoteFilter,
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
  matchesAnyRecruiterFilter,
  matchesAnyScreenerFilter,
  matchesAnyOplFilter,
} from '@/lib/jobStaffNames';
import {
  groupedUnitFilterOptions,
  matchesAnyUnitOrganizationFilter,
} from '@/lib/unitGroupName';

export type UnitRequestStatusFilter = 'all' | 'active' | 'closed';

/**
 * 🔴 7 ช่องเลือกได้หลายค่า (เจ้าของ 23 พ.ย. 2569 "ฟิลเตอร์ทำให้เลือกได้หลายอันหน่อย") — [] = ทั้งหมด
 * ตัวกรองแบบเดียวกับหน้าใบขอ (`matchesAny*`) · ค่าเก่าที่จำไว้เป็นข้อความเดียวแปลงที่ `normalizeUnitRequestFilters`
 */
export type UnitRequestFilterState = {
  unitFilter: string[];
  departmentFilter: string[];
  jobSubtypeFilter: string[];
  recruiterFilter: string[];
  screenerFilter: string[];
  oplFilter: string[];
  urgencyFilter: UrgencyFilter[];
  noteFilter: NoteFilter;
  ageDaysFilter: AgeDaysFilter;
  statusFilter: UnitRequestStatusFilter;
};

export const UNIT_REQUEST_FILTER_DEFAULTS: UnitRequestFilterState = {
  unitFilter: [],
  departmentFilter: [],
  jobSubtypeFilter: [],
  recruiterFilter: [],
  screenerFilter: [],
  oplFilter: [],
  urgencyFilter: [],
  noteFilter: 'all',
  ageDaysFilter: 'all',
  statusFilter: 'all',
};

const MULTI_KEYS = ['unitFilter', 'departmentFilter', 'jobSubtypeFilter', 'recruiterFilter', 'screenerFilter', 'oplFilter', 'urgencyFilter'] as const;

/** ค่าที่อ่านจากที่จำไว้ (รุ่นเก่าเป็นข้อความเดียว 'all' / 'ชื่อ') → รายการ · ค่าแปลก = ทั้งหมด */
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x !== '' && x !== 'all');
  if (typeof v === 'string' && v !== '' && v !== 'all') return [v];
  return [];
}
export function normalizeUnitRequestFilters(raw: Partial<Record<keyof UnitRequestFilterState, unknown>> | null | undefined): UnitRequestFilterState {
  const out = { ...UNIT_REQUEST_FILTER_DEFAULTS, ...(raw ?? {}) } as UnitRequestFilterState;
  for (const k of MULTI_KEYS) (out as Record<string, unknown>)[k] = toList(raw?.[k]);
  return out;
}

/** มีตัวกรองช่องนี้อยู่ไหม */
export const hasPick = (v: readonly string[]) => v.length > 0;

type OmitFilters = Partial<Record<keyof UnitRequestFilterState, true>>;

function effectiveFilters(
  filters: UnitRequestFilterState,
  omit?: OmitFilters,
): UnitRequestFilterState {
  if (!omit) return filters;
  const next = { ...filters };
  for (const key of Object.keys(omit) as (keyof UnitRequestFilterState)[]) {
    if (omit[key]) (next as Record<string, unknown>)[key] = UNIT_REQUEST_FILTER_DEFAULTS[key];
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

  let list = siamrajPrimary ? filterUnitRequestsByAnyDepartment(jobs, f.departmentFilter) : jobs;
  if (siamrajPrimary) list = filterUnitRequestsByAnyJobSubtype(list, f.jobSubtypeFilter);

  return list.filter((j) => {
    if (!matchesAnyUnitOrganizationFilter(j.unit_name, f.unitFilter, unitScopeNames)) return false;
    if (!matchesAnyRecruiterFilter(j, f.recruiterFilter)) return false;
    if (!matchesAnyScreenerFilter(j, f.screenerFilter)) return false;
    if (!matchesAnyOplFilter(j, f.oplFilter)) return false;
    if (!matchesAnyUrgencyFilter(j, f.urgencyFilter)) return false;
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
    () => (siamrajPrimary ? filterUnitRequestsByAnyDepartment(jobs, filters.departmentFilter) : jobs),
    [jobs, siamrajPrimary, filters.departmentFilter],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(departmentScopedJobs) : []),
    [departmentScopedJobs, siamrajPrimary],
  );

  const subtypeScopedJobs = useMemo(
    () =>
      siamrajPrimary
        ? filterUnitRequestsByAnyJobSubtype(departmentScopedJobs, filters.jobSubtypeFilter)
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
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesAnyScreenerFilter(j, filters.screenerFilter)) return false;
      if (!matchesAnyOplFilter(j, filters.oplFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, filters.unitFilter, filters.screenerFilter, filters.oplFilter, unitScopeNames]);

  const screenerFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesAnyRecruiterFilter(j, filters.recruiterFilter)) return false;
      if (!matchesAnyOplFilter(j, filters.oplFilter)) return false;
      return true;
    });
  }, [subtypeScopedJobs, filters.unitFilter, filters.recruiterFilter, filters.oplFilter, unitScopeNames]);

  const oplFilterScope = useMemo(() => {
    return subtypeScopedJobs.filter((j) => {
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, filters.unitFilter, unitScopeNames)) return false;
      if (!matchesAnyRecruiterFilter(j, filters.recruiterFilter)) return false;
      if (!matchesAnyScreenerFilter(j, filters.screenerFilter)) return false;
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
