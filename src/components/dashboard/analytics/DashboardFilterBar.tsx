import React from 'react';
import SearchablePicker from '@/components/shared/SearchablePicker';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import type { DashboardFilters, DashboardPeriodPreset, DashboardStatusFilter } from '@/lib/dashboard/types';
import { DASHBOARD_STATUS_LABELS } from '@/lib/dashboard/buildDashboardData';
import type { DashboardTaskStatus } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS: { value: DashboardPeriodPreset; label: string }[] = [
  { value: 'this_week', label: 'สัปดาห์นี้' },
  { value: 'this_month', label: 'เดือนนี้' },
  { value: 'last_week', label: 'สัปดาห์ที่แล้ว' },
  { value: 'last_month', label: 'เดือนที่แล้ว' },
  { value: 'custom', label: 'กำหนดเอง' },
];

const STATUS_OPTIONS: { value: DashboardStatusFilter; label: string }[] = [
  { value: 'all', label: 'ทุกสถานะ' },
  ...(Object.keys(DASHBOARD_STATUS_LABELS) as DashboardTaskStatus[]).map((s) => ({
    value: s as DashboardStatusFilter,
    label: DASHBOARD_STATUS_LABELS[s],
  })),
];

type Props = {
  filters: DashboardFilters;
  onChange: (patch: Partial<DashboardFilters>) => void;
  ownerOptions: { value: string; label: string; keywords?: string }[];
  unitOptions: { value: string; label: string }[];
  className?: string;
};

const DashboardFilterBar: React.FC<Props> = ({
  filters,
  onChange,
  ownerOptions,
  unitOptions,
  className,
}) => {
  const customRange: DateRangeYmd | null =
    filters.dateFrom && filters.dateTo ? { from: filters.dateFrom, to: filters.dateTo } : null;

  return (
    <aside
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto',
        className,
      )}
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900">ตัวกรอง</h2>
        <p className="text-xs text-slate-500 mt-0.5">เลือกช่วงเวลาและเงื่อนไข</p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">ช่วงเวลา</label>
        <div className="flex flex-wrap gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ periodPreset: opt.value })}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
                filters.periodPreset === opt.value
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {filters.periodPreset === 'custom' ? (
          <DateRangeCalendarPicker
            triggerId="dashboard-custom-range"
            className="w-full"
            value={customRange}
            onChange={(range) =>
              onChange({
                dateFrom: range?.from ?? '',
                dateTo: range?.to ?? '',
              })
            }
          />
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">สถานะงาน</label>
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as DashboardStatusFilter })}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">ผู้รับผิดชอบ (สรรหา)</label>
        <SearchablePicker
          value={filters.ownerName}
          onChange={(v) => onChange({ ownerName: v })}
          options={ownerOptions}
          placeholder="ค้นหาชื่อผู้รับผิดชอบ..."
          searchPlaceholder="พิมพ์ชื่อ..."
        />
        {filters.ownerName ? (
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => onChange({ ownerName: '' })}
          >
            ล้างตัวกรอง
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-slate-600">หน่วยงาน</label>
        <SearchablePicker
          value={filters.unitName}
          onChange={(v) => onChange({ unitName: v })}
          options={unitOptions}
          placeholder="ค้นหาชื่อหน่วยงาน..."
          searchPlaceholder="พิมพ์ชื่อหน่วยงาน..."
        />
        {filters.unitName ? (
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => onChange({ unitName: '' })}
          >
            ล้างตัวกรอง
          </button>
        ) : null}
      </div>
    </aside>
  );
};

export default DashboardFilterBar;
