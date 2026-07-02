const STORAGE_KEY = 'jarvis:job-dashboard-filters';

export type JobDashboardFilters = {
  unitFilter: string;
  jobSubtypeFilter: string;
};

const DEFAULTS: JobDashboardFilters = {
  unitFilter: 'all',
  jobSubtypeFilter: 'all',
};

export function loadJobDashboardFilters(): JobDashboardFilters {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<JobDashboardFilters>;
    return {
      unitFilter: parsed.unitFilter || DEFAULTS.unitFilter,
      jobSubtypeFilter: parsed.jobSubtypeFilter || DEFAULTS.jobSubtypeFilter,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveJobDashboardFilters(filters: JobDashboardFilters): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
}
