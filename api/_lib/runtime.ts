/** True when running on Vercel/production-like deploy. */
export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

/**
 * Dev role login (no password) — fail-closed.
 * Allowed only when NOT production AND JARVIS_DEV_ROLE_LOGIN === "true".
 */
export function isDevRoleLoginAllowed(): boolean {
  if (isProductionRuntime()) return false;
  return String(process.env.JARVIS_DEV_ROLE_LOGIN || '').trim().toLowerCase() === 'true';
}

function parseEnvFlag(raw: string | undefined, defaultWhenUnset: boolean): boolean {
  if (raw == null || String(raw).trim() === '') return defaultWhenUnset;
  const v = String(raw).trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return defaultWhenUnset;
}

/** Public self-registration — fail-closed; เปิดได้ด้วย JARVIS_ALLOW_PUBLIC_REGISTER=true เท่านั้น */
export function isPublicRegistrationAllowed(): boolean {
  return parseEnvFlag(process.env.JARVIS_ALLOW_PUBLIC_REGISTER, false);
}

/**
 * โชว์ช่อง "อีเมล + รหัสผ่าน" บนหน้า Login หรือไม่ (เจ้าของสั่ง 22 ส.ค. 2569:
 * *"ฉันต้องการ Lock ให้คนกดผ่านปุ่มเข้าสู่ระบบด้วย Microsoft แทน"*)
 *
 * 🔴 **ซ่อนแค่ UI — เส้น API ยังอยู่ครบ** (`/api/auth/login` · forgot · reset)
 * เพราะเป็นทางหนีไฟเดียวถ้า Azure ล่มหรือมี user ที่ยังไม่มีอีเมล M365
 * เปิดกลับด้วย `JARVIS_PASSWORD_LOGIN_UI=true` (ไม่ต้อง deploy โค้ดใหม่)
 *
 * ⚠️ ตัวนี้เป็นแค่ "ความตั้งใจ" — ตัวตัดสินจริงอยู่ที่หน้า Login ซึ่ง **ต้องโชว์ฟอร์มเสมอ
 * เมื่อ Microsoft login ใช้ไม่ได้** ไม่งั้นจะไม่มีทางเข้าระบบเลย (fail-safe: ห้ามล็อกทุกคนออก)
 */
export function isPasswordLoginUiEnabled(): boolean {
  return parseEnvFlag(process.env.JARVIS_PASSWORD_LOGIN_UI, false);
}
