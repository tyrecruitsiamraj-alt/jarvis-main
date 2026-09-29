/**
 * ═══ ตัวกรองช่วงเวลาก้อนเดียวของหน้าทีม Online (รอบ 5 · 29 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"วัน สัปดาห์ เดือน ไตรมาส ปี ทั้งหมด เทียบช่วงก่อน ทำให้เป็น Filter ก้อนเดียวกัน"*
 * ⇒ ปุ่มเดียวบอกช่วงที่ดูอยู่ ("7 วันล่าสุด · รายวัน · เทียบช่วงก่อน") กดแล้วกางแผงเดียวที่มีครบ 3 อย่าง:
 *    ดูเป็น (งวด) · ช่วงวันที่ (ค่าตั้งต้น / เลือกเองบนปฏิทิน) · เทียบกับ (ช่วงก่อน / ปีก่อน)
 * 🔴 ปฏิทินฝังในแผงเดียวกัน — **ไม่ซ้อนป๊อปในป๊อป** (ตัวเลือกช่วงวันที่ตัวเดิมเป็นป๊อปของมันเอง จึงไม่ใช้ซ้อน)
 * 🔴 ใช้ `useTrendWindow` ตัวเดียวกับแท็บ Dashboard (สถานะเก็บในหน้า ไม่ผูก URL) · **แถบของแท็บ Dashboard ไม่แตะ**
 */
import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronDown } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TREND_COMPARE_OPTIONS, type TrendWindow } from '@/hooks/useTrendWindow';
import { useIsMobile } from '@/hooks/use-mobile';
import { formatYmdDmyBe, parseYmd, toYmdLocal } from '@/lib/dateTh';
import { TREND_DEFAULT_SPAN, TREND_GRAINS, TREND_GRAIN_LABEL, type TrendGrain } from '@/lib/trends/timeBuckets';
import { DASH } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const ymdToDate = (ymd: string): Date | undefined => {
  const p = parseYmd(ymd);
  return p ? new Date(p.y, p.m - 1, p.d) : undefined;
};

/** "7 วันล่าสุด" / "12 สัปดาห์ล่าสุด" — ช่วงตั้งต้นของงวดนั้น */
function defaultSpanText(grain: TrendGrain, spans?: Partial<Record<TrendGrain, number>>): string {
  const n = spans?.[grain] ?? TREND_DEFAULT_SPAN[grain];
  return `${n.toLocaleString('th-TH')} ${TREND_GRAIN_LABEL[grain]}ล่าสุด`;
}

function timeFilterSummary(win: TrendWindow, spans?: Partial<Record<TrendGrain, number>>): string {
  const range = win.custom
    ? `${formatYmdDmyBe(win.custom.from)} – ${formatYmdDmyBe(win.custom.to)}`
    : defaultSpanText(win.grain, spans);
  const compare = TREND_COMPARE_OPTIONS.find((o) => o.value === win.compare)?.label ?? '';
  return `${range} · ราย${TREND_GRAIN_LABEL[win.grain]} · ${compare}`;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className={cn('text-xs', DASH.muted)}>{label}</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {children}
      </div>
    </div>
  );
}

const TeamTimeFilter: React.FC<{ win: TrendWindow; spans?: Partial<Record<TrendGrain, number>> }> = ({ win, spans }) => {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const isMobile = useIsMobile();
  const selected = useMemo<DateRange | undefined>(
    () => (win.custom ? { from: ymdToDate(win.custom.from), to: ymdToDate(win.custom.to) } : undefined),
    [win.custom],
  );
  const showCalendar = picking || !!win.custom;

  const onSelect = (r: DateRange | undefined) => {
    if (!r?.from) return;
    const from = toYmdLocal(r.from);
    const to = r.to ? toYmdLocal(r.to) : from;
    win.setCustom({ from, to });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setPicking(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" size="xs" variant="outline" aria-label={`ช่วงเวลา: ${timeFilterSummary(win, spans)}`}>
          <CalendarRange aria-hidden />
          <span className="truncate">{timeFilterSummary(win, spans)}</span>
          <ChevronDown aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto space-y-4 rounded-xl p-3">
        <Group label="ดูเป็น">
          {TREND_GRAINS.map((g) => (
            <Button
              key={g}
              type="button"
              size="xs"
              variant={win.grain === g ? 'default' : 'outline'}
              aria-pressed={win.grain === g}
              onClick={() => {
                win.setGrain(g);
                setPicking(false);
              }}
            >
              {TREND_GRAIN_LABEL[g]}
            </Button>
          ))}
        </Group>
        <Group label="ช่วงวันที่">
          <Button
            type="button"
            size="xs"
            variant={!showCalendar ? 'default' : 'outline'}
            aria-pressed={!showCalendar}
            onClick={() => {
              win.setCustom(null);
              setPicking(false);
            }}
          >
            {defaultSpanText(win.grain, spans)}
          </Button>
          <Button
            type="button"
            size="xs"
            variant={showCalendar ? 'default' : 'outline'}
            aria-pressed={showCalendar}
            onClick={() => setPicking(true)}
          >
            เลือกเองบนปฏิทิน
          </Button>
        </Group>
        {showCalendar ? (
          <Calendar mode="range" numberOfMonths={isMobile ? 1 : 2} selected={selected} onSelect={onSelect} initialFocus />
        ) : null}
        <Group label="เทียบกับ">
          {TREND_COMPARE_OPTIONS.map((o) => (
            <Button
              key={o.value}
              type="button"
              size="xs"
              variant={win.compare === o.value ? 'default' : 'outline'}
              aria-pressed={win.compare === o.value}
              onClick={() => win.setCompare(o.value)}
            >
              {o.label}
            </Button>
          ))}
        </Group>
      </PopoverContent>
    </Popover>
  );
};

export default TeamTimeFilter;
