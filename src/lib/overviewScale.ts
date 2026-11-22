/**
 * ═══ แท็บ "Scale ลง" ของหน้าภาพรวมงานสรรหา (เจ้าของ 20 พ.ย. 2569) ═══
 * > *"อยากมีแท็บเดียวแต่กดแล้ว Scale ลงเรื่อยๆ"* · *"กล่องมันต้องกดได้ทั้งหมดสิ่"* · *"9 เรื่องเอามาด้วย"*
 * > *"แก้ทั้งหมดไว้อีกแท็บของหน้าภาพรวม แล้วเดี๋ยวฉันเปิดดูแล้วตัดสินใจเองว่าจะเอาอันไหนไว้"*
 *
 * ชั้น: ทั้งหมด → BU → คน → ช่องทาง → กลุ่ม (+ แกนวัน) · ทุกชั้นมีกล่องเลขชุดเดียวกัน ที่เดิม
 * กดกล่องไหน = เลขนั้นแยกตามชั้นถัดไป — แถวลูกคิดจาก `scaleSections` ของชั้นลูกเอง ⇒ เลขในแถว = เลขที่จะเห็นเมื่อกดลงไป
 *
 * 🔴 ไม่มีนิยามใหม่ของเลขเดิม — ทุกเลขยืมตัวคิดกลาง:
 *   รายชื่อ `buildRecruitJourney` · คนหามา `bringerOf` · ช่องทาง/กลุ่ม `funnelSubChannelOf` / `funnelSubOf`
 *   ใบขอ `flowOf` + `isPostingStarted` · งาน `staffWorkTotal` · ค่าปรับ/นาฬิกา = รายใบของ `/api/home-money`
 * ของใหม่ในไฟล์นี้มี 2 อย่าง (ให้เจ้าของดูเลขจริงก่อนคงไว้): "ทำ 100 งาน ได้กี่รายชื่อ" + "เทียบกับทีม"
 * ตรรกะล้วน ไม่มี IO — เทสต์ `overviewScale.test.ts`
 */
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';
import { STAFF_PERSON_KINDS, staffWorkTotal, emptyStaffKinds, type StaffActivityKind, type StaffActivityRow, type StaffKindCounts, type StaffRosterRow } from '@/lib/staffActivity';
import { flowOf, recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { NOT_STARTED_STATES, POSTING_STATES, POSTING_STATE_LABEL, isPostingStarted, postingStateOf, type PostingState } from '@/lib/recruitPostingState';
import type { MoneyRequest } from '@/lib/homeMoney';
import { NO_REASON } from '@/lib/homeExec';
import { PREQUEST_LEDGER_PREFIX, ledgerJobIdOf } from '@/lib/requestPenaltyLedger';
import { buildRecruitJourney, staffResultOf, type JourneyStep } from '@/lib/recruitJourney';
import { bringerOf, funnelSubChannelOf, funnelSubOf } from '@/lib/channelFunnel';
import { BU_UNKNOWN, buOfFact } from '@/lib/recruitAudience';
import { normalizeTrendBu } from '@/lib/trends/bu';
import { AREA_FIT_LABEL, AREA_UNKNOWN, ageFitOf, areaFitOf, genderFitOf, type AreaFit, type RuleFit } from '@/lib/applicantFit';
import { LINK_CREATOR_SINCE, MANUAL_POSTED_SINCE, SO_POST_SINCE, comparableSince, type TrendSense } from '@/lib/recruitScale';

export type ScaleLevel = { bu: string | null; who: string | null; ch: string | null; grp: string | null; day: string | null };
export const SCALE_ROOT: ScaleLevel = { bu: null, who: null, ch: null, grp: null, day: null };

export type ScaleInput = {
  /** ใบของช่วงที่เลือก (cohort วันกรอก) */
  cohort: readonly RecruitAppFact[];
  /** null = ยังโหลดไม่เสร็จ/อ่านไม่ได้ ⇒ กล่องของก้อนนั้นขึ้น "—" ไม่ใช่ 0 */
  staff: readonly StaffActivityRow[] | null;
  requests: readonly StuckRequest[] | null;
  money: readonly MoneyRequest[] | null;
  /** ใบขอของใบสมัคร (เกณฑ์ที่ตั้งงาน/อายุ/เพศ) — null = อ่านไม่ได้ ⇒ แถว "ตรงเกณฑ์ใบขอ" ขึ้น — */
  jobs: Readonly<Record<string, RecruitAppJob>> | null;
  from: string;
  to: string;
  today: string;
  now: number;
};

export type ScaleSectionKey = 'req' | 'work' | 'names' | 'hold' | 'fit' | 'speed' | 'quality' | 'penalty';
export type ScaleBoxKey =
  | 'reqPos' | 'reqCount' | 'reqIdle' | 'reqCarry' | 'reqNew' | 'reqFilled' | 'reqCancelled'
  | 'wSum' | 'wLinks' | 'wPosted' | 'wScrap' | 'wAutopost' | 'wContacts' | 'wAppts'
  | 'cNames' | 'cAiCalled' | 'cAiYes' | 'cStaffOk' | 'cBooked' | 'cShowed' | 'cInformed'
  | 'hAll' | 'hOk' | 'hFail' | 'hWait' | 'hFree'
  | 'fitDistrict' | 'fitProvince' | 'fitRegion' | 'fitFar' | 'fitUnknown' | 'fitAgeOut' | 'fitGenderOut'
  | 'inPerDay' | 'outPerDay' | 'eta' | 'speed' | 'onTime' | 'callHours'
  | 'badPhone' | 'dup' | 'scrapOrders' | 'scrapNames'
  | 'penCount' | 'fine' | 'deduct';

export type ScaleBox = {
  key: ScaleBoxKey;
  label: string;
  /** null = ชั้นนี้ไม่มีเลขนี้ (ขึ้น — และกดไม่ได้) */
  value: number | null;
  /** รูปแบบของเลข — dec1 = ทศนิยม 1 ตำแหน่ง · dec2 = เงิน (สตางค์) · pct = % · text = ใช้ `text` แทนเลข */
  format: 'int' | 'dec1' | 'dec2' | 'pct' | 'text';
  text?: string;
  /** บรรทัดล่างของกล่อง */
  sub: string;
  /** แถบสัดส่วน 0–1 */
  bar?: number | null;
  /** id ผู้สมัครของกล่อง (กดดูรายชื่อ) */
  ids?: string[];
  /** บวกกันได้ = แถวลูกมี % ของรวม */
  additive: boolean;
};
export type ScaleSection = { key: ScaleSectionKey; title: string; equation: string | null; boxes: ScaleBox[] };

const KIND_BOX: ReadonlyArray<{ kind: StaffActivityKind; key: ScaleBoxKey }> = [
  { kind: 'links', key: 'wLinks' },
  { kind: 'manualPosted', key: 'wPosted' },
  { kind: 'scrap', key: 'wScrap' },
  { kind: 'autopost', key: 'wAutopost' },
  { kind: 'contacts', key: 'wContacts' },
  { kind: 'appts', key: 'wAppts' },
];
const kindLabel = (k: StaffActivityKind) => STAFF_PERSON_KINDS.find((x) => x.key === k)?.label ?? k;

/** คอลัมน์รายชื่อ 7 ช่อง — คำเดียวกับตารางช่องทาง (`FUNNEL_COLUMNS`) + "AI โทรแล้ว" */
export const SCALE_CHAIN: ReadonlyArray<{ key: ScaleBoxKey; label: string; of: string }> = [
  { key: 'cNames', label: 'รายชื่อ', of: '' },
  { key: 'cAiCalled', label: 'AI โทรแล้ว', of: 'ของรายชื่อ' },
  { key: 'cAiYes', label: 'AI สนใจ', of: 'ของที่ AI โทร' },
  { key: 'cStaffOk', label: 'คนโทรต่อ ติดต่อได้', of: 'ของที่สนใจ' },
  { key: 'cBooked', label: 'นัดได้', of: 'ของที่ติดต่อได้' },
  { key: 'cShowed', label: 'มา', of: 'ของที่นัด' },
  { key: 'cInformed', label: 'แจ้งเข้า', of: '' },
];
export const SCALE_HOLD: ReadonlyArray<{ key: ScaleBoxKey; label: string }> = [
  { key: 'hAll', label: 'รับมาโทร' },
  { key: 'hOk', label: 'ติดต่อได้' },
  { key: 'hFail', label: 'ติดต่อไม่ได้' },
  { key: 'hWait', label: 'ยังไม่ลงผล' },
];
export const SCALE_KIND_LABELS: readonly string[] = KIND_BOX.map((k) => kindLabel(k.kind));

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_WEEKDAY = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
export const scaleDayLabel = (ymd: string): string => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]}`;
export const scaleWeekday = (ymd: string): string => TH_WEEKDAY[new Date(`${ymd}T00:00:00Z`).getUTCDay()];
export const scaleIsWeekend = (ymd: string): boolean => [0, 6].includes(new Date(`${ymd}T00:00:00Z`).getUTCDay());

const BKK_MS = 7 * 3_600_000;
/** วันไทยของเวลา ISO */
export const bkkDayOf = (iso: string): string => new Date(Date.parse(iso) + BKK_MS).toISOString().slice(0, 10);
const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
type ScaleWindow = Pick<ScaleInput, 'from' | 'to' | 'today'>;
const lastDayOf = (inp: ScaleWindow): string => (inp.to > inp.today ? inp.today : inp.to);
/** จำนวนวันของช่วงที่ผ่านมาแล้ว (ไม่เกินวันนี้) — ฐานของ "วันละ" · ช่วงยาวแค่ไหนก็นับครบ */
export function scaleDayCount(inp: ScaleWindow): number {
  const n = Math.round((Date.parse(`${lastDayOf(inp)}T00:00:00Z`) - Date.parse(`${inp.from}T00:00:00Z`)) / 86_400_000) + 1;
  return Number.isFinite(n) && n > 0 ? n : 0;
}
/** กราฟรายวันโชว์ได้ไม่เกินเท่านี้ (เท่ากับช่วงยาวสุดที่ปุ่มวันที่ให้เลือก) — ช่วงยาวกว่านี้ = วันล่าสุด */
export const SCALE_CHART_DAYS = 62;
/**
 * วันของแกนวัน (เก่า → ใหม่) — ทุกวันอยู่ครบ · ช่วงยาวเกิน = `SCALE_CHART_DAYS` วันล่าสุดของช่วง
 * `month` (YYYY-MM) = เฉพาะวันของเดือนนั้นที่อยู่ในช่วง (กดแถวเดือนในตารางเทียบเดือน)
 */
export function scaleDays(inp: ScaleWindow, month?: string | null): string[] {
  const end = lastDayOf(inp);
  if (month) {
    const m = scaleMonths(inp).find((x) => x.month === month);
    if (!m) return [];
    const n = Math.round((Date.parse(`${m.to}T00:00:00Z`) - Date.parse(`${m.from}T00:00:00Z`)) / 86_400_000) + 1;
    return Array.from({ length: n }, (_, i) => addDays(m.from, i));
  }
  const n = Math.min(scaleDayCount(inp), SCALE_CHART_DAYS);
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

export type ScaleMonth = { month: string; from: string; to: string; /** ไม่ครบทั้งเดือน (ช่วงเริ่ม/จบกลางเดือน หรือเดือนยังไม่จบ) */ partial: boolean };
/** เดือนที่ช่วงครอบ (เก่า → ใหม่) พร้อมวันแรก/วันสุดท้ายของเดือนที่อยู่ในช่วง */
export function scaleMonths(inp: ScaleWindow): ScaleMonth[] {
  const end = lastDayOf(inp);
  if (scaleDayCount(inp) === 0) return [];
  const out: ScaleMonth[] = [];
  let y = Number(inp.from.slice(0, 4));
  let m = Number(inp.from.slice(5, 7));
  while (out.length < 60) {
    const month = `${y}-${String(m).padStart(2, '0')}`;
    if (month > end.slice(0, 7)) break;
    const first = `${month}-01`;
    const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const from = first < inp.from ? inp.from : first;
    const to = last > end ? end : last;
    out.push({ month, from, to, partial: from !== first || to !== last });
    if (m === 12) { y += 1; m = 1; } else m += 1;
  }
  return out;
}
/** ป้ายเดือน — เดือนไม่ครบบอกช่วงวันด้วย ("พ.ย. 69 · 1–20") */
export function scaleMonthLabel(m: ScaleMonth): string {
  const base = `${TH_MONTH[Number(m.month.slice(5, 7)) - 1]} ${String(Number(m.month.slice(0, 4)) + 543).slice(2)}`;
  return m.partial ? `${base} · ${Number(m.from.slice(8))}–${Number(m.to.slice(8))}` : base;
}

const idsOf = (list: readonly RecruitAppFact[]): string[] => list.map((f) => f.id).filter((v): v is string => Boolean(v));
const pct = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const pctText = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '');
const round1 = (v: number): number => Math.round(v * 10) / 10;
const round2 = (v: number): number => Math.round(v * 100) / 100;
const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** ชื่อช่องทาง / กลุ่ม ของใบ — ตัวเดียวกับตารางช่องทาง */
export const scaleChannelOf = (f: RecruitAppFact): string => funnelSubChannelOf(f);
export const scaleGroupOf = (f: RecruitAppFact): string => funnelSubOf(f);

const buOfRow = (bu: string | null | undefined): string => bu?.trim() || BU_UNKNOWN;
/**
 * BU ของรายใบค่าปรับ — สมุดค่าปรับส่งรหัสยาวจากไซต์ (LML · DSL · SNJ) ต้องแปลงเป็นรหัสที่ทั้งหน้าใช้ (LM · DS · SN)
 * ด้วยตัวแปลงเดียวกับ `/api/home-money` — ไม่แปลง = ค่าปรับของ LM/DS/SN หลุดจากชั้น BU และโผล่เป็น BU ใหม่ (เจอจากข้อมูลจริง 20 พ.ย. 2569)
 */
const buOfMoney = (r: Pick<MoneyRequest, 'bu'>): string => normalizeTrendBu(r.bu) ?? BU_UNKNOWN;

type Scoped = {
  /** รายชื่อที่ชั้นนี้หามา (BU ของใบ · คนหามา · ช่องทาง · กลุ่ม · วันกรอก) */
  brought: RecruitAppFact[];
  /** รายชื่อที่ชั้นนี้รับไปโทร (BU ของใบ · คนที่รับ) — null = ชั้นช่องทาง/กลุ่ม/วัน ไม่มีเรื่องนี้ */
  held: RecruitAppFact[] | null;
  /** AI สนใจ ยังไม่มีใครรับ — เฉพาะชั้นทั้งหมด/BU */
  free: RecruitAppFact[] | null;
  staff: StaffActivityRow[] | null;
  requests: StuckRequest[] | null;
  money: MoneyRequest[] | null;
};

function scopeOf(inp: ScaleInput, lv: ScaleLevel): Scoped {
  const inBu = (f: RecruitAppFact) => !lv.bu || buOfFact(f) === lv.bu;
  const deep = Boolean(lv.ch || lv.grp || lv.day);
  const brought = inp.cohort.filter(
    (f) =>
      inBu(f) &&
      (!lv.who || bringerOf(f) === lv.who) &&
      (!lv.ch || scaleChannelOf(f) === lv.ch) &&
      (!lv.grp || scaleGroupOf(f) === lv.grp) &&
      (!lv.day || bkkDayOf(f.createdAt) === lv.day),
  );
  const claimed = inp.cohort.filter((f) => inBu(f) && Boolean(f.claimedBy?.trim()));
  const held = deep ? null : lv.who ? claimed.filter((f) => f.claimedBy?.trim() === lv.who) : claimed;
  const free = deep || lv.who ? null : aiYesOf(inp.cohort.filter(inBu)).filter((f) => !f.claimedBy?.trim());
  // งาน = ของคน (สังกัด BU ของคนนั้น · นิยามเดิมของ `/api/staff-activity`) — ชั้นคนเห็นงานทั้งหมดของคนนั้น
  const staff =
    inp.staff && !lv.ch && !lv.grp
      ? inp.staff.filter((r) => (lv.who ? r.name === lv.who : !lv.bu || buOfRow(r.bu) === lv.bu) && (!lv.day || r.day === lv.day))
      : null;
  const requests = inp.requests && !deep ? inp.requests.filter((r) => (!lv.bu || buOfRow(r.bu) === lv.bu) && (!lv.who || recruiterLabelOf(r) === lv.who)) : null;
  const money = inp.money && !deep && !lv.who ? inp.money.filter((r) => !lv.bu || buOfMoney(r) === lv.bu) : null;
  return { brought, held, free, staff, requests, money };
}

type JourneySteps = ReturnType<typeof buildRecruitJourney>;
const partOf = (steps: JourneySteps, step: string, key: string): { value: number; ids: string[] } => {
  const p = steps.find((s) => s.key === step)?.parts.find((x) => x.key === key);
  return { value: p?.value ?? 0, ids: p?.ids ?? [] };
};
/** คนที่บอก AI ว่าสนใจ — ชุดเดียวกับช่อง "AI สนใจ" */
const aiYesOf = (list: readonly RecruitAppFact[]): RecruitAppFact[] => {
  const ids = new Set(partOf(buildRecruitJourney(list), 'ai', 'yes').ids);
  return list.filter((f) => f.id && ids.has(f.id));
};

/** 7 ช่องของรายชื่อ — ขั้นและคำตามสายเดียวกับภาพรวม (`buildRecruitJourney`) */
export function scaleChain(list: readonly RecruitAppFact[]): Array<{ value: number; ids: string[] }> {
  const informed = list.filter((f) => f.informed === true);
  const steps = buildRecruitJourney(list);
  return [
    { value: list.length, ids: idsOf(list) },
    partOf(steps, 'names', 'aiCalled'),
    partOf(steps, 'ai', 'yes'),
    partOf(steps, 'staff', 'ok'),
    partOf(steps, 'appointment', 'booked'),
    partOf(steps, 'attendance', 'showed'),
    { value: informed.length, ids: idsOf(informed) },
  ];
}

export function scaleWork(rows: readonly StaffActivityRow[]): StaffKindCounts {
  const out = emptyStaffKinds();
  for (const r of rows) for (const k of KIND_BOX) out[k.kind] += Number(r[k.kind]) || 0;
  return out;
}

const DUP_CACHE = new WeakMap<readonly RecruitAppFact[], Set<RecruitAppFact>>();
/**
 * สมัครซ้ำ = เบอร์เดียวกันกรอกมากกว่า 1 ใบในช่วงที่เลือก (นับใบที่ 2 เป็นต้นไป)
 * ตัดสินจากทั้งช่วงครั้งเดียว แล้วค่อยกรองตามชั้น ⇒ แยกตาม BU / คน แล้วบวกกันได้เท่ายอดรวมเสมอ
 */
function dupSetOf(cohort: readonly RecruitAppFact[]): Set<RecruitAppFact> {
  const hit = DUP_CACHE.get(cohort);
  if (hit) return hit;
  const seen = new Set<string>();
  const out = new Set<RecruitAppFact>();
  for (const f of [...cohort].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (!f.phoneKey) continue;
    if (seen.has(f.phoneKey)) out.add(f);
    else seen.add(f.phoneKey);
  }
  DUP_CACHE.set(cohort, out);
  return out;
}

/** AI สนใจแล้ว กี่ชั่วโมงทีมถึงโทร — ค่ากลางของ (ทีมลงมือครั้งแรก − AI ได้คำตอบ) */
function callHoursOf(yes: readonly RecruitAppFact[]): { median: number | null; done: number; waiting: number } {
  const hours: number[] = [];
  let waiting = 0;
  for (const f of yes) {
    const h = f.staffFirstAt && f.aiAnswerAt ? (Date.parse(f.staffFirstAt) - Date.parse(f.aiAnswerAt)) / 3_600_000 : null;
    if (h != null && h >= 0) hours.push(h);
    else waiting += 1;
  }
  const m = median(hours);
  return { median: m == null ? null : round1(m), done: hours.length, waiting };
}

const SCRAP_BRINGER = /^so scraping$/i;
const fineOf = (r: MoneyRequest) => r.amount.need.fine;
const deductOf = (r: MoneyRequest) => r.amount.need.deduct;
/** ใบที่มีค่าปรับหรือลดมูลค่าในช่วง (ตามสัญญา = `need` ตัวเดียวกับค่าเริ่มของหน้าหลัก) */
export const scalePenaltyRows = (rows: readonly MoneyRequest[]): MoneyRequest[] =>
  rows.filter((r) => fineOf(r) + deductOf(r) > 0).sort((a, b) => fineOf(b) + deductOf(b) - (fineOf(a) + deductOf(a)) || a.requestNo.localeCompare(b.requestNo));
/** ใบที่หาครบในช่วง เรียงช้าสุดก่อน */
export const scaleClockedRows = (rows: readonly MoneyRequest[]): MoneyRequest[] =>
  rows.filter((r) => r.clocked && r.speedDays != null).sort((a, b) => (b.speedDays ?? 0) - (a.speedDays ?? 0) || a.requestNo.localeCompare(b.requestNo));

type Jobs = NonNullable<ScaleInput['jobs']>;
type FitOf = { area: AreaFit; age: RuleFit; gender: RuleFit };
const FIT_CACHE = new WeakMap<Jobs, WeakMap<RecruitAppFact, FitOf>>();
/** ใบนี้เทียบกับใบขอที่สมัคร: พื้นที่ · อายุ · เพศ — คิดครั้งเดียวต่อใบ (ทุกกล่อง ทุกชั้น ใช้ค่าเดียวกัน) */
function fitOf(jobs: Jobs, f: RecruitAppFact): FitOf {
  let m = FIT_CACHE.get(jobs);
  if (!m) FIT_CACHE.set(jobs, (m = new WeakMap()));
  let v = m.get(f);
  if (!v) {
    const job = f.jobId ? jobs[f.jobId] : null;
    v = { area: areaFitOf(f, job), age: ageFitOf(f, job), gender: genderFitOf(f, job) };
    m.set(f, v);
  }
  return v;
}
/** ใบนี้อยู่ในกล่องไหนของแถว "ตรงเกณฑ์ใบขอ" — 5 กล่องพื้นที่แบ่งรายชื่อครบพอดี (บวกกันได้เท่ารายชื่อ) */
function fitMatcher(jobs: Jobs, key: ScaleBoxKey): (f: RecruitAppFact) => boolean {
  switch (key) {
    case 'fitDistrict':
      return (f) => fitOf(jobs, f).area === 'district';
    case 'fitProvince':
      return (f) => fitOf(jobs, f).area === 'province';
    case 'fitRegion':
      return (f) => fitOf(jobs, f).area === 'region';
    case 'fitFar':
      return (f) => fitOf(jobs, f).area === 'far';
    case 'fitUnknown':
      return (f) => AREA_UNKNOWN.includes(fitOf(jobs, f).area);
    case 'fitAgeOut':
      return (f) => fitOf(jobs, f).age === 'out';
    case 'fitGenderOut':
      return (f) => fitOf(jobs, f).gender === 'out';
    default:
      return () => false;
  }
}

const box = (key: ScaleBoxKey, label: string, value: number | null, sub: string, more: Partial<ScaleBox> = {}): ScaleBox => ({
  key,
  label,
  value,
  format: 'int',
  sub: value == null && !more.text ? '' : sub,
  additive: true,
  ...more,
});

const SECTION_CACHE = new WeakMap<ScaleInput, Map<string, ScaleSection[]>>();
/**
 * กล่องเลขทุกแถวของชั้น — แถวและช่องอยู่ที่เดิมทุกชั้น · ไม่มีเลข = value null
 * จำผลไว้ต่อชุดข้อมูล (object เดิม) + ชั้น — ตาราง "แยกตามชั้นถัดไป" ถามชั้นเดิมซ้ำหลายรอบ · ผู้เรียกห้ามแก้ผลที่ได้
 */
export function scaleSections(inp: ScaleInput, lv: ScaleLevel): ScaleSection[] {
  let m = SECTION_CACHE.get(inp);
  if (!m) SECTION_CACHE.set(inp, (m = new Map()));
  const key = [lv.bu, lv.who, lv.ch, lv.grp, lv.day].map((v) => v ?? '').join('\u0001');
  const hit = m.get(key);
  if (hit) return hit;
  const out = buildSections(inp, lv);
  m.set(key, out);
  return out;
}
function buildSections(inp: ScaleInput, lv: ScaleLevel): ScaleSection[] {
  const sc = scopeOf(inp, lv);
  const days = scaleDayCount(inp) || 1;
  const out: ScaleSection[] = [];

  // ── ใบขอ ──
  const open = sc.requests?.filter((r) => flowOf(r).remaining > 0) ?? null;
  const flow = sc.requests
    ? sc.requests.reduce((a, r) => { const f = flowOf(r); return { carryIn: a.carryIn + f.carryIn, new: a.new + f.new, filled: a.filled + f.filled, cancelled: a.cancelled + f.cancelled, remaining: a.remaining + f.remaining }; }, { carryIn: 0, new: 0, filled: 0, cancelled: 0, remaining: 0 })
    : null;
  const idle = open?.filter((r) => !isPostingStarted(r)) ?? null;
  out.push({
    key: 'req',
    title: lv.who && !lv.day ? 'ใบขอที่ดูแล' : 'ใบขอ',
    equation: flow ? `ยกมา ${flow.carryIn.toLocaleString('en-US')} + ขอใหม่ ${flow.new.toLocaleString('en-US')} − หาได้แล้ว ${flow.filled.toLocaleString('en-US')} − ยกเลิก ${flow.cancelled.toLocaleString('en-US')} = เหลือหา ${flow.remaining.toLocaleString('en-US')} อัตรา` : null,
    boxes: [
      box('reqPos', 'เหลือหา (อัตรา)', flow ? flow.remaining : null, 'อัตรา'),
      box('reqCount', 'เหลือหา (ใบ)', open ? open.length : null, 'ใบ'),
      box('reqIdle', 'ยังไม่เริ่มหา (ใบ)', idle ? idle.length : null, open && open.length ? `${pctText(idle?.length ?? 0, open.length)} ของใบที่เหลือหา` : 'ใบ'),
      // 4 ตัวของสมการ — กดแล้วเห็นรายใบ: ใบที่หาได้/ยกเลิก ทำอะไรไปแล้วบ้าง
      box('reqCarry', 'ยกมา', flow ? flow.carryIn : null, 'อัตรา'),
      box('reqNew', 'ขอใหม่', flow ? flow.new : null, 'อัตรา'),
      box('reqFilled', 'หาได้แล้ว', flow ? flow.filled : null, 'อัตรา'),
      box('reqCancelled', 'ยกเลิก', flow ? flow.cancelled : null, 'อัตรา'),
    ],
  });

  // ── งานที่ทำ ──
  const work = sc.staff ? scaleWork(sc.staff) : null;
  const sum = work ? staffWorkTotal(work) : null;
  out.push({
    key: 'work',
    title: lv.day ? `งานที่ทำ · ${scaleDayLabel(lv.day)}` : 'งานที่ทำ',
    equation: null,
    boxes: [
      box('wSum', 'รวม', sum, 'รายการ'),
      ...KIND_BOX.map((k) =>
        box(k.key, kindLabel(k.kind), work ? work[k.kind] : null, k.kind === 'appts' ? 'ไม่นับในรวม' : sum ? `${pctText(work?.[k.kind] ?? 0, sum)} ของรวม` : 'รายการ'),
      ),
    ],
  });

  // ── รายชื่อ ──
  const chain = scaleChain(sc.brought);
  out.push({
    key: 'names',
    title: 'รายชื่อ',
    equation: null,
    boxes: SCALE_CHAIN.map((c, i) => {
      const prev = i > 0 && i < 6 ? chain[i - 1].value : 0;
      return box(c.key, c.label, chain[i].value, i === 0 || i === 6 ? 'คน' : prev > 0 ? `${pctText(chain[i].value, prev)} ${c.of}` : 'คน', { ids: chain[i].ids, bar: i > 0 && i < 6 ? pct(chain[i].value, prev) : null });
    }),
  });

  // ── รายชื่ออยู่ที่ใคร ──
  const held = sc.held;
  const by = (res: 'ok' | 'fail' | 'waiting') => (held ? held.filter((f) => staffResultOf(f) === res) : null);
  const parts = [held, by('ok'), by('fail'), by('waiting')];
  out.push({
    key: 'hold',
    title: 'รายชื่ออยู่ที่ใคร',
    equation: null,
    boxes: [
      ...SCALE_HOLD.map((h, i) =>
        box(h.key, h.label, parts[i]?.length ?? null, i === 0 || !held?.length ? 'คน' : `${pctText(parts[i]?.length ?? 0, held.length)} ของที่รับมา`, { ids: idsOf(parts[i] ?? []) }),
      ),
      ...(sc.free ? [box('hFree', 'AI สนใจ ยังไม่มีใครรับ', sc.free.length, 'คน', { ids: idsOf(sc.free) })] : []),
    ],
  });

  // ── ตรงเกณฑ์ใบขอ: รายชื่อของชั้นนี้ เทียบกับใบขอที่เขาสมัคร ──
  const jobs = inp.jobs;
  const fit = (key: ScaleBoxKey) => (jobs ? sc.brought.filter(fitMatcher(jobs, key)) : null);
  const areaBox = (key: ScaleBoxKey, label: string) => {
    const hit = fit(key);
    return box(key, label, hit ? hit.length : null, sc.brought.length ? `${pctText(hit?.length ?? 0, sc.brought.length)} ของรายชื่อ` : 'คน', { ids: idsOf(hit ?? []) });
  };
  const ruled = (v: RuleFit) => v === 'ok' || v === 'out';
  const ageRuled = jobs ? sc.brought.filter((f) => ruled(fitOf(jobs, f).age)).length : 0;
  const genderRuled = jobs ? sc.brought.filter((f) => ruled(fitOf(jobs, f).gender)).length : 0;
  const unknown = fit('fitUnknown');
  const ageOut = fit('fitAgeOut');
  const genderOut = fit('fitGenderOut');
  out.push({
    key: 'fit',
    title: 'ตรงเกณฑ์ใบขอ',
    equation: null,
    boxes: [
      areaBox('fitDistrict', AREA_FIT_LABEL.district),
      areaBox('fitProvince', AREA_FIT_LABEL.province),
      areaBox('fitRegion', AREA_FIT_LABEL.region),
      areaBox('fitFar', AREA_FIT_LABEL.far),
      areaBox('fitUnknown', 'เทียบพื้นที่ไม่ได้'),
      box('fitAgeOut', 'อายุไม่เข้าเกณฑ์', ageOut ? ageOut.length : null, `จาก ${ageRuled.toLocaleString('en-US')} คนที่เทียบได้`, { ids: idsOf(ageOut ?? []) }),
      box('fitGenderOut', 'เพศไม่ตรงใบขอ', genderOut ? genderOut.length : null, `จาก ${genderRuled.toLocaleString('en-US')} คนที่เทียบได้`, { ids: idsOf(genderOut ?? []) }),
    ],
  });

  // ── 3 แถวล่าง: เฉพาะชั้นทั้งหมด / BU (ชั้นอื่นไม่มีเลขพวกนี้) ──
  if (!lv.who && !lv.ch && !lv.grp && !lv.day) {
    const inn = flow ? flow.new / days : null;
    const outPer = flow ? (flow.filled + flow.cancelled) / days : null;
    const clocked = sc.money ? scaleClockedRows(sc.money) : null;
    const speed = clocked && clocked.length ? round1(clocked.reduce((n, r) => n + (r.speedDays ?? 0), 0) / clocked.length) : null;
    const onTime = clocked ? clocked.filter((r) => r.lateDays === 0).length : 0;
    const call = callHoursOf(aiYesOf(sc.brought));
    const net = flow ? flow.filled + flow.cancelled - flow.new : 0;
    const etaText = !flow ? null : net > 0 ? `อีก ${Math.ceil((flow.remaining * days) / net).toLocaleString('en-US')} วัน` : net < 0 ? 'ไม่หมด' : 'เท่าเดิม';
    out.push({
      key: 'speed',
      title: 'เร็วแค่ไหน',
      equation: null,
      boxes: [
        box('inPerDay', 'ใบขอเข้าวันละ', inn == null ? null : round1(inn), 'อัตรา', { format: 'dec1', additive: false }),
        box('outPerDay', 'หาได้แล้ว + ยกเลิก วันละ', outPer == null ? null : round1(outPer), 'อัตรา', { format: 'dec1', additive: false }),
        box('eta', 'งานค้างจะหมดเมื่อไหร่', flow ? round1(net / days) : null, !flow ? '' : net > 0 ? 'ถ้าเร็วเท่านี้' : net < 0 ? `เข้ามากกว่าออกวันละ ${round1(-net / days).toFixed(1)}` : 'เข้าเท่ากับออก', { format: 'text', text: etaText ?? undefined, additive: false }),
        box('speed', 'หาครบใช้กี่วัน', speed, clocked?.length ? `วัน · จาก ${clocked.length.toLocaleString('en-US')} ใบที่หาครบ` : 'วัน', { format: 'dec1', additive: false }),
        box('onTime', 'ทันวันที่ลูกค้าต้องการ', clocked && clocked.length ? Math.round((onTime / clocked.length) * 100) : null, clocked?.length ? `${onTime.toLocaleString('en-US')} จาก ${clocked.length.toLocaleString('en-US')} ใบ` : '', { format: 'pct', bar: clocked?.length ? onTime / clocked.length : null, additive: false }),
        box('callHours', 'AI สนใจแล้ว กี่ชั่วโมงทีมถึงโทร', call.median, `ชม. · ยังไม่ได้โทร ${call.waiting.toLocaleString('en-US')} คน`, { format: 'dec1', additive: false }),
      ],
    });
    const bad = sc.brought.filter((f) => !f.phoneOk);
    const dupSet = dupSetOf(inp.cohort);
    const dup = sc.brought.filter((f) => dupSet.has(f));
    const scrapNames = sc.brought.filter((f) => SCRAP_BRINGER.test(bringerOf(f)));
    const ofNames = (n: number) => (sc.brought.length ? `${((n / sc.brought.length) * 100).toFixed(1)}% ของรายชื่อ` : 'คน');
    out.push({
      key: 'quality',
      title: 'เบอร์ผิด · ซ้ำ · Scrap',
      equation: null,
      boxes: [
        box('badPhone', 'เบอร์ผิด', bad.length, ofNames(bad.length), { ids: idsOf(bad) }),
        box('dup', 'สมัครซ้ำ', dup.length, ofNames(dup.length), { ids: idsOf(dup) }),
        box('scrapOrders', 'สั่ง Scrap', work ? work.scrap : null, 'ใบ'),
        box('scrapNames', 'ได้รายชื่อจาก Scrap', scrapNames.length, 'คน', { ids: idsOf(scrapNames) }),
      ],
    });
    const pen = sc.money ? scalePenaltyRows(sc.money) : null;
    out.push({
      key: 'penalty',
      title: 'ค่าปรับ',
      equation: null,
      boxes: [
        box('penCount', 'ใบที่มีค่าปรับ', pen ? pen.length : null, 'ใบ'),
        // เงินเก็บถึงสตางค์ (รายใบของสมุดค่าปรับมีสตางค์) — ปัดเป็นบาทแล้วแยกตาม BU / ไล่รายใบ บวกไม่เท่ายอดรวม (เจอจากข้อมูลจริง 21 พ.ย. 2569 ต่างกัน 1 บาท)
        box('fine', 'ค่าปรับ', pen ? round2(pen.reduce((n, r) => n + fineOf(r), 0)) : null, 'บาท', { format: 'dec2' }),
        box('deduct', 'ลดมูลค่า', pen ? round2(pen.reduce((n, r) => n + deductOf(r), 0)) : null, 'บาท', { format: 'dec2' }),
      ],
    });
  }
  return out;
}

export const scaleBoxOf = (sections: readonly ScaleSection[], key: ScaleBoxKey): ScaleBox | null => sections.flatMap((s) => s.boxes).find((b) => b.key === key) ?? null;
const sectionOfBox = (key: ScaleBoxKey): ScaleSectionKey =>
  key.startsWith('req') ? 'req' : key.startsWith('w') ? 'work' : key.startsWith('c') && key !== 'callHours' ? 'names' : key.startsWith('h') ? 'hold' : key.startsWith('fit') ? 'fit' : ['inPerDay', 'outPerDay', 'eta', 'speed', 'onTime', 'callHours'].includes(key) ? 'speed' : ['badPhone', 'dup', 'scrapOrders', 'scrapNames'].includes(key) ? 'quality' : 'penalty';

/* ═══ ชั้นถัดไป ═══ */
export type ScaleChild = { key: string; label: string; go: Partial<ScaleLevel>; note?: string };
export type ScaleChildKind = 'bu' | 'recruiter' | 'staff' | 'bringer' | 'holder' | 'channel' | 'group' | 'day' | 'customer';
export const SCALE_CHILD_TITLE: Record<ScaleChildKind, string> = {
  bu: 'แยกตาม BU',
  recruiter: 'แยกตามเจ้าหน้าที่สรรหา',
  staff: 'แยกตามคน',
  bringer: 'ใครหามา',
  holder: 'อยู่ที่ใคร',
  channel: 'มาจากช่องทางไหน',
  group: 'มาจากกลุ่มไหน',
  day: 'แยกตามวัน',
  customer: 'แยกตามลูกค้า',
};
const BU_ORDER = ['LBD', 'LBA', 'LM', 'DS', 'SN'];
const uniq = (list: readonly string[]) => [...new Set(list)];

/** BU ที่มีข้อมูลในช่วง — เรียงตามลำดับที่ทีมคุ้น */
export function scaleBus(inp: ScaleInput): string[] {
  const all = uniq([...inp.cohort.map(buOfFact), ...(inp.staff ?? []).map((r) => buOfRow(r.bu)), ...(inp.requests ?? []).map((r) => buOfRow(r.bu)), ...(inp.money ?? []).map(buOfMoney)]);
  const rank = (b: string) => (BU_ORDER.includes(b) ? BU_ORDER.indexOf(b) : b === BU_UNKNOWN ? 99 : 50);
  return all.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/** ลูกของชั้นสำหรับกล่องนี้ — null = ชั้นล่างสุดของเรื่องนี้ (กดดูรายชื่อ/รายการแทน) */
export function scaleChildren(inp: ScaleInput, lv: ScaleLevel, key: ScaleBoxKey): { kind: ScaleChildKind; items: ScaleChild[] } | null {
  const sec = sectionOfBox(key);
  if (lv.grp) return null;
  if (!lv.bu) return { kind: 'bu', items: scaleBus(inp).map((b) => ({ key: b, label: b, go: { bu: b } })) };
  const sc = scopeOf(inp, lv);
  const names = (list: readonly string[], go: (n: string) => Partial<ScaleLevel>): ScaleChild[] => uniq(list).map((n) => ({ key: n, label: n, go: go(n) }));
  const ofNames = sec === 'names' || sec === 'fit';
  if (lv.ch) return ofNames ? { kind: 'group', items: names(sc.brought.map(scaleGroupOf), (n) => ({ grp: n })) } : null;
  if (lv.who) {
    if (ofNames) return { kind: 'channel', items: names(sc.brought.map(scaleChannelOf), (n) => ({ ch: n })) };
    if (sec === 'work' && !lv.day) return { kind: 'day', items: uniq((sc.staff ?? []).map((r) => r.day)).sort().map((d) => ({ key: d, label: `${scaleDayLabel(d)} · ${scaleWeekday(d)}`, go: { day: d } })) };
    return null;
  }
  if (lv.day) return sec === 'work' ? { kind: 'staff', items: names((sc.staff ?? []).map((r) => r.name), (n) => ({ who: n })) } : null;
  if (sec === 'req') return { kind: 'recruiter', items: names(scaleRequestsOf(inp, lv, scaleReqRoleOf(key) ?? 'remaining').map(recruiterLabelOf), (n) => ({ who: n })) };
  if (sec === 'work' || key === 'scrapOrders') return { kind: 'staff', items: names((sc.staff ?? []).map((r) => r.name), (n) => ({ who: n })) };
  if (ofNames || key === 'badPhone' || key === 'dup') return { kind: 'bringer', items: names(sc.brought.map(bringerOf), (n) => ({ who: n })) };
  if (sec === 'hold' && key !== 'hFree') return { kind: 'holder', items: names((sc.held ?? []).map((f) => f.claimedBy?.trim() ?? ''), (n) => ({ who: n })) };
  if (key === 'callHours') return { kind: 'holder', items: names(aiYesOf(sc.brought).map((f) => f.claimedBy?.trim() || ''), (n) => ({ who: n })).filter((c) => c.key) };
  return null;
}

export type ScaleRow = { key: string; label: string; note: string; value: number | null; format: ScaleBox['format']; text?: string; go: Partial<ScaleLevel> | null; ids?: string[] };
export type ScaleBreakdown = { kind: ScaleChildKind; rows: ScaleRow[]; total: number | null };

/**
 * กล่องนี้แยกตามชั้นถัดไป — เลขของแถว = กล่องเดียวกันของชั้นลูก (`scaleSections` ของลูก)
 * ชั้นคนของ "กี่ชั่วโมงทีมถึงโทร" / "เบอร์ผิด" / "ซ้ำ" ไม่มีกล่องของตัวเอง ⇒ คิดจากชุดของคนนั้นตรง ๆ
 */
export function scaleBreakdown(inp: ScaleInput, lv: ScaleLevel, key: ScaleBoxKey): ScaleBreakdown | null {
  const kids = scaleChildren(inp, lv, key);
  if (!kids) return null;
  const parent = scaleBoxOf(scaleSections(inp, lv), key);
  const sc = scopeOf(inp, lv);
  const rows: ScaleRow[] = kids.items.map((c) => {
    const child = { ...lv, ...c.go };
    if (kids.kind === 'holder' && key === 'callHours') {
      const mine = aiYesOf(sc.brought).filter((f) => f.claimedBy?.trim() === c.key);
      const h = callHoursOf(mine);
      return { key: c.key, label: c.label, note: `โทรแล้ว ${h.done} คน · ยังไม่ได้โทร ${h.waiting} คน`, value: h.median, format: 'dec1', text: h.median == null ? 'ยังไม่ได้โทร' : undefined, go: c.go };
    }
    if (kids.kind === 'bringer' && (key === 'badPhone' || key === 'dup')) {
      const mine = sc.brought.filter((f) => bringerOf(f) === c.key);
      const dupSet = dupSetOf(inp.cohort);
      const hit = mine.filter((f) => (key === 'dup' ? dupSet.has(f) : !f.phoneOk));
      return { key: c.key, label: c.label, note: `จากรายชื่อ ${mine.length.toLocaleString('en-US')} คน`, value: hit.length, format: 'int', go: c.go, ids: idsOf(hit) };
    }
    if (kids.kind === 'staff' && key === 'scrapOrders') {
      const n = scaleWork((sc.staff ?? []).filter((r) => r.name === c.key)).scrap;
      return { key: c.key, label: c.label, note: '', value: n, format: 'int', go: c.go };
    }
    const b = scaleBoxOf(scaleSections(inp, child), key);
    return { key: c.key, label: c.label, note: b && b.format !== 'int' && b.format !== 'dec2' ? b.sub : '', value: b?.value ?? null, format: b?.format ?? 'int', text: b?.text, go: c.go, ids: b?.ids };
  });
  const additive = Boolean(parent?.additive);
  const shown = (additive ? rows.filter((r) => (r.value ?? 0) > 0) : rows.filter((r) => r.value != null || r.text)).sort((a, b) => (additive || key === 'callHours' ? (b.value ?? -1) - (a.value ?? -1) : 0) || 0);
  return { kind: kids.kind, rows: shown, total: additive ? (parent?.value ?? null) : null };
}

/** แถวของกล่อง + ค่าช่วงก่อนของแถวนั้น — `before` undefined = ไม่เทียบ/ยังโหลด · null = เทียบไม่ได้ */
export type ScaleRowCompared = ScaleRow & { before?: number | null };
/**
 * แถวของกล่องเทียบช่วงก่อนทีละแถว — กติกาเดียวของจอและผู้ช่วย AI
 * แถวที่ช่วงก่อนมีแต่ช่วงนี้ไม่มี ขึ้นด้วยเลข 0 (ใคร/ช่องทางไหนหายไป) เฉพาะเลขที่บวกกันได้ · แถวที่ช่วงก่อนไม่มี = เทียบกับ 0
 * ชั้นลูกที่เป็นวันไม่เทียบ (วันของช่วงก่อนเป็นคนละวัน)
 */
export function scaleBreakdownCompared(bd: ScaleBreakdown, prevBd: ScaleBreakdown | null, state: ScaleCompare['state']): ScaleRowCompared[] {
  if (bd.kind === 'day' || state === 'none' || state === 'wait') return bd.rows;
  if (state === 'na' || !prevBd) return bd.rows.map((r) => ({ ...r, before: r.value == null ? undefined : null }));
  const additive = bd.total != null;
  const before = new Map(prevBd.rows.map((r) => [r.key, r.value]));
  const gone = additive ? prevBd.rows.filter((r) => (r.value ?? 0) > 0 && !bd.rows.some((x) => x.key === r.key)).map((r): ScaleRowCompared => ({ ...r, value: 0, note: '', ids: undefined, before: r.value })) : [];
  return [...bd.rows.map((r): ScaleRowCompared => ({ ...r, before: r.value == null ? undefined : (before.get(r.key) ?? (additive ? 0 : null)) })), ...gone];
}

/* ═══ ตารางปกติของแต่ละชั้น ═══ */
export type ScaleBuRow = { bu: string; reqPos: number | null; reqCount: number | null; reqIdle: number | null; people: number | null; work: number | null; chain: number[] };
export function scaleBuTable(inp: ScaleInput): { rows: ScaleBuRow[]; total: ScaleBuRow } {
  const row = (bu: string | null): ScaleBuRow => {
    const lv = { ...SCALE_ROOT, bu };
    const s = scaleSections(inp, lv);
    const v = (k: ScaleBoxKey) => scaleBoxOf(s, k)?.value ?? null;
    const staff = scopeOf(inp, lv).staff;
    return { bu: bu ?? 'รวม', reqPos: v('reqPos'), reqCount: v('reqCount'), reqIdle: v('reqIdle'), people: staff ? uniq(staff.map((r) => r.name)).length : null, work: v('wSum'), chain: SCALE_CHAIN.map((c) => v(c.key) ?? 0) };
  };
  return { rows: scaleBus(inp).map(row), total: row(null) };
}

export type ScaleVersus = 'manyFew' | 'fewMany' | null;
export const SCALE_VERSUS_LABEL: Record<Exclude<ScaleVersus, null>, string> = { manyFew: 'ทำเยอะ ได้น้อย', fewMany: 'ทำน้อย ได้เยอะ' };
export type ScalePersonRow = {
  name: string;
  /** สังกัด BU นี้ (มีงานในช่วง หรือมีงานใน 60 วันล่าสุด) */
  member: boolean;
  /** แหล่งที่ไม่ใช่คน (iRecruit · Scrap · สมัครเอง) — ไม่มีสังกัด จึงไม่ขึ้นป้าย "นอก BU" */
  source: boolean;
  lastDay: string | null;
  idleDays: number | null;
  work: number | null;
  chain: number[];
  /** ทำ 100 งาน (Gen link + โพสต์แล้ว + Scrap + Autopost) ได้กี่รายชื่อ */
  per100: number | null;
  versus: ScaleVersus;
};
const SOURCE_NAMES = /^(ดึงจาก irecruit|so scraping|สมัครเองที่หน้าเว็บ|ลิงก์ไม่รู้ว่าใครสร้าง)$/i;
const huntOf = (w: StaffKindCounts) => w.links + w.manualPosted + w.scrap + w.autopost;

/**
 * ชั้น BU: ทุกคนที่มีงานใน BU + ทุกคนที่หารายชื่อให้ BU นี้ + คนของ BU ที่มีงานใน 60 วันล่าสุดแต่ช่วงนี้ไม่มี (`roster`)
 * ⇒ คนที่หายไปขึ้นแถวด้วยงาน 0 พร้อมวันที่ทำล่าสุด · ค่าเฉลี่ย/เทียบกับทีมยังคิดจากคนที่มีงานในช่วงเท่านั้น (นิยามเดิม)
 */
export function scalePeopleTable(
  inp: ScaleInput,
  bu: string,
  roster: readonly StaffRosterRow[] | null = null,
): { rows: ScalePersonRow[]; total: ScalePersonRow; average: { people: number; work: number; chain: number[] } } {
  const lv = { ...SCALE_ROOT, bu };
  const sc = scopeOf(inp, lv);
  const staff = sc.staff ?? [];
  const members = uniq(staff.map((r) => r.name));
  const bringers = uniq(sc.brought.map(bringerOf));
  const lastOf = new Map((roster ?? []).filter((r) => buOfRow(r.bu) === bu).map((r) => [r.name, r.lastDay]));
  const end = scaleDays(inp).at(-1) ?? inp.today;
  // "ไม่มีงานมา N วัน" นับวันเต็มที่ผ่านไปแล้ว — วันนี้ที่ยังไม่จบไม่นับ (เช้าวันนี้ทุกคนจะขึ้น 1 วันทั้งที่เมื่อวานทำงาน · เจอจากข้อมูลจริง 21 พ.ย. 2569)
  const idleRef = end === inp.today ? addDays(end, -1) : end;
  const workOf = (n: string) => scaleWork(staff.filter((r) => r.name === n));
  const namesOf = (n: string) => sc.brought.filter((f) => bringerOf(f) === n);
  const huntAll = members.reduce((a, n) => a + huntOf(workOf(n)), 0);
  const teamRate = huntAll > 0 ? (members.reduce((a, n) => a + namesOf(n).length, 0) / huntAll) * 100 : 0;
  const avgHunt = members.length ? huntAll / members.length : 0;
  const rows = uniq([...members, ...lastOf.keys(), ...bringers]).map((name): ScalePersonRow => {
    const worked = members.includes(name);
    const member = worked || lastOf.has(name);
    const w = workOf(name);
    const mine = namesOf(name);
    const hunt = huntOf(w);
    const rate = worked && hunt > 0 ? (mine.length / hunt) * 100 : null;
    const lastDay = worked ? staff.filter((r) => r.name === name).map((r) => r.day).sort().at(-1) ?? null : (lastOf.get(name) ?? null);
    return {
      name,
      member,
      source: SOURCE_NAMES.test(name),
      lastDay,
      idleDays: lastDay ? Math.max(0, Math.round((Date.parse(`${idleRef}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000)) : null,
      work: member ? staffWorkTotal(w) : null,
      chain: scaleChain(mine).map((c) => c.value),
      per100: rate == null ? null : round1(rate),
      versus: rate == null ? null : hunt >= avgHunt && rate < teamRate ? 'manyFew' : hunt < avgHunt && rate >= teamRate ? 'fewMany' : null,
    };
  });
  rows.sort((a, b) => (b.work ?? -1) - (a.work ?? -1) || b.chain[0] - a.chain[0] || a.name.localeCompare(b.name, 'th'));
  const chain = scaleChain(sc.brought).map((c) => c.value);
  const work = staffWorkTotal(scaleWork(staff));
  const n = members.length;
  return {
    rows,
    total: { name: 'รวม', member: true, source: false, lastDay: null, idleDays: null, work, chain, per100: huntAll > 0 ? round1(teamRate) : null, versus: null },
    average: { people: n, work: n ? work / n : 0, chain: chain.map((v) => (n ? v / n : 0)) },
  };
}

