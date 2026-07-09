import React from 'react';
import { FilterSelect } from '@/components/shared/FilterSelect';
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
              { value: 'active' as const, label: 'ดำเนินการ' },
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
        {siamrajPrimary ? (
          <FilterSelect
            id={`${idPrefix}-department`}
            label="แผนก"
            value={filters.departmentFilter}
            onChange={(v) => onChange({ departmentFilter: v })}
            selectClassName={selectClassName}
          >
            {departmentOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        ) : null}

        {siamrajPrimary ? (
          <FilterSelect
            id={`${idPrefix}-subtype`}
            label="ลักษณะงานย่อย"
            value={filters.jobSubtypeFilter}
            onChange={(v) => onChange({ jobSubtypeFilter: v })}
            selectClassName={selectClassName}
          >
            {jobSubtypeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </FilterSelect>
        ) : null}

        {showUnitFilter && unitOptions.length > 0 ? (
          <FilterSelect
            id={`${idPrefix}-unit`}
            label="หน่วยงาน"
            value={filters.unitFilter}
            onChange={(v) => onChange({ unitFilter: v })}
            selectClassName={selectClassName}
          >
            <option value="all">ทั้งหมด</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </FilterSelect>
        ) : null}

        <FilterSelect
          id={`${idPrefix}-recruiter`}
          label="เจ้าหน้าที่สรรหา"
          value={filters.recruiterFilter}
          onChange={(v) => onChange({ recruiterFilter: v })}
          selectClassName={selectClassName}
        >
          <option value="all">ทั้งหมด</option>
          <option value={STAFF_ASSIGNEE_UNASSIGNED}>
            {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedRecruiterCount})
          </option>
          {recruiters.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id={`${idPrefix}-screener`}
          label="เจ้าหน้าที่คัดสรร"
          value={filters.screenerFilter}
          onChange={(v) => onChange({ screenerFilter: v })}
          selectClassName={selectClassName}
        >
          <option value="all">ทั้งหมด</option>
          <option value={STAFF_ASSIGNEE_UNASSIGNED}>
            {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedScreenerCount})
          </option>
          {screeners.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id={`${idPrefix}-opl`}
          label="เจ้าหน้าที่ OPL"
          value={filters.oplFilter}
          onChange={(v) => onChange({ oplFilter: v })}
          selectClassName={selectClassName}
        >
          <option value="all">ทั้งหมด</option>
          <option value={STAFF_ASSIGNEE_UNASSIGNED}>
            {STAFF_ASSIGNEE_UNASSIGNED_LABEL} ({unassignedOplCount})
          </option>
          {opls.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </FilterSelect>

        <FilterSelect
          id={`${idPrefix}-urgency`}
          label="สถานะใบขอ"
          value={filters.urgencyFilter}
          onChange={(v) => onChange({ urgencyFilter: v as UrgencyFilter })}
          selectClassName={selectClassName}
        >
          {URGENCY_FILTER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} title={o.hint}>
              {o.label}
            </option>
          ))}
        </FilterSelect>

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
