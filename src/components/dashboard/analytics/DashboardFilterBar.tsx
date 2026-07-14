import React, { useMemo } from 'react';
import { endOfMonth, startOfMonth } from 'date-fns';
import UnitRequestFilterFields from '@/components/jobs/UnitRequestFilterFields';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import type { UnitRequestFilterState } from '@/hooks/useSiamrajUnitRequestFilters';
import type { DashboardStatusFilter } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';
import { resolvePeriodRange } from '@/lib/dashboard/buildDashboardData';
import type { DashboardTaskStatus } from '@/lib/dashboard/types';
import { THAI_MONTHS, ceToBeYear, toYmdLocal } from '@/lib/dateTh';
import { cn } from '@/lib/utils';

const PERIOD_PRESETS = [
  { id: 'all' as const, label: 'ทั้งหมด' },
  { id: 'this_month' as const, label: 'เดือนนี้' },
  { id: 'last_month' as const, label: 'เดือนก่อน' },
];

const YEAR_OPTIONS_COUNT = 6;

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
  lockedDepartmentCode?: string | null;
  className?: string;
};

function monthRangeFromParts(month: number, yearCe: number): DateRangeYmd {
  const d = new Date(yearCe, month - 1, 1);
  return { from: toYmdLocal(startOfMonth(d)), to: toYmdLocal(endOfMonth(d)) };
}

/** ถ้าช่วงวันที่ตรงทั้งเดือน → คืน { month, yearCe } ไม่เช่นนั้น null */
function parseFullMonthSelection(range: DateRangeYmd | null): { month: number; yearCe: number } | null {
  if (!range?.from || !range?.to) return null;
  const fromParts = range.from.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!fromParts) return null;
  const yearCe = Number(fromParts[1]);
  const month = Number(fromParts[2]);
  if (!yearCe || month < 1 || month > 12) return null;
  const expected = monthRangeFromParts(month, yearCe);
  if (range.from !== expected.from || range.to !== expected.to) return null;
  return { month, yearCe };
}

const DashboardFilterBar: React.FC<Props> = ({
  dateRange,
  onDateRangeChange,
  unitFilters,
  onUnitFiltersChange,
  siamrajPrimary,
  filterOptions,
  queueStatus,
  onQueueStatusChange,
  lockedDepartmentCode = null,
  className,
}) => {
  const now = useMemo(() => new Date(), []);
  const yearOptionsCe = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: YEAR_OPTIONS_COUNT }, (_, i) => current - i);
  }, [now]);

  const fullMonth = parseFullMonthSelection(dateRange);
  const selectedMonth = fullMonth?.month ? String(fullMonth.month) : '';
  const selectedYearBe = fullMonth ? String(ceToBeYear(fullMonth.yearCe)) : '';

  const applyPreset = (preset: 'all' | 'this_month' | 'last_month') => {
    if (preset === 'all') {
      onDateRangeChange(null);
      return;
    }
    const p = resolvePeriodRange(preset);
    onDateRangeChange({ from: p.from, to: p.to });
  };

  const applyMonthYear = (monthStr: string, yearBeStr: string) => {
    if (!monthStr || !yearBeStr) {
      onDateRangeChange(null);
      return;
    }
    const month = Number(monthStr);
    const yearBe = Number(yearBeStr);
    if (!month || month < 1 || month > 12 || !yearBe) {
      onDateRangeChange(null);
      return;
    }
    onDateRangeChange(monthRangeFromParts(month, yearBe - 543));
  };

  const activePreset = (() => {
    if (!dateRange) return 'all';
    for (const preset of PERIOD_PRESETS) {
      if (preset.id === 'all') continue;
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
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">ช่วงเวลา</label>
        <div className="flex flex-wrap gap-2">
          {PERIOD_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                'flex-1 min-w-[4.5rem] rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
                activePreset === preset.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label htmlFor="dashboard-month-select" className="text-[11px] text-slate-500">
              เดือน
            </label>
            <select
              id="dashboard-month-select"
              value={selectedMonth}
              onChange={(e) => {
                const month = e.target.value;
                const yearBe =
                  selectedYearBe || String(ceToBeYear(now.getFullYear()));
                applyMonthYear(month, month ? yearBe : '');
              }}
              className="jarvis-filter-select w-full text-sm"
              aria-label="เลือกเดือน"
            >
              <option value="">เดือน…</option>
              {THAI_MONTHS.map((m) => (
                <option key={m.value} value={String(m.value)}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="dashboard-year-select" className="text-[11px] text-slate-500">
              ปี (พ.ศ.)
            </label>
            <select
              id="dashboard-year-select"
              value={selectedYearBe}
              onChange={(e) => {
                const yearBe = e.target.value;
                const month = selectedMonth || String(now.getMonth() + 1);
                applyMonthYear(yearBe ? month : '', yearBe);
              }}
              className="jarvis-filter-select w-full text-sm"
              aria-label="เลือกปี"
            >
              <option value="">ปี…</option>
              {yearOptionsCe.map((y) => {
                const be = ceToBeYear(y);
                return (
                  <option key={y} value={String(be)}>
                    {be}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
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
        showStatusTabs={false}
        showNoteFilter={false}
        showAgeDaysFilter={false}
        showUnitFilter
        lockedDepartmentCode={lockedDepartmentCode}
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
