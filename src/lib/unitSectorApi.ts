/**
 * client ของ `/api/unit-sector` — ประเภทหน่วยงาน ราชการ/เอกชน ที่ทีมระบุเอง
 *
 * 🔴 โหลดล้ม = หน้าหน่วยงานต้องยังใช้ได้ปกติ — ผู้เรียกจับ error แล้วถือว่า "ยังไม่ระบุ" ทุกไซต์
 * (dropdown ยังกดได้ แค่ค่าที่เคยบันทึกยังไม่ขึ้น) · ห้ามให้หน้าหลักของทีมล้มเพราะช่องนี้
 */
import { apiFetch } from '@/lib/apiFetch';
import type { UnitSector } from '@/lib/unitSector';

export type UnitSectorMap = Record<string, UnitSector>;

export async function fetchUnitSectors(): Promise<UnitSectorMap> {
  const r = await apiFetch('/api/unit-sector');
  if (!r.ok) throw new Error('โหลดประเภทหน่วยงานไม่สำเร็จ');
  const data = (await r.json()) as { sectors?: UnitSectorMap };
  return data.sectors ?? {};
}

/** บันทึกประเภทของหน่วยงานหนึ่ง — `null` = ล้างค่ากลับไป "ยังไม่ระบุ" */
export async function saveUnitSector(
  siteCode: string,
  sector: UnitSector | null,
): Promise<void> {
  const r = await apiFetch('/api/unit-sector', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ site_code: siteCode, sector }),
  });
  if (!r.ok) {
    // ข้อความจาก API บอกเหตุผลจริง (เช่น ค่ามั่ว) — อย่ากลืนแล้วบอกว่า "ผิดพลาด"
    const msg = await r.text().catch(() => '');
    throw new Error(msg || 'บันทึกประเภทหน่วยงานไม่สำเร็จ');
  }
}
