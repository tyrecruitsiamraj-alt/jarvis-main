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
import { RELEASE_STEP_TEXT } from '@/lib/boardRelease';
import { classifyCallMicro, vocabForPersonRef } from '@/lib/callMicroOutcome';
import { JOB_LANES, JOB_LANE_LABEL, type JobLane } from '@/lib/jobLanes';
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

/**
 * บัญชีผู้ใช้ — `bu` = BU กลางของแผนกบนบัญชี (`''` = ยังไม่ผูกแผนก)
 * `lanes` = สายงานจากหน้าผู้ใช้งาน (`users.job_lanes` · migration 114) — ว่าง = ยังไม่ตั้ง
 */
export type RawAccount = { id: string; bu: string; role: string; active: boolean; createdYmd: string | null; lanes?: readonly string[] | null };
/** ใช้งานหนึ่งวัน (คนไม่ซ้ำต่อวัน — SQL จัดให้แล้ว) · `lastAt` = เวลาล่าสุดของวันนั้น (ISO) */
export type RawActivity = { uid: string; ymd: string; lastAt?: string | null };

/**
 * ประเภทคนบนโดนัทคนใช้งาน (รอบ 5 · เจ้าของ: *"เป็น หัวหน้า สรรหา ปิดใบขอ online ฯลฯ เท่าไหร่"*)
 * → Choice **"สายงานจากหน้าผู้ใช้งาน + หัวหน้า"** — หัวหน้า = สิทธิ์ `supervisor` · ที่เหลือ = สายงานที่ติ๊กไว้
 * ⚠️ คนหนึ่งอยู่ได้หลายสาย — นับสายแรกตามลำดับ `JOB_LANES` (ให้ยอดรวมโดนัทเท่าจำนวนคน)
 * ⚠️ ยังไม่ตั้งสายงาน = บอกตรง ๆ (วัด 29 ก.ย. 2569: ตั้งแล้ว 20 จาก 58 คน) ห้ามเดาจาก role
 */
export type PersonKind = 'supervisor' | JobLane | 'admin' | 'unset';

export const PERSON_KINDS: ReadonlyArray<{ key: PersonKind; label: string }> = [
  { key: 'supervisor', label: 'หัวหน้า' },
  { key: 'recruiter', label: JOB_LANE_LABEL.recruiter },
  { key: 'screener', label: `${JOB_LANE_LABEL.screener} (ปิดใบขอ)` },
  { key: 'opl', label: JOB_LANE_LABEL.opl },
  { key: 'online', label: JOB_LANE_LABEL.online },
  { key: 'admin', label: 'ผู้ดูแลระบบ' },
  { key: 'unset', label: 'ยังไม่ตั้งสายงาน' },
];

export const PERSON_KIND_LABEL: Record<PersonKind, string> = Object.fromEntries(
  PERSON_KINDS.map((k) => [k.key, k.label]),
) as Record<PersonKind, string>;

export function personKindOf(a: { role: string; lanes?: readonly string[] | null }): PersonKind {
  if (a.role === 'supervisor') return 'supervisor';
  const lane = JOB_LANES.find((l) => (a.lanes ?? []).includes(l));
  if (lane) return lane;
  if (a.role === 'admin') return 'admin';
  return 'unset';
}

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
  /** แยกประเภทคน (หัวหน้า · สายงาน · ยังไม่ตั้ง) — เฉพาะประเภทที่มีบัญชี · ใช้กับโดนัทตอนจี้ */
  kinds: Array<{ key: PersonKind; label: string; accounts: number; users: number }>;
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
    const kinds = PERSON_KINDS.map((k) => {
      const of = cur.filter((a) => personKindOf(a) === k.key);
      return { key: k.key, label: k.label, accounts: of.length, users: of.filter((a) => usedCur.has(a.id)).length };
    }).filter((k) => k.accounts > 0);
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
      kinds,
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

/**
 * ใบขอหนึ่งแถว (สำเนา ERP ก้อนเดียวกับ Dashboard) — `ymd` = วันที่ขอเข้ามา (`requestAddedYmd`) · `positions` = อัตรา
 * `kind` = อัตราก้อนนี้จบยังไง (ERP แตกใบเดียวเป็นหลายแถวตามผล: หาได้แล้ว / ยกเลิก / ยังเหลือ)
 */
