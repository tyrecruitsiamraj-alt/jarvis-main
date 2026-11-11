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
  ApplicantDialCall,
  AttendanceLogItem,
  PublicApplication,
} from './publicApplicationsApi';
import type { ContactLog } from './applicationContactsApi';
import { CALL_OUTCOME_LABEL } from './callOutcomeTone';
import { CALL_RESULT_LABEL } from './callHoldsApi';
import { ATTENDANCE_LABEL, type AttendanceResult } from './appointmentAttendance';
import { CONNECTED_CALL_OUTCOMES } from './callOutcomeBuckets';
import { formatDateTimeTh } from './dateTh';

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
  // มีช่องเวลาแล้ว (21 ต.ค. 2569 · src/lib/appointmentTime.ts) — นัดเก่าก่อนวันนั้นมีแค่วัน
  { no: 2, title: 'การนัดหมาย', hint: 'กำหนดวัน เวลา และสถานที่นัดหมาย' },
  { no: 3, title: 'การติดตามนัด', hint: 'บันทึกผลการติดตามนัดหมาย' },
] as const;

/**
 * สถานที่นัดหมาย — ชุดเดียวกับ iRecruit (Journey ข้อ 5 · 4 ต.ค. 2569 · ระบบเดิมไม่มีหน้าตั้งค่าสถานที่ = รายการตายตัว)
 * "อื่นๆ" = พิมพ์ชื่อสถานที่เอง (ระบบเดิมเก็บแค่คำว่าอื่นๆ ซึ่งไม่บอกอะไร)
 */
export const APPOINTMENT_PLACE_OTHER = 'อื่นๆ';
export const APPOINTMENT_PLACES = [
  'บูธคู้บอน',
  'บูธศรีราชา',
  'บูธโลตัส ลาดพร้าว',
  'บูธโลตัส พระราม 3',
  'สำนักงานใหญ่',
  'BigC สุวินทวงศ์',
  'Online',
  APPOINTMENT_PLACE_OTHER,
] as const;

/** สถานที่ที่จะบันทึก — "อื่นๆ" ใช้คำที่พิมพ์ (ว่าง = null ให้ฟอร์มบังคับ) */
export function appointmentPlaceValue(picked: string, other: string): string | null {
  if (!picked) return null;
  if (picked !== APPOINTMENT_PLACE_OTHER) return picked;
  const t = other.trim();
  return t ? t : null;
}

/** แถวบันทึกติดต่อนี้คือ "ติดต่อสำเร็จ แต่นัดหมายไม่สำเร็จ" (ok + เหตุผล + ไม่มีวันนัด — กติกาเดียวกับ server) */
export function isAppointmentFailedContact(l: Pick<ContactLog, 'ok' | 'reasonLabel' | 'appointmentAt'>): boolean {
  return l.ok && Boolean(l.reasonLabel) && !l.appointmentAt;
}

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

/**
 * คอลัมน์ "ผล" ขึ้นต้นด้วย ติดต่อได้ / ติดต่อไม่ได้ เสมอ แล้วตามด้วยเหตุผล (เจ้าของ 11 พ.ย. 2569
 * "ผล ให้มันบอกว่าโทรสำเร็จหรือไม่ และบอกเหตุผลตามที่เลือก") · นิยาม "ติดต่อได้" = `CONNECTED_CALL_OUTCOMES` ตัวกลาง
 */
function reachedText(outcome: string, label: string): string {
  return `${(CONNECTED_CALL_OUTCOMES as readonly string[]).includes(outcome) ? 'ติดต่อได้' : 'ติดต่อไม่ได้'} · ${label}`;
}

/** ผลที่เจ้าหน้าที่ลงในขั้นการติดต่อ/นัดหมาย (บันทึกผลติดต่อ) เป็นคำเดียวกับปุ่มที่กด */
export function contactLogResultText(l: Pick<ContactLog, 'ok' | 'reasonLabel' | 'appointmentAt'>): string {
  if (!l.ok) return `ติดต่อไม่ได้ · ${l.reasonLabel || 'ไม่ระบุเหตุผล'}`;
  if (l.appointmentAt) return `ติดต่อได้ · นัดหมาย ${formatDateTimeTh(l.appointmentAt)}`;
  if (l.reasonLabel) return `ติดต่อได้ · นัดหมายไม่สำเร็จ · ${l.reasonLabel}`;
  return 'ติดต่อได้';
}

/** กดโทรแล้วลงผลภายในวันเดียวกัน = ผลของสายนั้น */
const DIAL_RESULT_WINDOW_MS = 24 * 3_600_000;

