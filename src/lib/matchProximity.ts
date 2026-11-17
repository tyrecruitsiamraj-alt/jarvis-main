/**
 * ═══ คนอยู่ใกล้งานแค่ไหน + ตัดคนที่ผิดเงื่อนไขก่อนส่งให้ AI (เจ้าของ 17 พ.ย. 2569 "match ไม่ตรงเลย" · Choice แก้ครบชุด) ═══
 *
 * วัดจริง 17 พ.ย. 2569: OPL6911056 (อมตะ ชลบุรี) แนะนำ 15 คน อยู่ชลบุรีแค่ 1 · LBM6903002 (สุขุมวิท) อายุเกินช่วง 4 คน
 * ต้นเหตุ: สกิลคนขับรถเหมือนกันหมด คะแนนเท่ากัน ⇒ ตัดเหลือ 20 คนตามความเคลื่อนไหวล่าสุดทั้งประเทศ ไม่ดูพื้นที่
 * ⇒ เรียงตามความใกล้ก่อนตัด shortlist · เพศ/อายุที่รู้ค่าและผิดเงื่อนไข = ไม่ส่งให้ AI เลย
 *
 * ลำดับความใกล้ (ไม่อ้างว่าเป็นระยะทางจริง — ไม่มีพิกัด):
 *   0 อำเภอ/เขตเดียวกับงาน · 1 จังหวัดเดียวกัน · 2 ภาคเดียวกัน (กรุงเทพฯ อยู่ภาคกลาง) · 3 ไม่มีที่อยู่ · 4 คนละภาค
 * ตรรกะล้วน ใช้ทั้งตัวจับคู่ฝั่ง server และป้าย/การเรียงบนจอ
 */
import { canonProvinceName } from '@/lib/thaiProvinces';
import { stripDistrictPrefix } from '@/lib/districtMatch';
import { inferProvinceFromAddress, parseThaiAddressParts } from '@/lib/parseThaiJobAddress';

export type ThaiRegion = 'north' | 'northeast' | 'central' | 'east' | 'west' | 'south';

