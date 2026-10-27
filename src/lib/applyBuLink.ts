/**
 * ลิงก์หน้าสมัครแยก BU (+ล็อกตำแหน่ง) — ตั้งค่า › ลิงก์หน้าสมัคร (เจ้าของ 27 ต.ค. 2569)
 * `bu` = รหัส BU (null = ทุก BU) · `pos` = คำตำแหน่งที่ล็อก (ว่าง = ไม่ล็อก) · ตัวเดียวกับที่หน้า /apply อ่าน
 */
export function applyBuLink(origin: string, bu: string | null, pos: string): string {
  const p = new URLSearchParams();
  const b = (bu ?? '').trim().toUpperCase();
  if (/^[A-Z]{2,4}$/.test(b)) p.set('bu', b);
  const q = pos.trim();
  if (q) p.set('pos', q);
  const qs = p.toString();
  return `${origin.replace(/\/+$/, '')}/apply${qs ? `?${qs}` : ''}`;
}
