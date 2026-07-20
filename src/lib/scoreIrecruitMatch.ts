// ให้คะแนนผู้สมัคร iRecruit ตามเกณฑ์ใบขอ (เพศ / อายุ) + ความใกล้พื้นที่
// ใช้ต่อจากผลแมทสกิลเบื้องต้น (iRecruit) — ไม่เรียก AI เพิ่ม

export type CriterionVerdict = 'pass' | 'fail' | 'na';

export type JobCriteria = {
  gender_requirement?: string | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
};

export type ScorableMatch = {
  sex?: string | null;
  age?: number | null;
};

export type MatchCriteriaScore = {
  /** คะแนนรวม 0–100 (normalize เฉพาะเกณฑ์ที่ใบขอระบุ) */
  percent: number;
  gender: CriterionVerdict;
  age: CriterionVerdict;
  /** 0=ใกล้สุด … 4=ไกล */
  areaRank: number;
  areaLabel: string;
};

/** น้ำหนักคะแนนแต่ละเกณฑ์ */
const WEIGHT_AREA = 40;
const WEIGHT_GENDER = 30;
const WEIGHT_AGE = 30;

/** คะแนนพื้นที่ตาม proximity rank (0 ใกล้สุด … 4 ไกล) */
const AREA_SCORE_BY_RANK = [40, 30, 20, 10, 0];

function norm(v: string | null | undefined): string {
  return (v || '').trim().toLowerCase();
}

/** เพศผู้สมัครตรงกับที่ใบขอระบุไหม — 'na' ถ้าใบขอไม่ระบุ หรือไม่รู้เพศผู้สมัคร */
export function genderVerdict(job: JobCriteria, sex: string | null | undefined): CriterionVerdict {
  const req = norm(job.gender_requirement);
  const s = norm(sex);
  if (!req || req === 'ไม่ระบุ') return 'na';
  if (!s) return 'na';
  if (req === 'ชาย') return s === 'm' || s === 'male' || s === 'ชาย' ? 'pass' : 'fail';
  if (req === 'หญิง') return s === 'f' || s === 'female' || s === 'หญิง' ? 'pass' : 'fail';
  return 'na';
}

/** อายุผู้สมัครเข้าช่วงที่ใบขอระบุไหม — 'na' ถ้าใบขอไม่ระบุช่วง หรือไม่รู้อายุ */
export function ageVerdict(job: JobCriteria, age: number | null | undefined): CriterionVerdict {
  const min = typeof job.age_range_min === 'number' ? job.age_range_min : null;
  const max = typeof job.age_range_max === 'number' ? job.age_range_max : null;
  if (min == null && max == null) return 'na';
  if (typeof age !== 'number' || !Number.isFinite(age)) return 'na';
  if (min != null && age < min) return 'fail';
  if (max != null && age > max) return 'fail';
  return 'pass';
}

/**
 * รวมคะแนน: พื้นที่ (ตาม rank) + เพศ + อายุ แล้ว normalize ตามเกณฑ์ที่ใบขอระบุจริง
 * เกณฑ์ที่ใบขอไม่ระบุ (na) จะไม่ถูกนับทั้งตัวตั้งและตัวหาร
 */
export function scoreMatch(
  match: ScorableMatch,
  job: JobCriteria,
  area: { rank: number; reason: string },
): MatchCriteriaScore {
  const gender = genderVerdict(job, match.sex);
  const age = ageVerdict(job, match.age);

  const rank = Math.max(0, Math.min(4, Math.round(area.rank)));
  let earned = AREA_SCORE_BY_RANK[rank];
  let total = WEIGHT_AREA;

  if (gender !== 'na') {
    total += WEIGHT_GENDER;
    if (gender === 'pass') earned += WEIGHT_GENDER;
  }
  if (age !== 'na') {
    total += WEIGHT_AGE;
    if (age === 'pass') earned += WEIGHT_AGE;
  }

  const percent = total > 0 ? Math.round((earned / total) * 100) : 0;
  return { percent, gender, age, areaRank: rank, areaLabel: area.reason };
}

function verdictLabel(v: CriterionVerdict): string {
  if (v === 'pass') return 'ตรงเกณฑ์';
  if (v === 'fail') return 'ไม่ตรงเกณฑ์';
  return 'ไม่นับ (ใบขอไม่ระบุ / ไม่มีข้อมูล)';
}

/** ข้อความอธิบายองค์ประกอบคะแนน % — ใช้โชว์ตอนชี้เมาส์ที่สกอร์ */
export function describeScoreBreakdown(score: MatchCriteriaScore): string[] {
  const areaPts = AREA_SCORE_BY_RANK[Math.max(0, Math.min(4, score.areaRank))] ?? 0;
  const lines = [
    `คะแนนรวม ${score.percent}%`,
    `พื้นที่ (${areaPts}/${WEIGHT_AREA}): ${score.areaLabel}`,
  ];
  if (score.gender !== 'na') {
    lines.push(
      `เพศ (${score.gender === 'pass' ? WEIGHT_GENDER : 0}/${WEIGHT_GENDER}): ${verdictLabel(score.gender)}`,
    );
  } else {
    lines.push(`เพศ: ${verdictLabel('na')}`);
  }
  if (score.age !== 'na') {
    lines.push(
      `อายุ (${score.age === 'pass' ? WEIGHT_AGE : 0}/${WEIGHT_AGE}): ${verdictLabel(score.age)}`,
    );
  } else {
    lines.push(`อายุ: ${verdictLabel('na')}`);
  }
  return lines;
}
