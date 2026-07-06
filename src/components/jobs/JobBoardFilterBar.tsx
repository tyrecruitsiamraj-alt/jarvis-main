import React from 'react';
import SearchField from '@/components/shared/SearchField';
import LocationFilterSelect from '@/components/public/LocationFilterSelect';
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
  provinceOptions: readonly string[];
  districtOptions: readonly string[];
  positionOptions: readonly string[];
  loading?: boolean;
  searchPlaceholder?: string;
};

const JobBoardFilterBar: React.FC<Props> = ({
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
  provinceOptions,
  districtOptions,
  positionOptions,
  loading,
  searchPlaceholder = 'ค้นหาจากชื่อหน่วยงาน, ที่อยู่, ประเภทงาน...',
}) => (
  <>
    <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <SearchField
        wrapperClassName="flex-1 max-w-xl"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
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
              'rounded-full px-4 py-2 text-xs font-semibold transition-all',
              chip === f.id
                ? 'jarvis-pill-btn px-4 py-2 text-xs shadow-md'
                : 'bg-white/55 text-secondary-foreground hover:bg-white/75 border border-white/80',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>

    <div className="relative z-10 mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
    </div>
  </>
);

export default JobBoardFilterBar;
