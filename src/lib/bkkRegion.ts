/**
 * ═══ กรุงเทพ+ปริมณฑล / ต่างจังหวัด — การ์ดงานค้างตอนนี้ (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"แยกกรุงเทพ ต่างจังหวัดให้หน่อย ถ้าจากตัวเลขนี้ต้องรู้ได้ว่า กรุงเทพเท่าไหร่ ต่างจังหวัดเท่าไหร่"*
 * Choice: ดูจังหวัดของงาน (ใบขอ · `boardProvinceOf` ตัวเดียวกับการ์ดงานตามจังหวัด) · กรุงเทพนับรวมปริมณฑล
 * ใบที่ไม่ผูกงาน/อ่านจังหวัดไม่ออก = ไม่ระบุ ⇒ กรุงเทพ + ต่างจังหวัด + ไม่ระบุ = ทั้งหมดเสมอ
 */
import { canonProvinceName } from '@/lib/thaiProvinces';

export type Region = 'bkk' | 'upcountry' | 'unknown';
export type RegionCount = Record<Region, number>;

/** กรุงเทพ + ปริมณฑล 5 จังหวัด */
export const BKK_METRO: readonly string[] = ['กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'นครปฐม'];

export const emptyRegionCount = (): RegionCount => ({ bkk: 0, upcountry: 0, unknown: 0 });

export function regionOfProvince(raw: string | null | undefined): Region {
  const c = raw ? canonProvinceName(raw) : null;
  if (!c) return 'unknown';
  return BKK_METRO.includes(c) ? 'bkk' : 'upcountry';
}
