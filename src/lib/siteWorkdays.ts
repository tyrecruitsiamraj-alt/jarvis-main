/**
 * ═══ "ผ่านมา" ของใบขอ = นับเฉพาะวันทำงานของหน่วยงาน (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ผ่านมา ให้คำนวณ จากวันที่ต้องทำงานวันหยุดของ Site นั้นๆไม่นับ"* · Choice "ผ่านมาของใบขอ" +
 * "วันทำงานในใบขอ + วันหยุดนักขัตฤกษ์" → เคาะซ้ำ "ไม่ต้องหักวันหยุด"
 *
 * - วันทำงานอ่านจากช่อง "วันทำงาน" ของใบขอ (ERP `st_request_p2.work_date` → `work_schedule` = วัน • เวลา)
 *   เป็นข้อความอิสระ ~1,500 แบบ เช่น "วันจันทร์ - วันศุกร์" · "จันทร์-เสาร์" · "วันอาทิตย์ - ศุกร์" · "ทุกวัน" ·
 *   "วันจันทร์ – วันศุกร์ และวันเสาร์ ตามปฏิทินของผู้ว่าจ้าง" (= จ–ส: วันที่เขียนชื่อไว้นับหมด)
 * - 🔴 อ่านไม่ออก ("ตามตารางฮอนด้า" · "6 วัน/สัปดาห์ ตามตารางกะ") = **นับทุกวันเหมือนเดิม** ห้ามเดาวันหยุด
 * - 🔴 **ไม่หักวันหยุดนักขัตฤกษ์** (เจ้าของเคาะ 1 ต.ค. 2569 "ไม่ต้องหักวันหยุด" — `ms_holiday` ของ ERP มีถึงปี 2561 เท่านั้น)
 *   `countWorkingDays` ยังรับ `holidays` ได้ (ค่าเริ่มต้นว่าง) เผื่ออนาคต
 *
 * ไฟล์นี้ pure — เทสต์ที่ `src/lib/siteWorkdays.test.ts`
 */

/** สะกดผิดที่พบจริงใน ERP: "จัทร์" (จันทร์) · "ศกุร์" (ศุกร์) · การันต์หาย "จันทร" "เสาร" */
const DAY_NAMES: ReadonlyArray<[RegExp, number]> = [
  [/อาทิตย์?/, 0],
  [/จั?นทร์?|จัทร์?/, 1],
  [/อังคาร/, 2],
  [/พุธ/, 3],
  [/พฤหัส(?:บดี)?/, 4],
  [/ศุกร์?|ศกุร์?/, 5],
  [/เสาร์?/, 6],
];
/**
 * ชื่อวันเต็ม (มี/ไม่มี "วัน" นำหน้า · การันต์หายได้ · สะกดผิดที่พบจริง เช่น "อังคาร์" "จันทรื")
 * ตามด้วยสระ/วรรณยุกต์ที่หลุดมาได้ ไม่งั้นช่วง "จันทรื - เสาร์" อ่านไม่ติด
 */
const FULL = '(?:อาทิตย์?|จันทร์?|จัทร์?|อังคาร์?|พุธ|พฤหัส(?:บดี)?|ศุกร์?|ศกุร์?|เสาร์?)[\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E]*';
/** "วัน" นำหน้า — สะกดหลุดเป็น "วั" ได้ ("วันจันทร์ - วัเสาร์") */
const DAY_PREFIX = '(?:วัน|วั)?';
/**
 * 🔴 ชื่อวันที่ตามหลัง "หยุด" = **วันหยุด ไม่ใช่วันทำงาน** — ตัดทิ้งก่อนอ่าน
 * เช่น "6 วัน (เลือกหยุดเสาร์ หรือ อาทิตย์)" (เดิมอ่านกลับข้างเป็นทำงานแค่เสาร์–อาทิตย์) ·
 * "จันทร์ - อาทิตย์ (สลับกันหยุด จันทร์ หรือ อาทิตย์)" · "หยุดวันจันทร์ - วันเสาร์" · "วันหยุดนักขัตฤกษ์" ไม่โดน (ไม่มีชื่อวัน)
 */
const OFF_DAYS = new RegExp(
  `หยุด\\s*(?:วัน)?\\s*${FULL}(?:\\s*(?:-|–|—|ถึง|หรือ|,|และ)\\s*(?:วัน)?\\s*${FULL})*`,
  'g',
);
/** ตัวย่อ — อ่านเฉพาะในรูปช่วง "จ-ศ" "จ.-ส." ที่ไม่ติดตัวอักษรไทยอื่น (ตัวเดี่ยว ๆ ในประโยคกำกวมเกิน) */
const ABBR: Record<string, number> = { อา: 0, จ: 1, อ: 2, พ: 3, พฤ: 4, ศ: 5, ส: 6 };

const RANGE_FULL = new RegExp(`${DAY_PREFIX}\\s*(${FULL})\\s*(?:-|–|—|ถึง)\\s*${DAY_PREFIX}\\s*(${FULL})`, 'g');
const RANGE_ABBR = /(?<![฀-๿])(อา|พฤ|จ|อ|พ|ศ|ส)\.?\s*(?:-|–|—)\s*(อา|พฤ|จ|อ|พ|ศ|ส)\.?(?![฀-๿])/g;
const SINGLE_FULL = new RegExp(FULL, 'g');

function dayOf(name: string): number | null {
  for (const [re, n] of DAY_NAMES) if (re.test(name)) return n;
  return null;
}

/** วัน a ถึง b แบบวนรอบสัปดาห์ (อังคาร–อาทิตย์ = 2,3,4,5,6,0) */
function addRange(out: Set<number>, a: number, b: number): void {
  for (let d = a, guard = 0; guard < 7; guard += 1, d = (d + 1) % 7) {
    out.add(d);
    if (d === b) break;
  }
}

