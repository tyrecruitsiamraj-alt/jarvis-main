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
  // 🔴 7 ช่องเสมอ (เจ้าของ 11 พ.ย. 2569 "กดแล้วเลื่อน เม้าต้องขยับตาม") — เดิมจำนวนช่องเปลี่ยนตามหน้าที่อยู่
  // แถบชิดขวาเลยเลื่อนทั้งแถบตอนกดเลขหน้า ⇒ ต้น 1–5 · ท้าย N-4–N · กลาง 1 … c-1 c c+1 … N
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}
