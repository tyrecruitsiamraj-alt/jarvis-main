export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

export type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSizeOption = 20;

export function getTotalPages(totalItems: number, pageSize: number): number {
  if (totalItems <= 0) return 1;
  return Math.ceil(totalItems / pageSize);
}

/** รายการเลขหน้าที่จะแสดงเป็นปุ่ม (มี ellipsis เมื่อหน้าเยอะ) */
export function getVisiblePageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (currentPage > 3) pages.push('ellipsis');

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);
  for (let p = start; p <= end; p += 1) {
    if (!pages.includes(p)) pages.push(p);
  }

  if (currentPage < totalPages - 2) pages.push('ellipsis');

  if (!pages.includes(totalPages)) pages.push(totalPages);

  return pages;
}
