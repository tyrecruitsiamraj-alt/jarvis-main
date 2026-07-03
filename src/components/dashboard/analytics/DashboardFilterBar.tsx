import React from 'react';
import UnitRequestFilterFields from '@/components/jobs/UnitRequestFilterFields';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DashboardStatusFilter } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';
import type { DashboardTaskStatus } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';

const QUEUE_STATUS_OPTIONS: { value: DashboardStatusFilter; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ (ตาราง)' },
  ...(Object.keys(DASHBOARD_STATUS_LABELS) as DashboardTaskStatus[]).map((s) => ({
    value: s as DashboardStatusFilter,
    label: DASHBOARD_STATUS_LABELS[s],
  })),
];

type FilterOptions = {
  departmentOptions: { value: string; label: string }[];
  jobSubtypeOptions: { value: string; label: string }[];
  unitOptions: string[];
  recruiters: string[];
  screeners: string[];
  unassignedRecruiterCount: number;
  unassignedScreenerCount: number;
};

type Props = {
  dateRange: DateRangeYmd | null;
  onDateRangeChange: (range: DateRangeYmd | null) => void;
  unitFilters: UnitRequestFilterState;
  onUnitFiltersChange: (patch: Partial<UnitRequestFilterState>) => void;
  siamrajPrimary: boolean;
  filterOptions: FilterOptions;
  queueStatus: DashboardStatusFilter;
  onQueueStatusChange: (status: DashboardStatusFilter) => void;
  className?: string;
};

const DashboardFilterBar: React.FC<Props> = ({
  dateRange,
  onDateRangeChange,
  unitFilters,
  onUnitFiltersChange,
  siamrajPrimary,
  filterOptions,
  queueStatus,
  onQueueStatusChange,
  className,
}) => {
  return (
    <aside
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto',
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">ตัวกรอง</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          ช่วงเวลาและเงื่อนไขใบขอ · ตัวเลขแผนก/หน่วยงานตามช่วงวันที่กรอก
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dashboard-date-range" className="text-xs font-medium text-slate-600">
          วันที่กรอก
        </label>
        <DateRangeCalendarPicker
          triggerId="dashboard-date-range"
          className="w-full"
          value={dateRange}
          onChange={onDateRangeChange}
        />
      </div>

      <UnitRequestFilterFields
        idPrefix="analytics-dashboard"
        siamrajPrimary={siamrajPrimary}
        filters={unitFilters}
        onChange={onUnitFiltersChange}
        showStatusTabs
        showNoteFilter={false}
        showUnitFilter
        options={filterOptions}
        className="!space-y-3"
      />

      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-xs font-medium text-slate-600">กรองตารางงานติดตาม</label>
        <select
          value={queueStatus}
          onChange={(e) => onQueueStatusChange(e.target.value as DashboardStatusFilter)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {QUEUE_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
};

export default DashboardFilterBar;
