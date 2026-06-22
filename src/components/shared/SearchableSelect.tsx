import React, { useMemo, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** คำค้นเพิ่มเติม (เบอร์โทร รหัส ฯลฯ) */
  keywords?: string;
};

export type SearchableSelectGroup = {
  heading?: string;
  options: SearchableSelectOption[];
};

export type SearchableSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options?: SearchableSelectOption[];
  groups?: SearchableSelectGroup[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options = [],
  groups,
  placeholder = 'เลือกรายการ',
  searchPlaceholder = 'ค้นหา...',
  emptyText = 'ไม่พบรายการ',
  disabled = false,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const flatOptions = useMemo(() => {
    if (groups?.length) return groups.flatMap((g) => g.options);
    return options;
  }, [groups, options]);

  const selected = flatOptions.find((o) => o.value === value);

  const renderItems = (items: SearchableSelectOption[]) =>
    items.map((opt) => (
      <CommandItem
        key={opt.value}
        value={[opt.label, opt.keywords, opt.value].filter(Boolean).join(' ')}
        onSelect={() => {
          onChange(opt.value);
          setOpen(false);
        }}
      >
        <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt.value ? 'opacity-100' : 'opacity-0')} />
        <span className="truncate">{opt.label}</span>
      </CommandItem>
    ));

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'jarvis-soft-field w-full min-h-10 flex items-center justify-between gap-2 text-left text-sm',
            !selected && 'text-muted-foreground',
            disabled && 'opacity-50 cursor-not-allowed',
            className,
          )}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[200] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups?.length ? (
              groups.map((group, i) => (
                <CommandGroup key={group.heading ?? `group-${i}`} heading={group.heading}>
                  {renderItems(group.options)}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>{renderItems(options)}</CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