/** 6 ภาค ตามการแบ่งทางภูมิศาสตร์ของราชบัณฑิตยสถาน — 77 จังหวัด */
const REGION_PROVINCES: Record<ThaiRegion, readonly string[]> = {
  north: ['เชียงราย', 'เชียงใหม่', 'น่าน', 'พะเยา', 'แพร่', 'แม่ฮ่องสอน', 'ลำปาง', 'ลำพูน', 'อุตรดิตถ์', 'กำแพงเพชร', 'ตาก', 'นครสวรรค์', 'พิจิตร', 'พิษณุโลก', 'เพชรบูรณ์', 'สุโขทัย', 'อุทัยธานี'],
  northeast: ['กาฬสินธุ์', 'ขอนแก่น', 'ชัยภูมิ', 'นครพนม', 'นครราชสีมา', 'บึงกาฬ', 'บุรีรัมย์', 'มหาสารคาม', 'มุกดาหาร', 'ยโสธร', 'ร้อยเอ็ด', 'เลย', 'ศรีสะเกษ', 'สกลนคร', 'สุรินทร์', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อุดรธานี', 'อุบลราชธานี'],
  central: ['กรุงเทพมหานคร', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'นครปฐม', 'พระนครศรีอยุธยา', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'สระบุรี', 'นครนายก', 'สมุทรสงคราม', 'สุพรรณบุรี'],
  east: ['ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว'],
  west: ['กาญจนบุรี', 'ราชบุรี', 'เพชรบุรี', 'ประจวบคีรีขันธ์'],
  south: ['กระบี่', 'ชุมพร', 'ตรัง', 'นครศรีธรรมราช', 'นราธิวาส', 'ปัตตานี', 'พังงา', 'พัทลุง', 'ภูเก็ต', 'ยะลา', 'ระนอง', 'สงขลา', 'สตูล', 'สุราษฎร์ธานี'],
};

const REGION_OF = new Map<string, ThaiRegion>(
  (Object.entries(REGION_PROVINCES) as Array<[ThaiRegion, readonly string[]]>).flatMap(([r, ps]) => ps.map((p) => [p, r] as const)),
);

/** ชื่อจังหวัดทางการ ("กทม." "กรุงเทพฯ" "จ.ชลบุรี" → ชื่อเต็ม) · อ่านไม่ออก = null */
export function canonProvince(raw: string | null | undefined): string | null {
  const s = String(raw ?? '')
    .trim()
    .replace(/^จ(ังหวัด|\.)\s*/u, '');
  if (!s) return null;
  if (/^(กทม\.?|กรุงเทพ(ฯ|มหานคร)?|bangkok)$/iu.test(s)) return 'กรุงเทพมหานคร';
  return canonProvinceName(s);
}

export function regionOfProvince(raw: string | null | undefined): ThaiRegion | null {
  const p = canonProvince(raw);
  return p ? (REGION_OF.get(p) ?? null) : null;
}

/** อำเภอ/เขตแบบเทียบได้ ("เขตดินแดง" "อ.บ้านบึง" → "ดินแดง" "บ้านบึง") */
export function canonDistrict(raw: string | null | undefined): string | null {
  const s = stripDistrictPrefix(String(raw ?? '')).replace(/\s+/g, '');
  return s || null;
}

export type AreaRank = 0 | 1 | 2 | 3 | 4;

export const AREA_RANK_LABEL: Record<AreaRank, string> = {
  0: 'อำเภอเดียวกับงาน',
  1: 'จังหวัดเดียวกับงาน',
  2: 'ภาคเดียวกับงาน',
  3: 'ไม่มีที่อยู่',
  4: 'คนละภาคกับงาน',
};

export type JobArea = { province: string | null; district: string | null };

/** ที่ตั้งงานของใบขอ — ค่าที่เจ้าหน้าที่แก้เองมาก่อน (override) แล้วค่อยแยกจากที่อยู่ ERP */
export function jobAreaOf(job: {
  override_province?: string | null;
  override_district?: string | null;
  location_address?: string | null;
}): JobArea {
  const address = String(job.location_address ?? '');
  const parts = address ? parseThaiAddressParts(address) : null;
  return {
    province: canonProvince(job.override_province) ?? canonProvince(parts?.province ?? inferProvinceFromAddress(address)),
    district: canonDistrict(job.override_district ?? parts?.district ?? null),
  };
}

/** คนนี้อยู่ใกล้งานแค่ไหน — งานไม่รู้จังหวัด = ทุกคน 3 (เรียงไม่ได้ ไม่ลงโทษใคร) */
export function areaRankOf(job: JobArea, candidate: { province_name?: string | null; amphur_name?: string | null }): AreaRank {
  const cp = canonProvince(candidate.province_name);
  if (!cp) return 3;
  if (!job.province) return 3;
  if (cp === job.province) {
    const cd = canonDistrict(candidate.amphur_name);
    return cd && job.district && cd === job.district ? 0 : 1;
  }
  const jr = REGION_OF.get(job.province);
  const cr = REGION_OF.get(cp);
  return jr && cr && jr === cr ? 2 : 4;
}

/** เพศที่ใบขอต้องการ ('ชาย'/'หญิง') · ไม่ระบุ = null */
function requiredGender(raw: unknown): 'M' | 'F' | null {
  const s = String(raw ?? '').trim();
  if (/^(ชาย|male|m)$/iu.test(s) || (s.includes('ชาย') && !s.includes('หญิง'))) return 'M';
  if (/^(หญิง|female|f)$/iu.test(s) || (s.includes('หญิง') && !s.includes('ชาย'))) return 'F';
  return null;
}

function candidateGender(raw: unknown): 'M' | 'F' | null {
  const s = String(raw ?? '').trim().toLowerCase();
  if (['m', 'male', 'ชาย'].includes(s)) return 'M';
  if (['f', 'female', 'หญิง'].includes(s)) return 'F';
  return null;
}

export type MatchGateJob = { gender_requirement?: unknown; age_range_min?: unknown; age_range_max?: unknown };

/**
 * ตัดก่อนส่ง AI: เพศ/อายุที่ **รู้ค่า** และผิดเงื่อนไขใบขอ · ไม่รู้ค่า = ผ่าน (ให้คนเช็กเอง ไม่ตัดทิ้งเงียบ ๆ)
 * คืนเหตุเป็นคำ (ไว้นับใน log ว่าตัดเพราะอะไร)
 */
export function matchGate(job: MatchGateJob, c: { sex_code?: unknown; age?: unknown }): { ok: true } | { ok: false; reason: 'gender' | 'age' } {
  const need = requiredGender(job.gender_requirement);
  const has = candidateGender(c.sex_code);
  if (need && has && need !== has) return { ok: false, reason: 'gender' };
  const age = Number(c.age);
  if (Number.isFinite(age) && age > 0) {
    const min = Number(job.age_range_min);
    const max = Number(job.age_range_max);
    if (Number.isFinite(min) && min > 0 && age < min) return { ok: false, reason: 'age' };
    if (Number.isFinite(max) && max > 0 && age > max) return { ok: false, reason: 'age' };
  }
  return { ok: true };
}

/** เพศที่ใบขอต้องการเป็นคำ (ใส่ใน prompt) · ไม่ระบุ = null */
export function requiredGenderLabel(raw: unknown): string | null {
  const g = requiredGender(raw);
  return g === 'M' ? 'ชาย' : g === 'F' ? 'หญิง' : null;
}

/**
 * เรียงก่อนตัด shortlist: คนที่สกิลมีคำตรง → ใกล้งานก่อน → คะแนนสกิล → ลำดับเดิม (ความเคลื่อนไหวล่าสุด)
 * ตัดคนที่เพศ/อายุรู้ค่าและผิดเงื่อนไขทิ้งก่อน (`matchGate`)
 */
export function orderPoolForShortlist<T extends { sex_code?: unknown; age?: unknown; province_name?: string | null; amphur_name?: string | null }>(
  job: MatchGateJob,
  area: JobArea,
  pool: T[],
  score: (c: T) => number,
): { scored: Array<{ c: T; s: number; a: AreaRank }>; gatedOut: { gender: number; age: number } } {
  const gatedOut = { gender: 0, age: 0 };
  const kept: Array<{ c: T; s: number; a: AreaRank; i: number }> = [];
  pool.forEach((c, i) => {
    const g = matchGate(job, c);
    if ('reason' in g) {
      gatedOut[g.reason] += 1;
      return;
    }
    kept.push({ c, s: score(c), a: areaRankOf(area, c), i });
  });
  kept.sort((x, y) => Number(y.s > 0) - Number(x.s > 0) || x.a - y.a || y.s - x.s || x.i - y.i);
  return { scored: kept.map(({ c, s, a }) => ({ c, s, a })), gatedOut };
}
