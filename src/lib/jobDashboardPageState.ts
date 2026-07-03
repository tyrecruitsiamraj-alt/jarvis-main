import {
  UNIT_REQUEST_FILTER_DEFAULTS,
  type UnitRequestFilterState,
} from '@/hooks/useSiamrajUnitRequestFilters';

const STORAGE_KEY = 'jarvis:job-dashboard-filters';

export type JobDashboardFilters = UnitRequestFilterState;

export function loadJobDashboardFilters(): JobDashboardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...UNIT_REQUEST_FILTER_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<JobDashboardFilters>;
    return {
      ...UNIT_REQUEST_FILTER_DEFAULTS,
      ...parsed,
    };
  } catch {
    return { ...UNIT_REQUEST_FILTER_DEFAULTS };
  }
}

export function saveJobDashboardFilters(filters: JobDashboardFilters): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
