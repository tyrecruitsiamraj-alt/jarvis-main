/**
 * ═══ หน้า "ทีม Online" — ชนิดข้อมูล + ตัวคิด pure (29 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"หน้าหลัก ฉันจะเริ่มแก้ใหม่ … อันนี้ฉันจะเริ่มจากทีม Online"* + ภาพต้นแบบ → Choice
 * **"ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน"** · คนใช้งาน = **เจ้าหน้าที่ที่เข้าใช้ระบบ** ·
 * อนุมัติ/เผยแพร่ = **ใบที่ Gen link แล้ว** (*"ใบที่ Genlink มันก็ไปหน้าสาธารณะหนิ"*) · ความคุ้มค่า = **เว้นไว้ก่อน**
 *
 * ช่วงเวลาแบบในภาพ = **ถึงตอนนี้ เทียบช่วงก่อนถึงจุดเดียวกัน** (วันนี้ถึง 12:00 เทียบเมื่อวานถึง 12:00 ·
 * สัปดาห์นี้จันทร์–ตอนนี้ เทียบสัปดาห์ก่อนจันทร์–เวลาเดียวกัน · เดือน/ปี แบบเดียวกัน) · ปฏิทินกรุงเทพ (ไม่มีเวลาออม)
 */

import { UNREACHED_CALL_OUTCOMES } from '@/lib/callOutcomeBuckets';
import { aiCallSteps } from '@/lib/homeOverview';

export type TeamPeriod = 'today' | 'week' | 'month' | 'year';

export const TEAM_PERIODS: ReadonlyArray<{ key: TeamPeriod; label: string }> = [
  { key: 'today', label: 'วันนี้' },
  { key: 'week', label: 'สัปดาห์นี้' },
  { key: 'month', label: 'เดือนนี้' },
  { key: 'year', label: 'ปีนี้' },
];

export function isTeamPeriod(v: unknown): v is TeamPeriod {
  return v === 'today' || v === 'week' || v === 'month' || v === 'year';
}

export type TeamGrain = 'hour' | 'day' | 'month';

export type TeamBucket = {
  /** คีย์ช่วงย่อยแบบเดียวกับที่ SQL จัดกลุ่ม (`YYYY-MM-DD HH` · `YYYY-MM-DD` · `YYYY-MM`) */
  key: string;
  label: string;
};

export type TeamWindow = {
  period: TeamPeriod;
  grain: TeamGrain;
  /** ช่วงนี้ = [start, now) · ช่วงก่อน = [prevStart, prevEnd) — ISO (UTC) */
  start: string;
  now: string;
  prevStart: string;
  prevEnd: string;
  /** วันแบบปฏิทินไทยของทั้งสองช่วง (ปลายรวมวันนั้น) — ใช้กับข้อมูลที่มีแต่วันที่ (ใบขอ ERP) */
  startYmd: string;
  endYmd: string;
  prevStartYmd: string;
  prevEndYmd: string;
  /** ช่วงย่อยของสองช่วง จับคู่ตามลำดับ (ช่วงก่อนยาวเท่ากันเสมอ) */
  buckets: TeamBucket[];
  prevBuckets: TeamBucket[];
};

const BKK = 7 * 3_600_000;
const pad = (n: number) => String(n).padStart(2, '0');
const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

