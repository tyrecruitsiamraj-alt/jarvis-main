/**
 * ตัวกรอง BU ของหน้าหลัก (Phase 10.4 · เจ้าของเคาะ 24 ส.ค. 2569:
 * *"เห็นเหมือนกันอะแต่แยกตาม BU"* — ทุกคนเห็นชุดเดียวกัน มีปุ่มสลับ ไม่ผูกกับสิทธิ์)
 *
 * 🔴 รายชื่อ BU มาจากข้อมูลจริงที่ API นับมา — ห้าม hard-code
 * (วัดจริง 24 ส.ค. 2569: LBD 170 · LML 81 · LBA 22 · DSL 8 · SNJ 3 ใบขอ)
 * 🔴 ปุ่มบอกจำนวนใบขอของ BU นั้นด้วย — ไม่งั้นคนกดสุ่มแล้วเจอหน้าว่างโดยไม่รู้ว่าทำไม
 *
 * 🔴 **ใช้ ToggleGroup ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่งปรับหน้าหลักให้เป็น
 * มาตรฐานโดยใช้ shadcn คุม) · ของเดิมเป็น `<button>` ที่วาดกรอบ/พื้นเองด้วย
 * `style={{ boxShadow: 'inset 0 0 0 1px ...' }}` และสี hex จาก `HUD_HEX`
 * ⇒ กลุ่มปุ่มเลือกอย่างเดียว = `ToggleGroup type="single"` ตรงตัว
 * ได้พฤติกรรมคีย์บอร์ด (ลูกศรเลื่อนในกลุ่ม) และ `aria-pressed` มาให้เอง
 */
import * as React from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { DASH } from '@/lib/designTokens';
import { buLabel, sortBuOptions } from '@/lib/homeBu';
import { cn } from '@/lib/utils';

export type HomeBuFilterProps = {
  options: ReadonlyArray<{ bu: string; count: number }>;
  value: string | null;
  onChange: (bu: string | null) => void;
  className?: string;
};

/** ค่าที่ ToggleGroup ใช้แทน "ทั้งหมด" — ว่างไม่ได้ ไม่งั้นกดแล้วหลุดเป็น null */
const ALL = '__all__';

export const HomeBuFilter: React.FC<HomeBuFilterProps> = ({
  options,
  value,
  onChange,
  className,
}) => {
  const opts = React.useMemo(() => sortBuOptions(options), [options]);
  // ไม่มีตัวเลือก (ฐานยังไม่มีทะเบียนไซต์) = ซ่อนแถบไปเลย ไม่ขึ้นแถบเปล่า
  if (opts.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className={cn('text-[11px] font-medium', DASH.muted)}>สายธุรกิจ</span>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={value ?? ALL}
        /* กดซ้ำที่ตัวเดิม Radix ส่งค่าว่างมา — ถือว่าไม่เปลี่ยน (กันหลุดเป็นสถานะไม่มีตัวเลือก) */
        onValueChange={(v) => {
          if (!v) return;
          onChange(v === ALL ? null : v);
        }}
        className="flex-wrap justify-start gap-1.5"
      >
        <ToggleGroupItem value={ALL} className="gap-1.5 text-xs">
          ทั้งหมด
        </ToggleGroupItem>
        {opts.map((o) => (
          <ToggleGroupItem key={o.bu} value={o.bu} title={buLabel(o.bu)} className="gap-1.5 text-xs">
            {o.bu}
            {/* จำนวนใบขอของ BU นั้น — ใช้ Badge ของ shadcn แทนชิปที่วาดเอง */}
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] tabular-nums">
              {o.count.toLocaleString('th-TH')}
            </Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
};

export default HomeBuFilter;
