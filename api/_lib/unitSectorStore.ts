/**
 * ประเภทหน่วยงาน ราชการ/เอกชน ที่ทีมระบุเอง (migration 108) — อ่านที่เดียว
 *
 * แยกออกมาจาก `api/_handlers/unit-sector.ts` เพราะ **feed ใบขอก็ต้องใช้**:
 * ใบขอที่อ่านมาจาก ERP ไม่เคยมีค่านี้ (feed ฮาร์ดโค้ด `job_category: 'private'` ทุกใบ
 * ตั้งแต่วันแรก) ⇒ ช่องค้นหาหน้าหน่วยงานพิมพ์ "เอกชน" แล้วเจอทุกใบ แม้ใบที่เป็นราชการ
 *
 * 🔴 กติกา:
 * 1. **ไม่มีแถว = ยังไม่ระบุ (`null`) ห้ามเดาเป็นเอกชน** — 138 หน่วยงานกรอกไปแล้ว
 *    79 หน่วยงาน (วัดจริง 25 ส.ค. 2569) ที่เหลือต้องอ่านออกว่ายังไม่มีใครระบุ
 * 2. **อ่านไม่ได้ต้องไม่ทำ feed ล่ม** — ตารางนี้เป็นข้อมูลเสริม (แพตเทิร์นเดียวกับ
 *    `getUnitAssignmentsMap` / `getUnitNotesMap`) · ฐานที่ยังไม่รัน migration 108
 *    จะได้ 42P01 แล้วต้องได้แผนที่ว่างเปล่า ไม่ใช่ 500 ทั้งหน้า
 * 3. คีย์เป็น `site_code` (หน่วยงาน) ไม่ใช่เลขที่ใบขอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import type { UnitSector } from '@/lib/unitSector';

const TABLE = tableInAppSchema('unit_sector');

export type UnitSectorMap = Readonly<Record<string, UnitSector>>;

/** อ่านทั้งตาราง (เล็ก — 138 แถว) · อ่านไม่ได้คืนแผนที่ว่าง */
export async function getUnitSectorMap(): Promise<UnitSectorMap> {
  try {
    const { rows } = await dbQuery<{ site_code: string; sector: UnitSector }>(
      `select site_code, sector from ${TABLE}`,
    );
    const out: Record<string, UnitSector> = {};
    for (const r of rows) {
      const code = String(r.site_code ?? '').trim();
      if (code) out[code] = r.sector;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * แปะ `unit_sector` ลงใบขอที่อ่านมาจาก ERP
 *
 * 🔴 **แปะทุกใบเสมอ แม้ยังไม่ระบุ (เป็น `null`)** — ฝั่งจอใช้ "มี property ไหม"
 * เป็นตัวแยกว่าแถวนี้เป็นใบขอจาก ERP (ที่ `job_category` เชื่อไม่ได้)
 * หรือเป็นงานในตาราง `jobs` (ที่ `job_category` เป็นของจริง)
 */
export async function attachUnitSector(items: unknown[]): Promise<void> {
  const list = items as Array<Record<string, unknown>>;
  if (list.length === 0) return;
  const map = await getUnitSectorMap();
  for (const it of list) {
    const code = String(it.site_code ?? '').trim();
    it.unit_sector = (code && map[code]) || null;
  }
}
