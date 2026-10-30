import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { lockedBuOf } from '@/lib/userViewableBus';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardShell from '@/components/dashboard/analytics/DashboardShell';
import DetailListDialog from '@/components/shared/DetailListDialog';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useSiamrajUnitRequestFilters, filterUnitRequests } from '@/hooks/useSiamrajUnitRequestFilters';
import { useAuth } from '@/contexts/AuthContext';
import {
  buildDashboardData,
  defaultDashboardDateRange,
  filterJobsByRequestDate,
  resolvePeriodRange,
  resolveOpenStockTrendRange,
  resolveYearToDateTrendRange,
  sortWorkQueue,
  buildRecruiterOverview,
} from '@/lib/dashboard/buildDashboardData';
import { loadDashboardFilters, saveDashboardFilters } from '@/lib/dashboard/dashboardPageState';
import { exportWorkQueueCsv } from '@/lib/dashboard/exportWorkQueue';
import { MOCK_DASHBOARD_DATA } from '@/lib/dashboard/mockDashboardData';
import type { DashboardFilters, DashboardSortDir, DashboardSortKey, DashboardWorkItem } from '@/lib/dashboard/types';
import {
  cohortRowToDashboardDetailItem,
  jobToDashboardDetailItem,
} from '@/lib/dashboard/dashboardDetailDialog';
import { buildCohortDrillDown, type CohortDrillKpi } from '@/lib/dashboard/cohortDrillDown';
import { isPrequestJob } from '@/lib/publicJobVisibility';
import { LEAD_AMOUNT_LABEL, NO_STATUS_LABEL, buildCohortLeadPanel, buildStatusLeadPanel, filterLeadPanel } from '@/lib/dashboard/statusLeadPanel';
import {
  buildLeadKindBreakdown,
  leadKindMismatchNote,
} from '@/lib/dashboard/leadKindBreakdown';
import {
  assigneeRequestKeys,
  buildRequestKeySet,
  needsRequestScopeFilter,
  scopeDropNote,
  scopeThroughputByRequestKeys,
  type UnitAssignee,
} from '@/lib/dashboard/throughputScope';
import type { RequestLeadKind } from '@/lib/requestLeadKind';
import type { RequestControlRecord } from '@/lib/requestControl';
import {
  filterJobsClosedInPeriod,
  filterJobsForAgeBucket,
  filterJobsForDashboardKpi,
  filterJobsForRemainingKpi,
  filterJobsForRecruiter,
  filterJobsForSiteCode,
  filterRecordsForCohort,
  filterRecordsForControlKpi,
  filterRecordsForFilledBreakdown,
  filterRecordsForFullyClosedBreakdown,
  filterRecordsForSlaBucket,
} from '@/lib/dashboard/drillDownFilters';
import {
  buildSlaByLeadKind,
  filterRecordsForLeadKind,
  filterRecordsForSlaCell,
  type SlaCellKey,
} from '@/lib/dashboard/slaByLeadKind';
import {
  jobsToRequestControlRecords,
  mergeRequestControlJobs,
} from '@/lib/requestControl';
import { controlRecordToDashboardDetailItem } from '@/lib/dashboard/dashboardDetailDialog';
import { unitOrganizationKey } from '@/lib/unitGroupName';
import { sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { resolveUnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import {
  loadSupervisorDashboardFilters,
  saveSupervisorDashboardFilters,
} from '@/lib/supervisorDashboardPageState';
import {
  fetchAllUnitAssignees,
  fetchSiamrajThroughput,
  fetchSiamrajClosedRequests,
} from '@/lib/siamrajUnitRequestsApi';
import {
  filterJobsForThroughput,
  filterThroughputByDepartment,
  jobsToThroughputRecords,
  type ThroughputRecord,
} from '@/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

/** กล่องที่กดแล้วการ์ดเร่งด่วนเป็นใบจาก cohort (ชุดเดียวกับเลขบนการ์ด) */
const COHORT_KPI_IDS: readonly CohortDrillKpi[] = ['total_requests', 'closed', 'cancelled', 'remaining'];
/** กล่องใบขอชั่วคราว (`buildPrequestKpi`) */
const PREQUEST_KPI_ID = 'work_status_prequest';

/** กล่องสถานะทำงาน → สถานะ (null = ทุกสถานะ) — 29 ต.ค. 2569 ใช้กับการ์ดเร่งด่วนตอนกดกล่อง */
const WORK_STATUS_OF_KPI: Record<string, string | null> = {
  work_status_total: null,
  work_status_in_progress: 'in_progress',
  work_status_on_hold: 'on_hold',
  work_status_evaluating: 'evaluating',
  work_status_waiting_inform: 'waiting_inform',
  work_status_waiting_interview: 'waiting_interview',
  work_status_waiting_result: 'waiting_result',
  work_status_waiting_start: 'waiting_start',
  work_status_daily_work: 'daily_work',
  work_status_daily_pay: 'daily_pay',
  /** ใบ ERP ที่ไม่อยู่ใน feed — มีเฉพาะโหมดมีงวด (ยอด cohort เกินผลรวมสถานะ) */
  work_status_none: null,
};

const DEMO_MODE = import.meta.env.VITE_DASHBOARD_DEMO === 'true';

/** การ์ดที่คิดจากยอดตามช่วง (throughput) — โหลดไม่ขึ้นแล้วต้องขึ้น "—" */
const THROUGHPUT_KPI_IDS = new Set(['total_requests', 'closed', 'cancelled']);

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  /** admin เห็นทุกแผนก · คนที่ดูได้ BU เดียวถูกล็อก · ดูหลาย BU (ดูเพิ่ม · 28 ต.ค. 2569) = เลือกได้ในชุดของตัวเอง */
  const lockedDepartmentCode = lockedBuOf(user);
  const [filters, setFilters] = useState<DashboardFilters>(() => loadDashboardFilters());
  const [unitFilters, setUnitFilters] = useState(() => loadSupervisorDashboardFilters());
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(() => defaultDashboardDateRange());
  const [sortKey, setSortKey] = useState<DashboardSortKey>('priority');
  const [sortDir, setSortDir] = useState<DashboardSortDir>('asc');
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDialogTitle, setDetailDialogTitle] = useState('');
  const [detailDialogItems, setDetailDialogItems] = useState<ReturnType<typeof jobToDashboardDetailItem>[]>([]);
  /** กล่องรายละเอียดกำลังรอข้อมูลอยู่ไหม — ใช้กับ "ปิดแล้ว" ที่ต้องยิง ERP ตอนกด */
  const [detailDialogLoading, setDetailDialogLoading] = useState(false);

  const [throughputRecords, setThroughputRecords] = useState<ThroughputRecord[]>([]);
  const [closedJobs, setClosedJobs] = useState<JobRequest[]>([]);
  /**
   * โหมด "ทั้งหมด" ไม่ดึงชุดใบปิดตอนเปิดหน้า — ช่วงเต็มมี 2,700+ ใบ ใช้เวลา ~20 วิ
   * จะดึงก็ต่อเมื่อคนกดกางแผง "ภาระงานตามผู้รับผิดชอบ" ซึ่งเป็นที่เดียวที่ใช้ยอดปิดรายคน
   */
  const [closedAllJobs, setClosedAllJobs] = useState<JobRequest[] | null>(null);
  /** ผู้รับผิดชอบทุกใบ (รวมใบที่ปิดแล้ว) — โหลดครั้งเดียว ใช้กรองตามเจ้าหน้าที่ */
  const [assignees, setAssignees] = useState<UnitAssignee[]>([]);
  const [closedAllLoading, setClosedAllLoading] = useState(false);

  const RETURN_TO = '/dashboard';

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    void fetchAllUnitAssignees()
      .then((rows) => {
        if (!cancelled) setAssignees(rows);
      })
      .catch(() => {
        if (!cancelled) setAssignees([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { jobs, loading, refreshing, refetch, siamrajPrimary, dbSource, loadError, feedState } = useUnitRequestsFeed();
  /** เส้นใบขอพัง/ไม่มีสิทธิ์ = ห้ามคิดเลขจาก jobs ว่าง (จะขึ้น 0 ทั้งหน้า) · QA 5 ต.ค. 2569 */
  /**
   * เส้นเสริม (ยอดตามช่วง · ใบปิด) ล้ม — QA 17 ต.ค. 2569: เดิมกลืนเงียบเป็นชุดว่าง ⇒ เลขเป็น 0/เลขเก่าค้างเหมือนยังสด
   * `sideRev` = ปุ่มรีเฟรชโหลดเส้นเสริมใหม่ด้วย (เดิมโหลดใหม่แค่ใบเปิด)
   */
  const [sideFailed, setSideFailed] = useState<{ throughput: boolean; closed: boolean }>({ throughput: false, closed: false });
  const [sideRev, setSideRev] = useState(0);
  const feedProblem =
    !DEMO_MODE && (feedState === 'failed' || feedState === 'forbidden')
      ? feedState === 'forbidden'
        ? 'ไม่มีสิทธิ์ดูใบขอ'
        : (loadError ?? 'ลองโหลดใหม่')
      : null;

  useEffect(() => {
    if (!lockedDepartmentCode) return;
    setUnitFilters((prev) =>
      prev.departmentFilter === lockedDepartmentCode
        ? prev
        : { ...prev, departmentFilter: lockedDepartmentCode },
    );
  }, [lockedDepartmentCode]);

  const period = useMemo(
    () => (dateRange ? resolvePeriodRange('custom', dateRange) : null),
    [dateRange],
  );

  /**
   * ชุดใบปิดถูกดึงจริงเมื่อไหร่ — ต้องตรงกับเงื่อนไขของ effect ที่ setClosedJobs ด้านล่าง
   * ถ้าไม่ดึง ยอด "ปิด" ต่อคนคือ "ยังไม่รู้" ไม่ใช่ 0 → ส่งธงไปให้ UI โชว์ "—"
   */
  const closedTotalsAvailable =
    !DEMO_MODE && siamrajPrimary && dbSource === 'sqlserver' && (period != null || closedAllJobs != null);

  const throughputRange = useMemo(() => {
    // ดึงตามช่วงที่เลือก (ไม่ใช้ previous) เพื่อให้ cohort เดือนนั้นครบรวมใบที่ปิดแล้ว
    if (period) return { from: period.from, to: period.to };
    return resolveOpenStockTrendRange(jobs);
  }, [period, jobs]);

  const trendMeta = useMemo(() => {
    if (period) {
      return {
        from: period.from,
        to: period.to,
        label: period.label,
      };
    }
    return resolveOpenStockTrendRange(jobs);
  }, [period, jobs]);

  const throughputFrom = throughputRange.from;
  const throughputTo = throughputRange.to;

  useEffect(() => {
    if (DEMO_MODE) {
      setThroughputRecords([]);
      return;
    }
    if (!(siamrajPrimary && dbSource === 'sqlserver')) return;
    let cancelled = false;
    void fetchSiamrajThroughput(throughputFrom, throughputTo)
      .then((rows) => {
        if (cancelled) return;
        setThroughputRecords(rows);
        setSideFailed((s) => ({ ...s, throughput: false }));
      })
      .catch(() => {
        if (cancelled) return;
        // 🔴 ห้ามล้างเป็น [] (QA 19 ต.ค. 2569) — การ์ดจะไปคิดจากใบที่เปิดอยู่แทน ขึ้น "ยกเลิก 0" ปลอม · คงชุดเดิมไว้
        setSideFailed((s) => ({ ...s, throughput: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [siamrajPrimary, dbSource, throughputFrom, throughputTo, sideRev]);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (siamrajPrimary && dbSource === 'sqlserver') return;
    setThroughputRecords(
      jobsToThroughputRecords(filterJobsForThroughput(jobs, throughputFrom, throughputTo)),
    );
  }, [jobs, siamrajPrimary, dbSource, throughputFrom, throughputTo]);

  useEffect(() => {
    if (DEMO_MODE) {
      setClosedJobs([]);
      return;
    }
    if (!(siamrajPrimary && dbSource === 'sqlserver')) {
      setClosedJobs([]);
      return;
    }
    // โหมดทั้งหมดใช้ throughput เป็นหลัก + โหลดใบปิดแบบ on-demand (ดู requestClosedTotals)
    if (!period) {
      setClosedJobs([]);
      return;
    }
    let cancelled = false;
    void fetchSiamrajClosedRequests(period.from, period.to)
      .then((rows) => {
        if (cancelled) return;
        setClosedJobs(rows);
        setSideFailed((s) => ({ ...s, closed: false }));
      })
      .catch(() => {
        if (cancelled) return;
        setClosedJobs([]);
        setSideFailed((s) => ({ ...s, closed: true }));
      });
    return () => {
      cancelled = true;
    };
  }, [siamrajPrimary, dbSource, period, sideRev]);

  /** กางแผง "ภาระงานตามผู้รับผิดชอบ" ในโหมดทั้งหมด → ค่อยดึงใบปิดของช่วงเดียวกับ throughput */
  const requestClosedTotals = useCallback(() => {
    if (DEMO_MODE || period || closedAllJobs || closedAllLoading) return;
    if (!(siamrajPrimary && dbSource === 'sqlserver')) return;
    setClosedAllLoading(true);
    // ครบทุกใบของช่วง (เพดาน 20,000) — เดิมค่าเริ่ม 3,000 ตัดใบปิดจนตาราง "ปิดทัน / ไม่ทัน" ไม่เท่าการ์ดบน (29 ต.ค. 2569)
    void fetchSiamrajClosedRequests(throughputFrom, throughputTo, 20000)
      .then((rows) => {
        setClosedAllJobs(rows);
        setSideFailed((s) => ({ ...s, closed: false }));
      })
      .catch(() => {
        setClosedAllJobs([]);
        setSideFailed((s) => ({ ...s, closed: true }));
      })
      .finally(() => setClosedAllLoading(false));
  }, [period, closedAllJobs, closedAllLoading, siamrajPrimary, dbSource, throughputFrom, throughputTo]);

  /**
   * 🔴 โหมดทั้งหมด: ดึงใบปิดให้เองตอนเปิดหน้า (เจ้าของ 29 ต.ค. 2569 Choice "ดึงใบที่ปิดแล้วให้เอง ยอดรวมเท่าการ์ดบน")
   * เดิมต้องกด "ดึงชุดใบที่ปิดแล้ว" ⇒ ตาราง "ปิดทัน / ไม่ทัน" นับแต่ใบที่ยังไม่ปิด (308) ไม่เท่าการ์ด "ใบขอเร่งด่วนแค่ไหน" (6,005)
   */
  useEffect(() => {
    if (!period) requestClosedTotals();
  }, [period, requestClosedTotals]);

  /** ใบปิดที่เอาไปคิดยอดรายคน — ช่วงที่เลือกใช้ชุดของช่วง · ทั้งหมดใช้ชุดที่โหลด on-demand */
  const closedJobsForOverview = useMemo(
    () => (period ? closedJobs : (closedAllJobs ?? [])),
    [period, closedJobs, closedAllJobs],
  );

  /** ชุดข้อมูลเดียวกับหน้ารายการหน่วยงาน — ไม่กรองวันที่จนกว่าจะเลือกช่วงวันที่กรอก */
  const filterApi = useSiamrajUnitRequestFilters(jobs, siamrajPrimary, unitFilters, staffRosterRev);

  const jobsWithoutAgeFilter = useMemo(
    () => filterUnitRequests(jobs, siamrajPrimary, unitFilters, { ageDaysFilter: true }),
    [jobs, siamrajPrimary, unitFilters],
  );

  const scopedJobs = useMemo(() => {
    if (!period) return jobsWithoutAgeFilter;
    return filterJobsByRequestDate(jobsWithoutAgeFilter, period.from, period.to);
  }, [jobsWithoutAgeFilter, period]);

  const scopedClosedJobs = useMemo(
    () =>
      filterUnitRequests(closedJobs, siamrajPrimary, unitFilters, {
        statusFilter: true,
        ageDaysFilter: true,
        urgencyFilter: true,
      }),
    [closedJobs, siamrajPrimary, unitFilters],
  );

  /**
   * ยอด "ปิด" รายคนของโหมดทั้งหมด — คิดแยกเฉพาะแผงผู้รับผิดชอบ ไม่ยัดเข้า buildDashboardData
   * เพราะชุดใบปิดชุดใหญ่จะไปขยับ KPI/cohort/กระทบยอด ที่โหมดนี้คิดจาก throughput อยู่แล้ว
   */
  const recruiterOverviewAllMode = useMemo(() => {
    if (period || !closedAllJobs) return null;
    const scopedAll = filterUnitRequests(closedAllJobs, siamrajPrimary, unitFilters, {
      statusFilter: true,
      ageDaysFilter: true,
      urgencyFilter: true,
    });
    return buildRecruiterOverview(scopedJobs, new Date(), scopedAll);
  }, [period, closedAllJobs, siamrajPrimary, unitFilters, scopedJobs]);

  const controlRecords = useMemo(() => {
    const merged = mergeRequestControlJobs(jobsWithoutAgeFilter, scopedClosedJobs);
    return jobsToRequestControlRecords(merged);
  }, [jobsWithoutAgeFilter, scopedClosedJobs]);

  /**
   * ชุดของ **ตาราง SLA ปิดทัน/ไม่ทัน เท่านั้น** — เหมือน `controlRecords` แต่รวมชุดใบปิด
   * ของโหมด "ทั้งหมด" (`closedAllJobs`) เข้ามาด้วย
   *
   * 🔴 ทำไมไม่ยัดเข้า `controlRecords` ตรง ๆ: คอมเมนต์เหนือ `recruiterOverviewAllMode`
   * เตือนไว้ว่าชุดใบปิดชุดใหญ่จะไปขยับ KPI/cohort/กระทบยอด ของโหมดนี้ ซึ่งคิดจาก
   * throughput อยู่แล้ว → เลขบนการ์ดจะเปลี่ยนแบบไม่มีใครสั่ง
   * จึงแยกชุดให้ตาราง SLA ใช้เอง (ตารางนี้นับ "ใบ" ตรง ๆ ไม่เกี่ยวกับกระทบยอด)
   *
   * ⚠️ ถ้าไม่ทำแบบนี้จะได้บั๊กที่เจอตอนตรวจงาน: กด "ดึงชุดใบที่ปิดแล้ว" แล้วคำเตือนหาย
   * แต่คอลัมน์ ปิดทัน/ไม่ทัน ไม่โผล่ เพราะข้อมูลไม่ได้ไหลเข้าตาราง
   */
  const slaControlRecords = useMemo(() => {
    // QA 17 ต.ค. 2569: เลือกช่วงแล้ว ช่อง "ยังไม่ปิด" เคยนับใบเปิดทั้งระบบ (เดือนนี้ได้ 393 ทั้งที่ใบเข้าเดือนนี้ 143)
    // ⇒ ใบเปิดต้องตัดตามวันขอในช่วงเหมือนการ์ดอื่น (`scopedJobs`)
    if (period) return jobsToRequestControlRecords(mergeRequestControlJobs(scopedJobs, scopedClosedJobs));
    if (!closedAllJobs) return controlRecords;
    const scopedAll = filterUnitRequests(closedAllJobs, siamrajPrimary, unitFilters, {
      statusFilter: true,
      ageDaysFilter: true,
      urgencyFilter: true,
    });
    return jobsToRequestControlRecords(mergeRequestControlJobs(jobsWithoutAgeFilter, scopedAll));
  }, [period, controlRecords, closedAllJobs, siamrajPrimary, unitFilters, jobsWithoutAgeFilter, scopedJobs, scopedClosedJobs]);

  useEffect(() => {
    saveDashboardFilters(filters);
  }, [filters]);

  useEffect(() => {
    saveSupervisorDashboardFilters(unitFilters);
  }, [unitFilters]);

  useEffect(() => {
    const fn = () => setStaffRosterRev((x) => x + 1);
    window.addEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
    return () => window.removeEventListener(JOB_STAFF_ROSTER_CHANGED_EVENT, fn);
  }, []);

  useEffect(() => {
    if (unitFilters.jobSubtypeFilter === 'all') return;
    const stillValid = filterApi.jobSubtypeOptions.some((o) => o.value === unitFilters.jobSubtypeFilter);
    if (!stillValid) setUnitFilters((prev) => ({ ...prev, jobSubtypeFilter: 'all' }));
  }, [unitFilters.departmentFilter, unitFilters.jobSubtypeFilter, filterApi.jobSubtypeOptions]);

  useEffect(() => {
    if (unitFilters.unitFilter === 'all') return;
    const stillValid = filterApi.unitOptions.some(
      (o) => unitOrganizationKey(o) === unitOrganizationKey(unitFilters.unitFilter),
    );
    if (!stillValid) setUnitFilters((prev) => ({ ...prev, unitFilter: 'all' }));
  }, [unitFilters.departmentFilter, unitFilters.jobSubtypeFilter, unitFilters.unitFilter, filterApi.unitOptions]);

  const patchFilters = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchUnitFilters = useCallback((patch: Partial<typeof unitFilters>) => {
    setUnitFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const jobById = useMemo(() => {
    const map = new Map<string, JobRequest>();
    for (const j of jobs) {
      map.set(j.id, j);
      if (j.request_no?.trim()) map.set(j.request_no.trim(), j);
      if (j.externalId?.trim()) map.set(j.externalId.trim(), j);
    }
    return map;
  }, [jobs]);

  const openJobList = useCallback(
    (title: string, list: JobRequest[]) => {
      if (DEMO_MODE) return;
      const positions = sumJobPositionUnits(list);
      setDetailDialogTitle(`${title} (${positions.toLocaleString()} คน · ${list.length.toLocaleString()} ใบขอ)`);
      setDetailDialogItems(
        list.map((j) =>
          jobToDashboardDetailItem(j, (job) => {
            setDetailDialogOpen(false);
            navigateToUnitRequest(job, navigate, { returnTo: RETURN_TO });
          }),
        ),
      );
      setDetailDialogOpen(true);
    },
    [navigate],
  );

  const openControlList = useCallback(
    (title: string, list: ReturnType<typeof jobsToRequestControlRecords>) => {
      if (DEMO_MODE) return;
      const positions = list.reduce((s, r) => s + r.requestPositions, 0);
      setDetailDialogTitle(`${title} (${positions.toLocaleString()} คน · ${list.length.toLocaleString()} ใบขอ)`);
      setDetailDialogItems(
        list.map((r) =>
          controlRecordToDashboardDetailItem(r, (job) => {
            setDetailDialogOpen(false);
            navigateToUnitRequest(job, navigate, { returnTo: RETURN_TO });
          }),
        ),
      );
      setDetailDialogOpen(true);
    },
    [navigate],
  );

  /**
   * ชุด throughput ที่ **กรอง BU แล้ว** + ช่วงที่การ์ดใช้ — แหล่งเดียวของทั้ง
   * การ์ด KPI · กราฟ ล่วงหน้า/ฉุกเฉิน · drill-down รายใบ
   * แยกออกมาเป็น memo เพื่อกันสามที่คำนวณช่วง/ตัวกรองไม่ตรงกันแล้วเลขหลุดจากกัน
   */
  const cohortScope = useMemo(() => {
    const from = period?.from ?? trendMeta.from;
    const to = period?.to ?? trendMeta.to;
    const byDept = filterThroughputByDepartment(throughputRecords, unitFilters.departmentFilter);
    /**
     * 🔴 **กราฟต้องขยับตามตัวกรองทุกตัว ไม่ใช่แค่ BU** (เจ้าของสั่ง 18 ส.ค. 2569 —
     * เลือกเจ้าหน้าที่สรรหาชื่อหนึ่งแล้วยอด เข้ามา/ฉุกเฉิน/ล่วงหน้า ต้องเป็นของคนนั้น)
     *
     * ผู้รับผิดชอบ/โน้ต/สถานะ **ไม่มีใน throughput** (มาจาก ERP) — ต้องกรองด้วย
     * รายการเลขที่ใบที่ผ่าน `filterUnitRequests` มาแล้ว ทั้งใบเปิดและใบปิดของช่วงนั้น
     * ⚠️ ใบที่อยู่นอกชุดถูกตัดออกจริง และยอดที่ตัดถูกรายงานขึ้นจอ (ห้ามหายเงียบ)
     */
    if (!needsRequestScopeFilter(unitFilters)) {
      return { from, to, records: byDept, dropNote: null as string | null };
    }
    /**
     * 🔴 **เลือกเจ้าหน้าที่ → ใช้ตารางมอบหมายทั้งตาราง ไม่ใช่ใบใน feed**
     * feed มีแต่ใบที่ยังเปิด — ใบที่ปิดไปแล้วของคนนั้นจะหายทั้งกอง
     * (วัดจริง 18 ส.ค.: "คิว" ดูแล 116 ใบ แต่เปิดอยู่แค่ 51 → ขาด 65 ใบ)
     * ตัวกรองอื่น (หน่วยงาน/ประเภท/โน้ต/สถานะ/อายุ) ยังต้องใช้ข้อมูลใบ จึงใช้ชุดจาก jobs
     */
    const byAssignee = assigneeRequestKeys(assignees, unitFilters);
    const byJob = buildRequestKeySet([...jobsWithoutAgeFilter, ...scopedClosedJobs]);
    const needsJobLevel =
      unitFilters.unitFilter !== 'all' ||
      unitFilters.jobSubtypeFilter !== 'all' ||
      unitFilters.urgencyFilter !== 'all' ||
      unitFilters.noteFilter !== 'all' ||
      unitFilters.ageDaysFilter !== 'all' ||
      unitFilters.statusFilter !== 'all';

    let allowed: Set<string>;
    if (byAssignee && !needsJobLevel) allowed = byAssignee;
    else if (byAssignee) allowed = new Set([...byAssignee].filter((k) => byJob.has(k)));
    else allowed = byJob;

    const scoped = scopeThroughputByRequestKeys(byDept, allowed);
    return { from, to, records: scoped.records, dropNote: scopeDropNote(scoped.droppedPositions) };
  }, [period, trendMeta, throughputRecords, unitFilters, jobsWithoutAgeFilter, scopedClosedJobs, assignees]);


  const data = useMemo(() => {
    if (DEMO_MODE) return MOCK_DASHBOARD_DATA;

    const unitFilteredAll = filterUnitRequests(jobs, siamrajPrimary, unitFilters, { ageDaysFilter: true });
    const trendRange = trendMeta;
    const trendJobs = period
      ? filterJobsByRequestDate(unitFilteredAll, period.from, period.to)
      : unitFilteredAll;
    const previousScoped = period
      ? filterJobsByRequestDate(unitFilteredAll, period.previousFrom, period.previousTo)
      : [];
    const built = buildDashboardData(
      scopedJobs,
      previousScoped,
      period,
      filters,
      new Date(),
      {
        jobs: trendJobs,
        from: trendRange.from,
        to: trendRange.to,
        label: trendRange.label,
        /**
         * 🔴 **การ์ด KPI ต้องใช้ชุดเดียวกับกราฟความเร่งด่วนเป๊ะ ๆ** (`cohortScope`)
         * throughput มาจาก SQL เป็นยอดรวม ไม่ผ่าน `filterUnitRequests` เหมือน jobs
         * — ถ้ากรองแค่ BU ที่นี่ พอเลือก "เจ้าหน้าที่สรรหา = คิว" กราฟจะเป็นของคิว
         * แต่การ์ด「เข้ามา」ยังค้างที่ยอดทั้งบริษัท (วัดจริง 18 ส.ค.: กราฟ 54 · การ์ด 7,552)
         * สองเลขบนจอเดียวกันขัดกันเองแบบนั้นอ่านไม่ออกว่าอันไหนจริง
         */
        throughputRecords: cohortScope.records,
      },
      scopedClosedJobs,
      jobsWithoutAgeFilter,
    );
    /** โหลดยอดตามช่วงไม่ขึ้นตั้งแต่ครั้งแรก = สามการ์ดที่มาจากยอดนั้นขึ้น "—" (QA 19 ต.ค. 2569 · ห้ามเลขสำรอง) */
    const throughputMissing = siamrajPrimary && dbSource === 'sqlserver' && sideFailed.throughput && throughputRecords.length === 0;
    return {
      ...built,
      kpis: throughputMissing
        ? built.kpis.map((k) => (THROUGHPUT_KPI_IDS.has(k.id) ? { ...k, unavailable: true } : k))
        : built.kpis,
      workQueue: sortWorkQueue(built.workQueue, sortKey, sortDir),
      // โหมดทั้งหมด: ทับด้วยชุดที่รวมใบปิดที่โหลด on-demand แล้ว (ถ้ายังไม่โหลดก็ใช้ของเดิม)
      recruiterOverview: recruiterOverviewAllMode ?? built.recruiterOverview,
    };
  }, [scopedJobs, period, filters, sortKey, sortDir, jobs, siamrajPrimary, unitFilters, cohortScope, scopedClosedJobs, jobsWithoutAgeFilter, trendMeta, recruiterOverviewAllMode, dbSource, sideFailed.throughput, throughputRecords.length]);

  const handleSort = useCallback(
    (key: DashboardSortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir(key === 'priority' ? 'asc' : 'desc');
      }
    },
    [sortKey],
  );

  const handleView = useCallback(
    (item: DashboardWorkItem) => {
      const job = jobById.get(item.id) ?? jobById.get(item.requestNo);
      if (job) {
        openJobList(`${item.requestNo} · ${item.unitName}`, [job]);
        return;
      }
      if (DEMO_MODE) return;
    },
    [jobById, openJobList],
  );

  /**
   * 🔴 กล่อง "ปิดแล้ว" กดแล้วต้องเห็น**ใบที่ปิดไปแล้วจริง ๆ** (เจ้าของสั่ง 17 ส.ค. 2569:
   * *"พอกดเข้าไปไม่เห็นเลยว่าใบไหนที่ปิดไปแล้ว"*)
   *
   * ของเดิมกรองจาก `stockJobs` ซึ่งเป็น**กองใบที่ยังเปิดอยู่** — ใบที่ปิดสนิทแล้ว
   * ไม่เคยอยู่ในกองนั้นตั้งแต่แรก (feed กล่องงานถามหาเฉพาะใบที่ยังต้องหาคน)
   * ที่โผล่ขึ้นมาจึงมีแต่ใบที่ยังเปิดและหาได้บางส่วน — วัดจริงได้ 23 ใบ ขณะที่ตัวเลข
   * บนกล่องบอก 3,697 ใบ **ไม่ตรงกันคนละโลก**
   *
   * ตัวนี้ดึงจากชุดเดียวกับแท็บ "ปิดแล้ว" ของบอร์ด (`siamrajSqlServerClosed`)
   * ซึ่งเป็นนิยามเดียวกับที่ KPI ใช้นับ เลขกับรายการจึงมาจากที่เดียวกัน
   *
   * ⚠️ ต้องยิง ERP ตอนกด (ชุดใบปิดไม่ได้โหลดไว้ล่วงหน้าในโหมด "ทั้งหมด" เพราะ
   * ช่วงเต็มมี 2,700+ ใบ ~20 วิ) → เปิดกล่องพร้อมสถานะกำลังโหลดก่อน
   */
  const openClosedJobList = useCallback(
    async (label: string, expectedRequests?: number | null) => {
      if (DEMO_MODE) return;
      const cached = period ? closedJobs : closedAllJobs;
      const range = period ?? (dateRange ? resolvePeriodRange('custom', dateRange) : null);
      /**
       * "มีการหาได้" = หาได้อย่างน้อย 1 อัตรา — ครอบทั้ง**ใบที่ปิดไปแล้ว**และ
       * **ใบที่ยังเปิดอยู่แต่หาได้บางส่วน** · ใบสองกองนี้มาคนละเส้น (กองเปิดอยู่ใน
       * feed กล่องงาน · กองปิดต้องยิง ERP แยก) ต้องรวมแล้วตัดซ้ำด้วย id
       */
      const openWithFill = filterJobsForRemainingKpi(jobsWithoutAgeFilter, range).filter(
        (j) => (j.filled_positions ?? 0) > 0,
      );
      const merge = (closedList: JobRequest[]) => {
        const seen = new Set(openWithFill.map((j) => j.id));
        return [
          ...openWithFill,
          ...closedList.filter((j) => (j.filled_positions ?? 0) > 0 && !seen.has(j.id)),
        ];
      };
      /**
       * 🔴 **ห้ามเงียบเมื่อลิสต์ได้ไม่ครบ** — เลขบนการ์ดมาจากยอดรวมรายเดือนฝั่ง ERP
       * (`sumCohortStockByRequestDate`) ซึ่งนับ**ใบที่อยู่นอก feed ของกล่องงาน**ด้วย
       * ส่วนรายการที่เราลิสต์ได้มีแค่ใบที่อยู่ในสองเส้นที่ดึงได้จริง
       * วัด 17 ส.ค.: การ์ดบอก 3,698 ใบ · ลิสต์ได้ 1,571 ใบ
       * ปล่อยให้ต่างกันเฉย ๆ = คนอ่านนึกว่ารายการหาย ต้องบอกบนหัวกล่องไปเลย
       */
      const openWithNote = (list: JobRequest[]) => {
        openJobList(label, list);
        if (typeof expectedRequests === 'number' && list.length < expectedRequests) {
          setDetailDialogTitle(
            (prev) =>
              `${prev} — เลขบนการ์ดคือ ${expectedRequests.toLocaleString('th-TH')} ใบ ส่วนที่เกินเป็นใบนอกงานสรรหา ยังดึงรายชื่อไม่ได้`,
          );
        }
      };
      if (cached && cached.length > 0) {
        openWithNote(merge(cached));
        return;
      }
      setDetailDialogTitle(label);
      setDetailDialogItems([]);
      setDetailDialogLoading(true);
      setDetailDialogOpen(true);
      try {
        const rows = await fetchSiamrajClosedRequests(
          period ? period.from : throughputFrom,
          period ? period.to : throughputTo,
        );
        openWithNote(merge(rows));
      } catch {
        // เปิดกล่องค้างไว้พร้อมข้อความว่าง ดีกว่าปิดหน้าต่างหายไปเฉย ๆ โดยไม่บอกอะไร
        setDetailDialogTitle(`${label} — โหลดรายการไม่สำเร็จ`);
      } finally {
        setDetailDialogLoading(false);
      }
    },
    [period, dateRange, closedJobs, closedAllJobs, openJobList, jobsWithoutAgeFilter, throughputFrom, throughputTo],
  );

  /**
   * 🔴 การ์ด **เข้ามา / ปิดได้ / ยกเลิก / คงเหลือ** กดแล้วต้องมีรายการใบขอเสมอ
   * (เจ้าของสั่ง 18 ส.ค. 2569: *"กดเข้าไปต้องมีใบขอบอกด้วยสิ ต่อให้ดูเป็นรายเดือน
   * ทั้งปี ก็ต้องขึ้น"*)
   *
   * ของเดิมรายการมากรองจาก**กองใบเปิดในกล่องงาน** แต่เลขบนการ์ดนับจาก
   * `throughputRecords` (ERP รวมใบที่ปิด/ยกเลิกแล้ว) — คนละกอง วัดจริง:
   * การ์ด「เข้ามา」7,548·5,602 กดแล้วได้ 340·289 · การ์ด「ยกเลิก」กดแล้ว**ว่าง**
   *
   * ตัวนี้แตกรายการจาก records **ชุดเดียวกับที่การ์ดนับ** (กรอง BU + ช่วงเดียวกัน)
   * เลขกับรายการจึงเท่ากันทุกโหมด · ใบที่รู้ id เต็มกดเปิดได้ · อัตราที่ระบุใบไม่ได้
   * ขึ้นบอกบนหัวกล่อง ไม่หายเงียบ
   */
  /**
   * กราฟ ทั้งหมด/ฉุกเฉิน/ล่วงหน้า — null เฉพาะตอนข้อมูลยังไม่มา (ไม่โชว์กราฟเปล่าระหว่างโหลด)
   * 🔴 ตัวกรองแล้วไม่เหลือใบ = กราฟยังอยู่เป็น 0 (เจ้าของสั่ง 1 ต.ค. 2569 — สลับตัวกรองแล้วหน้าห้ามย่อ/ขยายเอง ·
   *    เดิมเช็ค `cohortScope.records` ที่กรองแล้ว ⇒ เลือก BU/คนที่ไม่มีใบ กราฟหายทั้งก้อน)
   */
  const leadKindBreakdown = useMemo(() => {
    if (DEMO_MODE || throughputRecords.length === 0) return null;
    return buildLeadKindBreakdown(cohortScope.records, cohortScope.from, cohortScope.to);
  }, [cohortScope, throughputRecords.length]);

  /** เทียบกราฟกับการ์ด「เข้ามา」ทุกครั้ง — ไม่ตรงเมื่อไหร่ให้หน้าจอบอกเอง */
  const leadKindMismatch = useMemo(() => {
    if (!leadKindBreakdown) return null;
    const intake = data.kpis.find((k) => k.id === 'total_requests');
    if (!intake) return null;
    const mismatch = leadKindMismatchNote(
      leadKindBreakdown,
      intake.value,
      intake.secondaryCount ?? 0,
    );
    /**
     * การ์ดกับกราฟใช้ `cohortScope` ชุดเดียวกันแล้ว → ปกติต้องตรงกันเสมอ
     * ถ้าไม่ตรงคือของพังจริง ให้ขึ้นคำเตือนตามเดิม
     * ส่วน `dropNote` เป็น**หมายเหตุประกอบ** บอกว่ากรองแล้วเหลือเท่าไหร่จากทั้งหมด
     */
    if (mismatch) return mismatch;
    return cohortScope.dropNote;
  }, [leadKindBreakdown, data.kpis, cohortScope.dropNote]);

  const openCohortDrillList = useCallback(
    (kpi: CohortDrillKpi, label: string, leadKind?: RequestLeadKind) => {
      const { from, to, records } = cohortScope;
      const drill = buildCohortDrillDown(records, from, to, kpi);
      // กดแท่งกราฟ = ดูเฉพาะใบของถังนั้น (ยอดหัวกล่องคิดใหม่จากแถวที่เหลือ)
      const rows = leadKind ? drill.rows.filter((r) => r.leadKind === leadKind) : drill.rows;
      const positions = leadKind
        ? rows.reduce((sum, r) => sum + r.positions, 0)
        : drill.positions;
      const noteMissing =
        !leadKind && drill.positionsWithoutRequestNo > 0
          ? ` · ไม่มีเลขที่ใบ ${drill.positionsWithoutRequestNo.toLocaleString('th-TH')} อัตรา`
          : '';
      setDetailDialogTitle(
        `${label} (${positions.toLocaleString('th-TH')} อัตรา · ${rows.length.toLocaleString('th-TH')} ใบขอ)${noteMissing}`,
      );
      setDetailDialogItems(
        rows.map((row) => {
          // ใบเปิดใน feed มีข้อมูลเต็ม — ใช้ตัวจริงนำทาง · ใบปิด/นอก feed รู้แค่ id เต็มก็เปิดหน้าใบได้
          const feedJob = (row.jobId ? jobById.get(row.jobId) : undefined) ?? jobById.get(row.requestNo);
          const navJob =
            feedJob ??
            (row.jobId
              ? ({ id: row.jobId, externalId: row.requestNo, source: 'siamraj' } as JobRequest)
              : null);
          return cohortRowToDashboardDetailItem(
            row,
            kpi,
            navJob
              ? () => {
                  setDetailDialogOpen(false);
                  navigateToUnitRequest(navJob, navigate, { returnTo: RETURN_TO });
                }
              : undefined,
          );
        }),
      );
      setDetailDialogOpen(true);
    },
    [cohortScope, jobById, navigate],
  );

  /** กดแท่งกราฟ ล่วงหน้า/ฉุกเฉิน → ลิสต์ใบขอของถังนั้น (ฐานเดียวกับการ์ด「เข้ามา」) */
  const handleLeadKindClick = useCallback(
    (kind: RequestLeadKind, label: string) => {
      openCohortDrillList('total_requests', `เข้ามา · ${label}`, kind);
    },
    [openCohortDrillList],
  );

  /**
   * กล่องที่กดอยู่ — การ์ดเร่งด่วนเปลี่ยนเป็นใบของกล่องนั้น · null = การ์ดเร่งด่วนแบบเดิม
   * สถานะทำงาน / ใบขอชั่วคราว (29 ต.ค. 2569 "ทำเลย") · เข้ามา หาได้แล้ว ยกเลิก คงเหลือ (ร่าง 2 "อันนั้นแก้เลย")
   */
  /**
   * กล่องที่กดจำใน URL (`?pick=`) — กดเลขใบขอไปหน้าใบแล้วกดกลับ แผงยังอยู่ (QA 30 ต.ค. 2569 เคยหาย)
   * ชื่อกล่องอ่านจากชุดกล่องปัจจุบัน
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const pickId = searchParams.get('pick');
  const statusPick = useMemo(() => {
    if (!pickId) return null;
    const all = [...data.kpis, ...(data.workStatusKpis ?? []), ...(data.prequestKpi ? [data.prequestKpi] : [])];
    const kpi = all.find((k) => k.id === pickId);
    return kpi ? { kpiId: pickId, label: kpi.label } : null;
  }, [pickId, data]);
  const setStatusPick = useCallback(
    (next: string | null) =>
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set('pick', next);
          else p.delete('pick');
          return p;
        },
        { replace: true },
      ),
    [setSearchParams],
  );
  /**
   * แผงของกล่องที่กด — ชุดใบเดียวกับเลขบนกล่องเป๊ะ (การนับของหน้าไม่เปลี่ยน)
   *  - สถานะทำงาน = ใบจริงที่ยังต้องหา (`buildWorkStatusKpis` ตัดใบขอชั่วคราวออก) · ใบขอชั่วคราว = ส่วนที่ตัดออก
   *  - เข้ามา/หาได้แล้ว/ยกเลิก (+ คงเหลือโหมดมีงวด) = `buildCohortDrillDown` ชุดเดียวกับการ์ด
   *  - คงเหลือโหมดทั้งหมด = ใบเปิดที่ยังต้องหา (การ์ดนับจากใบเปิดจริง ไม่ใช่ cohort)
   */
  const statusPickPanel = useMemo(() => {
    if (!statusPick) return null;
    const { kpiId, label } = statusPick;
    /**
     * กล่อง "ทั้งหมด" / "ไม่มีสถานะ" ของสถานะทำงานโหมดมีงวด = ยอด cohort คงเหลือ (การนับเดิม) → แผงใช้ cohort เหมือนกล่องคงเหลือ
     * ไม่มี throughput (โหลดไม่ทัน) ให้ถอยไปใบใน feed
     */
    const cohortReady = cohortScope.records.length > 0;
    const statusFromCohort = Boolean(period) && cohortReady && (kpiId === 'work_status_total' || kpiId === 'work_status_none');
    const cohortKpi = statusFromCohort ? 'remaining' : COHORT_KPI_IDS.find((k) => k === kpiId);
    if (cohortKpi && (cohortKpi !== 'remaining' || period)) {
      const { from, to, records } = cohortScope;
      const drill = buildCohortDrillDown(records, from, to, cohortKpi);
      const full = buildCohortLeadPanel(drill.rows, (row) => {
        // คีย์ด้วย id เต็มก่อน — เลขที่ใบเปล่าอาจชี้ไปใบขอชั่วคราวเลขเดียวกัน
        const feedJob = (row.jobId ? jobById.get(row.jobId) : undefined) ?? jobById.get(row.requestNo);
        if (feedJob && !isPrequestJob(feedJob)) return { job: feedJob, inFeed: true };
        return { job: row.jobId ? ({ id: row.jobId, externalId: row.requestNo, source: 'siamraj' } as JobRequest) : null, inFeed: false };
      });
      const panel = kpiId === 'work_status_none' ? filterLeadPanel(full, (r) => r.status === NO_STATUS_LABEL) : full;
      const note =
        drill.positionsWithoutRequestNo > 0 && kpiId !== 'work_status_none'
          ? `ไม่มีเลขที่ใบ ${drill.positionsWithoutRequestNo.toLocaleString('th-TH')} อัตรา`
          : null;
      return { kpiId, label: statusFromCohort ? `สถานะ ${label}` : label, panel, amountLabel: LEAD_AMOUNT_LABEL[cohortKpi], note };
    }
    const range = period ?? (dateRange ? resolvePeriodRange('custom', dateRange) : null);
    const stock = filterJobsForRemainingKpi(jobsWithoutAgeFilter, range);
    const jobs =
      kpiId === 'remaining'
        ? stock
        : kpiId === PREQUEST_KPI_ID
          ? stock.filter(isPrequestJob)
          : (() => {
              const target = WORK_STATUS_OF_KPI[kpiId];
              const real = stock.filter((j) => !isPrequestJob(j));
              return target == null ? real : real.filter((j) => resolveUnitRequestWorkStatus(j.work_status) === target);
            })();
    return { kpiId, label: kpiId in WORK_STATUS_OF_KPI ? `สถานะ ${label}` : label, panel: buildStatusLeadPanel(jobs), amountLabel: LEAD_AMOUNT_LABEL.remaining, note: null };
  }, [statusPick, period, dateRange, jobsWithoutAgeFilter, cohortScope, jobById]);

  const handleKpiClick = useCallback(
    (kpiId: string, label: string, expectedRequests?: number | null) => {
      const range = period ?? (dateRange ? resolvePeriodRange('custom', dateRange) : null);
      const stockJobs = filterJobsForRemainingKpi(jobsWithoutAgeFilter, range);

      /**
       * เข้ามา/ปิดได้/ยกเลิก = cohort เสมอ · คงเหลือ = cohort เฉพาะโหมดมีงวด
       * (โหมด "ทั้งหมด" การ์ดคงเหลือนับจากใบเปิดจริง ไม่ใช่ cohort — ดู buildDashboardData)
       * ไม่มี throughput records (โหลดไม่ทัน/ล้มเหลว) ให้ถอยไปทางเดิม ไม่เปิดกล่องว่างเปล่า
       */
      const cohortReady = throughputRecords.length > 0;
      /** ร่าง 2 (เจ้าของ 29 ต.ค. 2569 "อันนั้นแก้เลย"): ไม่เด้งป๊อป — การ์ดเร่งด่วนเปลี่ยนเป็นใบของกล่องนี้ (`statusPickPanel`) */
      const togglePick = () => setStatusPick(pickId === kpiId ? null : kpiId);
      if (cohortReady && (kpiId === 'total_requests' || kpiId === 'closed' || kpiId === 'cancelled')) {
        togglePick();
        return;
      }
      if (kpiId === 'remaining' && (period ? cohortReady : true)) {
        togglePick();
        return;
      }

      if (kpiId === 'remaining' || kpiId === 'total_requests') {
        openJobList(
          label,
          kpiId === 'remaining'
            ? stockJobs.filter((j) => {
                const rem = j.position_units ?? 0;
                const req = j.request_positions;
                if (req != null && j.filled_positions != null) {
                  return Math.max(req - (j.filled_positions ?? 0) - (j.cancelled_positions ?? 0), 0) > 0;
                }
                return rem > 0 || j.status === 'open' || j.status === 'in_progress';
              })
            : stockJobs,
        );
        return;
      }

      if (kpiId === 'closed') {
        void openClosedJobList(label, expectedRequests);
        return;
      }

      if (kpiId === 'cancelled') {
        openJobList(
          label,
          stockJobs.filter((j) => (j.cancelled_positions ?? 0) > 0),
        );
        return;
      }

      if (kpiId.startsWith('work_status_')) {
        // 29 ต.ค. 2569 เจ้าของ (แบบร่างที่เคาะ "ทำเลย"): ไม่เด้งป๊อปแล้ว — การ์ดเร่งด่วนเปลี่ยนเป็นใบของสถานะนี้ (`DashboardStatusLeadPanel`)
        if (kpiId in WORK_STATUS_OF_KPI || kpiId === PREQUEST_KPI_ID) {
          togglePick();
          return;
        }
      }

      if (range && ['total_workload', 'new_requests', 'fulfilled', 'filled', 'fully_closed', 'partial', 'sla_risk', 'backlog_change'].includes(kpiId)) {
        openControlList(label, filterRecordsForControlKpi(controlRecords, kpiId, range));
        return;
      }
      if (kpiId === 'completed' || kpiId === 'success_rate' || kpiId === 'filled') {
        if (siamrajPrimary && dbSource === 'sqlserver') {
          openJobList(label, scopedClosedJobs);
          return;
        }
        const ytd = period ?? resolveYearToDateTrendRange();
        openJobList(label, filterJobsClosedInPeriod(jobsWithoutAgeFilter, ytd.from, ytd.to));
        return;
      }
      openJobList(label, filterJobsForDashboardKpi(scopedJobs, kpiId));
    },
    [pickId, setStatusPick, openJobList, openClosedJobList, openControlList, throughputRecords, controlRecords, scopedJobs, scopedClosedJobs, jobsWithoutAgeFilter, siamrajPrimary, dbSource, period, dateRange],
  );

  const handleCohortClick = useCallback(
    (rowId: string, label: string) => {
      if (!period) return;
      openControlList(label, filterRecordsForCohort(controlRecords, rowId, period));
    },
    [openControlList, controlRecords, period],
  );

  const handleSlaClick = useCallback(
    (bucket: string, label: string) => {
      openControlList(`SLA: ${label}`, filterRecordsForSlaBucket(controlRecords, bucket));
    },
    [openControlList, controlRecords],
  );

  /**
   * ตาราง "ปิดทัน / ไม่ทัน ตามชนิดใบขอ" (เจ้าของสั่ง 22 ส.ค. 2569)
   *
   * ⚠️ ใช้ `controlRecords` ชุดเดียวกับที่การ์ด KPI / drill-down อื่นใช้ — ตารางจึงขยับ
   * ตามตัวกรองของหน้าเองโดยไม่ต้องมี state แยก (กติกาเดียวกับกราฟชนิดใบขอ)
   */
  /**
   * 🔴 ตาราง "ปิดทัน / ไม่ทัน" = ใบชุดเดียวกับการ์ด "ใบขอเร่งด่วนแค่ไหน" (`cohortScope` · เจ้าของ 29 ต.ค. 2569 "ยอดมันไม่ตรงกันหรอ")
   * เดิมนับใบเปิด + ใบที่ "ปิดในช่วง" (รวมใบที่ยื่นก่อนช่วง) ⇒ 6,701 ไม่เท่าการ์ด 6,005
   * ⇒ เก็บเฉพาะใบที่อยู่ในชุดของการ์ด · ใบในชุดที่หาใบไม่เจอ = "คิด SLA ไม่ได้" ของชนิดนั้น (ยอดรวมเท่าการ์ดเสมอ)
   * ยังไม่มีชุดของการ์ด (throughput ยังไม่มา) = ใช้ชุดเดิม
   */
  const slaCohort = useMemo(() => {
    // ใบปิดยังไม่มา (โหมดทั้งหมดดึง ~40 วิ) = ใช้ชุดเดิม (ใบยังไม่ปิด + "กำลังดึง") — ไม่งั้นช่อง "คิด SLA ไม่ได้" บวมชั่วคราว
    // โหมดเลือกช่วงก็ใช้ชุดของการ์ด (QA 30 ต.ค. 2569: เดือนนี้ตารางเคยรวม 303 ใบ แต่การ์ดเข้ามา 180 —
    // ชุดเดิมรวมใบที่ปิดในช่วงแต่ยื่นก่อนช่วง) · ใบในชุดที่หาใบไม่เจอ = "คิด SLA ไม่ได้" ยอดรวมเท่าการ์ด
    if (cohortScope.records.length === 0 || (!period && !closedAllJobs)) {
      return {
        records: slaControlRecords,
        extraUnknown: {} as Partial<Record<RequestLeadKind, number>>,
        kindOf: undefined as ((r: RequestControlRecord) => RequestLeadKind | undefined) | undefined,
      };
    }
    const keyOfRecord = (r: { requestNo?: string; jobId?: string }) => (r.requestNo ?? '').trim() || (r.jobId ?? '').trim();
    const wanted = new Map<string, RequestLeadKind | undefined>();
    for (const r of cohortScope.records) {
      const k = keyOfRecord(r);
      if (k && !wanted.has(k)) wanted.set(k, r.leadKind);
    }
    const seen = new Set<string>();
    const records = slaControlRecords.filter((r) => {
      const k = wanted.has(r.requestNo) ? r.requestNo : wanted.has(r.id) ? r.id : null;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const extraUnknown: Partial<Record<RequestLeadKind, number>> = {};
    for (const [k, kind] of wanted) {
      if (seen.has(k) || !kind) continue;
      extraUnknown[kind] = (extraUnknown[kind] ?? 0) + 1;
    }
    // ชนิดใบขอ = ของชุดการ์ด (แถวตารางเท่าแถวการ์ดรายชนิด)
    const kindOf = (r: RequestControlRecord) => wanted.get(r.requestNo) ?? wanted.get(r.id);
    return { records, extraUnknown, kindOf };
  }, [cohortScope.records, slaControlRecords, period, closedAllJobs]);
  const slaByLeadKind = useMemo(
    () => buildSlaByLeadKind(slaCohort.records, new Date(), slaCohort.extraUnknown, slaCohort.kindOf),
    [slaCohort],
  );

  const handleSlaCellClick = useCallback(
    (kind: RequestLeadKind, cell: SlaCellKey, label: string) => {
      openControlList(`SLA · ${label}`, filterRecordsForSlaCell(slaCohort.records, kind, cell, new Date(), slaCohort.kindOf));
    },
    [openControlList, slaCohort],
  );

  const handleSlaLeadKindClick = useCallback(
    (kind: RequestLeadKind, label: string) => {
      openControlList(`ใบขอชนิด ${label}`, filterRecordsForLeadKind(slaCohort.records, kind, new Date(), slaCohort.kindOf));
    },
    [openControlList, slaCohort],
  );

  const handleFilledBreakdownClick = useCallback(
    (segment: 'same' | 'backlog', label: string) => {
      if (!period) return;
      openControlList(label, filterRecordsForFilledBreakdown(controlRecords, segment, period));
    },
    [openControlList, controlRecords, period],
  );

  const handleFullyClosedBreakdownClick = useCallback(
    (segment: 'same' | 'backlog', label: string) => {
      if (!period) return;
      openControlList(label, filterRecordsForFullyClosedBreakdown(controlRecords, segment, period));
    },
    [openControlList, controlRecords, period],
  );

  const handleAgeBucketClick = useCallback(
    (bucket: Parameters<typeof filterJobsForAgeBucket>[1], label: string) => {
      const range = period ?? (dateRange ? resolvePeriodRange('custom', dateRange) : null);
      const stockJobs = filterJobsForRemainingKpi(jobsWithoutAgeFilter, range);
      openJobList(`วันผ่านมา: ${label}`, filterJobsForAgeBucket(stockJobs, bucket));
    },
    [openJobList, jobsWithoutAgeFilter, period, dateRange],
  );

  const handleSiteClick = useCallback(
    (siteCode: string | undefined, label: string) => {
      openJobList(`รหัสไซต์: ${label}`, filterJobsForSiteCode(scopedJobs, siteCode));
    },
    [openJobList, scopedJobs],
  );

  const handleRecruiterClick = useCallback(
    (name: string, role: 'recruiter' | 'screener') => {
      const roleLabel = role === 'screener' ? 'คัดสรร' : 'สรรหา';
      openJobList(`${roleLabel}: ${name}`, filterJobsForRecruiter(scopedJobs, name, role));
    },
    [openJobList, scopedJobs],
  );

  /**
   * กดแท่ง "เข้ามารายเดือน" → กรองทั้งแดชบอร์ดเป็นเดือนนั้น
   * (เจ้าของสั่ง 10 ส.ค. 2569: "กดแล้วข้อมูลเปลี่ยนตามเหมือนเป็น calendar ตัวนึงเลย")
   *
   * ⚠️ คิดวันสิ้นเดือนด้วย `new Date(y, m, 0)` = วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
   * ครอบคลุมทั้ง 28/29/30/31 โดยไม่ต้องมีตารางวัน · กดแท่งเดิมซ้ำ = กลับไปช่วงเริ่มต้น
   */
  const handleMonthClick = useCallback(
    (monthStartYmd: string) => {
      const ym = monthStartYmd.slice(0, 7);
      if (dateRange && dateRange.from.slice(0, 7) === ym && dateRange.to.slice(0, 7) === ym) {
        setDateRange(defaultDashboardDateRange());
        return;
      }
      const [y, m] = ym.split('-').map(Number);
      if (!Number.isFinite(y) || !Number.isFinite(m)) return;
      const lastDay = new Date(y, m, 0).getDate();
      setDateRange({ from: `${ym}-01`, to: `${ym}-${String(lastDay).padStart(2, '0')}` });
    },
    [dateRange],
  );

  /** เดือนที่กำลังกรองอยู่ — มีค่าเมื่อช่วงที่เลือกอยู่ในเดือนเดียวกันทั้งต้นและท้าย */
  const selectedMonth =
    dateRange && dateRange.from.slice(0, 7) === dateRange.to.slice(0, 7)
      ? dateRange.from.slice(0, 7)
      : null;

  const handleExport = useCallback(() => {
    exportWorkQueueCsv(data.workQueue, `work-queue-${period?.from ?? 'all'}-${period?.to ?? 'all'}.csv`);
  }, [data.workQueue, period]);

  return (
    <>
    <DashboardShell
      data={data}
      filters={filters}
      onFiltersChange={patchFilters}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      onMonthClick={handleMonthClick}
      selectedMonth={selectedMonth}
      unitFilters={unitFilters}
      onUnitFiltersChange={patchUnitFilters}
      siamrajPrimary={siamrajPrimary}
      lockedDepartmentCode={lockedDepartmentCode}
      filterOptions={{
        departmentOptions: filterApi.departmentOptions,
        jobSubtypeOptions: filterApi.jobSubtypeOptions,
        unitOptions: filterApi.unitOptions,
        recruiters: filterApi.recruiters,
        screeners: filterApi.screeners,
        opls: filterApi.opls,
        unassignedRecruiterCount: filterApi.unassignedRecruiterCount,
        unassignedScreenerCount: filterApi.unassignedScreenerCount,
        unassignedOplCount: filterApi.unassignedOplCount,
      }}
      loading={loading && !DEMO_MODE}
      loadError={feedProblem}
      partialError={
        [sideFailed.throughput ? 'โหลดยอดตามช่วงไม่สำเร็จ' : null, sideFailed.closed ? 'โหลดใบที่ปิดแล้วไม่สำเร็จ' : null]
          .filter(Boolean)
          .join(' · ') || null
      }
      refreshing={refreshing}
      onRefresh={() => {
        void refetch();
        setSideRev((n) => n + 1);
        setClosedAllJobs(null);
      }}
      onExport={handleExport}
      onViewItem={handleView}
      onKpiClick={DEMO_MODE ? undefined : handleKpiClick}
      statusPick={statusPickPanel}
      onStatusPickClear={() => setStatusPick(null)}
      onOpenJob={(job) => navigateToUnitRequest(job, navigate, { returnTo: RETURN_TO })}
      leadKindBreakdown={leadKindBreakdown}
      leadKindMismatch={leadKindMismatch}
      onLeadKindClick={DEMO_MODE ? undefined : handleLeadKindClick}
      onCohortClick={DEMO_MODE ? undefined : handleCohortClick}
      onFilledBreakdownClick={DEMO_MODE ? undefined : handleFilledBreakdownClick}
      onFullyClosedBreakdownClick={DEMO_MODE ? undefined : handleFullyClosedBreakdownClick}
      onAgeBucketClick={DEMO_MODE ? undefined : handleAgeBucketClick}
      onSiteClick={DEMO_MODE ? undefined : handleSiteClick}
      slaByLeadKind={slaByLeadKind}
      /* ใบปิดถูกดึงเมื่อ (ก) เลือกช่วงเวลา หรือ (ข) กดดึงเองในโหมด "ทั้งหมด"
         ไม่ครบสองข้อนี้ = ตารางบอกตรง ๆ ว่ายังตอบ ปิดทัน/ไม่ทัน ไม่ได้ */
      slaClosedLoaded={period != null || closedAllJobs != null}
      onLoadClosedForSla={period ? undefined : requestClosedTotals}
      onSlaCellClick={DEMO_MODE ? undefined : handleSlaCellClick}
      onSlaRowClick={DEMO_MODE ? undefined : handleSlaLeadKindClick}
      closedTotalsAvailable={closedTotalsAvailable}
      onRecruiterPanelOpen={requestClosedTotals}
      closedTotalsLoading={closedAllLoading}
      onRecruiterClick={DEMO_MODE ? undefined : handleRecruiterClick}
    />
    <DetailListDialog
      open={detailDialogOpen}
      onOpenChange={setDetailDialogOpen}
      title={detailDialogTitle}
      items={detailDialogItems}
      emptyMessage={
        detailDialogLoading ? 'กำลังโหลดรายการใบขอที่ปิดแล้ว…' : 'ไม่มีใบขอในกลุ่มนี้'
      }
    />
  </>
  );
};

export default SupervisorDashboard;
