import React, { useState } from 'react';
import { CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe, parseYmd, toYmdLocal } from '@/lib/dateTh';

/**
 * **เลือก "วันเดียว" จากไอคอนปฏิทิน** (เจ้าของสั่ง 1 ก.ย. 2569:
 * *"เปลี่ยนเป็นโลโก้ Calendar กดไปแล้วเลือกวัน เดือน ปี"*)
 *
 * ต่างจาก `DateRangeCalendarPicker` (เลือกช่วง · หน้าคลังผู้สมัครใช้อยู่) —
 * ตัวนี้เลือกวันเดียว และ **เลื่อนเดือน/ปีจาก dropdown ได้** ไม่ต้องกดลูกศรทีละเดือน
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
}> = ({ value, onChange, className, emptyLabel = 'เลือกวัน', extra, suffix, active, onClearAll }) => {
  const [open, setOpen] = useState(false);
  const p = parseYmd(value);
  const selected = p ? new Date(p.y, p.m - 1, p.d) : undefined;
  const thisYear = new Date().getFullYear();

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
          {value ? formatYmdDmyBe(value) : emptyLabel}
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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            onChange(d ? toYmdLocal(d) : '');
            setOpen(false);
          }}
          /* เลือกเดือน/ปีจาก dropdown — ย้อนดูงานเก่าหรือดูล่วงหน้าโดยไม่ต้องกดลูกศรทีละเดือน */
          captionLayout="dropdown-buttons"
          fromYear={thisYear - 2}
          toYear={thisYear + 2}
          /**
           * ⚠️ โหมด dropdown ของ react-day-picker วาด "ป้ายเดือน/ปี" ซ้ำอีกชุดหนึ่ง
           * (caption_label + ป้ายสำหรับ screen reader) — ถ้าไม่ซ่อน จะเห็นคำว่า
           * September/2026 โผล่ซ้ำ 2-3 รอบในกล่องเดียว อ่านแล้วเหมือนจอพัง
           */
          classNames={{
            caption_label: 'sr-only',
            vhidden: 'sr-only',
            caption_dropdowns: 'flex items-center gap-1.5',
            dropdown:
              'rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground',
          }}
          initialFocus
        />
        {extra ? <div className="border-t p-2.5">{extra}</div> : null}
        <div className="border-t p-2">
          <button
            type="button"
            onClick={() => {
              if (onClearAll) onClearAll();
              else onChange('');
              setOpen(false);
            }}
            className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-secondary"
          >
            {onClearAll ? 'ล้างตัวกรองทั้งหมด' : 'ดูทุกวัน (ล้างวันที่)'}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DayCalendarPicker;
