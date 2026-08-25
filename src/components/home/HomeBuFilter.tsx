/**
 * ตัวกรอง BU ของหน้าหลัก (Phase 10.4 · เจ้าของเคาะ 24 ส.ค. 2569:
 * *"เห็นเหมือนกันอะแต่แยกตาม BU"* — ทุกคนเห็นชุดเดียวกัน มีปุ่มสลับ ไม่ผูกกับสิทธิ์)
 *
 * 🔴 รายชื่อ BU มาจากข้อมูลจริงที่ API นับมา — ห้าม hard-code
 * (วัดจริง 24 ส.ค. 2569: LBD 170 · LML 81 · LBA 22 · DSL 8 · SNJ 3 ใบขอ)
 * 🔴 ปุ่มบอกจำนวนใบขอของ BU นั้นด้วย — ไม่งั้นคนกดสุ่มแล้วเจอหน้าว่างโดยไม่รู้ว่าทำไม
 */
import * as React from 'react';

import { HUD, HUD_HEX } from '@/lib/designTokens';
import { buLabel, sortBuOptions } from '@/lib/homeBu';
import { cn } from '@/lib/utils';

export type HomeBuFilterProps = {
  options: ReadonlyArray<{ bu: string; count: number }>;
  value: string | null;
  onChange: (bu: string | null) => void;
  className?: string;
};

export const HomeBuFilter: React.FC<HomeBuFilterProps> = ({
  options,
  value,
  onChange,
  className,
}) => {
  const opts = React.useMemo(() => sortBuOptions(options), [options]);
  // ไม่มีตัวเลือก (ฐานยังไม่มีทะเบียนไซต์) = ซ่อนแถบไปเลย ไม่ขึ้นแถบเปล่า
  if (opts.length === 0) return null;

  const chip = (active: boolean) =>
    cn(
      'inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
      active ? 'text-white' : cn(HUD.body, 'hover:text-white'),
    );

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className={cn(HUD.eyebrow, 'mr-1')}>สายธุรกิจ</span>
      <button
        type="button"
        onClick={() => onChange(null)}
        className={chip(value === null)}
        style={
          value === null
            ? { background: `${HUD_HEX.teal}2e`, boxShadow: `inset 0 0 0 1px ${HUD_HEX.teal}` }
            : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }
        }
        aria-pressed={value === null}
      >
        ทั้งหมด
      </button>
      {opts.map((o) => {
        const active = value === o.bu;
        return (
          <button
            key={o.bu}
            type="button"
            onClick={() => onChange(o.bu)}
            className={chip(active)}
            style={
              active
                ? { background: `${HUD_HEX.teal}2e`, boxShadow: `inset 0 0 0 1px ${HUD_HEX.teal}` }
                : { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }
            }
            aria-pressed={active}
            title={buLabel(o.bu)}
          >
            {o.bu}
            <span className={cn(HUD.unit, 'font-mono tabular-nums')}>{o.count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default HomeBuFilter;
