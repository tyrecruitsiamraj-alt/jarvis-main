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

/**
 * หมายเหตุแหล่งข้อมูลต่อเกณฑ์ — โชว์ในหน้าตั้งค่า กันตั้งน้ำหนักแล้วงงว่าทำไมไม่ขยับ
 * สองเกณฑ์นี้ไม่มีในบอร์ด iRecruit ต้องให้เจ้าหน้าที่คัดกรองบันทึกเองที่หน้า Matching
 */
export const PRIORITY_DATA_NOTE: Partial<Record<PriorityCriterion, string>> = {
  lifestyle: 'บอร์ด iRecruit ไม่มีข้อมูลนี้ — มีผลเมื่อเจ้าหน้าที่บันทึกผลคัดกรองรายคน',
  criminalRecord: 'บอร์ด iRecruit ไม่มีข้อมูลนี้ — มีผลเมื่อเจ้าหน้าที่บันทึกผลคัดกรองรายคน',
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

// ── ผลคัดกรองที่ Jarvis เก็บเอง → verdict ─────────────────────────────────────

/** ยังไม่ได้ถาม = unknown (ต่างจาก 'no' ที่ยืนยันแล้วว่าไม่) */
export type ScreeningAnswer = 'yes' | 'no' | 'unknown';

export type CandidateScreening = {
  drinking: ScreeningAnswer;
  smoking: ScreeningAnswer;
  criminalRecord: ScreeningAnswer;
};

export function isScreeningAnswer(v: unknown): v is ScreeningAnswer {
  return v === 'yes' || v === 'no' || v === 'unknown';
}

export const EMPTY_SCREENING: CandidateScreening = {
  drinking: 'unknown',
  smoking: 'unknown',
  criminalRecord: 'unknown',
};

/**
 * เหล้า/บุหรี่ → verdict — **นิยามอยู่ที่นี่ที่เดียว ถ้าเจ้าของอยากปรับให้แก้ฟังก์ชันนี้**
 *
 *   ไม่ดื่ม + ไม่สูบ        → pass
 *   ดื่มหรือสูบ อย่างใดอย่างหนึ่ง → warn
 *   ทั้งดื่มและสูบ            → fail
 *   ไม่รู้ทั้งคู่              → unknown (ไม่ถูกนับ)
 *
 * เกณฑ์นี้เป็น flexible ตามที่เจ้าของกำหนด — fail แค่ลดอันดับ **ไม่ตัดใครออกจากลิสต์**
 * (จะตัดออกได้ต้องใส่ 'lifestyle' ใน config.hard ซึ่งค่าเริ่มต้นไม่ได้ใส่)
 * ถ้ารู้ข้างเดียวก็ตัดสินจากข้างที่รู้ — ไม่ต้องรอให้ครบทั้งสองข้อ
 */
export function lifestyleVerdict(screening: Partial<CandidateScreening>): PriorityVerdict {
  const known = [screening.drinking, screening.smoking].filter(
    (v): v is 'yes' | 'no' => v === 'yes' || v === 'no',
  );
  if (known.length === 0) return 'unknown';
  const yes = known.filter((v) => v === 'yes').length;
  if (yes === 0) return 'pass';
  return yes >= 2 ? 'fail' : 'warn';
}

/**
 * ประวัติคดี → verdict — ไม่มีคดี = pass · มีคดี = fail · ยังไม่ได้ถาม = unknown
 *
 * เป็น flexible เหมือนกัน (fail = ลดอันดับ ไม่ตัดออก) เพราะเจ้าของบอกว่า "คุยกันได้"
 * รายละเอียดคดีที่เจ้าหน้าที่บันทึกไว้ (criminal_note) **ไม่ถูกเอามาคิดคะแนนอัตโนมัติ**
 * — ให้คนอ่านแล้วตัดสินเอง ไม่ให้โค้ดเดาความหนักเบาของคดี
 */
export function criminalRecordVerdict(screening: Partial<CandidateScreening>): PriorityVerdict {
  if (screening.criminalRecord === 'no') return 'pass';
  if (screening.criminalRecord === 'yes') return 'fail';
  return 'unknown';
}

/** รวมผลคัดกรองเป็นสองเกณฑ์ที่เอาไปต่อกับ scoreCandidatePriority ได้ตรง ๆ */
export function screeningVerdicts(
  screening: Partial<CandidateScreening> | null | undefined,
): Pick<PriorityInput, 'lifestyle' | 'criminalRecord'> {
  if (!screening) return {};
  return {
    lifestyle: lifestyleVerdict(screening),
    criminalRecord: criminalRecordVerdict(screening),
  };
}

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