/** ส่วนประกอบวันเวลาแบบกรุงเทพ */
function bkkParts(d: Date) {
  const t = new Date(d.getTime() + BKK);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), dow: t.getUTCDay() };
}
/** เวลา UTC ของเวลาไทยที่ระบุ */
const bkkAt = (y: number, m: number, d: number, h = 0) => new Date(Date.UTC(y, m, d, h) - BKK);
const ymdOf = (d: Date) => {
  const p = bkkParts(d);
  return `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`;
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

function bucketsBetween(start: Date, end: Date, grain: TeamGrain): TeamBucket[] {
  const out: TeamBucket[] = [];
  const s = bkkParts(start);
  if (grain === 'hour') {
    for (let t = bkkAt(s.y, s.m, s.d, s.h); t < end; t = new Date(t.getTime() + 3_600_000)) {
      const p = bkkParts(t);
      out.push({ key: `${p.y}-${pad(p.m + 1)}-${pad(p.d)} ${pad(p.h)}`, label: pad(p.h) });
    }
    return out;
  }
  if (grain === 'day') {
    for (let t = bkkAt(s.y, s.m, s.d); t < end; t = new Date(t.getTime() + 86_400_000)) {
      const p = bkkParts(t);
      out.push({ key: `${p.y}-${pad(p.m + 1)}-${pad(p.d)}`, label: `${p.d} ${THAI_MONTH[p.m]}` });
    }
    return out;
  }
  let y = s.y;
  let m = s.m;
  while (bkkAt(y, m, 1) < end) {
    out.push({ key: `${y}-${pad(m + 1)}`, label: THAI_MONTH[m] });
    m += 1;
    if (m === 12) {
      m = 0;
      y += 1;
    }
  }
  return out;
}

/** ช่วงนี้/ช่วงก่อน ของปุ่มช่วงเวลา — `now` = ตอนนี้ */
export function teamOnlineWindow(period: TeamPeriod, now: Date): TeamWindow {
  const p = bkkParts(now);
  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;
  let grain: TeamGrain;
  if (period === 'today') {
    start = bkkAt(p.y, p.m, p.d);
    prevStart = new Date(start.getTime() - 86_400_000);
    prevEnd = new Date(now.getTime() - 86_400_000);
    grain = 'hour';
  } else if (period === 'week') {
    const back = (p.dow + 6) % 7; // จันทร์ = 0
    start = bkkAt(p.y, p.m, p.d - back);
    prevStart = new Date(start.getTime() - 7 * 86_400_000);
    prevEnd = new Date(now.getTime() - 7 * 86_400_000);
    grain = 'day';
  } else if (period === 'month') {
    start = bkkAt(p.y, p.m, 1);
    const py = p.m === 0 ? p.y - 1 : p.y;
    const pm = p.m === 0 ? 11 : p.m - 1;
    prevStart = bkkAt(py, pm, 1);
    // วันเดียวกันของเดือนก่อน (เดือนก่อนสั้นกว่า = ตัดที่สิ้นเดือน) + เวลาเดียวกัน
    const day = Math.min(p.d, daysInMonth(py, pm));
    const sinceDayStart = now.getTime() - bkkAt(p.y, p.m, p.d).getTime();
    prevEnd = new Date(bkkAt(py, pm, day).getTime() + sinceDayStart);
    grain = 'day';
  } else {
    start = bkkAt(p.y, 0, 1);
    prevStart = bkkAt(p.y - 1, 0, 1);
    const day = Math.min(p.d, daysInMonth(p.y - 1, p.m));
    const sinceDayStart = now.getTime() - bkkAt(p.y, p.m, p.d).getTime();
    prevEnd = new Date(bkkAt(p.y - 1, p.m, day).getTime() + sinceDayStart);
    grain = 'month';
  }
  const buckets = bucketsBetween(start, now, grain);
  const prevAll = bucketsBetween(prevStart, prevEnd, grain);
  // จับคู่ตามลำดับ — ช่วงก่อนมีช่วงย่อยเท่ากัน (ตัดส่วนเกิน/เติมป้ายว่างถ้าเดือนก่อนสั้นกว่า)
  const prevBuckets = buckets.map((_, i) => prevAll[i] ?? { key: `__none_${i}`, label: '' });
  return {
    period,
    grain,
    start: start.toISOString(),
    now: now.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: prevEnd.toISOString(),
    startYmd: ymdOf(start),
    endYmd: ymdOf(now),
    prevStartYmd: ymdOf(prevStart),
    prevEndYmd: ymdOf(new Date(prevEnd.getTime() - 1)),
    buckets,
    prevBuckets,
  };
}

const TH_DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
const TH_TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });

