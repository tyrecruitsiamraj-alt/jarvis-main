import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchFieldProps = React.ComponentProps<'input'> & {
  wrapperClassName?: string;
  compact?: boolean;
};

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, wrapperClassName, compact = false, type = 'search', ...props }, ref) => (
    <div className={cn('relative w-full', wrapperClassName)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-slate-400',
          compact ? 'left-3 h-3.5 w-3.5' : 'left-4 h-4 w-4',
        )}
        aria-hidden
      />
      <input
        ref={ref}
        type={type}
        className={cn(
          // ทรงเดียวกับช่องค้นหาบน Dashboard — เจ้าของเลือกให้เป็นมาตรฐานของทุกหน้าที่มีการค้นหา
          'w-full rounded-full border-0 bg-slate-100 text-sm text-slate-900 shadow-inner',
          'placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200',
          'dark:bg-slate-800 dark:text-slate-100 dark:focus:bg-slate-800',
          compact ? 'h-10 min-h-10 py-2 pl-10 pr-3 leading-normal' : 'py-2.5 pl-11 pr-4',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchField.displayName = 'SearchField';

export default SearchField;
