import type { DashboardFilters } from './types';
import { DEFAULT_DASHBOARD_FILTERS } from './buildDashboardData';

const STORAGE_KEY = 'jarvis:analytics-dashboard-filters';

export function loadDashboardFilters(): DashboardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DASHBOARD_FILTERS };
    const parsed = JSON.parse(raw) as Partial<DashboardFilters>;
    return { ...DEFAULT_DASHBOARD_FILTERS, ...parsed };
  } catch {
    return { ...DEFAULT_DASHBOARD_FILTERS };
  }
}

export function saveDashboardFilters(filters: DashboardFilters): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
