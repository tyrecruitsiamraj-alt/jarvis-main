import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useUiV2 } from '@/lib/uiV2';
import { TONE, type ToneKey } from '@/lib/designTokens';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive' | 'info';
  className?: string;
  onClick?: () => void;
}

const variantStyles = {
  default: 'border-white/70',
  primary: 'border-blue-300/40 bg-blue-50/30',
  success: 'border-emerald-300/40 bg-emerald-50/25',
  warning: 'border-amber-300/40 bg-amber-50/25',
  destructive: 'border-red-300/40 bg-red-50/20',
  info: 'border-sky-300/40 bg-sky-50/25',
};

const iconVariantStyles = {
  default: 'text-muted-foreground bg-white/60',
  primary: 'text-blue-600 bg-blue-500/12',
  success: 'text-emerald-600 bg-emerald-500/12',
  warning: 'text-amber-700 bg-amber-500/12',
  destructive: 'text-red-600 bg-red-500/12',
  info: 'text-sky-600 bg-sky-500/12',
};

/**
 * 🔴 **สีที่มีความหมายบนพื้นขาว** (คืนของหาย-1 จาก `docs/audit-v1-v2-functions-2569-09-07.md`)
 *
 * รอบรื้อ 5 ก.ย. 2569 เปิดสวิตช์แล้ว **ทิ้ง prop `variant` ทั้งตัว** การ์ดจึงขาวเหมือนกันหมด
 * ทั้ง 5 หน้า · ปัญหาไม่ใช่ "เปลี่ยนสี" แต่เป็น **ข้อมูลหาย** เพราะมี 4 จุดที่ `variant`
 * ถูก **คำนวณจากค่าตัวเลขเอง** — สีคือคำตอบ ไม่ใช่ของประดับ:
 *   `EmployeeProfile.tsx` เขียว/เหลือง = Reliability ผ่าน/ไม่ผ่าน · แดง = ปัญหาเกินเกณฑ์
 *                          เขียว/แดง = กำไร/ขาดทุน
 *   `JobDetailPage.tsx`    แดง = มีค่าปรับแล้ว · เขียว = ยังไม่มี
 * ⇒ ผิดกติกา `CLAUDE.md` *"สีที่มีความหมายห้ามแตะ — success/warn/danger/info/violet
 *   เป็นภาษาของตัวเลข"* ตรง ๆ
 *
 * **วิธีคืน = แบบเดียวกับที่ `DashboardHeroStrip` ทำถูกไว้แล้ว** (ชุด `numLight`):
 * ไม่เอาพื้นพาสเทลกลับมา (นั่นคือของที่เจ้าของสั่งรื้อ) แต่ย้ายสีไป **อยู่ที่หมึก** —
 * ตัวเลข + ไอคอน ตามหลัก "หมึกกับกระดาษ" ของ `designTokens.ts`
 * ⚠️ ทุกค่ามาจาก `TONE` ไม่มีสีใหม่ · `default` = ไม่มีความหมาย จึงคงเป็น `text-foreground`
 */
const VARIANT_TONE: Record<NonNullable<StatCardProps['variant']>, ToneKey | null> = {
  default: null,
  primary: 'primary',
  success: 'success',
  warning: 'warn',
  destructive: 'danger',
  info: 'info',
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  className,
  onClick,
}) => {
  /**
   * 🔴 **โฉมใหม่ (5 ก.ย. 2569)** — กล่องตัวเลขเดิมมี **พื้นพาสเทล 6 สี + ไอคอนในกรอบสี**
   * ซึ่งทำให้หน้าเดียวมีสีเยอะโดยที่สีไม่ได้แปลว่าอะไร (ต้นเหตุ "ดูตลก/สะเปะสะปะ")
   * ⇒ เปิดสวิตช์แล้วเหลือ **การ์ดขาว เส้นบาง เลขใหญ่ ป้ายเบา** ทรงเดียวกับหน้า Login
   * ⚠️ ข้อมูลเท่าเดิมทุกชิ้น (หัวข้อ · ตัวเลข · บรรทัดรอง · แนวโน้ม · ไอคอน)
   */
  const v2 = useUiV2();
  /** โทนความหมายของการ์ดใบนี้ — `null` = variant `default` (ไม่มีความหมาย ไม่ต้องมีสี) */
  const tone = VARIANT_TONE[variant];
  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 transition-all duration-300',
        v2 ? 'rounded-2xl border border-border/70 bg-card shadow-sm' : cn('glass-card border', variantStyles[variant]),
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        onClick && !v2 && 'jarvis-interactive-card',
        onClick && v2 && 'hover:border-primary/30',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              'truncate text-xs font-medium text-muted-foreground',
              v2 ? '' : 'uppercase tracking-wide',
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              'mt-1 tracking-tight text-foreground',
              v2 ? 'text-[26px] font-semibold tabular-nums' : 'text-2xl font-bold',
              /* 🔴 สีของ **ตัวเลข** คือที่ที่ความหมายไปอยู่ในโฉมใหม่ (ดู VARIANT_TONE)
                 การ์ดหลายใบไม่มีไอคอน (เช่น "กำไร/ขาดทุน") ⇒ ถ้าไม่ทาที่เลข สัญญาณหายเกลี้ยง */
              v2 && tone ? TONE[tone].value : '',
            )}
          >
            {value}
          </p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && trendValue && (
            <p
              className={cn(
                'text-xs font-medium mt-1',
                trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              'rounded-2xl border p-2.5',
              v2
                ? /* กรอบไอคอนรับสีความหมายด้วย — `soft` = ขอบสีโทน + พื้นเป็นกลาง
                     (ไม่ใช่พื้นพาสเทลของเดิมที่เจ้าของสั่งรื้อ) */
                  tone
                  ? cn(TONE[tone].soft, TONE[tone].value)
                  : 'border-border/70 bg-background/60 text-muted-foreground'
                : cn('border-white/60', iconVariantStyles[variant]),
            )}
          >
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