export type RawRequestRow = {
  requestNo: string;
  ymd: string | null;
  bu: string | null;
  positions: number;
  kind?: 'filled' | 'cancelled' | 'remaining';
};

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
  /** ต่อช่วงย่อย — `rate` = Success rate (0–1 · null = ไม่มีฐาน) · `talked` = ฐานของ rate (รวมหลาย BU = รวมตัวตั้ง ÷ รวมตัวหาร) */
  series: { sent: number[]; called: number[]; success: number[]; talked: number[]; rate: Array<number | null> };
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
        talked: a.per.map((s) => s.talked),
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

/** ใบเปิดตอนนี้ของหนึ่ง BU (จาก feed เดียวกับกล่องงาน) — เลน/ผู้สมัครของใบอยู่ `RawBoardJob` (ตัวคิดเดียวกับกล่องงาน) */
export type RawOpenJob = { id: string; bu: string | null; positions: number };

export type TeamBuRow = {
  /** `''` = ไม่ระบุ BU (เช่น ใบล่วงหน้าที่ยังไม่มีไซต์) — แสดงให้ยอดรวมตรงหัวกล่องงาน แต่กดกรองไม่ได้ */
  bu: string;
  label: string;
  /** Gen link ครั้งแรกในช่วงนี้ (ใบ) · ในนั้นมีผู้สมัคร ≥ 1 · ผู้สมัครของใบกลุ่มนี้ (คน) */
  published: number;
  withApplicants: number;
  applicants: number;
  /** ใบขอเปิดอยู่ตอนนี้ · เหลือหา (อัตรา · ตัวเดียวกับหัวกล่องงาน) */
  openNow: number;
  remaining: number;
  /** Gen link ครั้งแรกต่อช่วงย่อย (ใบ) — กราฟแท่งของการ์ด Success ประกาศ */
  series: number[];
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
      remaining: open.reduce((s, j) => s + j.positions, 0),
      series: post.published.series,
    };
  });
  return sortBu(rows, (r) => r.openNow);
}

/* ─────────────── ผู้สมัคร: มาจากไหน · มาแล้วยังไง (ถังเดียวกับศูนย์คุมงานสรรหา) ─────────────── */

/**
 * ถังของใบสมัคร — **แบ่งแบบเดียวกับ `OVERVIEW_BUCKETS`** (`api/_lib/applicantOverviewSql.ts`) ไม่ทับกัน รวมได้ทั้งหมด
 * `bucket` = คีย์ของหน้ารายชื่อ (`/jobs/board?view=list&bucket=`) — กดแล้วเจอถังเดียวกัน
 */
export type ApplicantStage = 'untouched' | 'held' | 'in_queue' | 'contact_failed' | 'success_unscheduled' | 'scheduled';

export const APPLICANT_STAGES: ReadonlyArray<{ key: ApplicantStage; label: string }> = [
  { key: 'untouched', label: 'ยังไม่มีใครแตะ' },
  { key: 'held', label: 'มีคนรับไปแล้ว ยังไม่โทร' },
  { key: 'in_queue', label: 'อยู่ในคิว AI' },
  { key: 'contact_failed', label: 'โทรแล้ว ติดต่อไม่ได้' },
  { key: 'success_unscheduled', label: 'ติดต่อได้ ยังไม่ได้นัด' },
  { key: 'scheduled', label: 'นัดแล้ว' },
];

/** ใบสมัครหนึ่งใบ — ข้อเท็จจริงจาก `buildApplicantFactsSql` (ไม่มีชื่อ/เบอร์) */
export type RawApplicant = {
  id: string;
  ymd: string;
  createdAt: string;
  lead: boolean;
  /** คีย์ช่องทางที่ผู้สมัครเลือกเอง ("รู้จักเราจากไหน") — ป้ายแปลงฝั่งหน้าเว็บด้วย `REFERRAL_SOURCE_LABEL` */
  source: string | null;
  bu: string | null;
  jobId: string | null;
  called: boolean;
  inQueue: boolean;
  held: boolean;
  latestClass: 'success' | 'failed' | null;
  hasAppointment: boolean;
  /** กรอกแล้วกี่ชั่วโมงกว่าจะถูกโทรครั้งแรก (null = ยังไม่ถูกโทร) */
  waitHours: number | null;
};

/** ถังของใบ — ลำดับตัดสินเดียวกับ `buildOverviewSql` */
export function applicantStage(r: Pick<RawApplicant, 'called' | 'inQueue' | 'held' | 'latestClass' | 'hasAppointment'>): ApplicantStage {
  if (r.called) return r.latestClass === 'success' ? (r.hasAppointment ? 'scheduled' : 'success_unscheduled') : 'contact_failed';
  if (r.inQueue) return 'in_queue';
  if (r.held) return 'held';
  return 'untouched';
}

