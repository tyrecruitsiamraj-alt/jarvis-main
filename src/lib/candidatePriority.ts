/**
 * ลำดับความสำคัญในการเรียงผู้สมัครของหน้า Matching — เจ้าของกำหนด (ส.ค. 2026)
 *
 *   1. อายุ            (เกณฑ์แข็ง — ไม่เข้าช่วงของใบขอ ตกไปท้ายลิสต์)
 *   2. ที่อยู่          (เกณฑ์แข็ง — ยิ่งใกล้ยิ่งขึ้นก่อน)
 *   3. ประสบการณ์ทำงาน  (flexible — สายงานที่เคยทำตรงไหม ใช้ tier จาก AI แมทสกิล)
 *   4. ดื่มเหล้า/สูบบุหรี่ (flexible — ยังไม่มีข้อมูลจากบอร์ด iRecruit · โครงพร้อม เสียบได้ทันที)
 *   5. มีคดีไหม         (flexible — ยังไม่มีข้อมูลในระบบ · โครงพร้อม เสียบได้ทันที)
 *   6. รายได้ที่ขอ       (flexible — เกินงบใบขอไม่ตัดตก แค่ลดอันดับ)
 *
 * "flexible" = คุยกันได้ ไม่ตัดใครทิ้งจากลิสต์ แค่ขยับอันดับลง
 * เกณฑ์ที่ไม่มีข้อมูล (unknown) ไม่ถูกนับทั้งตัวตั้งและตัวหาร — คนข้อมูลไม่ครบไม่ถูกลงโทษ
 */

export type PriorityVerdict = 'pass' | 'warn' | 'fail' | 'unknown';

/** น้ำหนักไล่ตามลำดับความสำคัญของเจ้าของ — ใช้คิดคะแนน 0–100 */
export const PRIORITY_WEIGHTS = {
  age: 30,
  area: 25,
  experience: 20,
  lifestyle: 5,
  criminalRecord: 10,
  salary: 10,
} as const;

export type PriorityCriterion = keyof typeof PRIORITY_WEIGHTS;

/** ป้ายภาษาไทยตามที่เจ้าของเรียก */
export const PRIORITY_LABELS: Record<PriorityCriterion, string> = {
  age: 'อายุ',
  area: 'ที่อยู่',
  experience: 'ประสบการณ์',
  lifestyle: 'เหล้า/บุหรี่',
  criminalRecord: 'ประวัติคดี',
  salary: 'รายได้',
};

/** เกณฑ์แข็ง — fail แล้วตกไปท้ายลิสต์ ไม่ใช่แค่คะแนนลด */
const HARD_CRITERIA: PriorityCriterion[] = ['age', 'area'];

export type PriorityInput = Partial<Record<PriorityCriterion, PriorityVerdict>>;

export type CandidatePriorityScore = {
  /** 0–100 normalize เฉพาะเกณฑ์ที่มีข้อมูล */
  percent: number;
  /** จำนวนเกณฑ์แข็งที่ไม่ผ่าน — ใช้กดท้ายลิสต์ */
  hardFails: number;
  verdicts: Record<PriorityCriterion, PriorityVerdict>;
};

function pointsFor(verdict: PriorityVerdict, weight: number): number {
  if (verdict === 'pass') return weight;
  if (verdict === 'warn') return weight / 2;
  return 0;
}

export function scoreCandidatePriority(input: PriorityInput): CandidatePriorityScore {
  let earned = 0;
  let total = 0;
  let hardFails = 0;
  const verdicts = {} as Record<PriorityCriterion, PriorityVerdict>;

  for (const key of Object.keys(PRIORITY_WEIGHTS) as PriorityCriterion[]) {
    const verdict = input[key] ?? 'unknown';
    verdicts[key] = verdict;
    if (verdict === 'unknown') continue;
    const weight = PRIORITY_WEIGHTS[key];
    total += weight;
    earned += pointsFor(verdict, weight);
    if (verdict === 'fail' && HARD_CRITERIA.includes(key)) hardFails += 1;
  }

  return {
    percent: total > 0 ? Math.round((earned / total) * 100) : 0,
    hardFails,
    verdicts,
  };
}

/**
 * ตัวเรียงกลาง: เกณฑ์แข็งพังน้อยกว่าขึ้นก่อน → คะแนนรวมมากขึ้นก่อน
 * เสมอกันคงลำดับเดิม (เช่นลำดับจาก AI) — Array.prototype.sort ของ JS เป็น stable อยู่แล้ว
 */
export function compareCandidatePriority(
  a: CandidatePriorityScore,
  b: CandidatePriorityScore,
): number {
  if (a.hardFails !== b.hardFails) return a.hardFails - b.hardFails;
  return b.percent - a.percent;
}

/** บรรทัดอธิบายคะแนน — ใช้ใน tooltip ให้คนเข้าใจว่าเรียงจากอะไร */
export function describePriorityScore(score: CandidatePriorityScore): string[] {
  const lines = [`คะแนนตามลำดับความสำคัญ ${score.percent}%`];
  for (const key of Object.keys(PRIORITY_WEIGHTS) as PriorityCriterion[]) {
    const v = score.verdicts[key];
    if (v === 'unknown') continue;
    const w = PRIORITY_WEIGHTS[key];
    lines.push(
      `${PRIORITY_LABELS[key]} (${pointsFor(v, w)}/${w})${v === 'fail' && HARD_CRITERIA.includes(key) ? ' — เกณฑ์แข็ง ตกไปท้ายลิสต์' : ''}`,
    );
  }
  return lines;
}
