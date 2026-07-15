import { THAI_PROVINCE_NAMES, canonProvinceName } from '@/lib/thaiProvinces';
import { getDistrictOptionsForProvince } from '@/lib/thaiDistricts';

export type ThaiAddressParts = {
  province: string | null;
  district: string | null;
  subdistrict: string | null;
};

/**
 * จัดข้อความที่อยู่ให้ parse ได้ง่ายขึ้น — เว้นวรรคหน้าคำนำหน้า และยุบช่องว่าง
 * (แก้เคส work_place1+2+3 ติดกันจาก ERP)
 */
export function normalizeJobLocationText(address: string): string {
  return address
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .replace(/(ตำบล|แขวง|อำเภอ\/เขต|อำเภอ|เขต|จังหวัด|จ\.|ต\.|อ\.)/gu, ' $1')
    .replace(/\s*([:：])\s*/gu, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Parse `location_address` strings built like AddJobPage / AddCandidatePage:
 * "... อำเภอ/เขต {district} จังหวัด {province} รหัสไปรษณีย์ ..."
 */
export function parseJobLocationAddress(address: string): {
  province: string | null;
  district: string | null;
} {
  const parts = parseThaiAddressParts(address);
  return { province: parts.province, district: parts.district };
}

/** แยก จังหวัด / อำเภอ·เขต / ตำบล·แขวง จากข้อความที่อยู่ (รองรับ ERP ฟรีเท็กซ์) */
export function parseThaiAddressParts(address: string): ThaiAddressParts {
  const s = normalizeJobLocationText(address);
  if (!s) return { province: null, district: null, subdistrict: null };

  const province = extractProvince(s);
  const district = extractDistrict(s, province);
  const subdistrict = extractSubdistrict(s);

  return { province, district, subdistrict };
}

function extractProvince(s: string): string | null {
  const labeled =
    s.match(/จังหวัด\s*[:：]?\s*([ก-๙A-Za-z().]+)/u) ||
    s.match(/(?:^|[\s,，])จ\.\s*([ก-๙A-Za-z().]+)/u);
  if (labeled?.[1]) {
    const c = canonProvinceName(labeled[1].replace(/[()]/g, '').trim());
    if (c) return c;
    const soft = softMatchProvince(labeled[1]);
    if (soft) return soft;
  }

  const structured = s.match(/จังหวัด\s+(.+?)(?=\s+รหัสไปรษณีย์|$)/u);
  if (structured?.[1]) {
    const c = canonProvinceName(structured[1].trim()) || softMatchProvince(structured[1]);
    if (c) return c;
  }

  const byLength = [...THAI_PROVINCE_NAMES].sort((a, b) => b.length - a.length);
  for (const name of byLength) {
    if (s.includes(name)) return name;
  }

  if (/กรุงเทพฯ?|กทม\.?|bangkok/i.test(s)) return 'กรุงเทพมหานคร';

  return null;
}

function softMatchProvince(raw: string): string | null {
  const t = raw.trim().replace(/[()]/g, '');
  const c = canonProvinceName(t);
  if (c) return c;
  const byLength = [...THAI_PROVINCE_NAMES].sort((a, b) => b.length - a.length);
  for (const name of byLength) {
    if (t.includes(name) || name.includes(t)) return name;
  }
  if (/กรุงเทพ|กทม/i.test(t)) return 'กรุงเทพมหานคร';
  return null;
}

function extractDistrict(s: string, province: string | null): string | null {
  const structured = s.match(/อำเภอ\/เขต\s+(.+?)(?=\s+จังหวัด|\s+จ\.|$)/u);
  if (structured?.[1]) {
    const d = cleanDistrictToken(structured[1]);
    if (d) return resolveOfficialDistrict(d, province);
  }

  const khet = s.match(
    /(?:^|[\s,，])เขต\s*([ก-๙A-Za-z.]+(?:\s+[ก-๙A-Za-z.]+){0,2})(?=\s+(?:แขวง|ตำบล|ต\.|จังหวัด|จ\.|ถนน|เลขที่|รหัสไปรษณีย์|อาคาร)|$|[\s,，])/u,
  );
  if (khet?.[1]) {
    const d = cleanDistrictToken(khet[1]);
    if (d) return resolveOfficialDistrict(d.startsWith('เขต') ? d : `เขต${d}`, province) || d;
  }

  const amphoe = s.match(
    /(?:^|[\s,，])(?:อ\.|อำเภอ(?!\/))\s*([ก-๙A-Za-z.]+(?:\s+[ก-๙A-Za-z.]+){0,3})(?=\s+(?:จังหวัด|จ\.|ตำบล|ต\.|อำเภอ\/เขต|รหัสไปรษณีย์)|$|[\s,，])/u,
  );
  if (amphoe?.[1]) {
    const d = cleanDistrictToken(amphoe[1]);
    if (d && !d.startsWith('/')) return resolveOfficialDistrict(d, province) || d;
  }

  if (province) {
    const fromList = matchDistrictFromOfficialList(s, province);
    if (fromList) return fromList;
  }

  return null;
}

function extractSubdistrict(s: string): string | null {
  const kwaeng = s.match(
    /(?:^|[\s,，])แขวง\s*([ก-๙A-Za-z.]+(?:\s+[ก-๙A-Za-z.]+){0,2})(?=\s+(?:อำเภอ|อ\.|เขต|จังหวัด|จ\.|ถนน|เลขที่|รหัสไปรษณีย์)|$|[\s,，])/u,
  );
  if (kwaeng?.[1]) {
    const name = kwaeng[1].trim().replace(/^แขวง\s*/u, '');
    if (name) return `แขวง${name}`;
  }

  const tambon = s.match(
    /(?:^|[\s,，])(?:ตำบล|ต\.)\s*([ก-๙A-Za-z.]+(?:\s+[ก-๙A-Za-z.]+){0,2})(?=\s+(?:อำเภอ|อ\.|เขต|จังหวัด|จ\.|ถนน|เลขที่|รหัสไปรษณีย์)|$|[\s,，])/u,
  );
  if (tambon?.[1]) {
    const name = tambon[1].trim().replace(/^(ตำบล|ต\.)\s*/u, '');
    if (name) return `ตำบล${name}`;
  }

  return null;
}

function cleanDistrictToken(raw: string): string {
  return raw
    .trim()
    .replace(/\s{2,}/g, ' ')
    .replace(/[.,]$/u, '');
}

function stripDistrictLabel(d: string): string {
  return d
    .trim()
    .replace(/^เขต\s*/u, '')
    .replace(/^อำเภอ\s*/u, '')
    .replace(/^อ\.\s*/u, '');
}

function resolveOfficialDistrict(raw: string, province: string | null): string | null {
  const cleaned = cleanDistrictToken(raw);
  if (!cleaned) return null;
  if (!province) return cleaned;
  const options = getDistrictOptionsForProvince(province);
  if (options.length === 0) return cleaned;
  const needle = stripDistrictLabel(cleaned).normalize('NFC');
  for (const opt of options) {
    const o = stripDistrictLabel(opt).normalize('NFC');
    if (o === needle) return opt;
  }
  for (const opt of options) {
    const o = stripDistrictLabel(opt).normalize('NFC');
    if (o.includes(needle) || needle.includes(o)) return opt;
  }
  return cleaned;
}

function matchDistrictFromOfficialList(s: string, province: string): string | null {
  const options = [...getDistrictOptionsForProvince(province)].sort(
    (a, b) => stripDistrictLabel(b).length - stripDistrictLabel(a).length,
  );
  for (const opt of options) {
    const bare = stripDistrictLabel(opt);
    if (bare.length < 2) continue;
    if (s.includes(opt) || s.includes(bare) || s.includes(`เขต${bare}`) || s.includes(`อำเภอ${bare}`)) {
      return opt;
    }
  }
  return null;
}

/** จังหวัดจากที่อยู่: อ่านจากรูปแบบมาตรฐาน หรือค้นชื่อจังหวัดในข้อความ / คำย่อ กรุงเทพ */
export function inferProvinceFromAddress(address: string): string | null {
  return parseThaiAddressParts(address).province;
}

/** อำเภอ/เขต: รูปแบบมาตรฐาน หรือคำว่า "เขต …" / "อ." / "อำเภอ …" ในข้อความ */
export function inferDistrictFromAddress(address: string): string | null {
  return parseThaiAddressParts(address).district;
}

export function inferSubdistrictFromAddress(address: string): string | null {
  return parseThaiAddressParts(address).subdistrict;
}

/** บรรทัดสรุปสำหรับ UI — จังหวัด · อำเภอ · ตำบล */
export function formatThaiAddressPartsLine(parts: ThaiAddressParts): string | null {
  const bits = [parts.province, parts.district, parts.subdistrict].filter(Boolean);
  return bits.length > 0 ? bits.join(' · ') : null;
}
