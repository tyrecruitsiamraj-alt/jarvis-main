import React, { useState } from 'react';
import { RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DayCalendarPicker from '@/components/shared/DayCalendarPicker';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  BOARD_SORT_OPTIONS,
  type BoardDateField,
  type BoardDateRange,
  type BoardSort,
} from '@/lib/boardFilters';
import { visibleFacetOptions, type FacetView } from '@/lib/facetEngine';

/**
 * ═══ แถบกรองด้านซ้ายของกล่องงาน (แบบ iRecruit) ═══
 *
 * เจ้าของสั่ง 26 ก.ย. 2569 — แผน `docs/plan-board-irecruit-filter-2569-09-26.md`
 * > *"ข้อดี iRecruit คือมัน Filter ได้ครอบคลุมกว่า"* · *"มันต้องแบ่งเป็นการ์ด ๆ อะที่ฉันพอใจ
 * > ที่เหลือแบบเดิมได้"*
 *
 * 🔴 **วาดอย่างเดียว ไม่คิดเอง** — ตัวเลือก/เลขต่อท้าย/หัวข้อไหนซ่อน มาจาก
 * `buildBoardFacets()` ใน `lib/boardFilters` ทั้งหมด (มีเทสต์คุม) · จอห้ามนับเลขเอง
 *
 * หลักการที่ยกมาจาก iRecruit (ตามแผน):
 * - Accordion **เปิดได้ทีละหัวข้อ** · หัวข้อที่มีค่าเลือกอยู่ บอกจำนวนข้างชื่อ
 * - เลือกได้หลายค่า อัปเดตทันที ไม่มีปุ่ม "ตกลง"
 * - หัวข้อค่าเยอะมีช่องค้นหา · ค่าที่ติ๊กลอยบนสุด · ยังไม่พิมพ์ = 10 ค่าแรก
 * - เลข 0 จางลงแต่ **ยังกดได้** (อยากดูว่าติ๊กแล้วได้ 0 ใบก็ต้องทำได้)
 * - desktop = แถบด้านซ้าย · มือถือ = ปุ่ม "ตัวกรอง (N)" เปิด Sheet
 *
 * 🔴 ใช้ร่วมกับแท็บผู้สมัคร (27 ก.ย. 2569) — component เป็น generic ตามชนิดคีย์หัวข้อ
 * หน้าไหนก็ส่ง `FacetView` จาก `facetEngine` มาวาดได้ (ห้ามทำแถบกรองชุดที่สอง)
 */
export type BoardFilterPanelProps<K extends string = string> = {
  facets: FacetView<K>[];
  /** จำนวนค่าที่ติ๊กอยู่ทั้งแถบ — เลขบนปุ่มมือถือ */
  selectedCount: number;
  onToggle: (key: K, value: string) => void;
  /** ล้างเฉพาะแถบซ้าย (ช่วงวันที่บนแถบบนคงไว้) */
  onClear: () => void;
};

