/**
 * ═══ หน้า "ทีม Online" — ชนิดข้อมูล + ตัวคิด pure (29 ก.ย. 2569) ═══
 *
 * รอบ 1: เจ้าของส่งภาพต้นแบบ → Choice "ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน" · คนใช้งาน = เจ้าหน้าที่ที่เข้าใช้ระบบ ·
 * อนุมัติ/เผยแพร่ = ใบที่ Gen link · ความคุ้มค่า = เว้นไว้ก่อน
 *
 * รอบ 2 (เจ้าของเปิดดูแล้วสั่งต่อ): *"ตรง วันนี้ สัปดาห์นี้ เดือนนี้ ปีนี้ ทำเป็น calendar"* + เทียบ BU เป็นแท่งตามช่วงย่อย
 * พร้อมเส้นแนวโน้ม → Choice:
 * - คนใช้งาน = **% ของบัญชีใน BU นั้น** + แยกบอกบทบาท (*"แยกบอกด้วยว่า หัวหน้า Opl ฯลฯ อย่างละเท่าไหร่"*)
 * - ใบขอเข้า = **จำนวนอัตรา (ตำแหน่ง)**
 * - Lumos = **ทุกเลน แยกสีตามเลน** · Success rate ตัวกลาง (`said_yes ÷ ได้คุยจริง` นับสาย — ตัวเดียวกับ Dashboard)
 * - เพิ่ม **ติดตรงไหน ต่อ BU** + **งานที่ต้องทำต่อของคนเปิด**
 *
 * ช่วงเวลา = ตัวเดียวกับแท็บ Dashboard (`timeBuckets` · ปฏิทิน + งวด วัน/สัปดาห์/เดือน/ไตรมาส/ปี + เทียบช่วงก่อน/ปีก่อน)
 * ทุกเหตุการณ์นับเป็น **วันที่แบบไทย** (ฝั่ง SQL แปลงเวลาเป็นวันกรุงเทพก่อนส่งมา)
 */
import { classifyCallMicro, vocabForPersonRef } from '@/lib/callMicroOutcome';
import {
  TREND_GRAINS,
  addDays,
  bucketKey,
  bucketLabel,
  bucketRange,
  daysBetween,
  defaultRange,
  previousRange,
  sameRangeLastYear,
  type TrendGrain,
} from '@/lib/trends/timeBuckets';

/* ─────────────── ช่วงเวลา (ปฏิทินแบบแท็บ Dashboard) ─────────────── */

export type TeamCompare = 'previous' | 'lastYear';

export const isTeamCompare = (v: unknown): v is TeamCompare => v === 'previous' || v === 'lastYear';
export const isTrendGrain = (v: unknown): v is TrendGrain =>
  typeof v === 'string' && (TREND_GRAINS as readonly string[]).includes(v);

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** เพดานความยาวช่วง — ครอบช่วงตั้งต้นของงวด "ปี" (3 ปี) ของ Dashboard */
export const TEAM_MAX_DAYS = 3 * 366 + 31;

export type TeamRange = { from: string; to: string };

export type TeamBucket = {
  key: string;
  label: string;
  /** วันแรก/วันสุดท้ายของช่วงย่อยที่อยู่ในช่วงจริง (ตัดขอบแล้ว) */
  from: string;
  to: string;
};

export type TeamWindow = {
  grain: TrendGrain;
  compare: TeamCompare;
  today: string;
  range: TeamRange;
  previous: TeamRange;
  buckets: TeamBucket[];
  /** ช่วงย่อยของช่วงที่เทียบ จับคู่ตามลำดับ (ยาวเท่า `buckets` เสมอ) */
  prevBuckets: TeamBucket[];
  /** ช่วงนี้มีวันนี้อยู่ด้วย = ยังไม่จบ — ช่วงย่อยสุดท้ายไม่นับในเส้นแนวโน้ม */
  lastBucketOpen: boolean;
  /** วันแรก/วันสุดท้ายที่ต้องดึงข้อมูล (ครอบทั้งสองช่วง) */
  fetchFrom: string;
  fetchTo: string;
};

