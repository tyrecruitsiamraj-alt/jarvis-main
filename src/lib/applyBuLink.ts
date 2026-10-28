/**
 * ลิงก์หน้าสมัครแยก BU (+ล็อกตำแหน่ง) — ตั้งค่า › ลิงก์หน้าสมัคร (เจ้าของ 27 ต.ค. 2569)
 * `bu` = รหัส BU (null = ทุก BU) · `pos` = คำตำแหน่งที่ล็อก (ว่าง = ไม่ล็อก) · ตัวเดียวกับที่หน้า /apply อ่าน
 * `attachDocs` true = `doc=1` ฟอร์มมีช่องแนบเอกสาร · ไม่ส่ง/false = ไม่มีช่องแนบ
 * (เจ้าของ 27 ต.ค. 2569 "แนบไม่แนบ ถ้าไม่แนบก็ไม่ต้องมีช่องนี้" → 28 ต.ค. Choice "ปิดช่องแนบทุกทาง" · `applyLinkShowsDocument`)
 */
export function applyBuLink(origin: string, bu: string | null, pos: string, attachDocs = false): string {
  const p = new URLSearchParams();
  const b = (bu ?? '').trim().toUpperCase();
  if (/^[A-Z]{2,4}$/.test(b)) p.set('bu', b);
  const q = pos.trim();
  if (q) p.set('pos', q);
  if (attachDocs) p.set('doc', '1');
  const qs = p.toString();
  return `${origin.replace(/\/+$/, '')}/apply${qs ? `?${qs}` : ''}`;
}

/**
 * ฟอร์มสมัครโชว์ช่องแนบเอกสารไหม — `doc=1` เท่านั้นที่โชว์ (เจ้าของ 28 ต.ค. 2569 Choice "ปิดช่องแนบทุกทาง")
 * ⇒ ปุ่มหน้าสมัครในเมนู · ลิงก์เก่า (มี/ไม่มี `doc=0`) · ลิงก์ Gen ของใบขอ (/apply/p/…) = ไม่มีช่องแนบ
 */
export function applyLinkShowsDocument(search: URLSearchParams): boolean {
  return search.get('doc') === '1';
}
