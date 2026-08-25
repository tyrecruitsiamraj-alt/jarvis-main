/**
 * ป้ายบอกว่า "รายการติดตามนี้ถูกส่งให้ AI โทรหรือยัง — ถ้าไม่ เพราะอะไร"
 *
 * 🔴 ที่มา (เจ้าของสั่ง 25 ส.ค. 2569): รายการที่สร้างเมื่อ 24 ส.ค. ไม่ถูกส่งให้ AI
 * และ **ไม่มีอะไรบอกใครเลย** — หน้าจอขึ้นว่าสร้างสำเร็จ คนนั่งรอสายที่ไม่มีวันออก
 *
 * กติกา:
 * 1. **สถานะปกติ (ส่งแล้ว/กำลังโทร/โทรจบ) ไม่ต้องมีป้ายนี้** — ป้ายสถานะโทรเดิมบอกอยู่แล้ว
 *    ป้ายนี้โผล่เฉพาะตอน "ไม่ได้ส่ง" เพื่อไม่ให้จอรก (กติกาเดิม: ห้ามป้ายที่ขึ้นทุกแถวทุกวัน)
 * 2. **ของที่ต้องมีคนลงมือ ต้องใช้สีเตือน** ไม่ใช่สีเทากลืนไปกับของปกติ
 * 3. คำอธิบายเต็มอยู่ใน `title` — ป้ายสั้นพอให้แถวไม่แตก
 */
import * as React from 'react';

import { followDispatchLabel } from '@/lib/followDispatchState';
import { TONE } from '@/lib/designTokens';
import type { FollowEntry } from '@/lib/followApi';
import { cn } from '@/lib/utils';

export type FollowDispatchBadgeProps = {
  entry: Pick<FollowEntry, 'call_status'> & { dispatch_state?: string | null };
  className?: string;
};

export const FollowDispatchBadge: React.FC<FollowDispatchBadgeProps> = ({ entry, className }) => {
  const meta = followDispatchLabel({
    state: entry.dispatch_state ?? null,
    callStatus: entry.call_status ?? null,
  });
  // อยู่ในคิว/โทรอยู่/โทรจบ = ป้ายสถานะโทรเดิมบอกครบแล้ว ไม่ต้องซ้ำ
  if (!meta.needsAction) return null;
  return (
    <span
      title={meta.hint}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
        TONE.warn.chip,
        className,
      )}
    >
      {meta.label}
    </span>
  );
};

export default FollowDispatchBadge;
