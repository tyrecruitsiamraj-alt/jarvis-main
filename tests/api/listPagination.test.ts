// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { computeListPage } from '@/hooks/useListPagination';
import { PAGE_SIZE_OPTIONS } from '@/lib/pagination';

/**
 * การแบ่งหน้ากลาง (เจ้าของสั่ง 22 ส.ค. 2569: ทุกหน้าที่ข้อมูลเยอะต้องมี dropdown ต่อหน้า)
 *
 * ล็อกบั๊กคลาสสิกของหน้าที่เคยเขียนสเตตเอง:
 * · อยู่หน้า 9 แล้วรายการหายเหลือ 3 แถว → ต้องถอยมาหน้าสุดท้าย ไม่ใช่โชว์หน้าว่าง
 * · ไม่มีของเลย → "แสดง 0–0 จาก 0" ไม่ใช่ "1–0"
 */

const items = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('computeListPage', () => {
  it('หน้าแรกได้ของครบตามขนาดหน้า + บอกช่วงถูก', () => {
    const r = computeListPage(items(45), 1, 20);
    expect(r.pageItems).toHaveLength(20);
    expect(r.pageItems[0]).toBe(1);
    expect(r.totalPages).toBe(3);
    expect(r.pageFrom).toBe(1);
    expect(r.pageTo).toBe(20);
  });

  it('หน้าสุดท้ายได้เศษที่เหลือ', () => {
    const r = computeListPage(items(45), 3, 20);
    expect(r.pageItems).toEqual([41, 42, 43, 44, 45]);
    expect(r.pageFrom).toBe(41);
    expect(r.pageTo).toBe(45);
  });

  it('🔴 หน้าเกินขอบ (รายการหายไปหลังกรอง) ต้องถอยมาหน้าสุดท้าย ไม่ใช่หน้าว่าง', () => {
    const r = computeListPage(items(3), 9, 20);
    expect(r.page).toBe(1);
    expect(r.pageItems).toEqual([1, 2, 3]);
    expect(r.pageTo).toBe(3);

    const r2 = computeListPage(items(45), 99, 20);
    expect(r2.page).toBe(3);
    expect(r2.pageItems).toHaveLength(5);
  });

  it('หน้าต่ำกว่า 1 ถูกดันขึ้นเป็น 1', () => {
    const r = computeListPage(items(10), 0, 10);
    expect(r.page).toBe(1);
    expect(r.pageItems).toHaveLength(10);
  });

  it('ไม่มีของ → 0–0 จาก 0 (ไม่ใช่ 1–0) และยังมี 1 หน้า', () => {
    const r = computeListPage([], 1, 20);
    expect(r.pageItems).toEqual([]);
    expect(r.pageFrom).toBe(0);
    expect(r.pageTo).toBe(0);
    expect(r.totalPages).toBe(1);
  });

  it('ทุกขนาดหน้าที่ dropdown ให้เลือก หั่นชุดได้ครบไม่ตกหล่นและไม่ซ้ำ', () => {
    const all = items(137);
    for (const size of PAGE_SIZE_OPTIONS) {
      const seen: number[] = [];
      const { totalPages } = computeListPage(all, 1, size);
      for (let p = 1; p <= totalPages; p++) seen.push(...computeListPage(all, p, size).pageItems);
      expect(seen, `pageSize ${size}`).toEqual(all);
    }
  });
});