const emptyStages = (): Record<ApplicantStage, number> =>
  Object.fromEntries(APPLICANT_STAGES.map((s) => [s.key, 0])) as Record<ApplicantStage, number>;

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

export type TeamApplicantsBu = {
  bu: string;
  label: string;
  total: TeamPair;
  stages: Record<ApplicantStage, number>;
  /** ยังไม่ถูกโทรและกรอกมาเกิน 5 วัน (นิยามเดียวกับ `over5d` ของศูนย์คุมงานสรรหา) */
  over5d: number;
  waitMedianHours: number | null;
  /** ช่องทาง (คีย์ `referral_source` · `''` = ไม่ระบุ) → จำนวนใบในช่วงนี้ */
  sources: Record<string, number>;
  /** ใบสมัครต่อช่วงย่อย — กราฟแท่งของการ์ดผู้สมัครใหม่ */
  series: number[];
};

export function applicantsSummary(
  w: TeamWindow,
  rows: readonly RawApplicant[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
  nowMs = Date.now(),
): { total: TeamCount; leads: number; stages: Record<ApplicantStage, number>; over5d: number; waitMedianHours: number | null; sources: Record<string, number>; byBu: TeamApplicantsBu[] } {
  const at = makeLocator(w);
  const cutoff5d = nowMs - 5 * 86_400_000;
  const total = distinctCount(w, rows.map((r) => ({ who: r.id, ymd: r.ymd })));
  const cur = rows.filter((r) => at(r.ymd)?.side === 'cur');
  const fold = (list: readonly RawApplicant[]) => {
    const stages = emptyStages();
    const sources: Record<string, number> = {};
    let over5d = 0;
    for (const r of list) {
      stages[applicantStage(r)] += 1;
      const src = r.source ?? '';
      sources[src] = (sources[src] ?? 0) + 1;
      if (!r.called && Date.parse(r.createdAt) < cutoff5d) over5d += 1;
    }
    const waits = list.map((r) => r.waitHours).filter((v): v is number => v !== null && Number.isFinite(v) && v >= 0);
    return { stages, sources, over5d, waitMedianHours: median(waits) };
  };
  const all = fold(cur);
  const bus = new Set<string>([...rows.filter((r) => at(r.ymd)).map((r) => r.bu ?? ''), ...extraBus]);
  const byBu = [...bus].map((bu): TeamApplicantsBu => {
    const mine = rows.filter((r) => (r.bu ?? '') === bu);
    const c = distinctCount(w, mine.map((r) => ({ who: r.id, ymd: r.ymd })));
    const f = fold(mine.filter((r) => at(r.ymd)?.side === 'cur'));
    return { bu, label: buLabel(labelOf, bu), total: { cur: c.cur, prev: c.prev }, series: c.series, ...f };
  });
  return {
    total,
    leads: cur.filter((r) => r.lead).length,
    ...all,
    byBu: sortBu(byBu, (r) => r.total.cur),
  };
}

/**
 * งานค้างของใบสมัคร **ตอนนี้** (ทุกวันที่สมัคร) — ประชากรเดียวกับหน้ารายชื่อ `/jobs/board?view=list&bucket=`
 * (หน้ารายชื่อไม่กรองตามช่วงวันที่บนหน้านี้ ⇒ งานที่ต้องทำต้องนับทั้งกอง ไม่งั้นกดไปเจอเลขไม่เท่า)
 */
export function applicantBacklog(rows: readonly RawApplicant[], nowMs = Date.now()): { stages: Record<ApplicantStage, number>; over5d: number } {
  const stages = emptyStages();
  let over5d = 0;
  const cutoff5d = nowMs - 5 * 86_400_000;
  for (const r of rows) {
    stages[applicantStage(r)] += 1;
    if (!r.called && Date.parse(r.createdAt) < cutoff5d) over5d += 1;
  }
  return { stages, over5d };
}

/* ─────────────── ใบที่ยังไม่มีผู้สมัคร — เลนเดียวกับกล่องงาน (`buildReleaseLedger`) ─────────────── */

/** ใบเปิดหนึ่งใบในมุมของกล่องงาน (ฝั่ง server ประกอบด้วยตัวคิดเดียวกับกล่องงาน) */
export type RawBoardJob = {
  id: string;
  /** รหัสใบฝั่ง ERP (`JobRequest.externalId`) — หน้าเว็บประกอบลิงก์ด้วย `boardPostingPath` ตัวเดียวกับกล่องงาน */
  externalId: string | null;
  requestNo: string;
  unit: string;
  bu: string | null;
  positions: number;
  /** ค้างมาแล้วกี่วันนับจากวันที่ของใบขอ (`jobRequestDateYmd`) · null = ไม่รู้วันที่ */
  ageDays: number | null;
  released: boolean;
  /** ยังเป็นงานหาคนของเรา (`stillSourcing`) */
  sourcing: boolean;
  applicants: number;
  /** ขั้นที่ติดของใบที่ยังไม่ปล่อย (`releaseStepOf`) · ใบที่ปล่อยแล้ว = null */
  step: 'info' | 'place' | 'benefits' | 'publish' | null;
};

/** อายุใบ — แยก "เกิน 90 วัน" ออกมาเพราะเจอใบเปิดค้างถึง 874 วัน (วัดจริง 29 ก.ย. 2569) ควรตรวจว่ายังต้องการคนไหม */
export const AGE_BUCKETS: ReadonlyArray<{ key: string; label: string; max: number }> = [
  { key: 'd0_3', label: '0–3 วัน', max: 3 },
  { key: 'd4_7', label: '4–7 วัน', max: 7 },
  { key: 'd8_14', label: '8–14 วัน', max: 14 },
  { key: 'd15_30', label: '15–30 วัน', max: 30 },
  { key: 'd31_90', label: '31–90 วัน', max: 90 },
  { key: 'd91', label: 'เกิน 90 วัน', max: Number.POSITIVE_INFINITY },
];

export const ageBucketOf = (days: number): string => (AGE_BUCKETS.find((b) => days <= b.max) ?? AGE_BUCKETS[AGE_BUCKETS.length - 1]).key;

/**
 * ใบที่ยังต้องหาคนแต่ **ยังไม่มีผู้สมัครเลย** — ปล่อยแล้วเงียบ (`silent`) หรือยังไม่ปล่อยและยังต้องหาคน (`sourcing`)
 * ใบที่ ERP พาไปเริ่มงานแล้ว (`started`) ไม่นับ — ไม่ต้องหาคนแล้ว
 */
export const isNoApplicantJob = (j: RawBoardJob): boolean => j.applicants === 0 && (j.released || j.sourcing);

export type TeamLaneRow = {
  bu: string;
  label: string;
  /** ใบเปิดทั้งหมดในมุมกล่องงาน */
  open: number;
  /** เลนของกล่องงาน — บวกกันได้: sourcing + started = ยังไม่ปล่อย · applied + silent = ปล่อยแล้ว */
  sourcing: number;
  started: number;
  applied: number;
  silent: number;
  /** ยังไม่ปล่อย แต่มีลิงก์แล้ว (ขั้น ④ เหลือกดส่งประกาศ) */
  publish: number;
  /** ยังต้องหาคนแต่ยังไม่มีผู้สมัครเลย (silent + sourcing ที่ไม่มีผู้สมัคร) · แยกตามอายุใบ */
  noApplicants: number;
  aging: Record<string, number>;
  /** ใบที่ค้างนานสุดกี่วัน (ในกลุ่มไม่มีผู้สมัคร) */
  oldestDays: number | null;
};

export function laneRows(jobs: readonly RawBoardJob[], labelOf: (bu: string) => string, extraBus: Iterable<string> = []): TeamLaneRow[] {
  const bus = new Set<string>([...jobs.map((j) => j.bu ?? ''), ...extraBus]);
  const rows = [...bus].map((bu): TeamLaneRow => {
    const mine = jobs.filter((j) => (j.bu ?? '') === bu);
    const none = mine.filter(isNoApplicantJob);
    const aging = Object.fromEntries(AGE_BUCKETS.map((b) => [b.key, 0])) as Record<string, number>;
    for (const j of none) if (j.ageDays !== null) aging[ageBucketOf(j.ageDays)] += 1;
    const ages = none.map((j) => j.ageDays).filter((d): d is number => d !== null);
    return {
      bu,
      label: buLabel(labelOf, bu),
      open: mine.length,
      sourcing: mine.filter((j) => !j.released && j.sourcing).length,
      started: mine.filter((j) => !j.released && !j.sourcing).length,
      applied: mine.filter((j) => j.released && j.applicants > 0).length,
      silent: mine.filter((j) => j.released && j.applicants === 0).length,
      publish: mine.filter((j) => !j.released && j.step === 'publish').length,
      noApplicants: none.length,
      aging,
      oldestDays: ages.length ? Math.max(...ages) : null,
    };
  });
  return sortBu(rows, (r) => r.noApplicants);
}

/** ใบไม่มีผู้สมัครที่ค้างนานสุด — ให้เจ้าหน้าที่กดไปทำต่อทีละใบ */
export type TeamStaleJob = Pick<RawBoardJob, 'id' | 'externalId' | 'requestNo' | 'unit' | 'bu' | 'positions' | 'ageDays' | 'released'>;

export function oldestNoApplicantJobs(jobs: readonly RawBoardJob[], limit = 30): TeamStaleJob[] {
  return jobs
    .filter(isNoApplicantJob)
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || b.positions - a.positions)
    .slice(0, limit)
    .map(({ id, externalId, requestNo, unit, bu, positions, ageDays, released }) => ({ id, externalId, requestNo, unit, bu, positions, ageDays, released }));
}

