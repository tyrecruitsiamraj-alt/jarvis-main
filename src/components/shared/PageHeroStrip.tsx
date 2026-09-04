import React from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';

type Props = {
  /** ป้ายทองบรรทัดบน — บอกว่าหน้านี้คือมุมมองของใคร */
  eyebrow: string;
  /** ไม่ส่ง = hero มีแต่ป้ายทอง + ของใน children (เช่น funnel หน้าแรก ที่ป้ายทองทำหน้าที่หัวข้อ) */
  title?: string;
  /** ต่อท้ายชื่อหน้าด้วยตัวเลขสรุป เช่น "· 334 ตำแหน่ง" */
  meta?: string;
  /** ปุ่มมุมขวา — ต้องเป็นทรงสำหรับพื้นเข้ม (ดู heroButton/heroButtonSolid) */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

/**
 * 🔴 คลาส `heroButton` / `heroButtonSolid` **ถูกถอดออกแล้ว** (4 ก.ย. 2569)
 * ปุ่มบนแถบ hero ใช้ `<Button variant="hero">` / `variant="heroSolid"` ของ shadcn
 * — เพิ่ม variant ที่ `src/components/ui/button.tsx` ที่เดียว ห้ามปั้นคลาสปุ่มที่นี่อีก
 */

/**
 * แถบหัวหน้าสีเข้ม (mockup rev.3) — ใช้กับหน้าที่ "เข้ามาต้องเห็นภาพรวมก่อน"
 * หน้า admin ไม่ใส่ตามกติกา mockup ข้อ 09
 */
const PageHeroStrip: React.FC<Props> = ({ eyebrow, title, meta, actions, children, className }) => (
  <div className={cn(DASH.hero, 'px-4 py-4 md:px-5', className)}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className={DASH.heroLabel}>{eyebrow}</p>
        {title ? (
          <h1 className="mt-1 text-lg font-bold tracking-tight text-white md:text-xl">
            {title}
            {meta ? <span className="ml-2 text-xs font-medium text-slate-400">{meta}</span> : null}
          </h1>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
    {children}
  </div>
);

export default PageHeroStrip;
