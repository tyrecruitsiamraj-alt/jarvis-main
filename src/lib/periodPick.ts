/**
 * ═══ ตัวเลือกช่วงเวลาแบบใช้ง่าย (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * รอบ 17: ปฏิทินเหลือแท็บ "ช่วง" (เดือน/ทั้งปี + ปี · ปุ่มลัด 7 วันล่าสุด/ทั้งหมด) กับ "วันเดียว" — ตัวคิดสัปดาห์/ช่วงวันยังอยู่
 * เพราะป้ายกับช่วงก่อนหน้ายังต้องรู้จักช่วงแบบนั้น (7 วันล่าสุดที่ตรงจันทร์–อาทิตย์พอดี = สัปดาห์)
 *
 * เจ้าของ: *"calendar มันดูยาก ทำให้ใช้ง่ายกว่านี้หน่อย แบบ เลือกช่วงวันได้ หรือ จะดูแค่วันไหนได้"* และ
 * *"ถ้ากดดูรายเดือนจะต้องเห็นตั้งแต่วันที่ 1-30 ถ้ารายสัปดาห์ก็เห็นว่า 1-7 แต่แค่ default ให้เป็นย้อนหลัง 7 วัน"*
 * ⇒ สัปดาห์ = จันทร์ถึงอาทิตย์ทั้งสัปดาห์ · เดือน = วันที่ 1 ถึงวันสุดท้ายของเดือน (วันที่ยังไม่ถึงก็อยู่ในช่วง แค่ยังว่าง)
 *
 * ทุกวันเป็น `YYYY-MM-DD` ตามปฏิทินกรุงเทพ · ป้ายเป็นภาษาคนพูด ปี พ.ศ.
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/periodPick.test.ts`
 */
import { addDays, daysBetween } from '@/lib/trends/timeBuckets';

/**
 * หน่วยที่เลือกบนปฏิทิน (รอบ 18 · เจ้าของ: *"เลือกแบบเทียบเดือน หรือปี ให้ขึ้นเป็นยอดรวมทั้งเดือน เช่น เลือก กันยา กับ ตุลา
 * ก็มีแค่ 2 แท่ง แล้วถ้ากดเข้าไปก็แสดงเป็นกราฟแท่งวันของเดือนนั้น · ปีก็แบบเดียวกัน สัปดาห์ด้วย"*)
 * กราฟใช้จัดแท่ง: เลือกหลายหน่วย = หนึ่งแท่งต่อหน่วย (ยอดรวม) · หน่วยเดียว = แท่งย่อยข้างใน · เส้นหลังบ้านไม่รู้จักค่านี้ (ใช้แค่ช่วงวันที่)
 */
export type PeriodUnit = 'day' | 'week' | 'month' | 'year';
export const PERIOD_UNITS: readonly PeriodUnit[] = ['day', 'week', 'month', 'year'];
export const PERIOD_UNIT_LABEL: Record<PeriodUnit, string> = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' };

export function isPeriodUnit(v: unknown): v is PeriodUnit {
  return typeof v === 'string' && (PERIOD_UNITS as readonly string[]).includes(v);
}

/** ช่วงวันที่ · null ทั้งคู่ = ทั้งหมด · `unit` = หน่วยที่เลือกบนปฏิทิน (ไม่มี = ดูเป็นรายวัน) */
export type PeriodWindow = { from: string | null; to: string | null; unit?: PeriodUnit };

/** ช่วงนี้เป็นแบบไหน (ใช้ทำป้าย · ช่วงก่อนหน้า · เปิดแท็บของปฏิทิน) — ปฏิทินรอบ 17 มีแค่แท็บ "ช่วง" กับ "วันเดียว" */
export type PeriodMode = 'day' | 'week' | 'month' | 'year' | 'range';

/**
 * ชื่อวันแบบตายตัว (0 = อาทิตย์ ตาม `getUTCDay`) — ไม่ใช้ `Intl` เพราะแต่ละเครื่องให้ไม่เหมือนกัน
 * (Node ให้ "พุธ" กับ "วันพุธ" · เบราว์เซอร์บางตัวให้ "พ.") ⇒ เทสต์กับจอจริงต้องได้คำเดียวกัน
 */
export const TH_WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] as const;
export const TH_WEEKDAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const;

export const TH_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;
export const TH_MONTH_FULL = [
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
] as const;

const yearOf = (ymd: string) => Number(ymd.slice(0, 4));
const monthIndexOf = (ymd: string) => Number(ymd.slice(5, 7)) - 1;
const dayOf = (ymd: string) => Number(ymd.slice(8, 10));

/** วันจันทร์ของสัปดาห์ที่มีวันนั้น */
export function mondayOf(ymd: string): string {
  const dow = new Date(`${ymd}T00:00:00Z`).getUTCDay(); // 0 = อาทิตย์
  return addDays(ymd, -((dow + 6) % 7));
}

