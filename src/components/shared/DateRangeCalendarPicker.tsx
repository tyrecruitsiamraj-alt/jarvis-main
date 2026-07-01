import React, { useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { endOfMonth, startOfMonth, subDays } from 'date-fns';
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

const DateRangeCalendarPicker: React.FC<DateRangeCalendarPickerProps> = ({ value, onChange, className }) => {
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
          <div className="flex flex-wrap gap-1.5 p-3 border-b border-border">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.build());
                  if (p.id === 'all') setOpen(false);
                }}
                className="px-2.5 py-1 rounded-full text-xs bg-secondary hover:bg-secondary/80 text-foreground"
              >
                {p.label}
              </button>
            ))}
          </div>
          <Calendar
            mode="range"
            numberOfMonths={isMobile ? 1 : 2}
            selected={selected}
            onSelect={(range) => {
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
              if (range.from && range.to) setOpen(false);
            }}
            initialFocus
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
