/**
 * ═══ "ติดตามครั้งที่" — 1–7 เป็นเลข · ต่อด้วยขั้นที่มีชื่อ (เจ้าของ 9 ต.ค. 2569) ═══
 *
 * > *"ติดตามครั้งที่ เอาครั้งที่ 8-10 เปลี่ยนเป็น ประเมิน · เบิกเบี้ยเลี้ยง · เรียนงาน · ยกยอด"*
 *
 * 🔴 ขั้นที่มีชื่อเก็บเป็นรหัส **91–94** ไม่ใช่ 8–11 — เลข 8 ขึ้นไปยังเป็น "วันที่ 8+" ของตารางยาวที่ระบบนับเอง
 * (ในฐานมีแถว plan_day_no 8–12 อยู่แล้ว 24 แถว · ตารางหลายวันนับต่อจากวันแรกไปเรื่อย ๆ) — ใช้ 8–11 = แถวเก่ากลายเป็นชื่อผิด
 * คอลัมน์ plan_day_no / plan_day_start รับ 1–99 อยู่แล้ว (migration 137/140) ไม่ต้อง migrate
 */

export const FOLLOW_NAMED_DAYS = [
  { no: 91, label: 'ประเมิน' },
  { no: 92, label: 'เบิกเบี้ยเลี้ยง' },
  { no: 93, label: 'เรียนงาน' },
  { no: 94, label: 'ยกยอด' },
] as const;

/** ตัวเลือกที่เป็นเลขในฟอร์ม (1–7) */
export const FOLLOW_DAY_NUMBER_MAX = 7;
/** รหัสแรกของขั้นที่มีชื่อ — เลขตั้งแต่นี้ขึ้นไปไม่ใช่ "วันที่" */
export const FOLLOW_NAMED_DAY_MIN = 91;

/** ชื่อของขั้น (91–94) · เป็นเลขธรรมดา = null */
export function followNamedDayLabel(no: number | null | undefined): string | null {
  if (typeof no !== 'number') return null;
  return FOLLOW_NAMED_DAYS.find((d) => d.no === no)?.label ?? null;
}

export function isFollowNamedDay(no: number | null | undefined): boolean {
  return followNamedDayLabel(no) !== null;
}

/** ข้อความสั้นของ "ติดตามครั้งที่" — ชื่อขั้น หรือเลข */
export function followDayNoText(no: number): string {
  return followNamedDayLabel(no) ?? String(no);
}

/**
 * ตัวเลือกของช่อง "ติดตามครั้งที่" ในฟอร์ม: 1–7 แล้วตามด้วยขั้นที่มีชื่อ
 * ค่าปัจจุบันเป็นเลขเกิน 7 (วันที่ 8+ ของตารางยาวที่นับเอง) = ใส่ไว้ด้วย ไม่งั้นช่องว่างเปล่า
 */
export function followDayNoOptions(current?: number | null): Array<{ value: string; label: string }> {
  const nums = Array.from({ length: FOLLOW_DAY_NUMBER_MAX }, (_, i) => i + 1);
  if (typeof current === 'number' && current > FOLLOW_DAY_NUMBER_MAX && !isFollowNamedDay(current)) nums.push(current);
  return [
    ...nums.map((n) => ({ value: String(n), label: String(n) })),
    ...FOLLOW_NAMED_DAYS.map((d) => ({ value: String(d.no), label: d.label })),
  ];
}
