import React, { useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import SearchField from '@/components/shared/SearchField';
import LocationFilterSelect from '@/components/public/LocationFilterSelect';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { JobBoardUrgencyChip } from '@/hooks/useJobBoardFilters';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  chip: JobBoardUrgencyChip;
  onChipChange: (v: JobBoardUrgencyChip) => void;
  provinceFilter: string;
  onProvinceFilterChange: (v: string) => void;
  districtFilter: string;
  onDistrictFilterChange: (v: string) => void;
  positionFilter: string;
  onPositionFilterChange: (v: string) => void;
  subtypeFilter: string;
  onSubtypeFilterChange: (v: string) => void;
  provinceOptions: readonly string[];
  districtOptions: readonly string[];
  positionOptions: readonly string[];
  subtypeOptions: readonly string[];
  loading?: boolean;
  searchPlaceholder?: string;
  resultCount?: number;
  totalCount?: number;
};

function countActiveFilters(
  province: string,
  district: string,
  position: string,
  subtype: string,
): number {
  return [province, district, position, subtype].filter(Boolean).length;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50/90 py-1 pl-2.5 pr-1 text-xs font-medium text-blue-900">
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-blue-700/80 transition-colors hover:bg-blue-200/60 hover:text-blue-900"
        aria-label={`ลบตัวกรอง ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

const URGENCY_CHIPS = [
  { id: 'all' as const, label: 'ทั้งหมด' },
  { id: 'urgent' as const, label: 'ด่วน' },
] as const;

const JobBoardTopFilters: React.FC<Props> = ({
  search,
  onSearchChange,
  chip,
  onChipChange,
  provinceFilter,
  onProvinceFilterChange,
  districtFilter,
  onDistrictFilterChange,
  positionFilter,
  onPositionFilterChange,
  subtypeFilter,
  onSubtypeFilterChange,
  provinceOptions,
  districtOptions,
  positionOptions,
  subtypeOptions,
  loading,
  searchPlaceholder = 'ค้นหาจากชื่อหน่วยงาน, ที่อยู่, ประเภทงาน...',
  resultCount,
  totalCount,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount = useMemo(
    () => countActiveFilters(provinceFilter, districtFilter, positionFilter, subtypeFilter),
    [provinceFilter, districtFilter, positionFilter, subtypeFilter],
  );

  const clearAllFilters = () => {
    onProvinceFilterChange('');
    onDistrictFilterChange('');
    onPositionFilterChange('');
    onSubtypeFilterChange('');
  };

  const filterFields = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <LocationFilterSelect
        label="จังหวัด"
        placeholder="เลือกจังหวัด"
        value={provinceFilter}
        onChange={onProvinceFilterChange}
        options={provinceOptions}
        disabled={loading}
      />
      <LocationFilterSelect
        label="อำเภอ / เขต"
        placeholder={provinceFilter ? 'เลือกอำเภอ/เขต' : 'เลือกจังหวัดก่อน'}
        value={districtFilter}
        onChange={onDistrictFilterChange}
        options={districtOptions}
        disabled={loading || !provinceFilter}
      />
      <LocationFilterSelect
        label="ตำแหน่ง"
        placeholder="เลือกตำแหน่ง"
        value={positionFilter}
        onChange={onPositionFilterChange}
        options={positionOptions}
        disabled={loading || positionOptions.length === 0}
      />
      <LocationFilterSelect
        label="ลักษณะงานย่อย"
        placeholder="เลือกลักษณะงานย่อย"
        value={subtypeFilter}
        onChange={onSubtypeFilterChange}
        options={subtypeOptions}
        disabled={loading || subtypeOptions.length === 0}
      />
    </div>
  );

  const activeChips = (
    <>
      {provinceFilter ? (
        <FilterChip label={`จังหวัด ${provinceFilter}`} onRemove={() => onProvinceFilterChange('')} />
      ) : null}
      {districtFilter ? (
        <FilterChip label={`อำเภอ ${districtFilter}`} onRemove={() => onDistrictFilterChange('')} />
      ) : null}
      {positionFilter ? (
        <FilterChip label={positionFilter} onRemove={() => onPositionFilterChange('')} />
      ) : null}
      {subtypeFilter ? (
        <FilterChip label={subtypeFilter} onRemove={() => onSubtypeFilterChange('')} />
      ) : null}
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 mt-8">
        <div className="jarvis-frost rounded-2xl border border-white/70 p-4 shadow-sm md:rounded-[1.25rem] md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <SearchField
                wrapperClassName="flex-1 min-w-0"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
              />

              <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                <div
                  className="inline-flex rounded-xl border border-white/80 bg-white/55 p-1 shadow-sm"
                  role="group"
                  aria-label="ประเภทงาน"
                >
                  {URGENCY_CHIPS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => onChipChange(f.id)}
                      className={cn(
                        'rounded-lg px-4 py-2 text-xs font-semibold transition-all touch-manipulation min-w-[4.5rem]',
                        chip === f.id
                          ? 'bg-white text-blue-700 shadow-sm'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all touch-manipulation lg:hidden',
                    activeFilterCount > 0
                      ? 'border-blue-300/70 bg-blue-50 text-blue-800 shadow-sm'
                      : 'border-white/80 bg-white/60 text-foreground hover:bg-white',
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  ตัวกรอง
                  {activeFilterCount > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                      {activeFilterCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>

            <div className="hidden lg:block border-t border-white/60 pt-4">{filterFields}</div>

            {activeFilterCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/50 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
                  กำลังกรอง
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{activeChips}</div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline underline-offset-2"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            ) : null}

            {resultCount != null && !loading ? (
              <p className="text-xs text-muted-foreground border-t border-white/40 pt-3">
                พบ{' '}
                <span className="font-semibold text-foreground">{resultCount.toLocaleString('th-TH')}</span>
                {totalCount != null && totalCount !== resultCount ? (
                  <>
                    {' '}
                    จาก {totalCount.toLocaleString('th-TH')} ตำแหน่ง
                  </>
                ) : (
                  ' ตำแหน่ง'
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="top" className="max-h-[88dvh] overflow-y-auto rounded-b-[1.5rem] px-4 pb-6 pt-5 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">
            <SheetHeader className="text-left space-y-1">
              <SheetTitle className="text-lg">ตัวกรองงาน</SheetTitle>
              <SheetDescription>เลือกพื้นที่และลักษณะงานที่สนใจ</SheetDescription>
            </SheetHeader>

            <div className="mt-6">{filterFields}</div>

            {activeFilterCount > 0 ? (
              <div className="mt-5 flex flex-wrap gap-1.5">{activeChips}</div>
            ) : null}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
                className="rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-40"
              >
                ล้างตัวกรอง
              </button>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="jarvis-pill-btn justify-center px-6 py-3 text-sm font-semibold"
              >
                แสดงผลลัพธ์
                {resultCount != null ? ` (${resultCount})` : ''}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default JobBoardTopFilters;
