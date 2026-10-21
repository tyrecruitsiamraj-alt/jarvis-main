/**
 * ═══ เวลานัด (เจ้าของ 21 ต.ค. 2569 "บูธเดียวกัน 11.00 กับ 15.00 น. จะแยกยังไงได้") ═══
 * Choice "เพิ่มช่องเวลา + แถวละสถานที่·เวลา" + "ต้องกรอก"
 *
 * เดิมฟอร์มนัดเก็บแค่วัน ระบบตั้งเที่ยงวันไทยให้ (`toIsoAppointment` ใน callAppointment.ts) — นัดเก่าทุกใบจึงเป็น 12:00
 * ⇒ ช่องเวลา**ไม่มี 12:00** (พักเที่ยง) แล้วถือว่า 12:00 = "ไม่ระบุเวลา" (นัดเก่า) · ห้ามใส่ 12:00 กลับเข้ารายการ
 */
import { formatYmdTh, toYmdBangkok } from './dateTh';

/** เวลาที่นัดเก่า (ไม่มีช่องเวลา) ถูกตั้งไว้ */
export const LEGACY_NOON = '12:00';

/** ช่องเวลานัด 08:00–18:00 ทีละครึ่งชั่วโมง (ไม่มี 12:00 — ดูหัวไฟล์) */
export const APPOINTMENT_TIMES: readonly string[] = (() => {
  const out: string[] = [];
  for (let m = 8 * 60; m <= 18 * 60; m += 30) {
    const t = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    if (t !== LEGACY_NOON) out.push(t);
  }
  return out;
})();

const bangkokHm = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

/** เวลานัด HH:MM (เวลาไทย) · นัดเก่า (12:00) / ไม่มีนัด = null */
export function appointmentTimeOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const t = bangkokHm.format(d);
  return t === LEGACY_NOON ? null : t;
}

/** วัน (YYYY-MM-DD) + เวลา (HH:MM) → ค่าที่ส่งให้ API (เวลาไทย) */
export function appointmentAtWithTime(ymd: string, hm: string): string {
  return `${ymd}T${hm}:00+07:00`;
}

/** "21 ต.ค. 2569 11:00 น." · นัดเก่า = แค่วัน */
export function appointmentWhenText(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const t = appointmentTimeOf(iso);
  return `${formatYmdTh(toYmdBangkok(d))}${t ? ` ${t} น.` : ''}`;
}
