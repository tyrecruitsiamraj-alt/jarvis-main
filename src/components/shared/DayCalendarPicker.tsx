import React, { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { parseYmd, toYmdLocal } from '@/lib/dateTh';
import { thaiDayDate } from '@/lib/periodPick';
import { Button } from '@/components/ui/button';
import { CalendarFooter, CalendarQuickChips } from '@/components/shared/CalendarParts';

/**
 * **เลือก "วันเดียว" จากไอคอนปฏิทิน** (เจ้าของสั่ง 1 ก.ย. 2569:
 * *"เปลี่ยนเป็นโลโก้ Calendar กดไปแล้วเลือกวัน เดือน ปี"*)
 *
 * ต่างจาก `DateRangeCalendarPicker` (เลือกช่วง · หน้าคลังผู้สมัครใช้อยู่) — ตัวนี้เลือกวันเดียว
 * 🔴 12 ต.ค. 2569: หน้าตาตามปฏิทินหน้าหลัก (หัวเดือน + ‹ › แทน dropdown เดือน/ปี) · วันที่เขียน "จ. 12 ต.ค. 2569"
 *
 * ⚠️ ค่าที่คุยกันคือ `YYYY-MM-DD` **ตามเวลาเครื่อง** (ชุดเดียวกับตัวกรองเดิมที่เป็น
 * `<input type="date">`) — ห้ามแปลงเป็น ISO/UTC ระหว่างทาง วันจะเลื่อนไปหนึ่งวัน
 */
const DayCalendarPicker: React.FC<{
  /** `''` = ยังไม่เลือก (ดูทุกวัน) */
  value: string;
  onChange: (ymd: string) => void;
  className?: string;
  /** ข้อความบนปุ่มเมื่อยังไม่ได้เลือกวัน */
  emptyLabel?: string;
  /**
   * ตัวกรองอื่นที่อยู่ในกล่องเดียวกัน (เจ้าของสั่ง 1 ก.ย. 2569:
   * *"ย้ายทุกช่วงเวลาเข้าไปไว้กับเลือกวัน"*) — วางใต้ปฏิทิน
   */
  extra?: React.ReactNode;
  /** ข้อความต่อท้ายบนปุ่ม เช่นช่วงเวลาที่เลือกไว้ — บอกว่ามีตัวกรองอื่นติดอยู่ */
  suffix?: string;
  /** ให้ปุ่มดูว่า "กรองอยู่" แม้ยังไม่ได้เลือกวัน (เช่นเลือกแต่ช่วงเวลา) */
  active?: boolean;
  /** ล้างตัวกรองทั้งกล่อง — ไม่ส่ง = ปุ่มล้างจะล้างแค่วัน */
  onClearAll?: () => void;
  /** ใช้เป็นช่องกรอกในฟอร์ม (ไม่ใช่ตัวกรอง) — ปุ่มล่างเขียน "ล้างวันที่" แทนคำของตัวกรอง (QA รอบ 3 ข้อ 17) */
  asField?: boolean;
}> = ({ value, onChange, className, emptyLabel = 'เลือกวัน', extra, suffix, active, onClearAll, asField = false }) => {
  const [open, setOpen] = useState(false);
  const p = parseYmd(value);
  const selected = p ? new Date(p.y, p.m - 1, p.d) : undefined;
  const todayYmd = toYmdLocal(new Date());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
            value || active
              ? cn(TONE.info.soft, TONE.info.value, 'border-transparent')
              : TONE.neutral.outline,
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5" aria-hidden />
          {value ? thaiDayDate(value) : emptyLabel}
          {suffix ? <span className="opacity-80">· {suffix}</span> : null}
          {value ? (
            /* ล้างวันโดยไม่ต้องเปิดปฏิทิน — กากบาทอยู่ในปุ่มเดียวกัน (span กัน button ซ้อน button) */
            <span
              role="button"
              tabIndex={0}
              aria-label="ล้างวันที่เลือก"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  e.preventDefault();
                  onChange('');
                }
              }}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="h-3 w-3" aria-hidden />
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      {/* หน้าตาเดียวกับปฏิทินหน้าหลัก (เจ้าของ Choice 12 ต.ค. 2569 "แบบ ④") — หัวเดือน + ‹ › · ปุ่มลัด · แถบล่างบอกวันที่ */}
      <PopoverContent className="w-auto space-y-3 p-3" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? toYmdLocal(d) : '');
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
        {extra ? <div className="border-t border-border pt-3">{extra}</div> : null}
        <CalendarFooter
          label={value ? thaiDayDate(value) : emptyLabel}
          action={
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={!value && !active}
              onClick={() => {
                if (onClearAll) onClearAll();
                else onChange('');
                setOpen(false);
              }}
            >
              {onClearAll ? 'ล้างตัวกรองทั้งหมด' : asField ? 'ล้างวันที่' : 'ดูทุกวัน'}
            </Button>
          }
        />
      </PopoverContent>
    </Popover>
  );
};

export default DayCalendarPicker;
