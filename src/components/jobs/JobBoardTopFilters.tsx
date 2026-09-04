import React, { useMemo, useState } from 'react';
import { ChevronDown, SlidersHorizontal, X } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { TONE } from '@/lib/designTokens';

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  provinceFilter: string;
  onProvinceFilterChange: (v: string) => void;
  districtFilter: string;
  onDistrictFilterChange: (v: string) => void;
  positionFilter: string;
  onPositionFilterChange: (v: string) => void;
  /** ล็อกตำแหน่งจากลิงก์แคมเปญ — ห้ามเปลี่ยน/ล้าง */
  lockPosition?: boolean;
  subtypeFilter: string;
  onSubtypeFilterChange: (v: string) => void;
  /**
   * ตัวกรองฝั่งเจ้าหน้าที่ (เจ้าของสั่งเพิ่ม 13 ส.ค. 2569) — ไม่ส่ง = ไม่แสดงช่อง
   * ⚠️ **หน้าสาธารณะห้ามส่ง** ชื่อเจ้าหน้าที่สรรหาเป็นข้อมูลภายใน
   */
  recruiterFilter?: string;
  onRecruiterFilterChange?: (v: string) => void;
  recruiterOptions?: readonly string[];
  contractTypeFilter?: string;
  onContractTypeFilterChange?: (v: string) => void;
  contractTypeOptions?: readonly string[];
  provinceOptions: readonly string[];
  districtOptions: readonly string[];
  positionOptions: readonly string[];
  subtypeOptions: readonly string[];
  loading?: boolean;
  searchPlaceholder?: string;
  resultCount?: number;
  totalCount?: number;
  /**
   * หน่วยของ resultCount/totalCount — ค่าเริ่มต้น 'ตำแหน่ง' (หน้าสมัครสาธารณะพูดแบบนั้น)
   * 🔴 ฝั่งเจ้าหน้าที่ส่ง 'ใบขอ' มา เพราะเลขนี้คือ**จำนวนใบ** ไม่ใช่จำนวนอัตรา
   * (เจ้าของเทียบ "292 ตำแหน่ง" บนกล่องงานกับ 340 อัตราบน Dashboard แล้วคิดว่าใบขอหาย)
   */
  countUnitLabel?: string;
  /** ข้อความหน่วยที่สอง เช่น "340 อัตรา" — ต่อท้ายบรรทัด "พบ …" ให้กระทบยอดกับ Dashboard ได้ */
  positionsNote?: string;
  /**
   * ซ่อนช่องค้นหาในแถบนี้ — ใช้ตอนหน้าแม่ยกช่องค้นหาขึ้นไปไว้บนสุดเอง
   * (เจ้าของสั่ง 13 ส.ค. 2569: บอร์ดเจ้าหน้าที่ให้ค้นหาอยู่ด้านบนแบบหน้า Dashboard
   * · หน้าสาธารณะไม่ส่ง prop นี้ = ช่องค้นหาอยู่ที่เดิม)
   */
  hideSearch?: boolean;
  /**
   * 'card' (ตั้งต้น) = การ์ด frost เดิมทุกพิกเซล — หน้าสมัครสาธารณะ /apply ใช้ตัวนี้
   * 'bar' = แถบบรรทัดเดียวโปร่ง ๆ (ฝั่งเจ้าหน้าที่ 21 ส.ค. 2569 — คืนที่ ~44px ให้การ์ดงาน)
   * ⚠️ สเตตตัวกรองทั้งหมดยังอยู่ไฟล์นี้ — ห้ามย้ายปุ่มออกไปข้างนอก (มือถือจะไม่เหลือปุ่มเปิด Sheet)
   */
  variant?: 'card' | 'bar';
  /** ป้ายทองหน้าแถบ (โหมด bar) เช่น "ประกาศจากใบขอ" — ยุบแถวป้ายหัวข้อเดิมเข้ามาในแถบเดียว */
  eyebrow?: string;
};

