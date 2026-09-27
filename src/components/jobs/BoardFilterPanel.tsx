import React, { useState } from 'react';
import { Check, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DateRangeCalendarPicker from '@/components/shared/DateRangeCalendarPicker';
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
 * ═══ ตัวกรองของกล่องงาน + แท็บผู้สมัคร — ปุ่ม "ตัวกรอง" ปุ่มเดียว ═══
 *
 * ประวัติ: 26 ก.ย. แถบซ้ายแบบ iRecruit → 27 ก.ย. เช้า Dropdown เรียงเต็มแถว ("อันไหนเป็น Filter ทำเป็น Dropdown")
 * → **27 ก.ย. บ่าย เจ้าของเลือกแบบ A** (*"หน้ากล่องงานไม่เข้ากับหน้าอื่นๆเลย รกมาก"*):
 * แถวเดียว `[ตัวกรอง (N)] [เรียง ▾]` แบบหน้าอื่น · กดตัวกรอง = กล่อง Dropdown ที่มีทุกหัวข้อ เปิดได้ทีละหัวข้อ
 * (🔴 แถบซ้าย / Sheet มือถือ / Dropdown เรียงเต็มแถว ถูกถอดแล้ว — ห้ามเอากลับโดยไม่ได้สั่งใหม่)
 *
 * 🔴 **วาดอย่างเดียว ไม่คิดเอง** — ตัวเลือก/เลขต่อท้าย/หัวข้อไหนซ่อน มาจาก `facetEngine`
 * (`buildBoardFacets` / `buildApplicantFacets`) ทั้งหมด · จอห้ามนับเลขเอง
 * หลักการเดิมยังอยู่ครบ: เลือกได้หลายค่า อัปเดตทันที · หัวข้อค่าเยอะมีช่องค้นหา · เลข 0 จางแต่ยังกดได้ ·
 * หัวข้อลูกอยู่ในหัวข้อเดียวกับแม่ (อำเภอในจังหวัด · งานย่อยในตำแหน่งงาน)
 */

/** หน้าตาปุ่มเปิด Dropdown — มีค่าติ๊กอยู่ = กรอบสีฟ้า (มีคู่ dark ครบ) */
function triggerClass(active: boolean): string {
  return cn('rounded-lg font-medium', active ? TONE.info.outline : TONE.neutral.outline);
}

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

/**
 * ปุ่ม "ตัวกรอง (N)" + กล่องทุกหัวข้อ — หัวข้อหลักขึ้นก่อนตามลำดับ `primary` · ที่เหลือตามลำดับของเครื่องกรอง ·
 * หัวข้อเพิ่ม (`sections`) ต่อท้าย · เปิดได้ทีละหัวข้อ (กล่องไม่ยาวเกินจอ)
 */
export function FilterButton<K extends string>({
  facets,
  primary = [],
  attach = {},
  onToggle,
  sections = [],
}: {
  facets: FacetView<K>[];
  primary?: readonly K[];
  attach?: Partial<Record<K, K>>;
  onToggle: (key: K, value: string) => void;
  sections?: FilterExtraSection[];
}) {
  const groups = groupFacets(facets, attach);
  const rank = (k: K) => {
    const i = primary.indexOf(k);
    return i === -1 ? primary.length : i;
  };
  const ordered = [...groups].sort((a, b) => rank(a.head.key) - rank(b.head.key));
  const n = groups.reduce((a, g) => a + groupSelected(g), 0) + sections.reduce((a, x) => a + x.selected, 0);
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
        {ordered.length === 0 && sections.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">ยังไม่มีหัวข้อให้กรอง</p>
        ) : (
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
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Dropdown เลือกได้ค่าเดียว (ช่องวันที่ไหน · เรียงยังไง) — ปุ่มหน้าตาเดียวกับหัวข้อกรอง
 * 🔴 เดิมใช้ Select ของโปรเจกต์ ซึ่งสูง/ตัวใหญ่กว่าปุ่มอื่นในแถว (เจ้าของขอให้ "เท่า ๆ กัน")
 */
export function ChoiceDropdown<V extends string>({
  value,
  options,
  onChange,
  triggerLabel,
  ariaLabel,
  active = false,
}: {
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (v: V) => void;
  /** คำบนปุ่ม — ไม่ส่ง = คำของค่าที่เลือกอยู่ */
  triggerLabel?: string;
  ariaLabel: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={ariaLabel} className={triggerClass(active)}>
          {triggerLabel ?? current?.label ?? ''}
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-1 p-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            size="xs"
            aria-pressed={o.value === value}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
            className="w-full justify-between font-normal"
          >
            <span>{o.label}</span>
            {o.value === value ? <Check aria-hidden /> : null}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

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
