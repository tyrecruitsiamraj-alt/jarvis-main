import React from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardData, DashboardFilters, DashboardResponsibleRole, DashboardSortDir, DashboardSortKey, DashboardStatusFilter } from '@/lib/dashboard/types';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import DashboardFilterBar from './DashboardFilterBar';
import DashboardKpiCard from './DashboardKpiCard';
import DashboardChartSection from './DashboardChartSection';
import DashboardAgeOverview from './DashboardAgeOverview';
import DashboardDriverOverview from './DashboardDriverOverview';
import DashboardWorkQueueTable from './DashboardWorkQueueTable';
import type { DashboardWorkItem } from '@/lib/dashboard/types';

type FilterOptions = {
  departmentOptions: { value: string; label: string }[];
  jobSubtypeOptions: { value: string; label: string }[];
  unitOptions: string[];
  recruiters: string[];
  screeners: string[];
  opls: string[];
  unassignedRecruiterCount: number;
  unassignedScreenerCount: number;
  unassignedOplCount: number;
};

type Props = {
  data: DashboardData;
  filters: DashboardFilters;
  onFiltersChange: (patch: Partial<DashboardFilters>) => void;
  dateRange: DateRangeYmd | null;
  onDateRangeChange: (range: DateRangeYmd | null) => void;
  unitFilters: UnitRequestFilterState;
  onUnitFiltersChange: (patch: Partial<UnitRequestFilterState>) => void;
  siamrajPrimary: boolean;
  filterOptions: FilterOptions;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
  sortKey: DashboardSortKey;
  sortDir: DashboardSortDir;
  onSort: (key: DashboardSortKey) => void;
  onViewItem: (item: DashboardWorkItem) => void;
  onAssignItem?: (item: DashboardWorkItem) => void;
  onKpiClick?: (kpiId: string, label: string) => void;
  onAgeBucketClick?: (bucket: DashboardData['ageDaysBreakdown'][number]['bucket'], label: string) => void;
  onUnitClick?: (unitName: string) => void;
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
};

const DashboardShell: React.FC<Props> = ({
  data,
  filters,
  onFiltersChange,
  dateRange,
  onDateRangeChange,
  unitFilters,
  onUnitFiltersChange,
  siamrajPrimary,
  filterOptions,
  loading,
  refreshing,
  onRefresh,
  onExport,
  sortKey,
  sortDir,
  onSort,
  onViewItem,
  onAssignItem,
  onKpiClick,
  onAgeBucketClick,
  onUnitClick,
  onRecruiterClick,
}) => {
  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Analytics Dashboard</h1>
              <p className="text-sm text-slate-500 mt-1">ภาพรวมใบขอหน่วยงาน · {data.periodLabel}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto lg:min-w-[420px]">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ search: e.target.value })}
                  placeholder="ค้นหาใบงาน, คน, ปลายทาง..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <div className="flex gap-2">
                {onRefresh ? (
                  <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    รีเฟรช
                  </button>
                ) : null}
                {onExport ? (
                  <button
                    type="button"
                    onClick={onExport}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-5">
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">กำลังโหลดข้อมูล…</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)] gap-5">
            <DashboardFilterBar
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              unitFilters={unitFilters}
              onUnitFiltersChange={onUnitFiltersChange}
              siamrajPrimary={siamrajPrimary}
              filterOptions={filterOptions}
              queueStatus={filters.queueStatus}
              onQueueStatusChange={(queueStatus: DashboardStatusFilter) => onFiltersChange({ queueStatus })}
            />

            <div className="space-y-5 min-w-0">
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                {data.kpis.map((kpi) => (
                  <DashboardKpiCard
                    key={kpi.id}
                    kpi={kpi}
                    onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label) : undefined}
                  />
                ))}
              </div>

              <DashboardAgeOverview
                items={data.ageDaysBreakdown}
                requestTotal={data.ageDaysRequestTotal}
                positionTotal={data.ageDaysPositionTotal}
                onBucketClick={onAgeBucketClick}
              />
              <DashboardChartSection data={data} onUnitClick={onUnitClick} />
              <DashboardDriverOverview items={data.recruiterOverview} onRecruiterClick={onRecruiterClick} />
              <DashboardWorkQueueTable
                items={data.workQueue}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                onView={onViewItem}
                onAssign={onAssignItem}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardShell;
