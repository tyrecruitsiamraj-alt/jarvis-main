/**
 * แบ่งหน้ารายการ — สเตต + การหั่นชุด + props ของ `ListPaginationBar` ในที่เดียว
 *
 * ทำไมต้องมี hook: ก่อนหน้านี้ 5 หน้าที่มีแถบเลขหน้าเขียนสเตตเองทุกหน้า
 * (`page` · `pageSize` · `totalPages` · `slice` · เคลียร์หน้าเมื่อเปลี่ยนขนาด)
 * แล้วหน้าที่เหลืออีก 7 หน้าไม่มีเลย เพราะ "ต้องเขียนใหม่ทั้งชุด" ทุกครั้ง
 * เจ้าของสั่ง 22 ส.ค. 2569 ว่า *"ทุกหน้าที่มีข้อมูลเยอะๆ ทำเป็น Pagination
 * เลือกได้ว่าจะโชว์ 10 20 30 40 ฯลฯ โดยทำเป็น Dropdown"* → ทำให้เหลือ 2 บรรทัดต่อหน้า
 *
 * 🔴 กติกาที่ฝังไว้:
 * 1. **หน้าปัจจุบันไม่หลุดขอบ** — รายการหายไป (กรอง/ลบ) แล้วหน้าเดิมเกินจำนวนหน้า
 *    ต้องถอยมาหน้าสุดท้ายเอง ไม่ใช่โชว์หน้าว่าง (บั๊กคลาสสิกของหน้าที่เขียนเอง)
 * 2. **เปลี่ยนจำนวนต่อหน้า = กลับหน้า 1** ไม่งั้นกดจาก 10→50 แล้วอยู่หน้า 9 ซึ่งไม่มีของ
 * 3. **ไม่มีของ = pageFrom เป็น 0** ("แสดง 0–0 จาก 0" ไม่ใช่ "1–0")
 */
import { useMemo, useState } from 'react';

import {
  DEFAULT_PAGE_SIZE,
  getTotalPages,
  type PageSizeOption,
} from '@/lib/pagination';

export type ListPaginationBarProps = {
  page: number;
  pageSize: PageSizeOption;
  totalItems: number;
  totalPages: number;
  pageFrom: number;
  pageTo: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
};

export type UseListPagination<T> = {
  /** รายการของหน้าปัจจุบัน */
  pageItems: T[];
  /** กระจายเข้า `<ListPaginationBar {...bar} />` ได้ตรง ๆ */
  bar: ListPaginationBarProps;
  /** สั่งกลับหน้า 1 เอง — ใช้ตอนเปลี่ยนตัวกรอง/คำค้น */
  resetPage: () => void;
};

/** คำนวณล้วน (ไม่มี state) — แยกออกมาให้เทสต์ได้โดยไม่ต้อง render */
export function computeListPage<T>(
  items: T[],
  page: number,
  pageSize: PageSizeOption,
): { pageItems: T[]; page: number; totalPages: number; pageFrom: number; pageTo: number } {
  const totalPages = getTotalPages(items.length, pageSize);
  // กติกาข้อ 1: หน้าเกินขอบให้ถอยมาหน้าสุดท้าย · ต่ำกว่า 1 ให้เป็น 1
  const current = Math.min(Math.max(page, 1), totalPages);
  const start = (current - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  return {
    pageItems,
    page: current,
    totalPages,
    pageFrom: items.length === 0 ? 0 : start + 1,
    pageTo: start + pageItems.length,
  };
}

export function useListPagination<T>(
  items: T[],
  initialPageSize: PageSizeOption = DEFAULT_PAGE_SIZE,
): UseListPagination<T> {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(initialPageSize);

  const computed = useMemo(() => computeListPage(items, page, pageSize), [items, page, pageSize]);

  return {
    pageItems: computed.pageItems,
    resetPage: () => setPage(1),
    bar: {
      page: computed.page,
      pageSize,
      totalItems: items.length,
      totalPages: computed.totalPages,
      pageFrom: computed.pageFrom,
      pageTo: computed.pageTo,
      onPageChange: setPage,
      onPageSizeChange: (size) => {
        setPageSize(size);
        setPage(1); // กติกาข้อ 2
      },
    },
  };
}
