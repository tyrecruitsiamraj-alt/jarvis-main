import {
  UNIT_REQUEST_FILTER_DEFAULTS,
  type UnitRequestFilterState,
} from '@/hooks/useSiamrajUnitRequestFilters';

const STORAGE_KEY = 'jarvis:supervisor-dashboard-filters';

export type SupervisorDashboardFilters = UnitRequestFilterState;

export function loadSupervisorDashboardFilters(): SupervisorDashboardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...UNIT_REQUEST_FILTER_DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<SupervisorDashboardFilters>;
    return { ...UNIT_REQUEST_FILTER_DEFAULTS, ...parsed };
  } catch {
    return { ...UNIT_REQUEST_FILTER_DEFAULTS };
  }
}

export function saveSupervisorDashboardFilters(filters: SupervisorDashboardFilters): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
