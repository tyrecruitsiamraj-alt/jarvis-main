import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import SearchField from '@/components/shared/SearchField';
import { FilterSelect } from '@/components/shared/FilterSelect';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest, shouldOpenInNewTabFromEvent } from '@/lib/jobNavigation';
import { RefreshCw } from 'lucide-react';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import UnitRequestReplacementBadge from '@/components/jobs/UnitRequestReplacementBadge';
import { UnitRequestNotePreview } from '@/components/jobs/UnitRequestNoteField';
import { UnitRequestWorkStatusBadge } from '@/components/jobs/UnitRequestWorkStatusField';
import { formatYmdDmyBe } from '@/lib/dateTh';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import {
  AGE_DAYS_FILTER_OPTIONS,
  compareJobsForListSort,
  getJobRequestAgeLabel,
  getJobRequestSubmittedDate,
  JOB_LIST_SORT_OPTIONS,
  matchesAgeDaysFilter,
  matchesNoteFilter,
  matchesReplacementFilter,
  matchesUrgencyFilter,
  REPLACEMENT_FILTER_OPTIONS,
  URGENCY_FILTER_OPTIONS,
} from '@/lib/jobUrgency';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { buildRecruiterNameOptions, buildScreenerNameOptions, buildOplNameOptions, countJobsByStaffName, countUnassignedRecruiters, countUnassignedScreeners, countUnassignedOpls, matchesRecruiterFilter, matchesScreenerFilter, matchesOplFilter, STAFF_ASSIGNEE_UNASSIGNED, STAFF_ASSIGNEE_UNASSIGNED_LABEL } from '@/lib/jobStaffNames';
import {
  departmentFilterOptions,
  filterUnitRequestsByDepartment,
  extractJobSubtypeLabel,
  filterUnitRequestsByJobSubtype,
  jobSubtypeFilterOptions,
  filterUnitRequestsByYear,
  yearFilterOptions,
} from '@/lib/siamrajUnitFilters';
import {
  groupedUnitFilterOptions,
  matchesUnitOrganizationFilter,
  unitOrganizationKey,
} from '@/lib/unitGroupName';
import ListPaginationBar from '@/components/shared/ListPaginationBar';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchSiamrajUnitRequest } from '@/lib/siamrajUnitRequestsApi';
import { requestNoMatchesSearch } from '@/lib/siamrajRequestNo';
import { getTotalPages } from '@/lib/pagination';
import {
  buildJobListSearchParams,
  jobListReturnTo,
  mergeJobListState,
  parseJobListSearchParams,
} from '@/lib/jobListPageState';
import { saveJobListLastUrl, saveUnitLastPath } from '@/lib/jobUnitSessionState';

const OPEN_IN_NEW_TAB_KEY = 'jarvis.unitRequest.openInNewTab';

function loadOpenInNewTabPref(): boolean {
  try {
    return localStorage.getItem(OPEN_IN_NEW_TAB_KEY) === '1';
  } catch {
    return false;
  }
}

