import React, { useMemo, useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { parseYmd, toYmdLocal } from '@/lib/dateTh';
import { thaiDayDate } from '@/lib/periodPick';
import { Button } from '@/components/ui/button';
import { CalendarFooter, CalendarQuickChips } from '@/components/shared/CalendarParts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export interface DateSelectDmyBeProps {
  /** YYYY-MM-DD หรือ '' ถ้า allowEmpty */
  value: string;
  onChange: (isoYmd: string) => void;
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
  /** ชื่อช่องสำหรับโปรแกรมอ่านหน้าจอ (ปุ่มไม่มี id ให้ `<label htmlFor>` ชี้) */
  ariaLabel?: string;
}

/** เลือกวันที่จากปฏิทินแบบคลิกวัน — ค่าที่ส่งออกยังเป็น YYYY-MM-DD สำหรับ API */
const DateSelectDmyBe: React.FC<DateSelectDmyBeProps> = ({
  value,
  onChange,
  allowEmpty = false,
  disabled = false,
  className = '',
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const todayYmd = toYmdLocal(new Date());

  const selectedDate = useMemo(() => {
    const parsed = parseYmd(value);
    if (!parsed) return undefined;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }, [value]);

  const displayLabel = useMemo(() => {
    if (!value) return allowEmpty ? 'เลือกวันที่' : '';
    // "จ. 12 ต.ค. 2569" — รูปวันที่เดียวทั้งระบบ (เจ้าของ Choice 12 ต.ค. 2569 · เดิม 12/10/2569)
    return parseYmd(value) ? thaiDayDate(value) : value;
  }, [allowEmpty, value]);

  const buttonClass =
    'jarvis-soft-field w-full h-10 flex items-center justify-between disabled:opacity-50 text-left';

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" disabled={disabled} aria-label={ariaLabel} className={buttonClass}>
            <span className={!displayLabel ? 'text-muted-foreground' : ''}>
              {displayLabel || 'เลือกวันที่'}
            </span>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        {/* หน้าตาเดียวกับปฏิทินหน้าหลัก (เจ้าของ Choice 12 ต.ค. 2569 "แบบ ④") */}
        <PopoverContent className="w-auto space-y-3 p-3" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
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
          <CalendarQuickChips
            items={[
              {
                key: 'today',
                label: 'วันนี้',
                active: value === todayYmd,
                onClick: () => {
                  onChange(todayYmd);
                  setOpen(false);
                },
              },
            ]}
          />
          <CalendarFooter
            label={displayLabel || 'เลือกวันที่'}
            action={
              allowEmpty && value ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <X aria-hidden />
                  ล้างวันที่
                </Button>
              ) : null
            }
          />
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default DateSelectDmyBe;