function countActiveFilters(...values: string[]): number {
  return values.filter(Boolean).length;
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

const JobBoardTopFilters: React.FC<Props> = ({
  search,
  onSearchChange,
  provinceFilter,
  onProvinceFilterChange,
  districtFilter,
  onDistrictFilterChange,
  positionFilter,
  onPositionFilterChange,
  lockPosition = false,
  subtypeFilter,
  onSubtypeFilterChange,
  recruiterFilter = '',
  onRecruiterFilterChange,
  recruiterOptions,
  contractTypeFilter = '',
  onContractTypeFilterChange,
  contractTypeOptions,
  provinceOptions,
  districtOptions,
  positionOptions,
  subtypeOptions,
  loading,
  searchPlaceholder = 'ค้นหาจากชื่อหน่วยงาน, ที่อยู่, ประเภทงาน...',
  resultCount,
  totalCount,
  countUnitLabel = 'ตำแหน่ง',
  positionsNote,
  hideSearch = false,
  variant = 'card',
  eyebrow,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  /**
   * แผงตัวกรองบนจอใหญ่ — **ปิดไว้ก่อน** (เจ้าของสั่ง 20 ส.ค. 2569: *"หน้า UI งงมาก"*)
   * วัดของจริง: แผงนี้กางค้างกินความสูง **209px** ทั้งที่ทุกช่องขึ้น "ทั้งหมด (ไม่กรอง)"
   * ดันการ์ดงานใบแรกไปอยู่ที่ Y=734px บนจอสูง 900px → เปิดหน้ามาไม่เห็นงาน
   * 🔴 ถ้ามีตัวกรองเปิดอยู่ให้กางเอง — คนจะได้ไม่สงสัยว่าทำไมผลน้อย
   */
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const activeFilterCount = useMemo(
    () =>
      countActiveFilters(
        provinceFilter,
        districtFilter,
        positionFilter,
        subtypeFilter,
        recruiterFilter,
        contractTypeFilter,
      ),
    [provinceFilter, districtFilter, positionFilter, subtypeFilter, recruiterFilter, contractTypeFilter],
  );

  const clearAllFilters = () => {
    onProvinceFilterChange('');
    onDistrictFilterChange('');
    if (!lockPosition) onPositionFilterChange('');
    onSubtypeFilterChange('');
    onRecruiterFilterChange?.('');
    onContractTypeFilterChange?.('');
  };

  /**
   * ทุกช่องอยู่ **แถวเดียวกัน** (เจ้าของสั่ง 13 ส.ค. 2569: "ทำให้อยู่บรรทัดเดียวกันได้ไหม")
   * — เดิมเป็น grid 2 คอลัมน์ ทำให้ตัวกรอง 4 ช่องกินความสูง 2 แถวเต็ม ๆ
   * ⚠️ ใช้ flex-wrap ไม่ใช่แถวตายตัว — จอแคบต้องตกบรรทัดเอง ไม่ใช่ทะลุขอบ
   * (กับดักเดิมของโปรเจกต์: shrink-0 คู่กับแถวที่ไม่ wrap = ทะลุ)
   */
  const filterFields = (
    <div className="flex flex-wrap items-end gap-3">
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
        disabled={loading || positionOptions.length === 0 || lockPosition}
      />
      <LocationFilterSelect
        label="ลักษณะงานย่อย"
        placeholder="เลือกลักษณะงานย่อย"
        value={subtypeFilter}
        onChange={onSubtypeFilterChange}
        options={subtypeOptions}
        disabled={loading || subtypeOptions.length === 0}
      />
      {/* สองช่องล่างมีเฉพาะฝั่งเจ้าหน้าที่ — ไม่ส่ง prop มา = ไม่แสดง (หน้าสาธารณะ) */}
      {onContractTypeFilterChange ? (
        <LocationFilterSelect
          label="ประเภทงาน"
          placeholder="เลือกประเภทงาน"
          value={contractTypeFilter}
          onChange={onContractTypeFilterChange}
          options={contractTypeOptions ?? []}
          disabled={loading || (contractTypeOptions?.length ?? 0) === 0}
        />
      ) : null}
      {onRecruiterFilterChange ? (
        <LocationFilterSelect
          label="เจ้าหน้าที่สรรหา"
          placeholder="เลือกเจ้าหน้าที่"
          value={recruiterFilter}
          onChange={onRecruiterFilterChange}
          options={recruiterOptions ?? []}
          disabled={loading || (recruiterOptions?.length ?? 0) === 0}
        />
      ) : null}
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
        lockPosition ? (
          <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 py-1 px-2.5 text-xs font-medium text-amber-950">
            <span className="truncate">{positionFilter}</span>
            <span className="text-[10px] text-amber-800/80">ล็อก</span>
          </span>
        ) : (
          <FilterChip label={positionFilter} onRemove={() => onPositionFilterChange('')} />
        )
      ) : null}
      {subtypeFilter ? (
        <FilterChip label={subtypeFilter} onRemove={() => onSubtypeFilterChange('')} />
      ) : null}
    </>
  );

  const isBar = variant === 'bar';

  return (
    <>
      <div className={isBar ? 'mt-3' : 'mt-6'}>
        {/* โหมด card = การ์ด frost เดิม (/apply) · โหมด bar = แถบโปร่งบรรทัดเดียว (staff)
            ⚠️ ห้ามล็อกความสูงเป็นเลขดิบ — ให้สูงตามเนื้อ (ข้างในมี Button h-8) */}
        <div
          className={
            isBar
              ? 'rounded-xl border border-border/60 bg-secondary/30 px-3 py-1.5'
              : 'jarvis-frost rounded-2xl border border-white/70 p-3 shadow-sm md:p-4'
          }
        >
          <div className={isBar ? 'flex flex-col gap-1.5' : 'flex flex-col gap-3'}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              {isBar && eyebrow ? (
                <span
                  className={cn(
                    'shrink-0 text-[11px] font-bold uppercase tracking-[0.14em]',
                    TONE.warn.value,
                  )}
                >
                  {eyebrow}
                </span>
              ) : null}
              {hideSearch ? null : (
                <SearchField
                  wrapperClassName="flex-1 min-w-0"
                  placeholder={searchPlaceholder}
                  value={search}
                  onChange={(e) => onSearchChange(e.target.value)}
                />
              )}

              {/* แถบสลับ ทั้งหมด/ด่วน ถูกถอดทิ้งทั้งฟีเจอร์ (เจ้าของสั่ง 20 ส.ค. 2569:
                  "ไม่ต้องมีก็ได้") — ความด่วนยังเห็นจากป้าย "ด่วน" บนการ์ดเหมือนเดิม */}
              <div className={cn('flex flex-wrap items-center gap-2 lg:shrink-0', hideSearch && 'flex-1')}>
                {/* จอเล็ก: เปิดเป็นแผ่นเลื่อนขึ้น (Sheet) เหมือนเดิม */}
                <Button
                  type="button"
                  variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setSheetOpen(true)}
                  /* 🔴 variant ของ ui/button.tsx ไม่มีคู่ dark — ทับด้วย TONE (กติกาข้อ 4) */
                  className={cn(
                    'rounded-xl lg:hidden',
                    activeFilterCount > 0 ? TONE.info.outline : TONE.neutral.outline,
                  )}
                >
                  <SlidersHorizontal aria-hidden />
                  ตัวกรอง
                  {activeFilterCount > 0 ? (
                    <span className={cn('ml-1 rounded-full px-1.5 text-[10px] font-bold', TONE.primary.solid)}>
                      {activeFilterCount}
                    </span>
                  ) : null}
                </Button>

                {/* จอใหญ่: กด = กาง/พับแผงตัวกรองในหน้า (เดิมกางค้างกิน 209px) */}
                <Button
                  type="button"
                  variant={activeFilterCount > 0 ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setFieldsOpen((v) => !v)}
                  aria-expanded={fieldsOpen || activeFilterCount > 0}
                  className={cn(
                    'hidden rounded-xl lg:inline-flex',
                    activeFilterCount > 0 ? TONE.info.outline : TONE.neutral.outline,
                  )}
                >
                  <SlidersHorizontal aria-hidden />
                  ตัวกรอง
                  {activeFilterCount > 0 ? (
                    <span className={cn('ml-1 rounded-full px-1.5 text-[10px] font-bold', TONE.primary.solid)}>
                      {activeFilterCount}
                    </span>
                  ) : null}
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      (fieldsOpen || activeFilterCount > 0) && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </Button>

                {/* ผลลัพธ์อยู่แถวเดียวกับปุ่ม — เดิมกินอีกหนึ่งบรรทัดพร้อมเส้นคั่น */}
                {resultCount != null && !loading ? (
                  <p className="text-xs text-muted-foreground">
                    พบ{' '}
                    <span className="font-semibold text-foreground">
                      {resultCount.toLocaleString('th-TH')}
                    </span>
                    {totalCount != null && totalCount !== resultCount ? (
                      <>
                        {' '}
                        จาก {totalCount.toLocaleString('th-TH')} {countUnitLabel}
                      </>
                    ) : (
                      ` ${countUnitLabel}`
                    )}
                    {positionsNote ? <> · {positionsNote}</> : null}
                  </p>
                ) : null}
              </div>
            </div>

            {/* กางเมื่อกด หรือเมื่อมีตัวกรองเปิดอยู่ (จะได้เห็นว่ากรองอะไรไว้) */}
            {fieldsOpen || activeFilterCount > 0 ? (
              <div className="hidden border-t border-white/60 pt-4 lg:block">{filterFields}</div>
            ) : null}

            {activeFilterCount > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/50 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground shrink-0">
                  กำลังกรอง
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">{activeChips}</div>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={clearAllFilters}
                  className="h-auto shrink-0 p-0 text-xs"
                >
                  ล้างทั้งหมด
                </Button>
              </div>
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
              <Button size="sm"
                type="button"
                onClick={() => setSheetOpen(false)}
                className="justify-center px-6 py-3 text-sm font-semibold"
              >
                แสดงผลลัพธ์
                {resultCount != null ? ` (${resultCount})` : ''}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default JobBoardTopFilters;
