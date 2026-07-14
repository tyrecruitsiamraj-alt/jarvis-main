import React from 'react';
import { cn } from '@/lib/utils';

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
  selectClassName?: string;
  disabled?: boolean;
};

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  children,
  className,
  selectClassName,
  disabled = false,
}: FilterSelectProps) {
  return (
    <div className={cn('flex flex-col gap-1 min-w-0 w-full', className)}>
      <label htmlFor={id} className="text-xs text-muted-foreground leading-snug">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'jarvis-filter-select w-full min-w-0',
          disabled && 'opacity-70 cursor-not-allowed',
          selectClassName,
        )}
      >
        {children}
      </select>
    </div>
  );
}

export default FilterSelect;
