import * as React from 'react';
import type { LucideIcon } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

/**
 * **การ์ดหัวข้อ + ไอคอนสีประจำเรื่อง** — ภาษาการ์ดกลางของทั้งระบบ
 *
 * เจ้าของส่งสเปกหน้า "Premium Features" มาถาม 4 ก.ย. 2569 ว่าเอามาปรับใช้ได้ไหม
 * แล้วเลือก **"เอาเฉพาะภาษาการ์ด"** ⇒ หยิบมา 4 อย่าง:
 *   1. การ์ดกระจก (glass) — ได้จาก `Card` ของ shadcn อยู่แล้ว
 *   2. กล่องไอคอน 56px มุมมน + สีประจำเรื่อง (ขอบ/พื้นจาง/ตัวไอคอน)
 *   3. ไหลเข้าทีละใบตอนโหลด + ขยับตอนชี้
 *   4. ไอคอนโตขึ้นเล็กน้อยตอนชี้การ์ด
 *
 * 🔴 **ของที่ **ไม่** เอามาจากสเปกนั้น** (ชนกฎที่เจ้าของสั่งไว้เอง):
 *   · ฟอนต์ Inter → ระบบใช้ **Kanit** ตัวเดียว (Inter ไม่มีตัวไทย)
 *   · `<style>` custom CSS → **ห้ามเขียน CSS เอง** ⇒ ใช้ utility + `tailwindcss-animate`
 *   · สี hex ดิบ (`#0B0A1A` ฯลฯ) → ใช้ `TONE`/ตัวแปรธีมเท่านั้น
 *   · มุม `rounded-[2.5rem]` / ระยะสุ่ม → ใช้สเกลของ Tailwind (มีเทสต์คุม)
 *   · ธีมดำล้วน + ฉาก 3D → หน้าทำงานมีตัวเลขเยอะ พื้นดำ+เงาเรืองทุกกล่องอ่านนาน ๆ แล้วล้า
 */
export type FeatureCardProps = {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** สีประจำเรื่อง — มาจาก TONE เท่านั้น (ห้ามส่งสีดิบเข้ามา) */
  tone?: ToneKey;
  /** ลำดับใบ (0-based) — ใช้หน่วงแอนิเมชันไหลเข้าให้ทีละใบ */
  index?: number;
  /** กดได้ = มีปุ่มครอบทั้งใบ · ไม่ส่ง = การ์ดอ่านอย่างเดียว */
  onClick?: () => void;
  /** มุมขวาของการ์ด — ตัวเลข/ป้าย/ปุ่มเสริม */
  action?: React.ReactNode;
  className?: string;
};

/** หน่วงไหลเข้าทีละใบ — utility ของ tailwindcss-animate ไม่ต้องเขียน CSS */
const DELAY = ['delay-0', 'delay-75', 'delay-150', 'delay-200', 'delay-300', 'delay-500'] as const;

export const FeatureCard: React.FC<FeatureCardProps> = ({
  icon: Icon,
  title,
  description,
  tone = 'info',
  index = 0,
  onClick,
  action,
  className,
}) => {
  const t = TONE[tone];
  const body = (
    <Card
      className={cn(
        'group h-full transition-all duration-300 ease-out',
        // ไหลเข้าจากขวาทีละใบ (animate-in ของ tailwindcss-animate)
        'animate-in fade-in slide-in-from-right-4',
        DELAY[Math.min(index, DELAY.length - 1)],
        onClick && 'hover:-translate-x-1 hover:shadow-md',
        className,
      )}
    >
      <CardContent className="flex items-start gap-4 p-4 md:p-5">
        {/* กล่องไอคอน — ขอบ/พื้นจาง/สีไอคอน มาจากโทนเดียวกันทั้งชุด */}
        <span
          className={cn(
            'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border',
            t.soft,
          )}
          aria-hidden
        >
          <Icon
            className={cn('h-6 w-6 transition-transform duration-300 group-hover:scale-110', t.value)}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">{title}</span>
          {description ? (
            <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        {action ? <span className="shrink-0">{action}</span> : null}
      </CardContent>
    </Card>
  );

  if (!onClick) return body;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  );
};

export default FeatureCard;
