import React, { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import DateRangeCalendarPicker from '@/components/shared/DateRangeCalendarPicker';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { filterTriggerClass } from '@/lib/filterTrigger';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import {
  BOARD_FACET_ATTACH,
  BOARD_PRIMARY_FACETS,
  BOARD_SORT_OPTIONS,
  type BoardDateField,
  type BoardDateRange,
  type BoardFacetKey,
  type BoardSort,
} from '@/lib/boardFilters';
import { visibleFacetOptions, type FacetView } from '@/lib/facetEngine';

/**
 * ═══ ตัวกรองของกล่องงาน + แท็บผู้สมัคร — เนื้อในชุดเดียว วางได้สองแบบ ═══
 *
 * ประวัติ: 26 ก.ย. แถบซ้ายแบบ iRecruit → 27 ก.ย. เช้า Dropdown เรียงเต็มแถว ("อันไหนเป็น Filter ทำเป็น Dropdown")
 * → 27 ก.ย. บ่าย เจ้าของเลือกแบบ A (*"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"*) = ปุ่มเดียวทั้งสองที่
 * → **28 ก.ย. เจ้าของแยกกัน:** *"หน้ากล่องงาน … เป็นช่องๆแบบเดิม ส่วนหน้าอื่นๆพวก รายชื่อผู้สมัคร การโทรของฉัน ฯลฯ
 *   ทำแบบ Irecruit เลย"* แล้วเลือก Choice "แถบกรองซ้ายตามแบบร่างที่เคาะไว้"
 *   - แท็บกล่องงาน = `BoardFilterBar` → ปุ่ม `[ตัวกรอง (N)] [เรียง ▾]` (แบบ A เหมือนเดิม)
 *   - แท็บรายชื่อผู้สมัคร / การโทรของฉัน / ติดตามนัดหมาย = `FilterSidebar` (จอ xl = 1280px ขึ้นไป) +
 *     `FilterSheetButton` (จอเล็กกว่า xl เปิดแผงด้านซ้าย)
 *     ⚠️ ไม่ใช่ lg — จอ 1024–1279 มีแถบซ้ายแล้วตารางรายชื่อเหลือช่อง ~660px ไม่พอ (ต้อง ~770px ถึงไม่ถอดข้อมูล)
 *   ทั้งสามแบบวาดด้วย `FilterAccordion` ตัวเดียว — หัวข้อ/ลำดับ/เลขต่อท้ายจึงตรงกันเสมอ
 * (🔴 Dropdown เรียงเต็มแถวยังถูกถอด — ห้ามเอากลับโดยไม่ได้สั่งใหม่)
 *
 * 🔴 **วาดอย่างเดียว ไม่คิดเอง** — ตัวเลือก/เลขต่อท้าย/หัวข้อไหนซ่อน มาจาก `facetEngine`
 * (`buildBoardFacets` / `buildApplicantFacets`) ทั้งหมด · จอห้ามนับเลขเอง
 * หลักการเดิมยังอยู่ครบ: เลือกได้หลายค่า อัปเดตทันที · หัวข้อค่าเยอะมีช่องค้นหา · เลข 0 จางแต่ยังกดได้ ·
 * หัวข้อลูกอยู่ในหัวข้อเดียวกับแม่ (อำเภอในจังหวัด · งานย่อยในตำแหน่งงาน)
 */

/** หน้าตาปุ่มเปิด Dropdown — มีค่าติ๊กอยู่ = กรอบสีฟ้า (มีคู่ dark ครบ) */
const triggerClass = filterTriggerClass;

function TriggerCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return <span className={cn('rounded-full px-1.5 text-xs tabular-nums', TONE.primary.chip)}>{n}</span>;
}

