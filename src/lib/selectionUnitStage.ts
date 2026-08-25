/**
 * "ขั้นไหนต้องรู้ว่าหน่วยงานไหนกำลังพิจารณา" (Phase 6.6)
 *
 * เจ้าของสั่ง: *ขั้น "รอหน่วยงานพิจารณา / รอสัมภาษณ์" มี dropdown เลือกหน่วยงาน*
 * (เลือกจากรายการเท่านั้น — ห้ามพิมพ์เอง เพราะชื่อหน่วยงานพิมพ์ต่างกันแล้วจับคู่ไม่ติด)
 *
 * 🔴 อยู่ไฟล์แยกเพราะเป็น **กติกาธุรกิจ** ไม่ใช่เรื่องหน้าตา — ทั้งฝั่งจอและฝั่ง API
 * (ถ้าวันหนึ่งจะบังคับว่าขั้นพวกนี้ต้องมีหน่วยงานก่อนจึงบันทึกได้) ต้องอ่านกฎเดียวกัน
 * ⚠️ ขั้นอื่น (รอเริ่มงาน/เรียนงาน/รอแจ้งเข้า) **ไม่ต้องเลือก** — คนถูกส่งไปหน่วยงานแล้ว
 * ช่องนี้จึงไม่ต้องรกจอ (ค่าที่เลือกไว้ยังอยู่ในฐาน ไม่ได้ถูกล้าง)
 */
import type { SelectionStatus } from '@/lib/selectionProgress';

/** ขั้นที่คำถาม "หน่วยงานไหน" ยังเปิดอยู่ */
export const UNIT_PICK_STAGES: readonly SelectionStatus[] = [
  'boss_review',
  'await_interview_date',
  'await_interview_result',
];

export function needsUnitPick(status: SelectionStatus | null | undefined): boolean {
  return !!status && (UNIT_PICK_STAGES as readonly string[]).includes(status);
}
