import React from 'react';
import { cn } from '@/lib/utils';
import {
  DEFAULT_PAGE_SIZE,
  getVisiblePageNumbers,
  PAGE_SIZE_OPTIONS,
  type PageSizeOption,
} from '@/lib/pagination';

type ListPaginationBarProps = {
  page: number;
  pageSize: PageSizeOption;
  totalItems: number;
  totalPages: number;
  pageFrom: number;
  pageTo: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  className?: string;
};

const ListPaginationBar: React.FC<ListPaginationBarProps> = ({
  page,
  pageSize,
  totalItems,
  totalPages,
  pageFrom,
  pageTo,
  onPageChange,
  onPageSizeChange,
  className,
}) => {
  const pageNumbers = getVisiblePageNumbers(page, totalPages);

  return (
    <div className={cn('flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          แสดง {pageFrom}–{pageTo} จาก {totalItems}
        </span>
        <div className="flex items-center gap-2">
          <label htmlFor="list-page-size" className="whitespace-nowrap">
            ต่อหน้า
          </label>
          <select
            id="list-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSizeOption)}
            className="jarvis-soft-field py-1.5 px-2 text-xs min-w-[4.5rem]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 rounded-full border border-border text-xs disabled:opacity-40"
          >
            ก่อนหน้า
          </button>

          {pageNumbers.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={page === item ? 'page' : undefined}
                className={cn(
                  'min-w-[2.25rem] px-2.5 py-1.5 rounded-full text-xs font-medium border',
                  page === item
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-foreground hover:bg-secondary/60',
                )}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 rounded-full border border-border text-xs disabled:opacity-40"
          >
            ถัดไป
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">หน้า 1 / 1</p>
      )}
    </div>
  );
};

export default ListPaginationBar;
export { DEFAULT_PAGE_SIZE };
