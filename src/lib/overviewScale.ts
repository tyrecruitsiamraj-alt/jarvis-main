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
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { STAFF_PERSON_KINDS, staffWorkTotal, emptyStaffKinds, type StaffActivityKind, type StaffActivityRow, type StaffKindCounts } from '@/lib/staffActivity';
import { flowOf, recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { isPostingStarted } from '@/lib/recruitPostingState';
import type { MoneyRequest } from '@/lib/homeMoney';
import { buildRecruitJourney, staffResultOf } from '@/lib/recruitJourney';
import { bringerOf, funnelSubChannelOf, funnelSubOf } from '@/lib/channelFunnel';
import { BU_UNKNOWN, buOfFact } from '@/lib/recruitAudience';
import { normalizeTrendBu } from '@/lib/trends/bu';

export type ScaleLevel = { bu: string | null; who: string | null; ch: string | null; grp: string | null; day: string | null };
export const SCALE_ROOT: ScaleLevel = { bu: null, who: null, ch: null, grp: null, day: null };

export type ScaleInput = {
  /** ใบของช่วงที่เลือก (cohort วันกรอก) */
  cohort: readonly RecruitAppFact[];
  /** null = ยังโหลดไม่เสร็จ/อ่านไม่ได้ ⇒ กล่องของก้อนนั้นขึ้น "—" ไม่ใช่ 0 */
  staff: readonly StaffActivityRow[] | null;
  requests: readonly StuckRequest[] | null;
  money: readonly MoneyRequest[] | null;
  from: string;
  to: string;
  today: string;
  now: number;
};

export type ScaleSectionKey = 'req' | 'work' | 'names' | 'hold' | 'speed' | 'quality' | 'penalty';
export type ScaleBoxKey =
  | 'reqPos' | 'reqCount' | 'reqIdle'
  | 'wSum' | 'wLinks' | 'wPosted' | 'wScrap' | 'wAutopost' | 'wContacts' | 'wAppts'
  | 'cNames' | 'cAiCalled' | 'cAiYes' | 'cStaffOk' | 'cBooked' | 'cShowed' | 'cInformed'
  | 'hAll' | 'hOk' | 'hFail' | 'hWait' | 'hFree'
  | 'inPerDay' | 'outPerDay' | 'eta' | 'speed' | 'onTime' | 'callHours'
  | 'badPhone' | 'dup' | 'scrapOrders' | 'scrapNames'
  | 'penCount' | 'fine' | 'deduct';

export type ScaleBox = {
  key: ScaleBoxKey;
  label: string;
  /** null = ชั้นนี้ไม่มีเลขนี้ (ขึ้น — และกดไม่ได้) */
  value: number | null;
  /** รูปแบบของเลข — dec1 = ทศนิยม 1 ตำแหน่ง · pct = % · text = ใช้ `text` แทนเลข */
  format: 'int' | 'dec1' | 'pct' | 'text';
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
/** วันของแกนวัน (เก่า → ใหม่) — ทุกวันอยู่ครบ · ช่วงยาวเกิน = `SCALE_CHART_DAYS` วันล่าสุดของช่วง */
export function scaleDays(inp: ScaleWindow): string[] {
  const n = Math.min(scaleDayCount(inp), SCALE_CHART_DAYS);
  const end = lastDayOf(inp);
  return Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));
}

const idsOf = (list: readonly RecruitAppFact[]): string[] => list.map((f) => f.id).filter((v): v is string => Boolean(v));
const pct = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const pctText = (a: number, b: number): string => (b > 0 ? `${Math.round((a / b) * 100)}%` : '');
const round1 = (v: number): number => Math.round(v * 10) / 10;
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

const box = (key: ScaleBoxKey, label: string, value: number | null, sub: string, more: Partial<ScaleBox> = {}): ScaleBox => ({
  key,
  label,
  value,
  format: 'int',
  sub: value == null && !more.text ? '' : sub,
  additive: true,
  ...more,
});

/** กล่องเลขทุกแถวของชั้น — แถวและช่องอยู่ที่เดิมทุกชั้น · ไม่มีเลข = value null */
export function scaleSections(inp: ScaleInput, lv: ScaleLevel): ScaleSection[] {
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
        box('fine', 'ค่าปรับ', pen ? Math.round(pen.reduce((n, r) => n + fineOf(r), 0)) : null, 'บาท'),
        box('deduct', 'ลดมูลค่า', pen ? Math.round(pen.reduce((n, r) => n + deductOf(r), 0)) : null, 'บาท'),
      ],
    });
  }
  return out;
}