export type ScalePersonBu = { bu: string; name: string; member: boolean; work: number | null; names: number };
/**
 * คนนี้อยู่ในตาราง "แยกตามคน" ของ BU ไหนบ้าง — ผู้ช่วย AI ถูกถามถึงคนโดยไม่รู้ BU (ทดสอบบนเว็บจริง 22 พ.ย. 2569 "เจมส์ทำอะไรไปบ้าง" ตอบไม่ได้)
 * BU ที่สังกัดก่อน แล้วงานมากสุด · รายชื่อมากสุด · เทียบชื่อไม่สนตัวพิมพ์/ช่องว่างหัวท้าย · `name` = ชื่อตามตาราง
 */
export function scaleBusOfPerson(inp: ScaleInput, name: string, roster: readonly StaffRosterRow[] | null = null): ScalePersonBu[] {
  const want = name.trim().toLowerCase();
  if (!want) return [];
  return scaleBus(inp)
    .flatMap((bu): ScalePersonBu[] => {
      const row = scalePeopleTable(inp, bu, roster).rows.find((r) => r.name.trim().toLowerCase() === want);
      return row ? [{ bu, name: row.name, member: row.member, work: row.work, names: row.chain[0] }] : [];
    })
    .sort((a, b) => Number(b.member) - Number(a.member) || (b.work ?? -1) - (a.work ?? -1) || b.names - a.names);
}

