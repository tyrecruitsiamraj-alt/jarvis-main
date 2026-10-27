/**
 * ลิงก์หน้าสมัครแยก BU (+ล็อกตำแหน่ง) — ตั้งค่า › ลิงก์หน้าสมัคร (เจ้าของ 27 ต.ค. 2569)
 * `bu` = รหัส BU (null = ทุก BU) · `pos` = คำตำแหน่งที่ล็อก (ว่าง = ไม่ล็อก) · ตัวเดียวกับที่หน้า /apply อ่าน
 * `attachDocs` false = `doc=0` ฟอร์มไม่มีช่องแนบเอกสาร (เจ้าของ 27 ต.ค. 2569 "แนบไม่แนบ ถ้าไม่แนบก็ไม่ต้องมีช่องนี้") ·
 * ลิงก์เก่าที่ไม่มี `doc` = มีช่องแนบเหมือนเดิม (`applyLinkShowsDocument`)
 */
export function applyBuLink(origin: string, bu: string | null, pos: string, attachDocs = true): string {
  const p = new URLSearchParams();
  const b = (bu ?? '').trim().toUpperCase();
  if (/^[A-Z]{2,4}$/.test(b)) p.set('bu', b);
  const q = pos.trim();
  if (q) p.set('pos', q);
  if (!attachDocs) p.set('doc', '0');
  const qs = p.toString();
  return `${origin.replace(/\/+$/, '')}/apply${qs ? `?${qs}` : ''}`;
}

/** ฟอร์มสมัครโชว์ช่องแนบเอกสารไหม — `doc=0` เท่านั้นที่ซ่อน (ลิงก์ประกาศ/ลิงก์เก่ายังมีช่องแนบ) */
export function applyLinkShowsDocument(search: URLSearchParams): boolean {
  return search.get('doc') !== '0';
}