export const scaleBoxOf = (sections: readonly ScaleSection[], key: ScaleBoxKey): ScaleBox | null => sections.flatMap((s) => s.boxes).find((b) => b.key === key) ?? null;
const sectionOfBox = (key: ScaleBoxKey): ScaleSectionKey =>
  key.startsWith('req') ? 'req' : key.startsWith('w') ? 'work' : key.startsWith('c') && key !== 'callHours' ? 'names' : key.startsWith('h') ? 'hold' : ['inPerDay', 'outPerDay', 'eta', 'speed', 'onTime', 'callHours'].includes(key) ? 'speed' : ['badPhone', 'dup', 'scrapOrders', 'scrapNames'].includes(key) ? 'quality' : 'penalty';

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
  if (lv.ch) return sec === 'names' ? { kind: 'group', items: names(sc.brought.map(scaleGroupOf), (n) => ({ grp: n })) } : null;
  if (lv.who) {
    if (sec === 'names') return { kind: 'channel', items: names(sc.brought.map(scaleChannelOf), (n) => ({ ch: n })) };
    if (sec === 'work' && !lv.day) return { kind: 'day', items: uniq((sc.staff ?? []).map((r) => r.day)).sort().map((d) => ({ key: d, label: `${scaleDayLabel(d)} · ${scaleWeekday(d)}`, go: { day: d } })) };
    return null;
  }
  if (lv.day) return sec === 'work' ? { kind: 'staff', items: names((sc.staff ?? []).map((r) => r.name), (n) => ({ who: n })) } : null;
  if (sec === 'req') return { kind: 'recruiter', items: names((sc.requests ?? []).filter((r) => flowOf(r).remaining > 0).map(recruiterLabelOf), (n) => ({ who: n })) };
  if (sec === 'work' || key === 'scrapOrders') return { kind: 'staff', items: names((sc.staff ?? []).map((r) => r.name), (n) => ({ who: n })) };
  if (sec === 'names' || key === 'badPhone' || key === 'dup') return { kind: 'bringer', items: names(sc.brought.map(bringerOf), (n) => ({ who: n })) };
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
    return { key: c.key, label: c.label, note: b && b.format !== 'int' ? b.sub : '', value: b?.value ?? null, format: b?.format ?? 'int', text: b?.text, go: c.go, ids: b?.ids };
  });
  const additive = Boolean(parent?.additive);
  const shown = (additive ? rows.filter((r) => (r.value ?? 0) > 0) : rows.filter((r) => r.value != null || r.text)).sort((a, b) => (additive || key === 'callHours' ? (b.value ?? -1) - (a.value ?? -1) : 0) || 0);
  return { kind: kids.kind, rows: shown, total: additive ? (parent?.value ?? null) : null };
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
  /** สังกัด BU นี้ (มีงานในช่วง) */
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

/** ชั้น BU: ทุกคนที่มีงานใน BU + ทุกคนที่หารายชื่อให้ BU นี้ */
export function scalePeopleTable(inp: ScaleInput, bu: string): { rows: ScalePersonRow[]; total: ScalePersonRow; average: { people: number; work: number; chain: number[] } } {
  const lv = { ...SCALE_ROOT, bu };
  const sc = scopeOf(inp, lv);
  const staff = sc.staff ?? [];
  const members = uniq(staff.map((r) => r.name));
  const bringers = uniq(sc.brought.map(bringerOf));
  const end = scaleDays(inp).at(-1) ?? inp.today;
  const workOf = (n: string) => scaleWork(staff.filter((r) => r.name === n));
  const namesOf = (n: string) => sc.brought.filter((f) => bringerOf(f) === n);
  const huntAll = members.reduce((a, n) => a + huntOf(workOf(n)), 0);
  const teamRate = huntAll > 0 ? (members.reduce((a, n) => a + namesOf(n).length, 0) / huntAll) * 100 : 0;
  const avgHunt = members.length ? huntAll / members.length : 0;
  const rows = uniq([...members, ...bringers]).map((name): ScalePersonRow => {
    const member = members.includes(name);
    const w = workOf(name);
    const mine = namesOf(name);
    const hunt = huntOf(w);
    const rate = member && hunt > 0 ? (mine.length / hunt) * 100 : null;
    const lastDay = member ? staff.filter((r) => r.name === name).map((r) => r.day).sort().at(-1) ?? null : null;
    return {
      name,
      member,
      source: SOURCE_NAMES.test(name),
      lastDay,
      idleDays: lastDay ? Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${lastDay}T00:00:00Z`)) / 86_400_000)) : null,
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

/** ใบขอที่เหลือหาของชั้น (ค้างนานสุดก่อน) · `idleOnly` = เฉพาะที่ยังไม่เริ่มหา */
export function scaleOpenRequests(inp: ScaleInput, lv: ScaleLevel, idleOnly = false): StuckRequest[] {
  return (scopeOf(inp, lv).requests ?? [])
    .filter((r) => flowOf(r).remaining > 0 && (!idleOnly || !isPostingStarted(r)))
    .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));
}
export const scaleMoneyOf = (inp: ScaleInput, bu: string | null): MoneyRequest[] => scopeOf(inp, { ...SCALE_ROOT, bu }).money ?? [];

/** แกนวัน: งานรวมต่อวันของชั้น (ทุกวันอยู่ครบ ว่าง = 0) */
export function scaleDaySeries(inp: ScaleInput, lv: ScaleLevel): Array<{ day: string; value: number }> {
  const staff = scopeOf(inp, { ...lv, day: null }).staff ?? [];
  return scaleDays(inp).map((day) => ({ day, value: staffWorkTotal(scaleWork(staff.filter((r) => r.day === day))) }));
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
export function scaleLevelToParams(p: URLSearchParams, lv: ScaleLevel, boxKey: ScaleBoxKey | null): URLSearchParams {
  const next = new URLSearchParams(p);
  for (const [k, q] of SCALE_PARAMS) {
    if (lv[k]) next.set(q, lv[k] as string);
    else next.delete(q);
  }
  if (boxKey) next.set(SCALE_BOX_PARAM, boxKey);
  else next.delete(SCALE_BOX_PARAM);
  return next;
}
