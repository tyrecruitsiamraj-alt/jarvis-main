import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '@/components/dashboard/analytics/DashboardShell';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { useSiamrajUnitRequestFilters } from '@/hooks/useSiamrajUnitRequestFilters';
import {
  buildDashboardData,
  filterJobsByRequestDate,
  resolvePeriodRange,
  sortWorkQueue,
} from '@/lib/dashboard/buildDashboardData';
import { loadDashboardFilters, saveDashboardFilters } from '@/lib/dashboard/dashboardPageState';
import { exportWorkQueueCsv } from '@/lib/dashboard/exportWorkQueue';
import { MOCK_DASHBOARD_DATA } from '@/lib/dashboard/mockDashboardData';
import type { DashboardFilters, DashboardPeriodPreset, DashboardSortDir, DashboardSortKey, DashboardWorkItem } from '@/lib/dashboard/types';
import { toYmdLocal } from '@/lib/dateTh';
import { JOB_STAFF_ROSTER_CHANGED_EVENT } from '@/lib/jobStaffRemote';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import {
  loadSupervisorDashboardFilters,
  saveSupervisorDashboardFilters,
} from '@/lib/supervisorDashboardPageState';
import type { JobRequest } from '@/types';

const DEMO_MODE = import.meta.env.VITE_DASHBOARD_DEMO === 'true';

function defaultMonthRange(): DateRangeYmd {
  const now = new Date();
  return { from: toYmdLocal(startOfMonth(now)), to: toYmdLocal(endOfMonth(now)) };
}

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DashboardFilters>(() => loadDashboardFilters());
  const [unitFilters, setUnitFilters] = useState(() => loadSupervisorDashboardFilters());
  const [periodPreset, setPeriodPreset] = useState<DashboardPeriodPreset>('this_month');
  const [dateRange, setDateRange] = useState<DateRangeYmd | null>(() => defaultMonthRange());
  const [sortKey, setSortKey] = useState<DashboardSortKey>('priority');
  const [sortDir, setSortDir] = useState<DashboardSortDir>('asc');
  const [staffRosterRev, setStaffRosterRev] = useState(0);

  const { jobs, loading, refreshing, refetch, siamrajPrimary } = useUnitRequestsFeed();
  const filterApi = useSiamrajUnitRequestFilters(jobs, siamrajPrimary, unitFilters, staffRosterRev);

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
    if (!filterApi.unitOptions.includes(unitFilters.unitFilter)) {
      setUnitFilters((prev) => ({ ...prev, unitFilter: 'all' }));
    }
  }, [unitFilters.departmentFilter, unitFilters.jobSubtypeFilter, unitFilters.unitFilter, filterApi.unitOptions]);

  const patchFilters = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const patchUnitFilters = useCallback((patch: Partial<typeof unitFilters>) => {
    setUnitFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const applyPeriodPreset = useCallback((preset: DashboardPeriodPreset) => {
    const period = resolvePeriodRange(preset);
    setPeriodPreset(preset);
    setDateRange({ from: period.from, to: period.to });
    patchFilters({ periodPreset: preset });
  }, [patchFilters]);

  const period = useMemo(
    () => resolvePeriodRange(periodPreset, dateRange ?? undefined),
    [periodPreset, dateRange],
  );

  const jobById = useMemo(() => {
    const map = new Map<string, JobRequest>();
    for (const j of jobs) map.set(j.id, j);
    return map;
  }, [jobs]);

  const data = useMemo(() => {
    if (DEMO_MODE) return MOCK_DASHBOARD_DATA;

    const unitFiltered = filterApi.filteredJobs;
    const scoped = filterJobsByRequestDate(unitFiltered, period.from, period.to);
    const previousScoped = filterJobsByRequestDate(unitFiltered, period.previousFrom, period.previousTo);
    const built = buildDashboardData(scoped, previousScoped, period, filters);
    return {
      ...built,
      workQueue: sortWorkQueue(built.workQueue, sortKey, sortDir),
    };
  }, [filterApi.filteredJobs, period, filters, sortKey, sortDir, jobs]);

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
      const job = jobById.get(item.id);
      if (job) {
        navigateToUnitRequest(job, navigate);
        return;
      }
      if (DEMO_MODE) return;
    },
    [jobById, navigate],
  );

  const handleExport = useCallback(() => {
    exportWorkQueueCsv(data.workQueue, `work-queue-${periodPreset}.csv`);
  }, [data.workQueue, periodPreset]);

  return (
    <DashboardShell
      data={data}
      filters={filters}
      onFiltersChange={patchFilters}
      periodPreset={periodPreset}
      onPeriodPreset={applyPeriodPreset}
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
        unassignedRecruiterCount: filterApi.unassignedRecruiterCount,
        unassignedScreenerCount: filterApi.unassignedScreenerCount,
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
    />
  );
};

export default SupervisorDashboard;
