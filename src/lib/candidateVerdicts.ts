/**
 * "ผู้สมัครคนนี้ตรงเกณฑ์ของใบขอไหม" — ตรรกะการตัดสินรายข้อ (ฟังก์ชันล้วน ไม่มี UI)
 *
 * แยกออกจาก MatchingPage.tsx ตอนแตกไฟล์ (เดิม 5,138 บรรทัด)
 * แยกจาก CandidateChecklist.tsx อีกชั้นเพราะ react-refresh ต้องการให้ไฟล์ component
 * export แต่ component เท่านั้น — ปนฟังก์ชันแล้ว hot reload ทำงานไม่เต็มที่
 */
import {
  scoreCandidatePriority,
  screeningVerdicts,
  type CandidatePriorityScore,
  type CandidateScreening,
  type PriorityConfig,
  type PriorityVerdict,
} from '@/lib/candidatePriority';
import type { BoardCandidateMatch } from '@/lib/boardCandidateTypes';
import type { JobRequest } from '@/types';
import { areaRankOf, jobAreaOf } from '@/lib/matchProximity';

export type CheckVerdict = 'pass' | 'warn' | 'fail' | 'unknown';

export function normText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase().replace(/\s+/g, '');
}

export function genderVerdict(
  required: string | null | undefined,
  actual: string | null | undefined,
): CheckVerdict {
  const req = normText(required);
  const value = normText(actual);
  if (!req || req === 'ไม่ระบุ' || !value) return 'unknown';
  const male = ['m', 'male', 'ชาย'].includes(value);
  const female = ['f', 'female', 'หญิง'].includes(value);
  if (req.includes('ชาย')) return male ? 'pass' : 'fail';
  if (req.includes('หญิง')) return female ? 'pass' : 'fail';
  return 'unknown';
}

export function ageVerdict(job: JobRequest, age: number | null | undefined): CheckVerdict {
  if (job.age_range_min == null && job.age_range_max == null) return 'unknown';
  if (age == null) return 'unknown';
  if (job.age_range_min != null && age < job.age_range_min) return 'fail';
  if (job.age_range_max != null && age > job.age_range_max) return 'fail';
  return 'pass';
}

/**
 * ที่อยู่ — `parts` = [อำเภอ/เขต, จังหวัด, ...] ของผู้สมัคร
 * 🔴 17 พ.ย. 2569 (เจ้าของ "match ไม่ตรงเลย"): เดิมเทียบข้อความดิบ ("กรุงเทพฯ" ≠ "กรุงเทพมหานคร") ได้แค่ผ่าน/เตือน ไม่เคยตก
 * และคนไม่มีที่อยู่ไม่ถูกนับ ⇒ ขึ้นนำคนที่อยู่ใกล้ · ตอนนี้ใช้ความใกล้ชุดเดียวกับตัวจับคู่ (`matchProximity`):
 * อำเภอ/จังหวัดเดียวกัน = ผ่าน · ภาคเดียวกัน = เตือน · ไม่มีที่อยู่ = เตือน · คนละภาค = ไม่ผ่าน
 * งานอ่านจังหวัดไม่ออก = ใช้การเทียบข้อความแบบเดิม
 */
export function areaVerdict(job: JobRequest, parts: Array<string | null | undefined>): CheckVerdict {
  const area = jobAreaOf(job);
  if (area.province) {
    const rank = areaRankOf(area, { amphur_name: parts[0] ?? null, province_name: parts[1] ?? null });
    return rank <= 1 ? 'pass' : rank === 4 ? 'fail' : 'warn';
  }
  const candidateParts = parts.map(normText).filter(Boolean);
  if (candidateParts.length === 0) return 'unknown';
  const jobArea = normText(`${job.location_address} ${job.unit_name}`);
  return candidateParts.some((part) => jobArea.includes(part)) ? 'pass' : 'warn';
}

export function salaryVerdict(job: JobRequest, salary: number | null | undefined): CheckVerdict {
  if (!salary || !job.total_income) return 'unknown';
  return salary <= job.total_income ? 'pass' : 'warn';
}

/**
 * คะแนนตามลำดับความสำคัญของเจ้าของ (อายุ → ที่อยู่ → ประสบการณ์ → เหล้า/บุหรี่ → คดี → รายได้)
 * ดู lib/candidatePriority — น้ำหนักตั้งได้ที่ Settings
 *
 * ประสบการณ์ = สายงานที่เคยทำตรงกับใบขอไหม ใช้ tier จาก AI แมทสกิล (เขียว=ตรง เหลือง=ใกล้ แดง=คนละสาย)
 * เหล้า/บุหรี่ กับ คดี ไม่มีในบอร์ด iRecruit — มาจากผลคัดกรองที่เจ้าหน้าที่บันทึกไว้ฝั่ง Jarvis
 * (ยังไม่บันทึก = unknown ซึ่งไม่ถูกนับทั้งตัวตั้งและตัวหาร คนที่ยังไม่ถูกคัดกรองจึงไม่เสียเปรียบ)
 */
export function boardCandidatePriority(
  job: JobRequest,
  m: BoardCandidateMatch,
  config: PriorityConfig,
  screening?: CandidateScreening | null,
): CandidatePriorityScore {
  return scoreCandidatePriority(
    {
      age: ageVerdict(job, m.age) as PriorityVerdict,
      area: areaVerdict(job, [m.amphur_name, m.province_name]) as PriorityVerdict,
      experience: m.tier === 'green' ? 'pass' : m.tier === 'yellow' ? 'warn' : 'fail',
      salary: salaryVerdict(job, m.required_salary) as PriorityVerdict,
      ...screeningVerdicts(screening),
    },
    config,
  );
}
