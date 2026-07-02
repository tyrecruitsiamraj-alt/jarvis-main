import React, { useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { differenceInCalendarDays, endOfMonth, startOfMonth, subDays } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { formatYmdDmyBe, parseYmd, toYmdLocal } from '@/lib/dateTh';
import { useIsMobile } from '@/hooks/use-mobile';

export type DateRangeYmd = { from: string; to: string };

export interface DateRangeCalendarPickerProps {
  value: DateRangeYmd | null;
  onChange: (next: DateRangeYmd | null) => void;
  className?: string;
  /** `panel` = inline card for dashboards; `popover` = compact trigger */
  layout?: 'panel' | 'popover';
}

function ymdToDate(ymd: string): Date | undefined {
  const p = parseYmd(ymd);
  if (!p) return undefined;
  return new Date(p.y, p.m - 1, p.d);
}

function formatRangeLabel(value: DateRangeYmd | null): string {
  if (!value?.from && !value?.to) return 'ทั้งหมด';
  if (value.from && value.to) {
    return `${formatYmdDmyBe(value.from)} – ${formatYmdDmyBe(value.to)}`;
  }
  if (value.from) return `ตั้งแต่ ${formatYmdDmyBe(value.from)}`;
  if (value.to) return `ถึง ${formatYmdDmyBe(value.to)}`;
  return 'เลือกช่วงวันที่';
}

function rangeDayCount(value: DateRangeYmd | null): number | null {
  if (!value?.from || !value?.to) return null;
  const from = ymdToDate(value.from);
  const to = ymdToDate(value.to);
  if (!from || !to) return null;
  return differenceInCalendarDays(to, from) + 1;
}

function rangesEqual(a: DateRangeYmd | null, b: DateRangeYmd | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.from === b.from && a.to === b.to;
}

const PRESETS: { id: string; label: string; build: () => DateRangeYmd | null }[] = [
  {
    id: 'all',
    label: 'ทั้งหมด',
    build: () => null,
  },
  {
    id: 'month',
    label: 'เดือนนี้',
    build: () => {
      const now = new Date();
      return { from: toYmdLocal(startOfMonth(now)), to: toYmdLocal(endOfMonth(now)) };
    },
  },
  {
    id: 'last30',
    label: '30 วันล่าสุด',
    build: () => {
      const now = new Date();
      return { from: toYmdLocal(subDays(now, 29)), to: toYmdLocal(now) };
    },
  },
];

const PANEL_CALENDAR_CLASSNAMES = {
  months: 'flex flex-col sm:flex-row gap-6 sm:gap-8',
  month: 'space-y-3',
  caption: 'flex justify-center pt-1 relative items-center mb-1',
  caption_label: 'text-sm font-semibold text-foreground',
  head_cell: 'text-muted-foreground rounded-md w-10 font-medium text-[0.7rem] uppercase tracking-wide',
  row: 'flex w-full mt-1',
  cell: 'h-10 w-10 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-lg [&:has([aria-selected].day-outside)]:bg-primary/10 [&:has([aria-selected])]:bg-primary/10 first:[&:has([aria-selected])]:rounded-l-lg last:[&:has([aria-selected])]:rounded-r-lg focus-within:relative focus-within:z-20',
  day: 'h-10 w-10 p-0 font-normal aria-selected:opacity-100 rounded-lg hover:bg-secondary/80',
  day_selected:
    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-lg',
  day_today: 'bg-secondary text-foreground font-semibold ring-1 ring-primary/30',
  day_range_middle: 'aria-selected:bg-primary/15 aria-selected:text-foreground rounded-none',
};

function PresetChips({
  value,
  onChange,
  onPresetAll,
  size = 'sm',
}: {
  value: DateRangeYmd | null;
  onChange: (next: DateRangeYmd | null) => void;
  onPresetAll?: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRESETS.map((p) => {
        const built = p.build();
        const active = rangesEqual(value, built);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              onChange(built);
              if (p.id === 'all') onPresetAll?.();
            }}
            className={cn(
              'rounded-full font-medium transition-colors',
              size === 'md' ? 'px-3.5 py-1.5 text-xs' : 'px-2.5 py-1 text-xs',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-secondary/80 text-foreground hover:bg-secondary',
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeCalendar({
  selected,
  onSelect,
  numberOfMonths,
}: {
  selected: DateRange | undefined;
  onSelect: (range: DateRange | undefined) => void;
  numberOfMonths: number;
}) {
  return (
    <Calendar
      mode="range"
      numberOfMonths={numberOfMonths}
      selected={selected}
      onSelect={onSelect}
      classNames={PANEL_CALENDAR_CLASSNAMES}
      initialFocus
    />
  );
}

const DateRangeCalendarPicker: React.FC<DateRangeCalendarPickerProps> = ({
  value,
  onChange,
  className,
  layout = 'popover',
}) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const selected = useMemo<DateRange | undefined>(() => {
    if (!value?.from && !value?.to) return undefined;
    const from = value.from ? ymdToDate(value.from) : undefined;
    const to = value.to ? ymdToDate(value.to) : undefined;
    if (!from && !to) return undefined;
    return { from, to };
  }, [value]);

  const label = formatRangeLabel(value);
  const dayCount = rangeDayCount(value);

  const handleSelect = (range: DateRange | undefined, closeOnComplete = false) => {
    if (!range) {
      onChange(null);
      return;
    }
    const from = range.from ? toYmdLocal(range.from) : '';
    const to = range.to ? toYmdLocal(range.to) : from;
    if (!from) {
      onChange(null);
      return;
    }
    onChange({ from, to: to || from });
    if (closeOnComplete && range.from && range.to) setOpen(false);
  };

  if (layout === 'panel') {
    return (
      <div className={cn('jarvis-frost rounded-2xl overflow-hidden', className)}>
        <div className="px-4 py-4 sm:px-5 sm:py-4 border-b border-black/[0.06] bg-gradient-to-r from-primary/5 via-transparent to-transparent">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ช่วงวันที่กรอกใบขอ</p>
                <p className={cn('text-base sm:text-lg font-semibold text-foreground mt-0.5 truncate', !value && 'text-muted-foreground font-medium')}>
                  {label}
                </p>
                {dayCount != null ? (
                  <p className="text-xs text-muted-foreground mt-1">{dayCount.toLocaleString('th-TH')} วันในช่วงที่เลือก</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">แสดงใบขอทุกวันที่กรอก</p>
                )}
              </div>
            </div>
            <PresetChips value={value} onChange={onChange} size="md" />
          </div>
        </div>

        <div className="flex justify-center px-2 py-4 sm:px-4 sm:py-5 bg-white/30">
          <RangeCalendar
            selected={selected}
            onSelect={(range) => handleSelect(range, false)}
            numberOfMonths={isMobile ? 1 : 2}
          />
        </div>

        {value ? (
          <div className="border-t border-black/[0.06] px-4 py-2.5 sm:px-5 flex justify-end bg-secondary/20">
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              ล้างช่วงวันที่
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="jarvis-soft-field w-full h-10 flex items-center justify-between text-left text-sm"
          >
            <span className={cn(!value && 'text-muted-foreground')}>{label}</span>
            <CalendarIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 border-b border-border">
            <PresetChips value={value} onChange={onChange} onPresetAll={() => setOpen(false)} />
          </div>
          <RangeCalendar
            selected={selected}
            onSelect={(range) => handleSelect(range, true)}
            numberOfMonths={isMobile ? 1 : 2}
          />
          {value ? (
            <div className="border-t border-border p-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80"
              >
                <X className="h-3.5 w-3.5" />
                ล้างช่วงวันที่
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateRangeCalendarPicker;

export function jobRequestDateYmd(job: { request_date?: string; submittedAt?: string; created_at?: string }): string | null {
  const raw = job.request_date || job.submittedAt || job.created_at;
  if (!raw || typeof raw !== 'string') return null;
  return raw.slice(0, 10);
}

export function isYmdInRange(ymd: string | null, range: DateRangeYmd | null): boolean {
  if (!range) return true;
  if (!ymd) return false;
  const { from, to } = range;
  if (from && ymd < from) return false;
  if (to && ymd > to) return false;
  return true;
}