function bucketsOf(range: TeamRange, grain: TrendGrain): TeamBucket[] {
  const keys = bucketRange(range.from, range.to, grain);
  const out: TeamBucket[] = keys.map((k) => ({ key: k, label: bucketLabel(k, grain), from: '', to: '' }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const i = idx.get(bucketKey(d, grain));
    if (i === undefined) continue;
    if (!out[i].from) out[i].from = d;
    out[i].to = d;
  }
  return out;
}

/**
 * ช่วงที่ดู + ช่วงที่เทียบ จากพารามิเตอร์ (ค่าผิด = ช่วงตั้งต้นของงวดแบบ Dashboard)
 * ปลายช่วงเลยวันนี้ = ตัดที่วันนี้ · ยาวเกินเพดาน = ตัดหัว
 */
export function teamWindow(
  q: { from?: unknown; to?: unknown; grain?: unknown; compare?: unknown },
  today: string,
): TeamWindow {
  const grain: TrendGrain = isTrendGrain(q.grain) ? q.grain : 'day';
  const compare: TeamCompare = isTeamCompare(q.compare) ? q.compare : 'previous';
  let from = typeof q.from === 'string' && YMD.test(q.from) ? q.from : null;
  let to = typeof q.to === 'string' && YMD.test(q.to) ? q.to : null;
  let range: TeamRange;
  if (from && to && from <= to) {
    if (to > today) to = today;
    if (from > to) from = to;
    if (daysBetween(from, to) + 1 > TEAM_MAX_DAYS) from = addDays(to, -(TEAM_MAX_DAYS - 1));
    range = { from, to };
  } else {
    range = defaultRange(grain, today);
  }
  const previous = compare === 'lastYear' ? sameRangeLastYear(range.from, range.to) : previousRange(range.from, range.to);
  const buckets = bucketsOf(range, grain);
  const prevAll = bucketsOf(previous, grain);
  const prevBuckets = buckets.map((_, i) => prevAll[i] ?? { key: `__none_${i}`, label: '', from: '', to: '' });
  return {
    grain,
    compare,
    today,
    range,
    previous,
    buckets,
    prevBuckets,
    lastBucketOpen: range.to >= today,
    fetchFrom: previous.from < range.from ? previous.from : range.from,
    fetchTo: range.to > previous.to ? range.to : previous.to,
  };
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayOf = (ymd: string) => Number(ymd.slice(8, 10));
const monthOf = (ymd: string) => MONTHS[Number(ymd.slice(5, 7)) - 1];
const beOf = (ymd: string) => Number(ymd.slice(0, 4)) + 543;

/** "1–29 ก.ย. 2569" · "25 ส.ค. – 29 ก.ย. 2569" · "25 ธ.ค. 2568 – 5 ม.ค. 2569" · วันเดียว "29 ก.ย. 2569" */
export function rangeText(r: TeamRange): string {
  if (r.from === r.to) return `${dayOf(r.from)} ${monthOf(r.from)} ${beOf(r.from)}`;
  if (r.from.slice(0, 7) === r.to.slice(0, 7)) return `${dayOf(r.from)}–${dayOf(r.to)} ${monthOf(r.to)} ${beOf(r.to)}`;
  if (r.from.slice(0, 4) === r.to.slice(0, 4)) {
    return `${dayOf(r.from)} ${monthOf(r.from)} – ${dayOf(r.to)} ${monthOf(r.to)} ${beOf(r.to)}`;
  }
  return `${dayOf(r.from)} ${monthOf(r.from)} ${beOf(r.from)} – ${dayOf(r.to)} ${monthOf(r.to)} ${beOf(r.to)}`;
}

/** "1–29 ก.ย. 2569 เทียบ 3–31 ส.ค. 2569" */
export function teamWindowText(w: TeamWindow): string {
  return `${rangeText(w.range)} เทียบ ${rangeText(w.previous)}`;
}

export type TeamSide = 'cur' | 'prev';

/** วันที่ (ไทย) อยู่ช่วงไหน + ช่วงย่อยที่เท่าไหร่ — นอกทั้งสองช่วง = null */
export function makeLocator(w: TeamWindow): (ymd: string | null | undefined) => { side: TeamSide; i: number } | null {
  const cur = new Map(w.buckets.map((b, i) => [b.key, i]));
  const prev = new Map(w.prevBuckets.map((b, i) => [b.key, i]));
  return (ymd) => {
    if (!ymd || !YMD.test(ymd)) return null;
    if (ymd >= w.range.from && ymd <= w.range.to) {
      const i = cur.get(bucketKey(ymd, w.grain));
      return i === undefined ? null : { side: 'cur', i };
    }
    if (ymd >= w.previous.from && ymd <= w.previous.to) {
      const i = prev.get(bucketKey(ymd, w.grain));
      return i === undefined ? null : { side: 'prev', i };
    }
    return null;
  };
}

/**
 * ข้อมูลเริ่มมีเมื่อไหร่เทียบกับสองช่วง — ระบบเพิ่งเริ่มเก็บหลายตาราง (ล็อก 1 ก.ค. · ประกาศ 5 ส.ค. · คิวโทร 16 ส.ค. 2569)
 * ⇒ "ช่วงก่อน 0" ของช่วงที่ยังไม่มีข้อมูลเป็นเลขโกหก ต้องขึ้น "—" (`none`) หรือติดธง (`partial`)
 */
export type TeamCoverage = { since: string | null; cur: 'full' | 'partial'; prev: 'full' | 'partial' | 'none' };

export function coverageOf(w: TeamWindow, sinceYmd: string | null): TeamCoverage {
  if (!sinceYmd) return { since: null, cur: 'full', prev: 'full' };
  return {
    since: sinceYmd,
    cur: sinceYmd > w.range.from ? 'partial' : 'full',
    prev: sinceYmd > w.previous.to ? 'none' : sinceYmd > w.previous.from ? 'partial' : 'full',
  };
}

/* ─────────────── ตัวนับ ─────────────── */

export type TeamCount = { cur: number; prev: number; series: number[]; prevSeries: number[] };
export type TeamPair = { cur: number; prev: number };

/** นับของไม่ซ้ำ (คน/ใบ) ต่อช่วง และต่อช่วงย่อยของแต่ละช่วง */
export function distinctCount(w: TeamWindow, events: Iterable<{ who: string; ymd: string | null }>): TeamCount {
  const at = makeLocator(w);
  const total = { cur: new Set<string>(), prev: new Set<string>() };
  const per = {
    cur: w.buckets.map(() => new Set<string>()),
    prev: w.prevBuckets.map(() => new Set<string>()),
  };
  for (const e of events) {
    const p = at(e.ymd);
    if (!p) continue;
    total[p.side].add(e.who);
    per[p.side][p.i].add(e.who);
  }
  return {
    cur: total.cur.size,
    prev: total.prev.size,
    series: per.cur.map((s) => s.size),
    prevSeries: per.prev.map((s) => s.size),
  };
}

/** รวมค่า (เช่น อัตรา) ต่อช่วง และต่อช่วงย่อย */
export function sumCount(w: TeamWindow, events: Iterable<{ ymd: string | null; n: number }>): TeamCount {
  const at = makeLocator(w);
  const out: TeamCount = { cur: 0, prev: 0, series: w.buckets.map(() => 0), prevSeries: w.prevBuckets.map(() => 0) };
  for (const e of events) {
    const p = at(e.ymd);
    if (!p) continue;
    out[p.side] += e.n;
    (p.side === 'cur' ? out.series : out.prevSeries)[p.i] += e.n;
  }
  return out;
}

/* ─────────────── เส้นแนวโน้ม ─────────────── */

export type TeamTrend = {
  direction: 'up' | 'down' | 'flat' | 'none';
  /** ค่าบนเส้นแนวโน้มทุกช่วงย่อย (null = ไม่มีเส้น) */
  fitted: Array<number | null>;
  /** เปลี่ยนไปกี่ส่วนของค่าเฉลี่ยตลอดช่วง (0.25 = 25% · null = ไม่มีเส้น) */
  changePct: number | null;
};

/** เส้นตรงแบบ least squares — ต้องมีอย่างน้อย 3 จุด · ช่วงย่อยที่ยังไม่จบไม่นับ (ดึงเส้นลงหลอก ๆ) */
export function trendOf(values: ReadonlyArray<number | null>, excludeLast: boolean): TeamTrend {
  const n = values.length;
  const pts: Array<[number, number]> = [];
  values.forEach((v, i) => {
    if (v === null || !Number.isFinite(v)) return;
    if (excludeLast && i === n - 1) return;
    pts.push([i, v]);
  });
  const none: TeamTrend = { direction: 'none', fitted: values.map(() => null), changePct: null };
  if (pts.length < 3) return none;
  const mx = pts.reduce((s, [x]) => s + x, 0) / pts.length;
  const my = pts.reduce((s, [, y]) => s + y, 0) / pts.length;
  const sxx = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0);
  if (sxx === 0) return none;
  const b = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / sxx;
  const a = my - b * mx;
  const fitted = values.map((_, i) => Math.max(0, a + b * i));
  const span = pts[pts.length - 1][0] - pts[0][0];
  const changePct = my === 0 ? 0 : (b * span) / my;
  const direction = my === 0 ? 'flat' : changePct > 0.1 ? 'up' : changePct < -0.1 ? 'down' : 'flat';
  return { direction, fitted, changePct };
}

export const TREND_TEXT: Record<TeamTrend['direction'], string> = {
  up: 'แนวโน้มเพิ่มขึ้น',
  down: 'แนวโน้มลดลง',
  flat: 'ทรงตัว',
  none: 'ข้อมูลน้อยเกินบอกแนวโน้ม',
};

/* ─────────────── ข้อความเปลี่ยนแปลงแบบในภาพ ─────────────── */

const NUM = new Intl.NumberFormat('th-TH');
const PCT1 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export type DeltaTone = 'up' | 'down' | 'flat' | 'none';

/** จำนวน: "เพิ่ม 1 ใบ (16.7%)" · "ลด 14 คน (20.6%)" · ช่วงก่อนเป็น 0 = บอกตรง ๆ ไม่คิด % */
export function countDelta(cur: number, prev: number, unit: string): { text: string; tone: DeltaTone } {
  const d = cur - prev;
  if (d === 0) return { text: 'เท่าช่วงก่อน', tone: 'flat' };
  if (prev === 0) return { text: `เพิ่ม ${NUM.format(d)} ${unit} (ช่วงก่อนไม่มี)`, tone: 'up' };
  const pct = PCT1.format((Math.abs(d) / prev) * 100);
  return d > 0
    ? { text: `เพิ่ม ${NUM.format(d)} ${unit} (${pct}%)`, tone: 'up' }
    : { text: `ลด ${NUM.format(-d)} ${unit} (${pct}%)`, tone: 'down' };
}

/** อัตรา (0–1 · null = ไม่มีฐาน): "เพิ่ม 0.0 จุดเปอร์เซ็นต์" — ต่างกันเป็นจุดเปอร์เซ็นต์ ไม่ใช่ % ของ % */
export function rateDelta(cur: number | null, prev: number | null): { text: string; tone: DeltaTone } {
  if (cur === null || prev === null) return { text: cur === null ? '—' : 'ช่วงก่อนไม่มีฐาน', tone: 'none' };
  const d = (cur - prev) * 100;
  const rounded = Math.round(d * 10) / 10;
  if (rounded === 0) return { text: 'เพิ่ม 0.0 จุดเปอร์เซ็นต์', tone: 'flat' };
  return rounded > 0
    ? { text: `เพิ่ม ${PCT1.format(rounded)} จุดเปอร์เซ็นต์`, tone: 'up' }
    : { text: `ลด ${PCT1.format(-rounded)} จุดเปอร์เซ็นต์`, tone: 'down' };
}

/** อัตราส่วน — ฐานเป็น 0 = null (ห้ามโชว์ 0%) */
export const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

/**
 * ป้ายเปลี่ยนแปลงมุมการ์ด (แบบภาพอ้างอิงที่เจ้าของเลือก 29 ก.ย. 2569: "↑ 4.27%")
 * - `tone` good/bad ตามทิศที่ดีของเมตริก · ไม่มีดี/เสีย หรือข้อมูลช่วงไหนไม่ครบ = neutral (ห้ามลงสีหลอก)
 * - จำนวน = % ที่เปลี่ยน · ช่วงก่อนเป็น 0 = "ใหม่" (หาร 0 ไม่ได้) · อัตรา = ต่างกันเป็นจุด (ไม่ใช่ % ของ %)
 */
export type DeltaPill = { text: string; dir: 'up' | 'down' | 'flat'; tone: 'good' | 'bad' | 'neutral' };

function pillTone(dir: DeltaPill['dir'], upIsGood: boolean | null, muted: boolean): DeltaPill['tone'] {
  if (muted || upIsGood === null || dir === 'flat') return 'neutral';
  return (dir === 'up') === upIsGood ? 'good' : 'bad';
}

export function countPill(cur: number, prev: number, upIsGood: boolean | null, muted = false): DeltaPill {
  if (cur === prev) return { text: '0%', dir: 'flat', tone: 'neutral' };
  const dir = cur > prev ? 'up' : 'down';
  if (prev === 0) return { text: 'ใหม่', dir, tone: pillTone(dir, upIsGood, muted) };
  return { text: `${PCT1.format((Math.abs(cur - prev) / prev) * 100)}%`, dir, tone: pillTone(dir, upIsGood, muted) };
}

export function ratePill(cur: number | null, prev: number | null, upIsGood: boolean | null, muted = false): DeltaPill | null {
  if (cur === null || prev === null) return null;
  const d = Math.round((cur - prev) * 1000) / 10;
  if (d === 0) return { text: '0 จุด', dir: 'flat', tone: 'neutral' };
  const dir = d > 0 ? 'up' : 'down';
  return { text: `${PCT1.format(Math.abs(d))} จุด`, dir, tone: pillTone(dir, upIsGood, muted) };
}

export const fmtPct = (r: number | null): string => (r === null ? '—' : `${PCT1.format(r * 100)}%`);

/** เรียง BU: มากไปน้อยตามค่าที่ให้ · ไม่ระบุ BU อยู่ท้ายเสมอ */
function sortBu<T extends { bu: string }>(rows: T[], by: (r: T) => number): T[] {
  return rows.sort((a, b) => Number(a.bu === '') - Number(b.bu === '') || by(b) - by(a) || a.bu.localeCompare(b.bu));
}

const buLabel = (labelOf: (bu: string) => string, bu: string) => (bu ? labelOf(bu) : 'ไม่ระบุ BU');

/* ─────────────── คนใช้งาน (% ของบัญชีใน BU + แยกบทบาท) ─────────────── */

export const TEAM_ROLES: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'staff', label: 'เจ้าหน้าที่' },
  { key: 'supervisor', label: 'หัวหน้า' },
  { key: 'opl', label: 'OPL' },
  { key: 'admin', label: 'ผู้ดูแลระบบ' },
];