/** "29 ก.ย. ถึง 12:00 เทียบ 28 ก.ย. ถึง 12:00" · ช่วงยาวกว่าวัน = "1 ก.ย. – 29 ก.ย. 12:00 เทียบ …" */
export function teamWindowText(w: TeamWindow): string {
  const s = new Date(w.start);
  const n = new Date(w.now);
  const ps = new Date(w.prevStart);
  const pe = new Date(w.prevEnd);
  if (w.period === 'today') {
    return `${TH_DATE.format(s)} ถึง ${TH_TIME.format(n)} เทียบ ${TH_DATE.format(ps)} ถึง ${TH_TIME.format(pe)}`;
  }
  return `${TH_DATE.format(s)} – ${TH_DATE.format(n)} ${TH_TIME.format(n)} เทียบ ${TH_DATE.format(ps)} – ${TH_DATE.format(pe)} ${TH_TIME.format(pe)}`;
}

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

export const fmtPct = (r: number | null): string => (r === null ? '—' : `${PCT1.format(r * 100)}%`);

/* ─────────────── ช่วงย่อยของเหตุการณ์ + ความครอบคลุมของข้อมูล ─────────────── */

/** คีย์ช่วงย่อยของเวลา (ISO) แบบกรุงเทพ — รูปเดียวกับ `TeamBucket.key` และ `to_char` ฝั่ง SQL */
export function bucketKeyOf(at: string | Date, grain: TeamGrain): string {
  const p = bkkParts(typeof at === 'string' ? new Date(at) : at);
  const ym = `${p.y}-${pad(p.m + 1)}`;
  if (grain === 'month') return ym;
  const ymd = `${ym}-${pad(p.d)}`;
  return grain === 'day' ? ymd : `${ymd} ${pad(p.h)}`;
}

/** รูปแบบ `to_char` ของ postgres ที่ให้คีย์ตรงกับ `bucketKeyOf` */
export const SQL_BUCKET_FORMAT: Record<TeamGrain, string> = {
  hour: 'YYYY-MM-DD HH24',
  day: 'YYYY-MM-DD',
  month: 'YYYY-MM',
};

export type TeamSide = 'cur' | 'prev';

/** เวลานี้อยู่ช่วงไหน (ช่วงนี้/ช่วงก่อน/นอกทั้งสอง) — ปลายช่วงไม่รวม */
export function sideOf(w: TeamWindow, at: string | Date | null | undefined): TeamSide | null {
  if (!at) return null;
  const t = (typeof at === 'string' ? new Date(at) : at).getTime();
  if (Number.isNaN(t)) return null;
  if (t >= Date.parse(w.start) && t < Date.parse(w.now)) return 'cur';
  if (t >= Date.parse(w.prevStart) && t < Date.parse(w.prevEnd)) return 'prev';
  return null;
}

/** วันที่ (ข้อมูลที่มีแต่วัน) อยู่ช่วงไหน — ปลายช่วงรวมวันนั้น */
export function sideOfYmd(w: TeamWindow, ymd: string | null | undefined): TeamSide | null {
  if (!ymd) return null;
  if (ymd >= w.startYmd && ymd <= w.endYmd) return 'cur';
  if (ymd >= w.prevStartYmd && ymd <= w.prevEndYmd) return 'prev';
  return null;
}

/**
 * ข้อมูลเริ่มมีเมื่อไหร่เทียบกับสองช่วง — ระบบเพิ่งเริ่มเก็บหลายตาราง (คิวโทร 16 ส.ค. · ประกาศ 5 ส.ค. 2569)
 * ⇒ "ช่วงก่อน 0" ของช่วงที่ยังไม่มีข้อมูลเป็นเลขโกหก ต้องขึ้น "—" (`none`) หรือติดธง (`partial`)
 */
export type TeamCoverage = { since: string | null; cur: 'full' | 'partial'; prev: 'full' | 'partial' | 'none' };

export function coverageOf(w: TeamWindow, since: string | null): TeamCoverage {
  if (!since) return { since: null, cur: 'full', prev: 'full' };
  const t = Date.parse(since);
  return {
    since,
    cur: t > Date.parse(w.start) ? 'partial' : 'full',
    prev: t >= Date.parse(w.prevEnd) ? 'none' : t > Date.parse(w.prevStart) ? 'partial' : 'full',
  };
}

