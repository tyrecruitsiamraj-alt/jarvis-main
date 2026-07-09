import React from 'react';
import { cn } from '@/lib/utils';

type Props = {
  value?: boolean | null;
  compact?: boolean;
  className?: string;
};

/** แสดงผลอย่างเดียว — ใช้ในรายการงาน (ไม่แก้ไขได้) */
const UnitRequestReplacementBadge: React.FC<Props> = ({ value, compact, className }) => {
  if (value !== true && value !== false) {
    return <span className={cn('text-xs text-muted-foreground', className)}>—</span>;
  }

  const yes = value === true;
  return (
    <span
      className={cn(
        'inline-flex px-2 py-0.5 rounded-full font-medium whitespace-nowrap',
        compact ? 'text-[10px]' : 'text-xs',
        yes ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground',
        className,
      )}
    >
      {yes ? 'ส่งคนแทน' : 'ไม่ส่งคนแทน'}
    </span>
  );
};

export default UnitRequestReplacementBadge;
