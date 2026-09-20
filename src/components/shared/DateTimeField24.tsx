import React from 'react';
import DayCalendarPicker from '@/components/shared/DayCalendarPicker';
import TimeSelect24 from '@/components/shared/TimeSelect24';
import { cn } from '@/lib/utils';

/**
 * ═══ ช่อง "วันที่ + เวลา" ที่หน้าตาเหมือนกันทุกเครื่อง (20 ก.ย. 2569) ═══
 *
 * เจ้าของทัก: *"หน้าการติดตาม บางคนยังขึ้น am pm อยู่เลย"*
 *
 * `<input type="datetime-local">` (และ `type="time"` / `type="date"`) แสดงผลตาม
 * **ภาษาของเครื่องคนใช้** ไม่ใช่ของหน้าเว็บ ⇒ เครื่องอังกฤษเห็น `09/18/2026 05:50 AM`
 * เครื่องไทยเห็น `18/09/2026 05:50` · สั่งด้วย `lang` ของหน้าไม่ได้ (Chrome ไม่สน)
 *
 * ตัวนี้ประกอบจากของที่มีอยู่แล้วสองชิ้น — ปฏิทินไทย + เลือกเวลา 24 ชม.
 * ⇒ ทุกเครื่องเห็นเหมือนกัน และไม่มี AM/PM ให้อ่านผิด
 *
 * ⚠️ ค่าที่คุยกันคือ **`YYYY-MM-DDTHH:mm` ตามเวลาเครื่อง** — รูปเดียวกับที่
 * `<input type="datetime-local">` เคยให้ ⇒ โค้ดที่รับค่าต่อไม่ต้องแก้อะไรเลย
 */
export type DateTimeField24Props = {
  /** `YYYY-MM-DDTHH:mm` · `''` = ยังไม่เลือก */
  value: string;
  onChange: (value: string) => void;
  /** ชื่อช่องสำหรับโปรแกรมอ่านหน้าจอ เช่น "รอบที่ 2" */
  label?: string;
  className?: string;
};

/** เวลาเริ่มต้นเมื่อยังไม่เคยเลือก — 08:00 เหมือนค่าเริ่มของ `TimeSelect24` */
const DEFAULT_TIME = '08:00';

export function splitLocalDateTime(value: string): { ymd: string; time: string } {
  const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  return m ? { ymd: m[1], time: m[2] } : { ymd: '', time: '' };
}

const DateTimeField24: React.FC<DateTimeField24Props> = ({ value, onChange, label, className }) => {
  const { ymd, time } = splitLocalDateTime(value);

  // ยังไม่มีวัน = ยังประกอบค่าไม่ได้ (เลือกเวลาอย่างเดียวไม่มีความหมาย) ⇒ เก็บไว้รอวัน
  const emit = (nextYmd: string, nextTime: string) => {
    if (!nextYmd) {
      onChange('');
      return;
    }
    onChange(`${nextYmd}T${nextTime || DEFAULT_TIME}`);
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <DayCalendarPicker
        value={ymd}
        onChange={(next) => emit(next, time)}
        emptyLabel={label ? `เลือกวัน · ${label}` : 'เลือกวัน'}
        className="min-w-[9.5rem] flex-1"
      />
      <TimeSelect24
        value={time || DEFAULT_TIME}
        onChange={(next) => emit(ymd, next)}
        label={label}
        className="flex-1"
      />
    </div>
  );
};

export default DateTimeField24;
