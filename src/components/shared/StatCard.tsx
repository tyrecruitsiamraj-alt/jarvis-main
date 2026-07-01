import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

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
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card rounded-[1.25rem] p-4 border transition-all duration-300',
        variantStyles[variant],
        onClick && 'cursor-pointer jarvis-interactive-card hover:-translate-y-0.5',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1 tracking-tight">{value}</p>
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
          <div className={cn('p-2.5 rounded-2xl border border-white/60', iconVariantStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