/** นับของไม่ซ้ำ (คน/ใบ) ต่อช่วง และต่อช่วงย่อยของแต่ละช่วง */
export function distinctCount(
  w: TeamWindow,
  events: Iterable<{ who: string; side: TeamSide; key: string }>,
): TeamCount {
  const total = { cur: new Set<string>(), prev: new Set<string>() };
  const per = { cur: new Map<string, Set<string>>(), prev: new Map<string, Set<string>>() };
  for (const e of events) {
    total[e.side].add(e.who);
    const m = per[e.side];
    const set = m.get(e.key) ?? new Set<string>();
    set.add(e.who);
    m.set(e.key, set);
  }
  const sizes = (m: Map<string, Set<string>>) => new Map([...m].map(([k, v]) => [k, v.size]));
  return {
    cur: total.cur.size,
    prev: total.prev.size,
    series: seriesOf(w.buckets, sizes(per.cur)),
    prevSeries: seriesOf(w.prevBuckets, sizes(per.prev)),
  };
}

/* ─────────────── คำตอบของเส้น /api/team-online ─────────────── */

export type TeamCount = { cur: number; prev: number; series: number[]; prevSeries: number[] };
export type TeamPair = { cur: number; prev: number };

export type TeamBuRow = {
  /** `''` = ไม่ระบุ BU (เช่น ใบล่วงหน้าที่ยังไม่มีไซต์) — แสดงให้ยอดรวมตรงหัวกล่องงาน แต่กดกรองไม่ได้ */
  bu: string;
  label: string;
  /** ใบขอเข้าช่วงนี้ (ใบ) · null = อ่าน ERP ไม่ได้ (ห้าม 0 ปลอม) */
  requestsIn: number | null;
  /** ใบที่ Gen link ครั้งแรกในช่วงนี้ (ใบ) · ในนั้นมีผู้สมัคร ≥ 1 คน · ผู้สมัครของใบกลุ่มนี้ (คน) */
  published: number;
  withApplicants: number;
  applicants: number;
  /** Lumos โทรผู้สมัครหน้าสาธารณะช่วงนี้ (คน) · null = อ่านคิวโทรไม่ได้ */
  called: number | null;
  reached: number | null;
  interested: number | null;
  noAnswer: number | null;
  /** ใบขอเปิดอยู่ตอนนี้ · ในนั้นยังไม่มี Gen link · เหลือหา (อัตรา · ตัวเดียวกับหัวกล่องงาน) */
  openNow: number;
  openWithoutLink: number;
  remaining: number;
  /** Gen link เกิน 7 วันแล้วยังไม่มีผู้สมัคร (ใบเปิดอยู่) */
  staleNoApplicants: number;
};

export type TeamOnlineResponse = {
  generated_at: string;
  period: TeamPeriod;
  scope: 'all' | 'code' | 'none';
  forced_bu: string | null;
  bu: string | null;
  window: TeamWindow;
  /** ตัวเลือก BU (ทุก BU ที่มีข้อมูลตามสิทธิ์) */
  bu_options: Array<{ bu: string; label: string }>;
  /** คนใช้งาน = เจ้าหน้าที่ที่ล็อกอินหรือบันทึกงานในช่วงนั้น — **ทุก BU เสมอ** */
  users: (TeamCount & { coverage: TeamCoverage }) | null;
  /** ใบขอเข้า — ERP บันทึกเป็นวัน (`dateOnly`) ⇒ วันนี้เทียบเมื่อวานทั้งวัน · ไม่มีเส้นรายชั่วโมง */
  requestsIn: (TeamCount & { dateOnly: true; coverage: TeamCoverage; stale: boolean }) | null;
  /** เลนหน้าสาธารณะ (ผู้สมัครจากประกาศ/ลิงก์) — นับเป็นคน (เบอร์ไม่ซ้ำ) */
  lumos: {
    called: TeamCount;
    reached: TeamPair;
    interested: TeamPair;
    noAnswer: TeamPair;
    coverage: TeamCoverage;
  } | null;
  /** Success ประกาศ = ใบที่ Gen link แล้วมีผู้สมัคร ≥ 1 ÷ ใบที่ Gen link ในช่วง (กลุ่มใบตามวัน Gen link ครั้งแรก) */
  postings: {
    published: TeamCount;
    withApplicants: TeamPair;
    applicants: TeamPair;
    coverage: TeamCoverage;
  } | null;
  /** ทุก BU เสมอ (แผง "BU ไหนงานเยอะ" + ตาราง) — ผู้ใช้ถูกล็อกแผนกเห็นแถวเดียว */
  byBu: TeamBuRow[] | null;
  errors: Partial<Record<'users' | 'requestsIn' | 'lumos' | 'postings' | 'byBu', string>>;
};