/** รายชื่อที่แต่ละคนหามา รวมทุก BU — เท่ากับช่อง "รายชื่อ" ของคนนั้นในตาราง "แยกตามคน" ของทุก BU รวมกัน (มีเทสต์) */
export function scaleNamesByBringer(inp: Pick<ScaleInput, 'cohort'>): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of inp.cohort) {
    const k = bringerOf(f);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export type ScaleHoldRow = { name: string; all: number; ok: number; fail: number; wait: number; okPct: number | null; oldestDays: number | null };
export function scaleHoldTable(inp: ScaleInput, bu: string): { rows: ScaleHoldRow[]; total: ScaleHoldRow } {
  const held = scopeOf(inp, { ...SCALE_ROOT, bu }).held ?? [];
  const row = (name: string, list: readonly RecruitAppFact[]): ScaleHoldRow => {
    const ok = list.filter((f) => staffResultOf(f) === 'ok').length;
    const fail = list.filter((f) => staffResultOf(f) === 'fail').length;
    const waiting = list.filter((f) => staffResultOf(f) === 'waiting');
    const oldest = waiting.reduce<number | null>((mx, f) => (f.claimedAt ? Math.max(mx ?? 0, Math.floor((inp.now - Date.parse(f.claimedAt)) / 86_400_000)) : mx), null);
    return { name, all: list.length, ok, fail, wait: waiting.length, okPct: ok + fail > 0 ? Math.round((ok / (ok + fail)) * 100) : null, oldestDays: waiting.length ? (oldest ?? 0) : null };
  };
  const rows = uniq(held.map((f) => f.claimedBy?.trim() ?? '')).map((n) => row(n, held.filter((f) => f.claimedBy?.trim() === n))).sort((a, b) => b.all - a.all || a.name.localeCompare(b.name, 'th'));
  return { rows, total: row('รวม', held) };
}

export type ScaleChainRow = { key: string; label: string; chain: number[]; ids: string[][] };
/** ชั้นคน → ช่องทาง · ชั้นช่องทาง → กลุ่ม */
export function scaleChainTable(inp: ScaleInput, lv: ScaleLevel): { by: 'channel' | 'group'; rows: ScaleChainRow[]; total: ScaleChainRow } {
  const list = scopeOf(inp, lv).brought;
  const by = lv.ch ? 'group' : 'channel';
  const keyOf = by === 'group' ? scaleGroupOf : scaleChannelOf;
  const row = (label: string, l: readonly RecruitAppFact[]): ScaleChainRow => {
    const c = scaleChain(l);
    return { key: label, label, chain: c.map((x) => x.value), ids: c.map((x) => x.ids) };
  };
  const rows = uniq(list.map(keyOf)).map((k) => row(k, list.filter((f) => keyOf(f) === k))).sort((a, b) => b.chain[0] - a.chain[0] || a.label.localeCompare(b.label, 'th'));
  return { by, rows, total: row('รวม', list) };
}

export type ScaleTopRow = { label: string; new: number; filled: number; cancelled: number; remaining: number; count: number; oldest: number | null };
/** ลูกค้า / ตำแหน่ง ที่เหลือหาเยอะสุด — รวมตามชื่อที่ ERP ส่งมา */
export function scaleTopRequests(inp: ScaleInput, bu: string | null, by: 'customer' | 'position', limit = 8): ScaleTopRow[] {
  const reqs = scopeOf(inp, { ...SCALE_ROOT, bu }).requests ?? [];
  const m = new Map<string, ScaleTopRow>();
  for (const r of reqs) {
    const label = (by === 'customer' ? r.unitName || r.siteName : r.position)?.trim() || 'ไม่ระบุ';
    const f = flowOf(r);
    const a = m.get(label) ?? { label, new: 0, filled: 0, cancelled: 0, remaining: 0, count: 0, oldest: null };
    a.new += f.new;
    a.filled += f.filled;
    a.cancelled += f.cancelled;
    a.remaining += f.remaining;
    if (f.remaining > 0) {
      a.count += 1;
      if (r.ageDays != null) a.oldest = Math.max(a.oldest ?? 0, r.ageDays);
    }
    m.set(label, a);
  }
  return [...m.values()].filter((a) => a.remaining > 0).sort((a, b) => b.remaining - a.remaining || a.label.localeCompare(b.label, 'th')).slice(0, limit);
}

/** รายใบของกล่องใบขอ: เหลือหา · ยังไม่เริ่มหา · ยกมา · ขอใหม่ · หาได้แล้ว · ยกเลิก */
export type ScaleReqRole = 'remaining' | 'idle' | 'carry' | 'new' | 'filled' | 'cancelled';
const REQ_ROLE: Partial<Record<ScaleBoxKey, ScaleReqRole>> = { reqPos: 'remaining', reqCount: 'remaining', reqIdle: 'idle', reqCarry: 'carry', reqNew: 'new', reqFilled: 'filled', reqCancelled: 'cancelled' };
export const scaleReqRoleOf = (key: ScaleBoxKey): ScaleReqRole | null => REQ_ROLE[key] ?? null;
/** อัตราของใบในบทบาทนั้น (ตามช่วง · `flowOf`) */
export function scaleReqAmount(r: StuckRequest, role: ScaleReqRole): number {
  const f = flowOf(r);
  return role === 'carry' ? f.carryIn : role === 'new' ? f.new : role === 'filled' ? f.filled : role === 'cancelled' ? f.cancelled : f.remaining;
}
/** ใบของชั้นในบทบาทนั้น — เหลือหา/ยังไม่เริ่มหา เรียงค้างนานสุดก่อน · ที่เหลือเรียงอัตรามากสุดก่อน */
export function scaleRequestsOf(inp: ScaleInput, lv: ScaleLevel, role: ScaleReqRole): StuckRequest[] {
  const aged = role === 'remaining' || role === 'idle';
  return (scopeOf(inp, lv).requests ?? [])
    .filter((r) => scaleReqAmount(r, role) > 0 && (role !== 'idle' || !isPostingStarted(r)))
    .sort((a, b) => (aged ? (b.ageDays ?? -1) - (a.ageDays ?? -1) : scaleReqAmount(b, role) - scaleReqAmount(a, role)) || a.requestNo.localeCompare(b.requestNo));
}

export type ScalePostingRow = { key: PostingState; label: string; /** false = ยังไม่เริ่มหา */ started: boolean; count: number; positions: number; /** ใบที่มีคนกรอกแล้ว */ withNames: number };
/**
 * ใบที่เหลือหาของชั้น ออกไปหาคนถึงไหน — หลักฐานการออกหาคน 9 แบบ ใบละสถานะเดียว (`postingStateOf` · ตัวเดียวกับการ์ดสถานะของแท็บภาพรวม)
 * แถวรวมกัน = กล่อง "เหลือหา (ใบ)" · แถวที่ `started` false รวมกัน = กล่อง "ยังไม่เริ่มหา (ใบ)" (มีเทสต์)
 * `withNames` = ใบที่มีคนกรอกแล้ว (ทุกช่วงเวลาของใบ · ช่องเดียวกับที่ `postingStateOf` ใช้ตัดสิน) · null = ชั้นนี้ไม่มีเรื่องใบขอ
 * (ผู้ช่วย AI ถูกถาม "ใบที่ประกาศไปแล้ว มีคนสมัครไหม" แล้วไม่มีเลขให้ตอบ · ทดสอบบนเว็บจริง 22 พ.ย. 2569)
 */
export function scalePostingStates(inp: ScaleInput, lv: ScaleLevel): ScalePostingRow[] | null {
  if (!scopeOf(inp, lv).requests) return null;
  const open = scaleRequestsOf(inp, lv, 'remaining');
  return POSTING_STATES.map((key): ScalePostingRow => {
    const rows = open.filter((r) => postingStateOf(r) === key);
    return {
      key,
      label: POSTING_STATE_LABEL[key],
      started: !NOT_STARTED_STATES.includes(key),
      count: rows.length,
      positions: rows.reduce((a, r) => a + scaleReqAmount(r, 'remaining'), 0),
      withNames: rows.filter((r) => r.applications > 0).length,
    };
  });
}
export type ScaleAnnounce = { open: number; notReleased: number; notReleasedWithApps: number; released: number; releasedWithApps: number; releasedNoApps: number };
/**
 * ใบที่เหลือหาของชั้น: ประกาศแล้ว / ยังไม่ประกาศ → มีคนกรอก / ไม่มีคนกรอก
 * ตัวแบ่งเดียวกับการ์ด "ใบขอเข้ามา" (`buildRequestFunnel`: ช่อง `released` · `applications`) — "ประกาศ" ของเจ้าของ = ขึ้นหน้าประกาศ ไม่ใช่โพสต์
 * ยังไม่ประกาศ + ประกาศแล้ว = กล่อง "เหลือหา (ใบ)" (มีเทสต์) · null = ชั้นนี้ไม่มีเรื่องใบขอ
 * (ผู้ช่วยถูกถาม "ใบที่ประกาศไปแล้ว มีคนสมัครไหม" แล้วตอบจากแถว "โพสต์แล้ว" ของหลักฐานการออกหาคน ซึ่งเป็นคนละเรื่อง · ถามซ้ำบนเว็บจริง 22 พ.ย. 2569)
 */
export function scaleAnnounce(inp: ScaleInput, lv: ScaleLevel): ScaleAnnounce | null {
  if (!scopeOf(inp, lv).requests) return null;
  const open = scaleRequestsOf(inp, lv, 'remaining');
  const released = open.filter((r) => r.released);
  const hidden = open.filter((r) => !r.released);
  const withApps = (list: readonly StuckRequest[]) => list.filter((r) => r.applications > 0).length;
  return {
    open: open.length,
    notReleased: hidden.length,
    notReleasedWithApps: withApps(hidden),
    released: released.length,
    releasedWithApps: withApps(released),
    releasedNoApps: released.length - withApps(released),
  };
}
const moneyJobKey = (r: Pick<MoneyRequest, 'requestNo'>): string => ledgerJobIdOf({ requestNo: r.requestNo, prequest: r.requestNo.startsWith(PREQUEST_LEDGER_PREFIX) }).toUpperCase();
const stuckJobKey = (r: Pick<StuckRequest, 'jobId' | 'requestNo'>): string => (r.jobId ?? `siamraj-sql:${r.requestNo}`).trim().toUpperCase();
/**
 * เหตุผลที่หยุด/ยกเลิกใบ (ERP) ต่อ id ใบ — มาจากรายใบของ `/api/home-money` (ตัวเดียวกับ "ยกเลิกเพราะอะไร" ของหน้าหลัก)
 * 🔴 คีย์ = id ใบ ไม่ใช่เลขที่ใบ (ใบขอชั่วคราวเลขซ้ำใบจริง) · ไม่มีในแผนที่ = ไม่ได้กรอก
 */
export function scaleStopReasons(inp: Pick<ScaleInput, 'money'>): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of inp.money ?? []) {
    const reason = r.stopReason?.trim();
    if (reason) out.set(moneyJobKey(r), reason);
  }
  return out;
}
export const scaleStopReasonOf = (reasons: ReadonlyMap<string, string>, r: Pick<StuckRequest, 'jobId' | 'requestNo'>): string | null => reasons.get(stuckJobKey(r)) ?? null;
/**
 * ยกเลิกเพราะอะไร — อัตราที่ยกเลิกของชั้น แยกตามเหตุผล · แถวรวมกัน = กล่อง "ยกเลิก" เสมอ (นับจากใบชุดเดียวกับกล่อง)
 * คำ "ไม่ได้กรอกเหตุผล" = `NO_REASON` ของหน้าหลัก · null = ยังอ่านเหตุผลไม่ได้ (ค่าปรับยังไม่โหลด) หรือชั้นนี้ไม่มีใบขอ
 */