function FacetBody<K extends string>({
  facet,
  onToggle,
}: {
  facet: FacetView<K>;
  onToggle: (key: K, value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const { shown, hiddenCount } = facet.searchable
    ? visibleFacetOptions(facet.options, query)
    : { shown: facet.options, hiddenCount: 0 };

  if (facet.ui === 'chip') {
    return (
      <div className="flex flex-wrap gap-2">
        {facet.options.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="xs"
            variant={o.selected ? 'default' : 'outline'}
            aria-pressed={o.selected}
            onClick={() => onToggle(facet.key, o.value)}
            className={cn('rounded-full', o.count === 0 && !o.selected && 'opacity-50')}
          >
            {o.label}
            <span className="tabular-nums opacity-70">{o.count.toLocaleString('th-TH')}</span>
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {facet.searchable ? (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`ค้นหา${facet.label}`}
          aria-label={`ค้นหา${facet.label}`}
          className="h-8 text-xs"
        />
      ) : null}
      <ul className="space-y-1">
        {shown.map((o) => {
          const id = `bf-${facet.key}-${o.value}`;
          return (
            <li key={o.value}>
              <label
                htmlFor={id}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-secondary',
                  o.count === 0 && !o.selected && 'opacity-50',
                )}
              >
                <Checkbox id={id} checked={o.selected} onCheckedChange={() => onToggle(facet.key, o.value)} />
                <span className="min-w-0 flex-1 truncate text-xs text-foreground" title={o.label}>
                  {o.label}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {o.count.toLocaleString('th-TH')}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 ? <p className="px-2 text-xs text-muted-foreground">ไม่เจอค่าที่ตรงกับคำค้น</p> : null}
      {hiddenCount > 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          อีก {hiddenCount.toLocaleString('th-TH')} ค่า — พิมพ์ค้นหาเพื่อหา
        </p>
      ) : null}
    </div>
  );
}

/** หัวข้อหนึ่งในกล่อง — มีหัวชื่อเมื่ออยู่ร่วมกับหัวข้ออื่น (แม่ + ลูก) */
function FacetSection<K extends string>({
  facet,
  onToggle,
  showTitle,
}: {
  facet: FacetView<K>;
  onToggle: (key: K, value: string) => void;
  showTitle: boolean;
}) {
  return (
    <div className="space-y-2">
      {showTitle ? <p className="text-xs font-medium text-muted-foreground">{facet.label}</p> : null}
      <FacetBody facet={facet} onToggle={onToggle} />
    </div>
  );
}

type FacetGroup<K extends string> = { head: FacetView<K>; children: FacetView<K>[] };

/** จัดกลุ่มแม่-ลูก — ลูกที่แม่ไม่มีข้อมูล (ไม่โชว์) กลายเป็นกลุ่มเดี่ยวของตัวเอง */
function groupFacets<K extends string>(
  facets: FacetView<K>[],
  attach: Partial<Record<K, K>>,
): FacetGroup<K>[] {
  const present = new Set(facets.map((f) => f.key));
  const groups: FacetGroup<K>[] = [];
  const byHead = new Map<K, FacetGroup<K>>();
  for (const f of facets) {
    const parent = attach[f.key];
    if (parent && present.has(parent)) continue;
    const g = { head: f, children: [] as FacetView<K>[] };
    groups.push(g);
    byHead.set(f.key, g);
  }
  for (const f of facets) {
    const parent = attach[f.key];
    if (parent && present.has(parent)) byHead.get(parent)?.children.push(f);
  }
  return groups;
}

const groupSelected = <K extends string>(g: FacetGroup<K>) =>
  g.head.selectedCount + g.children.reduce((n, c) => n + c.selectedCount, 0);

/** หัวข้อเพิ่มที่ไม่ได้มาจากเครื่องกรอง (ใบที่จบแล้ว · ช่วงวันที่) — วางในกล่องเดียวกับหัวข้ออื่น */
export type FilterExtraSection = { key: string; label: string; selected: number; content: React.ReactNode };

/** ของที่ตัวกรองทุกแบบรับเหมือนกัน (ปุ่มเดียว · แถบซ้าย · แผงมือถือ) */
type FilterContentProps<K extends string> = {
  facets: FacetView<K>[];
  /** หัวข้อที่ขึ้นก่อน ตามลำดับนี้ · ที่เหลือตามลำดับของเครื่องกรอง */
  primary?: readonly K[];
  /** หัวข้อลูก → หัวข้อแม่ (อำเภอในจังหวัด · งานย่อยในตำแหน่งงาน) */
  attach?: Partial<Record<K, K>>;
  onToggle: (key: K, value: string) => void;
  /** หัวข้อเพิ่ม ต่อท้ายหัวข้อของเครื่องกรอง */
  sections?: FilterExtraSection[];
};

/** จำนวนค่าที่ติ๊กอยู่ทั้งชุด — เลขบนปุ่ม (หัวข้อลูกนับรวมอยู่ใน `facets` แล้ว ไม่นับซ้ำ) */
function selectedTotal<K extends string>(facets: FacetView<K>[], sections: FilterExtraSection[] = []): number {
  return facets.reduce((a, f) => a + f.selectedCount, 0) + sections.reduce((a, x) => a + x.selected, 0);
}

/**
 * เนื้อในของตัวกรอง — หัวข้อพับได้ **เปิดได้ทีละหัวข้อ** (แบบ iRecruit) · หัวข้อลูกอยู่ในหัวข้อแม่ ·
 * หัวข้อเพิ่ม (`sections`) ต่อท้าย · 🔴 ตัวเดียวที่วาดหัวข้อ — ปุ่มเดียว/แถบซ้าย/แผงมือถือ ห้ามวาดเอง
 */
function FilterAccordion<K extends string>({
  facets,
  primary = [],
  attach = {},
  onToggle,
  sections = [],
}: FilterContentProps<K>) {
  const rank = (k: K) => {
    const i = primary.indexOf(k);
    return i === -1 ? primary.length : i;
  };
  const ordered = [...groupFacets(facets, attach)].sort((a, b) => rank(a.head.key) - rank(b.head.key));
  if (ordered.length === 0 && sections.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">ยังไม่มีหัวข้อให้กรอง</p>;
  }
  return (
    <Accordion type="single" collapsible className="w-full">
      {ordered.map((g) => (
        <AccordionItem key={g.head.key} value={g.head.key} className="border-border">
          <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
            <span className="flex items-center gap-2">
              {g.head.label}
              <TriggerCount n={groupSelected(g)} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-3">
            <FacetBody facet={g.head} onToggle={onToggle} />
            {g.children.map((c) => (
              <FacetSection key={c.key} facet={c} onToggle={onToggle} showTitle />
            ))}
          </AccordionContent>
        </AccordionItem>
      ))}
      {sections.map((x) => (
        <AccordionItem key={`extra-${x.key}`} value={`extra-${x.key}`} className="border-border">
          <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
            <span className="flex items-center gap-2">
              {x.label}
              <TriggerCount n={x.selected} />
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-3">{x.content}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/**
 * ปุ่ม "ตัวกรอง (N)" + กล่องทุกหัวข้อ — ของแท็บกล่องงาน (แบบ A) · เปิดได้ทีละหัวข้อ (กล่องไม่ยาวเกินจอ)
 */
export function FilterButton<K extends string>(props: FilterContentProps<K>) {
  const n = selectedTotal(props.facets, props.sections);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" className={triggerClass(n > 0)}>
          <SlidersHorizontal aria-hidden />
          ตัวกรอง
          <TriggerCount n={n} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 w-80 overflow-y-auto p-3">
        <FilterAccordion {...props} />
      </PopoverContent>
    </Popover>
  );
}

/** แถบซ้าย/แผงมือถือรับเพิ่ม: ปุ่มล้าง + บรรทัดผลลัพธ์ (โผล่เฉพาะตอนมีอะไรติ๊กอยู่) */
type FilterPanelProps<K extends string> = FilterContentProps<K> & {
  /** ล้างทุกอย่างในแถบ — รวมหัวข้อเพิ่ม (เช่น วันที่สมัคร) */
  onClear: () => void;
  /** เช่น "เหลือ 26 รายชื่อ" — ไม่ส่ง = ไม่มีบรรทัดนี้ */
  resultText?: string;
};

/** หัวแถบ "ตัวกรองเพิ่มเติม  ✕ ล้าง" — ชื่อเดียวกับแบบร่างที่เจ้าของเคาะ · ส่ง `onCollapse` มา = มีปุ่มพับแถบ */
function FilterPanelHeader({
  selected,
  onClear,
  resultText,
  onCollapse,
}: {
  selected: number;
  onClear: () => void;
  resultText?: string;
  onCollapse?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">ตัวกรองเพิ่มเติม</p>
        <span className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="xs" onClick={onClear} disabled={selected === 0}>
            <X aria-hidden /> ล้าง
          </Button>
          {onCollapse ? (
            <Button type="button" variant="ghost" size="iconXs" onClick={onCollapse} aria-label="พับตัวกรอง" title="พับตัวกรอง">
              <ChevronLeft aria-hidden />
            </Button>
          ) : null}
        </span>
      </div>
      {selected > 0 && resultText ? <p className="text-xs text-muted-foreground">{resultText}</p> : null}
    </div>
  );
}

/**
 * แถบกรองด้านซ้ายแบบ iRecruit — แท็บรายชื่อผู้สมัคร / การโทรของฉัน / ติดตามนัดหมาย (เจ้าของสั่ง 28 ก.ย. 2569)
 * โชว์ตั้งแต่จอ xl (1280px) ขึ้นไป · จอเล็กกว่านั้นใช้ `FilterSheetButton` (เนื้อในชุดเดียวกัน)
 */
export function FilterSidebar<K extends string>({
  onClear,
  resultText,
  onCollapse,
  ...content
}: FilterPanelProps<K> & {
  /** พับแถบเก็บ (แท็บฝั่งผู้สมัคร · 30 ก.ย. 2569) — ไม่ส่ง = แถบกางถาวรแบบเดิม */
  onCollapse?: () => void;
}) {
  const n = selectedTotal(content.facets, content.sections);
  return (
    <aside
      aria-label="ตัวกรองเพิ่มเติม"
      className="hidden w-64 shrink-0 self-start rounded-xl border border-border bg-card p-3 xl:block"
    >
      <FilterPanelHeader selected={n} onClear={onClear} resultText={resultText} onCollapse={onCollapse} />
      <div className="mt-2">
        <FilterAccordion {...content} />
      </div>
    </aside>
  );
}

/**
 * ปุ่มกางแถบซ้ายที่พับอยู่ — "ตัวกรอง (N) ▸" (แท็บฝั่งผู้สมัคร · เจ้าของสั่ง 30 ก.ย. 2569: *"Filter ทำแบบย่อ กางได้"*
 * → Choice "แถบซ้ายพับได้") · เฉพาะจอ xl ขึ้นไป (จอเล็กใช้ `FilterSheetButton` เหมือนเดิม)
 * `selected` = จำนวนที่ติ๊กอยู่ทั้งแถบ (รวมหัวข้อเพิ่ม เช่น วันที่สมัคร)
 */
export function FilterSidebarToggle({ selected, onExpand }: { selected: number; onExpand: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      onClick={onExpand}
      className={cn(triggerClass(selected > 0), 'hidden xl:inline-flex')}
      aria-expanded={false}
    >
      <SlidersHorizontal aria-hidden />
      ตัวกรอง
      <TriggerCount n={selected} />
      <ChevronRight aria-hidden />
    </Button>
  );
}

/** ปุ่ม "ตัวกรอง (N)" เปิดแผงด้านซ้าย — เฉพาะจอเล็กกว่า xl (แถบซ้ายซ่อนอยู่) */
export function FilterSheetButton<K extends string>({ onClear, resultText, ...content }: FilterPanelProps<K>) {
  const n = selectedTotal(content.facets, content.sections);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="xs" className={cn(triggerClass(n > 0), 'xl:hidden')}>
          <SlidersHorizontal aria-hidden />
          ตัวกรอง
          <TriggerCount n={n} />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-sm">
        <SheetHeader className="text-left">
          <SheetTitle className="sr-only">ตัวกรองเพิ่มเติม</SheetTitle>
          <SheetDescription className="sr-only">เลือกได้หลายค่า รายชื่อเปลี่ยนทันทีที่ติ๊ก</SheetDescription>
        </SheetHeader>
        {/* pr-6 = เว้นที่ให้ปุ่มปิด (X) มุมขวาบนของแผง */}
        <div className="pr-6">
          <FilterPanelHeader selected={n} onClear={onClear} resultText={resultText} />
        </div>
        <div className="mt-2">
          <FilterAccordion {...content} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Dropdown เลือกได้ค่าเดียว — ย้ายไป `@/components/shared/ChoiceDropdown` แล้ว (ส่งออกชื่อเดิมต่อที่นี่) */
export { ChoiceDropdown };

/**
 * "ล้างตัวกรอง" — อยู่ท้ายบรรทัด "แสดง N จาก M ใบขอ" และ**โผล่เฉพาะตอนมีอะไรกรองอยู่**
 * (เดิมเป็นปุ่มจางค้างอยู่ท้ายแถว Dropdown แล้วตกบรรทัดเดี่ยว ๆ — ไม่ Clean)
 * 🔴 ล้าง**ทุกอย่าง** รวมการ์ด/ขั้นที่กดไว้ (แถบ "กำลังดู" ที่เคยมีปุ่มล้างถูกถอดแล้ว)
 */
export function BoardResetButton({ onReset }: { onReset: () => void }) {
  return (
    <Button type="button" variant="ghost" size="xs" onClick={onReset}>
      <RotateCcw aria-hidden /> ล้างตัวกรอง
    </Button>
  );
}

const DATE_FIELD_OPTIONS: readonly { value: BoardDateField; label: string }[] = [
  { value: 'required', label: 'วันที่ต้องการ' },
  { value: 'request', label: 'วันที่ขอ' },
];

type DoneLane = 'closed' | 'cancelled';

/** ปุ่มเลือกค่าเดียวในกล่องตัวกรอง (ใบที่จบแล้ว · ช่องวันที่) — กดซ้ำ = เอาออก */
function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      aria-pressed={selected}
      onClick={onClick}
      className={cn('rounded-full', selected ? TONE.info.outline : TONE.neutral.outline)}
    >
      {selected ? <Check aria-hidden /> : null}
      {children}
    </Button>
  );
}

/**
 * แถบตัวกรองของกล่องงาน (แบบ A): `[ตัวกรอง (N)] [เรียง ▾]`
 * ในกล่องตัวกรอง: ทุกหัวข้อของเครื่องกรอง + "ใบที่จบแล้ว" (ปิดแล้ว/ยกเลิก 30 วัน — แทนแถวเดิมบนหัวกล่องงาน)
 * + "ช่วงวันที่" · ปุ่มล้างอยู่ท้ายบรรทัดจำนวนผลลัพธ์ (`BoardResetButton`)
 */
export function BoardFilterBar({
  facets,
  onToggle,
  done,
  dates,
  onDatesChange,
  sort,
  onSortChange,
}: {
  facets: FacetView<BoardFacetKey>[];
  onToggle: (key: BoardFacetKey, value: string) => void;
  done: { closed: number; cancelled: number; lane: DoneLane | null; onChange: (lane: DoneLane | null) => void };
  dates: BoardDateRange | null;
  onDatesChange: (patch: Partial<BoardDateRange>) => void;
  sort: BoardSort;
  onSortChange: (sort: BoardSort) => void;
}) {
  const field: BoardDateField = dates?.field ?? 'required';
  const hasDates = Boolean(dates && (dates.from || dates.to));
  const sections: FilterExtraSection[] = [
    {
      key: 'done',
      label: 'ใบที่จบแล้ว (30 วันล่าสุด)',
      selected: done.lane ? 1 : 0,
      content: (
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'closed', label: 'ปิดแล้ว', count: done.closed },
              { key: 'cancelled', label: 'ยกเลิก', count: done.cancelled },
            ] as const
          ).map((o) => (
            <OptionButton
              key={o.key}
              selected={done.lane === o.key}
              onClick={() => done.onChange(done.lane === o.key ? null : o.key)}
            >
              {o.label} <span className="tabular-nums opacity-70">{o.count.toLocaleString('th-TH')}</span>
            </OptionButton>
          ))}
        </div>
      ),
    },
    {
      key: 'dates',
      label: 'ช่วงวันที่',
      selected: hasDates ? 1 : 0,
      content: (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {DATE_FIELD_OPTIONS.map((o) => (
              <OptionButton key={o.value} selected={field === o.value} onClick={() => onDatesChange({ field: o.value })}>
                {o.label}
              </OptionButton>
            ))}
          </div>
          {/* 🔴 ห้าม <input type="date"> (ภาษาตามเครื่องคนใช้) — ปฏิทินช่วงวันตัวเดียวกับแท็บผู้สมัคร */}
          <DateRangeCalendarPicker
            triggerVariant="filter"
            value={hasDates && dates ? { from: dates.from, to: dates.to } : null}
            onChange={(next) => onDatesChange({ field, from: next?.from ?? '', to: next?.to ?? '' })}
          />
        </div>
      ),
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterButton
        facets={facets}
        primary={BOARD_PRIMARY_FACETS}
        attach={BOARD_FACET_ATTACH}
        onToggle={onToggle}
        sections={sections}
      />
      <ChoiceDropdown
        value={sort}
        options={BOARD_SORT_OPTIONS}
        onChange={onSortChange}
        triggerLabel={`เรียง: ${BOARD_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? ''}`}
        ariaLabel="เรียงการ์ด"
        active={sort !== 'age'}
      />
    </div>
  );
}
