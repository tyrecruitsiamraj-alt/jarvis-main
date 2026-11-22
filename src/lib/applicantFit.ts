/**
 * ═══ คนที่ได้ตรงเกณฑ์ใบขอไหม (เจ้าของ 20 พ.ย. 2569 "คนที่ได้มาเป็นคนในพื้นที่ และ อายุเข้าเกณฑ์ไหม") ═══
 * พื้นที่ = ความใกล้ชุดเดียวกับตัวจับคู่ (`areaRankOf` — อำเภอเดียวกัน › จังหวัดเดียวกัน › ภาคเดียวกัน › คนละภาค)
 * อายุ / เพศ = ตัวตัดเดียวกับก่อนส่ง AI (`matchGate`) · เกณฑ์มาจากใบขอของใบสมัคร (`RecruitAppJob`)
 * 🔴 ค่าที่ตัดสินไม่ได้มีช่องของตัวเอง — ไม่ยุบเป็นผ่านหรือไม่ผ่าน · พื้นที่เทียบไม่ได้มี 4 เหตุ (ข้อมูลจริง 21 พ.ย. 2569 รวมกัน 45% ของรายชื่อ):
 *    ใบสมัครไม่ผูกใบขอ · ไม่มีรายละเอียดใบขอ (ใบไม่อยู่ในสำเนาใบขอ เช่น ปิดไปแล้ว/ใบขอชั่วคราว) · ใบขอไม่ระบุที่ตั้งงาน · ผู้สมัครไม่กรอกที่อยู่
 * ตรรกะล้วน — เทสต์ `applicantFit.test.ts`
 */
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';
import { AREA_RANK_LABEL, areaRankOf, canonProvince, matchGate } from '@/lib/matchProximity';

export type AreaFit = 'district' | 'province' | 'region' | 'far' | 'noJob' | 'noDetail' | 'noJobArea' | 'noHome';
/** เหตุที่เทียบพื้นที่ไม่ได้ — เรียงตามลำดับที่ตัดสิน (ฝั่งใบขอก่อน แล้วค่อยฝั่งผู้สมัคร) */
export const AREA_UNKNOWN: readonly AreaFit[] = ['noJob', 'noDetail', 'noJobArea', 'noHome'];
/** คำบนจอ — 4 ระดับแรกเป็นคำเดียวกับป้ายความใกล้ของหน้าจับคู่ */
export const AREA_FIT_LABEL: Record<AreaFit, string> = {
  district: AREA_RANK_LABEL[0],
  province: AREA_RANK_LABEL[1],
  region: AREA_RANK_LABEL[2],
  far: AREA_RANK_LABEL[4],
  noJob: 'ใบสมัครไม่ผูกใบขอ',
  noDetail: 'ไม่มีรายละเอียดใบขอ',
  noJobArea: 'ใบขอไม่ระบุที่ตั้งงาน',
  noHome: 'ผู้สมัครไม่กรอกที่อยู่',
};
/** เข้าเกณฑ์ · ไม่เข้า · ใบขอไม่กำหนด (หรือไม่รู้เกณฑ์ของใบ) · ไม่รู้ค่าของผู้สมัคร */
export type RuleFit = 'ok' | 'out' | 'noRule' | 'unknown';

type Job = Pick<RecruitAppJob, 'area' | 'ageMin' | 'ageMax' | 'gender'> | null | undefined;

/** ที่อยู่ที่ผู้สมัครกรอก เทียบกับที่ตั้งงานของใบขอ — `job` = ใบขอของใบสมัครนี้ (ไม่มี = ไม่มีรายละเอียดใบขอ) */
export function areaFitOf(f: Pick<RecruitAppFact, 'jobId' | 'homeProvince' | 'homeDistrict'>, job: Job): AreaFit {
  if (!f.jobId) return 'noJob';
  const area = job?.area;
  if (!area) return 'noDetail';
  if (!area.province) return 'noJobArea';
  if (!canonProvince(f.homeProvince)) return 'noHome';
  const rank = areaRankOf(area, { province_name: f.homeProvince, amphur_name: f.homeDistrict });
  return rank === 0 ? 'district' : rank === 1 ? 'province' : rank === 2 ? 'region' : 'far';
}

/** อายุที่กรอก เทียบกับช่วงอายุของใบขอ */
export function ageFitOf(f: Pick<RecruitAppFact, 'age'>, job: Job): RuleFit {
  if (!job || (job.ageMin == null && job.ageMax == null)) return 'noRule';
  if (f.age == null) return 'unknown';
  return matchGate({ age_range_min: job.ageMin, age_range_max: job.ageMax }, { age: f.age }).ok ? 'ok' : 'out';
}

/** เพศที่กรอก เทียบกับเพศที่ใบขอต้องการ */
export function genderFitOf(f: Pick<RecruitAppFact, 'gender'>, job: Job): RuleFit {
  if (!job?.gender) return 'noRule';
  if (f.gender !== 'male' && f.gender !== 'female') return 'unknown';
  return matchGate({ gender_requirement: job.gender }, { sex_code: f.gender }).ok ? 'ok' : 'out';
}
