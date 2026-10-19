import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { FilterChip } from '@/components/shared/FilterChips';

/**
 * ═══ ชิปกรองมีตัวเลข แบบ Dropdown (เจ้าของ 19 ต.ค. 2569 "ทำเป็น Dropdown" — แท็บผู้สมัคร 11 ชิปล้น 2 แถว) ═══
 * ข้อมูลชุดเดียวกับ `FilterChips` (ส่ง chips ตัวเดิมได้เลย) · ปุ่มบอกมุมมองที่เลือก + เลข · กางแล้วเห็นครบทุกตัวพร้อมเลข
 * 🔴 เลข 0 ต้องโชว์ · `null` = กำลังโหลด ("…") · 'unknown' = โหลดไม่ได้ ("—")
 */
const countText = (c: FilterChip<string>['count']) =>
  c === null ? '…' : c === 'unknown' ? '—' : c.toLocaleString('th-TH');

export default function FilterChipsDropdown<T extends string>({
  chips,
  value,
  onChange,
  ariaLabel,
}: {
  chips: readonly FilterChip<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const current = chips.find((c) => c.id === value) ?? chips[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" aria-label={ariaLabel} data-testid="filter-chips-dropdown">
          {current?.label}
          <span className="tabular-nums">{current ? countText(current.count) : ''}</span>
          <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-96 w-64 space-y-1 overflow-y-auto p-2" role="group" aria-label={ariaLabel}>
        {chips.map((c) => {
          const active = c.id === value;
          return (
            <Button
              key={c.id}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={active}
              onClick={() => {
                onChange(c.id);
                setOpen(false);
              }}
              className="w-full justify-between gap-3 font-normal"
            >
              <span className="flex items-center gap-2">
                {active ? <Check aria-hidden /> : <span className="w-4" aria-hidden />}
                {c.label}
              </span>
              <span className="tabular-nums text-muted-foreground">{countText(c.count)}</span>
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
