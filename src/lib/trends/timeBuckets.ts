/**
 * ═══ เครื่องแบ่งงวดของ Dashboard แนวโน้ม — วัน · สัปดาห์ · เดือน · ไตรมาส · ปี ═══
 *
 * เจ้าของสั่ง 28 ก.ย. 2569 (หน้ากล่องงาน + ติดตาม): *"สวมบทบาทเป็นผู้บริหาร … ดูว่าแต่ละวันทีมมีแนวโน้ม
 * เติบโตลดลงยังไง มองเห็นได้หลายมุมมองหลายมิติ รายวัน สัปดาห์ เดือน ปี"* → เลือกแท็บชื่อ "Dashboard"
 *
 * 🔴 **ทุก Dashboard แนวโน้มต้องแบ่งงวดผ่านไฟล์นี้ที่เดียว** — สองจอแบ่งสัปดาห์คนละแบบ = เลขเถียงกัน
 * กติกา:
 * 1. **วันที่ = ปฏิทินกรุงเทพ** เสมอ (เหตุการณ์ตีหนึ่งไทยต้องเป็นวันนี้ ไม่ใช่เมื่อวานแบบ UTC)
 * 2. **สัปดาห์เริ่มวันจันทร์** (คีย์ = วันจันทร์ของสัปดาห์นั้น) · ไตรมาสตามปีปฏิทิน (ม.ค.–มี.ค. = Q1)
 * 3. งวดที่ไม่มีเหตุการณ์ = **0 ไม่ใช่หายไป** (`bucketRange` เติมให้ครบ) — กราฟที่ข้ามวันว่างโกหกเรื่องแนวโน้ม
 * 4. เทียบช่วงก่อนหน้า: ฐานเป็น 0 ⇒ `null` (บอกไม่ได้) ห้ามโชว์ ∞ หรือ +100% ปลอม
 *
 * คีย์งวด: day `YYYY-MM-DD` · week `YYYY-MM-DD` (วันจันทร์) · month `YYYY-MM` · quarter `YYYY-Qn` · year `YYYY`
 */
import { toYmdBangkok } from '@/lib/dateTh';

export type TrendGrain = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const TREND_GRAINS: readonly TrendGrain[] = ['day', 'week', 'month', 'quarter', 'year'];

export const TREND_GRAIN_LABEL: Record<TrendGrain, string> = {
  day: 'วัน',
  week: 'สัปดาห์',
  month: 'เดือน',
  quarter: 'ไตรมาส',
  year: 'ปี',
};

/** ช่วงตั้งต้นของแต่ละงวด — จำนวนงวดย้อนหลังนับรวมงวดปัจจุบัน */
export const TREND_DEFAULT_SPAN: Record<TrendGrain, number> = {
  day: 30,
  week: 12,
  month: 12,
  quarter: 8,
  year: 3,
};

const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD ตามปฏิทินกรุงเทพ · ค่าที่อ่านไม่ออก = `null` (ห้ามเดาเป็นวันนี้) */
export function bangkokYmd(v: string | Date | null | undefined): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'string' && YMD_RE.test(v.trim())) return v.trim();
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return toYmdBangkok(d);
}

/** แปลง YYYY-MM-DD เป็นเลขวันแบบ UTC (คิดเลขวันล้วน ไม่มีเขตเวลามาปน) */
function toUtcDay(ymd: string): number {
  const m = YMD_RE.exec(ymd);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000;
}

