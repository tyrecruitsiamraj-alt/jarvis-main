/**
 * ═══ ปฏิทินเลือกช่วงแบบใช้ง่าย (หน้าหลัก · 30 ก.ย. 2569) ═══
 *
 * รอบ 3 เจ้าของ: *"calendar มันดูยาก ทำให้ใช้ง่ายกว่านี้หน่อย แบบ เลือกช่วงวันได้ หรือ จะดูแค่วันไหนได้"*
 * รอบ 17: *"กดลงมามีให้เลือกว่า จะดูช่วงไหน จะดูวันไหน · ช่วงบอกได้เช่น จะดูเดือนนี้ ของปีนี้"*
 * รอบ 18: *"calendar มีปุ่มยืนยันก่อน แล้วมันก็ดู Fix ในการเลือกเกินไป ทำให้มันง่ายกว่านี้หน่อย"* +
 *        *"เลือกเทียบเดือน หรือปี … เช่น เลือก กันยา กับ ตุลา ก็มีแค่ 2 แท่ง … สัปดาห์ด้วย"*
 * ⇒ แท็บ **วัน · สัปดาห์ · เดือน · ปี** แบบเดียวกันหมด: กดครั้งแรก = หน่วยนั้นหน่วยเดียว · กดอีกครั้ง = ถึงหน่วยนั้น (เป็นช่วง)
 *    · กดครั้งที่สามเริ่มใหม่ · ปุ่มลัด 7 วันล่าสุด (ค่าตั้งต้นของหน้า) กับทั้งหมด
 *    · **ยังไม่เปลี่ยนอะไรจนกว่าจะกด "ยืนยัน"** (บรรทัดท้ายบอกว่าจะได้ช่วงไหน) · ปิดป๊อปโดยไม่ยืนยัน = ทิ้งที่เลือกไว้
 * - ช่วงที่ได้มี `unit` ติดไปด้วย ⇒ กราฟรู้ว่าต้องจัดแท่งรายเดือน/รายปี/รายสัปดาห์ (`detailBuckets`)
 * - หัวปฏิทินเป็นเดือนไทย ปี พ.ศ. · สัปดาห์เริ่มวันจันทร์ · วัน/เดือน/ปีที่ยังไม่ถึงกดไม่ได้
 *
 * 🔴 ประกอบจาก shadcn ล้วน (Popover · Calendar · ToggleGroup · Button) — ไม่มี primitive ใหม่ ·
 *    ปฏิทินกลางตัวเดิม (`DateRangeCalendarPicker`) ไม่แตะ (หน้าอื่นยังใช้อยู่) · ตัวคิดวันอยู่ `src/lib/periodPick.ts`
 */
import React, { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { th } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EVEN_TYPE } from '@/lib/designTokens';
import { parseYmd, toYmdBangkok, toYmdLocal } from '@/lib/dateTh';
import {
  PERIOD_UNITS,
  PERIOD_UNIT_LABEL,
  QUICK_PERIODS,
  TH_MONTH_FULL,
  TH_MONTH_SHORT,
  isPeriodUnit,
  periodLabel,
  periodModeOf,
  quickKeyOf,
  unitSpan,
  type PeriodUnit,
  type PeriodWindow,
} from '@/lib/periodPick';
import { cn } from '@/lib/utils';

/** ปุ่มลัด — ค่าตั้งต้นของหน้า (7 วันล่าสุด) กับทั้งหมด (ที่เหลือเลือกจากแท็บได้หมดแล้ว) */
const QUICK_KEYS = ['last7', 'all'] as const;
const QUICK = QUICK_PERIODS.filter((q) => (QUICK_KEYS as readonly string[]).includes(q.key));

/** แท็บปีย้อนหลังได้กี่ปี (รวมปีนี้) */
const YEARS_SHOWN = 6;

const toDate = (ymd: string | null | undefined): Date | undefined => {
  const p = parseYmd(ymd ?? null);
  return p ? new Date(p.y, p.m - 1, p.d) : undefined;
};

