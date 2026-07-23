import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Option = { value: string; label: string };

type FilterMultiSelectProps = {
  id: string;
  label: string;
  options: Option[];
  /** ค่าที่เลือกอยู่ — [] = ทั้งหมด */
  values: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  className?: string;
};

/** dropdown ติ๊กหลายค่าให้หน้าตาเข้าชุด FilterSelect — [] = ทั้งหมด */
export function FilterMultiSelect({
  id,
  label,
  options,
  values,
  onChange,
  allLabel = 'ทั้งหมด',
  className,
}: FilterMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  };

  const summary =
    values.length === 0
      ? allLabel
      : values.length === 1
        ? (options.find((o) => o.value === values[0])?.label ?? values[0])
        : `เลือก ${values.length} สถานะ`;

  return (
    <div ref={rootRef} className={cn('relative flex w-full min-w-0 flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs leading-snug text-muted-foreground">
        {label}
      </label>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'jarvis-filter-select flex w-full min-w-0 items-center justify-between gap-1 text-left',
          values.length > 0 && 'font-medium text-foreground',
        )}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-60 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          className="absolute left-0 top-full z-30 mt-1 max-h-64 w-max min-w-full overflow-y-auto rounded-xl border border-border bg-background p-1 shadow-lg"
        >
          <button
            type="button"
            role="option"
            aria-selected={values.length === 0}
            onClick={() => {
              onChange([]);
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {values.length === 0 ? <Check className="h-3.5 w-3.5 text-primary" /> : null}
            </span>
            {allLabel}
          </button>
          {options.map((o) => {
            const checked = values.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => toggle(o.value)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-secondary"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded border',
                    checked ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  {checked ? <Check className="h-3 w-3" /> : null}
                </span>
                {o.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default FilterMultiSelect;
