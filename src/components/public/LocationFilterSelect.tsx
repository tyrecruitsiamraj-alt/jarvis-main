import React, { useEffect, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const ALL_VALUE = '__all__';

export type LocationFilterSelectProps = {
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  options: readonly string[];
  disabled?: boolean;
};

const LocationFilterSelect: React.FC<LocationFilterSelectProps> = ({
  label,
  placeholder,
  value,
  onChange,
  options,
  disabled,
}) => {
  const selectValue = useMemo(() => {
    if (!value) return ALL_VALUE;
    return options.includes(value) ? value : ALL_VALUE;
  }, [value, options]);

  useEffect(() => {
    if (value && !options.includes(value)) onChange('');
  }, [value, options, onChange]);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[220px]">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Select
        value={selectValue}
        onValueChange={(v) => onChange(v === ALL_VALUE ? '' : v)}
        disabled={disabled}
      >
        <SelectTrigger
          className={cn(
            'h-11 w-full rounded-xl border-border bg-card shadow-sm',
            !value && 'text-muted-foreground',
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" className="z-[200] max-h-72">
          <SelectItem value={ALL_VALUE}>ทั้งหมด (ไม่กรอง)</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LocationFilterSelect;
