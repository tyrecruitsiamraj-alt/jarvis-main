import {
  UNIT_REQUEST_FILTER_DEFAULTS,
  normalizeUnitRequestFilters,
  type UnitRequestFilterState,
} from '@/hooks/useSiamrajUnitRequestFilters';

const STORAGE_KEY = 'jarvis:job-dashboard-filters';

export type JobDashboardFilters = UnitRequestFilterState;

export function loadJobDashboardFilters(): JobDashboardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...UNIT_REQUEST_FILTER_DEFAULTS };
    // ค่าที่จำไว้รุ่นก่อน 23 พ.ย. 2569 เป็นข้อความเดียว — แปลงเป็นรายการ
    return normalizeUnitRequestFilters(JSON.parse(raw));
  } catch {
    return { ...UNIT_REQUEST_FILTER_DEFAULTS };
  }
}

export function saveJobDashboardFilters(filters: JobDashboardFilters): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
