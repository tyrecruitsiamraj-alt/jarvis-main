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

/**
 * ตัวเทียบอำเภอ/เขตของที่อยู่หนึ่งอัน — **แยกที่อยู่ครั้งเดียว** แล้วเทียบกับอำเภอได้หลายตัว
 *
 * 🔴 ตัวกรองหน้างานสรรหาเคยหน่วง ~2 วินาทีต่อการติ๊ก (วัดจริง 4 ต.ค. 2569): หัวข้ออำเภอเรียก
 * `districtMatchesFilter` ทีละอำเภอ (กรุงเทพฯ 50 เขต) ⇒ แยกที่อยู่ใบเดิมซ้ำ 50 รอบต่อใบ
 */
const matcherCache = new Map<string, (filterDistrict: string) => boolean>();
const MATCHER_CACHE_MAX = 4000;

export function districtMatcherFor(jobAddress: string): (filterDistrict: string) => boolean {
  const hit = matcherCache.get(jobAddress);
  if (hit) return hit;
  const m = buildDistrictMatcher(jobAddress);
  if (matcherCache.size >= MATCHER_CACHE_MAX) matcherCache.clear();
  matcherCache.set(jobAddress, m);
  return m;
}

function buildDistrictMatcher(jobAddress: string): (filterDistrict: string) => boolean {
  const jobDist = inferDistrictFromAddress(jobAddress) || displayDistrictLine(jobAddress);
  const blob = jobAddress.normalize('NFC');
  const a = jobDist ? stripDistrictPrefix(jobDist).normalize('NFC') : null;
  return (filterDistrict: string) => {
    if (!filterDistrict) return true;
    const b = stripDistrictPrefix(filterDistrict).normalize('NFC');
    if (a === null) {
      /** fallback: ชื่ออำเภอที่เลือกโผล่ในข้อความดิบ */
      return b.length >= 2 && (blob.includes(b) || blob.includes(filterDistrict));
    }
    return a === b || a.includes(b) || b.includes(a);
  };
}

/** เทียบชื่ออำเภอ/เขตจากที่อยู่ประกาศกับค่าที่เลือกจากรายการทางการ */
export function districtMatchesFilter(jobAddress: string, filterDistrict: string): boolean {
  return districtMatcherFor(jobAddress)(filterDistrict);
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