/** เรียงค่าตามช่วงย่อยของ window (ช่วงย่อยที่ไม่มีข้อมูล = 0) */
export function seriesOf(buckets: readonly TeamBucket[], counts: ReadonlyMap<string, number>): number[] {
  return buckets.map((b) => counts.get(b.key) ?? 0);
}

/* ─────────────── ตัวประกอบคำตอบจากแถวดิบ (pure — เส้น API ทำแค่อ่านฐาน) ─────────────── */

/** คู่ (คน, ช่วงย่อย, ช่วง) ที่ SQL นับไม่ซ้ำมาให้แล้ว */
export type RawUserRow = { uid: string; bucket: string; cur: boolean };

export function usersCount(w: TeamWindow, rows: readonly RawUserRow[]): TeamCount {
  return distinctCount(
    w,
    rows.map((r) => ({ who: r.uid, key: r.bucket, side: r.cur ? ('cur' as const) : ('prev' as const) })),
  );
}

/** ใบขอหนึ่งแถว (จากสำเนา ERP ก้อนเดียวกับ Dashboard) — `day` = วันที่ขอเข้ามา */
export type RawRequestRow = { requestNo: string; day: string | null; bu: string | null };

export function requestsCount(w: TeamWindow, rows: readonly RawRequestRow[]): TeamCount {
  const events: Array<{ who: string; side: TeamSide; key: string }> = [];
  for (const r of rows) {
    const side = sideOfYmd(w, r.day);
    if (!side || !r.day) continue;
    // ERP มีแต่วัน — ช่วงย่อยรายชั่วโมงทำไม่ได้ (เส้นว่าง) · รายวัน/รายเดือนทำได้
    const key = w.grain === 'month' ? r.day.slice(0, 7) : w.grain === 'day' ? r.day : '';
    events.push({ who: r.requestNo, side, key });
  }
  const c = distinctCount(w, events);
  return w.grain === 'hour' ? { ...c, series: [], prevSeries: [] } : c;
}

/** แถวคิวโทรเลนหน้าสาธารณะที่มีผลแล้ว */
export type RawCallRow = {
  who: string;
  bu: string | null;
  personRef: string;
  outcome: string | null;
  summary: string | null;
  reply: string | null;
  firstAt: string | null;
  lastAt: string | null;
};

const UNREACHED = new Set<string>(UNREACHED_CALL_OUTCOMES);

/**
 * โทรแล้ว = มีสายในช่วง (ผลแรกหรือผลล่าสุด) · ติดต่อได้/สนใจ/ไม่รับสาย = ผลล่าสุดของแถว ณ เวลาผลล่าสุด
 * (จัดถังด้วย `aiCallSteps` ตัวเดียวกับหน้าหลักโฉม 3 ก้อน — "สนใจ" = `said_yes`)
 */