/** หัวปฏิทินเป็นเดือนไทย ปี พ.ศ. (เดิมขึ้น September 2026) */
const formatters = {
  formatCaption: (month: Date) => `${TH_MONTH_FULL[month.getMonth()]} ${month.getFullYear() + 543}`,
};

const firstOf = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}-01`;

/** แท็บที่ควรเปิดให้ตรงกับช่วงที่เลือกอยู่ */
function unitOf(win: PeriodWindow): PeriodUnit {
  if (win.unit) return win.unit;
  const mode = periodModeOf(win);
  return mode === 'week' || mode === 'month' || mode === 'year' ? mode : 'day';
}

/** ช่วงเดียวกันและหน่วยเดียวกัน (ไม่มีหน่วย = รายวัน) */
const same = (a: PeriodWindow, b: PeriodWindow) => a.from === b.from && a.to === b.to && (a.unit ?? 'day') === (b.unit ?? 'day');
/** วันนั้นอยู่ในช่วงที่เลือกไว้ไหม */
const inside = (win: PeriodWindow, from: string, to: string) => !!win.from && !!win.to && win.from <= from && to <= win.to;

const PeriodPicker: React.FC<{
  value: PeriodWindow;
  onChange: (next: PeriodWindow) => void;
  /** วันนี้ (YYYY-MM-DD เวลาไทย) — เทสต์ส่งเองได้ */
  today?: string;
}> = ({ value, onChange, today: todayProp }) => {
  const today = todayProp ?? toYmdBangkok(new Date());
  const todayDate = toDate(today)!;
  const thisYear = Number(today.slice(0, 4));
  const [open, setOpen] = useState(false);
  const [unit, setUnit] = useState<PeriodUnit>(() => unitOf(value));
  /** ที่เลือกไว้ รอกดยืนยัน */
  const [draft, setDraft] = useState<PeriodWindow>(value);
  /** กดครั้งแรกของช่วง (รอกดครั้งที่สอง) · null = กดครั้งถัดไปเริ่มช่วงใหม่ */
  const [anchor, setAnchor] = useState<string | null>(null);
  /** ปีของแท็บเดือน */
  const [viewYear, setViewYear] = useState(() => Number((value.to ?? today).slice(0, 4)));

  const label = periodLabel(value, today);
  const quick = quickKeyOf(draft, today);
  const years = Array.from({ length: YEARS_SHOWN }, (_, i) => thisYear - (YEARS_SHOWN - 1) + i);

  const openChange = (o: boolean) => {
    setOpen(o);
    if (o) {
      setUnit(unitOf(value));
      setDraft(value);
      setAnchor(null);
      setViewYear(Number((value.to ?? today).slice(0, 4)));
    }
  };

  /** กดหน่วยหนึ่ง — ครั้งแรก = หน่วยเดียว · ครั้งที่สอง = ถึงหน่วยนั้น */
  const pickPoint = (u: PeriodUnit, ymd: string) => {
    if (anchor === null) {
      setAnchor(ymd);
      setDraft(unitSpan(u, ymd, ymd));
    } else {
      setDraft(unitSpan(u, anchor, ymd));
      setAnchor(null);
    }
  };

  const confirm = () => {
    onChange(draft);
    setOpen(false);
  };

  /** ที่เลือกไว้ของแท็บนี้ (ติดสีในปฏิทิน/ตาราง) — ของแท็บอื่นไม่ติดสี แต่ยังเป็นค่าที่จะยืนยัน */
  const shown = (draft.unit ?? 'day') === unit ? draft : null;
  const calendarRange: DateRange | undefined =
    shown?.from && shown.to && (unit === 'day' || unit === 'week') ? { from: toDate(shown.from), to: toDate(shown.to) } : undefined;

  return (
    <Popover open={open} onOpenChange={openChange}>
      <PopoverTrigger asChild>
        {/* ไอคอนปฏิทินอย่างเดียว (เจ้าของสั่ง 30 ก.ย. 2569: *"ไม่เอาคำว่า 7 วันล่าสุด เอาเป็นไอคอน calendar"*)
            ช่วงที่เลือกอยู่ยังบอกได้ตอนจี้ (`title`) และในชื่อของปุ่มสำหรับโปรแกรมอ่านจอ · หัวกราฟบอกช่วงวันจริงอีกที่ */}
        <Button type="button" variant="outline" size="icon" aria-label={`ช่วงเวลา ${label}`} title={label}>
          <CalendarDays aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn('w-auto max-w-[calc(100vw-2rem)] space-y-3 p-3', EVEN_TYPE)}>
        <ToggleGroup
          type="single"
          value={unit}
          onValueChange={(v) => {
            if (!isPeriodUnit(v)) return;
            setUnit(v);
            setAnchor(null);
          }}
          className="grid grid-cols-4 gap-1"
          aria-label="ดูเป็น"
        >
          {PERIOD_UNITS.map((u) => (
            <ToggleGroupItem key={u} value={u} size="sm" className="text-sm">
              {PERIOD_UNIT_LABEL[u]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {unit === 'day' || unit === 'week' ? (
          <Calendar
            locale={th}
            weekStartsOn={1}
            formatters={formatters}
            disabled={{ after: todayDate }}
            defaultMonth={toDate(draft.to) ?? todayDate}
            toDate={todayDate}
            mode="range"
            selected={calendarRange}
            onDayClick={(d, modifiers) => {
              if (modifiers.disabled) return;
              pickPoint(unit, toYmdLocal(d));
            }}
          />
        ) : null}

        {unit === 'month' ? (
          <div className="w-64 space-y-2">
            <div className="flex items-center justify-between">
              <Button type="button" size="iconXs" variant="outline" aria-label="ปีก่อน" onClick={() => setViewYear((y) => y - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="text-sm font-medium tabular-nums text-foreground">พ.ศ. {viewYear + 543}</span>
              <Button
                type="button"
                size="iconXs"
                variant="outline"
                aria-label="ปีถัดไป"
                disabled={viewYear >= thisYear}
                onClick={() => setViewYear((y) => y + 1)}
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {TH_MONTH_SHORT.map((name, i) => {
                const first = firstOf(viewYear, i + 1);
                const on = !!shown && inside(shown, first, first);
                return (
                  <Button
                    key={name}
                    type="button"
                    size="xs"
                    variant={on ? 'default' : 'outline'}
                    aria-pressed={on}
                    disabled={first > today}
                    aria-label={`${TH_MONTH_FULL[i]} ${viewYear + 543}`}
                    onClick={() => pickPoint('month', first)}
                  >
                    {name}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}

        {unit === 'year' ? (
          <div className="grid w-64 grid-cols-3 gap-1.5">
            {years.map((y) => {
              const on = !!shown && inside(shown, `${y}-01-01`, `${y}-01-01`);
              return (
                <Button
                  key={y}
                  type="button"
                  size="xs"
                  variant={on ? 'default' : 'outline'}
                  aria-pressed={on}
                  aria-label={`ปี ${y + 543}`}
                  onClick={() => pickPoint('year', `${y}-01-01`)}
                >
                  {y + 543}
                </Button>
              );
            })}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-1.5" role="group" aria-label="ปุ่มลัด">
          {QUICK.map((q) => (
            <Button
              key={q.key}
              type="button"
              size="xs"
              variant={quick === q.key ? 'secondary' : 'outline'}
              aria-pressed={quick === q.key}
              onClick={() => {
                const w = q.build(today);
                setDraft(w.from ? { ...w, unit: 'day' } : w);
                setAnchor(null);
              }}
            >
              {q.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="text-sm tabular-nums text-foreground" aria-live="polite">
            {periodLabel(draft, today)}
          </span>
          <Button type="button" size="sm" onClick={confirm} disabled={same(draft, value)}>
            ยืนยัน
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PeriodPicker;
