import React from 'react';
import { Button } from '@/components/ui/button';

/**
 * ═══ ชิ้นส่วนใต้ปฏิทิน — หน้าตาเดียวกับปฏิทินหน้าหลัก (`PeriodPicker`) ทุกตัวเลือกวันที่ ═══
 * เจ้าของ Choice 12 ต.ค. 2569 "แบบ ④ หน้าหลัก" (QA รอบ 2 ข้อ 43 · เดิม 4 หน้าตา):
 * หัว "ตุลาคม 2569" + ‹ › · สัปดาห์เริ่มจันทร์ (ค่าตั้งต้นของ `ui/calendar`) · ปุ่มลัดใต้ปฏิทิน · แถบล่างบอกวันที่เลือก
 * กล่องที่ครอบ = `PopoverContent className="w-auto space-y-3 p-3"`
 */
export type CalendarQuick = { key: string; label: string; active: boolean; onClick: () => void; disabled?: boolean };

export function CalendarQuickChips({ items }: { items: readonly CalendarQuick[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="ปุ่มลัด">
      {items.map((q) => (
        <Button
          key={q.key}
          type="button"
          size="xs"
          variant={q.active ? 'secondary' : 'outline'}
          aria-pressed={q.active}
          disabled={q.disabled}
          onClick={q.onClick}
        >
          {q.label}
        </Button>
      ))}
    </div>
  );
}

/** แถบล่าง: ซ้าย = วันที่เลือก ("จ. 12 ต.ค. 2569" / "6–12 ต.ค. 2569") · ขวา = ปุ่มรอง เช่น ล้างวันที่ */
export function CalendarFooter({ label, action }: { label: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
      <span className="text-sm tabular-nums text-foreground" aria-live="polite">
        {label}
      </span>
      {action}
    </div>
  );
}
