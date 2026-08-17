/**
 * เบอร์ไทย → E.164 — **สูตรเดียวของทั้งระบบ**
 *
 * แยกออกมาจาก lumosDispatch เพราะสองที่ต้องใช้และอ้างกันเป็นวงกลม:
 *   - lumosDispatch  ใส่ `recipient_phone` ลง payload ที่ส่งให้ Lumos
 *   - candidateCallHolds ใช้เป็น **กุญแจล็อก** "รับไปโทรเอง"
 * ถ้าสองที่นี้แปลงเบอร์ไม่เหมือนกันแม้แต่ตัวเดียว ล็อกจะเทียบไม่ตรง →
 * AI กับคนโทรทับกันเงียบ ๆ · ห้ามก๊อปสูตรนี้ไปไว้ที่อื่น ให้ import จากไฟล์นี้เท่านั้น
 */

/** เบอร์ไทย → E.164 (+66…) — คืน null ถ้าแปลงไม่ได้ (Lumos ต้องการ E.164 เท่านั้น) */
export function toE164Thai(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
  return null;
}
