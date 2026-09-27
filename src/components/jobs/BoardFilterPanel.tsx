import React, { useState } from 'react';
import { Check, ChevronDown, RotateCcw } from 'lucide-react';
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
 * ═══ ตัวกรองแบบ Dropdown (กล่องงาน + แท็บผู้สมัคร) ═══
 *
 * เจ้าของสั่ง 27 ก.ย. 2569: *"อันไหนเป็น Filter ทำเป็น Dropdown เอา"* · *"ขอหน้าตาแบบ Clean"*
 * ⇒ เลือก **แบบ A** จากแบบร่าง: หัวข้อที่เคยอยู่แถบซ้าย (แบบ iRecruit 26 ก.ย.) ออกมาเป็น
 * Dropdown เรียงในแถบเดียว · การ์ดตัวเลข + ขั้น 1–4 บนหัวกล่องงานยังกดได้เหมือนเดิม
 * (🔴 แถบซ้าย + ปุ่ม "ตัวกรอง" + Sheet มือถือ ถูกถอดทั้งชุด — ห้ามเอากลับโดยไม่ได้สั่งใหม่)
 *
 * 🔴 **วาดอย่างเดียว ไม่คิดเอง** — ตัวเลือก/เลขต่อท้าย/หัวข้อไหนซ่อน มาจาก `facetEngine`
 * (`buildBoardFacets` / `buildApplicantFacets`) ทั้งหมด · จอห้ามนับเลขเอง
 *
 * หลักการเดิมของแบบ iRecruit ยังอยู่ครบในกล่อง Dropdown:
 * - เลือกได้หลายค่า อัปเดตทันที ไม่มีปุ่ม "ตกลง"
 * - หัวข้อค่าเยอะมีช่องค้นหา · ค่าที่ติ๊กลอยบนสุด · ยังไม่พิมพ์ = 10 ค่าแรก
 * - เลข 0 จางลงแต่ **ยังกดได้**
 * - หัวข้อลูกอยู่ในกล่องเดียวกับหัวข้อแม่ (อำเภอในจังหวัด · งานย่อยในตำแหน่งงาน)
 */
export type FacetDropdownsProps<K extends string> = {
  facets: FacetView<K>[];
  /** หัวข้อที่ได้ Dropdown ของตัวเอง ตามลำดับบนแถบ — หัวข้อที่ข้อมูลว่างไม่โชว์ (engine ตัดให้แล้ว) */
  primary: readonly K[];
  /** หัวข้อลูก → หัวข้อแม่ — ลูกโผล่ในกล่องเดียวกับแม่ ไม่ได้ปุ่มของตัวเอง */
  attach?: Partial<Record<K, K>>;
  onToggle: (key: K, value: string) => void;
};

