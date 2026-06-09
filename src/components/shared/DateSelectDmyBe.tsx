import React, { useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { parseYmd, toYmdLocal, ceToBeYear } from '@/lib/dateTh';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export interface DateSelectDmyBeProps {
  /** YYYY-MM-DD หรือ '' ถ้า allowEmpty */
  value: string;
  onChange: (isoYmd: string) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
}

/** เลือกวันที่จากปฏิทินแบบคลิกวัน — ค่าที่ส่งออกยังเป็น YYYY-MM-DD สำหรับ API */
const DateSelectDmyBe: React.FC<DateSelectDmyBeProps> = ({
  value,
  onChange,
  allowEmpty = false,
  disabled = false,
  className = '',
}) => {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => {
    const parsed = parseYmd(value);
    if (!parsed) return undefined;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }, [value]);

  const displayLabel = useMemo(() => {
    if (!value) return allowEmpty ? 'เลือกวันที่' : '';
    const parsed = parseYmd(value);
    if (!parsed) return value;
    return `${parsed.d}/${parsed.m}/${ceToBeYear(parsed.y)}`;
  }, [allowEmpty, value]);

  const buttonClass =
    'jarvis-soft-field w-full h-10 flex items-center justify-between disabled:opacity-50 text-left';

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} className={buttonClass}>
            <span className={!displayLabel ? 'text-muted-foreground' : ''}>
              {displayLabel || 'เลือกวันที่'}
            </span>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (!date) {
                if (allowEmpty) onChange('');
                return;
              }
              onChange(toYmdLocal(date));
              setOpen(false);
            }}
            initialFocus
          />
          {allowEmpty && (
            <div className="border-t border-border p-2 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/80"
              >
                <X className="h-3.5 w-3.5" />
                ล้างวันที่
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateSelectDmyBe;