export function scaleCancelReasons(inp: ScaleInput, lv: ScaleLevel): { rows: Array<{ label: string; n: number; count: number }>; total: number } | null {
  if (!inp.money) return null;
  const reqs = scopeOf(inp, lv).requests;
  if (!reqs) return null;
  const reasons = scaleStopReasons(inp);
  const m = new Map<string, { label: string; n: number; count: number }>();
  for (const r of reqs) {
    const n = flowOf(r).cancelled;
    if (n <= 0) continue;
    const label = scaleStopReasonOf(reasons, r) ?? NO_REASON;
    const a = m.get(label) ?? { label, n: 0, count: 0 };
    a.n += n;
    a.count += 1;
    m.set(label, a);
  }
  const rows = [...m.values()].sort((a, b) => Number(a.label === NO_REASON) - Number(b.label === NO_REASON) || b.n - a.n || a.label.localeCompare(b.label, 'th'));
  return { rows, total: rows.reduce((a, r) => a + r.n, 0) };
}
export const scaleMoneyOf = (inp: ScaleInput, bu: string | null): MoneyRequest[] => scopeOf(inp, { ...SCALE_ROOT, bu }).money ?? [];

/** แกนวัน: งานรวมต่อวันของชั้น (ทุกวันอยู่ครบ ว่าง = 0) · `month` = เฉพาะเดือนนั้น */
export function scaleDaySeries(inp: ScaleInput, lv: ScaleLevel, month?: string | null): Array<{ day: string; value: number }> {
  const staff = scopeOf(inp, { ...lv, day: null }).staff ?? [];
  return scaleDays(inp, month).map((day) => ({ day, value: staffWorkTotal(scaleWork(staff.filter((r) => r.day === day))) }));
}
export type ScaleDayRow = { name: string; bu: string; userId: string | null; work: StaffKindCounts; sum: number };
/** วันนั้นใครทำอะไร */
export function scaleDayTable(inp: ScaleInput, lv: ScaleLevel): { rows: ScaleDayRow[]; total: ScaleDayRow } {
  const staff = scopeOf(inp, lv).staff ?? [];
  const rows = uniq(staff.map((r) => r.name))
    .map((name): ScaleDayRow => {
      const mine = staff.filter((r) => r.name === name);
      const work = scaleWork(mine);
      return { name, bu: buOfRow(mine[0]?.bu), userId: mine[0]?.userId ?? null, work, sum: staffWorkTotal(work) };
    })
    .filter((r) => r.sum + r.work.appts > 0)
    .sort((a, b) => b.sum - a.sum || a.name.localeCompare(b.name, 'th'));
  const work = scaleWork(staff);
  return { rows, total: { name: 'รวม', bu: '', userId: null, work, sum: staffWorkTotal(work) } };
}
/** userId ของคน (ไว้ยิงรายการรายวัน) — ไม่มีงานในช่วง = null */
export const scaleUserIdOf = (inp: ScaleInput, name: string): string | null => inp.staff?.find((r) => r.name === name)?.userId ?? null;
/**
 * ชื่อที่โชว์ของคนประกาศ — ทะเบียนประกาศจดอีเมลไว้: เทียบส่วนหน้า @ กับคนที่มีงาน (ชื่อเล่น) · ไม่เจอ = ส่วนหน้า @ (ไม่โชว์อีเมลเต็ม)
 * ตัวเดียวของจอ (`ScalePanel`) และผู้ช่วย AI (`/api/exec-summary`)
 */
