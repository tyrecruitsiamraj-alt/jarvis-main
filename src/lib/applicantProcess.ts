/**
 * ═══ ขั้นตอน + สถานะของใบสมัคร — แบบ iRecruit (เจ้าของ 4 ต.ค. 2569) ═══
 * เจ้าของเทียบหน้าผู้สมัครกับ iRecruit: *"เอาสถานะมาเพิ่มพอ · เอาตัวกรองที่ขาดมาเสริม"*
 *
 * iRecruit มี 3 ขั้น (การติดต่อ → การนัดหมาย → ติดตามการนัดหมาย) × 3 สถานะ (รอดำเนินการ · สำเร็จ · ไม่สำเร็จ)
 * และ "สถานะการติดต่อ" (ยังไม่โทร · โทรแล้ว · นัดสัมภาษณ์แล้ว) · คิดจากของที่ป๊อปรายละเอียดบันทึกอยู่แล้ว
 * (ตัวเดียวกับขั้น 1-2-3 ในป๊อป — `applicantDetail.ts`) ไม่มีช่องใหม่ในฐาน:
 *   ผลติดตามนัด (089) → ขั้นติดตามนัด สำเร็จ (มา) / ไม่สำเร็จ (ไม่มา·เลื่อน)
 *   มีวันนัด → ขั้นติดตามนัด รอดำเนินการ
 *   ติดต่อสำเร็จ (086) → ขั้นนัดหมาย รอดำเนินการ · ติดต่อไม่สำเร็จ → ขั้นติดต่อ ไม่สำเร็จ
 *   ยังไม่มีอะไร → ขั้นติดต่อ รอดำเนินการ
 */
import type { PublicApplication } from '@/lib/publicApplicationsApi';

export type ProcessStep = 'contact' | 'appointment' | 'follow';
export type ProcessState = 'pending' | 'ok' | 'fail';
export type ContactState = 'not_called' | 'called' | 'appointed';

export const PROCESS_STEP_LABEL: Record<ProcessStep, string> = {
  contact: 'การติดต่อ',
  appointment: 'นัดหมาย',
  follow: 'ติดตามการนัดหมาย',
};
export const PROCESS_STATE_LABEL: Record<ProcessState, string> = {
  pending: 'รอดำเนินการ',
  ok: 'สำเร็จ',
  fail: 'ไม่สำเร็จ',
};
/** สีที่มีความหมาย — เหลือง = รอ · เขียว = สำเร็จ · แดง = ไม่สำเร็จ */
export const PROCESS_STATE_TONE: Record<ProcessState, 'warn' | 'success' | 'danger'> = {
  pending: 'warn',
  ok: 'success',
  fail: 'danger',
};
export const CONTACT_STATE_LABEL: Record<ContactState, string> = {
  not_called: 'ยังไม่โทร',
  called: 'โทรแล้ว',
  appointed: 'นัดสัมภาษณ์แล้ว',
};

type ProcessSource = Pick<
  PublicApplication,
  'attendance_result' | 'appointment_at' | 'last_contact_ok' | 'last_appointment_failed' | 'last_call_outcome' | 'dial_count' | 'last_call_status' | 'ai_answer'
>;

export function applicantProcessOf(r: ProcessSource): { step: ProcessStep; state: ProcessState } {
  if (r.attendance_result === 'showed') return { step: 'follow', state: 'ok' };
  if (r.attendance_result === 'no_show' || r.attendance_result === 'rescheduled') return { step: 'follow', state: 'fail' };
  if (r.appointment_at) return { step: 'follow', state: 'pending' };
  if (r.last_contact_ok === true && r.last_appointment_failed === true) return { step: 'appointment', state: 'fail' };
  if (r.last_contact_ok === true) return { step: 'appointment', state: 'pending' };
  if (r.last_contact_ok === false) return { step: 'contact', state: 'fail' };
  return { step: 'contact', state: 'pending' };
}

export function applicantContactStateOf(r: ProcessSource): ContactState {
  if (r.appointment_at) return 'appointed';
  if (
    r.last_call_outcome ||
    typeof r.last_contact_ok === 'boolean' ||
    (r.dial_count ?? 0) > 0 ||
    r.ai_answer ||
    r.last_call_status === 'completed' ||
    r.last_call_status === 'failed'
  ) {
    return 'called';
  }
  return 'not_called';
}
