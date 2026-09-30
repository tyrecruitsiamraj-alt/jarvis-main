/**
 * ═══ ชิ้นส่วนหน้าตาของป๊อปไล่งาน 4 ขั้น (30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ทำแยกให้ชัดเจนกว่านี้หน่อย ตอนนี้ดูแล้วยังงง ๆ · แยกกล่องให้ดูง่ายและชัดเจนกว่านี้ ·
 * ควรมี Checkbox เพื่อให้รู้ว่าจะเอาอันไหน"*
 * - `StepCard` — หนึ่งหัวข้อ = หนึ่งการ์ด (Card ของ shadcn) ทรงเดียวกันทุกขั้น
 * - `ChoiceBox` — ตัวเลือกแบบ "เลือกได้อย่างเดียว" หน้าตาเป็น Checkbox ตามที่เจ้าของขอ
 *   ติ๊กอันใหม่ = อันเดิมหลุดเอง · กดอันที่ติ๊กอยู่ไม่มีผล (ต้องมีหนึ่งทางเสมอ)
 * - `CheckRow` — แถวติ๊กในรายการ (Checkbox ซ้าย · ชื่อขวา · ตัวเลขชิดขวาสุด)
 * 🔴 ประกอบจาก Card/Checkbox ของ shadcn + utility ของ Tailwind ล้วน · สีจากตัวแปรธีม ไม่มี hex/ขนาดสุ่ม
 */
import React from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export function StepCard({
  title,
  aside,
  children,
  className,
}: {
  title?: React.ReactNode;
  /** ของชิดขวาบนหัวการ์ด เช่น จำนวนที่ติ๊ก หรือปุ่มเล็ก */
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('space-y-3 p-4', className)}>
      {title || aside ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? <h3 className="text-sm font-medium text-foreground">{title}</h3> : <span />}
          {aside}
        </div>
      ) : null}
      {children}
    </Card>
  );
}

export function ChoiceBox({
  id,
  checked,
  onSelect,
  disabled = false,
  title,
  meta,
  children,
}: {
  id: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: React.ReactNode;
  /** ของชิดขวาบนบรรทัดหัว เช่น ยอดเงิน */
  meta?: React.ReactNode;
  /** เนื้อใต้หัว — ผู้เรียกเลือกเองว่าจะโชว์ตอนไหน (บางอันโชว์ตลอด บางอันโชว์เฉพาะตอนติ๊ก) */
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        checked ? 'border-primary/40 bg-primary/5' : 'border-border',
        disabled && 'opacity-60',
      )}
    >
      <label htmlFor={id} className={cn('flex items-center gap-3', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
        <Checkbox
          id={id}
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => {
            if (v === true) onSelect();
          }}
        />
        <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{title}</span>
        {meta ? <span className="shrink-0 text-sm tabular-nums text-foreground">{meta}</span> : null}
      </label>
      {children ? <div className="mt-3 space-y-3 pl-7">{children}</div> : null}
    </div>
  );
}

export function CheckRow({
  id,
  checked,
  onCheckedChange,
  disabled = false,
  label,
  meta,
  action,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  label: React.ReactNode;
  meta?: React.ReactNode;
  /** ปุ่มเล็กท้ายแถว — อยู่นอก `<label>` (กดปุ่มแล้วต้องไม่ไปติ๊ก/ปลดติ๊กแถว) */
  action?: React.ReactNode;
  /** ของใต้แถว (เช่น ช่องรายละเอียด) — เยื้องตรงกับชื่อ */
  children?: React.ReactNode;
}) {
  return (
    <div className="py-1.5">
      {/* สูงอย่างน้อยเท่าปุ่มเล็ก — แถวที่มีปุ่ม "+ รายละเอียด" กับแถวที่ไม่มี ต้องเรียงตรงกัน */}
      <div className="flex min-h-7 items-center gap-2">
        <label
          htmlFor={id}
          className={cn('flex min-w-0 flex-1 items-center gap-3', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
        >
          <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={(v) => onCheckedChange(v === true)} />
          <span className="min-w-0 flex-1 text-sm text-foreground">{label}</span>
          {meta !== undefined && meta !== null ? (
            <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{meta}</span>
          ) : null}
        </label>
        {action}
      </div>
      {children ? <div className="mt-2 pl-7">{children}</div> : null}
    </div>
  );
}