export function scaleStaffNamer(rows: ReadonlyArray<Pick<StaffActivityRow, 'login' | 'name'>>): (raw: string | null | undefined) => string | null {
  const byLogin = new Map<string, string>();
  for (const r of rows) if (r.login) byLogin.set(r.login.toLowerCase(), r.name);
  return (raw) => {
    const login = raw?.trim().split('@')[0] ?? '';
    return login ? (byLogin.get(login.toLowerCase()) ?? login) : null;
  };
}

/* ═══ เทียบช่วงก่อน ═══ */
/** กล่องที่เป็นสถานะ ณ ตอนนี้ (ไม่มีค่าของ "ช่วงก่อน") หรือเป็นข้อความ — ไม่มีป้ายเพิ่ม/ลด */
const NO_TREND: ReadonlySet<ScaleBoxKey> = new Set<ScaleBoxKey>(['reqIdle', 'hAll', 'hOk', 'hFail', 'hWait', 'hFree', 'eta']);
/** เพิ่มขึ้นแล้วแย่ */
const UP_IS_BAD: ReadonlySet<ScaleBoxKey> = new Set<ScaleBoxKey>(['reqPos', 'reqCount', 'reqCancelled', 'speed', 'callHours', 'badPhone', 'dup', 'penCount', 'fine', 'deduct', 'fitAgeOut', 'fitGenderOut']);
/** ไม่ตัดสินว่าดีหรือแย่ */
const UP_IS_PLAIN: ReadonlySet<ScaleBoxKey> = new Set<ScaleBoxKey>(['reqCarry', 'reqNew', 'inPerDay', 'scrapOrders', 'fitDistrict', 'fitProvince', 'fitRegion', 'fitFar', 'fitUnknown']);
/** เลขที่เพิ่งเริ่มนับ — ช่วงก่อนเริ่มก่อนวันนั้น = เทียบไม่ได้ (กติกาเดียวกับการ์ดการสั่งงานของภาพรวม) */
const TREND_SINCE: Partial<Record<ScaleBoxKey, string>> = { wSum: MANUAL_POSTED_SINCE, wLinks: LINK_CREATOR_SINCE, wPosted: MANUAL_POSTED_SINCE, wScrap: SO_POST_SINCE, wAutopost: SO_POST_SINCE, scrapOrders: SO_POST_SINCE };
/** วันที่ระบบเริ่มนับเลขของกล่องนี้ — null = นับมาตลอด (ผู้ช่วย AI ใช้บอกว่าเทียบช่วงก่อนไม่ได้เพราะอะไร) */
export const scaleTrendSince = (key: ScaleBoxKey): string | null => TREND_SINCE[key] ?? null;
/**
 * ป้ายเทียบช่วงก่อนของกล่อง — null = ไม่มีป้าย · `comparable` false = ขึ้น "เทียบไม่ได้" (ช่วงก่อนยังไม่เริ่มนับเลขนี้)
 */