export function callsSummary(
  w: TeamWindow,
  rows: readonly RawCallRow[],
): { called: TeamCount; reached: TeamPair; interested: TeamPair; noAnswer: TeamPair } {
  const called: Array<{ who: string; side: TeamSide; key: string }> = [];
  const sets = {
    reached: { cur: new Set<string>(), prev: new Set<string>() },
    interested: { cur: new Set<string>(), prev: new Set<string>() },
    noAnswer: { cur: new Set<string>(), prev: new Set<string>() },
  };
  for (const r of rows) {
    const steps = aiCallSteps({ outcome: r.outcome, summary: r.summary, reply: r.reply, personRef: r.personRef });
    if (steps.length === 0) continue;
    for (const at of new Set([r.firstAt, r.lastAt])) {
      const side = sideOf(w, at);
      if (side && at) called.push({ who: r.who, side, key: bucketKeyOf(at, w.grain) });
    }
    const last = sideOf(w, r.lastAt);
    if (!last) continue;
    if (steps.includes('connected')) sets.reached[last].add(r.who);
    if (steps.includes('interested')) sets.interested[last].add(r.who);
    if (UNREACHED.has((r.outcome ?? '').trim().toLowerCase())) sets.noAnswer[last].add(r.who);
  }
  const pair = (s: { cur: Set<string>; prev: Set<string> }) => ({ cur: s.cur.size, prev: s.prev.size });
  return {
    called: distinctCount(w, called),
    reached: pair(sets.reached),
    interested: pair(sets.interested),
    noAnswer: pair(sets.noAnswer),
  };
}

/** ใบที่ Gen link แล้ว (ประกาศแรกของใบ) + ผู้สมัครของใบ (ไม่นับ Lead · ตัวเดียวกับเลขบนการ์ดกล่องงาน) */
export type RawPostingRow = { jobId: string; firstAt: string; bu: string | null; applicants: number };

export function postingsSummary(
  w: TeamWindow,
  rows: readonly RawPostingRow[],
): { published: TeamCount; withApplicants: TeamPair; applicants: TeamPair } {
  const events: Array<{ who: string; side: TeamSide; key: string }> = [];
  const withApplicants = { cur: 0, prev: 0 };
  const applicants = { cur: 0, prev: 0 };
  for (const r of rows) {
    const side = sideOf(w, r.firstAt);
    if (!side) continue;
    events.push({ who: r.jobId, side, key: bucketKeyOf(r.firstAt, w.grain) });
    if (r.applicants > 0) withApplicants[side] += 1;
    applicants[side] += r.applicants;
  }
  return { published: distinctCount(w, events), withApplicants, applicants };
}

/** ใบเปิดตอนนี้ของหนึ่ง BU (จาก feed เดียวกับกล่องงาน) */
export type RawOpenJob = { id: string; bu: string | null; positions: number; hasLink: boolean; staleNoApplicants: boolean };

export function buildBuRows(
  w: TeamWindow,
  input: {
    labelOf: (bu: string) => string;
    /** null = แหล่งนั้นอ่านไม่ได้ ⇒ คอลัมน์ของมันเป็น null ทั้งแถว (แผงยังขึ้นจากแหล่งที่เหลือ) */
    requests: readonly RawRequestRow[] | null;
    postings: readonly RawPostingRow[];
    calls: readonly RawCallRow[] | null;
    openJobs: readonly RawOpenJob[];
  },
): TeamBuRow[] {
  const bus = new Set<string>();
  const add = (bu: string | null) => {
    bus.add(bu ?? '');
  };
  const same = (a: string | null, bu: string) => (a ?? '') === bu;
  input.requests?.forEach((r) => sideOfYmd(w, r.day) === 'cur' && add(r.bu));
  input.postings.forEach((r) => sideOf(w, r.firstAt) === 'cur' && add(r.bu));
  input.calls?.forEach((r) => (sideOf(w, r.lastAt) === 'cur' || sideOf(w, r.firstAt) === 'cur') && add(r.bu));
  input.openJobs.forEach((j) => add(j.bu));
  const rows = [...bus].map((bu): TeamBuRow => {
    const req = input.requests ? requestsCount(w, input.requests.filter((r) => same(r.bu, bu))) : null;
    const post = postingsSummary(w, input.postings.filter((r) => same(r.bu, bu)));
    const call = input.calls ? callsSummary(w, input.calls.filter((r) => same(r.bu, bu))) : null;
    const open = input.openJobs.filter((j) => same(j.bu, bu));
    return {
      bu,
      label: input.labelOf(bu),
      requestsIn: req ? req.cur : null,
      published: post.published.cur,
      withApplicants: post.withApplicants.cur,
      applicants: post.applicants.cur,
      called: call ? call.called.cur : null,
      reached: call ? call.reached.cur : null,
      interested: call ? call.interested.cur : null,
      noAnswer: call ? call.noAnswer.cur : null,
      openNow: open.length,
      openWithoutLink: open.filter((j) => !j.hasLink).length,
      remaining: open.reduce((s, j) => s + j.positions, 0),
      staleNoApplicants: open.filter((j) => j.staleNoApplicants).length,
    };
  });
  // ไม่ระบุ BU อยู่ท้ายเสมอ
  return rows.sort(
    (a, b) =>
      Number(a.bu === '') - Number(b.bu === '') ||
      (b.requestsIn ?? 0) - (a.requestsIn ?? 0) ||
      b.openNow - a.openNow ||
      a.bu.localeCompare(b.bu),
  );
}

