/** อำเภอ/เขตต่อจังหวัด — สร้างจากข้อมูล kongvut/thai-province-data (รัน scripts/gen-thai-districts-by-province.mjs) */
import districtsByProvince from '@/data/thaiDistrictsByProvince.json';

export type ThaiDistrictsByProvince = Record<string, string[]>;

const BY_PROVINCE = districtsByProvince as ThaiDistrictsByProvince;

/** รายชื่ออำเภอ/เขตทางการของจังหวัด (เรียงแล้ว) — ว่างถ้าไม่รู้จักชื่อจังหวัด */
export function getDistrictOptionsForProvince(provinceName: string): readonly string[] {
  const list = BY_PROVINCE[provinceName];
  return list ?? [];
}
