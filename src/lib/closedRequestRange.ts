/**
 * ช่วงวันที่ของแท็บ "ปิดแล้ว" (17 ส.ค. 2569)
 *
 * ⚠️ ต้องคิดเป็น **เวลาไทย** ไม่ใช่ UTC — ตอนดึกของไทยยังเป็นเมื่อวานที่ UTC
 * ใช้ `toLocaleDateString('en-CA')` เพราะให้รูป YYYY-MM-DD ตรงกับที่ API ต้องการอยู่แล้ว
 * (แพตเทิร์นเดียวกับ businessDate.ts ฝั่ง API)
 */
function ymd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

/** ช่วงวันที่ย้อนหลัง N วันถึงวันนี้ — `now` ฉีดได้เพื่อเทสต์ */
export function closedRangeForDays(days: number, now = new Date()): { from: string; to: string } {
  const from = new Date(now.getTime() - days * 86_400_000);
  return { from: ymd(from), to: ymd(now) };
}
