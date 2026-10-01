/**
 * ═══ เบอร์เดียวเข้าระบบได้ครั้งเดียว (migration 132 · เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ (Choice): *"แจ้งเลยว่าเคยสมัครไปแล้ว ไม่เอาเบอร์ซ้ำเข้าระบบ"* · ขอบเขต *"เบอร์เดิม ไม่ว่างานไหน"*
 * ใช้กับทุกทางเข้า: หน้าสมัคร · ปุ่มเพิ่มผู้สมัคร · นำเข้า Excel · แก้เบอร์
 *
 * 🔴 DB เป็นคนตัดสิน (partial unique index `public_job_applications_phone_once_uidx`) — API แค่อ่าน
 *    unique violation ของ index ตัวนี้แล้วตอบข้อความด้านล่าง · ห้ามเปลี่ยนเป็นเช็คก่อนแล้วค่อย insert
 *    (กดส่งรัว ๆ สองครั้งหลุดเข้าทั้งคู่ — ของจริงเจอ 2 ใบภายใน 10 นาที)
 * ตรรกะล้วน ไม่ import pg — ใช้ได้ทั้ง API และเทสต์
 */
export const PHONE_ONCE_INDEX = 'public_job_applications_phone_once_uidx';

/** ข้อความถึงผู้สมัครบนหน้าสมัครงาน (คนพูด ไม่ใช่ภาษาระบบ · ไม่บอกรายละเอียดใบเดิม) */
export const PHONE_ONCE_PUBLIC_MESSAGE = 'เบอร์นี้เคยสมัครกับเราแล้ว ไม่ต้องสมัครซ้ำ';

/** ข้อความถึงเจ้าหน้าที่ (เพิ่มผู้สมัคร · แก้เบอร์) */
export const PHONE_ONCE_STAFF_MESSAGE = 'เบอร์นี้มีใบสมัครในระบบแล้ว — ค้นจากเบอร์ในแท็บผู้สมัคร';

/** เหตุผลบนแถวที่ข้ามตอนนำเข้า Excel */
export const PHONE_ONCE_IMPORT_REASON = 'เบอร์นี้มีในระบบแล้ว';

/** error จาก pg ใช่การชนกติกาเบอร์เดียวไหม (23505 ของ index ตัวนี้เท่านั้น — unique ตัวอื่นไม่นับ) */
export function isPhoneOnceViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const err = e as { code?: unknown; constraint?: unknown };
  return err.code === '23505' && err.constraint === PHONE_ONCE_INDEX;
}