function saveOpenInNewTabPref(value: boolean) {
  try {
    localStorage.setItem(OPEN_IN_NEW_TAB_KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function formatSubmittedDate(job: JobRequest): string {
  const d = getJobRequestSubmittedDate(job);
  if (!d) return '—';
  return formatYmdDmyBe(d.toISOString().slice(0, 10));
}

function ageDaysLabel(job: JobRequest): string {
  return getJobRequestAgeLabel(job);
}

const SIAMRAJ_REQUEST_NO_RE = /^[a-z]{2,4}\d{4,}$/i;

function looksLikeSiamrajRequestNo(value: string): boolean {
  return SIAMRAJ_REQUEST_NO_RE.test(value.trim());
}

const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const listState = useMemo(() => parseJobListSearchParams(searchParams), [searchParams]);
  const {
    filter,
    search,
    unitFilter,
    departmentFilter,
    jobSubtypeFilter,
    yearFilter,
    recruiterFilter,
    screenerFilter,
    oplFilter,
    urgencyFilter,
    noteFilter,
    replacementFilter,
    ageDaysFilter,
    sort,
    page,
    pageSize,
  } = listState;

  const returnTo = jobListReturnTo(location.pathname, location.search);
  const [openInNewTab, setOpenInNewTab] = useState(loadOpenInNewTabPref);

  const openJob = useCallback(
    (job: JobRequest, e?: { metaKey: boolean; ctrlKey: boolean; button: number; altKey?: boolean }) => {
      const newTab = openInNewTab || (e ? shouldOpenInNewTabFromEvent(e) : false);
      navigateToUnitRequest(job, navigate, { returnTo, openInNewTab: newTab });
    },
    [navigate, returnTo, openInNewTab],
  );

  const updateListState = useCallback(
    (patch: Partial<typeof listState>) => {
      const next = mergeJobListState(listState, patch);
      setSearchParams(buildJobListSearchParams(next), { replace: true });
    },
    [listState, setSearchParams],
  );

  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [lookupJob, setLookupJob] = useState<JobRequest | null>(null);
  const { jobs, loading, refreshing, siamrajPrimary, loadError, refetch } = useUnitRequestsFeed();

  useEffect(() => {
    saveUnitLastPath('/jobs/list');
    if (location.search) {
      saveJobListLastUrl(`${location.pathname}${location.search}`);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (!siamrajPrimary) {
      setLookupJob(null);
      return;
    }
    const q = search.trim();
    if (!looksLikeSiamrajRequestNo(q)) {
      setLookupJob(null);
      return;
    }
    let cancelled = false;
    void fetchSiamrajUnitRequest(q)
      .then((job) => {
        if (!cancelled) setLookupJob(job);
      })
      .catch(() => {
        if (!cancelled) setLookupJob(null);
      });
    return () => {
      cancelled = true;
    };
  }, [search, siamrajPrimary]);

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

  const departmentOptions = useMemo(
    () => (siamrajPrimary ? departmentFilterOptions(jobs) : []),
    [jobs, siamrajPrimary],
  );

  const departmentScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByDepartment(jobs, departmentFilter) : jobs),
    [jobs, siamrajPrimary, departmentFilter],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(departmentScopedJobs) : []),
    [departmentScopedJobs, siamrajPrimary],
  );

  const subtypeScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByJobSubtype(departmentScopedJobs, jobSubtypeFilter) : departmentScopedJobs),
    [departmentScopedJobs, siamrajPrimary, jobSubtypeFilter],
  );

  const yearOptions = useMemo(
    () => (siamrajPrimary ? yearFilterOptions(subtypeScopedJobs) : []),
    [subtypeScopedJobs, siamrajPrimary],
  );

  const scopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByYear(subtypeScopedJobs, yearFilter) : subtypeScopedJobs),
    [subtypeScopedJobs, siamrajPrimary, yearFilter],
  );

  const unitOptions = useMemo(
    () => groupedUnitFilterOptions(scopedJobs),
    [scopedJobs],
  );

  const unitScopeNames = useMemo(
    () => scopedJobs.map((j) => j.unit_name),
    [scopedJobs],
  );

  const recruiterFilterScope = useMemo(() => {
    return scopedJobs.filter((j) => {
      if (unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesScreenerFilter(j, screenerFilter)) return false;
      if (!matchesOplFilter(j, oplFilter)) return false;
      return true;
    });
  }, [scopedJobs, unitFilter, screenerFilter, oplFilter, unitScopeNames]);

  const screenerFilterScope = useMemo(() => {
    return scopedJobs.filter((j) => {
      if (unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesRecruiterFilter(j, recruiterFilter)) return false;
      if (!matchesOplFilter(j, oplFilter)) return false;
      return true;
    });
  }, [scopedJobs, unitFilter, recruiterFilter, oplFilter, unitScopeNames]);

  const oplFilterScope = useMemo(() => {
    return scopedJobs.filter((j) => {
      if (unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesRecruiterFilter(j, recruiterFilter)) return false;
      if (!matchesScreenerFilter(j, screenerFilter)) return false;
      return true;
    });
  }, [scopedJobs, unitFilter, recruiterFilter, screenerFilter, unitScopeNames]);

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

  const recruiterCounts = useMemo(
    () => countJobsByStaffName(recruiterFilterScope, 'recruiter_name'),
    [recruiterFilterScope],
  );

  const screenerCounts = useMemo(
    () => countJobsByStaffName(screenerFilterScope, 'screener_name'),
    [screenerFilterScope],
  );

  const oplCounts = useMemo(
    () => countJobsByStaffName(oplFilterScope, 'opl_name'),
    [oplFilterScope],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();

    const pool = (() => {
      if (!lookupJob || !q) return scopedJobs;
      const lookupNo = (lookupJob.request_no || '').toLowerCase();
      if (!requestNoMatchesSearch(q, lookupJob.request_no)) return scopedJobs;
      if (scopedJobs.some((j) => (j.request_no || '').toLowerCase() === lookupNo)) {
        return scopedJobs;
      }
      return [...scopedJobs, lookupJob];
    })();

    return pool
      .filter((j) => {
        if (unitFilter !== 'all' && !matchesUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
        if (!matchesRecruiterFilter(j, recruiterFilter)) return false;
        if (!matchesScreenerFilter(j, screenerFilter)) return false;
        if (!matchesOplFilter(j, oplFilter)) return false;
        if (!matchesUrgencyFilter(j, urgencyFilter)) return false;
      if (!matchesNoteFilter(j, noteFilter)) return false;
      if (!matchesReplacementFilter(j, replacementFilter)) return false;
      if (!matchesAgeDaysFilter(j, ageDaysFilter)) return false;
        if (filter === 'all') return true;
        if (filter === 'closed') return j.status === 'closed';
        return j.status !== 'closed';
      })
      .filter((j) => {
        if (requestNoMatchesSearch(q, j.request_no)) return true;
        return `${j.unit_name} ${j.request_no || ''} ${j.department_code || ''} ${j.department_name || ''} ${j.location_address} ${j.request_action_name || ''} ${j.job_description_code_1 || ''} ${j.job_description_code_2 || ''} ${j.list_note || ''} ${JOB_TYPE_LABELS[j.job_type]} ${JOB_CATEGORY_LABELS[j.job_category]} ${j.resigned_employee_name || ''} ${j.submittedByName || ''} ${j.recruiter_name || ''} ${j.screener_name || ''} ${j.opl_name || ''}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => compareJobsForListSort(a, b, sort));
  }, [scopedJobs, filter, search, unitFilter, recruiterFilter, screenerFilter, oplFilter, urgencyFilter, noteFilter, replacementFilter, ageDaysFilter, sort, unitScopeNames, lookupJob]);

  const totalPages = getTotalPages(filtered.length, pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    if (jobSubtypeFilter === 'all') return;
    const stillValid = jobSubtypeOptions.some((o) => o.value === jobSubtypeFilter);
    if (!stillValid) updateListState({ jobSubtypeFilter: 'all' });
  }, [departmentFilter, jobSubtypeOptions, jobSubtypeFilter, updateListState]);

  useEffect(() => {
    if (yearFilter === 'all') return;
    const stillValid = yearOptions.some((o) => o.value === yearFilter);
    if (!stillValid) updateListState({ yearFilter: 'all' });
  }, [departmentFilter, jobSubtypeFilter, yearOptions, yearFilter, updateListState]);

  useEffect(() => {
    if (unitFilter === 'all') return;
    if (unitFilter === 'all') return;
    const stillValid = unitOptions.some(
      (o) => unitOrganizationKey(o) === unitOrganizationKey(unitFilter),
    );
    if (!stillValid) updateListState({ unitFilter: 'all' });
  }, [departmentFilter, jobSubtypeFilter, unitOptions, unitFilter, updateListState]);

  useEffect(() => {
    if (page > totalPages) updateListState({ page: totalPages });
  }, [page, totalPages, updateListState]);

  const pageFrom = filtered.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageTo = Math.min(page * pageSize, filtered.length);

  return (
    <div>
      <PageHeader
        title="หน่วยงาน"
        subtitle={
          siamrajPrimary
            ? filtered.length > 0
              ? `${filtered.length} ใบขอจาก Siamraj · แสดง ${pageFrom}–${pageTo}`
              : '0 ใบขอจาก Siamraj'
            : filtered.length > 0
              ? `${filtered.length} งาน · แสดง ${pageFrom}–${pageTo}`
              : '0 งาน'
        }
        backPath="/"
        actions={
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 rounded-full border border-white/70 bg-white/50 text-sm disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            รีเฟรช
          </button>
        }
      />

      <div className="px-4 md:px-6 space-y-4">
        {loadError && (
          <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {loadError}
          </div>
        )}

        <div className="rounded-2xl border border-black/[0.06] bg-white/35 backdrop-blur-sm p-3 md:p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="job-list-search" className="text-xs text-muted-foreground leading-snug">
              ค้นหา
            </label>
            <SearchField
              id="job-list-search"
              compact
              type="text"
              placeholder="เลขที่ใบขอ, หน่วยงาน, ผู้รับผิดชอบ..."
              value={search}
              onChange={(e) => updateListState({ search: e.target.value })}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { value: 'all' as const, label: 'ทั้งหมด' },
              { value: 'active' as const, label: 'ดำเนินการ' },
              { value: 'closed' as const, label: 'ปิดแล้ว' },
            ].map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => updateListState({ filter: f.value })}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                  filter === f.value ? 'bg-primary text-primary-foreground' : 'bg-secondary/80 text-muted-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-border"
              checked={openInNewTab}
              onChange={(e) => {
                const next = e.target.checked;
                setOpenInNewTab(next);
                saveOpenInNewTabPref(next);
              }}
            />
            เปิดใบขอในแท็บใหม่
            <span className="text-[10px] text-muted-foreground/80">(หรือ Ctrl/⌘+คลิก)</span>
          </label>

          <div
            className={cn(
              'grid gap-3',
              siamrajPrimary ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
          {siamrajPrimary ? (
            <FilterSelect
              id="job-list-department"
              label="แผนก"
              value={departmentFilter}
              onChange={(v) => updateListState({ departmentFilter: v })}
            >
              {departmentOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          ) : null}

          {siamrajPrimary ? (
            <FilterSelect
              id="job-list-subtype"
              label="ลักษณะงานย่อย"
              value={jobSubtypeFilter}
              onChange={(v) => updateListState({ jobSubtypeFilter: v })}
            >
              {jobSubtypeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          ) : null}

          {siamrajPrimary ? (
            <FilterSelect
              id="job-list-year"
              label="ปี (พ.ศ.)"
              value={yearFilter}
              onChange={(v) => updateListState({ yearFilter: v })}
            >
              {yearOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </FilterSelect>
          ) : null}

          <FilterSelect
            id="job-list-recruiter"
            label="เจ้าหน้าที่สรรหา"
            value={recruiterFilter}
            onChange={(v) => updateListState({ recruiterFilter: v })}
          >
            <option value="all">ทั้งหมด</option>
            <option value={STAFF_ASSIGNEE_UNASSIGNED}>
              {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedRecruiterCount})
            </option>
            {recruiters.map((r) => (
              <option key={r} value={r}>
                {r} ({recruiterCounts.get(r) ?? 0})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-screener"
            label="เจ้าหน้าที่คัดสรร"
            value={screenerFilter}
            onChange={(v) => updateListState({ screenerFilter: v })}
          >
            <option value="all">ทั้งหมด</option>
            <option value={STAFF_ASSIGNEE_UNASSIGNED}>
              {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedScreenerCount})
            </option>
            {screeners.map((s) => (
              <option key={s} value={s}>
                {s} ({screenerCounts.get(s) ?? 0})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-opl"
            label="เจ้าหน้าที่ OPL"
            value={oplFilter}
            onChange={(v) => updateListState({ oplFilter: v })}
          >
            <option value="all">ทั้งหมด</option>
            <option value={STAFF_ASSIGNEE_UNASSIGNED}>
              {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedOplCount})
            </option>
            {opls.map((n) => (
              <option key={n} value={n}>
                {n} ({oplCounts.get(n) ?? 0})
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-urgency"
            label="สถานะใบขอ"
            value={urgencyFilter}
            onChange={(v) => updateListState({ urgencyFilter: v as typeof urgencyFilter })}
          >
            {URGENCY_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} title={o.hint}>
                {o.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-note-filter"
            label="หมายเหตุ"
            value={noteFilter}
            onChange={(v) => updateListState({ noteFilter: v as typeof noteFilter })}
          >
            <option value="all">ทั้งหมด</option>
            <option value="has">มีหมายเหตุ</option>
            <option value="empty">ไม่มีหมายเหตุ</option>
          </FilterSelect>

          <FilterSelect
            id="job-list-replacement-filter"
            label="ส่งคนแทน"
            value={replacementFilter}
            onChange={(v) => updateListState({ replacementFilter: v as typeof replacementFilter })}
          >
            {REPLACEMENT_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-age"
            label="วันผ่านมา"
            value={ageDaysFilter}
            onChange={(v) => updateListState({ ageDaysFilter: v as typeof ageDaysFilter })}
          >
            {AGE_DAYS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            id="job-list-sort"
            label="เรียงลำดับ"
            value={sort}
            onChange={(v) => updateListState({ sort: v as typeof sort })}
          >
            {JOB_LIST_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
          </div>
        </div>

        {loading ? (
          isMobile ? (
            // ─── Mobile skeleton cards ───────────────────────────────────────
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass-card rounded-[1.5rem] p-4 border border-white/70 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-48" />
                  <Skeleton className="h-3 w-40" />
                  <div className="grid grid-cols-2 gap-1 pt-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // ─── Desktop skeleton table ──────────────────────────────────────
            <div className="glass-card rounded-xl border border-border overflow-x-auto">
              <table className="w-full text-sm min-w-[1080px]">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">เลขที่ใบขอ</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผ่านมา</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">หน่วยงาน</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่กรอก</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่ต้องการ</th>
                    <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">คงเหลือ</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ประเภทใบขอ</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ตำแหน่ง</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ลักษณะงานย่อย</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้ลาออก</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้รับผิดชอบ</th>
                    <th className="px-3 py-3 text-left text-muted-foreground font-medium min-w-[180px]">หมายเหตุ</th>
                    <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">ส่งคนแทน</th>
                    <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">สถานะทำงาน</th>
                    <th className="px-3 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">รายได้</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-36" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-3 py-3 text-center"><Skeleton className="h-3 w-6 mx-auto" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-24" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-20" /></td>
                      <td className="px-3 py-3 space-y-1">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-32" /></td>
                      <td className="px-3 py-3 text-center"><Skeleton className="h-5 w-14 rounded-full mx-auto" /></td>
                      <td className="px-3 py-3 text-center"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></td>
                      <td className="px-3 py-3 text-right"><Skeleton className="h-3 w-16 ml-auto" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">ไม่พบใบขอ</div>
        ) : isMobile ? (
          <div className={cn('space-y-3', refreshing && 'opacity-50 pointer-events-none transition-opacity')}>
            {paginated.map((j) => (
              <div
                key={j.id}
                className="glass-card rounded-[1.5rem] p-4 border border-white/70"
              >
                <button
                  type="button"
                  onClick={(e) => openJob(j, e)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-semibold text-foreground text-sm">
                      {j.request_no || j.unit_name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground whitespace-nowrap">
                        ผ่านมา {ageDaysLabel(j)}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs font-medium text-foreground/90">{j.unit_name}</div>

                  <div className="text-xs text-muted-foreground mt-1">
                    {j.request_action_name || JOB_TYPE_LABELS[j.job_type]}
                    {j.job_description_code_1 ? ` • ${j.job_description_code_1}` : ''}
                    {j.job_description_code_2 ? ` • ${j.job_description_code_2}` : ''}
                    {j.resigned_employee_name ? ` • ${j.resigned_employee_name}` : ''}
                  </div>

                  <div className="text-xs text-muted-foreground mt-1 grid gap-0.5">
                    <span>วันที่กรอก: {formatSubmittedDate(j)}</span>
                    <span>วันที่ต้องการ: {formatYmdDmyBe(j.required_date)}</span>
                    <span>
                      ตำแหน่ง: ขอ {j.request_positions ?? jobPositionUnits(j)}
                      {j.filled_positions != null ? ` · หาได้ ${j.filled_positions}` : ''}
                      {' · คงเหลือ '}
                      {jobPositionUnits(j)}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground mt-1">{j.location_address}</div>

                  {(j.recruiter_name || j.screener_name || j.opl_name) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      ผู้รับผิดชอบ:{' '}
                      {[
                        j.opl_name ? `OPL ${j.opl_name}` : null,
                        j.recruiter_name ? `สรรหา ${j.recruiter_name}` : null,
                        j.screener_name ? `คัดสรร ${j.screener_name}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-2 text-xs gap-2">
                    <span className="text-primary">฿{j.total_income.toLocaleString()}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <UnitRequestReplacementBadge value={j.send_replacement} compact />
                      <UnitRequestWorkStatusBadge
                        status={j.work_status}
                        firstName={j.work_person_first_name}
                        lastName={j.work_person_last_name}
                        compact
                      />
                      <JobUrgencyBadge job={j} />
                    </div>
                  </div>
                </button>

                {j.list_note?.trim() ? (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-1">หมายเหตุ</p>
                    <UnitRequestNotePreview note={j.list_note} />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className={cn('glass-card rounded-xl border border-border overflow-x-auto', refreshing && 'opacity-50 pointer-events-none transition-opacity')}>
            <table className="w-full text-sm min-w-[1080px]">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">เลขที่ใบขอ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผ่านมา</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">หน่วยงาน</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่กรอก</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">วันที่ต้องการ</th>
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">คงเหลือ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ประเภทใบขอ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ตำแหน่ง</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ลักษณะงานย่อย</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้ลาออก</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium whitespace-nowrap">ผู้รับผิดชอบ</th>
                  <th className="px-3 py-3 text-left text-muted-foreground font-medium min-w-[180px]">หมายเหตุ</th>
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">ส่งคนแทน</th>
                  <th className="px-3 py-3 text-center text-muted-foreground font-medium whitespace-nowrap">สถานะทำงาน</th>
                  <th className="px-3 py-3 text-right text-muted-foreground font-medium whitespace-nowrap">รายได้</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((j) => (
                  <tr
                    key={j.id}
                    onClick={(e) => openJob(j, e)}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        openJob(j, e);
                      }
                    }}
                    className="border-b border-border/50 hover:bg-secondary/20 cursor-pointer"
                  >
                    <td className="px-3 py-3 font-medium text-foreground whitespace-nowrap">{j.request_no || '—'}</td>
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {ageDaysLabel(j)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-foreground text-xs">{j.unit_name || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatSubmittedDate(j)}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs whitespace-nowrap">{formatYmdDmyBe(j.required_date)}</td>
                    <td className="px-3 py-3 text-center text-foreground text-xs tabular-nums whitespace-nowrap">
                      {jobPositionUnits(j)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.request_action_name || JOB_TYPE_LABELS[j.job_type]}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.job_description_code_1 || '—'}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{extractJobSubtypeLabel(j)}</td>
                    <td className="px-3 py-3 text-muted-foreground text-xs">{j.resigned_employee_name || '—'}</td>
                    <td className="px-3 py-3">
                      {j.recruiter_name || j.screener_name || j.opl_name ? (
                        <div className="text-xs leading-tight whitespace-nowrap">
                          <div>
                            <span className="text-muted-foreground">OPL </span>
                            {j.opl_name || '—'}
                          </div>
                          <div>
                            <span className="text-muted-foreground">สรรหา </span>
                            {j.recruiter_name || '—'}
                          </div>
                          <div>
                            <span className="text-muted-foreground">คัดสรร </span>
                            {j.screener_name || '—'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <UnitRequestNotePreview note={j.list_note} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <UnitRequestReplacementBadge value={j.send_replacement} compact />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <UnitRequestWorkStatusBadge
                          status={j.work_status}
                          firstName={j.work_person_first_name}
                          lastName={j.work_person_last_name}
                          compact
                        />
                        <JobUrgencyBadge job={j} compact />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right text-foreground whitespace-nowrap">฿{j.total_income.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 ? (
          <ListPaginationBar
            page={page}
            pageSize={pageSize}
            totalItems={filtered.length}
            totalPages={totalPages}
            pageFrom={pageFrom}
            pageTo={pageTo}
            onPageChange={(nextPage) => updateListState({ page: nextPage })}
            onPageSizeChange={(nextSize) => updateListState({ pageSize: nextSize })}
          />
        ) : null}
      </div>
    </div>
  );
};

export default JobListPage;
