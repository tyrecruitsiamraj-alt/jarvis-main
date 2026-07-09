import React from 'react';
import UnitRequestFilterFields from '@/components/jobs/UnitRequestFilterFields';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DashboardStatusFilter } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';
import { resolvePeriodRange } from '@/lib/dashboard/buildDashboardData';
import type { DashboardTaskStatus } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';

const PERIOD_PRESETS = [
  { id: 'this_month' as const, label: 'เดือนนี้' },
  { id: 'last_month' as const, label: 'เดือนก่อน' },
];

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
  opls: string[];
  unassignedRecruiterCount: number;
  unassignedScreenerCount: number;
  unassignedOplCount: number;
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
  const applyPreset = (preset: 'this_month' | 'last_month') => {
    const p = resolvePeriodRange(preset);
    onDateRangeChange({ from: p.from, to: p.to });
  };

  const activePreset = (() => {
    if (!dateRange) return null;
    for (const preset of PERIOD_PRESETS) {
      const p = resolvePeriodRange(preset.id);
      if (dateRange.from === p.from && dateRange.to === p.to) return preset.id;
    }
    return null;
  })();

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
          เงื่อนไขเดียวกับหน้ารายการหน่วยงาน · กรองวันที่กรอกได้เพิ่มเติม
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">ช่วงเวลา</label>
        <div className="flex gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                activePreset === preset.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <DateRangeCalendarPicker
          triggerId="dashboard-date-range"
          className="w-full"
          value={dateRange}
          onChange={onDateRangeChange}
        />
        <p className="text-[11px] text-slate-500">
          ย้อนหลังนับวันที่กรอก · ฉุกเฉิน/ล่วงหน้านับวันที่ต้องการ
        </p>
      </div>

      <UnitRequestFilterFields
        idPrefix="analytics-dashboard"
        siamrajPrimary={siamrajPrimary}
        filters={unitFilters}
        onChange={onUnitFiltersChange}
        showStatusTabs={false}
        showNoteFilter={false}
        showAgeDaysFilter={false}
        showUnitFilter
        layout="sidebar"
        options={filterOptions}
        className="!space-y-3"
      />

      <div className="space-y-1.5 pt-1 border-t border-slate-100">
        <label className="text-xs font-medium text-slate-600">กรองตารางงานติดตาม</label>
        <select
          value={queueStatus}
          onChange={(e) => onQueueStatusChange(e.target.value as DashboardStatusFilter)}
          className="jarvis-filter-select w-full text-sm"
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
