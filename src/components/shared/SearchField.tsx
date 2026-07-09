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
          'pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-muted-foreground',
          compact ? 'left-3 h-3.5 w-3.5' : 'left-4 h-4 w-4',
        )}
        aria-hidden
      />
      <input
        ref={ref}
        type={type}
        className={cn(
          'jarvis-soft-field w-full pr-3 placeholder:text-muted-foreground',
          compact ? 'h-10 min-h-10 py-2 !pl-10 text-sm leading-normal' : '!pl-11 !pr-4',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchField.displayName = 'SearchField';

export default SearchField;
