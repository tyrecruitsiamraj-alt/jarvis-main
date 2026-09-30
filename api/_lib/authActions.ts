/**
 * การเข้าระบบสำเร็จ **ทุกทาง** — ชื่อเหตุการณ์ใน `audit_logs` (ตัวเดียวของทั้งระบบ)
 *
 * 🔴 ทำไมต้องมีไฟล์นี้ (วัดจริง 30 ก.ย. 2569): บริษัทย้ายไปล็อกอินด้วย Microsoft แล้ว
 * (`auth.azure_ad.success` 955 ครั้ง 51 คน) แต่หน้าทีม Online นับ "เข้าระบบล่าสุด" จาก
 * `auth.login.success` อย่างเดียว ⇒ บัญชีที่ใช้ Microsoft อย่างเดียวขึ้นว่า **"ยังไม่เคยเข้าระบบ"**
 * (22 บัญชี ทั้งที่ของจริงเหลือ 1) · ใครจะนับการเข้าระบบ ต้องอ่านจากชุดนี้เท่านั้น
 *
 * ใครใช้: `authSession.ts` (ตอนออกบัตรผ่าน) · `userActivitySql.ts` (เข้าระบบล่าสุด / Online)
 */
export const AUTH_SESSION_AUDIT_ACTIONS = [
  'auth.login.success',
  'auth.magic_link.success',
  'auth.azure_ad.success',
] as const;

export type AuthSessionAuditAction = (typeof AUTH_SESSION_AUDIT_ACTIONS)[number];