/* ─────────────── รายชื่อคนใช้งาน (เฉพาะหัวหน้า/admin — เจ้าของเคาะ 29 ก.ย. 2569) ─────────────── */

export type TeamPerson = {
  id: string;
  name: string;
  role: string;
  bu: string;
  /** หัวหน้า / สายงาน / ยังไม่ตั้ง — ตัวเดียวกับโดนัท (`personKindOf`) */
  kind: PersonKind;
  /** ใช้ระบบกี่วันในช่วงนี้ (0 = ไม่ได้ใช้) */
  days: number;
  /** ใช้ล่าสุดวันไหน (ในข้อมูลที่ดึงมา ไม่เกินปลายช่วง) */
  lastYmd: string | null;
  /**
   * **Online ล่าสุด** (ISO) — เวลาล่าสุดที่เห็นคนนี้ในระบบ: ล็อกอินล่าสุดทั้งหมด (`auth.login.success`) หรืองานที่บันทึกในข้อมูลที่ดึงมา
   * `null` = ไม่เคยเห็นเลย ⇒ "ยังไม่เคยเข้าระบบ" (นับได้ตั้งแต่ระบบเริ่มเก็บล็อก 1 ก.ค. 2569)
   */
  lastAt: string | null;
};

const laterIso = (a: string | null | undefined, b: string | null | undefined): string | null => {
  if (!a) return b ?? null;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
};