function fromUtcDay(day: number): string {
  const d = new Date(day * 86_400_000);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** บวก/ลบวัน */
export function addDays(ymd: string, days: number): string {
  return fromUtcDay(toUtcDay(ymd) + days);
}

/** จำนวนวันจาก a ถึง b (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round(toUtcDay(b) - toUtcDay(a));
}

/** วันจันทร์ของสัปดาห์ที่มีวันนั้น */
function mondayOf(ymd: string): string {
  const day = toUtcDay(ymd);
  const dow = new Date(day * 86_400_000).getUTCDay(); // 0 = อาทิตย์
  const back = (dow + 6) % 7; // จันทร์ = 0
  return fromUtcDay(day - back);
}

/** คีย์งวดของวันนั้น */
export function bucketKey(ymd: string, grain: TrendGrain): string {
  switch (grain) {
    case 'day':
      return ymd;
    case 'week':
      return mondayOf(ymd);
    case 'month':
      return ymd.slice(0, 7);
    case 'quarter': {
      const q = Math.floor((Number(ymd.slice(5, 7)) - 1) / 3) + 1;
      return `${ymd.slice(0, 4)}-Q${q}`;
    }
    case 'year':
      return ymd.slice(0, 4);
  }
}

/** วันแรกของงวด (ไว้เดินงวดถัดไป) */
function bucketStart(key: string, grain: TrendGrain): string {
  switch (grain) {
    case 'day':
    case 'week':
      return key;
    case 'month':
      return `${key}-01`;
    case 'quarter': {
      const q = Number(key.slice(6));
      return `${key.slice(0, 4)}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    }
    case 'year':
      return `${key}-01-01`;
  }
}

/** คีย์ของงวดถัดไป */
function nextBucket(key: string, grain: TrendGrain): string {
  switch (grain) {
    case 'day':
      return addDays(key, 1);
    case 'week':
      return addDays(key, 7);
    case 'month': {
      const y = Number(key.slice(0, 4));
      const m = Number(key.slice(5, 7));
      return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
    }
    case 'quarter': {
      const y = Number(key.slice(0, 4));
      const q = Number(key.slice(6));
      return q === 4 ? `${y + 1}-Q1` : `${y}-Q${q + 1}`;
    }
    case 'year':
      return String(Number(key) + 1);
  }
}

/** ทุกงวดตั้งแต่งวดของ from ถึงงวดของ to — ต่อเนื่อง ไม่ข้ามงวดว่าง · กันลูปไม่จบด้วยเพดาน 2,000 งวด */
export function bucketRange(fromYmd: string, toYmd: string, grain: TrendGrain): string[] {
  if (!YMD_RE.test(fromYmd) || !YMD_RE.test(toYmd) || fromYmd > toYmd) return [];
  const last = bucketKey(toYmd, grain);
  const out: string[] = [];
  let k = bucketKey(fromYmd, grain);
  while (out.length < 2000) {
    out.push(k);
    if (k === last) break;
    k = nextBucket(k, grain);
  }
  return out;
}

const shortBe = (y: number) => String((y + 543) % 100).padStart(2, '0');

/** ป้ายงวดภาษาไทย (พ.ศ. 2 หลัก) — "28 ก.ย." · "22–28 ก.ย." · "ก.ย. 69" · "Q3/69" · "2569" */
export function bucketLabel(key: string, grain: TrendGrain): string {
  switch (grain) {
    case 'day': {
      return `${Number(key.slice(8, 10))} ${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]}`;
    }
    case 'week': {
      const end = addDays(key, 6);
      const d1 = Number(key.slice(8, 10));
      const d2 = Number(end.slice(8, 10));
      const m1 = MONTHS_SHORT[Number(key.slice(5, 7)) - 1];
      const m2 = MONTHS_SHORT[Number(end.slice(5, 7)) - 1];
      return m1 === m2 ? `${d1}–${d2} ${m2}` : `${d1} ${m1}–${d2} ${m2}`;
    }
    case 'month':
      return `${MONTHS_SHORT[Number(key.slice(5, 7)) - 1]} ${shortBe(Number(key.slice(0, 4)))}`;
    case 'quarter':
      return `${key.slice(5)}/${shortBe(Number(key.slice(0, 4)))}`;
    case 'year':
      return String(Number(key) + 543);
  }
}

/**
 * ช่วงวันตั้งต้นของงวดนั้น — ย้อนหลัง `span` งวด (รวมงวดของวันนี้)
 * ⚠️ งวดล่าสุดยังไม่จบ (เช่น เดือนนี้ผ่านไป 28 วัน) — จอต้องบอกว่า "งวดนี้ยังไม่จบ" ไม่ใช่ปล่อยให้ดูว่าตก
 */
export function defaultRange(grain: TrendGrain, todayYmd: string, span = TREND_DEFAULT_SPAN[grain]): { from: string; to: string } {
  let k = bucketKey(todayYmd, grain);
  for (let i = 1; i < span; i++) k = prevBucket(k, grain);
  return { from: bucketStart(k, grain), to: todayYmd };
}

function prevBucket(key: string, grain: TrendGrain): string {
  switch (grain) {
    case 'day':
      return addDays(key, -1);
    case 'week':
      return addDays(key, -7);
    case 'month': {
      const y = Number(key.slice(0, 4));
      const m = Number(key.slice(5, 7));
      return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    }
    case 'quarter': {
      const y = Number(key.slice(0, 4));
      const q = Number(key.slice(6));
      return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
    }
    case 'year':
      return String(Number(key) - 1);
  }
}

/** ช่วงก่อนหน้าที่ยาวเท่ากันพอดี (เทียบ "ช่วงก่อน") — จบวันก่อน `from` หนึ่งวัน */
export function previousRange(fromYmd: string, toYmd: string): { from: string; to: string } {
  const len = daysBetween(fromYmd, toYmd) + 1;
  const to = addDays(fromYmd, -1);
  return { from: addDays(to, -(len - 1)), to };
}

/** ช่วงเดียวกันของปีก่อน */
export function sameRangeLastYear(fromYmd: string, toYmd: string): { from: string; to: string } {
  const shift = (ymd: string) => {
    const y = Number(ymd.slice(0, 4)) - 1;
    const md = ymd.slice(5);
    // 29 ก.พ. ของปีอธิกสุรทิน → 28 ก.พ. ของปีก่อน
    return md === '02-29' ? `${y}-02-28` : `${y}-${md}`;
  };
  return { from: shift(fromYmd), to: shift(toYmd) };
}

/** ร้อยละที่เปลี่ยน — ฐานเป็น 0 = `null` (บอกไม่ได้) · ปัดทศนิยม 1 ตำแหน่ง */
export function deltaPct(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** อยู่ในช่วง [from, to] ไหม (รวมหัวท้าย) */
export function inRange(ymd: string | null | undefined, from: string, to: string): boolean {
  return Boolean(ymd && ymd >= from && ymd <= to);
}

export type TrendPoint = { key: string; label: string; value: number };

/**
 * นับของตามงวด — `getYmd` คืนวันที่ของเหตุการณ์ (ไม่มี = ไม่นับ) · `weight` = นับเป็นกี่หน่วย (ค่าตั้งต้น 1)
 * ผลเรียงตามเวลาและ**ครบทุกงวดในช่วง** (งวดที่ไม่มีของ = 0)
 */
export function seriesByBucket<T>(
  items: readonly T[],
  getYmd: (item: T) => string | null | undefined,
  range: { from: string; to: string },
  grain: TrendGrain,
  weight: (item: T) => number = () => 1,
): TrendPoint[] {
  const keys = bucketRange(range.from, range.to, grain);
  const acc = new Map<string, number>(keys.map((k) => [k, 0]));
  for (const it of items) {
    const ymd = getYmd(it);
    if (!inRange(ymd, range.from, range.to)) continue;
    const k = bucketKey(ymd as string, grain);
    acc.set(k, (acc.get(k) ?? 0) + weight(it));
  }
  return keys.map((k) => ({ key: k, label: bucketLabel(k, grain), value: acc.get(k) ?? 0 }));
}

/** ผลรวมของเหตุการณ์ในช่วง */
export function sumInRange<T>(
  items: readonly T[],
  getYmd: (item: T) => string | null | undefined,
  range: { from: string; to: string },
  weight: (item: T) => number = () => 1,
): number {
  let s = 0;
  for (const it of items) if (inRange(getYmd(it), range.from, range.to)) s += weight(it);
  return s;
}

export type DimRow = { dim: string; value: number; previous: number; delta: number | null; share: number };

/**
 * แยกตามมิติ (BU · หน่วยงาน · เจ้าหน้าที่ …) ในช่วงที่เลือก เทียบช่วงก่อน — เรียงมากไปน้อย
 * `top` = เก็บกี่ตัวแรก ที่เหลือรวบเป็น "อื่น ๆ" (กราฟเกิน 8 สีอ่านไม่ออก)
 * ค่ามิติว่าง = "ไม่ระบุ" (ห้ามทิ้ง — ของที่ทิ้งทำให้ผลรวมไม่เท่ายอดบนการ์ด)
 */
export function breakdown<T>(
  items: readonly T[],
  getYmd: (item: T) => string | null | undefined,
  getDim: (item: T) => string | null | undefined,
  range: { from: string; to: string },
  previous: { from: string; to: string } | null,
  top = 8,
  weight: (item: T) => number = () => 1,
): DimRow[] {
  const cur = new Map<string, number>();
  const prev = new Map<string, number>();
  for (const it of items) {
    const ymd = getYmd(it);
    const dim = (getDim(it) ?? '').trim() || 'ไม่ระบุ';
    if (inRange(ymd, range.from, range.to)) cur.set(dim, (cur.get(dim) ?? 0) + weight(it));
    else if (previous && inRange(ymd, previous.from, previous.to)) prev.set(dim, (prev.get(dim) ?? 0) + weight(it));
  }
  const total = [...cur.values()].reduce((a, b) => a + b, 0);
  const rows = [...new Set([...cur.keys(), ...prev.keys()])]
    .map((dim) => {
      const value = cur.get(dim) ?? 0;
      const p = prev.get(dim) ?? 0;
      return { dim, value, previous: p, delta: previous ? deltaPct(value, p) : null, share: total ? value / total : 0 };
    })
    .filter((r) => r.value > 0 || r.previous > 0)
    // เท่ากัน = ของที่มีชื่อขึ้นก่อน "ไม่ระบุ" (แต่ถ้า "ไม่ระบุ" มากสุดก็ต้องขึ้นบนสุด — เป็นสัญญาณข้อมูลหาย)
    .sort(
      (a, b) =>
        b.value - a.value ||
        b.previous - a.previous ||
        Number(a.dim === 'ไม่ระบุ') - Number(b.dim === 'ไม่ระบุ') ||
        a.dim.localeCompare(b.dim, 'th'),
    );
  if (rows.length <= top) return rows;
  const head = rows.slice(0, top);
  const tail = rows.slice(top);
  const value = tail.reduce((a, r) => a + r.value, 0);
  const p = tail.reduce((a, r) => a + r.previous, 0);
  return [
    ...head,
    { dim: 'อื่น ๆ', value, previous: p, delta: previous ? deltaPct(value, p) : null, share: total ? value / total : 0 },
  ];
}
