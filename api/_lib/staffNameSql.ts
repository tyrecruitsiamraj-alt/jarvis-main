/**
 * ชื่อเจ้าหน้าที่ที่โชว์บนจอ (เจ้าของ 13 พ.ย. 2569 Choice "ชื่อเล่น" แทนอีเมล) — ชื่อเล่น → ชื่อในบัญชี → ส่วนหน้า @ ของค่าที่จดไว้
 * `u` = alias ของตาราง users ที่ left join ไว้แล้ว · `raw` = คอลัมน์ชื่อ/อีเมลที่จดไว้ตอนบันทึก (ทางถอยเมื่อบัญชีถูกลบ)
 * กติกาเดียวกับ `linkOwnerSql` / `jobPublicReleases` ที่มีอยู่แล้ว
 */
export const STAFF_NAME_SQL = (u: string, raw: string): string =>
  `coalesce(nullif(btrim(${u}.nickname), ''), nullif(btrim(${u}.full_name), ''), nullif(split_part(btrim(${raw}), '@', 1), ''))`;
