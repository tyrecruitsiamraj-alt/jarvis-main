/**
 * ผลการโทรดูแลหลังเริ่มงาน (เจ้าของ 10 ต.ค. 2569 · Choice "ทำงานปกติ · มีปัญหา · ลาออก · ติดต่อไม่ได้")
 * ใช้ร่วมทั้ง API (ตรวจค่า) และหน้าเว็บ (ป้าย/สี) — ตัวเดียว ไม่นิยามซ้ำสองที่
 */
export const AFTERCARE_RESULTS = ['working', 'issue', 'resigned', 'unreachable'] as const;
export type AftercareResult = (typeof AFTERCARE_RESULTS)[number];

export const AFTERCARE_RESULT_LABEL: Record<AftercareResult, string> = {
  working: 'ทำงานปกติ',
  issue: 'มีปัญหา',
  resigned: 'ลาออก',
  unreachable: 'ติดต่อไม่ได้',
};

/** สีตามความหมาย (คีย์ของ `TONE` ใน designTokens) — เขียว=ปกติ · เหลือง=มีปัญหา · แดง=ลาออก · เทา=ติดต่อไม่ได้ */
export const AFTERCARE_RESULT_TONE: Record<AftercareResult, 'success' | 'warn' | 'danger' | 'neutral'> = {
  working: 'success',
  issue: 'warn',
  resigned: 'danger',
  unreachable: 'neutral',
};

export function isAftercareResult(v: unknown): v is AftercareResult {
  return typeof v === 'string' && (AFTERCARE_RESULTS as readonly string[]).includes(v);
}

/**
 * คะแนน 3 หัวข้อ (155 · เจ้าของ 19 ต.ค. 2569 · Choice "เพิ่มสามหัวข้อ เก็บของเดิมด้วย")
 * บังคับเมื่อผล = ทำงานปกติ/มีปัญหา (คุยถึงตัว) · ติดต่อไม่ได้/ลาออก = ไม่มี
 */
export const AFTERCARE_SCORES = ['healthy', 'warning', 'high_risk'] as const;
export type AftercareScore = (typeof AFTERCARE_SCORES)[number];
export const AFTERCARE_SCORE_LABEL: Record<AftercareScore, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  high_risk: 'High Risk',
};
export const AFTERCARE_SCORE_TONE: Record<AftercareScore, 'success' | 'warn' | 'danger'> = {
  healthy: 'success',
  warning: 'warn',
  high_risk: 'danger',
};
export const AFTERCARE_SCORE_TOPICS = [
  { key: 'expectation', label: 'งานตรงกับที่คาดหวังหรือไม่', short: 'งานตรงที่คาด' },
  { key: 'supervisor', label: 'ได้รับการดูแลจากหัวหน้างานหรือไม่', short: 'หัวหน้าดูแล' },
  { key: 'escalation', label: 'หากมีปัญหารู้หรือไม่ต้องปรึกษาใคร', short: 'รู้ว่าปรึกษาใคร' },
] as const;
export type AftercareScoreKey = (typeof AFTERCARE_SCORE_TOPICS)[number]['key'];
export type AftercareScores = Record<AftercareScoreKey, AftercareScore | null>;

export function isAftercareScore(v: unknown): v is AftercareScore {
  return typeof v === 'string' && (AFTERCARE_SCORES as readonly string[]).includes(v);
}

/** ผลนี้ต้องให้คะแนน 3 หัวข้อไหม — คุยถึงตัวแล้วเท่านั้น */
export const aftercareResultNeedsScores = (r: AftercareResult): boolean => r === 'working' || r === 'issue';

/**
 * ผลเดิม (ทำงานปกติ / มีปัญหา) จากคะแนน 3 หัวข้อ (เจ้าของ 29 ต.ค. 2569 Choice "3 หัวข้อขึ้นทันทีที่กดลงผล")
 * ไม่ต้องกดเลือกผลก่อนแล้ว — Healthy ครบทุกหัวข้อ = ทำงานปกติ · มี Warning/High Risk สักหัวข้อ = มีปัญหา · ยังไม่ครบ = null
 */
export function aftercareResultFromScores(s: AftercareScores): 'working' | 'issue' | null {
  const v = [s.expectation, s.supervisor, s.escalation];
  if (v.some((x) => x === null)) return null;
  return v.every((x) => x === 'healthy') ? 'working' : 'issue';
}

/** ผลที่คุยไม่ได้ — ปุ่มแยกใต้ 3 หัวข้อ (ไม่มีคะแนน) */
export const AFTERCARE_NO_TALK_RESULTS = ['resigned', 'unreachable'] as const satisfies readonly AftercareResult[];

export type AftercareContact = {
  id: string;
  phone_e164: string;
  result: AftercareResult;
  note: string | null;
  expectation?: AftercareScore | null;
  supervisor?: AftercareScore | null;
  escalation?: AftercareScore | null;
  created_by_name: string | null;
  created_at: string;
};