export function scaleTrendOf(key: ScaleBoxKey, prevFrom: string): { sense: TrendSense; comparable: boolean } | null {
  if (NO_TREND.has(key)) return null;
  const since = TREND_SINCE[key];
  return { sense: UP_IS_BAD.has(key) ? 'bad' : UP_IS_PLAIN.has(key) ? 'plain' : 'good', comparable: since ? comparableSince(prevFrom, since) : true };
}

/** กล่องนี้คิดจากข้อมูลก้อนไหน — ช่วงก่อนของก้อนนั้นยังโหลดไม่เสร็จ = ยังไม่ขึ้นป้าย · อ่านไม่ได้ = "เทียบไม่ได้" */
export type ScaleSource = 'cohort' | 'staff' | 'requests' | 'money';
export function scaleSourceOf(key: ScaleBoxKey): ScaleSource {
  if (key.startsWith('req') || key === 'inPerDay' || key === 'outPerDay' || key === 'eta') return 'requests';
  if (key.startsWith('w') || key === 'scrapOrders') return 'staff';
  if (key === 'speed' || key === 'onTime' || key === 'penCount' || key === 'fine' || key === 'deduct') return 'money';
  return 'cohort';
}
/** วันก่อนหน้าของวันที่ดู — อยู่นอกช่วงที่เลือก (ไม่มีข้อมูลในมือ) = null */
export function scalePrevDay(inp: ScaleWindow, day: string): string | null {
  const prev = addDays(day, -1);
  return prev >= inp.from ? prev : null;
}

