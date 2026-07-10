import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '@/components/dashboard/analytics/DashboardShell';
import DetailListDialog from '@/components/shared/DetailListDialog';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useSiamrajUnitRequestFilters, filterUnitRequests } from '@/hooks/useSiamrajUnitRequestFilters';
import {
  buildDashboardData,
  defaultDashboardDateRange,
  filterJobsByRequestDate,
  resolvePeriodRange,
  resolveYearToDateTrendRange,
  sortWorkQueue,
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
  filterJobsForRecruiter,
  filterJobsForUnitName,
} from '@/lib/dashboard/drillDownFilters';
import { unitOrganizationKey } from '@/lib/unitGroupName';
import { sumJobPositionUnits } from '@/lib/jobPositionUnits';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import {
  loadSupervisorDashboardFilters,
  saveSupervisorDashboardFilters,
} from '@/lib/supervisorDashboardPageState';
import { fetchSiamrajThroughput, fetchSiamrajClosedRequests } from '@/lib/siamrajUnitRequestsApi';
import {
  filterJobsForThroughput,
  jobsToThroughputRecords,
  type ThroughputRecord,
} from '@/lib/dashboard/throughput';
import type { JobRequest } from '@/types';

const DEMO_MODE = import.meta.env.VITE_DASHBOARD_DEMO === 'true';

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
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

  const RETURN_TO = '/dashboard';

  const { jobs, loading, refreshing, refetch, siamrajPrimary, dbSource } = useUnitRequestsFeed();

  const period = useMemo(
    () => (dateRange ? resolvePeriodRange('custom', dateRange) : null),
    [dateRange],
  );

  const throughputRange = useMemo(() => {
    if (period) return { from: period.previousFrom, to: period.to };
    const ytd = resolveYearToDateTrendRange();
    return { from: ytd.from, to: ytd.to };
  }, [period]);

  useEffect(() => {
    if (DEMO_MODE) {
      setThroughputRecords([]);
      return;
    }
    const range = throughputRange;
    if (!period) {
      setThroughputRecords(jobsToThroughputRecords(jobs));
      return;
    }
    if (siamrajPrimary && dbSource === 'sqlserver') {
      let cancelled = false;
      void fetchSiamrajThroughput(range.from, range.to)
        .then((rows) => {
          if (!cancelled) setThroughputRecords(rows);
        })
        .catch(() => {
          if (!cancelled) setThroughputRecords([]);
        });
      return () => {
        cancelled = true;
      };
    }
    setThroughputRecords(
      jobsToThroughputRecords(filterJobsForThroughput(jobs, range.from, range.to)),
    );
  }, [jobs, siamrajPrimary, dbSource, refreshing, period, throughputRange]);

  useEffect(() => {
    if (DEMO_MODE) {
      setClosedJobs([]);
      return;
    }
    if (!(siamrajPrimary && dbSource === 'sqlserver')) {
      setClosedJobs([]);
      return;
    }
    const range = period ?? resolveYearToDateTrendRange();
    let cancelled = false;
    void fetchSiamrajClosedRequests(range.from, range.to)
      .then((rows) => {
        if (!cancelled) setClosedJobs(rows);
      })
      .catch(() => {
        if (!cancelled) setClosedJobs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [siamrajPrimary, dbSource, period, refreshing]);

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
      // ตัวเลขหลัก = จำนวนคน/ตำแหน่ง (ให้ตรงกับการ์ดสรุป) + จำนวนใบขอในวงเล็บ
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

  const data = useMemo(() => {
    if (DEMO_MODE) return MOCK_DASHBOARD_DATA;

    const unitFilteredAll = filterUnitRequests(jobs, siamrajPrimary, unitFilters, { ageDaysFilter: true });
    const trendRange = period ?? resolveYearToDateTrendRange();
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
        throughputRecords,
      },
      scopedClosedJobs,
      jobsWithoutAgeFilter,
      jobs.map((j) => j.unit_name),
    );
    return {
      ...built,
      workQueue: sortWorkQueue(built.workQueue, sortKey, sortDir),
    };
  }, [scopedJobs, period, filters, sortKey, sortDir, jobs, siamrajPrimary, unitFilters, throughputRecords, scopedClosedJobs, jobsWithoutAgeFilter]);

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
      if (kpiId === 'completed' || kpiId === 'success_rate') {
        if (siamrajPrimary && dbSource === 'sqlserver') {
          openJobList(label, scopedClosedJobs);
          return;
        }
        const range = period ?? resolveYearToDateTrendRange();
        openJobList(label, filterJobsClosedInPeriod(jobsWithoutAgeFilter, range.from, range.to));
        return;
      }
      if (kpiId === 'remaining') {
        const list = period ? scopedJobs : jobsWithoutAgeFilter;
        openJobList(label, filterJobsForDashboardKpi(list, kpiId));
        return;
      }
      openJobList(label, filterJobsForDashboardKpi(scopedJobs, kpiId));
    },
    [openJobList, scopedJobs, scopedClosedJobs, jobsWithoutAgeFilter, siamrajPrimary, dbSource, period],
  );

  const handleAgeBucketClick = useCallback(
    (bucket: Parameters<typeof filterJobsForAgeBucket>[1], label: string) => {
      openJobList(`วันผ่านมา: ${label}`, filterJobsForAgeBucket(scopedJobs, bucket));
    },
    [openJobList, scopedJobs],
  );

  const handleUnitClick = useCallback(
    (unitName: string) => {
      openJobList(`หน่วยงาน: ${unitName}`, filterJobsForUnitName(scopedJobs, unitName));
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
      unitFilters={unitFilters}
      onUnitFiltersChange={patchUnitFilters}
      siamrajPrimary={siamrajPrimary}
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
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={handleSort}
      onViewItem={handleView}
      onAssignItem={handleView}
      onKpiClick={DEMO_MODE ? undefined : handleKpiClick}
      onAgeBucketClick={DEMO_MODE ? undefined : handleAgeBucketClick}
      onUnitClick={DEMO_MODE ? undefined : handleUnitClick}
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
