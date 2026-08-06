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

export const PRIORITY_CRITERIA = Object.keys(PRIORITY_WEIGHTS) as PriorityCriterion[];

/** ชุดค่าที่ตั้งได้จากหน้า Settings — น้ำหนักต่อเกณฑ์ + เกณฑ์ไหนเป็น "เกณฑ์แข็ง" */
export type PriorityConfig = {
  weights: Record<PriorityCriterion, number>;
  /** เกณฑ์แข็ง = ไม่ผ่านแล้วตกไปท้ายลิสต์ ไม่ใช่แค่คะแนนลด */
  hard: PriorityCriterion[];
};

export const DEFAULT_PRIORITY_CONFIG: PriorityConfig = {
  weights: { ...PRIORITY_WEIGHTS },
  hard: ['age', 'area'],
};

/** เกณฑ์ที่ยังไม่มีข้อมูลในระบบ — โชว์ในหน้าตั้งค่า กันตั้งน้ำหนักแล้วงงว่าทำไมไม่ขยับ */
export const PRIORITY_DATA_NOTE: Partial<Record<PriorityCriterion, string>> = {
  lifestyle: 'ยังไม่มีข้อมูลจากบอร์ด iRecruit — ตั้งรอไว้ได้ จะมีผลเมื่อมีข้อมูล',
  criminalRecord: 'ยังไม่มีการเก็บข้อมูลนี้ในระบบ — ตั้งรอไว้ได้ จะมีผลเมื่อมีข้อมูล',
};

/** กันค่าจาก API/ผู้ใช้เพี้ยน — น้ำหนัก 0–100 · ถ้าเป็นศูนย์หมดถือว่าไม่ตั้ง ใช้ค่าเริ่มต้น */
export function normalizePriorityConfig(raw: unknown): PriorityConfig {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_PRIORITY_CONFIG;
  const obj = raw as { weights?: unknown; hard?: unknown };
  const weights = { ...DEFAULT_PRIORITY_CONFIG.weights };
  if (typeof obj.weights === 'object' && obj.weights !== null) {
    const src = obj.weights as Record<string, unknown>;
    for (const key of PRIORITY_CRITERIA) {
      const v = src[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        weights[key] = Math.max(0, Math.min(100, Math.round(v)));
      }
    }
  }
  if (PRIORITY_CRITERIA.every((k) => weights[k] === 0)) return DEFAULT_PRIORITY_CONFIG;
  const hard = Array.isArray(obj.hard)
    ? PRIORITY_CRITERIA.filter((k) => (obj.hard as unknown[]).includes(k))
    : DEFAULT_PRIORITY_CONFIG.hard;
  return { weights, hard };
}

/** ป้ายภาษาไทยตามที่เจ้าของเรียก */
export const PRIORITY_LABELS: Record<PriorityCriterion, string> = {
  age: 'อายุ',
  area: 'ที่อยู่',
  experience: 'ประสบการณ์',
  lifestyle: 'เหล้า/บุหรี่',
  criminalRecord: 'ประวัติคดี',
  salary: 'รายได้',
};

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

/** ไม่ส่ง config = ใช้ค่าเริ่มต้นในโค้ด (หน้า Matching ส่งค่าที่ตั้งไว้จาก Settings เข้ามา) */
export function scoreCandidatePriority(
  input: PriorityInput,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG,
): CandidatePriorityScore {
  let earned = 0;
  let total = 0;
  let hardFails = 0;
  const verdicts = {} as Record<PriorityCriterion, PriorityVerdict>;

  for (const key of PRIORITY_CRITERIA) {
    const verdict = input[key] ?? 'unknown';
    verdicts[key] = verdict;
    if (verdict === 'unknown') continue;
    const weight = config.weights[key] ?? 0;
    total += weight;
    earned += pointsFor(verdict, weight);
    if (verdict === 'fail' && config.hard.includes(key)) hardFails += 1;
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
export function describePriorityScore(
  score: CandidatePriorityScore,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG,
): string[] {
  const lines = [`คะแนนตามลำดับความสำคัญ ${score.percent}%`];
  for (const key of PRIORITY_CRITERIA) {
    const v = score.verdicts[key];
    if (v === 'unknown') continue;
    const w = config.weights[key] ?? 0;
    lines.push(
      `${PRIORITY_LABELS[key]} (${pointsFor(v, w)}/${w})${v === 'fail' && config.hard.includes(key) ? ' — เกณฑ์แข็ง ตกไปท้ายลิสต์' : ''}`,
    );
  }
  return lines;
}