/**
 * รายชื่อคนที่มีบัญชีในช่วงนี้ (รอบ 5 · เจ้าของ: *"รายชื่อที่ทำเป็น Pagination เรียงตาม Bu บอกว่า ใครบ้าง Bu อะไร
 * Online ล่าสุดเมื่อไหร่ มีใครยังไม่เคยเข้าระบบ"*)
 * เรียง: BU (ไม่ระบุ BU ท้ายสุด) → Online ล่าสุดใหม่ก่อน → คนที่ยังไม่เคยเข้าระบบท้าย BU
 */
export function peopleOf(
  w: TeamWindow,
  accounts: ReadonlyArray<RawAccount & { name: string }>,
  activity: readonly RawActivity[],
  lastLogin: ReadonlyMap<string, string> = new Map(),
): TeamPerson[] {
  const days = new Map<string, Set<string>>();
  const last = new Map<string, string>();
  const lastAt = new Map<string, string>();
  for (const e of activity) {
    // SQL ส่งเวลาล่าสุดของวันมาเสมอ · ไม่มี (ของเก่า) = ใช้วันนั้นแทน — ห้ามปล่อยให้คนที่มีร่องรอยกลายเป็น "ยังไม่เคยเข้าระบบ"
    const seen = laterIso(lastAt.get(e.uid), e.lastAt ?? `${e.ymd}T00:00:00+07:00`);
    if (seen) lastAt.set(e.uid, seen);
    if (e.ymd > w.range.to) continue;
    const prev = last.get(e.uid);
    if (!prev || e.ymd > prev) last.set(e.uid, e.ymd);
    if (e.ymd < w.range.from) continue;
    const set = days.get(e.uid) ?? new Set<string>();
    set.add(e.ymd);
    days.set(e.uid, set);
  }
  const buOrder = (bu: string) => (bu ? 0 : 1);
  return accounts
    .filter((a) => eligible(a, w.range.to, days.has(a.id)))
    .map(
      (a): TeamPerson => ({
        id: a.id,
        name: a.name,
        role: a.role,
        bu: a.bu,
        kind: personKindOf(a),
        days: days.get(a.id)?.size ?? 0,
        lastYmd: last.get(a.id) ?? null,
        lastAt: laterIso(lastLogin.get(a.id), lastAt.get(a.id)),
      }),
    )
    .sort(
      (a, b) =>
        buOrder(a.bu) - buOrder(b.bu) ||
        a.bu.localeCompare(b.bu) ||
        (b.lastAt ? Date.parse(b.lastAt) : -1) - (a.lastAt ? Date.parse(a.lastAt) : -1) ||
        a.name.localeCompare(b.name, 'th'),
    );
}

