import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { jobToDashboardDetailItem } from '@/lib/dashboard/dashboardDetailDialog';
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
import { fetchSiamrajThroughput, fetchSiamrajClosedRequests } from '@/lib/siamrajUnitRequestsApi';
import {
  filterJobsForThroughput,
  filterThroughputByDepartment,
  jobsToThroughputRecords,
  type ThroughputRecord,
} from '@/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

const DEMO_MODE = import.meta.env.VITE_DASHBOARD_DEMO === 'true';

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  /** admin เห็นทุกแผนก · คนอื่นที่มี department_code ถูกล็อกแผนก */
  const lockedDepartmentCode =
    user?.role !== 'admin' ? user?.department_code?.trim().toUpperCase() || null : null;
  const [filters, setFilters] = useState<DashboardFilters>(() => loadDashboardFilters());
  const [unitFilters, setUnitFilters] = useState(() => loadSupervisorDashboardFilters());
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(() => defaultDashboardDateRange());
  const [sortKey, setSortKey] = useState<DashboardSortKey>('priority');
  const [sortDir, setSortDir] = useState<DashboardSortDir>('asc');
  const [staffRosterRev, setStaffRosterRev] = useState(0);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailDialogTitle, setDetailDialogTitle] = useState('');
  const [detailDialogItems, setDetailDialogItems] = useState<ReturnType<typeof jobToDashboardDetailItem>[]>([]);

  const [throughputRecords, setThroughputRecords] = useState<ThroughputRecord[]>([]);
  const [closedJobs, setClosedJobs] = useState<JobRequest[]>([]);
  /**
   * โหมด "ทั้งหมด" ไม่ดึงชุดใบปิดตอนเปิดหน้า — ช่วงเต็มมี 2,700+ ใบ ใช้เวลา ~20 วิ
   * จะดึงก็ต่อเมื่อคนกดกางแผง "ภาระงานตามผู้รับผิดชอบ" ซึ่งเป็นที่เดียวที่ใช้ยอดปิดรายคน
   */
  const [closedAllJobs, setClosedAllJobs] = useState<JobRequest[] | null>(null);
  const [closedAllLoading, setClosedAllLoading] = useState(false);

  const RETURN_TO = '/dashboard';

  const { jobs, loading, refreshing, refetch, siamrajPrimary, dbSource } = useUnitRequestsFeed();

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
        if (!cancelled) setThroughputRecords(rows);
      })
      .catch(() => {
        if (!cancelled) setThroughputRecords([]);
      });
    return () => {
      cancelled = true;
    };
  }, [siamrajPrimary, dbSource, throughputFrom, throughputTo]);

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
        if (!cancelled) setClosedJobs(rows);
      })
      .catch(() => {
        if (!cancelled) setClosedJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [siamrajPrimary, dbSource, period]);

  /** กางแผง "ภาระงานตามผู้รับผิดชอบ" ในโหมดทั้งหมด → ค่อยดึงใบปิดของช่วงเดียวกับ throughput */
  const requestClosedTotals = useCallback(() => {
    if (DEMO_MODE || period || closedAllJobs || closedAllLoading) return;
    if (!(siamrajPrimary && dbSource === 'sqlserver')) return;
    setClosedAllLoading(true);
    void fetchSiamrajClosedRequests(throughputFrom, throughputTo)
      .then((rows) => setClosedAllJobs(rows))
      .catch(() => setClosedAllJobs([]))
      .finally(() => setClosedAllLoading(false));
  }, [period, closedAllJobs, closedAllLoading, siamrajPrimary, dbSource, throughputFrom, throughputTo]);

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
        // throughput มาจาก SQL เป็นยอดรวม ไม่ผ่าน filterUnitRequests เหมือน jobs
        // ต้องกรอง BU ที่นี่ ไม่งั้น KPI เข้ามา/ปิด/ยกเลิก ค้างที่ยอดทั้งบริษัท
        throughputRecords: filterThroughputByDepartment(
          throughputRecords,
          unitFilters.departmentFilter,
        ),
      },
      scopedClosedJobs,
      jobsWithoutAgeFilter,
    );
    return {
      ...built,
      workQueue: sortWorkQueue(built.workQueue, sortKey, sortDir),
      // โหมดทั้งหมด: ทับด้วยชุดที่รวมใบปิดที่โหลด on-demand แล้ว (ถ้ายังไม่โหลดก็ใช้ของเดิม)
      recruiterOverview: recruiterOverviewAllMode ?? built.recruiterOverview,
    };
  }, [scopedJobs, period, filters, sortKey, sortDir, jobs, siamrajPrimary, unitFilters, throughputRecords, scopedClosedJobs, jobsWithoutAgeFilter, trendMeta, recruiterOverviewAllMode]);

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

  const handleKpiClick = useCallback(
    (kpiId: string, label: string) => {
      const range = period ?? (dateRange ? resolvePeriodRange('custom', dateRange) : null);
      const stockJobs = filterJobsForRemainingKpi(jobsWithoutAgeFilter, range);

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
        openJobList(
          label,
          stockJobs.filter((j) => (j.filled_positions ?? 0) > 0),
        );
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
        const statusMap: Record<string, string | null> = {
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
        };
        const target = statusMap[kpiId];
        if (kpiId in statusMap) {
          openJobList(
            label,
            target == null
              ? stockJobs
              : stockJobs.filter((j) => resolveUnitRequestWorkStatus(j.work_status) === target),
          );
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
    [openJobList, openControlList, controlRecords, scopedJobs, scopedClosedJobs, jobsWithoutAgeFilter, siamrajPrimary, dbSource, period, dateRange],
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
      refreshing={refreshing}
      onRefresh={() => void refetch()}
      onExport={handleExport}
      onViewItem={handleView}
      onKpiClick={DEMO_MODE ? undefined : handleKpiClick}
      onCohortClick={DEMO_MODE ? undefined : handleCohortClick}
      onFilledBreakdownClick={DEMO_MODE ? undefined : handleFilledBreakdownClick}
      onFullyClosedBreakdownClick={DEMO_MODE ? undefined : handleFullyClosedBreakdownClick}
      onAgeBucketClick={DEMO_MODE ? undefined : handleAgeBucketClick}
      onSiteClick={DEMO_MODE ? undefined : handleSiteClick}
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
      emptyMessage="ไม่มีใบขอในกลุ่มนี้"
    />
  </>
  );
};

export default SupervisorDashboard;
