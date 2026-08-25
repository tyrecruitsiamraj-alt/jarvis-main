import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import UnitSectionTabs from '@/components/jobs/UnitSectionTabs';
import type { JobRequest } from '@/types';
import { JOB_TYPE_LABELS, JOB_CATEGORY_LABELS } from '@/types';
import SearchField from '@/components/shared/SearchField';
import { FilterSelect } from '@/components/shared/FilterSelect';
import { FilterMultiSelect } from '@/components/shared/FilterMultiSelect';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { navigateToUnitRequest, shouldOpenInNewTabFromEvent } from '@/lib/jobNavigation';
import { ChevronDown, RefreshCw } from 'lucide-react';
import JobUrgencyBadge from '@/components/jobs/JobUrgencyBadge';
import UnitRequestReplacementBadge from '@/components/jobs/UnitRequestReplacementBadge';
import PrequestBadge from '@/components/jobs/PrequestBadge';
import { UnitRequestNotePreview } from '@/components/jobs/UnitRequestNoteField';
import { UnitRequestWorkStatusBadge } from '@/components/jobs/UnitRequestWorkStatusField';
import UnitRequestDetailPanel from '@/components/jobs/UnitRequestDetailPanel';
import { detailSummary } from '@/lib/unitRequestDetail';
import {
  resolveUnitRequestWorkStatus,
  UNIT_REQUEST_WORK_STATUS_LABELS,
  UNIT_REQUEST_WORK_STATUS_OPTIONS,
} from '@/lib/unitRequestWorkStatus';
import { formatYmdDmyBe, toYmdBangkok } from '@/lib/dateTh';
import { DASH } from '@/lib/designTokens';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import {
  AGE_DAYS_MULTI_OPTIONS,
  compareJobsForListSort,
  getJobAgeChipInfo,
  JOB_AGE_CHIP_META,
  getJobRequestSubmittedDate,
  JOB_LIST_SORT_OPTIONS,
  matchesAnyAgeDaysFilter,
  matchesAnyNoteFilter,
  matchesAnyReplacementFilter,
  matchesAnyUrgencyFilter,
  REPLACEMENT_FILTER_OPTIONS,
  URGENCY_FILTER_OPTIONS,
} from '@/lib/jobUrgency';
import {
  compareJobsByTableColumn,
  JOB_LIST_TABLE_COLUMN_LABEL,
  toggleTableSort,
  type JobListTableColumn,
} from '@/lib/jobListTableSort';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { buildRecruiterNameOptions, buildScreenerNameOptions, buildOplNameOptions, countJobsByStaffName, countUnassignedRecruiters, countUnassignedScreeners, countUnassignedOpls, matchesAnyRecruiterFilter, matchesAnyScreenerFilter, matchesAnyOplFilter, STAFF_ASSIGNEE_UNASSIGNED, STAFF_ASSIGNEE_UNASSIGNED_LABEL } from '@/lib/jobStaffNames';
import {
  departmentFilterOptions,
  filterUnitRequestsByAnyDepartment,
  extractJobSubtypeLabel,
  filterUnitRequestsByAnyJobSubtype,
  jobSubtypeFilterOptions,
} from '@/lib/siamrajUnitFilters';
import {
  groupedUnitFilterOptions,
  matchesUnitOrganizationFilter,
  matchesAnyUnitOrganizationFilter,
  unitOrganizationKey,
} from '@/lib/unitGroupName';
import { cleanedAddressSummary } from '@/lib/districtMatch';
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

function formatSubmittedDate(job: JobRequest): string {
  const d = getJobRequestSubmittedDate(job);
  if (!d) return '—';
  // ตัดวันตามปฏิทินกรุงเทพ (เหมือน jobUrgency.submittedDateYmd) — toISOString (UTC) เลื่อน
  // ย้อน 1 วันทุกแถว ไม่ตรงกับหน้ารายละเอียดที่ใช้ formatYmdDmyBe(job.request_date) ตรง ๆ
  return formatYmdDmyBe(toYmdBangkok(d));
}

