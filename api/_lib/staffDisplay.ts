import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';

const USERS = tableInAppSchema('users');

/**
 * อีเมล (ตัวเล็ก) → ชื่อเล่น → ชื่อจริง (กติกาเดียวกับ created_by_display หน้าติดตาม) · อ่านไม่ได้ = ใช้อีเมลเดิม
 * ตัวเดียวของภาพรวมงานสรรหา (ใครหารายชื่อ · ผลงานรายคน) และแท็บการติดต่อปุ่ม "ทุกคน" (เก็บโดย …)
 */
export async function loadStaffDisplay(): Promise<(email: string) => string | null> {
  try {
    const { rows } = await dbQuery<{ email: string; name: string | null }>(
      `select lower(btrim(email)) as email, coalesce(nullif(btrim(nickname), ''), nullif(btrim(full_name), '')) as name
         from ${USERS} where email is not null`,
    );
    const map = new Map(rows.map((r) => [r.email, r.name]));
    return (email) => map.get(email) ?? null;
  } catch (e) {
    logError('staff display: users', e);
    return () => null;
  }
}
