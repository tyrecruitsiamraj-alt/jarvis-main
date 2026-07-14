import React, { useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DashboardData, DashboardFilters, DashboardResponsibleRole, DashboardSortDir, DashboardSortKey, DashboardStatusFilter } from '@/lib/dashboard/types';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import DashboardFilterBar from './DashboardFilterBar';
import DashboardKpiCard from './DashboardKpiCard';
import DashboardChartSection from './DashboardChartSection';
import DashboardAgeOverview from './DashboardAgeOverview';
import DashboardUnitOverviewChart from './DashboardUnitOverviewChart';
import DashboardDriverOverview from './DashboardDriverOverview';
import DashboardExpandablePanel from './DashboardExpandablePanel';
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
  onCohortClick?: (rowId: string, label: string) => void;
  onSlaClick?: (bucket: string, label: string) => void;
  onFilledBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
  onFullyClosedBreakdownClick?: (segment: 'same' | 'backlog', label: string) => void;
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
  onCohortClick,
  onSlaClick,
  onFilledBreakdownClick,
  onFullyClosedBreakdownClick,
  onAgeBucketClick,
  onUnitClick,
  onRecruiterClick,
}) => {
  const [showUnitOverview, setShowUnitOverview] = useState(false);
  const [showRecruiterOverview, setShowRecruiterOverview] = useState(false);
  const [showWorkQueue, setShowWorkQueue] = useState(false);

  const activeUnitCount = data.unitOverview.filter((u) => u.open > 0).length;
  const unitOpenTotal = data.unitOverview.reduce((sum, u) => sum + u.open, 0);
  const recruiterRemainingTotal = data.recruiterOverview.reduce((sum, r) => sum + r.remaining, 0);

  return (
    <div className="min-h-full bg-slate-50 pb-24">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-slate-900">Request Control Tower</h1>
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
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">สรุปอัตราในช่วงที่เลือก</p>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {dateRange == null ? (
                      <>
                        <span className="font-medium text-slate-600">คงเหลือ = อัตราที่ยังต้องหาจากใบเปิดทั้งหมด</span>
                        {' · '}
                        เข้ามา/ปิดแล้ว/ยกเลิก = ของใบที่กรอกในช่วงแนวโน้ม
                      </>
                    ) : (
                      (() => {
                        const intake = data.kpis.find((k) => k.id === 'total_requests')?.value ?? 0;
                        const closed = data.kpis.find((k) => k.id === 'closed')?.value ?? 0;
                        const cancelled = data.kpis.find((k) => k.id === 'cancelled')?.value ?? 0;
                        const remaining = data.kpis.find((k) => k.id === 'remaining')?.value ?? 0;
                        return (
                          <>
                            เข้ามา − ปิดแล้ว − ยกเลิก = คงเหลือ · ตอนนี้ {intake.toLocaleString('th-TH')} −{' '}
                            {closed.toLocaleString('th-TH')} − {cancelled.toLocaleString('th-TH')} ={' '}
                            {remaining.toLocaleString('th-TH')}
                          </>
                        );
                      })()
                    )}
                  </p>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {data.kpis.map((kpi) => (
                      <DashboardKpiCard
                        key={kpi.id}
                        kpi={kpi}
                        onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label) : undefined}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-2">สถานะทำงาน (นับอัตรา)</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                    {(data.workStatusKpis ?? []).map((kpi) => (
                      <DashboardKpiCard
                        key={kpi.id}
                        kpi={kpi}
                        onClick={onKpiClick ? () => onKpiClick(kpi.id, kpi.label) : undefined}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <DashboardAgeOverview
                items={data.ageDaysBreakdown}
                requestTotal={data.ageDaysRequestTotal}
                positionTotal={data.ageDaysPositionTotal}
                onBucketClick={onAgeBucketClick}
              />

              <DashboardChartSection data={data} />
              <DashboardExpandablePanel
                title="ภาระงานตามผู้รับผิดชอบ"
                subtitle={
                  data.recruiterOverview.length > 0
                    ? `${data.recruiterOverview.length.toLocaleString('th-TH')} คน · คงเหลือ ${recruiterRemainingTotal.toLocaleString('th-TH')} · กดเพื่อดู`
                    : 'กดเพื่อดูรายละเอียด'
                }
                open={showRecruiterOverview}
                onOpenChange={setShowRecruiterOverview}
              >
                <DashboardDriverOverview
                  items={data.recruiterOverview}
                  onRecruiterClick={onRecruiterClick}
                  hideHeader
                />
              </DashboardExpandablePanel>
              <DashboardExpandablePanel
                title="ภาระงานตามหน่วยงาน"
                subtitle={
                  activeUnitCount > 0
                    ? `${unitOpenTotal.toLocaleString('th-TH')} ตำแหน่ง · ${activeUnitCount.toLocaleString('th-TH')} หน่วยงาน · กดเพื่อดู`
                    : 'กดเพื่อดูรายละเอียด'
                }
                open={showUnitOverview}
                onOpenChange={setShowUnitOverview}
              >
                <DashboardUnitOverviewChart
                  items={data.unitOverview}
                  periodLabel={data.periodLabel}
                  onUnitClick={onUnitClick}
                  hideHeader
                />
              </DashboardExpandablePanel>
              <DashboardExpandablePanel
                title="งานที่ต้องติดตาม"
                subtitle={`${data.workQueue.length.toLocaleString('th-TH')} รายการ — กดเพื่อดู`}
                open={showWorkQueue}
                onOpenChange={setShowWorkQueue}
              >
                <DashboardWorkQueueTable
                  items={data.workQueue}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSort}
                  onView={onViewItem}
                  onAssign={onAssignItem}
                  hideHeader
                />
              </DashboardExpandablePanel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardShell;
