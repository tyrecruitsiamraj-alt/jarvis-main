import { inferDistrictFromAddress } from '@/lib/parseThaiJobAddress';

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
  const jobDist = inferDistrictFromAddress(jobAddress);
  if (!jobDist) return false;
  const a = stripDistrictPrefix(jobDist).normalize('NFC');
  const b = stripDistrictPrefix(filterDistrict).normalize('NFC');
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}
