/**
 * ═══ สนใจแล้ว รอเจ้าหน้าที่โทร — นิยามเดียวทั้งระบบ (เจ้าของ 18 พ.ย. 2569 "เอานิยามเดียว") ═══
 * ตอบ AI ว่าสนใจ แล้วยังไม่มีเจ้าหน้าที่ลงมือ (ลงผลโทร / บันทึกติดต่อ) หลังเวลาที่ AI ได้คำตอบ
 * ใช้ทั้งการ์ด "ต้องทำ" (ฝั่ง API `isWaitingStaffRow`) · ผู้สมัครและผลการติดต่อ · รายชื่อเข้ามาไปถึงไหน · รายชื่ออยู่กับใคร
 * เดิมหน้าเดียวมี 3 เลข (197 · 139 · 133) เพราะนับคนละแบบ — ห้ามเขียนเงื่อนไขนี้ซ้ำที่อื่น
 * ไม่ import ผ่าน `@/` — ฝั่ง API เรียกไฟล์นี้ตรง
 */
export type WaitingForStaffInput = { aiAnswer: string | null; aiAnswerAt: string | null; staffLastAt: string | null };

export function isWaitingForStaff(f: WaitingForStaffInput): boolean {
  if (f.aiAnswer !== 'said_yes') return false;
  return !(f.staffLastAt && f.aiAnswerAt && f.staffLastAt >= f.aiAnswerAt);
}
