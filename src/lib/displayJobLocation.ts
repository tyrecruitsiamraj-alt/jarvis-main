import { inferDistrictFromAddress, inferProvinceFromAddress } from '@/lib/parseThaiJobAddress';

/**
 * ที่อยู่สั้นๆ ใน กทม. ที่ไม่มีคำว่า "เขต" / "อำเภอ/เขต" — เดาเขตจากถนน/ย่านที่พบบ่อย (ไม่ครบทุกเคส)
 */
const BANGKOK_ADDRESS_DISTRICT_HINTS: readonly { pattern: RegExp; district: string }[] = [
  { pattern: /อโศก|asoke|สุขุมวิท\s*21|สุขุมวิท\s*23|สุขุมวิท\s*25/i, district: 'เขตวัฒนา' },
  { pattern: /สีลม|silom/i, district: 'เขตบางรัก' },
  { pattern: /สาทร|sathorn/i, district: 'เขตสาทร' },
  { pattern: /สยาม|siam|พญาไท|phaya\s*thai|ราชเทวี|ratchathewi/i, district: 'เขตปทุมวัน' },
  { pattern: /ลาดพร้าว|lat\s*phrao/i, district: 'เขตลาดพร้าว' },
  { pattern: /บางนา|bang\s*na/i, district: 'เขตบางนา' },
  { pattern: /จตุจักร|chatuchak|หมอชิต/i, district: 'เขตจตุจักร' },
];

/** แสดงชื่ออำเภอ/เขตสำหรับรายละเอียดงาน — ดึงจากที่อยู่เต็ม หรือเดาจากย่านใน กทม. */
export function displayDistrictLine(address: string): string | null {
  const fromAddr = inferDistrictFromAddress(address);
  if (fromAddr) return fromAddr;

  const prov = inferProvinceFromAddress(address);
  if (prov !== 'กรุงเทพมหานคร') return null;

  const s = address.trim();
  for (const { pattern, district } of BANGKOK_ADDRESS_DISTRICT_HINTS) {
    if (pattern.test(s)) return district;
  }
  return null;
}
