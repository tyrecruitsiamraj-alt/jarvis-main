/**
 * ผลติดตามนัด "มาตามนัด / ไม่มา / เลื่อนนัด" (migration 089) — ตรรกะล้วน
 * ใช้ทั้งฟอร์ม (ปุ่มบนแท็บติดตามนัดหมาย) และด่านตรวจฝั่ง API (ค่าใน DB ไม่มี CHECK
 * — บทเรียน 077/085 CHECK ที่ฐานกับ validator หลุด sync แล้ว 500 · คุมที่นี่ที่เดียว)
 */

export type AttendanceResult = 'showed' | 'no_show' | 'rescheduled';

export const ATTENDANCE_RESULTS: readonly AttendanceResult[] = ['showed', 'no_show', 'rescheduled'];

export function isAttendanceResult(v: unknown): v is AttendanceResult {
  return v === 'showed' || v === 'no_show' || v === 'rescheduled';
}

export const ATTENDANCE_LABEL: Record<AttendanceResult, string> = {
  showed: 'มาตามนัด',
  no_show: 'ไม่มา',
  rescheduled: 'เลื่อนนัด',
};

/** โทนสีของชิปผลนัด — คีย์ตรงกับ TONE ใน designTokens */
export const ATTENDANCE_TONE: Record<AttendanceResult, 'success' | 'danger' | 'warn'> = {
  showed: 'success',
  no_show: 'danger',
  rescheduled: 'warn',
};

const bangkokYmd = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * บันทึกผลนัดได้ตั้งแต่ **วันนัด (ตามปฏิทินกรุงเทพ) เป็นต้นไป** — ก่อนถึงวันนัด
 * ไม่มีปุ่ม (กันกดล่วงหน้ามั่ว) · เทียบระดับ "วัน" ไม่ใช่เวลา — นัดบ่ายโมง
 * ตอนเช้าคนมาก่อนเวลาก็บันทึกได้
 */
export function canRecordAttendance(appointmentAtIso: string | null | undefined, now: Date): boolean {
  if (!appointmentAtIso) return false;
  const appt = new Date(appointmentAtIso);
  if (Number.isNaN(appt.getTime())) return false;
  return bangkokYmd.format(appt) <= bangkokYmd.format(now);
}
