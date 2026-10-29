import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { normalizeTrendBu } from '@/lib/trends/bu';

/** ค่าของตัวเลือก "ทุก BU" ใน Select (ค่าว่างใช้ไม่ได้) */
const ALL = '__all';

/**
 * ตัวเลือก BU ของผู้ใช้ที่ดูได้หลาย BU (เจ้าของ 26 ต.ค. 2569) — เฉพาะ BU ในสิทธิ์
 * ชุด BU มาจากเซิร์ฟเวอร์ (`bu_choices` / `buChoices`) · เซิร์ฟเวอร์ตัดสินซ้ำเสมอ
 * โชว์แค่ชื่อย่อ (เจ้าของ 29 ต.ค. 2569 "เอาแค่ชื่อย่อ")
 * `allOption` = มี "ทุก BU" (ผลรวมทุก BU ในสิทธิ์ · ค่า null) — หน้าที่เซิร์ฟเวอร์รองรับชุด BU เท่านั้น
 */
export default function BuChoiceSelect({
  value,
  choices,
  onChange,
  allOption = false,
  triggerClassName,
  itemClassName,
  ariaLabel = 'เลือก BU',
}: {
  value: string | null;
  choices: readonly string[];
  onChange: (bu: string | null) => void;
  allOption?: boolean;
  triggerClassName?: string;
  itemClassName?: string;
  ariaLabel?: string;
}) {
  const current = value ?? (allOption ? ALL : (choices[0] ?? ''));
  return (
    <Select value={current} onValueChange={(v) => onChange(v === ALL ? null : v)}>
      <SelectTrigger className={triggerClassName} aria-label={ariaLabel} data-testid="bu-choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allOption ? (
          <SelectItem value={ALL} className={itemClassName}>
            ทุก BU
          </SelectItem>
        ) : null}
        {choices.map((b) => (
          <SelectItem key={b} value={b} className={itemClassName}>
            {normalizeTrendBu(b) ?? b}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
