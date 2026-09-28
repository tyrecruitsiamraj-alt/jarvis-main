import React, { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { filterTriggerClass } from '@/lib/filterTrigger';

/**
 * Dropdown เลือกได้ค่าเดียว (ช่องวันที่ไหน · เรียงยังไง · BU ไหน) — ปุ่มหน้าตาเดียวกับหัวข้อกรอง
 * 🔴 เดิมใช้ Select ของโปรเจกต์ ซึ่งสูง/ตัวใหญ่กว่าปุ่มอื่นในแถว (เจ้าของขอให้ "เท่า ๆ กัน")
 * ย้ายมาจาก `BoardFilterPanel` 28 ก.ย. 2569 ให้หน้าแรกใช้ได้โดยไม่ลากแผงกรองกล่องงานมาทั้งก้อน
 * (`BoardFilterPanel` ยังส่งออกชื่อเดิมต่อ — ที่ import จากที่นั่นไม่ต้องแก้)
 */
export function ChoiceDropdown<V extends string>({
  value,
  options,
  onChange,
  triggerLabel,
  ariaLabel,
  active = false,
}: {
  value: V;
  options: readonly { value: V; label: string }[];
  onChange: (v: V) => void;
  /** คำบนปุ่ม — ไม่ส่ง = คำของค่าที่เลือกอยู่ */
  triggerLabel?: string;
  ariaLabel: string;
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="xs" aria-label={ariaLabel} className={filterTriggerClass(active)}>
          {triggerLabel ?? current?.label ?? ''}
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 space-y-1 p-2">
        {options.map((o) => (
          <Button
            key={o.value}
            type="button"
            variant="ghost"
            size="xs"
            aria-pressed={o.value === value}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
            className="w-full justify-between font-normal"
          >
            <span>{o.label}</span>
            {o.value === value ? <Check aria-hidden /> : null}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export default ChoiceDropdown;
