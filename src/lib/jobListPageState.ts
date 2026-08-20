import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, type PageSizeOption } from '@/lib/pagination';
import type { AgeDaysFilter, JobListSort, NoteFilter, ReplacementFilter, UrgencyFilter } from '@/lib/jobUrgency';
import {
  parseTableSort,
  serializeTableSort,
  type JobListTableSort,
} from '@/lib/jobListTableSort';
import {
  isUnitRequestWorkStatus,
  type UnitRequestWorkStatus,
} from '@/lib/unitRequestWorkStatus';

export type JobListFilter = 'all' | 'active' | 'closed';
/** ทุกตัวกรองด้านล่างเลือกหลายค่าพร้อมกันได้ — [] = ทั้งหมด (ไม่เก็บ token 'all') */
export type JobListWorkStatusFilter = UnitRequestWorkStatus[];
export type JobListAgeDaysFilter = Exclude<AgeDaysFilter, 'all'>[];
export type JobListUrgencyFilter = Exclude<UrgencyFilter, 'all'>[];
export type JobListNoteFilter = Exclude<NoteFilter, 'all'>[];
export type JobListReplacementFilter = Exclude<ReplacementFilter, 'all'>[];

export type JobListPageState = {
  filter: JobListFilter;
  search: string;
  unitFilter: string[];
  departmentFilter: string[];
  jobSubtypeFilter: string[];
  recruiterFilter: string[];
  screenerFilter: string[];
  oplFilter: string[];
  urgencyFilter: JobListUrgencyFilter;
  workStatusFilter: JobListWorkStatusFilter;
  noteFilter: JobListNoteFilter;
  replacementFilter: JobListReplacementFilter;
  ageDaysFilter: JobListAgeDaysFilter;
  sort: JobListSort;
  /**
   * เรียงจาก**การกดหัวคอลัมน์** — null = ใช้ `sort` (dropdown) ตามเดิม
   * 🔴 มีค่าแล้ว **ทับ dropdown** เพื่อให้มีตัวเรียงที่ทำงานจริงทีละหนึ่งตัว
   * (สองตัวเรียงพร้อมกัน = คนอ่านไม่รู้ว่าอันไหนมีผล)
   */
  tableSort: JobListTableSort | null;
  page: number;
  pageSize: PageSizeOption;
};

