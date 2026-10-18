/**
 * อัตราเบิก (เงินที่บริษัทเก็บจากลูกค้า) — เห็นเฉพาะ supervisor ขึ้นไป (เจ้าของ 17 ต.ค. 2569 · QA r2 "ซ่อนอัตราเบิกจาก staff")
 *
 * ตัดที่เซิร์ฟเวอร์ ไม่ใช่แค่ซ่อนบนจอ — staff เปิด DevTools ก็ไม่เห็น
 * ⚠️ รายการใบขอมาจากสำเนาที่ใช้ร่วมกันทุกคน (`unitRequestCache`) ⇒ **ห้ามแก้ object เดิม** คืนตัวใหม่เสมอ
 */
import { meetsMinimumRole } from './rbac.js';
import type { UserRole } from './auth.js';

export function canSeeDrawRate(role: UserRole | null | undefined): boolean {
  return Boolean(role) && meetsMinimumRole(role as UserRole, 'supervisor');
}

/** ใบขอ: ล้าง `resigned_wage_draw_rate` (อัตราตามเงื่อนไขฝั่งเบิกของคนเก่า) */
export function hideDrawRateOnRequests<T>(rows: readonly T[]): T[] {
  return rows.map((r) =>
    r && typeof r === 'object' && 'resigned_wage_draw_rate' in (r as object)
      ? ({ ...(r as object), resigned_wage_draw_rate: null } as T)
      : r,
  );
}

/** บรรทัดอัตราของใบขอ: ล้าง `draw_rate` */
export function hideDrawRateOnLines<T extends { draw_rate: number | null }>(lines: readonly T[]): T[] {
  return lines.map((l) => ({ ...l, draw_rate: null }));
}
