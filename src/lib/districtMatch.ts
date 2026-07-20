import { inferDistrictFromAddress, parseThaiAddressParts } from '@/lib/parseThaiJobAddress';
import { displayDistrictLine } from '@/lib/displayJobLocation';

/** ตัดคำนำหน้าเขต/อำเภอเพื่อเทียบกับข้อความในประกาศ */
export function stripDistrictPrefix(d: string): string {
  return d
    .trim()
    .replace(/^เขต\s*/u, '')
    .replace(/^อำเภอ\s*/u, '')
    .replace(/^อ\.\s*/u, '');
}

/** เทียบชื่ออำเภอ/เขตจากที่อยู่ประกาศกับค่าที่เลือกจากรายการทางการ */
export function districtMatchesFilter(jobAddress: string, filterDistrict: string): boolean {
  if (!filterDistrict) return true;
  const fromParse = inferDistrictFromAddress(jobAddress);
  const fromHint = displayDistrictLine(jobAddress);
  const jobDist = fromParse || fromHint;
  if (!jobDist) {
    /** fallback: ชื่ออำเภอที่เลือกโผล่ในข้อความดิบ */
    const bare = stripDistrictPrefix(filterDistrict).normalize('NFC');
    const blob = jobAddress.normalize('NFC');
    return bare.length >= 2 && (blob.includes(bare) || blob.includes(filterDistrict));
  }
  const a = stripDistrictPrefix(jobDist).normalize('NFC');
  const b = stripDistrictPrefix(filterDistrict).normalize('NFC');
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}

/** สรุปที่อยู่แบบแยกส่วน สำหรับหน้าหน่วยงาน */
export function cleanedAddressSummary(address: string): {
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  line: string | null;
} {
  const parts = parseThaiAddressParts(address);
  const district = parts.district || displayDistrictLine(address);
  const bits = [parts.province, district, parts.subdistrict].filter(Boolean) as string[];
  return {
    province: parts.province,
    district,
    subdistrict: parts.subdistrict,
    line: bits.length > 0 ? bits.join(' · ') : null,
  };
}
