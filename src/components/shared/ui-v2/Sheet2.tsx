/**
 * ═══ ของกลางของโฉมใหม่ (เฟส 1) — "ผืนเดียว คั่นด้วยเส้นบาง" ═══
 *
 * เจ้าของสั่ง 5 ก.ย. 2569: *"ฉันใช้คำว่ารื้อเลยละกัน"* + *"เดิมอยากไปทางเทค
 * แต่พอทำแล้วมันไม่เทคเลย เลยเปลี่ยน style ดีกว่า"*
 *
 * ภาษาใหม่ = แบบเดียวกับหน้า Login ที่เจ้าของชอบ:
 *   - หนึ่งเรื่อง = **ผืนขาวใบเดียว** ข้างในคั่นด้วยเส้นบาง ไม่ใช่กล่องซ้อนกล่อง
 *   - สีเน้นสีเดียว = เบอร์กันดี (`primary` ของธีม) · สีอื่นเหลือเฉพาะสีที่มีความหมาย
 *   - ตัวเลขเป็นพระเอก: ตัวใหญ่ `tabular-nums` + ป้ายคำอธิบายตัวเบาใต้เลข
 *   - ไม่มีภาษาเทค: ไม่มีกริดจุด ไม่มีเส้นเรือง ไม่มีป้าย mono ช่องไฟกว้างแบบจอเครื่องบิน
 *
 * 🔴 ประกอบจาก Card ของ shadcn + utility ของ Tailwind + token ธีมเท่านั้น
 * ไม่มี CSS ใหม่สักบรรทัด (กฎเจ้าของ 4 ก.ย. 2569)
 */
import * as React from 'react';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** ผืนขาวหนึ่งใบ = หนึ่งเรื่อง */
export const Sheet2: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...rest
}) => (
  <Card className={cn('overflow-hidden rounded-2xl', className)} {...rest}>
    {children}
  </Card>
);

/**
 * หัวผืน — ป้ายเบอร์กันดีซ้าย · เวลา/สรุปขวา · ปุ่มเสริมท้ายสุด
 * (แทนแถบหัวแบบ HUD เดิมที่เป็น "SO RECRUIT · สถานะสด · นาฬิกา mono")
 */
export const SheetHead2: React.FC<{
  /** ป้ายบรรทัดบน — บอกว่าผืนนี้คือเรื่องอะไร */
  eyebrow: React.ReactNode;
  /** ข้อความขวามือ เช่น "อัปเดตล่าสุด 12:04" — ภาษาคน ไม่ใช่ศัพท์เครื่องจักร */
  stamp?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ eyebrow, stamp, action, className }) => (
  <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-6 pt-5 lg:px-8', className)}>
    <span className="text-[12.5px] font-medium text-primary">{eyebrow}</span>
    <span className="flex-1" />
    {stamp ? <span className="text-[12px] text-muted-foreground">{stamp}</span> : null}
    {action}
  </div>
);

/** เส้นคั่นในผืน — ใช้แทนการขึ้นกล่องใหม่ */
export const Rule2: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('border-t border-border/70', className)} aria-hidden />
);

/**
 * แถวตัวเลขมาตรฐาน — **ทรงเดียวที่จะใช้ทั้งระบบ**
 * (ของเดิมมีอย่างน้อย 5 ทรง: StatCard · jarvis-stat-tile · ช่องบน deck ·
 *  ช่องสรุป Lumos · ช่องบน Dashboard ⇒ ยุบเหลือทรงนี้ทีละหน้า)
 */
export const StatRow2: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'grid grid-cols-2 border-t border-border/70 sm:grid-cols-4',
      '[&>*]:border-border/50 max-sm:[&>*:nth-child(even)]:border-l',
      'max-sm:[&>*:nth-child(-n+2)]:border-b sm:[&>*:not(:first-child)]:border-l',
      className,
    )}
  >
    {children}
  </div>
);

/** หนึ่งช่องตัวเลขในแถว — เลขใหญ่ + ป้ายคำอธิบาย */
export const Stat2: React.FC<{
  value: React.ReactNode;
  label: React.ReactNode;
  /** สีของเลข — ส่งมาเฉพาะตอนที่สีนั้น **มีความหมาย** (แดง=หลุดกำหนด ฯลฯ) */
  valueClassName?: string;
  hint?: React.ReactNode;
  className?: string;
}> = ({ value, label, valueClassName, hint, className }) => (
  <div className={cn('px-6 py-4 lg:px-8', className)}>
    <div className={cn('text-[28px] font-semibold leading-tight tabular-nums', valueClassName)}>
      {value}
    </div>
    <div className="mt-0.5 text-[12.5px] font-normal text-muted-foreground">{label}</div>
    {hint ? <div className="mt-0.5 text-[11px] text-muted-foreground/70">{hint}</div> : null}
  </div>
);

export default Sheet2;
