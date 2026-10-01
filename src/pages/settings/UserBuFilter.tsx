/**
 * ═══ ปุ่มเลือก BU เหนือตาราง ตั้งค่า › ผู้ใช้งาน (เจ้าของสั่ง 1 ต.ค. 2569 · Choice "ปุ่มเลือก BU") ═══
 * ทรงเดียวกับปุ่ม Online/Offline ข้างล่าง (`PresenceFilterChips`) · ตรรกะอยู่ `src/lib/userBuFilter.ts`
 */
import { Button } from '@/components/ui/button';
import type { UserBuChip, UserBuFilter } from '@/lib/userBuFilter';

const NUM = new Intl.NumberFormat('th-TH');

export function UserBuFilterChips({
  chips,
  value,
  onChange,
}: {
  chips: readonly UserBuChip[];
  value: UserBuFilter;
  onChange: (next: UserBuFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="กรองตาม BU">
      {chips.map((c) => (
        <Button
          key={c.key || 'none'}
          type="button"
          size="xs"
          variant={value === c.key ? 'default' : 'outline'}
          aria-pressed={value === c.key}
          onClick={() => onChange(c.key)}
        >
          {c.label} {NUM.format(c.count)}
        </Button>
      ))}
    </div>
  );
}