/** ทั้งสัปดาห์ จันทร์ถึงอาทิตย์ */
export function weekOf(ymd: string): { from: string; to: string } {
  const from = mondayOf(ymd);
  return { from, to: addDays(from, 6) };
}

/** ทั้งเดือน วันที่ 1 ถึงวันสุดท้าย */
export function monthOf(ymd: string): { from: string; to: string } {
  const y = yearOf(ymd);
  const m = monthIndexOf(ymd);
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nextFirst = m === 11 ? `${y + 1}-01-01` : `${y}-${String(m + 2).padStart(2, '0')}-01`;
  return { from, to: addDays(nextFirst, -1) };
}

/** ทั้งปี 1 ม.ค. ถึง 31 ธ.ค. (`year` = ปี ค.ศ.) — ตัวเลือก "ทั้งปี" ของปฏิทิน (รอบ 17) */
export function yearWindow(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

/**
 * ช่วงที่ครอบหน่วยของวันที่ที่กดสองครั้ง (กดกลับหัวก็ได้ · กดครั้งเดียว = ส่งวันเดิมสองครั้ง) — รอบ 18
 * วัน = ตามนั้น · สัปดาห์ = จันทร์ของอันแรกถึงอาทิตย์ของอันหลัง · เดือน = วันที่ 1 ถึงวันสุดท้าย · ปี = 1 ม.ค. ถึง 31 ธ.ค.
 */
export function unitSpan(unit: PeriodUnit, a: string, b: string): { from: string; to: string; unit: PeriodUnit } {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  if (unit === 'week') return { from: mondayOf(lo), to: addDays(mondayOf(hi), 6), unit };
  if (unit === 'month') return { from: monthOf(lo).from, to: monthOf(hi).to, unit };
  if (unit === 'year') return { from: yearWindow(yearOf(lo)).from, to: yearWindow(yearOf(hi)).to, unit };
  return { from: lo, to: hi, unit };
}

/** มีกี่หน่วยในช่วง (ตามปฏิทิน) — วัน = จำนวนวัน */
export function unitCount(unit: PeriodUnit, from: string, to: string): number {
  if (to < from) return 0;
  if (unit === 'week') return Math.round(daysBetween(mondayOf(from), mondayOf(to)) / 7) + 1;
  if (unit === 'month') return (yearOf(to) - yearOf(from)) * 12 + monthIndexOf(to) - monthIndexOf(from) + 1;
  if (unit === 'year') return yearOf(to) - yearOf(from) + 1;
  return daysBetween(from, to) + 1;
}

/** n วันล่าสุดรวมวันนี้ */
export function lastDays(n: number, today: string): { from: string; to: string } {
  return { from: addDays(today, -(n - 1)), to: today };
}

export type QuickPeriod = { key: string; label: string; build: (today: string) => PeriodWindow };

/** ปุ่มลัด — ตัวแรกคือค่าตั้งต้นของหน้าหลัก (7 วันล่าสุด) */
export const QUICK_PERIODS: readonly QuickPeriod[] = [
  { key: 'last7', label: '7 วันล่าสุด', build: (t) => lastDays(7, t) },
  { key: 'today', label: 'วันนี้', build: (t) => ({ from: t, to: t }) },
  { key: 'thisWeek', label: 'สัปดาห์นี้', build: (t) => weekOf(t) },
  { key: 'thisMonth', label: 'เดือนนี้', build: (t) => monthOf(t) },
  { key: 'all', label: 'ทั้งหมด', build: () => ({ from: null, to: null }) },
];

const same = (a: PeriodWindow, b: PeriodWindow) => a.from === b.from && a.to === b.to;

/** ปุ่มลัดที่ตรงกับช่วงนี้ (ใช้ติดสีปุ่ม) · ไม่ตรงอันไหน = null */
export function quickKeyOf(win: PeriodWindow, today: string): string | null {
  return QUICK_PERIODS.find((q) => same(q.build(today), win))?.key ?? null;
}

/** "5 ก.ย. 2569" */
export function thaiDate(ymd: string): string {
  return `${dayOf(ymd)} ${TH_MONTH_SHORT[monthIndexOf(ymd)]} ${yearOf(ymd) + 543}`;
}

/** "1–15 ก.ย. 2569" · "25 ส.ค. – 3 ก.ย. 2569" · "25 ธ.ค. 2568 – 3 ม.ค. 2569" */
export function rangeText(from: string, to: string): string {
  if (from === to) return thaiDate(from);
  const sameYear = yearOf(from) === yearOf(to);
  if (sameYear && monthIndexOf(from) === monthIndexOf(to)) {
    return `${dayOf(from)}–${dayOf(to)} ${TH_MONTH_SHORT[monthIndexOf(to)]} ${yearOf(to) + 543}`;
  }
  if (sameYear) {
    return `${dayOf(from)} ${TH_MONTH_SHORT[monthIndexOf(from)]} – ${dayOf(to)} ${TH_MONTH_SHORT[monthIndexOf(to)]} ${yearOf(to) + 543}`;
  }
  return `${thaiDate(from)} – ${thaiDate(to)}`;
}

/**
 * "24–30 กันยายน 2569" · "28 สิงหาคม – 3 กันยายน 2569" · "30 กันยายน 2569" — ชื่อเดือนเต็ม
 * หัวกราฟยอดใช้งาน (รอบ 17 · เจ้าของ: *"ก.ย. ไรพวกนี้ไม่ต้องมี แต่ให้บอกในกราฟว่าดูเดือนอะไร วันไหนถึงวันไหน"*)
 * ⇒ แกนล่างเหลือเลขวัน · เดือนกับช่วงวันอยู่ที่หัวกราฟที่เดียว
 */
export function rangeTextFull(from: string, to: string): string {
  const dm = (ymd: string) => `${dayOf(ymd)} ${TH_MONTH_FULL[monthIndexOf(ymd)]}`;
  const be = (ymd: string) => yearOf(ymd) + 543;
  if (from === to) return `${dm(to)} ${be(to)}`;
  if (yearOf(from) === yearOf(to)) {
    return monthIndexOf(from) === monthIndexOf(to) ? `${dayOf(from)}–${dm(to)} ${be(to)}` : `${dm(from)} – ${dm(to)} ${be(to)}`;
  }
  return `${dm(from)} ${be(from)} – ${dm(to)} ${be(to)}`;
}

/** ช่วงนี้เลือกมาแบบไหน — ใช้เปิดแท็บให้ตรงตอนกดปฏิทินรอบถัดไป · ป้าย · ช่วงก่อนหน้า */
export function periodModeOf(win: PeriodWindow): PeriodMode {
  if (!win.from || !win.to) return 'range';
  if (win.from === win.to) return 'day';
  const wk = weekOf(win.from);
  if (wk.from === win.from && wk.to === win.to) return 'week';
  const mo = monthOf(win.from);
  if (mo.from === win.from && mo.to === win.to) return 'month';
  const yr = yearWindow(yearOf(win.from));
  if (yr.from === win.from && yr.to === win.to) return 'year';
  return 'range';
}

/**
 * ป้ายของหลายหน่วย (รอบ 18) — "ก.ย. – ต.ค. 2569" · "ธ.ค. 2568 – ม.ค. 2569" · "ปี 2568 – 2569" ·
 * สัปดาห์ = ช่วงวันจริง · หน่วยเดียว = `null` (ใช้ป้ายเดิมของช่วงแบบนั้น)
 */
function unitSpanLabel(win: PeriodWindow): string | null {
  const { unit, from, to } = win;
  if (!unit || unit === 'day' || !from || !to || unitCount(unit, from, to) < 2) return null;
  const be = (ymd: string) => yearOf(ymd) + 543;
  if (unit === 'year') return `ปี ${be(from)} – ${be(to)}`;
  if (unit === 'month') {
    const m = (ymd: string) => TH_MONTH_SHORT[monthIndexOf(ymd)];
    return yearOf(from) === yearOf(to) ? `${m(from)} – ${m(to)} ${be(to)}` : `${m(from)} ${be(from)} – ${m(to)} ${be(to)}`;
  }
  return `${unitCount(unit, from, to)} สัปดาห์ ${rangeText(from, to)}`;
}

/** ป้ายบนปุ่มปฏิทิน — ภาษาคนพูด */
export function periodLabel(win: PeriodWindow, today: string): string {
  if (!win.from && !win.to) return 'ทั้งหมด';
  const many = unitSpanLabel(win);
  if (many) return many;
  const from = win.from ?? win.to!;
  const to = win.to ?? win.from!;
  const w = { from, to };
  const quick = QUICK_PERIODS.find((q) => q.key !== 'all' && same(q.build(today), w));
  if (quick) return quick.label;
  if (same(w, { from: addDays(today, -1), to: addDays(today, -1) })) return 'เมื่อวาน';
  if (same(w, lastDays(30, today))) return '30 วันล่าสุด';
  switch (periodModeOf(w)) {
    case 'day':
      return thaiDate(from);
    case 'week':
      return `สัปดาห์ ${rangeText(from, to)}`;
    case 'month':
      return `${TH_MONTH_FULL[monthIndexOf(from)]} ${yearOf(from) + 543}`;
    case 'year':
      return `ปี ${yearOf(from) + 543}`;
    default:
      return rangeText(from, to);
  }
}
