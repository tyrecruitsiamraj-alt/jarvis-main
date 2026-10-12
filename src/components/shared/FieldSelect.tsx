import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * ═══ ช่องเลือกในฟอร์มแทน `<select>` ของเบราว์เซอร์ (QA รอบ 2 ข้อ 44 · 12 ต.ค. 2569) ═══
 * ใช้ Select ของ shadcn — หน้าตาเดียวกับช่องกรอก (`Input` · สูง h-11) · มือถือตัว 16px ไม่ซูม
 * Select ของ Radix ห้ามค่าว่าง ⇒ แปลง "" เป็นค่าแทนภายในตัวนี้ (ผู้เรียกส่ง/รับ "" ได้ตามเดิม)
 */
const EMPTY = '__field_select_empty__';

/** `group` = หัวกลุ่ม (แทน `<optgroup>`) — ตัวเลือกที่กลุ่มเดียวกันติดกันอยู่ใต้หัวเดียว */
export type FieldSelectOption = { value: string; label: string; disabled?: boolean; group?: string };

/** ตัวเลือกติดกันที่กลุ่มเดียวกัน = ก้อนเดียว (ไม่มีกลุ่ม = ก้อนไร้หัว) */
function chunkByGroup(options: readonly FieldSelectOption[]): Array<{ group?: string; items: FieldSelectOption[] }> {
  const out: Array<{ group?: string; items: FieldSelectOption[] }> = [];
  for (const o of options) {
    const last = out[out.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else out.push({ group: o.group, items: [o] });
  }
  return out;
}

export function FieldSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  disabled,
  ariaLabel,
  className,
  testId,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly FieldSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <Select
      // "" ของ Radix = ยังไม่เลือก (ขึ้น placeholder) · ค่าที่ไม่อยู่ในตัวเลือกก็ขึ้น placeholder เหมือนกัน
      value={value === '' ? (options.some((o) => o.value === '') ? EMPTY : '') : known ? value : ''}
      onValueChange={(v) => {
        // 🔴 QA รอบ 4 (12 ต.ค. 2569): ตัวเลือกเปลี่ยนทีหลัง (ลิสต์โหลดเสร็จ) → select ที่ซ่อนอยู่ของ Radix รีเซ็ตตัวเอง
        // แล้วยิง "" มาเหมือนคนเลือก ⇒ ค่าเดิมหาย · คนกดเองได้ค่าจากตัวเลือกเสมอ (ตัวว่างมาเป็น EMPTY ไม่ใช่ "")
        if (v === EMPTY) return onChange('');
        if (v === '' || !options.some((o) => o.value === v)) return;
        onChange(v);
      }}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {chunkByGroup(options).map((chunk, ci) => {
          const items = chunk.items.map((o, i) => (
            <SelectItem key={`${o.value || EMPTY}-${i}`} value={o.value === '' ? EMPTY : o.value} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ));
          return chunk.group ? (
            <SelectGroup key={`g-${ci}`}>
              <SelectLabel>{chunk.group}</SelectLabel>
              {items}
            </SelectGroup>
          ) : (
            <React.Fragment key={`g-${ci}`}>{items}</React.Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export default FieldSelect;
