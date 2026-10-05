/**
 * ═══ อายุเกิน — AI ไม่โทร · ชื่อไปกล่อง "อายุเกิน" (เจ้าของ 5 ต.ค. 2569) ═══
 *
 * Journey งานสรรหา: *"อายุประมาณ 58-60 แล้วกัน Ai ไม่ต้องโทรแต่ย้ายชื่อไปกล่องอายุเกิน"* → Choice "58 ปีขึ้นไป"
 * · กล่องอยู่แท็บผู้สมัคร คู่กับสนใจ/ไม่สนใจ
 *
 * 🔴 ตัวตัดสินที่เดียว — ฝั่ง server (`enqueueLumosInterviewForApplications` คอขวดส่ง AI ของใบสมัครทุกเส้น)
 *    กับกล่องบนจอใช้ค่าเดียวกัน · ไม่รู้อายุ = ไม่ถือว่าเกิน (ส่ง AI ได้ตามเดิม)
 */
export const OVER_AGE_MIN = 58;

export function isOverAge(age: number | string | null | undefined): boolean {
  const n = typeof age === 'string' ? Number(age.trim()) : age;
  return typeof n === 'number' && Number.isFinite(n) && n >= OVER_AGE_MIN;
}

/** เหตุผลบนจอ/ในผลส่ง — คำเดียวทั้งระบบ */
export const OVER_AGE_REASON = `อายุ ${OVER_AGE_MIN} ปีขึ้นไป AI ไม่โทร`;