/** บัญชีผู้ใช้ — `bu` = BU กลางของแผนกบนบัญชี (`''` = ยังไม่ผูกแผนก) */
export type RawAccount = { id: string; bu: string; role: string; active: boolean; createdYmd: string | null };
/** ใช้งานหนึ่งวัน (คนไม่ซ้ำต่อวัน — SQL จัดให้แล้ว) */
export type RawActivity = { uid: string; ymd: string };

export type TeamUsersBu = {
  bu: string;
  label: string;
  /** บัญชีที่เป็นฐานของช่วงนี้ · คนที่ใช้ · % (null = ยังไม่มีบัญชี) */
  accounts: number;
  users: number;
  pct: number | null;
  prevPct: number | null;
  /** แยกบทบาท (เฉพาะบทบาทที่มีบัญชี) */
  roles: Array<{ role: string; label: string; accounts: number; users: number }>;
  /** % ต่อช่วงย่อย (0–1 · null = ยังไม่มีบัญชีในช่วงย่อยนั้น) */
  series: Array<number | null>;
  /** ตัวตั้ง/ตัวหารของ `series` ต่อช่วงย่อย — ให้หน้าเว็บรวมหลาย BU เป็น % เดียวได้ถูก (รวมตัวตั้ง ÷ รวมตัวหาร ไม่ใช่เฉลี่ย %) */
  counts: number[];
  bases: number[];
};

