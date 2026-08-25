/**
 * ประเภทหน่วยงาน: ราชการ / เอกชน (เจ้าของสั่ง 25 ส.ค. 2569)
 *
 * 🔴 **ทีมระบุเอง ไม่ derive จาก ERP** — ERP มี `ms_customer_group` อยู่แล้วก็จริง
 * (001 เอกชน · 002 ราชการ · 003 กฟภ. · 004 รัฐวิสาหกิจ · …) แต่วัดจริงบนใบขอที่เปิดอยู่:
 * เอกชน 11,660 · ราชการ 2,950 · **กฟภ. 2,671** · **ไม่รู้กลุ่ม 2,804**
 * ⇒ กฟภ./รัฐวิสาหกิจ จะนับฝั่งไหนเป็นนโยบาย ไม่ใช่ข้อมูล · เจ้าของจึงเคาะให้คนเลือกเอง 2 ค่า
 *
 * 🔴 **ยังไม่ระบุ ≠ เอกชน** — ค่าว่างต้องอ่านออกว่า "ยังไม่ระบุ" เสมอ
 * ห้ามให้ค่าใดค่าหนึ่งเป็น default (ไม่งั้น 138 หน่วยงานจะกลายเป็นเอกชนทั้งหมดโดยไม่มีใครสั่ง)
 *
 * เก็บที่ระดับ **หน่วยงาน (site_code)** ไม่ใช่รายใบขอ — ใบขอ 293 ใบมาจาก 138 หน่วยงาน
 */

/** ค่าที่ฐานยอมรับ (ตรงกับ CHECK ของ migration 108) */
export const UNIT_SECTORS = ['government', 'private'] as const;
export type UnitSector = (typeof UNIT_SECTORS)[number];

/** คำบนจอ — เจ้าของเคาะสองคำนี้ */
export const UNIT_SECTOR_LABEL: Record<UnitSector, string> = {
  government: 'ราชการ',
  private: 'เอกชน',
};

/** คำที่ใช้เมื่อยังไม่มีใครระบุ — ต้องต่างจากคำตอบจริงชัดเจน */
export const UNIT_SECTOR_UNSET_LABEL = 'ยังไม่ระบุ';

/** ค่าที่รับมาเป็น UnitSector ที่ถูกต้องไหม (กันค่ามั่วจาก URL/body) */
export function isUnitSector(v: unknown): v is UnitSector {
  return typeof v === 'string' && (UNIT_SECTORS as readonly string[]).includes(v);
}

/**
 * แปลงค่าที่รับมาให้ปลอดภัย
 * - ค่าถูกต้อง → คืนค่านั้น
 * - `null` / `''` → `null` (แปลว่า **ล้างค่า** ให้กลับไปยังไม่ระบุ)
 * - ค่ามั่ว → `undefined` (แปลว่า **ปฏิเสธ** ผู้เรียกต้องตอบ 400 ห้ามเงียบ)
 *
 * 🔴 แยก null กับ undefined ให้ขาด — ถ้ารวมเป็นค่าเดียว "ค่ามั่ว" จะกลายเป็น "ล้างค่า"
 * แล้วของที่ทีมระบุไว้หายโดยไม่มีใครรู้
 */
export function normalizeUnitSector(v: unknown): UnitSector | null | undefined {
  if (v === null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    return isUnitSector(t) ? t : undefined;
  }
  return undefined;
}

/** ป้ายบนจอของหน่วยงานหนึ่ง (ไม่มีค่า = ยังไม่ระบุ) */
export function unitSectorLabel(v: UnitSector | null | undefined): string {
  return v ? UNIT_SECTOR_LABEL[v] : UNIT_SECTOR_UNSET_LABEL;
}

/** ตัวเลือกสำหรับ dropdown — เรียงคงที่เสมอ (ห้ามสลับที่) */
export const UNIT_SECTOR_OPTIONS: ReadonlyArray<{ value: UnitSector; label: string }> =
  UNIT_SECTORS.map((v) => ({ value: v, label: UNIT_SECTOR_LABEL[v] }));

/**
 * สรุปว่าระบุครบหรือยัง — ใช้บอกบนหัวหน้าว่าเหลืออีกกี่หน่วยงาน
 * ⚠️ นับที่ระดับ **หน่วยงาน** ไม่ใช่ระดับใบขอ (ไซต์เดียวมีได้หลายใบ)
 */
export function sectorCoverage(
  siteCodes: readonly (string | null | undefined)[],
  known: Readonly<Record<string, UnitSector>>,
): { total: number; filled: number; missing: number } {
  const sites = new Set(
    siteCodes.map((s) => String(s ?? '').trim()).filter((s) => s.length > 0),
  );
  let filled = 0;
  for (const s of sites) if (known[s]) filled += 1;
  return { total: sites.size, filled, missing: sites.size - filled };
}
