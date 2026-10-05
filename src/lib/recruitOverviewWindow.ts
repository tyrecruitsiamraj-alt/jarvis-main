/**
 * ═══ ช่วงเวลาของหน้า "ภาพรวมงานสรรหา" — เลือกเดือนแบบ iRecruit (เจ้าของเลือก 30 ก.ย. 2569) ═══
 *
 * > Choice "เลือกเดือนแบบ iRecruit" — ปุ่ม ‹ กันยายน 2569 › เทียบกับเดือนก่อน เขียวเพิ่ม แดงลด
 *
 * - เดือนที่จบแล้ว = ทั้งเดือน เทียบทั้งเดือนก่อน
 * - เดือนนี้ (ยังไม่จบ) = วันที่ 1 ถึงวันนี้ เทียบเดือนก่อน **ถึงวันที่เดียวกัน** (iRecruit: "เทียบกับ 1–30 ส.ค.")
 *   เดือนก่อนสั้นกว่า (เช่น 31 มี.ค. เทียบ ก.พ.) = ถึงวันสุดท้ายของเดือนก่อน
 * - ทุกวันเป็นปฏิทินไทย (Asia/Bangkok) · ไฟล์นี้ pure ใช้ได้ทั้งเส้นและหน้าเว็บ
 */
import type { RecruitOverviewWindow } from '@/lib/recruitOverviewTypes';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, '0');

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 'YYYY-MM' ก่อนหน้า/ถัดไป */
export function shiftMonth(month: string, delta: number): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  const idx = Number(m[1]) * 12 + (Number(m[2]) - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

export function isMonth(v: unknown): v is string {
  return typeof v === 'string' && MONTH_RE.test(v);
}

/**
 * ช่วงของเดือนที่เลือก + ช่วงที่เทียบ · ค่าผิด/เดือนในอนาคต = เดือนนี้
 * `today` = วันนี้แบบไทย 'YYYY-MM-DD'
 */
export function monthWindow(month: unknown, today: string): RecruitOverviewWindow {
  if (!YMD_RE.test(today)) throw new Error(`today ต้องเป็น YYYY-MM-DD: ${today}`);
  const current = today.slice(0, 7);
  const picked = isMonth(month) && month <= current ? month : current;
  const [y, m] = picked.split('-').map(Number);
  const isCurrent = picked === current;
  const last = daysInMonth(y, m);
  const prev = shiftMonth(picked, -1);
  const [py, pm] = prev.split('-').map(Number);
  const prevLast = daysInMonth(py, pm);
  const todayDay = Number(today.slice(8, 10));
  return {
    month: picked,
    from: `${picked}-01`,
    to: isCurrent ? today : `${picked}-${pad(last)}`,
    prevFrom: `${prev}-01`,
    prevTo: `${prev}-${pad(isCurrent ? Math.min(todayDay, prevLast) : prevLast)}`,
    isCurrent,
  };
}

const THAI_MONTH_NAMES = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

/** 'กันยายน 2569' */
export function monthLabel(month: string): string {
  const m = MONTH_RE.exec(month);
  if (!m) return month;
  return `${THAI_MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[1]) + 543}`;
}

/** เดือนตั้งแต่ `first` ถึง `last` (ใหม่สุดก่อน) — ตัวเลือกของปุ่มเลือกเดือน · first ว่าง/เกิน = เดือน last เดือนเดียว */
export function monthOptions(first: string | null, last: string): string[] {
  const start = first && isMonth(first) && first <= last ? first : last;
  const out: string[] = [];
  for (let m = last; m >= start; m = shiftMonth(m, -1)) {
    out.push(m);
    if (out.length > 120) break;
  }
  return out;
}

/**
 * ═══ ดูเป็นรายวัน / ช่วงที่เลือกเอง (เจ้าของสั่ง 5 ต.ค. 2569: *"ตอนนี้ดูได้แค่แบบเดือนแต่อยากดูแบบรายวันหรือ ช่วงได้ด้วย"*) ═══
 * - วันเดียว = from เท่ากับ to · เลือกกลับด้าน = สลับให้ · เลยวันนี้ = ตัดที่วันนี้
 * - ช่วงที่เทียบ = **ยาวเท่ากัน ติดกันก่อนหน้า** (เลือก 3 วัน เทียบ 3 วันก่อนนั้น · วันเดียวเทียบเมื่อวาน)
 * - ยาวสุด `RANGE_MAX_DAYS` วัน (กราฟรายวันวาดได้เท่านี้ — `dailyRows`) · เกิน = นับย้อนจากวันท้าย
 * - ค่าผิด = null (ผู้เรียกถอยไปแบบเดือน)
 */
export const RANGE_MAX_DAYS = 62;

const DAY_MS = 86_400_000;
const ymdToDay = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
const dayToYmd = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

export function isYmd(v: unknown): v is string {
  return typeof v === 'string' && YMD_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));
}

export function rangeWindow(fromParam: unknown, toParam: unknown, today: string): RecruitOverviewWindow | null {
  if (!YMD_RE.test(today)) throw new Error(`today ต้องเป็น YYYY-MM-DD: ${today}`);
  if (!isYmd(fromParam) || !isYmd(toParam)) return null;
  let a = ymdToDay(fromParam);
  let b = ymdToDay(toParam);
  if (a > b) [a, b] = [b, a];
  const t = ymdToDay(today);
  if (a > t) return null;
  b = Math.min(b, t);
  a = Math.max(a, b - (RANGE_MAX_DAYS - 1));
  const len = b - a + 1;
  const from = dayToYmd(a);
  const to = dayToYmd(b);
  return {
    month: from.slice(0, 7),
    from,
    to,
    prevFrom: dayToYmd(a - len),
    prevTo: dayToYmd(a - 1),
    isCurrent: b === t,
    range: true,
  };
}

/** เลื่อนช่วงไปก่อน/หลังเท่าความยาวของมัน (ปุ่ม ‹ › ตอนดูเป็นช่วง) */
export function shiftRange(win: { from: string; to: string }, delta: number): { from: string; to: string } {
  const a = ymdToDay(win.from);
  const len = ymdToDay(win.to) - a + 1;
  return { from: dayToYmd(a + delta * len), to: dayToYmd(a + delta * len + len - 1) };
}