/** หน้าตาปุ่มเปิด Dropdown — มีค่าติ๊กอยู่ = กรอบสีฟ้า (ชุดเดียวกับตัวกรองเดิม มีคู่ dark ครบ) */
function triggerClass(active: boolean): string {
  return cn('h-9 gap-1.5 rounded-lg px-3 text-xs font-medium', active ? TONE.info.outline : TONE.neutral.outline);
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

/** ชุด Dropdown ของหัวข้อทั้งหมด: หัวข้อหลักคนละปุ่ม + ที่เหลือรวมใน "ตัวกรองอื่น" */
export function FacetDropdowns<K extends string>({ facets, primary, attach = {}, onToggle }: FacetDropdownsProps<K>) {
  const groups = groupFacets(facets, attach);
  const rank = (k: K) => primary.indexOf(k);
  const main = groups.filter((g) => rank(g.head.key) !== -1).sort((a, b) => rank(a.head.key) - rank(b.head.key));
  const rest = groups.filter((g) => rank(g.head.key) === -1);
  const restSelected = rest.reduce((n, g) => n + groupSelected(g), 0);

  return (
    <>
      {main.map((g) => {
        const n = groupSelected(g);
        return (
          <Popover key={g.head.key}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className={triggerClass(n > 0)}>
                {g.head.label}
                <TriggerCount n={n} />
                <ChevronDown className="opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-96 w-72 space-y-4 overflow-y-auto p-3">
              <FacetSection facet={g.head} onToggle={onToggle} showTitle={g.children.length > 0} />
              {g.children.map((c) => (
                <FacetSection key={c.key} facet={c} onToggle={onToggle} showTitle />
              ))}
            </PopoverContent>
          </Popover>
        );
      })}
      {rest.length > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className={triggerClass(restSelected > 0)}>
              ตัวกรองอื่น
              <TriggerCount n={restSelected} />
              <ChevronDown className="opacity-60" aria-hidden />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="max-h-96 w-80 overflow-y-auto p-3">
            {/* เปิดได้ทีละหัวข้อ (หลักการเดิมของแบบ iRecruit) — กล่องไม่ยาวเกินจอ */}
            <Accordion type="single" collapsible className="w-full">
              {rest.map((g) => {
                const n = groupSelected(g);
                return (
                  <AccordionItem key={g.head.key} value={g.head.key} className="border-border">
                    <AccordionTrigger className="py-2 text-xs font-medium hover:no-underline">
                      <span className="flex items-center gap-2">
                        {g.head.label}
                        <TriggerCount n={n} />
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 pb-3">
                      <FacetBody facet={g.head} onToggle={onToggle} />
                      {g.children.map((c) => (
                        <FacetSection key={c.key} facet={c} onToggle={onToggle} showTitle />
                      ))}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </PopoverContent>
        </Popover>
      ) : null}
    </>
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
        <Button type="button" variant="outline" size="sm" aria-label={ariaLabel} className={triggerClass(active)}>
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
            size="sm"
            aria-pressed={o.value === value}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
            className="h-9 w-full justify-between px-2 text-sm font-normal"
          >
            <span>{o.label}</span>
            {o.value === value ? <Check aria-hidden /> : null}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const DATE_FIELD_OPTIONS: readonly { value: BoardDateField; label: string }[] = [
  { value: 'required', label: 'วันที่ต้องการ' },
  { value: 'request', label: 'วันที่ขอ' },
];

type DoneLane = 'closed' | 'cancelled';

/**
 * "ใบที่จบแล้ว ▾" — แทนแถว "ใบที่จบไปแล้ว (30 วันล่าสุด): ปิดแล้ว · ยกเลิก" บนหัวกล่องงาน
 * (เจ้าของสั่งเอาแถวนั้นออก 27 ก.ย. 2569) · เลือกได้ทีละอย่าง กดซ้ำ = กลับไปดูใบเปิด
 */
function DoneDropdown({
  closed,
  cancelled,
  lane,
  onChange,
}: {
  closed: number;
  cancelled: number;
  lane: DoneLane | null;
  onChange: (lane: DoneLane | null) => void;
}) {
  const options: { key: DoneLane; label: string; count: number }[] = [
    { key: 'closed', label: 'ปิดแล้ว', count: closed },
    { key: 'cancelled', label: 'ยกเลิก', count: cancelled },
  ];
  const picked = options.find((o) => o.key === lane);
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={triggerClass(Boolean(picked))}>
          {picked ? `ใบที่จบแล้ว: ${picked.label}` : 'ใบที่จบแล้ว'}
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 space-y-1 p-2">
        <p className="px-2 py-1 text-xs text-muted-foreground">30 วันล่าสุด · กดซ้ำเพื่อกลับไปดูใบเปิด</p>
        {options.map((o) => (
          <Button
            key={o.key}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={lane === o.key}
            onClick={() => {
              onChange(lane === o.key ? null : o.key);
              setOpen(false);
            }}
            className={cn('h-9 w-full justify-between px-2 text-sm font-normal', lane === o.key && TONE.info.soft)}
          >
            <span>{o.label}</span>
            <span className="tabular-nums text-muted-foreground">{o.count.toLocaleString('th-TH')} ใบ</span>
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
    <Button type="button" variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5 px-2 text-xs">
      <RotateCcw aria-hidden /> ล้างตัวกรอง
    </Button>
  );
}

/**
 * แถบตัวกรองของกล่องงาน — Dropdown ทั้งแถว: หัวข้อ · ใบที่จบแล้ว · ช่วงวันที่ · เรียง
 * (ปุ่มล้างอยู่ท้ายบรรทัดจำนวนผลลัพธ์ — `BoardResetButton`)
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
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <FacetDropdowns facets={facets} primary={BOARD_PRIMARY_FACETS} attach={BOARD_FACET_ATTACH} onToggle={onToggle} />
      <DoneDropdown closed={done.closed} cancelled={done.cancelled} lane={done.lane} onChange={done.onChange} />
      <ChoiceDropdown
        value={field}
        options={DATE_FIELD_OPTIONS}
        onChange={(v) => onDatesChange({ field: v })}
        ariaLabel="ช่วงวันที่ของช่องไหน"
      />
      {/* 🔴 ห้าม <input type="date"> (ภาษาตามเครื่องคนใช้) — ปฏิทินช่วงวันตัวเดียวกับแท็บผู้สมัคร */}
      <DateRangeCalendarPicker
        triggerVariant="filter"
        value={dates && (dates.from || dates.to) ? { from: dates.from, to: dates.to } : null}
        onChange={(next) => onDatesChange({ field, from: next?.from ?? '', to: next?.to ?? '' })}
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
