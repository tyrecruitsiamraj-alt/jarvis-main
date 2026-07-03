import React from 'react';
import { cn } from '@/lib/utils';

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
};

export function FilterSelect({ id, label, value, onChange, children, className }: FilterSelectProps) {
  return (
    <div className={cn('flex flex-col gap-1 min-w-0', className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground leading-snug">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="jarvis-filter-select">
        {children}
      </select>
    </div>
  );
}

export default FilterSelect;
