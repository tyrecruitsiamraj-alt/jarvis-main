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

export type AftercareContact = {
  id: string;
  phone_e164: string;
  result: AftercareResult;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
};