/* ─────────────── อัตราที่ขอเข้า: อนุมัติแล้ว · รอดำเนินการ · ไม่อนุมัติ (รอบ 5) ─────────────── */

/**
 * เจ้าของ: *"อัตราที่ขอเข้ามา มี Visual ให้กด 3 อัน — Approve แล้ว · รอดำเนินการ · ไม่อนุมัติ"* → Choice:
 * - **อนุมัติแล้ว = Gen link แล้ว** (ตามที่เคาะรอบแรก) — จี้แล้วบอก *"มีคนสมัครมากี่ใบ ใบละกี่คน"*
 * - **รอดำเนินการ = ยังไม่ Gen link** — จี้แล้วบอก *"รออะไร"* = ขั้นที่ติดบนกล่องงาน (`releaseStepOf`) / มีคนเริ่มงานแล้ว / ปิดแล้ว
 * - **ไม่อนุมัติ = ทีมตั้ง "ไม่ปล่อย + เหตุผล"** ที่กล่องงาน (migration 129) — จี้แล้วบอก *"ไม่อนุมัติเพราะอะไร"*
 * ลำดับตัดสิน: ไม่ปล่อย (และยังไม่ขึ้นหน้าสาธารณะ) → Gen link → รอ · กลุ่มใบ = ใบขอที่เข้ามาในช่วงนี้ (ตัวเดียวกับการ์ด) · นับเป็นอัตรา
 * ⚠️ "อนุมัติ" ตามนิยามนี้ ≠ "ปล่อยแล้ว" ของกล่องงาน (ใบที่มีลิงก์แล้วยังไม่ส่งประกาศนับเป็นอนุมัติ) — เจ้าของเลือกเองโดยรู้ว่าเลขสองหน้าต่างกัน
 */
export type RequestDecision = 'approved' | 'pending' | 'rejected';

export const REQUEST_DECISIONS: ReadonlyArray<{ key: RequestDecision; label: string; hint: string }> = [
  { key: 'approved', label: 'อนุมัติแล้ว', hint: 'Gen link แล้ว' },
  { key: 'pending', label: 'รอดำเนินการ', hint: 'ยังไม่ Gen link' },
  { key: 'rejected', label: 'ไม่อนุมัติ', hint: 'ทีมตั้ง “ไม่ปล่อย” พร้อมเหตุผล' },
];

/**
 * ใบที่รอดำเนินการ "รออะไร" — ขั้นใช้ป้ายเดียวกับกล่องงาน (`RELEASE_STEP_TEXT`) · "มีคนเริ่มงานแล้ว" คำเดียวกับชิปกล่องงาน
 * อัตราที่ ERP บอกว่าจบแล้ว (หาได้แล้ว / ยกเลิก) ไม่ได้ "รอ" อะไร แต่ต้องบอกให้เห็น (ไม่งั้นดูเหมือนค้างทั้งกอง)
 * 🔴 หาได้แล้ว ≠ ปิดครบใบขอ — นับเป็นอัตราของแถวที่ ERP บอกว่า filled เท่านั้น
 */
export type PendingWait = 'info' | 'place' | 'benefits' | 'publish' | 'started' | 'filled' | 'cancelled' | 'closed';

export const PENDING_WAITS: ReadonlyArray<{ key: PendingWait; label: string }> = [
  { key: 'info', label: RELEASE_STEP_TEXT.info.label },
  { key: 'place', label: RELEASE_STEP_TEXT.place.label },
  { key: 'benefits', label: RELEASE_STEP_TEXT.benefits.label },
  { key: 'publish', label: RELEASE_STEP_TEXT.publish.label },
  { key: 'started', label: 'มีคนเริ่มงานแล้ว' },
  { key: 'filled', label: 'หาได้แล้ว (ไม่ต้องประกาศ)' },
  { key: 'cancelled', label: 'ยกเลิกแล้ว' },
  { key: 'closed', label: 'ไม่อยู่ในกล่องงานแล้ว' },
];

