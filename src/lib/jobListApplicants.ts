/**
 * ═══ ยอดคนกรอกต่อใบบนหน้าใบขอ + ตัวกรอง "ยังไม่มีคนกรอก / มีคนกรอกแล้ว" (เจ้าของ 16 พ.ย. 2569) ═══
 * *"เพิ่มบอกให้หน่อยว่า มีรายชื่อคนกรอกเข้ามาเท่าไหร่บ้างของแต่ละใบ แล้วก็ให้มี Filter ดูได้ว่าใบไหนที่ยังไม่มีคน"*
 * ยอดตัวเดียวกับกล่องงาน — `/api/job-applications?counts=1` ผ่านตัวเทียบสองคีย์ (`jobKeyIndex`) ห้ามนับเองอีกที่
 * 🔴 ยังโหลดยอดไม่ได้ = null ห้ามยุบเป็น 0 (ใบจะไปโผล่ใน "ยังไม่มีคนกรอก" ทั้งที่มีคน)
 */
import { APPLICANT_FILTER_PARAM_PREFIX } from './applicantFilters';

export const APPLICANT_PRESENCE_FILTER_VALUES = ['none', 'some'] as const;
export type ApplicantPresenceFilter = (typeof APPLICANT_PRESENCE_FILTER_VALUES)[number];

export const APPLICANT_PRESENCE_FILTER_OPTIONS: Array<{ value: ApplicantPresenceFilter; label: string }> = [
  { value: 'none', label: 'ยังไม่มีคนกรอก' },
  { value: 'some', label: 'มีคนกรอกแล้ว' },
];

/** [] = ทั้งหมด · ยอดยังไม่รู้ (null) + เลือกตัวกรองไว้ = ไม่ผ่าน (ห้ามเดาว่าใบนั้นไม่มีคน) */
export function matchesApplicantPresenceFilter(
  count: number | null,
  filter: readonly ApplicantPresenceFilter[],
): boolean {
  if (filter.length === 0) return true;
  if (count == null) return false;
  return filter.includes(count > 0 ? 'some' : 'none');
}

/** กดเลขคนกรอก = แท็บรายชื่อผู้สมัครของใบนั้น (ทุกรายชื่อ) — ทางเดียวกับปุ่ม "ดูรายชื่อ" บนกล่องงาน */
export function applicantsListPathOfJob(jobKey: string): string {
  const p = new URLSearchParams({ view: 'list', list: 'all' });
  p.append(`${APPLICANT_FILTER_PARAM_PREFIX}job`, jobKey);
  return `/jobs/board?${p.toString()}`;
}
