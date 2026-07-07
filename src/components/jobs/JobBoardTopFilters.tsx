import React, { useMemo, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
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
};

function countActiveFilters(
  province: string,
  district: string,
  position: string,
  subtype: string,
): number {
  return [province, district, position, subtype].filter(Boolean).length;
}

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
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeFilterCount = useMemo(
    () => countActiveFilters(provinceFilter, districtFilter, positionFilter, subtypeFilter),
    [provinceFilter, districtFilter, positionFilter, subtypeFilter],
  );

  const filterFields = (
    <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
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

  return (
    <>
      <div className="sticky top-0 z-30 -mx-4 border-b border-white/60 bg-white/80 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <SearchField
              wrapperClassName="flex-1 min-w-0"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {(
                [
                  { id: 'all' as const, label: 'ทั้งหมด' },
                  { id: 'urgent' as const, label: 'ด่วน' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onChipChange(f.id)}
                  className={cn(
                    'rounded-full px-4 py-2 text-xs font-semibold transition-all touch-manipulation',
                    chip === f.id
                      ? 'jarvis-pill-btn px-4 py-2 text-xs shadow-md'
                      : 'bg-white/55 text-secondary-foreground hover:bg-white/75 border border-white/80',
                  )}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/60 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-white touch-manipulation',
                  activeFilterCount > 0 && 'border-blue-300/60 bg-blue-50/80 text-blue-800',
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                เลือกตัวกรอง
                {activeFilterCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {activeFilterCount > 0 ? (
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {provinceFilter ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-800">จ.{provinceFilter}</span>
              ) : null}
              {districtFilter ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-800">อ.{districtFilter}</span>
              ) : null}
              {positionFilter ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-800">{positionFilter}</span>
              ) : null}
              {subtypeFilter ? (
                <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-800">{subtypeFilter}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="top" className="max-h-[85dvh] overflow-y-auto rounded-b-2xl">
          <SheetHeader className="text-left">
            <SheetTitle>เลือกตัวกรองงาน</SheetTitle>
            <SheetDescription>จังหวัด · อำเภอ · ตำแหน่ง · ลักษณะงานย่อย</SheetDescription>
          </SheetHeader>
          <div className="mt-6">{filterFields}</div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => {
                onProvinceFilterChange('');
                onDistrictFilterChange('');
                onPositionFilterChange('');
                onSubtypeFilterChange('');
              }}
              className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              ล้างตัวกรอง
            </button>
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="jarvis-pill-btn justify-center px-6 py-2.5 text-sm font-semibold"
            >
              แสดงผลลัพธ์
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default JobBoardTopFilters;