/* ─────────────── แถบ "สิ่งที่ต้องจับตา" ─────────────── */

export type TeamWatchItem = { key: string; text: string; tone: 'success' | 'warn' | 'danger' | 'neutral' };

/**
 * สรุปอัตโนมัติจากตัวเลขบนหน้า — ของที่ขยับมากสุด 2 เรื่อง (เทียบช่วงก่อน) + งานที่ต้องทำ
 * ช่วงก่อนที่ยังไม่มีข้อมูล (`coverage.prev = none`) ไม่เอามาเทียบ — ห้ามพูดว่า "เพิ่มขึ้น" จากฐานที่ไม่มี
 */
export function teamWatchItems(r: TeamOnlineResponse): TeamWatchItem[] {
  const moves: Array<{ key: string; label: string; unit: string; cur: number; prev: number; upGood: boolean }> = [];
  const push = (key: string, label: string, unit: string, c: TeamPair | null, cov: TeamCoverage | undefined, upGood = true) => {
    if (!c || !cov || cov.prev === 'none' || c.cur === c.prev) return;
    moves.push({ key, label, unit, cur: c.cur, prev: c.prev, upGood });
  };
  push('users', 'คนใช้งาน', 'คน', r.users, r.users?.coverage);
  push('requestsIn', 'ใบขอเข้า', 'ใบ', r.requestsIn, r.requestsIn?.coverage);
  push('called', 'Lumos โทร', 'คน', r.lumos?.called ?? null, r.lumos?.coverage);
  push('published', 'Gen link ใหม่', 'ใบ', r.postings?.published ?? null, r.postings?.coverage);
  const rel = (m: (typeof moves)[number]) => Math.abs(m.cur - m.prev) / Math.max(1, m.prev);
  const items: TeamWatchItem[] = moves
    .sort((a, b) => rel(b) - rel(a))
    .slice(0, 2)
    .map((m) => {
      const d = countDelta(m.cur, m.prev, m.unit);
      const good = (m.cur > m.prev) === m.upGood;
      return { key: m.key, text: `${m.label}${d.text}`, tone: good ? 'success' : 'warn' };
    });
  const rows = r.byBu ?? [];
  const pick = (f: (x: TeamBuRow) => number) => rows.reduce((s, x) => s + (r.bu && x.bu !== r.bu ? 0 : f(x)), 0);
  const noLink = pick((x) => x.openWithoutLink);
  const stale = pick((x) => x.staleNoApplicants);
  if (noLink > 0) items.push({ key: 'noLink', text: `ใบเปิดยังไม่ Gen link ${NUM.format(noLink)} ใบ`, tone: 'warn' });
  if (stale > 0) items.push({ key: 'stale', text: `Gen link เกิน 7 วันยังไม่มีผู้สมัคร ${NUM.format(stale)} ใบ`, tone: 'danger' });
  return items;
}