/**
 * เทียบกล่องนี้กับอะไรได้ไหม — กติกาเดียวของจอ (`ScalePanel`) และผู้ช่วย AI (`/api/exec-summary`)
 * ชั้นวัน = เทียบกับวันก่อน (ข้อมูลชุดเดียวกัน · วันก่อนอยู่นอกช่วง = เทียบไม่ได้) · ชั้นอื่น = เทียบกับช่วงก่อน
 * none = ไม่มีป้าย (สถานะ ณ ตอนนี้ / ไม่มีช่วงก่อน) · wait = ช่วงก่อนยังโหลด · na = เทียบไม่ได้ · ok = มีค่าช่วงก่อนให้เทียบ
 */
export type ScaleCompareCtx = {
  /** วันที่ดูอยู่ (ชั้นวัน) + วันก่อนหน้าที่อยู่ในช่วง */
  day: string | null;
  prevDay: string | null;
  /** วันแรกของช่วงก่อน — null = ไม่เทียบ (ปุ่ม "ทั้งหมด") */
  prevFrom: string | null;
  /** รายชื่อช่วงก่อนมีครบทั้งช่วง (ข้อมูลเริ่มกลางช่วง = false) */
  cohortOk: boolean;
  /** งาน / ใบขอ / ค่าปรับ ของช่วงก่อนตอบกลับมาแล้ว (อ่านได้หรือไม่ได้ก็ตาม) */
  loaded: boolean;
  /** ก้อนไหนของช่วงก่อนอ่านได้ */
  have: Record<Exclude<ScaleSource, 'cohort'>, boolean>;
};
export type ScaleCompare = { state: 'none' | 'wait' | 'na' | 'ok'; sense: TrendSense };
const NO_COMPARE: ScaleCompare = { state: 'none', sense: 'plain' };
export function scaleCompareOf(key: ScaleBoxKey, c: ScaleCompareCtx): ScaleCompare {
  if (c.day) {
    const t = scaleTrendOf(key, c.prevDay ?? c.day);
    return t ? { state: c.prevDay && t.comparable ? 'ok' : 'na', sense: t.sense } : NO_COMPARE;
  }
  if (!c.prevFrom) return NO_COMPARE;
  const t = scaleTrendOf(key, c.prevFrom);
  if (!t) return NO_COMPARE;
  const src = scaleSourceOf(key);
  if (src === 'cohort') return { state: t.comparable && c.cohortOk ? 'ok' : 'na', sense: t.sense };
  if (!c.loaded) return { state: 'wait', sense: t.sense };
  return { state: t.comparable && c.have[src] ? 'ok' : 'na', sense: t.sense };
}

