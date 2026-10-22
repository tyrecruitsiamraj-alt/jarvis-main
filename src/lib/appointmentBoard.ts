/**
 * บอร์ดสรุปการนัดหมาย — **ตรรกะล้วน** (เจ้าของสั่ง 20 ส.ค. 2569 ข้อ 12:
 * *"พอลงนัดเสร็จไปดูหน้าการนัดหมาย เพื่อดูได้ว่าแต่ละวันนัดได้เท่าไหร่
 * มีบอร์ดแสดงว่านัดทั้งหมดเท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่"*)
 *
 * นิยามผลมาจาก `appointmentAttendance.ts` ที่เดียว (showed/no_show/rescheduled)
 * · ยังไม่บันทึกผล = "รอผล" — ต้องเห็นเป็นตัวเลข ไม่ใช่หายไปเฉย ๆ
 * · ตัดวันตามปฏิทินกรุงเทพเสมอ (กติกาโปรเจกต์ — toYmdBangkok)
 */
import { isAttendanceResult, type AttendanceResult } from './appointmentAttendance';
import { toYmdBangkok } from './dateTh';

export type AppointmentBoardRow = {
  appointment_at?: string | null;
  attendance_result?: string | null;
  /** ผ่าน/ไม่ผ่าน หลังมา (151 · 18 ต.ค. 2569) */
  screening_result?: string | null;
};

export type AppointmentDaySummary = {
  /** วันนัด (YYYY-MM-DD ปฏิทินกรุงเทพ) */
  date: string;
  total: number;
  showed: number;
  noShow: number;
  rescheduled: number;
  /** นัดแล้วแต่ยังไม่มีผลมา/ไม่มา */
  pending: number;
  /** ในรอผล+เลื่อนนัด: เลยวันนัดเกิน 24 ชม. (ไม่เกิน 30 วัน) — ชิป "เลยวันนัด" */
  overdue: number;
  /** ในคนที่มา: ผ่าน / ไม่ผ่าน (ส่วนย่อยของ showed — ไม่อยู่ในสูตรรวม) */
  passed: number;
  notPassed: number;
};

export type AppointmentBoard = {
  /** ยอดรวมทุกวันของชุดที่ส่งเข้ามา */
  total: AppointmentDaySummary;
  /** รายวัน เรียงวันใหม่สุดก่อน (วันที่กำลังจะถึง/ล่าสุดคือของที่คนตามงานอยากเห็นก่อน) */
  days: AppointmentDaySummary[];
};

function emptyDay(date: string): AppointmentDaySummary {
  return { date, total: 0, showed: 0, noShow: 0, rescheduled: 0, pending: 0, overdue: 0, passed: 0, notPassed: 0 };
}

function bump(day: AppointmentDaySummary, result: AttendanceResult | null, screening: string | null | undefined): void {
  day.total += 1;
  if (result === 'showed') {
    if (screening === 'passed') day.passed += 1;
    else if (screening === 'not_passed') day.notPassed += 1;
  }
  if (result === 'showed') day.showed += 1;
  else if (result === 'no_show') day.noShow += 1;
  else if (result === 'rescheduled') day.rescheduled += 1;
  else day.pending += 1;
}

/**
 * สรุปนัดต่อวันจากแถวใบสมัคร — แถวที่ไม่มีวันนัดไม่นับ (ยังไม่ได้นัด ไม่ใช่นัดแล้วรอผล)
 * ⚠️ ผลรวม showed+noShow+rescheduled+pending ต้อง = total เสมอ (มีเทสต์คุม)
 */
export function buildAppointmentBoard(rows: readonly AppointmentBoardRow[], nowMs: number = Date.now()): AppointmentBoard {
  const total = emptyDay('');
  const byDay = new Map<string, AppointmentDaySummary>();

  for (const r of rows) {
    if (!r.appointment_at) continue;
    const ymd = toYmdBangkok(new Date(r.appointment_at));
    if (!ymd) continue;
    const result = isAttendanceResult(r.attendance_result) ? r.attendance_result : null;
    const day = byDay.get(ymd) ?? emptyDay(ymd);
    byDay.set(ymd, day);
    bump(day, result, r.screening_result);
    bump(total, result, r.screening_result);
    if (isInAppointmentChip(r, 'overdue', ymd, nowMs)) {
      day.overdue += 1;
      total.overdue += 1;
    }
  }

  return {
    total,
    days: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
  };
}

