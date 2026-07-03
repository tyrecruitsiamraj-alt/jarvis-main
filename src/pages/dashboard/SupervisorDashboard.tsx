import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '@/components/dashboard/analytics/DashboardShell';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import {
  buildDashboardData,
  ownerOptionsFromJobs,
  sortWorkQueue,
  unitOptionsFromJobs,
} from '@/lib/dashboard/buildDashboardData';
import { loadDashboardFilters, saveDashboardFilters } from '@/lib/dashboard/dashboardPageState';
import { exportWorkQueueCsv } from '@/lib/dashboard/exportWorkQueue';
import { MOCK_DASHBOARD_DATA } from '@/lib/dashboard/mockDashboardData';
import type { DashboardFilters, DashboardSortDir, DashboardSortKey, DashboardWorkItem } from '@/lib/dashboard/types';
import { navigateToUnitRequest } from '@/lib/jobNavigation';
import type { JobRequest } from '@/types';

const DEMO_MODE = import.meta.env.VITE_DASHBOARD_DEMO === 'true';

const SupervisorDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<DashboardFilters>(() => loadDashboardFilters());
  const [sortKey, setSortKey] = useState<DashboardSortKey>('priority');
  const [sortDir, setSortDir] = useState<DashboardSortDir>('asc');

  const { jobs, loading, refreshing, refetch } = useUnitRequestsFeed();

  useEffect(() => {
    saveDashboardFilters(filters);
  }, [filters]);

  const patchFilters = useCallback((patch: Partial<DashboardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const jobById = useMemo(() => {
    const map = new Map<string, JobRequest>();
    for (const j of jobs) map.set(j.id, j);
    return map;
  }, [jobs]);

  const data = useMemo(() => {
    if (DEMO_MODE) {
      return MOCK_DASHBOARD_DATA;
    }
    const built = buildDashboardData(jobs, filters);
    return {
      ...built,
      workQueue: sortWorkQueue(built.workQueue, sortKey, sortDir),
    };
  }, [jobs, filters, loading, sortKey, sortDir]);

  const ownerOptions = useMemo(() => ownerOptionsFromJobs(jobs), [jobs]);
  const unitOptions = useMemo(() => unitOptionsFromJobs(jobs), [jobs]);

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
    exportWorkQueueCsv(data.workQueue, `work-queue-${filters.periodPreset}.csv`);
  }, [data.workQueue, filters.periodPreset]);

  return (
    <DashboardShell
      data={data}
      filters={filters}
      onFiltersChange={patchFilters}
      ownerOptions={ownerOptions}
      unitOptions={unitOptions}
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
