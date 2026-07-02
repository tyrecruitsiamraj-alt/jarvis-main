import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/pagination';

export type JobListFilter = 'all' | 'active' | 'closed';

export type JobListPageState = {
  filter: JobListFilter;
  search: string;
  unitFilter: string;
  departmentFilter: string;
  jobSubtypeFilter: string;
  recruiterFilter: string;
  screenerFilter: string;
  page: number;
  pageSize: PageSizeOption;
};

export const JOB_LIST_DEFAULTS: JobListPageState = {
  filter: 'all',
  search: '',
  unitFilter: 'all',
  departmentFilter: 'all',
  jobSubtypeFilter: 'all',
  recruiterFilter: 'all',
  screenerFilter: 'all',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const FILTER_VALUES = new Set<JobListFilter>(['all', 'active', 'closed']);

function parsePageSize(raw: string | null): PageSizeOption {
  const n = Number(raw);
  return PAGE_SIZE_OPTIONS.includes(n as PageSizeOption) ? (n as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

export function parseJobListSearchParams(params: URLSearchParams): JobListPageState {
  const filterRaw = params.get('f') || JOB_LIST_DEFAULTS.filter;
  const filter = FILTER_VALUES.has(filterRaw as JobListFilter)
    ? (filterRaw as JobListFilter)
    : JOB_LIST_DEFAULTS.filter;

  const pageRaw = Number(params.get('p') || '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  return {
    filter,
    search: params.get('q') ?? JOB_LIST_DEFAULTS.search,
    unitFilter: params.get('u') || JOB_LIST_DEFAULTS.unitFilter,
    departmentFilter: params.get('d') || JOB_LIST_DEFAULTS.departmentFilter,
    jobSubtypeFilter: params.get('st') || JOB_LIST_DEFAULTS.jobSubtypeFilter,
    recruiterFilter: params.get('r') || JOB_LIST_DEFAULTS.recruiterFilter,
    screenerFilter: params.get('sc') || JOB_LIST_DEFAULTS.screenerFilter,
    page,
    pageSize: parsePageSize(params.get('ps')),
  };
}

export function buildJobListSearchParams(state: JobListPageState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.filter !== JOB_LIST_DEFAULTS.filter) params.set('f', state.filter);
  if (state.search.trim()) params.set('q', state.search.trim());
  if (state.unitFilter !== JOB_LIST_DEFAULTS.unitFilter) params.set('u', state.unitFilter);
  if (state.departmentFilter !== JOB_LIST_DEFAULTS.departmentFilter) params.set('d', state.departmentFilter);
  if (state.jobSubtypeFilter !== JOB_LIST_DEFAULTS.jobSubtypeFilter) params.set('st', state.jobSubtypeFilter);
  if (state.recruiterFilter !== JOB_LIST_DEFAULTS.recruiterFilter) params.set('r', state.recruiterFilter);
  if (state.screenerFilter !== JOB_LIST_DEFAULTS.screenerFilter) params.set('sc', state.screenerFilter);
  if (state.page > 1) params.set('p', String(state.page));
  if (state.pageSize !== JOB_LIST_DEFAULTS.pageSize) params.set('ps', String(state.pageSize));
  return params;
}

export function jobListReturnTo(pathname: string, search: string): string {
  return `${pathname}${search}`;
}

const FILTER_RESET_KEYS: (keyof JobListPageState)[] = [
  'filter',
  'search',
  'unitFilter',
  'departmentFilter',
  'jobSubtypeFilter',
  'recruiterFilter',
  'screenerFilter',
  'pageSize',
];

export function mergeJobListState(
  current: JobListPageState,
  patch: Partial<JobListPageState>,
): JobListPageState {
  const shouldResetPage = !('page' in patch) && FILTER_RESET_KEYS.some((k) => k in patch);
  return {
    ...current,
    ...patch,
    ...(shouldResetPage ? { page: 1 } : {}),
  };
}