function FacetBody<K extends string>({
  facet,
  onToggle,
}: {
  facet: FacetView<K>;
  onToggle: BoardFilterPanelProps<K>['onToggle'];
}) {
  const [query, setQuery] = useState('');
  const { shown, hiddenCount } = facet.searchable
    ? visibleFacetOptions(facet.options, query)
    : { shown: facet.options, hiddenCount: 0 };

  if (facet.ui === 'chip') {
    return (
      <div className="flex flex-wrap gap-1.5 pt-1">
        {facet.options.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={o.selected ? 'default' : 'outline'}
            aria-pressed={o.selected}
            onClick={() => onToggle(facet.key, o.value)}
            className={cn('h-8 gap-1.5 rounded-full px-3 text-xs', o.count === 0 && !o.selected && 'opacity-50')}
          >
            {o.label}
            <span className="tabular-nums opacity-70">{o.count.toLocaleString('th-TH')}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 pt-1">
      {facet.searchable ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`ค้นหา${facet.label}`}
          aria-label={`ค้นหา${facet.label}`}
          className="h-8 text-xs"
        />
      ) : null}
      <ul className="space-y-0.5">
        {shown.map((o) => {
          const id = `bf-${facet.key}-${o.value}`;
          return (
            <li key={o.value}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-secondary',
                  o.count === 0 && !o.selected && 'opacity-50',
                )}
              >
                <Checkbox id={id} checked={o.selected} onCheckedChange={() => onToggle(facet.key, o.value)} />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={o.label}>
                  {o.label}
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {o.count.toLocaleString('th-TH')}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? (
        <p className="px-1.5 text-[11px] text-muted-foreground">ไม่เจอค่าที่ตรงกับคำค้น</p>
      ) : null}
      {hiddenCount > 0 ? (
        <p className="px-1.5 text-[11px] text-muted-foreground">
          อีก {hiddenCount.toLocaleString('th-TH')} ค่า — พิมพ์ค้นหาเพื่อหา
        </p>
      ) : null}
    </div>
  );
}

function PanelContent<K extends string>({
  facets,
  onToggle,
}: Pick<BoardFilterPanelProps<K>, 'facets' | 'onToggle'>) {
  if (facets.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">ยังไม่มีหัวข้อให้กรอง</p>;
  }
  return (
    <Accordion type="single" collapsible className="w-full">
      {facets.map((f) => (
        <AccordionItem key={f.key} value={f.key} className="border-border">
          <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
            <span className="flex items-center gap-2">
              {f.label}
              {f.selectedCount > 0 ? (
                <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', TONE.primary.chip)}>
                  {f.selectedCount}
                </span>
              ) : null}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3">
            <FacetBody facet={f} onToggle={onToggle} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function PanelHeader({
  selectedCount,
  onClear,
}: Pick<BoardFilterPanelProps, 'selectedCount' | 'onClear'>) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-medium text-foreground">ตัวกรองเพิ่มเติม</p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onClear}
        disabled={selectedCount === 0}
        className="h-7 gap-1 px-2 text-xs"
      >
        <X aria-hidden /> ล้าง
      </Button>
    </div>
  );
}

/** แถบด้านซ้าย — โชว์ตั้งแต่จอ lg ขึ้นไป */
export function BoardFilterSidebar<K extends string>(props: BoardFilterPanelProps<K>) {
  return (
    <aside
      aria-label="ตัวกรองเพิ่มเติม"
      className="hidden w-64 shrink-0 self-start rounded-xl border border-border bg-card p-3 lg:block"
    >
      <PanelHeader selectedCount={props.selectedCount} onClear={props.onClear} />
      <div className="mt-2">
        <PanelContent facets={props.facets} onToggle={props.onToggle} />
      </div>
    </aside>
  );
}

/** ปุ่ม "ตัวกรอง (N)" + Sheet — โชว์เฉพาะจอเล็กกว่า lg */
export function BoardFilterSheetButton<K extends string>(props: BoardFilterPanelProps<K>) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 lg:hidden">
          <SlidersHorizontal aria-hidden />
          ตัวกรอง{props.selectedCount > 0 ? ` (${props.selectedCount})` : ''}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader className="text-left">
          <SheetTitle className="sr-only">ตัวกรองเพิ่มเติม</SheetTitle>
          <SheetDescription className="sr-only">
            เลือกได้หลายค่า การ์ดข้างหลังเปลี่ยนทันทีที่ติ๊ก
          </SheetDescription>
        </SheetHeader>
        <div className="pr-6">
          <PanelHeader selectedCount={props.selectedCount} onClear={props.onClear} />
        </div>
        <div className="mt-2">
          <PanelContent facets={props.facets} onToggle={props.onToggle} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * ของบนแถบบน (แผนข้อ 7): ช่วงวันที่ + ปุ่มเรียง + ปุ่ม "↻ ล้าง" (ล้างทุกตัวกรอง)
 * + ปุ่ม "ตัวกรอง (N)" สำหรับมือถือ (แถบซ้ายซ่อนบนจอเล็ก)
 */
export function BoardFilterTopTools<K extends string>({
  panel,
  dates,
  onDatesChange,
  sort,
  onSortChange,
  canReset,
  onReset,
}: {
  panel: BoardFilterPanelProps<K>;
  dates: BoardDateRange | null;
  onDatesChange: (patch: Partial<BoardDateRange>) => void;
  sort: BoardSort;
  onSortChange: (sort: BoardSort) => void;
  canReset: boolean;
  onReset: () => void;
}) {
  const field: BoardDateField = dates?.field ?? 'required';
  return (
    <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
      <BoardFilterSheetButton {...panel} />
      <div className="flex flex-wrap items-center gap-1.5">
        {/* ⚠️ SelectTrigger ของโปรเจกต์ยืดเต็มกว้างเสมอ (jarvis-soft-field) — ต้องมีกล่องกำหนดกว้าง
            ไม่งั้นช่องเดียวกินทั้งแถว (เจอตอนตรวจบนจอ 26 ก.ย. 2569) */}
        <div className="w-36">
          <Select value={field} onValueChange={(v) => onDatesChange({ field: v as BoardDateField })}>
            <SelectTrigger className="h-9 text-xs" aria-label="ช่วงวันที่ของช่องไหน">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="required">วันที่ต้องการ</SelectItem>
              <SelectItem value="request">วันที่ขอ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* 🔴 ห้าม <input type="date"> — ช่องของเบราว์เซอร์แสดงตามภาษาเครื่องคนใช้
            (บทเรียนเดียวกับ AM/PM บนหน้าติดตาม) · มีเทสต์กันไว้ใน typographyRules */}
        <DayCalendarPicker
          value={dates?.from ?? ''}
          onChange={(v) => onDatesChange({ field, from: v })}
          emptyLabel="ตั้งแต่วันที่"
        />
        <span className="text-xs text-muted-foreground">ถึง</span>
        <DayCalendarPicker
          value={dates?.to ?? ''}
          onChange={(v) => onDatesChange({ field, to: v })}
          emptyLabel="ถึงวันที่"
        />
      </div>
      <div className="w-52">
        <Select value={sort} onValueChange={(v) => onSortChange(v as BoardSort)}>
          <SelectTrigger className="h-9 text-xs" aria-label="เรียงการ์ด">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BOARD_SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                เรียง: {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onReset}
        disabled={!canReset}
        className="h-9 gap-1.5 text-xs"
      >
        <RotateCcw aria-hidden /> ล้าง
      </Button>
    </div>
  );
}
