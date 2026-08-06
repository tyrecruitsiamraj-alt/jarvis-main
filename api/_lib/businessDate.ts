const BANGKOK_TZ = 'Asia/Bangkok';

/**
 * ตัวจัดรูปวันที่ต้องสร้างครั้งเดียว — `new Intl.DateTimeFormat()` แพงมาก (~0.16ms/ครั้ง)
 * เส้นใบขอที่ปิดแล้วเรียก toBangkokYmd 6 ครั้งต่อแถว × 5,000 แถว = 30,000 ครั้ง
 * ตอนสร้างใหม่ทุกครั้งใช้ 4.7 วินาที · สร้างครั้งเดียวเหลือ 0.06 วินาที (เร็วขึ้น 80 เท่า)
 */
const bangkokYmdFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: BANGKOK_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** YYYY-MM-DD in Asia/Bangkok (business calendar date). */
export function bangkokBusinessDateYmd(at: Date = new Date()): string {
  return bangkokYmdFormat.format(at);
}

/** Noon on the given business date in Bangkok — stable anchor for daily scoring windows. */
export function bangkokNoonDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+07:00`);
}

export function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d!;
}

/** แปลงค่าวันที่จาก DB/ISO เป็น YYYY-MM-DD ตามปฏิทินกรุงเทพ */
export function toBangkokYmd(v: string | Date | null | undefined): string {
  if (v == null) return '';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  return bangkokBusinessDateYmd(d);
}
