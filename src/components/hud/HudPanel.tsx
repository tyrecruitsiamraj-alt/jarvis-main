/**
 * HudPanel — แผงพื้นฐานของภาษา "Jarvis HUD" (เจ้าของสั่ง 22 ส.ค. 2569)
 *
 * ไม่ใช่ primitive ใหม่ — เป็น `div` ที่ห่อ class กลาง `HUD.panel` เอาไว้ที่เดียว
 * (แพตเทิร์นเดียวกับที่หน้า /dashboard ใช้ `DASH.card` กับ div ทั่วหน้าอยู่แล้ว)
 * เหตุที่ต้องมีไฟล์นี้: มุมวงเล็บ 4 มุมต้องเป็น element จริง 4 ตัว ถ้าปล่อยให้แต่ละหน้า
 * เขียนเอง จะลืมบ้างไม่ลืมบ้าง แล้วแผงในหน้าเดียวกันหน้าตาไม่เหมือนกัน
 */
import * as React from 'react';

import { HUD } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/** มุมวงเล็บ — ตำแหน่งกำหนดด้วย data-c ใน index.css */
const CORNERS = ['tl', 'tr', 'bl', 'br'] as const;

export type HudPanelProps = {
  /** ป้ายหัวข้อกลุ่มตัวเล็ก (uppercase) — เว้นไว้ได้ถ้าแผงมีหัวข้ออยู่ในเนื้อแล้ว */
  eyebrow?: string;
  /** หัวข้อแผง */
  title?: React.ReactNode;
  /** คำอธิบายใต้หัวข้อ */
  subtitle?: React.ReactNode;
  /** ของที่วางมุมขวาบน (ปุ่มรีเฟรช/ตัวกรอง) */
  right?: React.ReactNode;
  /**
   * เส้นสแกนวิ่ง — **ใส่ได้ไม่เกิน 1 แผงต่อหน้า**
   * กติกาเดียวกับ `TONE.solid`: ของเรืองแสงเยอะ = ไม่เหลือของที่เด่นจริง
   */
  scan?: boolean;
  className?: string;
  /** class ของกล่องเนื้อหา (ปรับ padding/ระยะได้ที่จุดเรียกใช้) */
  bodyClassName?: string;
  children?: React.ReactNode;
};

export const HudPanel: React.FC<HudPanelProps> = ({
  eyebrow,
  title,
  subtitle,
  right,
  scan = false,
  className,
  bodyClassName,
  children,
}) => {
  const hasHeader = Boolean(eyebrow || title || subtitle || right);
  return (
    <div className={cn(HUD.panel, className)}>
      {CORNERS.map((c) => (
        <span key={c} className="jarvis-hud-corner" data-c={c} aria-hidden />
      ))}
      {scan ? <div className={HUD.scan} aria-hidden /> : null}

      <div className={cn('relative p-4 md:p-5', bodyClassName)}>
        {hasHeader ? (
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {eyebrow ? <div className={HUD.eyebrow}>{eyebrow}</div> : null}
              {title ? (
                <div className="mt-1 text-sm font-semibold text-white md:text-base">{title}</div>
              ) : null}
              {subtitle ? <div className={cn('mt-1', HUD.body)}>{subtitle}</div> : null}
            </div>
            {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
};

export default HudPanel;