export const JOB_LIST_DEFAULTS: JobListPageState = {
  filter: 'all',
  search: '',
  unitFilter: [],
  departmentFilter: [],
  jobSubtypeFilter: [],
  recruiterFilter: [],
  screenerFilter: [],
  oplFilter: [],
  urgencyFilter: [],
  workStatusFilter: [],
  noteFilter: [],
  replacementFilter: [],
  ageDaysFilter: [],
  sort: 'assignee_age',
  tableSort: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

const FILTER_VALUES = new Set<JobListFilter>(['all', 'active', 'closed']);
const URGENCY_VALUES = new Set<string>(['retroactive', 'urgent', 'advance']);
const NOTE_VALUES = new Set<string>(['has', 'empty']);
const REPLACEMENT_VALUES = new Set<string>(['send', 'no_send', 'unset']);
const AGE_DAYS_MULTI_VALUES = new Set<string>(['advance', 'today', '1-7', '8-15', '16-30', '30+']);

function normalizeAgeToken(raw: string): string {
  const t = raw.trim();
  if (t === '8-14') return '8-15';
  if (t === '15-30') return '16-30';
  return t;
}

/** urgency เก่าบางลิงก์ใช้ overdue/escalated — map มาเป็น advance */
function normalizeUrgencyToken(raw: string): string {
  const t = raw.trim();
  return t === 'overdue' || t === 'escalated' ? 'advance' : t;
}

/**
 * แตกค่าหลายตัวจาก query — รองรับลิงก์เก่าที่เป็นค่าเดี่ยว (d=DS) และค่าใหม่ (d=DS,LM)
 * 'all' และค่าว่างถูกตัดทิ้ง เพราะ [] แปลว่าทั้งหมดอยู่แล้ว
 */
function parseMulti(
  raw: string | null,
  opts?: { allowed?: Set<string>; normalize?: (token: string) => string },
): string[] {
  const out: string[] = [];
  for (const token of (raw || '').split(',')) {
    const v = (opts?.normalize ? opts.normalize(token) : token.trim());
    if (!v || v === 'all' || out.includes(v)) continue;
    if (opts?.allowed && !opts.allowed.has(v)) continue;
    out.push(v);
  }
  return out;
}

function parsePageSize(raw: string | null): PageSizeOption {
  const n = Number(raw);
  return PAGE_SIZE_OPTIONS.includes(n as PageSizeOption) ? (n as PageSizeOption) : DEFAULT_PAGE_SIZE;
}

const SORT_VALUES = new Set<JobListSort>(['assignee_age', 'age_desc', 'age_asc', 'newest', 'oldest']);

export function parseJobListSearchParams(params: URLSearchParams): JobListPageState {
  const filterRaw = params.get('f') || JOB_LIST_DEFAULTS.filter;
  const filter = FILTER_VALUES.has(filterRaw as JobListFilter)
    ? (filterRaw as JobListFilter)
    : JOB_LIST_DEFAULTS.filter;

  const pageRaw = Number(params.get('p') || '1');
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.trunc(pageRaw) : 1;

  const sortRaw = (params.get('sort') || JOB_LIST_DEFAULTS.sort) as JobListSort;

  return {
    filter,
    search: params.get('q') ?? JOB_LIST_DEFAULTS.search,
    unitFilter: parseMulti(params.get('u')),
    departmentFilter: parseMulti(params.get('d')),
    jobSubtypeFilter: parseMulti(params.get('st')),
    recruiterFilter: parseMulti(params.get('r')),
    screenerFilter: parseMulti(params.get('sc')),
    oplFilter: parseMulti(params.get('opl')),
    urgencyFilter: parseMulti(params.get('urg'), {
      allowed: URGENCY_VALUES,
      normalize: normalizeUrgencyToken,
    }) as JobListUrgencyFilter,
    workStatusFilter: (params.get('ws') || '')
      .split(',')
      .map((t) => t.trim())
      .filter(isUnitRequestWorkStatus),
    noteFilter: parseMulti(params.get('nf'), { allowed: NOTE_VALUES }) as JobListNoteFilter,
    replacementFilter: parseMulti(params.get('sr'), {
      allowed: REPLACEMENT_VALUES,
    }) as JobListReplacementFilter,
    ageDaysFilter: parseMulti(params.get('ag'), {
      allowed: AGE_DAYS_MULTI_VALUES,
      normalize: normalizeAgeToken,
    }) as JobListAgeDaysFilter,
    sort: SORT_VALUES.has(sortRaw) ? sortRaw : JOB_LIST_DEFAULTS.sort,
    // `tsort=<column>:<dir>` — ค่าที่ parse ไม่ผ่านคืน null (กลับไปใช้ dropdown) ไม่ throw
    tableSort: parseTableSort(params.get('tsort')),
    page,
    pageSize: parsePageSize(params.get('ps')),
  };
}

export function buildJobListSearchParams(state: JobListPageState): URLSearchParams {
  const params = new URLSearchParams();
  const setMulti = (key: string, values: readonly string[]) => {
    if (values.length > 0) params.set(key, values.join(','));
  };

  if (state.filter !== JOB_LIST_DEFAULTS.filter) params.set('f', state.filter);
  if (state.search.trim()) params.set('q', state.search.trim());
  setMulti('u', state.unitFilter);
  setMulti('d', state.departmentFilter);
  setMulti('st', state.jobSubtypeFilter);
  setMulti('r', state.recruiterFilter);
  setMulti('sc', state.screenerFilter);
  setMulti('opl', state.oplFilter);
  setMulti('urg', state.urgencyFilter);
  setMulti('ws', state.workStatusFilter);
  setMulti('nf', state.noteFilter);
  setMulti('sr', state.replacementFilter);
  setMulti('ag', state.ageDaysFilter);
  if (state.sort !== JOB_LIST_DEFAULTS.sort) params.set('sort', state.sort);
  const tsort = serializeTableSort(state.tableSort);
  if (tsort) params.set('tsort', tsort);
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
  'oplFilter',
  'urgencyFilter',
  'workStatusFilter',
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