const parsedCache = new Map<string, ReadonlySet<number> | null>();

/**
 * วันในสัปดาห์ที่หน่วยงานทำงาน (0 = อาทิตย์ … 6 = เสาร์) จากข้อความวันทำงานของใบขอ
 * `null` = อ่านไม่ออก/ไม่ได้กรอก ⇒ ผู้เรียกนับทุกวัน (พฤติกรรมเดิม)
 */
export function parseWorkWeekdays(text: string | null | undefined): ReadonlySet<number> | null {
  // `work_schedule` = วัน • เวลา — อ่านเฉพาะท่อนวัน (ท่อนเวลาไม่มีชื่อวันอยู่แล้ว แต่กันไว้)
  const raw = String(text ?? '').split('•')[0].trim();
  if (!raw) return null;
  const hit = parsedCache.get(raw);
  if (hit !== undefined) return hit;

  const out = new Set<number>();
  // เครื่องหมายหลุดมากลางคำ เช่น "จันทร์-`เสาร์" · วันหยุดที่เขียนกำกับไว้ไม่ใช่วันทำงาน
  const clean = raw.replace(/[`'"]/g, '').replace(OFF_DAYS, ' ');
  let rest = clean;
  for (const m of clean.matchAll(RANGE_FULL)) {
    const a = dayOf(m[1]);
    const b = dayOf(m[2]);
    if (a != null && b != null) addRange(out, a, b);
    rest = rest.replace(m[0], ' ');
  }
  for (const m of rest.matchAll(RANGE_ABBR)) {
    addRange(out, ABBR[m[1]], ABBR[m[2]]);
  }
  rest = rest.replace(RANGE_ABBR, ' ');
  // ชื่อวันเดี่ยว ๆ ที่เขียนเพิ่ม เช่น "… และวันเสาร์ตามปฏิทินของผู้ว่าจ้าง"
  for (const m of rest.matchAll(SINGLE_FULL)) {
    const d = dayOf(m[0]);
    if (d != null) out.add(d);
  }
  if (out.size === 0 && /ทุกวัน/.test(clean)) for (let d = 0; d < 7; d += 1) out.add(d);
  /**
   * วันเดียว + มีตัวเลข = **งานวันเดียว** ("วันเสาร์ ที่ 28 พฤศจิกายน 2563" · "วันอังคารที่ 20/6/2561" — วัดจริงทุกแถวเป็นแบบนี้)
   * ไม่ใช่ "ทำทุกวันเสาร์" ⇒ นับทุกวันเหมือนเดิม
   */
  if (out.size === 1 && /\d/.test(clean)) out.clear();

  const result = out.size > 0 ? out : null;
  parsedCache.set(raw, result);
  return result;
}

const ymdUtc = (ymd: string): number => Date.parse(`${ymd}T00:00:00Z`);
const DAY_MS = 86_400_000;

/**
 * จำนวนวันทำงานหลังวัน `fromYmd` ถึงวัน `toYmd` (นับวันปลาย ไม่นับวันต้น — ชุดเดียวกับ "ผ่านมา N วัน" เดิม
 * ที่กรอกวันนี้ = 0) · `weekdays` null = ทุกวัน · `holidays` = YYYY-MM-DD ที่ไม่นับ
 * ปลายอยู่ก่อนต้น = ติดลบ (ข้อมูลเพี้ยน — ให้ผู้เรียกตัดสินเหมือนเดิม)
 */
export function countWorkingDays(
  fromYmd: string,
  toYmd: string,
  weekdays: ReadonlySet<number> | null,
  holidays: ReadonlySet<string> = EMPTY_HOLIDAYS,
): number {
  const a = ymdUtc(fromYmd);
  const b = ymdUtc(toYmd);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  if (b < a) return -countWorkingDays(toYmd, fromYmd, weekdays, holidays);
  const n = Math.round((b - a) / DAY_MS);
  const isWork = (dow: number) => weekdays == null || weekdays.has(dow);
  const perWeek = weekdays == null ? 7 : weekdays.size;
  const fullWeeks = Math.floor(n / 7);
  let count = fullWeeks * perWeek;
  const startDow = new Date(a).getUTCDay();
  for (let i = fullWeeks * 7 + 1; i <= n; i += 1) if (isWork((startDow + i) % 7)) count += 1;
  for (const h of holidays) {
    const t = ymdUtc(h);
    if (t > a && t <= b && isWork(new Date(t).getUTCDay())) count -= 1;
  }
  return count;
}

export const EMPTY_HOLIDAYS: ReadonlySet<string> = new Set();


/** ป้ายสั้นของวันทำงาน ("จ.–ศ." · "จ.–ส." · "อา.–ศ.") — null = นับทุกวัน (อ่านไม่ออก/ทำทุกวัน) */
export function workWeekdaysShortLabel(weekdays: ReadonlySet<number> | null): string | null {
  if (!weekdays || weekdays.size === 7) return null;
  const SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  // หาจุดเริ่มของช่วงต่อเนื่อง (วันถัดจากวันหยุดวันแรก) แล้วเขียนเป็น "ต้น–ปลาย" ถ้าต่อเนื่องกันจริง
  const days = [...weekdays].sort((x, y) => x - y);
  const start = days.find((d) => !weekdays.has((d + 6) % 7)) ?? days[0];
  const run: number[] = [];
  for (let d = start, i = 0; i < 7 && weekdays.has(d); i += 1, d = (d + 1) % 7) run.push(d);
  if (run.length === weekdays.size) return `${SHORT[run[0]]}–${SHORT[run[run.length - 1]]}`;
  return days.map((d) => SHORT[d]).join(' ');
}
