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
  default: 'border-border',
  primary: 'border-primary/30 bg-primary/5',
  success: 'border-success/30 bg-success/5',
  warning: 'border-warning/30 bg-warning/5',
  destructive: 'border-destructive/30 bg-destructive/5',
  info: 'border-info/30 bg-info/5',
};

const iconVariantStyles = {
  default: 'text-muted-foreground bg-secondary',
  primary: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  destructive: 'text-destructive bg-destructive/10',
  info: 'text-info bg-info/10',
};

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon: Icon, trend, trendValue, variant = 'default', className, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-card rounded-xl p-4 border transition-all',
        variantStyles[variant],
        onClick && 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && trendValue && (
            <p className={cn('text-xs font-medium mt-1', trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground')}>
              {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('p-2 rounded-lg', iconVariantStyles[variant])}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
    </div>
  );
};

export default StatCard;
