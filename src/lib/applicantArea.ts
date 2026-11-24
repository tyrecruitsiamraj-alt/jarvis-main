/**
 * ═══ ผู้สมัครอยู่ใกล้งานแค่ไหน — หน้าผู้สมัคร (เจ้าของ 24 พ.ย. 2569 Choice "ยังขึ้นในรายชื่อ แต่บอกว่าไกลแค่ไหน + คนใกล้ขึ้นก่อน") ═══
 * "สนใจ" มาจากคำตอบตอน AI โทรอย่างเดียว (บทถาม "งานนี้ทำที่ … สะดวกเดินทางไปทำงานไหมคะ" แล้ว) — คนไกลที่ตอบว่าสะดวกยังอยู่ในรายชื่อ
 * ระบบแค่บอกระดับความใกล้ + เรียงคนใกล้ก่อน ไม่ตัดใครทิ้ง
 * ความใกล้ = ตัวเดียวกับตัวจับคู่ (`areaRankOf`) · ที่ตั้งงาน: ใบขอ → `jobAreaOf` · กล่องลอย → จังหวัด/ที่อยู่ของประกาศ
 * 🔴 เทียบไม่ได้มีช่องของตัวเอง (ไม่รู้ที่ตั้งงาน · ไม่ได้กรอกที่อยู่) ไม่ยุบเป็นใกล้หรือไกล
 * ตรรกะล้วน — เทสต์ `tests/api/applicantArea2569-11-24.test.ts`
 */
import { canonDistrict, canonProvince, areaRankOf, jobAreaOf, type JobArea } from '@/lib/matchProximity';
import { parseThaiAddressParts } from '@/lib/parseThaiJobAddress';

export type ApplicantArea = 'district' | 'province' | 'region' | 'far' | 'noJobArea' | 'noHome';
/** ใกล้ → ไกล → เทียบไม่ได้ (ลำดับเรียงรายชื่อ + ลำดับในตัวกรอง) */
export const APPLICANT_AREA_ORDER: readonly ApplicantArea[] = ['district', 'province', 'region', 'far', 'noJobArea', 'noHome'];
/** คำบนจอ — 4 ระดับแรกตรงกับป้ายความใกล้ของหน้าจับคู่ (`AREA_RANK_LABEL`) */
export const APPLICANT_AREA_LABEL: Record<ApplicantArea, string> = {
  district: 'อำเภอเดียวกับงาน',
  province: 'จังหวัดเดียวกับงาน',
  region: 'ภาคเดียวกับงาน',
  far: 'คนละภาคกับงาน',
  noJobArea: 'ไม่รู้ที่ตั้งงาน',
  noHome: 'ไม่ได้กรอกที่อยู่',
};

/** ที่ตั้งงานของประกาศลอย — จังหวัดของประกาศ + อำเภอจากที่อยู่ของประกาศ */
export function postingAreaOf(p: { posting_province?: string | null; posting_location?: string | null }): JobArea {
  const parts = p.posting_location ? parseThaiAddressParts(p.posting_location) : null;
  return {
    province: canonProvince(p.posting_province) ?? canonProvince(parts?.province ?? null),
    district: canonDistrict(parts?.district ?? null),
  };
}

/**
 * ความใกล้ของผู้สมัครคนหนึ่ง · `jobOf` = ใบขอของใบสมัคร (ใบที่หน้าโหลดไว้ · ไม่เจอ = ดูจากประกาศลอยแทน)
 */
export function applicantAreaOf(
  r: { province?: string | null; district?: string | null; posting_province?: string | null; posting_location?: string | null },
  job: Parameters<typeof jobAreaOf>[0] | null | undefined,
): ApplicantArea {
  const area = job ? jobAreaOf(job) : postingAreaOf(r);
  if (!area.province) return 'noJobArea';
  if (!canonProvince(r.province)) return 'noHome';
  const rank = areaRankOf(area, { province_name: r.province, amphur_name: r.district });
  return rank === 0 ? 'district' : rank === 1 ? 'province' : rank === 2 ? 'region' : 'far';
}

/** เรียงคนใกล้ขึ้นก่อน — ระดับเดียวกันคงลำดับเดิม (เสถียร) */
export function sortByApplicantArea<T>(rows: readonly T[], areaOf: (r: T) => ApplicantArea): T[] {
  return rows
    .map((r, i) => ({ r, i, k: APPLICANT_AREA_ORDER.indexOf(areaOf(r)) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.r);
}