/* ═══ ขั้นนี้ไปไหนต่อ ═══ */
/** กล่องรายชื่อ → ขั้นของสายเดียวกับภาพรวมที่แตกจากกล่องนั้น (`buildRecruitJourney`) */
const NEXT_STEP: Partial<Record<ScaleBoxKey, string>> = { cNames: 'names', cAiCalled: 'ai', cAiYes: 'staff', cStaffOk: 'appointment', cBooked: 'attendance' };
export type ScaleNextPart = { key: string; label: string; value: number; ids: string[]; /** เหตุผลที่เจ้าหน้าที่ลงไว้ มากสุดก่อน (เฉพาะช่องที่มีเหตุผล) */ reasons: Array<{ label: string; n: number }> };
export type ScaleNext = { title: string; total: number; parts: ScaleNextPart[] };
/**
 * คนในกล่องนี้ไปไหนต่อ — ช่องรวมกัน = เลขของกล่องเสมอ (ตัวแบ่งของ `buildRecruitJourney` · ไม่มีนิยามใหม่)
 * ติดต่อไม่ได้ / นัดไม่สำเร็จ มีเหตุผลที่เจ้าหน้าที่ลงไว้ (`logReason`) · ไม่มา ระบบไม่ได้เก็บเหตุผล
 */
export function scaleNext(inp: ScaleInput, lv: ScaleLevel, key: ScaleBoxKey): ScaleNext | null {
  const stepKey = NEXT_STEP[key];
  if (!stepKey) return null;
  const list = scopeOf(inp, lv).brought;
  const step: JourneyStep | undefined = buildRecruitJourney(list).find((s) => s.key === stepKey);
  if (!step) return null;
  const byId = new Map(list.filter((f) => f.id).map((f) => [f.id as string, f]));
  const withReason = stepKey === 'staff' ? 'fail' : stepKey === 'appointment' ? 'failed' : null;
  return {
    title: step.label,
    total: step.total,
    parts: step.parts.map((p) => {
      const m = new Map<string, number>();
      if (p.key === withReason)
        for (const id of p.ids) {
          const reason = byId.get(id)?.logReason?.trim() || 'ไม่ได้ลงเหตุผล';
          m.set(reason, (m.get(reason) ?? 0) + 1);
        }
      return { key: p.key, label: p.label, value: p.value, ids: p.ids, reasons: [...m.entries()].map(([label, n]) => ({ label, n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'th')) };
    }),
  };
}

/* ═══ เทียบเดือน ═══ */
export type ScaleMonthRow = ScaleMonth & { label: string; work: number | null; chain: number[]; /** งานของเดือนนี้เทียบกับเดือนก่อนในตารางได้ไหม (เดือนก่อนเริ่มหลังวันที่เริ่มนับงาน) */ workComparable: boolean };
/** ชั้นนี้แต่ละเดือนทำงานไปเท่าไหร่ ได้รายชื่อถึงไหน — แถวต่อเดือน (เก่า → ใหม่) */
export function scaleMonthTable(inp: ScaleInput, lv: ScaleLevel): ScaleMonthRow[] {
  const sc = scopeOf(inp, { ...lv, day: null });
  const months = scaleMonths(inp);
  return months.map((m, i) => ({
    ...m,
    label: scaleMonthLabel(m),
    work: sc.staff ? staffWorkTotal(scaleWork(sc.staff.filter((r) => r.day >= m.from && r.day <= m.to))) : null,
    chain: scaleChain(sc.brought.filter((f) => { const d = bkkDayOf(f.createdAt); return d >= m.from && d <= m.to; })).map((c) => c.value),
    workComparable: i > 0 && comparableSince(months[i - 1].from, MANUAL_POSTED_SINCE),
  }));
}

/* ═══ ตรงเกณฑ์ใบขอ ไล่ตามขั้น ═══ */
export const SCALE_FIT_KEYS: readonly ScaleBoxKey[] = ['fitDistrict', 'fitProvince', 'fitRegion', 'fitFar', 'fitUnknown', 'fitAgeOut', 'fitGenderOut'];
/**
 * เทียบพื้นที่ไม่ได้เพราะอะไร — 4 เหตุรวมกัน = กล่อง "เทียบพื้นที่ไม่ได้" เสมอ (ทุกเหตุอยู่ครบ ว่าง = 0)
 * ไม่ผูกใบขอ · ไม่มีรายละเอียดใบขอ · ใบขอไม่ระบุที่ตั้งงาน · ผู้สมัครไม่กรอกที่อยู่ · null = ยังไม่รู้เกณฑ์ของใบขอ
 */
export function scaleFitUnknownWhy(inp: ScaleInput, lv: ScaleLevel): Array<{ key: AreaFit; label: string; n: number; ids: string[] }> | null {
  const jobs = inp.jobs;
  if (!jobs) return null;
  const list = scopeOf(inp, lv).brought;
  return AREA_UNKNOWN.map((key) => {
    const hit = list.filter((f) => fitOf(jobs, f).area === key);
    return { key, label: AREA_FIT_LABEL[key], n: hit.length, ids: idsOf(hit) };
  });
}
export type ScaleFitStage = { key: ScaleBoxKey; label: string; total: number; cells: Array<{ key: ScaleBoxKey; n: number; ids: string[] }> };
/**
 * แถว "ตรงเกณฑ์ใบขอ" ไล่ตามขั้นของรายชื่อ — คนที่ไปถึงแต่ละขั้น (รายชื่อ … นัดได้ · มา · แจ้งเข้า) อยู่กล่องไหนกี่คน
 * 5 กล่องพื้นที่ของแต่ละขั้นรวมกัน = คนของขั้นนั้นเสมอ (ไม่รู้ที่อยู่/ที่ตั้งงานมีช่องของตัวเอง) · null = ยังไม่รู้เกณฑ์ของใบขอ
 */
export function scaleFitStages(inp: ScaleInput, lv: ScaleLevel): ScaleFitStage[] | null {
  if (!inp.jobs) return null;
  const list = scopeOf(inp, lv).brought;
  const byId = new Map(list.filter((f) => f.id).map((f) => [f.id as string, f]));
  const jobs = inp.jobs;
  const matchers = SCALE_FIT_KEYS.map((key) => ({ key, match: fitMatcher(jobs, key) }));
  return scaleChain(list).map((c, i) => {
    const facts = c.ids.map((id) => byId.get(id)).filter((f): f is RecruitAppFact => Boolean(f));
    return { key: SCALE_CHAIN[i].key, label: SCALE_CHAIN[i].label, total: c.value, cells: matchers.map((m) => { const hit = facts.filter(m.match); return { key: m.key, n: hit.length, ids: idsOf(hit) }; }) };
  });
}

/* ═══ แจ้งเข้า ใช้กี่วัน ═══ */
export type ScaleInformedRow = { id: string | null; bu: string; channel: string; bringer: string; createdDay: string; informedDay: string | null; /** วันกรอก → วันแจ้งเข้า · ติดลบ = แจ้งเข้าก่อนกรอกใบ · null = ไม่รู้วันแจ้งเข้า */ days: number | null };
/** คนที่แจ้งเข้าของชั้น — มาจากช่องทางไหน ใครหามา กรอกวันไหน แจ้งเข้าวันไหน */
export function scaleInformedRows(inp: ScaleInput, lv: ScaleLevel): ScaleInformedRow[] {
  return scopeOf(inp, lv)
    .brought.filter((f) => f.informed === true)
    .map((f) => {
      const createdDay = bkkDayOf(f.createdAt);
      const informedDay = f.informedAt ?? null;
      return { id: f.id ?? null, bu: buOfFact(f), channel: scaleChannelOf(f), bringer: bringerOf(f), createdDay, informedDay, days: informedDay ? Math.round((Date.parse(`${informedDay}T00:00:00Z`) - Date.parse(`${createdDay}T00:00:00Z`)) / 86_400_000) : null };
    })
    .sort((a, b) => (b.days ?? -99999) - (a.days ?? -99999) || a.createdDay.localeCompare(b.createdDay));
}

/* ═══ ทางเดิน + URL ═══ */
export type ScaleCrumb = { label: string; level: ScaleLevel };
/** ทางเดินจากบนลงล่าง — วันอยู่ท้ายสุดเสมอ (กดวันได้ทุกชั้น) */
export function scaleCrumbs(lv: ScaleLevel, rootLabel = 'ทั้งหมด'): ScaleCrumb[] {
  const out: ScaleCrumb[] = [{ label: rootLabel, level: { ...SCALE_ROOT } }];
  let cur: ScaleLevel = { ...SCALE_ROOT };
  const push = (label: string, patch: Partial<ScaleLevel>) => {
    cur = { ...cur, ...patch };
    out.push({ label, level: cur });
  };
  if (lv.bu) push(lv.bu, { bu: lv.bu });
  if (lv.who) push(lv.who, { who: lv.who });
  if (lv.ch) push(lv.ch, { ch: lv.ch });
  if (lv.grp) push(lv.grp, { grp: lv.grp });
  if (lv.day) push(scaleDayLabel(lv.day), { day: lv.day });
  return out;
}
const SCALE_PARAMS: ReadonlyArray<[keyof ScaleLevel, string]> = [['bu', 'sbu'], ['who', 'who'], ['ch', 'ch'], ['grp', 'grp'], ['day', 'day']];
export const SCALE_BOX_PARAM = 'box';
/** เดือนที่กดในตารางเทียบเดือน (YYYY-MM) — กราฟรายวันโชว์เดือนนั้น */
export const SCALE_MONTH_PARAM = 'mon';
export const scaleMonthFromParams = (p: URLSearchParams): string | null => {
  const m = p.get(SCALE_MONTH_PARAM)?.trim() ?? '';
  return /^\d{4}-\d{2}$/.test(m) ? m : null;
};
export function scaleLevelFromParams(p: URLSearchParams): ScaleLevel {
  const lv = { ...SCALE_ROOT };
  for (const [k, q] of SCALE_PARAMS) lv[k] = p.get(q)?.trim() || null;
  if (lv.day && !/^\d{4}-\d{2}-\d{2}$/.test(lv.day)) lv.day = null;
  // ชั้นลูกต้องมีแม่ — URL ที่ข้ามชั้นถอยกลับชั้นที่ครบ
  if (!lv.bu) lv.who = null;
  if (!lv.who) lv.ch = null;
  if (!lv.ch) lv.grp = null;
  return lv;
}
/** ใบขอที่เปิดดู "ทำอะไรไปแล้ว" (id ใบเต็ม) */
export const SCALE_REQUEST_PARAM = 'rq';
export const scaleRequestFromParams = (p: URLSearchParams): string | null => p.get(SCALE_REQUEST_PARAM)?.trim() || null;
/** `view` = ของที่เปิดอยู่ในชั้นนั้น (เดือนที่กด · ใบขอที่เปิด) — ไม่ส่ง = ล้าง */
export function scaleLevelToParams(p: URLSearchParams, lv: ScaleLevel, boxKey: ScaleBoxKey | null, view: { month?: string | null; request?: string | null } = {}): URLSearchParams {
  const next = new URLSearchParams(p);
  for (const [k, q] of SCALE_PARAMS) {
    if (lv[k]) next.set(q, lv[k] as string);
    else next.delete(q);
  }
  const put = (q: string, v: string | null | undefined) => (v ? next.set(q, v) : next.delete(q));
  put(SCALE_BOX_PARAM, boxKey);
  put(SCALE_MONTH_PARAM, view.month);
  put(SCALE_REQUEST_PARAM, view.request);
  return next;
}