/**
 * ═══ ชิปกรองแท็บติดตามนัดหมาย (แบบ C · เจ้าของเคาะ 5 ต.ค. 2569) ═══
 * แทนกล่องตัวเลข 4 ใบ — กดแล้วตารางกรองตาม · เลขบนชิป = เลขบนบอร์ดเดิม (`buildAppointmentBoard`)
 * "รอผล" รวมเลื่อนนัด (กล่องเดิมก็รวม "รอผล / เลื่อนนัด") ⇒ มา + ไม่มา + รอผล = นัดทั้งหมด
 */
/** `today` = นัดวันนี้ (QA รอบ 3 ข้อ 23 · ไม่มีปุ่มดูนัดวันนี้) — คนละแกนกับผลนัด ไม่อยู่ในสูตร มา + ไม่มา + รอผล = ทั้งหมด */
/** `passed` / `not_passed` = ส่วนย่อยของ "มา" (18 ต.ค. 2569) — ไม่อยู่ในสูตร มา + ไม่มา + รอผล = ทั้งหมด */
/** `overdue` = เลยวันนัดเกิน 24 ชม. ยังไม่ลงผล ย้อนไม่เกิน 30 วัน — เกณฑ์เดียวกับตัวเตือนรายวัน `appointmentResultReminder.ts`
 *  (`appointmentResultReminder.ts` · เจ้าของ 20 ต.ค. 2569 "มันไม่ตรงกันปะ" → Choice เพิ่มชิป) · ส่วนย่อยของ "รอผล" */
export type AppointmentChip = 'all' | 'today' | 'showed' | 'no_show' | 'pending' | 'overdue' | 'passed' | 'not_passed';

export const OVERDUE_AFTER_MS = 24 * 3_600_000;
export const OVERDUE_LOOKBACK_MS = 30 * 86_400_000;

export const APPOINTMENT_CHIPS: readonly { id: AppointmentChip; label: string; tone: 'info' | 'success' | 'danger' | 'warn' }[] = [
  { id: 'all', label: 'นัดทั้งหมด', tone: 'info' },
  { id: 'today', label: 'นัดวันนี้', tone: 'info' },
  { id: 'showed', label: 'มา', tone: 'success' },
  { id: 'no_show', label: 'ไม่มา', tone: 'danger' },
  { id: 'pending', label: 'รอผล', tone: 'warn' },
  { id: 'overdue', label: 'เลยวันนัด', tone: 'danger' },
  { id: 'passed', label: 'ผ่าน', tone: 'success' },
  { id: 'not_passed', label: 'ไม่ผ่าน', tone: 'danger' },
];

export function appointmentChipCount(
  board: AppointmentBoard,
  chip: AppointmentChip,
  today: string = toYmdBangkok(new Date()),
): number {
  if (chip === 'today') return board.days.find((d) => d.date === today)?.total ?? 0;
  const t = board.total;
  if (chip === 'showed') return t.showed;
  if (chip === 'no_show') return t.noShow;
  if (chip === 'pending') return t.pending + t.rescheduled;
  if (chip === 'overdue') return t.overdue;
  if (chip === 'passed') return t.passed;
  if (chip === 'not_passed') return t.notPassed;
  return t.total;
}

/** แถวนี้อยู่ในชิปไหม — นิยามเดียวกับ `bump` (แถวไม่มีวันนัดอยู่แค่ "นัดทั้งหมด" ไม่ได้ไม่นับ เพื่อไม่ให้แถวหาย) */
export function isInAppointmentChip(
  r: AppointmentBoardRow,
  chip: AppointmentChip,
  today: string = toYmdBangkok(new Date()),
  nowMs: number = Date.now(),
): boolean {
  if (chip === 'all') return true;
  if (!r.appointment_at) return false;
  if (chip === 'today') return toYmdBangkok(new Date(r.appointment_at)) === today;
  const result = isAttendanceResult(r.attendance_result) ? r.attendance_result : null;
  if (chip === 'overdue') {
    const at = Date.parse(r.appointment_at);
    return (result === null || result === 'rescheduled') && at < nowMs - OVERDUE_AFTER_MS && at > nowMs - OVERDUE_LOOKBACK_MS;
  }
  if (chip === 'showed') return result === 'showed';
  if (chip === 'no_show') return result === 'no_show';
  if (chip === 'passed') return result === 'showed' && r.screening_result === 'passed';
  if (chip === 'not_passed') return result === 'showed' && r.screening_result === 'not_passed';
  return result === null || result === 'rescheduled';
}