export function detailCallRows(
  aiCalls: readonly ApplicantAiCall[],
  staffCalls: readonly ApplicantStaffCall[],
  dialCalls: readonly ApplicantDialCall[] = [],
  contactLogs: readonly ContactLog[] = [],
): DetailCallRow[] {
  const rows: DetailCallRow[] = [];
  /**
   * กดปุ่มโทรทุกครั้ง (21 ต.ค. 2569 · แบบ iRecruit "โทรหาผู้สมัครโดย …") — ผลที่ลงทีหลังมาเติมในแถวเดียวกัน (11 พ.ย. 2569)
   * บันทึกผลแต่ละครั้งจับกับการกดโทรครั้งล่าสุดก่อนหน้า (ไม่เกิน 24 ชม.) · กดโทรแล้วยังไม่ลงผล = บอกตรง ๆ
   * บันทึกผลที่ไม่มีการกดโทรในระบบ (โทรจากมือถือเอง) = แถวของตัวเอง
   */
  const dials = [...dialCalls].sort((x, y) => x.at.localeCompare(y.at));
  const resultOfDial = new Map<string, ContactLog>();
  for (const l of [...contactLogs].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
    const t = Date.parse(l.createdAt);
    const dial = [...dials].reverse().find((d) => {
      const dt = Date.parse(d.at);
      return dt <= t && t - dt <= DIAL_RESULT_WINDOW_MS && !resultOfDial.has(String(d.id));
    });
    if (dial) resultOfDial.set(String(dial.id), l);
    else rows.push({ key: `log-${l.id}`, at: l.createdAt, who: l.createdByName || 'เจ้าหน้าที่', result: contactLogResultText(l), note: l.note });
  }
  for (const d of dials) {
    const l = resultOfDial.get(String(d.id));
    rows.push({
      key: `dial-${d.id}`,
      at: d.at,
      who: d.by_name || 'เจ้าหน้าที่',
      result: l ? contactLogResultText(l) : 'โทรหาผู้สมัคร · ยังไม่ลงผล',
      note: l?.note ?? null,
    });
  }
  for (const c of aiCalls) {
    const label = c.outcome ? (CALL_OUTCOME_LABEL as Record<string, string>)[c.outcome] ?? c.outcome : null;
    rows.push({
      key: `ai-${c.id}`,
      at: c.result_at ?? c.created_at,
      who: 'AI',
      result: c.outcome && label ? reachedText(c.outcome, label) : AI_STATUS_LABEL[c.status] ?? c.status,
      note: c.attempts > 1 ? `โทรครั้งที่ ${c.attempts}` : null,
    });
  }
  for (const c of staffCalls) {
    const label = c.outcome ? (CALL_RESULT_LABEL as Record<string, string>)[c.outcome] ?? c.outcome : null;
    rows.push({
      key: `staff-${c.id}`,
      at: c.held_at,
      who: c.held_by_name || 'เจ้าหน้าที่',
      result:
        c.outcome && label
          ? reachedText(c.outcome, label)
          : c.released_at
            ? (RELEASE_REASON_LABEL[c.release_reason ?? ''] ?? 'คืนงานโดยไม่บันทึกผล')
            : 'ถือไว้โทรอยู่',
      note: c.note,
    });
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * เหตุที่งานโทรหลุดจากมือโดยไม่ได้ลงผล (เจ้าของ 11 พ.ย. 2569 "คืนงานไม่บันทึกผล คืออะไร" → Choice "บอกเหตุจริง")
 * ค่า `release_reason` ของล็อกโทร (`candidateCallHolds.ts`) · ไม่รู้เหตุ = คำเดิม
 */
const RELEASE_REASON_LABEL: Record<string, string> = {
  expired: 'หลุด ครบ 24 ชม. ไม่ลงผล',
  to_ai: 'ส่งให้ AI โทร',
  manual: 'กดคืนงาน',
  transferred: 'หัวหน้าโอนงาน',
};

/** แท็บการนัดหมาย — เฉพาะครั้งที่ติดต่อแล้วนัดได้ (ล่าสุดก่อน ตามลำดับที่ API ส่งมา) */
export function appointmentLogs(logs: readonly ContactLog[]): ContactLog[] {
  // นัดหมายไม่สำเร็จก็เป็นประวัติการนัด (4 ต.ค. 2569) — ขึ้นแท็บการนัดหมายด้วยพร้อมเหตุผล
  return logs.filter((l) => Boolean(l.appointmentAt) || isAppointmentFailedContact(l));
}

/** ผลติดตามนัดบนแถว */
export function attendanceLabel(l: Pick<AttendanceLogItem, 'result'>): string {
  return ATTENDANCE_LABEL[l.result] ?? l.result;
}
