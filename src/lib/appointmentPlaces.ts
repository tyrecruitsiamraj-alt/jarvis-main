/**
 * ═══ ตารางนัดรายสถานที่ของวัน — แบบ iRecruit "ติดตามนัด" (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"ให้ดูเลยว่าวันนี้ทุกคนนัดมาเท่าไหร่ นัดไปที่ไหนบ้าง"* · *"ให้เห็นไปหมดเลยว่า นัดมาทั้งหมดเท่าไหร่ ใครนัดมา"*
 * Choice "ตารางแบบ iRecruit บน + รายชื่อล่าง" · ตรรกะล้วน (มีเทสต์) — ผลมา/ไม่มาใช้นิยามเดียวกับ `appointmentBoard.ts`
 * ⚠️ มา + ไม่มา + เลื่อนนัด + รอผล = นัด เสมอ · ไม่มีสถานที่ = "ไม่ระบุสถานที่" (ไม่หาย)
 */
import { isAttendanceResult } from './appointmentAttendance';
import { toYmdBangkok } from './dateTh';

export type AppointmentPlaceRow = {
  appointment_at?: string | null;
  appointment_place?: string | null;
  appointment_by?: string | null;
  attendance_result?: string | null;
};

export const NO_PLACE = 'ไม่ระบุสถานที่';
export const NO_BOOKER = 'ไม่ระบุ';

export type AppointmentPlaceSummary = {
  place: string;
  total: number;
  /** ใครนัด · มากไปน้อย */
  by: Array<{ name: string; count: number }>;
  showed: number;
  noShow: number;
  rescheduled: number;
  pending: number;
};

/** สถานที่ของแถว (ตัดช่องว่าง · ว่าง = ไม่ระบุ) */
export function placeOf(r: AppointmentPlaceRow): string {
  return r.appointment_place?.trim() || NO_PLACE;
}

/** วันนัดของแถว (ปฏิทินกรุงเทพ) · ไม่มีนัด = null */
export function appointmentYmdOf(r: AppointmentPlaceRow): string | null {
  if (!r.appointment_at) return null;
  const d = new Date(r.appointment_at);
  return Number.isNaN(d.getTime()) ? null : toYmdBangkok(d);
}

/** แถวนี้อยู่ในวัน+สถานที่ที่กดไหม (place null = ทุกสถานที่ของวันนั้น) */
export function isInAppointmentPlace(r: AppointmentPlaceRow, ymd: string, place: string | null): boolean {
  return appointmentYmdOf(r) === ymd && (place === null || placeOf(r) === place);
}

export function buildAppointmentPlaces(
  rows: readonly AppointmentPlaceRow[],
  ymd: string,
): { total: number; places: AppointmentPlaceSummary[] } {
  const byPlace = new Map<string, AppointmentPlaceSummary & { byMap: Map<string, number> }>();
  let total = 0;
  for (const r of rows) {
    if (appointmentYmdOf(r) !== ymd) continue;
    const place = placeOf(r);
    const s =
      byPlace.get(place) ??
      { place, total: 0, by: [], showed: 0, noShow: 0, rescheduled: 0, pending: 0, byMap: new Map<string, number>() };
    byPlace.set(place, s);
    s.total += 1;
    total += 1;
    const who = r.appointment_by?.trim() || NO_BOOKER;
    s.byMap.set(who, (s.byMap.get(who) ?? 0) + 1);
    const res = isAttendanceResult(r.attendance_result) ? r.attendance_result : null;
    if (res === 'showed') s.showed += 1;
    else if (res === 'no_show') s.noShow += 1;
    else if (res === 'rescheduled') s.rescheduled += 1;
    else s.pending += 1;
  }
  const places = [...byPlace.values()]
    .map(({ byMap, ...s }) => ({
      ...s,
      by: [...byMap.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th')),
    }))
    .sort((a, b) => b.total - a.total || a.place.localeCompare(b.place, 'th'));
  return { total, places };
}

/** เลื่อนวัน YYYY-MM-DD ทีละวัน */
export function shiftYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
