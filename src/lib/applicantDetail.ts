/**
 * ═══ ป๊อป "รายละเอียดผู้สมัคร" แบบรูป iRecruit (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ปุ่มดูรายละเอียด ต้องได้รายละเอียดแบบรูปที่ส่งให้"* — ขั้นตอนการดำเนินการ 3 ขั้น
 * (การติดต่อ · การนัดหมาย · การติดตามนัด) + แท็บ ข้อมูลผู้สมัคร / ประวัติการสมัคร / การโทร /
 * การติดต่อ / การนัดหมาย / ติดตามนัดหมาย + บันทึก/ปิด · ก้อน "ยกเลิกข้อมูลผู้สมัคร" ยังไม่ทำ (Choice)
 *
 * ตรรกะล้วน (ไม่แตะ DB/fetch) — หน้าจออยู่ที่ `ApplicantContactDialog.tsx`
 * ⚠️ คำบนแถวผลโทรใช้ป้ายกลางเดิม (`CALL_OUTCOME_LABEL` / `CALL_RESULT_LABEL` / `ATTENDANCE_LABEL`) ห้ามตั้งใหม่
 */
import type {
  ApplicantAiCall,
  ApplicantStaffCall,
  AttendanceLogItem,
  PublicApplication,
} from './publicApplicationsApi';
import type { ContactLog } from './applicationContactsApi';
import { CALL_OUTCOME_LABEL } from './callOutcomeTone';
import { CALL_RESULT_LABEL } from './callHoldsApi';
import { ATTENDANCE_LABEL, type AttendanceResult } from './appointmentAttendance';

export type ContactChoice = 'ok' | 'fail';
/** ขั้น 3 — สำเร็จ = มาตามนัด · ไม่สำเร็จ = ไม่มา หรือ เลื่อนนัด (ค่าที่เก็บจริงยังเป็น 3 คำเดิม) */
export type FollowUpChoice = AttendanceResult;

export const DETAIL_TABS = [
  { value: 'info', label: 'ข้อมูลผู้สมัคร' },
  { value: 'history', label: 'ประวัติการสมัคร' },
  { value: 'calls', label: 'การโทร' },
  { value: 'contacts', label: 'การติดต่อ' },
  { value: 'appointments', label: 'การนัดหมาย' },
  { value: 'attendance', label: 'ติดตามนัดหมาย' },
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number]['value'];

export const PROCESS_STEPS = [
  { no: 1, title: 'การติดต่อ', hint: 'เลือกผลการติดต่อผู้สมัคร' },
  // วันนัดเก็บเป็น "วัน" (ระบบตั้งเที่ยงวันไทยให้) ไม่มีเวลา — คำใต้หัวข้อต้องไม่สัญญาว่าตั้งเวลาได้
  { no: 2, title: 'การนัดหมาย', hint: 'กำหนดวันและสถานที่นัดหมาย' },
  { no: 3, title: 'การติดตามนัด', hint: 'บันทึกผลการติดตามนัดหมาย' },
] as const;

/** ผลติดต่อล่าสุดของใบ (ขั้น 1 ที่ติ๊กไว้ตอนเปิดป๊อป) */
export function contactChoiceOf(a: Pick<PublicApplication, 'last_contact_ok'>): ContactChoice | null {
  if (a.last_contact_ok === true) return 'ok';
  if (a.last_contact_ok === false) return 'fail';
  return null;
}

/** ผลติดตามนัดล่าสุด (ขั้น 3) */
export function followUpChoiceOf(a: Pick<PublicApplication, 'attendance_result'>): FollowUpChoice | null {
  const r = a.attendance_result;
  return r === 'showed' || r === 'no_show' || r === 'rescheduled' ? r : null;
}

/** ขั้น 3 ฝั่งไหน — สำเร็จ / ไม่สำเร็จ */
export function followUpSide(v: FollowUpChoice | null): 'ok' | 'fail' | null {
  if (!v) return null;
  return v === 'showed' ? 'ok' : 'fail';
}

export const FOLLOW_UP_FAIL_OPTIONS: ReadonlyArray<{ value: FollowUpChoice; label: string }> = [
  { value: 'no_show', label: ATTENDANCE_LABEL.no_show },
  { value: 'rescheduled', label: ATTENDANCE_LABEL.rescheduled },
];

/** หนึ่งแถวในแท็บการโทร — รวมสาย AI + สายที่คนถือไปโทร เรียงล่าสุดก่อน */
export type DetailCallRow = {
  key: string;
  at: string;
  who: string;
  result: string;
  note: string | null;
};

const AI_STATUS_LABEL: Record<string, string> = {
  pending: 'รอ AI โทร',
  delivered: 'ส่งให้ AI แล้ว รอผล',
  completed: 'AI โทรแล้ว',
  failed: 'ส่งให้ AI ไม่สำเร็จ',
  cancelled: 'ยกเลิก',
};

export function detailCallRows(aiCalls: readonly ApplicantAiCall[], staffCalls: readonly ApplicantStaffCall[]): DetailCallRow[] {
  const rows: DetailCallRow[] = [];
  for (const c of aiCalls) {
    const label = c.outcome ? (CALL_OUTCOME_LABEL as Record<string, string>)[c.outcome] ?? c.outcome : null;
    rows.push({
      key: `ai-${c.id}`,
      at: c.result_at ?? c.created_at,
      who: 'AI',
      result: label ?? AI_STATUS_LABEL[c.status] ?? c.status,
      note: c.attempts > 1 ? `โทรครั้งที่ ${c.attempts}` : null,
    });
  }
  for (const c of staffCalls) {
    const label = c.outcome ? (CALL_RESULT_LABEL as Record<string, string>)[c.outcome] ?? c.outcome : null;
    rows.push({
      key: `staff-${c.id}`,
      at: c.held_at,
      who: c.held_by_name || 'เจ้าหน้าที่',
      result: label ?? (c.released_at ? 'คืนงานโดยไม่บันทึกผล' : 'ถือไว้โทรอยู่'),
      note: c.note,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/** แท็บการนัดหมาย — เฉพาะครั้งที่ติดต่อแล้วนัดได้ (ล่าสุดก่อน ตามลำดับที่ API ส่งมา) */
export function appointmentLogs(logs: readonly ContactLog[]): ContactLog[] {
  return logs.filter((l) => Boolean(l.appointmentAt));
}

/** ผลติดตามนัดบนแถว */
export function attendanceLabel(l: Pick<AttendanceLogItem, 'result'>): string {
  return ATTENDANCE_LABEL[l.result] ?? l.result;
}
