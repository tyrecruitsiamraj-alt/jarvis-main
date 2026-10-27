/**
 * BU ของผู้ใช้ในหน้า ตั้งค่า › ผู้ใช้งาน (Dropdown ติ๊กหลาย BU · 27 ต.ค. 2569) — กติกาล้วน มีเทสต์
 * BU หลัก (`department_code`) = ตัวเดิมถ้ายังติ๊กอยู่ ไม่งั้นตัวแรกที่ติ๊ก · ไม่ติ๊กเลย = ยังไม่ตั้ง
 */
import { APP_DEPARTMENT_CODES } from '@/lib/departmentCodes';

export type UserBuValue = { department_code: string | null; extra_department_codes: string[] };

/** BU ทั้งหมดที่ติ๊ก (BU หลักอยู่หน้า) */
export function userBuCodes(primary: string | null | undefined, extras: readonly string[] | null | undefined): string[] {
  const out = primary ? [primary] : [];
  for (const c of extras ?? []) if (!out.includes(c) && (APP_DEPARTMENT_CODES as readonly string[]).includes(c)) out.push(c);
  return out;
}

/** ติ๊กชุดใหม่ → BU หลัก + BU เพิ่ม (คง BU หลักเดิมไว้ถ้ายังติ๊ก) */
export function userBuValueOf(picked: readonly string[], currentPrimary: string | null | undefined): UserBuValue {
  const ordered = APP_DEPARTMENT_CODES.filter((c) => picked.includes(c));
  if (ordered.length === 0) return { department_code: null, extra_department_codes: [] };
  const primary = currentPrimary && ordered.includes(currentPrimary as (typeof ordered)[number]) ? currentPrimary : ordered[0];
  return { department_code: primary, extra_department_codes: ordered.filter((c) => c !== primary) };
}

export function userBuLabel(codes: readonly string[]): string {
  if (codes.length === 0) return 'ยังไม่ตั้ง';
  if (codes.length === APP_DEPARTMENT_CODES.length) return 'ทุก BU';
  return codes.join(' · ');
}

