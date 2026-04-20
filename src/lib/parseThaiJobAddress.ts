import { THAI_PROVINCE_NAMES, canonProvinceName } from '@/lib/thaiProvinces';

/**
 * Parse `location_address` strings built like AddJobPage / AddCandidatePage:
 * "... อำเภอ/เขต {district} จังหวัด {province} รหัสไปรษณีย์ ..."
 */
export function parseJobLocationAddress(address: string): {
  province: string | null;
  district: string | null;
} {
  const s = address.trim();
  if (!s) return { province: null, district: null };

  let province: string | null = null;
  let district: string | null = null;

  const prov = s.match(/จังหวัด\s+(.+?)(?=\s+รหัสไปรษณีย์|$)/u);
  if (prov?.[1]) province = prov[1].trim() || null;

  const dist = s.match(/อำเภอ\/เขต\s+(.+?)(?=\s+จังหวัด|$)/u);
  if (dist?.[1]) district = dist[1].trim() || null;

  return { province, district };
}

/** จังหวัดจากที่อยู่: อ่านจากรูปแบบมาตรฐาน หรือค้นชื่อจังหวัดในข้อความ / คำย่อ กรุงเทพ */
export function inferProvinceFromAddress(address: string): string | null {
  const s = address.trim();
  if (!s) return null;

  const structured = parseJobLocationAddress(s);
  if (structured.province) {
    const c = canonProvinceName(structured.province);
    if (c) return c;
  }

  const byLength = [...THAI_PROVINCE_NAMES].sort((a, b) => b.length - a.length);
  for (const name of byLength) {
    if (s.includes(name)) return name;
  }

  if (/กรุงเทพ|กทม\.?|bangkok/i.test(s)) return 'กรุงเทพมหานคร';

  return null;
}

export function inferDistrictFromAddress(address: string): string | null {
  const { district } = parseJobLocationAddress(address);
  return district;
}
