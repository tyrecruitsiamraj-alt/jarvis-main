import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SearchFieldProps = React.ComponentProps<'input'> & {
  wrapperClassName?: string;
};

const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, wrapperClassName, type = 'search', ...props }, ref) => (
    <div className={cn('relative w-full', wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={ref}
        type={type}
        className={cn(
          'jarvis-soft-field w-full !pl-11 pr-4 placeholder:text-muted-foreground',
          className,
        )}
        {...props}
      />
    </div>
  ),
);
SearchField.displayName = 'SearchField';

export default SearchField;
