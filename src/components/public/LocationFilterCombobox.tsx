import React, { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type LocationFilterComboboxProps = {
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  value: string;
  onChange: (next: string) => void;
  options: string[];
  disabled?: boolean;
};

const LocationFilterCombobox: React.FC<LocationFilterComboboxProps> = ({
  label,
  placeholder,
  searchPlaceholder = 'พิมพ์เพื่อค้นหา...',
  value,
  onChange,
  options,
  disabled,
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-[220px]">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="h-11 w-full justify-between rounded-xl border-border bg-card px-3 font-normal shadow-sm"
          >
            <span className={cn('truncate text-left text-sm', !value && 'text-muted-foreground')}>
              {value || placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,280px)] p-0 sm:w-[280px]" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} className="h-11" />
            <CommandList>
              <CommandEmpty>ไม่พบรายการ</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="ทั้งหมด ไม่กรองตำแหน่ง"
                  onSelect={() => {
                    onChange('');
                    setOpen(false);
                  }}
                >
                  <span className="text-muted-foreground">ทั้งหมด (ไม่กรอง)</span>
                </CommandItem>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    value={opt}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === opt ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">{opt}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default LocationFilterCombobox;
