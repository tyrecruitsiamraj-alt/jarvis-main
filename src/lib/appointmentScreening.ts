/**
 * ผล "ผ่าน / ไม่ผ่าน" หลังมาตามนัด (migration 151 · เจ้าของสั่ง 18 ต.ค. 2569) — ตรรกะล้วน
 * ใช้ทั้งปุ่มบนแท็บติดตามนัดหมายและด่านตรวจฝั่ง API (ฐานไม่มี CHECK — คุมที่นี่ที่เดียว)
 */
export type ScreeningResult = 'passed' | 'not_passed';

export const SCREENING_RESULTS: readonly ScreeningResult[] = ['passed', 'not_passed'];

export function isScreeningResult(v: unknown): v is ScreeningResult {
  return v === 'passed' || v === 'not_passed';
}

export const SCREENING_LABEL: Record<ScreeningResult, string> = {
  passed: 'ผ่าน',
  not_passed: 'ไม่ผ่าน',
};

export const SCREENING_TONE: Record<ScreeningResult, 'success' | 'danger'> = {
  passed: 'success',
  not_passed: 'danger',
};

/** ลงผลผ่าน/ไม่ผ่านได้เมื่อผลนัดล่าสุดคือ "มาตามนัด" เท่านั้น — ไม่มาก็ไม่มีอะไรให้ผ่าน */
export function canRecordScreening(attendanceResult: string | null | undefined): boolean {
  return attendanceResult === 'showed';
}