/**
 * ชิป「ผ่านมา」— ข้อความ + สี + tooltip มาจาก `getJobAgeChipInfo` **ที่เดียว**
 *
 * 🔴 **ห้ามแยกข้อความกับสีไปอ่านคนละฟังก์ชัน** (บั๊กเดิมที่เจ้าของทัก 19 ส.ค. 2569:
 * ข้อความว่า "ล่วงหน้า" แต่สีมาจากอายุที่นับวันจากวันที่กรอก → ใบล่วงหน้าได้สี "ด่วน"
 * ส้ม และ tooltip ขึ้นคำว่า "ด่วน" · *"ล่วงหน้าสีอะไรก็สีนั้น … มาทำล่วงหน้าหลาย ๆ สี
 * ให้งงทำไม"*) — ตอนนี้ใบล่วงหน้าเป็น**เขียวชุดเดียวเสมอ** ไม่ว่ากรอกไว้นานแค่ไหน
 *
 * `withPrefix` = การ์ดบนมือถือ (ไม่มีหัวคอลัมน์บอก) · ตารางไม่ต้องเพราะหัวคอลัมน์เขียนว่า "ผ่านมา"
 */
const JobAgeChip: React.FC<{ job: JobRequest; withPrefix?: boolean }> = ({ job, withPrefix }) => {
  const info = getJobAgeChipInfo(job);
  return (
    <span
      className={cn('jarvis-chip whitespace-nowrap', JOB_AGE_CHIP_META[info.level].chipCls)}
      title={info.title}
    >
      {withPrefix ? info.cardText : info.text}
    </span>
  );
};

const SIAMRAJ_REQUEST_NO_RE = /^[a-z]{2,4}\d{4,}$/i;

function looksLikeSiamrajRequestNo(value: string): boolean {
  return SIAMRAJ_REQUEST_NO_RE.test(value.trim());
}

const JobListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { user } = useAuth();
  /** admin เห็นทุกแผนก · คนอื่นที่มี department_code ถูกล็อกแผนก */
  const lockedDepartmentCode =
    user?.role !== 'admin' ? user?.department_code?.trim().toUpperCase() || null : null;

  const listState = useMemo(() => parseJobListSearchParams(searchParams), [searchParams]);
  const {
    filter,
    search,
    unitFilter,
    departmentFilter: departmentFilterRaw,
    jobSubtypeFilter,
    recruiterFilter,
    screenerFilter,
    oplFilter,
    urgencyFilter,
    workStatusFilter,
    noteFilter,
    replacementFilter,
    ageDaysFilter,
    sort,
    tableSort,
    page,
    pageSize,
  } = listState;
  // ต้อง memo — ถ้าสร้าง array ใหม่ทุก render จะทำให้ useMemo/useEffect ที่ผูกอยู่ด้านล่างรันไม่จบ
  const departmentFilter = useMemo(
    () => (lockedDepartmentCode ? [lockedDepartmentCode] : departmentFilterRaw),
    [lockedDepartmentCode, departmentFilterRaw],
  );

  const returnTo = jobListReturnTo(location.pathname, location.search);
  const openJob = useCallback(
    (job: JobRequest, e?: { metaKey: boolean; ctrlKey: boolean; button: number; altKey?: boolean }) => {
      // เปิดแท็บใหม่เฉพาะตอนกด Ctrl/⌘ หรือคลิกกลางเท่านั้น (ไม่มีค่า preference แล้ว)
      navigateToUnitRequest(job, navigate, {
        returnTo,
        openInNewTab: e ? shouldOpenInNewTabFromEvent(e) : false,
      });
    },
    [navigate, returnTo],
  );

  const updateListState = useCallback(
    (patch: Partial<typeof listState>) => {
      // ใช้รูปแบบฟังก์ชัน — merge จาก URL ล่าสุดเสมอ กันแก้หลายฟิลเตอร์ติด ๆ กันแล้วทับกันเอง
      setSearchParams(
        (prev) => buildJobListSearchParams(mergeJobListState(parseJobListSearchParams(prev), patch)),
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const [staffRosterRev, setStaffRosterRev] = useState(0);

  const [lookupJob, setLookupJob] = useState<JobRequest | null>(null);
  const { jobs, loading, refreshing, siamrajPrimary, loadError, refetch } = useUnitRequestsFeed();
  /**
   * แถวที่กางรายละเอียดอยู่ (เจ้าของสั่ง 25 ส.ค. 2569: *"กดลงมาค่อยเห็นข้อมูล"*)
   * เก็บเป็น Set ของ id — กางพร้อมกันหลายแถวได้ · ปิดหน้าแล้วลืม (ไม่ต้องจำข้ามหน้า)
   */
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const toggleExpanded = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    saveUnitLastPath('/jobs/list');
    saveJobListLastUrl(`${location.pathname}${location.search}`);
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
    () => (siamrajPrimary ? filterUnitRequestsByAnyDepartment(jobs, departmentFilter) : jobs),
    [jobs, siamrajPrimary, departmentFilter],
  );

  const jobSubtypeOptions = useMemo(
    () => (siamrajPrimary ? jobSubtypeFilterOptions(departmentScopedJobs) : []),
    [departmentScopedJobs, siamrajPrimary],
  );

  const subtypeScopedJobs = useMemo(
    () => (siamrajPrimary ? filterUnitRequestsByAnyJobSubtype(departmentScopedJobs, jobSubtypeFilter) : departmentScopedJobs),
    [departmentScopedJobs, siamrajPrimary, jobSubtypeFilter],
  );


  const scopedJobs = subtypeScopedJobs;

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
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesAnyScreenerFilter(j, screenerFilter)) return false;
      if (!matchesAnyOplFilter(j, oplFilter)) return false;
      return true;
    });
  }, [scopedJobs, unitFilter, screenerFilter, oplFilter, unitScopeNames]);

  const screenerFilterScope = useMemo(() => {
    return scopedJobs.filter((j) => {
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesAnyRecruiterFilter(j, recruiterFilter)) return false;
      if (!matchesAnyOplFilter(j, oplFilter)) return false;
      return true;
    });
  }, [scopedJobs, unitFilter, recruiterFilter, oplFilter, unitScopeNames]);

  const oplFilterScope = useMemo(() => {
    return scopedJobs.filter((j) => {
      if (!matchesAnyUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
      if (!matchesAnyRecruiterFilter(j, recruiterFilter)) return false;
      if (!matchesAnyScreenerFilter(j, screenerFilter)) return false;
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
        if (!matchesAnyUnitOrganizationFilter(j.unit_name, unitFilter, unitScopeNames)) return false;
        if (!matchesAnyRecruiterFilter(j, recruiterFilter)) return false;
        if (!matchesAnyScreenerFilter(j, screenerFilter)) return false;
        if (!matchesAnyOplFilter(j, oplFilter)) return false;
        if (!matchesAnyUrgencyFilter(j, urgencyFilter)) return false;
        if (
          workStatusFilter.length > 0 &&
          !workStatusFilter.includes(resolveUnitRequestWorkStatus(j.work_status))
        ) {
          return false;
        }
      if (!matchesAnyNoteFilter(j, noteFilter)) return false;
      if (!matchesAnyReplacementFilter(j, replacementFilter)) return false;
      if (!matchesAnyAgeDaysFilter(j, ageDaysFilter)) return false;
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
      // กดหัวคอลัมน์แล้วใช้อันนั้น (ทับ dropdown) — ไม่มีค่าก็ใช้ dropdown ตามเดิม
      .sort((a, b) =>
        tableSort
          ? compareJobsByTableColumn(a, b, tableSort)
          : compareJobsForListSort(a, b, sort),
      );
  }, [scopedJobs, filter, search, unitFilter, recruiterFilter, screenerFilter, oplFilter, urgencyFilter, workStatusFilter, noteFilter, replacementFilter, ageDaysFilter, sort, tableSort, unitScopeNames, lookupJob]);

  const totalPages = getTotalPages(filtered.length, pageSize);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  // เมื่อตัวเลือกเปลี่ยน (เช่นเปลี่ยนแผนก) ให้ตัดเฉพาะค่าที่เลือกไว้แล้วไม่มีอยู่แล้ว
  useEffect(() => {
    if (jobSubtypeFilter.length === 0) return;
    const valid = jobSubtypeFilter.filter((v) => jobSubtypeOptions.some((o) => o.value === v));
    if (valid.length !== jobSubtypeFilter.length) updateListState({ jobSubtypeFilter: valid });
  }, [departmentFilter, jobSubtypeOptions, jobSubtypeFilter, updateListState]);


  useEffect(() => {
    if (unitFilter.length === 0) return;
    const valid = unitFilter.filter((v) =>
      unitOptions.some((o) => unitOrganizationKey(o) === unitOrganizationKey(v)),
    );
    if (valid.length !== unitFilter.length) updateListState({ unitFilter: valid });
  }, [departmentFilter, jobSubtypeFilter, unitOptions, unitFilter, updateListState]);

  useEffect(() => {
    // don't clamp while the feed is still loading — filtered is momentarily empty
    // on mount (e.g. returning from a detail page), which would reset page 2 → 1
    if (loading) return;
    if (page > totalPages) updateListState({ page: totalPages });
  }, [loading, page, totalPages, updateListState]);

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
          // ช่องค้นหาอยู่คู่ปุ่มรีเฟรชบนหัวหน้า — ของที่ใช้บ่อยสุดอยู่ใกล้มือ ไม่ต้องเลื่อนหาในกล่องตัวกรอง
          <div className="flex flex-wrap items-center gap-2">
            {/* จอเล็กหดได้ ไม่ล็อกความกว้างตายตัว (จอ 320px เคยล้นออกไป) · จอใหญ่เท่าเดิม */}
            <div className="w-full min-w-0 max-w-[200px] sm:max-w-[280px]">
              <label htmlFor="job-list-search" className="sr-only">
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
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={refreshing}
              className="flex shrink-0 items-center gap-1 px-3 py-2 rounded-full border border-white/70 bg-white/50 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
              รีเฟรช
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-6">
        <UnitSectionTabs active="units" />
      </div>

      <div className="px-4 md:px-6 space-y-4">
        {loadError && (
          <div className="text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2">
            {loadError}
          </div>
        )}

        {/* ตัวกรองเป็นแถบบนเต็มความกว้าง — ช่องกรองครบทุกช่อง อยู่ในกริดเดียวกันหมด
            (ค้นหาย้ายขึ้นไปอยู่คู่ปุ่มรีเฟรชบนหัวหน้า · สถานะใบขอกลายเป็นช่องกรองตัวหนึ่ง) */}
        <div className={cn(DASH.cardLg, 'p-3 md:p-4')}>
          <div
            className={cn(
              'grid gap-3',
              siamrajPrimary ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2',
            )}
          >
          {/* สถานะใบขอ (ทั้งหมด/ดำเนินการ/ปิดแล้ว) — เดิมเป็นปุ่มลอย ย้ายมาเป็นช่องกรองตัวแรกของกริด */}
          <FilterSelect
            id="job-list-status"
            label="ใบขอเปิด / ปิด"
            value={filter}
            onChange={(v) => updateListState({ filter: v as typeof filter })}
          >
            <option value="all">ทั้งหมด</option>
            <option value="active">ดำเนินการ</option>
            <option value="closed">ปิดแล้ว</option>
          </FilterSelect>

          {siamrajPrimary ? (
            <FilterMultiSelect
              id="job-list-department"
              label={lockedDepartmentCode ? `แผนก (ล็อก ${lockedDepartmentCode})` : 'แผนก'}
              summaryNoun="แผนก"
              values={departmentFilter}
              disabled={Boolean(lockedDepartmentCode)}
              onChange={(v) => {
                if (lockedDepartmentCode) return;
                updateListState({ departmentFilter: v });
              }}
              options={
                lockedDepartmentCode
                  ? [{ value: lockedDepartmentCode, label: lockedDepartmentCode }]
                  : departmentOptions.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))
              }
            />
          ) : null}

          {siamrajPrimary ? (
            <FilterMultiSelect
              id="job-list-subtype"
              label="ลักษณะงานย่อย"
              summaryNoun="ลักษณะงาน"
              values={jobSubtypeFilter}
              onChange={(v) => updateListState({ jobSubtypeFilter: v })}
              options={jobSubtypeOptions.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
            />
          ) : null}


          <FilterMultiSelect
            id="job-list-recruiter"
            label="เจ้าหน้าที่สรรหา"
            summaryNoun="คน"
            values={recruiterFilter}
            onChange={(v) => updateListState({ recruiterFilter: v })}
            options={[
              {
                value: STAFF_ASSIGNEE_UNASSIGNED,
                label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedRecruiterCount})`,
              },
              ...recruiters.map((n) => ({ value: n, label: `${n} (${recruiterCounts.get(n) ?? 0})` })),
            ]}
          />

          <FilterMultiSelect
            id="job-list-screener"
            label="เจ้าหน้าที่คัดสรร"
            summaryNoun="คน"
            values={screenerFilter}
            onChange={(v) => updateListState({ screenerFilter: v })}
            options={[
              {
                value: STAFF_ASSIGNEE_UNASSIGNED,
                label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedScreenerCount})`,
              },
              ...screeners.map((n) => ({ value: n, label: `${n} (${screenerCounts.get(n) ?? 0})` })),
            ]}
          />

          <FilterMultiSelect
            id="job-list-opl"
            label="เจ้าหน้าที่ OPL"
            summaryNoun="คน"
            values={oplFilter}
            onChange={(v) => updateListState({ oplFilter: v })}
            options={[
              {
                value: STAFF_ASSIGNEE_UNASSIGNED,
                label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedOplCount})`,
              },
              ...opls.map((n) => ({ value: n, label: `${n} (${oplCounts.get(n) ?? 0})` })),
            ]}
          />

          <FilterMultiSelect
            id="job-list-urgency"
            label="สถานะใบขอ"
            summaryNoun="สถานะ"
            values={urgencyFilter}
            onChange={(v) => updateListState({ urgencyFilter: v as typeof urgencyFilter })}
            options={URGENCY_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
          />

          <FilterMultiSelect
            id="job-list-work-status"
            label="สถานะทำงาน"
            summaryNoun="สถานะ"
            values={workStatusFilter}
            onChange={(v) => updateListState({ workStatusFilter: v as typeof workStatusFilter })}
            options={UNIT_REQUEST_WORK_STATUS_OPTIONS.map((status) => ({
              value: status,
              label: UNIT_REQUEST_WORK_STATUS_LABELS[status],
            }))}
          />

          <FilterMultiSelect
            id="job-list-note-filter"
            label="หมายเหตุ"
            summaryNoun="แบบ"
            values={noteFilter}
            onChange={(v) => updateListState({ noteFilter: v as typeof noteFilter })}
            options={[
              { value: 'has', label: 'มีหมายเหตุ' },
              { value: 'empty', label: 'ไม่มีหมายเหตุ' },
            ]}
          />

          <FilterMultiSelect
            id="job-list-replacement-filter"
            label="ส่งคนแทน"
            summaryNoun="แบบ"
            values={replacementFilter}
            onChange={(v) => updateListState({ replacementFilter: v as typeof replacementFilter })}
            options={REPLACEMENT_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
          />

          <FilterMultiSelect
            id="job-list-age"
            label="วันผ่านมา"
            summaryNoun="ช่วง"
            values={ageDaysFilter}
            onChange={(v) => updateListState({ ageDaysFilter: v as typeof ageDaysFilter })}
            options={AGE_DAYS_MULTI_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />

          {/* dropdown กับการกดหัวคอลัมน์เป็นตัวเรียง**คนละตัว** — เลือก dropdown = ล้าง
              การเรียงจากคอลัมน์ทิ้ง เพื่อให้มีตัวที่มีผลจริงทีละหนึ่งตัวเท่านั้น */}
          <FilterSelect
            id="job-list-sort"
            label="เรียงลำดับ"
            value={sort}
            onChange={(v) => updateListState({ sort: v as typeof sort, tableSort: null })}
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
            <div className={cn(DASH.card, 'overflow-x-auto')}>
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className={cn('border-b', DASH.divider, DASH.tableHead)}>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">เลขที่ใบขอ</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ผ่านมา</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">หน่วยงาน</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">วันที่กรอก</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">วันที่ต้องการ</th>
                    <th className="px-3 py-3 text-center font-medium whitespace-nowrap">คงเหลือ</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ประเภทใบขอ</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ตำแหน่ง</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ลักษณะงานย่อย</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ผู้ลาออก</th>
                    <th className="px-3 py-3 text-left font-medium whitespace-nowrap">ผู้รับผิดชอบ</th>
                    <th className="px-3 py-3 text-center font-medium whitespace-nowrap">ส่งคนแทน</th>
                    <th className="px-3 py-3 text-center font-medium whitespace-nowrap">สถานะทำงาน</th>
                    <th className="px-3 py-3 text-left font-medium min-w-[180px]">หมายเหตุ</th>
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
                      <td className="px-3 py-3 text-center"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></td>
                      <td className="px-3 py-3 text-center"><Skeleton className="h-5 w-14 rounded-full mx-auto" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-3 w-32" /></td>
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
                    <span className="flex flex-wrap items-center gap-1.5 font-semibold text-foreground text-sm">
                      {j.request_no || j.unit_name}
                      <PrequestBadge job={j} compact />
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <JobAgeChip job={j} withPrefix />
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

                  <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                    {(() => {
                      const loc = cleanedAddressSummary(j.location_address || '');
                      if (loc.line) {
                        return (
                          <>
                            <div className="text-foreground/80">
                              {[
                                loc.province ? `จ.${loc.province}` : null,
                                loc.district
                                  ? loc.district.startsWith('เขต') || loc.district.startsWith('อำเภอ')
                                    ? loc.district
                                    : `อ.${loc.district}`
                                  : null,
                                loc.subdistrict || null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                            <div className="line-clamp-2">{j.location_address}</div>
                          </>
                        );
                      }
                      return <div className="line-clamp-2">{j.location_address || '—'}</div>;
                    })()}
                  </div>

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

                  <div className="flex items-center justify-end mt-2 text-xs gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <PrequestBadge job={j} compact />
                      <UnitRequestReplacementBadge value={j.send_replacement} compact />
                      <UnitRequestWorkStatusBadge
                        status={j.work_status}
                        firstName={j.work_person_first_name}
                        lastName={j.work_person_last_name}
                        persons={j.work_persons}
                        compact
                      />
                      <JobUrgencyBadge job={j} />
                    </div>
                  </div>
                </button>

                {/* กดดูรายละเอียด (เจ้าของสั่ง 25 ส.ค. 2569) — อยู่นอกปุ่มเปิดใบขอ */}
                <button
                  type="button"
                  onClick={() => toggleExpanded(j.id)}
                  aria-expanded={expanded.has(j.id)}
                  className="mt-3 flex min-h-9 w-full items-center justify-between gap-2 border-t border-border/50 pt-3 text-left"
                >
                  <span className="text-xs text-muted-foreground">{detailSummary(j)}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                      expanded.has(j.id) && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                {expanded.has(j.id) ? <UnitRequestDetailPanel job={j} className="mt-1" /> : null}

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
          <div className={cn(DASH.card, 'overflow-x-auto', refreshing && 'opacity-50 pointer-events-none transition-opacity')}>
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                {/* 🔴 หัวคอลัมน์กดเรียงได้**ทุกอัน** (เจ้าของสั่ง 20 ส.ค. 2569) —
                    กดซ้ำ = สลับขึ้น/ลง · ตรรกะอยู่ที่ lib/jobListTableSort (มีเทสต์) */}
                <tr className={cn('border-b', DASH.divider, DASH.tableHead)}>
                  {(
                    [
                      ['request_no', 'left'],
                      ['age', 'left'],
                      ['unit', 'left'],
                      ['submitted', 'left'],
                      ['required', 'left'],
                      ['remaining', 'center'],
                      ['request_type', 'left'],
                      ['position', 'left'],
                      ['subtype', 'left'],
                      ['resigned', 'left'],
                      ['assignee', 'left'],
                      ['send_replacement', 'center'],
                      ['work_status', 'center'],
                      ['note', 'left'],
                    ] as Array<[JobListTableColumn, 'left' | 'center']>
                  ).map(([col, align]) => {
                    // ป้ายชื่อคอลัมน์มาจาก JOB_LIST_TABLE_COLUMN_LABEL ที่เดียว (ไม่พิมพ์ซ้ำ)
                    const label = JOB_LIST_TABLE_COLUMN_LABEL[col];
                    const active = tableSort?.column === col;
                    return (
                      <th
                        key={col}
                        aria-sort={active ? (tableSort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                        className={cn(
                          'px-3 py-3 font-medium whitespace-nowrap',
                          align === 'center' ? 'text-center' : 'text-left',
                          col === 'note' && 'min-w-[180px]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            updateListState({ tableSort: toggleTableSort(tableSort, col), page: 1 })
                          }
                          title={`เรียงตาม ${label}`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-foreground',
                            align === 'center' && 'justify-center',
                            active ? 'font-bold text-foreground' : '',
                          )}
                        >
                          {label}
                          {active ? (
                            <span aria-hidden className="text-[10px] leading-none">
                              {tableSort.dir === 'asc' ? '▲' : '▼'}
                            </span>
                          ) : (
                            <span aria-hidden className="text-[10px] leading-none opacity-25">
                              ▲▼
                            </span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody>
                {paginated.map((j) => (
                  <React.Fragment key={j.id}>
                  <tr
                    onClick={(e) => openJob(j, e)}
                    onAuxClick={(e) => {
                      if (e.button === 1) {
                        e.preventDefault();
                        openJob(j, e);
                      }
                    }}
                    className={cn('cursor-pointer border-b', DASH.tableRow)}
                  >
                    <td className={cn('px-3 py-3 whitespace-nowrap', DASH.cellStrong)}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {/* ปุ่มกางรายละเอียด — แยกจากการกดแถว (กดแถว = เปิดใบขอเหมือนเดิม)
                            ⚠️ ต้อง stopPropagation ไม่งั้นกางแล้วเด้งออกจากหน้าทันที */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(j.id);
                          }}
                          aria-expanded={expanded.has(j.id)}
                          aria-label={`${expanded.has(j.id) ? 'ซ่อน' : 'ดู'}รายละเอียดใบขอ ${j.request_no || j.unit_name} — ${detailSummary(j)}`}
                          title={detailSummary(j)}
                          className={cn(
                            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                            'hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          )}
                        >
                          <ChevronDown
                            className={cn(
                              'h-3.5 w-3.5 transition-transform',
                              expanded.has(j.id) && 'rotate-180',
                            )}
                            aria-hidden
                          />
                        </button>
                        {j.request_no || '—'}
                        <PrequestBadge job={j} compact />
                      </span>
                    </td>
                    {/* ชิปอายุใบขอ (mockup rev.3 ข้อ 05) — 4 ระดับตามวันที่ค้าง
                        \+ "ล่วงหน้า" อีกระดับที่เป็นเขียวชุดเดียวเสมอ (19 ส.ค. 2569)
                        เกณฑ์ถังไม่เปลี่ยน · ดู JobAgeChip ข้างบน */}
                    <td className="px-3 py-3 text-xs whitespace-nowrap">
                      <JobAgeChip job={j} />
                    </td>
                    {/* ตัวหนังสือในตารางใช้ DASH.cell* (slate + คู่ dark ชัดเจน) เพื่อคุมคอนทราสต์
                        ของตารางเองให้แน่นอน — บั๊กเดิมที่ branding เขียน --foreground ทับ inline
                        บน <html> จนไม่สลับตามธีมนั้น แก้แล้วที่ brandingStorage.applyBrandSurfaceVars()
                        และมีเทสต์คุมที่ tests/api/brandingSurfaceTheme.test.ts */}
                    <td className={cn('px-3 py-3 text-xs', DASH.cell)}>{j.unit_name || '—'}</td>
                    <td className={cn('px-3 py-3 text-xs whitespace-nowrap', DASH.cellMuted)}>{formatSubmittedDate(j)}</td>
                    <td className={cn('px-3 py-3 text-xs whitespace-nowrap', DASH.cellMuted)}>{formatYmdDmyBe(j.required_date)}</td>
                    <td className={cn('px-3 py-3 text-center text-xs tabular-nums whitespace-nowrap', DASH.cellStrong)}>
                      {jobPositionUnits(j)}
                    </td>
                    <td className={cn('px-3 py-3 text-xs', DASH.cellMuted)}>{j.request_action_name || JOB_TYPE_LABELS[j.job_type]}</td>
                    <td className={cn('px-3 py-3 text-xs', DASH.cellMuted)}>{j.job_description_code_1 || '—'}</td>
                    <td className={cn('px-3 py-3 text-xs', DASH.cellMuted)}>{extractJobSubtypeLabel(j)}</td>
                    <td className={cn('px-3 py-3 text-xs', DASH.cellMuted)}>{j.resigned_employee_name || '—'}</td>
                    {/* ผู้รับผิดชอบ — เจ้าของสั่ง 25 ส.ค. 2569: **บรรทัดเดียว** (เดิมซ้อน 3 บรรทัด
                        ทำให้แถวสูงกว่าแถวอื่นสามเท่า) · คนที่ยังไม่มีชื่อ ตัดทิ้งไปเลย
                        ไม่โชว์ "OPL —" ให้รก · ไม่มีใครเลยค่อยขึ้นขีดเดียว */}
                    <td className="px-3 py-3">
                      {j.opl_name || j.recruiter_name || j.screener_name ? (
                        <div className={cn('text-xs whitespace-nowrap', DASH.cell)}>
                          {[
                            j.opl_name ? ['OPL', j.opl_name] : null,
                            j.recruiter_name ? ['สรรหา', j.recruiter_name] : null,
                            j.screener_name ? ['คัดสรร', j.screener_name] : null,
                          ]
                            .filter((x): x is [string, string] => x !== null)
                            .map(([role, name], i, arr) => (
                              <React.Fragment key={role}>
                                <span className={DASH.muted}>{role} </span>
                                {name}
                                {i < arr.length - 1 ? <span className={DASH.muted}> · </span> : null}
                              </React.Fragment>
                            ))}
                        </div>
                      ) : (
                        <span className={cn('text-xs', DASH.cellMuted)}>—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <PrequestBadge job={j} compact />
                      <UnitRequestReplacementBadge value={j.send_replacement} compact />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <UnitRequestWorkStatusBadge
                          status={j.work_status}
                          firstName={j.work_person_first_name}
                          lastName={j.work_person_last_name}
                          persons={j.work_persons}
                          compact
                        />
                        <JobUrgencyBadge job={j} compact />
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[200px]">
                      <UnitRequestNotePreview note={j.list_note} />
                    </td>
                  </tr>
                  {/* แถวรายละเอียด — โผล่เมื่อกดปุ่มลูกศรเท่านั้น
                      ⚠️ ไม่ผูก onClick เปิดใบขอ ไม่งั้นกดอ่านรายละเอียดแล้วเด้งออก */}
                  {expanded.has(j.id) ? (
                    <tr className={cn('border-b', DASH.divider)}>
                      <td colSpan={14} className="px-4 pb-3 pt-0">
                        <UnitRequestDetailPanel job={j} />
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
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
