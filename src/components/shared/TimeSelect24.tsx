import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { FieldSelect } from '@/components/shared/FieldSelect';

export type TimeSelect24Props = {
  /** HH:mm เช่น 08:00 */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  /** ชื่อช่องสำหรับคนใช้โปรแกรมอ่านหน้าจอ เช่น "รอบที่ 2" — มีหลายช่องในหน้าเดียวต้องแยกให้ออก */
  label?: string;
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

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: pad2(h) }));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, m) => ({ value: String(m), label: pad2(m) }));

/** เลือกเวลาแบบ 24 ชม. (ไม่มี AM/PM) */
const TimeSelect24: React.FC<TimeSelect24Props> = ({
  value,
  onChange,
  disabled = false,
  className,
  label,
}) => {
  const parsed = useMemo(() => parseTime24(value) ?? { hour: 8, minute: 0 }, [value]);

  const setHour = (hour: number) => {
    onChange(`${pad2(hour)}:${pad2(parsed.minute)}`);
  };

  const setMinute = (minute: number) => {
    onChange(`${pad2(parsed.hour)}:${pad2(minute)}`);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* ตัวเลือก shadcn แทน select ของเบราว์เซอร์ (QA รอบ 2 ข้อ 44 · 12 ต.ค. 2569) */}
      <FieldSelect
        value={String(parsed.hour)}
        disabled={disabled}
        onChange={(v) => setHour(Number(v))}
        className="min-w-0 flex-1"
        ariaLabel={label ? `${label} — ชั่วโมง` : 'ชั่วโมง'}
        options={HOUR_OPTIONS}
      />
      <span className="text-muted-foreground font-medium shrink-0">:</span>
      <FieldSelect
        value={String(parsed.minute)}
        disabled={disabled}
        onChange={(v) => setMinute(Number(v))}
        className="min-w-0 flex-1"
        ariaLabel={label ? `${label} — นาที` : 'นาที'}
        options={MINUTE_OPTIONS}
      />
      <span className="text-xs text-muted-foreground shrink-0">น.</span>
    </div>
  );
};

export default TimeSelect24;
