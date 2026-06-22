import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export type TimeSelect24Props = {
  /** HH:mm เช่น 08:00 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function parseTime24(value: string): { hour: number; minute: number } | null {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

/** เลือกเวลาแบบ 24 ชม. (ไม่มี AM/PM) */
const TimeSelect24: React.FC<TimeSelect24Props> = ({ value, onChange, disabled = false, className }) => {
  const parsed = useMemo(() => parseTime24(value) ?? { hour: 8, minute: 0 }, [value]);

  const setHour = (hour: number) => {
    onChange(`${pad2(hour)}:${pad2(parsed.minute)}`);
  };

  const setMinute = (minute: number) => {
    onChange(`${pad2(parsed.hour)}:${pad2(minute)}`);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <select
        value={parsed.hour}
        disabled={disabled}
        onChange={(e) => setHour(Number(e.target.value))}
        className="jarvis-soft-field flex-1 min-w-0"
        aria-label="ชั่วโมง"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {pad2(h)}
          </option>
        ))}
      </select>
      <span className="text-muted-foreground font-medium shrink-0">:</span>
      <select
        value={parsed.minute}
        disabled={disabled}
        onChange={(e) => setMinute(Number(e.target.value))}
        className="jarvis-soft-field flex-1 min-w-0"
        aria-label="นาที"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {pad2(m)}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground shrink-0">น.</span>
    </div>
  );
};

export default TimeSelect24;
