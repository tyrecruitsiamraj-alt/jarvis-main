import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { trendBuLabel } from '@/lib/trends/bu';

/**
 * ตัวเลือก BU ของผู้ใช้ที่ดูได้หลาย BU (เจ้าของ 26 ต.ค. 2569) — เฉพาะ BU ในสิทธิ์ ไม่มี "ทุก BU"
 * ชุด BU มาจากเซิร์ฟเวอร์ (`bu_choices` / `buChoices`) · เซิร์ฟเวอร์ตัดสินซ้ำเสมอ
 */
export default function BuChoiceSelect({
  value,
  choices,
  onChange,
  triggerClassName,
  itemClassName,
  ariaLabel = 'เลือก BU',
}: {
  value: string | null;
  choices: readonly string[];
  onChange: (bu: string) => void;
  triggerClassName?: string;
  itemClassName?: string;
  ariaLabel?: string;
}) {
  return (
    <Select value={value ?? choices[0] ?? ''} onValueChange={onChange}>
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel} data-testid="bu-choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((b) => (
          <SelectItem key={b} value={b} className={itemClassName}>
            {trendBuLabel(b)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
