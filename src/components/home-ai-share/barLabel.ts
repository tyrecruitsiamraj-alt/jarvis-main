/**
 * ข้อความในสีของแท่งกราฟยอดใช้งาน (รอบ 17 · 30 ก.ย. 2569) — แยกจากไฟล์กราฟให้เทสต์ได้โดยไม่ทำ Fast Refresh พัง
 *
 * เจ้าของ: *"ในการ์ดมีแค่เลขกับ % พอ เพราะคำอธิบายบอกหมดแล้ว"* ⇒ ในสีของแท่งมีแค่ **เลข + %** ไม่มีชื่อก้อน/BU
 * (ชื่ออยู่ที่ป้ายสีด้านบนกราฟที่เดียว) · เทสต์ที่ `AiShareUsageChart.test.ts`
 */

const NUM = new Intl.NumberFormat('th-TH');

/** เลขในแท่งต้องสูงอย่างน้อยเท่านี้ถึงจะเขียน (สีบางกว่านี้ดูตอนจี้แทน) */
const MIN_LABEL_HEIGHT = 16;
/** สูงเท่านี้ขึ้นไป = เขียนสองบรรทัด (เลขบน · % ล่าง) */
const TWO_LINE_HEIGHT = 30;
/** ความกว้างโดยประมาณของข้อความขนาด 11px (Kanit) — ใช้ตัดสินว่าเขียนได้แค่ไหน */
const textWidth = (t: string) => t.length * 6.5 + 8;

/**
 * สูงพอสองบรรทัด = `["92", "45%"]` · ไม่พอ = `["92 · 45%"]` · แคบ = `["45%"]` · เล็กเกิน/ไม่มีค่า = `[]`
 * `countOnTop` = สีนี้คือทั้งแท่ง และเลขยอดขึ้นบนหัวแท่งอยู่แล้ว ⇒ ในสีเหลือ % อย่างเดียว (ไม่ขึ้นเลขเดียวกันซ้ำสองที่)
 */
export function barLabelLines(value: number, pct: number, width: number, height: number, countOnTop = false): string[] {
  if (!(value > 0) || !Number.isFinite(width) || !Number.isFinite(height) || height < MIN_LABEL_HEIGHT) return [];
  const count = NUM.format(value);
  const share = `${pct}%`;
  if (countOnTop) return width >= textWidth(share) ? [share] : [];
  if (height >= TWO_LINE_HEIGHT && width >= Math.max(textWidth(count), textWidth(share))) return [count, share];
  const one = `${count} · ${share}`;
  if (width >= textWidth(one)) return [one];
  return width >= textWidth(share) ? [share] : [];
}
