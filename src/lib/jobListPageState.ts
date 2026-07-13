import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/pagination';
import type { AgeDaysFilter, JobListSort, NoteFilter, ReplacementFilter, UrgencyFilter } from '@/lib/jobUrgency';

export type JobListFilter = 'all' | 'active' | 'closed';

export type JobListPageState = {
  filter: JobListFilter;
  search: string;
  unitFilter: string;
  departmentFilter: string;
  jobSubtypeFilter: string;
  yearFilter: string;
  recruiterFilter: string;
  screenerFilter: string;
  oplFilter: string;
  urgencyFilter: UrgencyFilter;
  noteFilter: NoteFilter;
  replacementFilter: ReplacementFilter;
  ageDaysFilter: AgeDaysFilter;
  sort: JobListSort;
  page: number;
  pageSize: PageSizeOption;
};

export const JOB_LIST_DEFAULTS: JobListPageState = {
  filter: 'all',
  search: '',
  unitFilter: 'all',
  departmentFilter: 'all',
  jobSubtypeFilter: 'all',
  yearFilter: 'all',
  recruiterFilter: 'all',
  screenerFilter: 'all',
  oplFilter: 'all',
  urgencyFilter: 'all',
  noteFilter: 'all',
  replacementFilter: 'all',
  ageDaysFilter: 'all',
  sort: 'assignee_age',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const FILTER_VALUES = new Set<JobListFilter>(['all', 'active', 'closed']);
const URGENCY_VALUES = new Set<UrgencyFilter>(['all', 'retroactive', 'urgent', 'advance']);
const NOTE_VALUES = new Set<NoteFilter>(['all', 'has', 'empty']);
const REPLACEMENT_VALUES = new Set<ReplacementFilter>(['all', 'send', 'no_send', 'unset']);
const AGE_DAYS_VALUES = new Set<AgeDaysFilter>(['all', 'advance', 'today', '1-7', '8-15', '16-30', '30+']);
const SORT_VALUES = new Set<JobListSort>(['assignee_age', 'age_desc', 'age_asc', 'newest', 'oldest']);

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

  const urgencyRaw = (params.get('urg') || JOB_LIST_DEFAULTS.urgencyFilter) as UrgencyFilter;
  const urgencyNormalized =
    (urgencyRaw as string) === 'overdue' || (urgencyRaw as string) === 'escalated'
      ? ('advance' as UrgencyFilter)
      : urgencyRaw;
  const noteRaw = (params.get('nf') || JOB_LIST_DEFAULTS.noteFilter) as NoteFilter;
  const replacementRaw = (params.get('sr') || JOB_LIST_DEFAULTS.replacementFilter) as ReplacementFilter;
  const ageRaw = (params.get('ag') || JOB_LIST_DEFAULTS.ageDaysFilter) as string;
  const ageNormalized = (
    ageRaw === '8-14' ? '8-15' : ageRaw === '15-30' ? '16-30' : ageRaw
  ) as AgeDaysFilter;
  const sortRaw = (params.get('sort') || JOB_LIST_DEFAULTS.sort) as JobListSort;

  return {
    filter,
    search: params.get('q') ?? JOB_LIST_DEFAULTS.search,
    unitFilter: params.get('u') || JOB_LIST_DEFAULTS.unitFilter,
    departmentFilter: params.get('d') || JOB_LIST_DEFAULTS.departmentFilter,
    jobSubtypeFilter: params.get('st') || JOB_LIST_DEFAULTS.jobSubtypeFilter,
    yearFilter: params.get('y') || JOB_LIST_DEFAULTS.yearFilter,
    recruiterFilter: params.get('r') || JOB_LIST_DEFAULTS.recruiterFilter,
    screenerFilter: params.get('sc') || JOB_LIST_DEFAULTS.screenerFilter,
    oplFilter: params.get('opl') || JOB_LIST_DEFAULTS.oplFilter,
    urgencyFilter: URGENCY_VALUES.has(urgencyNormalized) ? urgencyNormalized : JOB_LIST_DEFAULTS.urgencyFilter,
    noteFilter: NOTE_VALUES.has(noteRaw) ? noteRaw : JOB_LIST_DEFAULTS.noteFilter,
    replacementFilter: REPLACEMENT_VALUES.has(replacementRaw)
      ? replacementRaw
      : JOB_LIST_DEFAULTS.replacementFilter,
    ageDaysFilter: AGE_DAYS_VALUES.has(ageNormalized) ? ageNormalized : JOB_LIST_DEFAULTS.ageDaysFilter,
    sort: SORT_VALUES.has(sortRaw) ? sortRaw : JOB_LIST_DEFAULTS.sort,
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
  if (state.yearFilter !== JOB_LIST_DEFAULTS.yearFilter) params.set('y', state.yearFilter);
  if (state.recruiterFilter !== JOB_LIST_DEFAULTS.recruiterFilter) params.set('r', state.recruiterFilter);
  if (state.screenerFilter !== JOB_LIST_DEFAULTS.screenerFilter) params.set('sc', state.screenerFilter);
  if (state.oplFilter !== JOB_LIST_DEFAULTS.oplFilter) params.set('opl', state.oplFilter);
  if (state.urgencyFilter !== JOB_LIST_DEFAULTS.urgencyFilter) params.set('urg', state.urgencyFilter);
  if (state.noteFilter !== JOB_LIST_DEFAULTS.noteFilter) params.set('nf', state.noteFilter);
  if (state.replacementFilter !== JOB_LIST_DEFAULTS.replacementFilter) {
    params.set('sr', state.replacementFilter);
  }
  if (state.ageDaysFilter !== JOB_LIST_DEFAULTS.ageDaysFilter) params.set('ag', state.ageDaysFilter);
  if (state.sort !== JOB_LIST_DEFAULTS.sort) params.set('sort', state.sort);
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
  'yearFilter',
  'recruiterFilter',
  'screenerFilter',
  'oplFilter',
  'urgencyFilter',
  'noteFilter',
  'replacementFilter',
  'ageDaysFilter',
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
