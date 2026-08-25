/**
 * HudTicker — แถบสถานะบรรทัดเดียวบนแผง HUD
 *
 * ใช้บอก "ระบบกำลังทำอะไรอยู่หลังบ้าน" (worker เดินไหม · คิวค้างเท่าไหร่ · อัปเดตล่าสุดเมื่อไหร่)
 * ⚠️ **ไม่ใช่ตัววิ่ง marquee** — ของวิ่งอ่านไม่ทันแล้วคนเลิกอ่าน
 *    ที่นี่คือชิปเรียงกัน + จุดสีบอกสถานะ นิ่งอยู่กับที่
 */
import * as React from 'react';

import { HUD, HUD_HEX, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type HudTickerItem = {
  key: string;
  label: string;
  /** ค่า/ข้อความสั้นท้ายป้าย */
  value?: React.ReactNode;
  tone?: ToneKey;
  /** จุดกระพริบ — ใช้กับ "กำลังทำงานอยู่จริงตอนนี้" เท่านั้น */
  live?: boolean;
};

export type HudTickerProps = {
  items: HudTickerItem[];
  className?: string;
};

export const HudTicker: React.FC<HudTickerProps> = ({ items, className }) => {
  if (items.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}>
      {items.map((it) => {
        const color = HUD_HEX[it.tone ?? 'neutral'];
        return (
          <span key={it.key} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
                it.live && 'motion-safe:animate-pulse',
              )}
              style={{ background: color }}
              aria-hidden
            />
            {/* normal-case: ป้ายในระบบนี้ปนไทย+อังกฤษ ("AI โทร (Lumos)") — uppercase
                ทำให้เฉพาะคำอังกฤษตะโกนขึ้นมาคำเดียว อ่านเป็นคนละระดับความสำคัญ */}
            <span className={cn(HUD.label, 'normal-case')}>{it.label}</span>
            {it.value !== undefined ? (
              <span className="font-mono text-xs font-semibold tabular-nums" style={{ color }}>
                {it.value}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
};

export default HudTicker;
