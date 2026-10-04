/** ช่วงอายุที่รับ (หน้า 3 ของป๊อปประกาศ · 4 ต.ค. 2569) */
export const AGE_LIMIT = { min: 15, max: 80 } as const;

/** ตรวจช่วงอายุก่อนบันทึก — คืนข้อความผิด หรือ null เมื่อผ่าน (ว่างทั้งคู่ได้ = ไม่จำกัดอายุ) */
export function ageRangeError(min: number | null, max: number | null): string | null {
  for (const v of [min, max]) {
    if (v !== null && (!Number.isInteger(v) || v < AGE_LIMIT.min || v > AGE_LIMIT.max)) {
      return `อายุต้องอยู่ระหว่าง ${AGE_LIMIT.min}–${AGE_LIMIT.max} ปี`;
    }
  }
  if (min !== null && max !== null && min > max) return 'อายุต่ำสุดต้องไม่มากกว่าอายุสูงสุด';
  return null;
}
