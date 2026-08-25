/**
 * ค่า config ของหน้า Login (`GET /api/auth/config`) + กฎ "โชว์ของที่เกี่ยวกับรหัสผ่านไหม"
 *
 * ทำไมต้องมีไฟล์นี้: เจ้าของสั่ง 22 ส.ค. 2569 ให้ **ล็อกให้เข้าระบบทางปุ่ม Microsoft**
 * แต่ของที่ต้องซ่อนอยู่ 3 ที่ (ฟอร์มบนหน้า Login · ปุ่มเปลี่ยนรหัสผ่านบนแถบบน ·
 * เมนูเปลี่ยนรหัสผ่านในลิ้นชัก) — ถ้าปล่อยให้แต่ละที่เขียนเงื่อนไขเอง วันหนึ่งจะซ่อนไม่ครบ
 * หรือซ่อนเกิน (เคสเดิมของโปรเจกต์: "ข้อความมาจากที่หนึ่ง สีมาจากอีกที่" แล้วขัดกันเงียบ ๆ)
 */

/** รูปร่างที่ `/api/auth/config` คืนมา (เอาเฉพาะที่หน้าเว็บใช้) */
export type AuthConfig = {
  companyEmailLogin: boolean;
  passwordLogin: boolean;
  /** เจตนาของ env: โชว์ UI รหัสผ่านไหม — ฝั่ง server ตั้งต้น false */
  passwordLoginUi?: boolean;
  microsoftLogin: boolean;
  devRoleLogin?: boolean;
  publicRegister?: boolean;
  emailLoginGate?: boolean;
  companyEmailRequired?: boolean;
  allowedDomains?: string[];
  companyEmailHint?: string | null;
};

/**
 * โชว์ของที่เกี่ยวกับ "อีเมล + รหัสผ่าน" บนหน้าจอไหม
 *
 * เงื่อนไข (เรียงตามที่ตัดสิน):
 * 1. หลังบ้านต้องรองรับรหัสผ่านก่อน (`passwordLogin` = มี JWT secret) ไม่งั้นโชว์ไปก็ใช้ไม่ได้
 * 2. 🔴 **ถ้า Microsoft login ใช้ไม่ได้ → โชว์เสมอ** — fail-safe ห้ามล็อกทุกคนออกจากระบบ
 *    (เครื่อง dev ที่ยังไม่ตั้ง Azure จะไม่มีทางเข้าเลยถ้าไม่มีข้อนี้)
 * 3. นอกนั้นตาม env `JARVIS_PASSWORD_LOGIN_UI` (ตั้งต้น = ซ่อน ตามที่เจ้าของสั่ง)
 *
 * `config` เป็น null (ยังโหลดไม่เสร็จ/โหลดไม่ได้) → **ซ่อน** เพื่อไม่ให้ของที่สั่งซ่อนไว้
 * กะพริบโผล่มาตอนเน็ตช้า
 */
export function shouldShowPasswordUi(config: AuthConfig | null | undefined): boolean {
  if (!config) return false;
  const backendReady = config.passwordLogin || config.companyEmailLogin;
  if (!backendReady) return false;
  if (!config.microsoftLogin) return true;
  return config.passwordLoginUi === true;
}
