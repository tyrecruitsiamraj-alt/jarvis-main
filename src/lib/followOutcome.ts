/**
 * ผลปิดงานของรายการติดตาม (migration 095 · เจ้าของสั่ง 17 ส.ค. 2569)
 *
 * *"เมื่อวันนั้น ๆ ไม่มีอะไรแล้วก็กดเสร็จสิ้น แต่ถ้าไม่ไปหรืออะไรให้กดว่า ยกเลิกงาน
 * ไม่ไปเริ่มงาน ลา อะไรต่าง ๆ ได้"*
 *
 * ⚠️ ค่าที่นี่ต้องตรงกับ CHECK constraint `follow_entries_outcome_code_check`
 * (migration 095) เป๊ะ ๆ — เพิ่มค่าใหม่ต้องแก้ทั้งสองที่พร้อมกัน ไม่งั้นหน้าเว็บ
 * ส่งค่าที่ฐานไม่รับแล้วได้ 500 (กับดักเดิมของ source/result_scope — เจอมาสองรอบแล้ว)
 * มีเทสต์ parity คุมไว้ที่ `tests/api/followOutcome.test.ts`
 *
 * ⚠️ **คนละเรื่องกับ "ยกเลิก"** ที่มีอยู่เดิม — ยกเลิก = ไม่ต้องโทรตามแล้ว (ตัดสายทิ้ง
 * ก่อนถึงวัน) · ปิดงาน = โทรตามจนจบแล้ว บันทึกว่าจบแบบไหน สองอย่างนี้เก็บคนละช่อง
 * และนับคนละกอง ห้ามยุบรวม
 */

/** เรียงตามที่เจ้าหน้าที่จะเห็นบนปุ่ม — 'done' อยู่แรกเพราะเป็นเคสปกติ */
export const FOLLOW_OUTCOMES = [
  'done',
  'job_cancelled',
  'no_show_start',
  'leave',
  'other',
] as const;

export type FollowOutcome = (typeof FOLLOW_OUTCOMES)[number];

export const FOLLOW_OUTCOME_LABEL: Record<FollowOutcome, string> = {
  done: 'เสร็จสิ้น',
  job_cancelled: 'ยกเลิกงาน',
  no_show_start: 'ไม่ไปเริ่มงาน',
  leave: 'ลา',
  other: 'อื่น ๆ',
};

/** คำอธิบายใต้ปุ่ม — ให้คนกดถูกช่องตั้งแต่ครั้งแรก ไม่ต้องมาแก้ทีหลัง */
export const FOLLOW_OUTCOME_HINT: Record<FollowOutcome, string> = {
  done: 'ตามจนจบแล้ว ไม่มีอะไรค้าง',
  job_cancelled: 'งานถูกยกเลิก ไม่ต้องตามต่อ',
  no_show_start: 'ถึงวันแล้วไม่ไปเริ่มงาน',
  leave: 'ลา/เลื่อน แต่ยังไม่หลุด',
  other: 'เหตุอื่น — ใส่รายละเอียดในช่องหมายเหตุ',
};

/**
 * ผลที่แปลว่า **คนหลุดจากงาน** — ใช้ทำสถิติต้นเหตุ (ML ขั้น 2)
 * ⚠️ `leave` ไม่นับ: ลาแล้วยังกลับมาได้ · `other` ไม่นับเพราะไม่รู้ว่าเรื่องอะไร
 */
export const FOLLOW_OUTCOME_LOST: readonly FollowOutcome[] = ['job_cancelled', 'no_show_start'];

export function isFollowOutcome(v: unknown): v is FollowOutcome {
  return typeof v === 'string' && (FOLLOW_OUTCOMES as readonly string[]).includes(v);
}

export function isLostOutcome(v: unknown): boolean {
  return isFollowOutcome(v) && (FOLLOW_OUTCOME_LOST as readonly string[]).includes(v);
}

/** ผลที่ต้องบังคับให้ใส่หมายเหตุ — 'อื่น ๆ' ที่ไม่มีคำอธิบาย = เก็บไปก็ตอบอะไรไม่ได้ */
export function requiresNote(v: FollowOutcome): boolean {
  return v === 'other';
}