/** ใบขอหนึ่งใบที่ตัดสินแล้ว (ฝั่ง server ประกอบจาก ERP + ประกาศ + ทะเบียนไม่ปล่อย + กล่องงาน) */
export type RawDecisionRequest = {
  requestNo: string;
  ymd: string | null;
  bu: string | null;
  positions: number;
  decision: RequestDecision;
  /** รอดำเนินการ: รออะไร */
  wait: PendingWait | null;
  /** ไม่อนุมัติ: คีย์เหตุผล + คำอ่าน */
  reason: string | null;
  reasonText: string | null;
  /** อนุมัติแล้ว: ผู้สมัครของใบ (ไม่นับ Lead) */
  applicants: number;
};

export type TeamDecisionStat = { positions: number; requests: number; series: number[] };

export type TeamDecisionPart = {
  decisions: Record<RequestDecision, TeamDecisionStat>;
  /** ของใบที่อนุมัติแล้ว: มีผู้สมัครกี่ใบ · ผู้สมัครรวมกี่คน */
  approvedApplicants: { withApplicants: number; applicants: number };
  waits: Record<PendingWait, { positions: number; requests: number }>;
  reasons: Array<{ key: string; text: string; positions: number; requests: number }>;
};

export type TeamDecisionBu = TeamDecisionPart & { bu: string; label: string };

function foldDecisions(w: TeamWindow, rows: readonly RawDecisionRequest[]): TeamDecisionPart {
  const at = makeLocator(w);
  const stat = (): TeamDecisionStat => ({ positions: 0, requests: 0, series: w.buckets.map(() => 0) });
  const decisions: Record<RequestDecision, TeamDecisionStat> = { approved: stat(), pending: stat(), rejected: stat() };
  const waits = Object.fromEntries(PENDING_WAITS.map((x) => [x.key, { positions: 0, requests: 0 }])) as TeamDecisionPart['waits'];
  const reasons = new Map<string, { key: string; text: string; positions: number; requests: number }>();
  const approvedApplicants = { withApplicants: 0, applicants: 0 };
  // ERP แตกใบเดียวเป็นหลายแถว (ตามผลของอัตรา) ⇒ อัตรานับทุกแถว · "ใบ" นับครั้งเดียวต่อเลขที่ใบ
  const once = new Set<string>();
  const first = (group: string, r: RawDecisionRequest) => {
    const k = `${group}|${r.requestNo}`;
    if (once.has(k)) return false;
    once.add(k);
    return true;
  };
  for (const r of rows) {
    const p = at(r.ymd);
    if (p?.side !== 'cur') continue;
    const d = decisions[r.decision];
    d.positions += r.positions;
    d.series[p.i] += r.positions;
    if (first(`d:${r.decision}`, r)) d.requests += 1;
    if (r.decision === 'approved') {
      if (first('app', r)) {
        if (r.applicants > 0) approvedApplicants.withApplicants += 1;
        approvedApplicants.applicants += r.applicants;
      }
    } else if (r.decision === 'pending' && r.wait) {
      waits[r.wait].positions += r.positions;
      if (first(`w:${r.wait}`, r)) waits[r.wait].requests += 1;
    } else if (r.decision === 'rejected') {
      // "อื่น ๆ" แยกตามข้อความที่พิมพ์ · เหตุผลในรายการรวมตามคีย์
      const text = r.reasonText ?? 'ไม่ระบุเหตุผล';
      const key = r.reason === 'other' ? `other:${text}` : (r.reason ?? 'none');
      const g = reasons.get(key) ?? { key, text, positions: 0, requests: 0 };
      g.positions += r.positions;
      if (first(`r:${key}`, r)) g.requests += 1;
      reasons.set(key, g);
    }
  }
  return {
    decisions,
    approvedApplicants,
    waits,
    reasons: [...reasons.values()].sort((a, b) => b.positions - a.positions || b.requests - a.requests),
  };
}

