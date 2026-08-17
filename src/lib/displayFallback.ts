/**
 * ค่าว่างบนหน้าจอ — "แสดงขีด" ไม่ใช่ "ซ่อนทั้งบรรทัด"
 *
 * เจ้าของสั่ง 13 ส.ค. 2569: "ไม่ใช่ข้อมูลไม่เท่ากันก็ขยับเอง คงมันไว้ให้ตรงกัน"
 * ฟิลด์ที่ถูกซ่อนตอนไม่มีค่าทำให้ของที่เหลือเลื่อนขึ้นมา แถวของแต่ละคนจึงไม่ตรงระดับกัน
 * element ที่มีข้อความเสมอจะมี line-box 1 บรรทัดเสมอโดยอัตโนมัติ — ตรงกว่าการเดาค่า min-h
 *
 * ⚠️ **ห้ามตั้งชื่อ `DASH`** — ชนกับ token พื้นผิวหน้า dashboard ใน designTokens.ts
 * ซึ่งบางไฟล์ (เช่น RmTable) import อยู่แล้ว
 */
export const EM_DASH = '—';

/**
 * ⚠️ **`0` ต้องได้ `'0'` ไม่ใช่ขีด** — เขียน `v || EM_DASH` ไม่ได้ เพราะฟิลด์ตัวเลข
 * (น้ำหนัก/ส่วนสูง/จำนวน) ที่เป็น 0 คือคำตอบจริง ไม่ใช่ช่องว่าง
 * ส่วนสตริงที่มีแต่เว้นวรรคถือว่าว่าง (คนกรอกเคาะ space ทิ้งไว้)
 */
export function dashIfEmpty(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return EM_DASH;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : EM_DASH;
  const trimmed = v.trim();
  return trimmed === '' ? EM_DASH : trimmed;
}
