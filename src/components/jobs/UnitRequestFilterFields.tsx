import React from 'react';
import { FilterSelect } from '@/components/shared/FilterSelect';
import { FilterMultiSelect } from '@/components/shared/FilterMultiSelect';
import { cn } from '@/lib/utils';
import {
  AGE_DAYS_FILTER_OPTIONS,
  URGENCY_FILTER_OPTIONS,
  type AgeDaysFilter,
  type NoteFilter,
  type UrgencyFilter,
} from '@/lib/jobUrgency';
import {
  STAFF_ASSIGNEE_UNASSIGNED,
  STAFF_ASSIGNEE_UNASSIGNED_LABEL,
} from '@/lib/jobStaffNames';
import type { UnitRequestFilterState, UnitRequestStatusFilter } from '@/hooks/useSiamrajUnitRequestFilters';

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
  siamrajPrimary: boolean;
  filters: UnitRequestFilterState;
  onChange: (patch: Partial<UnitRequestFilterState>) => void;
  options: FilterOptions;
  idPrefix: string;
  showStatusTabs?: boolean;
  showUnitFilter?: boolean;
  showNoteFilter?: boolean;
  showAgeDaysFilter?: boolean;
  /** ถ้ามีค่า — ล็อกตัวกรองแผนกให้อยู่แผนกนี้ (ซ่อนตัวเลือกอื่น) */
  lockedDepartmentCode?: string | null;
  layout?: 'default' | 'sidebar';
  className?: string;
};

const UnitRequestFilterFields: React.FC<Props> = ({
  siamrajPrimary,
  filters,
  onChange,
  options,
  idPrefix,
  showStatusTabs = false,
  showUnitFilter = true,
  showNoteFilter = true,
  showAgeDaysFilter = true,
  lockedDepartmentCode = null,
  layout = 'default',
  className,
}) => {
  const {
    departmentOptions,
    jobSubtypeOptions,
    unitOptions,
    recruiters,
    screeners,
    opls,
    unassignedRecruiterCount,
    unassignedScreenerCount,
    unassignedOplCount,
  } = options;

  const selectClassName = layout === 'sidebar' ? 'text-sm' : undefined;

  return (
    <div className={cn('space-y-4', className)}>
      {showStatusTabs ? (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: 'all' as const, label: 'ทั้งหมด' },
              { value: 'active' as const, label: 'ยังดำเนินการอยู่' },
              { value: 'closed' as const, label: 'ปิดแล้ว' },
            ] satisfies { value: UnitRequestStatusFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => onChange({ statusFilter: f.value })}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap',
                filters.statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary/80 text-muted-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className={cn(
          'grid gap-3',
          layout === 'sidebar'
            ? 'grid-cols-1'
            : siamrajPrimary
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2',
        )}
      >
        {/* 7 ช่องเลือกได้หลายค่า (เจ้าของ 23 พ.ย. 2569 "ฟิลเตอร์ทำให้เลือกได้หลายอันหน่อย") — ตัวเดียวกับหน้าใบขอ (`FilterMultiSelect`) */}
        {siamrajPrimary ? (
          <FilterMultiSelect
            id={`${idPrefix}-department`}
            label={lockedDepartmentCode ? `แผนก (ล็อก ${lockedDepartmentCode})` : 'แผนก'}
            summaryNoun="แผนก"
            values={lockedDepartmentCode ? [lockedDepartmentCode] : filters.departmentFilter}
            disabled={Boolean(lockedDepartmentCode)}
            onChange={(v) => {
              if (lockedDepartmentCode) return;
              onChange({ departmentFilter: v });
            }}
            options={
              lockedDepartmentCode
                ? [{ value: lockedDepartmentCode, label: lockedDepartmentCode }]
                : departmentOptions.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))
            }
            className={selectClassName}
          />
        ) : null}

        {siamrajPrimary ? (
          <FilterMultiSelect
            id={`${idPrefix}-subtype`}
            label="ลักษณะงานย่อย"
            summaryNoun="ลักษณะงาน"
            values={filters.jobSubtypeFilter}
            onChange={(v) => onChange({ jobSubtypeFilter: v })}
            options={jobSubtypeOptions.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
            className={selectClassName}
          />
        ) : null}

        {showUnitFilter && unitOptions.length > 0 ? (
          <FilterMultiSelect
            id={`${idPrefix}-unit`}
            label="หน่วยงาน"
            summaryNoun="หน่วยงาน"
            values={filters.unitFilter}
            onChange={(v) => onChange({ unitFilter: v })}
            options={unitOptions.map((u) => ({ value: u, label: u }))}
            className={selectClassName}
          />
        ) : null}

        <FilterMultiSelect
          id={`${idPrefix}-recruiter`}
          label="เจ้าหน้าที่สรรหา"
          summaryNoun="คน"
          values={filters.recruiterFilter}
          onChange={(v) => onChange({ recruiterFilter: v })}
          options={[
            { value: STAFF_ASSIGNEE_UNASSIGNED, label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedRecruiterCount})` },
            ...recruiters.map((r) => ({ value: r, label: r })),
          ]}
          className={selectClassName}
        />

        <FilterMultiSelect
          id={`${idPrefix}-screener`}
          label="เจ้าหน้าที่คัดสรร"
          summaryNoun="คน"
          values={filters.screenerFilter}
          onChange={(v) => onChange({ screenerFilter: v })}
          options={[
            { value: STAFF_ASSIGNEE_UNASSIGNED, label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedScreenerCount})` },
            ...screeners.map((n) => ({ value: n, label: n })),
          ]}
          className={selectClassName}
        />

        <FilterMultiSelect
          id={`${idPrefix}-opl`}
          label="เจ้าหน้าที่ OPL"
          summaryNoun="คน"
          values={filters.oplFilter}
          onChange={(v) => onChange({ oplFilter: v })}
          options={[
            { value: STAFF_ASSIGNEE_UNASSIGNED, label: `${STAFF_ASSIGNEE_UNASSIGNED_LABEL} (${unassignedOplCount})` },
            ...opls.map((n) => ({ value: n, label: n })),
          ]}
          className={selectClassName}
        />

        <FilterMultiSelect
          id={`${idPrefix}-urgency`}
          label="สถานะใบขอ"
          summaryNoun="สถานะ"
          values={filters.urgencyFilter}
          onChange={(v) => onChange({ urgencyFilter: v as UrgencyFilter[] })}
          options={URGENCY_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((o) => ({ value: o.value, label: o.label }))}
          className={selectClassName}
        />

        {showNoteFilter ? (
          <FilterSelect
            id={`${idPrefix}-note`}
            label="หมายเหตุ"
            value={filters.noteFilter}
            onChange={(v) => onChange({ noteFilter: v as NoteFilter })}
            selectClassName={selectClassName}
          >
            <option value="all">ทั้งหมด</option>
            <option value="has">มีหมายเหตุ</option>
            <option value="empty">ไม่มีหมายเหตุ</option>
          </FilterSelect>
        ) : null}

        {showAgeDaysFilter ? (
          <FilterSelect
            id={`${idPrefix}-age`}
            label="วันผ่านมา"
            value={filters.ageDaysFilter}
            onChange={(v) => onChange({ ageDaysFilter: v as AgeDaysFilter })}
            selectClassName={selectClassName}
          >
            {AGE_DAYS_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        ) : null}
      </div>
    </div>
  );
};

export default UnitRequestFilterFields;
