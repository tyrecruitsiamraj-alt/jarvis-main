/**
 * ═══ แท็บ "การนัดหมาย" ในป๊อปผู้สมัคร = ประวัตินัดหมายข้ามทุกใบของคนนี้ (เจ้าของเคาะ 24 พ.ย. 2569) ═══
 * > *"บันทึกไว้ด้วยว่าเคยนัดไปลงหน่วยงานไหนมาก่อน แล้วจบที่อะไร เพื่อที่คนอื่นมาโทรจะได้ไม่เสนองานเดิม"*
 * แถว = นัดสำเร็จทุกใบ (server `loadAppointmentHistory`) + นัดหมายไม่สำเร็จของใบนี้ (บันทึกการติดต่อของใบนี้ · ของเดิมห้ามหาย)
 * ผล = ผ่าน/ไม่ผ่าน ก่อน → มา/ไม่มา/เลื่อนนัด → ยังไม่ลงผล = "รอผล" · คำจาก ATTENDANCE_LABEL / SCREENING_LABEL ที่เดียว
 * ตรรกะล้วน — เทสต์ `tests/api/appointmentHistory2569-11-24.test.ts`
 */
import { ATTENDANCE_LABEL, isAttendanceResult } from './appointmentAttendance';
import { SCREENING_LABEL } from './appointmentScreening';
import type { ContactLog } from './applicationContactsApi';
import { isAppointmentFailedContact } from './applicantDetail';

export type ApplicantAppointmentHistoryItem = {
  id: string;
  application_id: string;
  appointment_at: string;
  place: string | null;
  unit_name: string | null;
  job_title: string | null;
  job_label: string | null;
  by_name: string | null;
  created_at: string;
  attendance: string | null;
  screening: string | null;
  is_current: boolean;
};

export type AppointmentOutcomeTone = 'success' | 'danger' | 'warn' | 'neutral';
export type AppointmentHistoryRow = {
  key: string;
  /** null = นัดหมายไม่สำเร็จ (ไม่มีวันนัด) */
  at: string | null;
  /** ลงหน่วยงาน — หน่วยงานของใบ · ตำแหน่ง */
  unit: string | null;
  place: string | null;
  outcome: string;
  tone: AppointmentOutcomeTone;
  /** เหตุผลของนัดหมายไม่สำเร็จ */
  reason: string | null;
  byName: string | null;
  createdAt: string;
  isCurrent: boolean;
};

export const APPOINTMENT_PENDING_LABEL = 'รอผล';
export const APPOINTMENT_FAILED_LABEL = 'นัดหมายไม่สำเร็จ';

export function appointmentOutcome(attendance: string | null, screening: string | null): { label: string; tone: AppointmentOutcomeTone } {
  if (screening === 'passed' || screening === 'not_passed') {
    return { label: SCREENING_LABEL[screening], tone: screening === 'passed' ? 'success' : 'danger' };
  }
  if (attendance && isAttendanceResult(attendance)) {
    return {
      label: ATTENDANCE_LABEL[attendance],
      tone: attendance === 'showed' ? 'success' : attendance === 'no_show' ? 'danger' : 'warn',
    };
  }
  return { label: APPOINTMENT_PENDING_LABEL, tone: 'neutral' };
}

const unitOf = (h: Pick<ApplicantAppointmentHistoryItem, 'unit_name' | 'job_title' | 'job_label'>): string | null =>
  [h.unit_name, h.job_title].filter(Boolean).join(' · ') || h.job_label || null;

export function buildAppointmentHistory(
  items: readonly ApplicantAppointmentHistoryItem[],
  currentLogs: readonly ContactLog[],
): AppointmentHistoryRow[] {
  const rows: AppointmentHistoryRow[] = items.map((h) => {
    const o = appointmentOutcome(h.attendance, h.screening);
    return {
      key: `appt-${h.id}`,
      at: h.appointment_at,
      unit: unitOf(h),
      place: h.place,
      outcome: o.label,
      tone: o.tone,
      reason: null,
      byName: h.by_name,
      createdAt: h.created_at,
      isCurrent: h.is_current,
    };
  });
  for (const l of currentLogs) {
    if (!isAppointmentFailedContact(l)) continue;
    rows.push({
      key: `fail-${l.id}`,
      at: null,
      unit: l.jobLabel,
      place: null,
      outcome: APPOINTMENT_FAILED_LABEL,
      tone: 'danger',
      reason: l.reasonLabel,
      byName: l.createdByName,
      createdAt: l.createdAt,
      isCurrent: true,
    });
  }
  return rows.sort((a, b) => Date.parse(b.at ?? b.createdAt) - Date.parse(a.at ?? a.createdAt));
}
