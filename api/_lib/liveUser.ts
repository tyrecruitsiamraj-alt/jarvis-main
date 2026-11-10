/**
 * ═══ บัญชีตอนนี้ยังใช้ได้ไหม + role ล่าสุด (ตรวจทั้งระบบ 10 พ.ย. 2569) ═══
 * เดิม token เก็บ role ไว้ 8 ชม. ไม่ถามฐาน ⇒ ปิดบัญชี/ลบ/ลด role แล้วยังใช้ API ต่อได้จนหมดอายุ
 * ตอนนี้ทุกคำขอเช็กฐาน (จำไว้ 1 นาที) — ปิด/ลบ = ออกจากระบบ · เปลี่ยน role = ใช้ role ใหม่
 * ฐานอ่านไม่ได้ = ใช้ข้อมูลใน token ต่อ (ฐานล่มเส้นข้อมูลก็ล่มอยู่แล้ว · ไม่ให้หน้าทั้งระบบเด้งออกเพราะเช็กนี้)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logWarn } from './logger.js';
import type { UserRole } from './auth.js';

const USERS = tableInAppSchema('users');
const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;

export type LiveUser = { active: boolean; role: UserRole } | null;
const cache = new Map<string, { at: number; v: LiveUser }>();

/** null = ไม่มีบัญชีนี้แล้ว · 'unknown' = อ่านฐานไม่ได้ */
export async function liveUserOf(sub: string, now = Date.now()): Promise<LiveUser | 'unknown'> {
  const hit = cache.get(sub);
  if (hit && now - hit.at < TTL_MS) return hit.v;
  try {
    const { rows } = await dbQuery<{ is_active: boolean; role: UserRole }>(`select is_active, role from ${USERS} where id::text = $1 limit 1`, [sub]);
    const v: LiveUser = rows[0] ? { active: rows[0].is_active === true, role: rows[0].role } : null;
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(sub, { at: now, v });
    return v;
  } catch (e) {
    logWarn('liveUser: อ่านสถานะบัญชีไม่ได้ — ใช้ข้อมูลใน token ต่อ', { message: e instanceof Error ? e.message : String(e) });
    return 'unknown';
  }
}

/** ล้างที่จำไว้ (แก้ role/ปิดบัญชีจากหน้าผู้ใช้งาน = มีผลทันทีบนเครื่องนี้) */
export function forgetLiveUser(sub?: string): void {
  if (sub) cache.delete(sub);
  else cache.clear();
}
