import { PREQUEST_ID_PREFIX } from './siamrajSqlServerPrequests.js';

/**
 * คีย์ทุกรูปที่ของชิ้นเดียวกันอาจถูกบันทึกไว้ (หมายเหตุ · ผู้รับผิดชอบ · สถานะทำงาน) — ใช้ตอน**อ่านกลับ**เท่านั้น
 * (ย้ายจาก `siamraj-unit-requests.ts` 26 พ.ย. 2569 ให้ตัวคิดผลจับคู่อ่านสถานะทำงานด้วยกติกาเดียวกัน)
 *
 * 🔴 ทำไมต้องหาหลายรูป (22 ก.ย. 2569): ERP บางแถวเก็บ `request_no` เป็นตัวเลขล้วน (`6907001`) แล้วเราเติม prefix
 * ตอนแสดงผล (`SQ6907001`) ⇒ ใบเดียวกันมีสองชื่อ · ⚠️ ตัวเขียนใช้คีย์เดียว ห้ามเอาไปใช้ตอนเขียน
 * 🔴 ใบขอล่วงหน้ามีคีย์เดียว ห้ามถอยไปเลขเปล่า (23 ก.ย. 2569) — เลขซ้ำใบจริงได้ ถอยแล้วไปหยิบของใบจริงมาโชว์
 */
export function readUnitRequestKeys(it: Record<string, unknown>): string[] {
  const id = String(it.id ?? '').trim();
  if (id.startsWith(PREQUEST_ID_PREFIX)) return [id];
  const out: string[] = [];
  for (const raw of [it.request_no, it.externalId, it.id]) {
    const v = String(raw ?? '').trim();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** ค่าที่แปะได้ของ item นี้ — ลองคีย์ตามลำดับ เจอตัวแรกที่มีของ */
export function pickByUnitRequestKeys<T>(map: Map<string, T>, keys: readonly string[]): T | undefined {
  for (const k of keys) {
    const hit = map.get(k);
    if (hit) return hit;
  }
  return undefined;
}
