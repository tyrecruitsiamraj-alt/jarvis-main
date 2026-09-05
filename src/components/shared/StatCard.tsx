import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { useUiV2 } from '@/lib/uiV2';

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
              'rounded-2xl p-2.5',
              v2
                ? 'border border-border/70 bg-background/60 text-muted-foreground'
                : cn('border border-white/60', iconVariantStyles[variant]),
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