export function decisionSummary(
  w: TeamWindow,
  rows: readonly RawDecisionRequest[],
  labelOf: (bu: string) => string,
  extraBus: Iterable<string> = [],
): { total: TeamDecisionPart; byBu: TeamDecisionBu[] } {
  const at = makeLocator(w);
  const bus = new Set<string>([...rows.filter((r) => at(r.ymd)?.side === 'cur').map((r) => r.bu ?? ''), ...extraBus]);
  const byBu = [...bus].map(
    (bu): TeamDecisionBu => ({ bu, label: buLabel(labelOf, bu), ...foldDecisions(w, rows.filter((r) => (r.bu ?? '') === bu)) }),
  );
  const size = (r: TeamDecisionBu) => r.decisions.approved.positions + r.decisions.pending.positions + r.decisions.rejected.positions;
  return { total: foldDecisions(w, rows), byBu: sortBu(byBu, size) };
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
  /** ผู้สมัคร (ใบ) ที่กรอกเข้ามาในช่วงนี้ — มาจากไหน · มาแล้วยังไง (ถังเดียวกับศูนย์คุมงานสรรหา) */
  applicants: {
    total: TeamCount;
    leads: number;
    stages: Record<ApplicantStage, number>;
    over5d: number;
    waitMedianHours: number | null;
    sources: Record<string, number>;
    coverage: TeamCoverage;
    byBu: TeamApplicantsBu[];
    /** งานค้างตอนนี้ทุกวันที่สมัคร (ตามตัวกรอง BU ของหน้า) — ใช้วิเคราะห์ */
    backlog: { stages: Record<ApplicantStage, number>; over5d: number };
    /**
     * งานค้างตอนนี้ **ทั้งสิทธิ์ของคนเปิด** (ไม่ตามตัวกรอง BU ของหน้า) — ประชากรเดียวกับหน้ารายชื่อ `?bucket=`
     * 🔴 "งานที่ต้องทำต่อ" ต้องใช้ตัวนี้ — หน้ารายชื่อไม่มีตัวกรอง BU ⇒ ใช้ตัวตามตัวกรองแล้วกดไปเจอเลขไม่เท่า
     */
    backlogScope: { stages: Record<ApplicantStage, number>; over5d: number };
  } | null;
  /**
   * ใบเปิดในมุมกล่องงาน (ตอนนี้) — เลน + ใบยังไม่มีผู้สมัครแยกอายุ
   * `total` = ตามตัวกรอง BU ของหน้า (วิเคราะห์) · `scope` = ทั้งสิทธิ์ของคนเปิด (= กล่องงาน ซึ่งไม่มีตัวกรอง BU — งานที่ต้องทำใช้ตัวนี้)
   */
  lanes: { total: TeamLaneRow; scope: TeamLaneRow; byBu: TeamLaneRow[]; oldest: TeamStaleJob[] } | null;
  /** รายชื่อคนใช้งาน — เฉพาะหัวหน้า/admin (คนอื่นได้ null) */
  people: TeamPerson[] | null;
  /**
   * อัตราที่ขอเข้าในช่วงนี้ แยก อนุมัติแล้ว (Gen link) · รอดำเนินการ · ไม่อนุมัติ (ไม่ปล่อย + เหตุผล) — รอบ 5
   * `total` = ตามตัวกรอง BU ของหน้า · `byBu` = ทุก BU ตามสิทธิ์ · `skipsReady` = อ่านทะเบียน "ไม่ปล่อย" ได้ (ไม่ได้ = ไม่อนุมัติเป็น 0 เพราะอ่านไม่ได้)
   */
  decisions: { total: TeamDecisionPart; byBu: TeamDecisionBu[]; skipsReady: boolean } | null;
  /** แผง BU + ใบเปิดตอนนี้ — ทุก BU เสมอ (ผู้ใช้ถูกล็อกแผนกเห็นแถวเดียว) */
  byBu: TeamBuRow[] | null;
  errors: Partial<Record<'users' | 'requests' | 'lumos' | 'postings' | 'funnel' | 'byBu' | 'applicants' | 'lanes' | 'decisions', string>>;
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
  // ผู้สมัครที่มาแล้วติดตรงไหน (งานค้างตอนนี้) + ใบที่ยังไม่มีผู้สมัครนานแล้ว (เลนเดียวกับกล่องงาน)
  const back = r.applicants?.backlog;
  if (back && back.stages.success_unscheduled > 0) {
    items.push({ key: 'unscheduled', text: `ติดต่อได้แล้ว ยังไม่ได้นัด ${NUM.format(back.stages.success_unscheduled)} ใบ`, tone: 'danger' });
  }
  if (back && back.over5d > 0) items.push({ key: 'over5d', text: `ใบสมัครยังไม่ถูกโทรเกิน 5 วัน ${NUM.format(back.over5d)} ใบ`, tone: 'warn' });
  const lane = r.lanes?.total;
  if (lane) {
    const old = (lane.aging.d31_90 ?? 0) + (lane.aging.d91 ?? 0);
    if (old > 0) items.push({ key: 'noapp30', text: `ใบยังไม่มีผู้สมัครเกิน 30 วัน ${NUM.format(old)} ใบ`, tone: 'warn' });
  }
  return items;
}