/**
 * บัญชีนับเป็นฐานของช่วงที่จบวัน `to` เมื่อ **สร้างแล้วภายในวันนั้น** และ (ยังเปิดใช้อยู่ **หรือ** ใช้งานในช่วงนั้น)
 * — บัญชีที่ปิดไปแล้วแต่เคยใช้ในช่วงนั้นยังอยู่ในฐาน ⇒ % ไม่มีวันเกิน 100
 */
function eligible(a: RawAccount, to: string, used: boolean): boolean {
  return (!a.createdYmd || a.createdYmd <= to) && (a.active || used);
}

export function usersSummary(
  w: TeamWindow,
  accounts: readonly RawAccount[],
  activity: readonly RawActivity[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
): { total: TeamCount; accounts: TeamPair; byBu: TeamUsersBu[] } {
  const at = makeLocator(w);
  const known = new Set(accounts.map((a) => a.id));
  const usedCur = new Set<string>();
  const usedPrev = new Set<string>();
  const usedBucket = w.buckets.map(() => new Set<string>());
  const events: Array<{ who: string; ymd: string }> = [];
  for (const e of activity) {
    if (!known.has(e.uid)) continue;
    events.push({ who: e.uid, ymd: e.ymd });
    const p = at(e.ymd);
    if (!p) continue;
    if (p.side === 'cur') {
      usedCur.add(e.uid);
      usedBucket[p.i].add(e.uid);
    } else usedPrev.add(e.uid);
  }
  const total = distinctCount(w, events);
  const baseCur = accounts.filter((a) => eligible(a, w.range.to, usedCur.has(a.id)));
  const basePrev = accounts.filter((a) => eligible(a, w.previous.to, usedPrev.has(a.id)));

  const bus = new Set<string>([...accounts.map((a) => a.bu), ...extraBus]);
  const byBu = [...bus].map((bu): TeamUsersBu => {
    const mine = accounts.filter((a) => a.bu === bu);
    const cur = mine.filter((a) => eligible(a, w.range.to, usedCur.has(a.id)));
    const prev = mine.filter((a) => eligible(a, w.previous.to, usedPrev.has(a.id)));
    const users = cur.filter((a) => usedCur.has(a.id)).length;
    const prevUsers = prev.filter((a) => usedPrev.has(a.id)).length;
    const roleKeys = [...new Set([...TEAM_ROLES.map((r) => r.key), ...cur.map((a) => a.role)])];
    const roles = roleKeys
      .map((role) => ({
        role,
        label: TEAM_ROLES.find((r) => r.key === role)?.label ?? role,
        accounts: cur.filter((a) => a.role === role).length,
        users: cur.filter((a) => a.role === role && usedCur.has(a.id)).length,
      }))
      .filter((r) => r.accounts > 0);
    const bases = w.buckets.map((b, i) => mine.filter((a) => eligible(a, b.to, usedBucket[i].has(a.id))).length);
    const counts = w.buckets.map((_, i) => mine.filter((a) => usedBucket[i].has(a.id)).length);
    const series = w.buckets.map((_, i) => ratio(counts[i], bases[i]));
    return {
      bu,
      label: buLabel(labelOf, bu),
      accounts: cur.length,
      users,
      pct: ratio(users, cur.length),
      prevPct: ratio(prevUsers, prev.length),
      roles,
      series,
      counts,
      bases,
    };
  });
  return { total, accounts: { cur: baseCur.length, prev: basePrev.length }, byBu: sortBu(byBu, (r) => r.accounts) };
}

/** % คนใช้งานต่อช่วงย่อยของหลาย BU รวมกัน — รวมตัวตั้ง ÷ รวมตัวหาร (BU ใหญ่หนักกว่า ไม่ใช่เฉลี่ย % ตรง ๆ) */
export function pooledUsage(rows: ReadonlyArray<Pick<TeamUsersBu, 'counts' | 'bases'>>, n: number): Array<number | null> {
  return Array.from({ length: n }, (_, i) =>
    ratio(
      rows.reduce((s, r) => s + (r.counts[i] ?? 0), 0),
      rows.reduce((s, r) => s + (r.bases[i] ?? 0), 0),
    ),
  );
}

/* ─────────────── ใบขอเข้า (อัตรา) ─────────────── */

/** ใบขอหนึ่งแถว (สำเนา ERP ก้อนเดียวกับ Dashboard) — `ymd` = วันที่ขอเข้ามา (`requestAddedYmd`) · `positions` = อัตรา */
export type RawRequestRow = { requestNo: string; ymd: string | null; bu: string | null; positions: number };

export type TeamRequestsBu = {
  bu: string;
  label: string;
  positions: TeamPair;
  requests: TeamPair;
  /** อัตราต่อช่วงย่อย */
  series: number[];
};

export function requestsSummary(
  w: TeamWindow,
  rows: readonly RawRequestRow[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
): { positions: TeamCount; requests: TeamPair; byBu: TeamRequestsBu[] } {
  const positions = sumCount(w, rows.map((r) => ({ ymd: r.ymd, n: r.positions })));
  const reqs = distinctCount(w, rows.map((r) => ({ who: r.requestNo, ymd: r.ymd })));
  // สำเนา ERP มีประวัติหลายปี — เอาเฉพาะ BU ที่มีใบในสองช่วงนี้ (BU ที่นาน ๆ มีใบทีเดียวไม่ต้องขึ้นแถวว่าง)
  const at = makeLocator(w);
  const bus = new Set<string>([...rows.filter((r) => at(r.ymd)).map((r) => r.bu ?? ''), ...extraBus]);
  const byBu = [...bus].map((bu): TeamRequestsBu => {
    const mine = rows.filter((r) => (r.bu ?? '') === bu);
    const p = sumCount(w, mine.map((r) => ({ ymd: r.ymd, n: r.positions })));
    const q = distinctCount(w, mine.map((r) => ({ who: r.requestNo, ymd: r.ymd })));
    return {
      bu,
      label: buLabel(labelOf, bu),
      positions: { cur: p.cur, prev: p.prev },
      requests: { cur: q.cur, prev: q.prev },
      series: p.series,
    };
  });
  return { positions, requests: { cur: reqs.cur, prev: reqs.prev }, byBu: sortBu(byBu, (r) => r.positions.cur) };
}

/* ─────────────── Lumos ทุกเลน (นับสาย · นิยามเดียวกับ Success Rate ของ Dashboard) ─────────────── */

export type TeamLane = 'public' | 'match' | 'follow' | 'other';

export const TEAM_LANES: ReadonlyArray<{ key: TeamLane; label: string }> = [
  { key: 'public', label: 'ผู้สมัครหน้าสาธารณะ' },
  { key: 'match', label: 'จับคู่งาน' },
  { key: 'follow', label: 'ติดตามก่อนเริ่มงาน' },
  { key: 'other', label: 'อื่น ๆ' },
];

/** แถวคิวโทรหนึ่งแถว — `ymd` = วันที่เข้าคิว (ตัวเดียวกับซีรีส์ Success Rate ของ Dashboard) */
export type RawQueueRow = {
  ymd: string | null;
  bu: string | null;
  lane: TeamLane;
  cancelled: boolean;
  outcome: string | null;
  summary: string | null;
  reply: string | null;
  personRef: string;
};

export type TeamLumosStats = {
  /** ส่งไป Lumos (ไม่นับยกเลิก) */
  sent: number;
  /** ยังรอโทร/รอผล */
  waiting: number;
  /** โทรแล้ว (มีผลกลับ) */
  called: number;
  /** สำเร็จ = ตอบรับเรื่องที่ถาม (`said_yes`) */
  success: number;
  /** ไม่สำเร็จ = โทรแล้วแต่ไม่ได้ตอบรับ (ไม่รับสาย · ปฏิเสธ · ยังไม่พร้อม · ไม่ชัด …) */
  fail: number;
  /** ได้คุยเรื่องของเราจริง — ฐานของ Success rate */
  talked: number;
};

export const emptyLumosStats = (): TeamLumosStats => ({ sent: 0, waiting: 0, called: 0, success: 0, fail: 0, talked: 0 });

/** Success rate — `null` = ยังไม่มีสายที่ได้คุยจริง (ห้ามโชว์ 0%) */
export const successRate = (s: TeamLumosStats): number | null => ratio(s.success, s.talked);

type Classified = { sent: boolean; called: boolean; talked: boolean; success: boolean };

/** จัดหนึ่งสาย — ตรงกับ `loadDailySeries` ของ `lumos-call-funnel` ทุกเงื่อนไข (ฐาน Success Rate ของ Dashboard) */
export function classifyQueueRow(r: RawQueueRow): Classified {
  if (r.cancelled) return { sent: false, called: false, talked: false, success: false };
  const oc = (r.outcome ?? '').trim();
  if (!oc) return { sent: true, called: false, talked: false, success: false };
  const bucket = classifyCallMicro({ outcome: oc, summary: r.summary, reply: r.reply }, vocabForPersonRef(r.personRef));
  const talked = !!bucket && bucket !== 'no_pickup' && bucket !== 'wrong_person' && bucket !== 'picked_silent';
  return { sent: true, called: true, talked, success: bucket === 'said_yes' };
}

function addStats(s: TeamLumosStats, c: Classified): void {
  if (!c.sent) return;
  s.sent += 1;
  if (!c.called) {
    s.waiting += 1;
    return;
  }
  s.called += 1;
  if (c.talked) s.talked += 1;
  if (c.success) s.success += 1;
  else s.fail += 1;
}

export type TeamLumosSeriesKey = 'sent' | 'called' | 'success' | 'rate';

export type TeamLumosBu = {
  bu: string;
  label: string;
  total: TeamLumosStats;
  prev: TeamLumosStats;
  lanes: Record<TeamLane, TeamLumosStats>;
  /** ต่อช่วงย่อย — `rate` = Success rate (0–1 · null = ไม่มีฐาน) */
  series: { sent: number[]; called: number[]; success: number[]; rate: Array<number | null> };
};

const lanesOf = () =>
  Object.fromEntries(TEAM_LANES.map((l) => [l.key, emptyLumosStats()])) as Record<TeamLane, TeamLumosStats>;

export function lumosSummary(
  w: TeamWindow,
  rows: readonly RawQueueRow[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
): {
  total: TeamLumosStats;
  prev: TeamLumosStats;
  called: TeamCount;
  lanes: Record<TeamLane, TeamLumosStats>;
  byBu: TeamLumosBu[];
} {
  const at = makeLocator(w);
  const total = emptyLumosStats();
  const prev = emptyLumosStats();
  const lanes = lanesOf();
  const called: TeamCount = { cur: 0, prev: 0, series: w.buckets.map(() => 0), prevSeries: w.prevBuckets.map(() => 0) };
  type Acc = { total: TeamLumosStats; prev: TeamLumosStats; lanes: Record<TeamLane, TeamLumosStats>; per: TeamLumosStats[] };
  const accs = new Map<string, Acc>();
  const accOf = (bu: string): Acc => {
    let a = accs.get(bu);
    if (!a) {
      a = { total: emptyLumosStats(), prev: emptyLumosStats(), lanes: lanesOf(), per: w.buckets.map(() => emptyLumosStats()) };
      accs.set(bu, a);
    }
    return a;
  };
  for (const b of extraBus) accOf(b);
  for (const r of rows) {
    const p = at(r.ymd);
    if (!p) continue;
    const c = classifyQueueRow(r);
    if (!c.sent) continue;
    const a = accOf(r.bu ?? '');
    if (p.side === 'cur') {
      addStats(total, c);
      addStats(lanes[r.lane], c);
      addStats(a.total, c);
      addStats(a.lanes[r.lane], c);
      addStats(a.per[p.i], c);
      if (c.called) {
        called.cur += 1;
        called.series[p.i] += 1;
      }
    } else {
      addStats(prev, c);
      addStats(a.prev, c);
      if (c.called) {
        called.prev += 1;
        called.prevSeries[p.i] += 1;
      }
    }
  }
  const byBu = [...accs].map(
    ([bu, a]): TeamLumosBu => ({
      bu,
      label: buLabel(labelOf, bu),
      total: a.total,
      prev: a.prev,
      lanes: a.lanes,
      series: {
        sent: a.per.map((s) => s.sent),
        called: a.per.map((s) => s.called),
        success: a.per.map((s) => s.success),
        rate: a.per.map((s) => successRate(s)),
      },
    }),
  );
  return { total, prev, called, lanes, byBu: sortBu(byBu, (r) => r.total.sent) };
}

/* ─────────────── Success ประกาศ (ใบที่ Gen link) ─────────────── */

/** ใบที่ Gen link แล้ว (ประกาศแรกของใบ · `ymd` = วันที่ Gen link ครั้งแรก) + ผู้สมัครของใบ (ไม่นับ Lead) */
export type RawPostingRow = { jobId: string; ymd: string; bu: string | null; applicants: number };

export function postingsSummary(
  w: TeamWindow,
  rows: readonly RawPostingRow[],
): { published: TeamCount; withApplicants: TeamPair; applicants: TeamPair } {
  const at = makeLocator(w);
  const withApplicants = { cur: 0, prev: 0 };
  const applicants = { cur: 0, prev: 0 };
  for (const r of rows) {
    const p = at(r.ymd);
    if (!p) continue;
    if (r.applicants > 0) withApplicants[p.side] += 1;
    applicants[p.side] += r.applicants;
  }
  return {
    published: distinctCount(w, rows.map((r) => ({ who: r.jobId, ymd: r.ymd }))),
    withApplicants,
    applicants,
  };
}

/* ─────────────── ติดตรงไหน ต่อ BU (กลุ่มใบขอที่เข้ามาในช่วงนี้ ตอนนี้ไปถึงขั้นไหน) ─────────────── */

export const FUNNEL_STAGES = [
  { key: 'requests', label: 'ใบขอเข้า' },
  { key: 'genLink', label: 'Gen link แล้ว' },
  { key: 'applicants', label: 'มีผู้สมัคร' },
  { key: 'aiCalled', label: 'AI โทรแล้ว' },
  { key: 'interested', label: 'มีคนสนใจ' },
  { key: 'appointed', label: 'มีนัด' },
  { key: 'showed', label: 'มาตามนัด' },
] as const;

export type FunnelStageKey = (typeof FUNNEL_STAGES)[number]['key'];

/** ใบขอหนึ่งใบของกลุ่ม + ขั้นที่มีอย่างน้อยหนึ่งคนไปถึงแล้ว (นับถึงตอนนี้) */
export type RawFunnelRequest = { requestNo: string; bu: string | null } & Record<Exclude<FunnelStageKey, 'requests'>, boolean>;

export type TeamFunnelRow = {
  bu: string;
  label: string;
  /** จำนวนใบที่ไปถึงแต่ละขั้น (ใบ) · null = ระบบยังไม่มีการบันทึกขั้นนี้เลย (ห้ามอ่านเป็น "ติดตรงนี้") */
  counts: Record<FunnelStageKey, number | null>;
  /** ขั้นที่หลุดมากสุดเทียบขั้นก่อนหน้า (null = ยังไม่มีใบขอเข้า / ไม่หลุดเลย) */
  stuckAt: FunnelStageKey | null;
};

/**
 * ขั้นที่หลุดมากสุด — สัดส่วนที่หายไปจากขั้นก่อนหน้า
 * ขั้นก่อนหน้าเป็น 0 หรือขั้นที่ยังไม่มีการบันทึก (null) = หยุดดูต่อ (ไม่มีข้อมูล ≠ ติด)
 */
export function stuckStage(counts: Record<FunnelStageKey, number | null>): FunnelStageKey | null {
  if (!counts.requests) return null;
  let best: { key: FunnelStageKey; drop: number } | null = null;
  for (let i = 1; i < FUNNEL_STAGES.length; i++) {
    const prevN = counts[FUNNEL_STAGES[i - 1].key];
    const curN = counts[FUNNEL_STAGES[i].key];
    if (!prevN || curN === null) break;
    const drop = 1 - curN / prevN;
    if (!best || drop > best.drop) best = { key: FUNNEL_STAGES[i].key, drop };
  }
  return best && best.drop > 0 ? best.key : null;
}

export function funnelRows(
  rows: readonly RawFunnelRequest[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
  /** ขั้นที่ระบบยังไม่มีการบันทึกเลย (เช่น ผลมาตามนัด) — ขึ้น "—" ไม่ใช่ 0 */
  unrecorded: ReadonlySet<FunnelStageKey> = new Set(),
): TeamFunnelRow[] {
  const bus = new Set<string>([...rows.map((r) => r.bu ?? ''), ...extraBus]);
  const out = [...bus].map((bu): TeamFunnelRow => {
    const mine = rows.filter((r) => (r.bu ?? '') === bu);
    const counts = Object.fromEntries(
      FUNNEL_STAGES.map((s) => [
        s.key,
        s.key === 'requests' ? mine.length : unrecorded.has(s.key) ? null : mine.filter((r) => r[s.key]).length,
      ]),
    ) as Record<FunnelStageKey, number | null>;
    return { bu, label: buLabel(labelOf, bu), counts, stuckAt: stuckStage(counts) };
  });
  return sortBu(out, (r) => r.counts.requests ?? 0);
}

/* ─────────────── แผงต่อ BU + ใบเปิดตอนนี้ ─────────────── */

/** ใบเปิดตอนนี้ของหนึ่ง BU (จาก feed เดียวกับกล่องงาน) */
export type RawOpenJob = { id: string; bu: string | null; positions: number; hasLink: boolean; staleNoApplicants: boolean };

export type TeamBuRow = {
  /** `''` = ไม่ระบุ BU (เช่น ใบล่วงหน้าที่ยังไม่มีไซต์) — แสดงให้ยอดรวมตรงหัวกล่องงาน แต่กดกรองไม่ได้ */
  bu: string;
  label: string;
  /** Gen link ครั้งแรกในช่วงนี้ (ใบ) · ในนั้นมีผู้สมัคร ≥ 1 · ผู้สมัครของใบกลุ่มนี้ (คน) */
  published: number;
  withApplicants: number;
  applicants: number;
  /** ใบขอเปิดอยู่ตอนนี้ · ในนั้นยังไม่มี Gen link · เหลือหา (อัตรา · ตัวเดียวกับหัวกล่องงาน) */
  openNow: number;
  openWithoutLink: number;
  remaining: number;
  /** Gen link เกิน 7 วันแล้วยังไม่มีผู้สมัคร (ใบเปิดอยู่) */
  staleNoApplicants: number;
};

export function buildBuRows(
  w: TeamWindow,
  input: {
    labelOf: (bu: string) => string;
    postings: readonly RawPostingRow[];
    openJobs: readonly RawOpenJob[];
    extraBus?: Iterable<string>;
  },
): TeamBuRow[] {
  const at = makeLocator(w);
  const bus = new Set<string>([...(input.extraBus ?? [])]);
  input.postings.forEach((r) => at(r.ymd)?.side === 'cur' && bus.add(r.bu ?? ''));
  input.openJobs.forEach((j) => bus.add(j.bu ?? ''));
  const same = (a: string | null, bu: string) => (a ?? '') === bu;
  const rows = [...bus].map((bu): TeamBuRow => {
    const post = postingsSummary(w, input.postings.filter((r) => same(r.bu, bu)));
    const open = input.openJobs.filter((j) => same(j.bu, bu));
    return {
      bu,
      label: buLabel(input.labelOf, bu),
      published: post.published.cur,
      withApplicants: post.withApplicants.cur,
      applicants: post.applicants.cur,
      openNow: open.length,
      openWithoutLink: open.filter((j) => !j.hasLink).length,
      remaining: open.reduce((s, j) => s + j.positions, 0),
      staleNoApplicants: open.filter((j) => j.staleNoApplicants).length,
    };
  });
  return sortBu(rows, (r) => r.openNow);
}

/* ─────────────── คำตอบของเส้น /api/team-online ─────────────── */

export type TeamOnlineResponse = {
  generated_at: string;
  scope: 'all' | 'code' | 'none';
  forced_bu: string | null;
  bu: string | null;
  window: TeamWindow;
  /** ตัวเลือก BU (ทุก BU ที่มีข้อมูลตามสิทธิ์) */
  bu_options: Array<{ bu: string; label: string }>;
  /** คนใช้งาน = เจ้าหน้าที่ที่ล็อกอินหรือบันทึกงาน · ยอดรวม = ทุก BU เสมอ · `byBu` = % ของบัญชีใน BU + บทบาท */
  users: {
    total: TeamCount;
    accounts: TeamPair;
    coverage: TeamCoverage;
    byBu: TeamUsersBu[];
  } | null;
  /** ใบขอเข้า นับเป็นอัตรา (+ จำนวนใบ) — ERP บันทึกเป็นวัน */
  requests: {
    positions: TeamCount;
    requests: TeamPair;
    coverage: TeamCoverage;
    stale: boolean;
    ageSeconds: number;
    byBu: TeamRequestsBu[];
  } | null;
  /** Lumos ทุกเลน นับสาย · กลุ่มตามวันที่เข้าคิว */
  lumos: {
    total: TeamLumosStats;
    prev: TeamLumosStats;
    called: TeamCount;
    lanes: Record<TeamLane, TeamLumosStats>;
    coverage: TeamCoverage;
    byBu: TeamLumosBu[];
  } | null;
  /** Success ประกาศ = ใบที่ Gen link แล้วมีผู้สมัคร ≥ 1 ÷ ใบที่ Gen link ในช่วง */
  postings: {
    published: TeamCount;
    withApplicants: TeamPair;
    applicants: TeamPair;
    coverage: TeamCoverage;
  } | null;
  /** ติดตรงไหน ต่อ BU — กลุ่มใบขอที่เข้ามาในช่วงนี้ */
  funnel: TeamFunnelRow[] | null;
  /** แผง BU + ใบเปิดตอนนี้ — ทุก BU เสมอ (ผู้ใช้ถูกล็อกแผนกเห็นแถวเดียว) */
  byBu: TeamBuRow[] | null;
  errors: Partial<Record<'users' | 'requests' | 'lumos' | 'postings' | 'funnel' | 'byBu', string>>;
};

/* ─────────────── แถบ "สิ่งที่ต้องจับตา" ─────────────── */

export type TeamWatchItem = { key: string; text: string; tone: 'success' | 'warn' | 'danger' | 'neutral' };

/**
 * สรุปอัตโนมัติจากตัวเลขบนหน้า — ของที่ขยับมากสุด 2 เรื่อง (เทียบช่วงก่อน) + BU ที่ยังไม่ใช้ระบบ + งานที่ต้องทำ
 * 🔴 เทียบเฉพาะตอนที่ **ข้อมูลครบทั้งสองช่วง** — ช่วงก่อนที่ระบบเพิ่งเริ่มเก็บกลางทาง (`partial`) เคยขึ้น
 *    "Lumos โทรเพิ่ม 1,400%" (วัดจริง 29 ก.ย.: คิวเริ่ม 16 ส.ค. กลางช่วงก่อน) ⇒ การ์ดติดธงแทน แถบนี้ไม่พูดถึง
 */
export function teamWatchItems(r: TeamOnlineResponse): TeamWatchItem[] {
  const moves: Array<{ key: string; label: string; unit: string; cur: number; prev: number }> = [];
  const push = (key: string, label: string, unit: string, c: TeamPair | null | undefined, cov: TeamCoverage | undefined) => {
    if (!c || !cov || cov.prev !== 'full' || cov.cur !== 'full' || c.cur === c.prev) return;
    moves.push({ key, label, unit, cur: c.cur, prev: c.prev });
  };
  push('users', 'คนใช้งาน', 'คน', r.users?.total, r.users?.coverage);
  push('positions', 'อัตราที่ขอเข้า', 'อัตรา', r.requests?.positions, r.requests?.coverage);
  push('called', 'Lumos โทร', 'สาย', r.lumos?.called, r.lumos?.coverage);
  push('published', 'Gen link ใหม่', 'ใบ', r.postings?.published, r.postings?.coverage);
  const rel = (m: (typeof moves)[number]) => Math.abs(m.cur - m.prev) / Math.max(1, m.prev);
  const items: TeamWatchItem[] = moves
    .sort((a, b) => rel(b) - rel(a))
    .slice(0, 2)
    .map((m) => ({
      key: m.key,
      text: `${m.label}${countDelta(m.cur, m.prev, m.unit).text}`,
      tone: m.cur > m.prev ? 'success' : 'warn',
    }));

  // BU ที่ยังไม่ใช้ระบบ — สิ่งที่ผู้บริหารต้องเห็นก่อน (*"อ้อทีมนี้ยังไม่ใช้"*)
  for (const u of r.users?.byBu ?? []) {
    if (!u.bu || (r.bu && u.bu !== r.bu)) continue;
    if (u.accounts === 0) items.push({ key: `noacc-${u.bu}`, text: `${u.bu} ยังไม่มีบัญชีในระบบ`, tone: 'danger' });
    else if (u.users === 0) {
      items.push({ key: `nouse-${u.bu}`, text: `${u.bu} ยังไม่มีคนใช้ (0 จาก ${NUM.format(u.accounts)} บัญชี)`, tone: 'danger' });
    }
  }
  const rows = r.byBu ?? [];
  const pick = (f: (x: TeamBuRow) => number) => rows.reduce((s, x) => s + (r.bu && x.bu !== r.bu ? 0 : f(x)), 0);
  const noLink = pick((x) => x.openWithoutLink);
  const stale = pick((x) => x.staleNoApplicants);
  if (noLink > 0) items.push({ key: 'noLink', text: `ใบเปิดยังไม่ Gen link ${NUM.format(noLink)} ใบ`, tone: 'warn' });
  if (stale > 0) items.push({ key: 'stale', text: `Gen link เกิน 7 วันยังไม่มีผู้สมัคร ${NUM.format(stale)} ใบ`, tone: 'danger' });
  return items;
}
