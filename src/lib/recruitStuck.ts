/**
 * ═══ ใบขอที่เหลือหา ติดตรงไหน · ติดที่ใคร (หน้าภาพรวมงานสรรหาโฉมใหม่ · เจ้าของ 4 พ.ย. 2569) ═══
 *
 * > *"มันต้องตอบได้ว่า ใบขอมา มาแล้วไปประกาศแล้ว แต่ปิดไม่ได้เพราะไม่มีคนนะ หรือ มีคนแต่คนไม่โทรนะ หรือ ปิดไม่ได้เพราะไม่ได้โพสต์ด้วยซ้ำ
 * > แล้วต้องบอกเลยว่า อ้อใบนี้ของใครรับผิดชอบบ้าง ช้าที่ใครเท่าไหร่ ไม่ประกาศเท่านี้ หรือ คิวมีชื่อของงานเนี้ยแต่ปิดไม่ได้ก็เพราะไม่โทรไง
 * > หรือ โทรจนไม่มีชื่อแล้วไรงี้"*
 *
 * ฐาน = ใบที่ยังเปิดอยู่ทุกใบ (ไม่ขึ้นกับช่วงวัน) · คนนับทุกช่วงเวลาของใบนั้น (`countsOf` ตัวเดียวกับเส้น 12 ขั้นหน้าหลัก)
 * 🔴 เหตุของใบมีที่เดียว (`stuckReasonOf`) · ทุกใบอยู่ 1 เหตุ · 4 ช่วงรวมกันเท่าใบที่ต้องหา (มีเทสต์)
 */
import type { ToneKey } from './designTokens';
import type { PipelineCounts } from './requestPipeline';
import type { RecruitRequestRow } from './recruitRequestTab';

export type StuckReasonKey =
  | 'not_released'
  | 'not_posted'
  | 'no_apps'
  | 'queued_not_called'
  | 'names_not_called'
  | 'staff_not_calling'
  | 'calling_no_interest'
  | 'names_exhausted'
  | 'cannot_reach'
  | 'not_interested'
  | 'no_appointment'
  | 'appointed_not_show'
  | 'showed_not_passed'
  | 'waiting_start';

export type StuckPhaseKey = 'before' | 'uncalled' | 'calling' | 'closing';

export const STUCK_PHASES: ReadonlyArray<{ key: StuckPhaseKey; label: string; tone: ToneKey; reasons: readonly StuckReasonKey[] }> = [
  { key: 'before', label: 'ยังไม่ได้ออกไปหาคน', tone: 'danger', reasons: ['not_released', 'not_posted', 'no_apps'] },
  { key: 'uncalled', label: 'มีชื่อแล้ว แต่ยังไม่ได้โทร', tone: 'warn', reasons: ['queued_not_called', 'names_not_called', 'staff_not_calling'] },
  { key: 'calling', label: 'โทรแล้ว ยังไม่ได้คน', tone: 'info', reasons: ['calling_no_interest', 'names_exhausted', 'cannot_reach', 'not_interested'] },
  { key: 'closing', label: 'ได้คนแล้ว รอปิดใบ', tone: 'success', reasons: ['no_appointment', 'appointed_not_show', 'showed_not_passed', 'waiting_start'] },
];

export const STUCK_REASON_LABEL: Record<StuckReasonKey, string> = {
  not_released: 'ยังไม่ประกาศ',
  not_posted: 'ประกาศแล้ว แต่ยังไม่ได้โพสต์',
  no_apps: 'โพสต์แล้ว ยังไม่มีคนกรอก',
  queued_not_called: 'มีชื่อในคิว AI ยังไม่โทร',
  names_not_called: 'มีชื่อ ยังไม่มีใครโทร',
  staff_not_calling: 'ตอบ AI ว่าสนใจ คนยังไม่โทรต่อ',
  calling_no_interest: 'โทรยังไม่ครบ ยังไม่มีคนสนใจ',
  names_exhausted: 'โทรจนชื่อหมด ไม่มีคนสนใจ',
  cannot_reach: 'โทรต่อแล้ว ติดต่อไม่ได้',
  not_interested: 'ติดต่อได้ แต่ไม่สนใจ',
  no_appointment: 'สนใจ ยังนัดไม่ได้',
  appointed_not_show: 'นัดแล้ว ยังไม่มา',
  showed_not_passed: 'มาแล้ว ยังไม่ผ่าน',
  waiting_start: 'ผ่านแล้ว รอเริ่มงาน',
};

const PHASE_OF: Record<StuckReasonKey, StuckPhaseKey> = Object.fromEntries(
  STUCK_PHASES.flatMap((p) => p.reasons.map((r) => [r, p.key])),
) as Record<StuckReasonKey, StuckPhaseKey>;
export const stuckPhaseOf = (reason: StuckReasonKey): StuckPhaseKey => PHASE_OF[reason];

/** สถานะโพสต์ล่าสุดของใบ (So Scraping) · null = ยังไม่เคยสั่ง */
export type StuckPostStatus = 'pending' | 'in_progress' | 'posted' | 'completed' | 'filled' | 'cancelled' | 'rejected';

export type StuckSignals = {
  released: boolean;
  /** มีลิงก์สมัคร หรือเคยสั่ง Autopost ที่ไม่ถูกยกเลิก/ไม่สำเร็จ = ถือว่าออกไปหาคนแล้ว */
  links: number;
  post: StuckPostStatus | null;
  counts: PipelineCounts;
  /** ยังไม่มีใครโทร (AI หรือคน) */
  uncalled: number;
  /** อยู่ในคิว AI รอโทร */
  queued: number;
};

const postedOut = (post: StuckPostStatus | null) => post !== null && post !== 'cancelled' && post !== 'rejected';

/**
 * ใบติดตรงไหน — ขั้นแรกที่ยังไม่มีใครผ่าน (ลำดับเดียวกับ `stuckOf` ของเส้น 12 ขั้น แต่แยกเหตุละเอียดตามที่เจ้าของเล่า)
 * - ยังไม่ประกาศ → ประกาศแล้วแต่ยังไม่ได้โพสต์ (ไม่มีลิงก์ ไม่เคยสั่ง Autopost) → โพสต์แล้วยังไม่มีคนกรอก
 * - มีชื่อ: ยังไม่มีใครโทร (ในคิว AI / ไม่มีคิว) → AI ว่าสนใจแล้วคนยังไม่โทรต่อ
 * - โทรแล้ว: ยังไม่ครบ (เหลือคนยังไม่โทร) / ชื่อหมดแล้ว · โทรต่อแล้วติดต่อไม่ได้ / ติดต่อได้แต่ไม่สนใจ
 * - ได้คน: ยังนัดไม่ได้ → นัดแล้วยังไม่มา → มาแล้วยังไม่ผ่าน → รอเริ่มงาน
 */
export function stuckReasonOf(s: StuckSignals): StuckReasonKey {
  const c = s.counts;
  if (!s.released) return 'not_released';
  if (c.apps === 0) return s.links > 0 || postedOut(s.post) ? 'no_apps' : 'not_posted';
  if (c.aiCalled === 0 && c.staffCalled === 0) return s.queued > 0 ? 'queued_not_called' : 'names_not_called';
  if (c.aiYes === 0 && c.interested === 0 && c.appointed === 0) return s.uncalled > 0 ? 'calling_no_interest' : 'names_exhausted';
  if (c.appointed === 0) {
    if (c.staffFollowed === 0 && c.interested === 0) return 'staff_not_calling';
    if (c.interested === 0) return c.staffReached === 0 ? 'cannot_reach' : 'not_interested';
    return 'no_appointment';
  }
  if (c.showed === 0) return 'appointed_not_show';
  if (c.passed === 0) return 'showed_not_passed';
  return 'waiting_start';
}

/**
 * สถานะใบ ณ ปลายช่วง — `requestFlowRole` ตัวเดียวกับสมการหน้าหลัก (review 9 พ.ย. 2569)
 * เหลือหา (เปิดปลายช่วง) · ปิดแล้ว (ได้คนครบ) · ยกเลิก (จบโดยไม่ครบ รวมได้บางส่วนแล้วยกเลิกที่เหลือ)
 */
export type StuckState = 'open' | 'filled' | 'cancelled';

/** ใบขอ 1 ใบของหน้า — ตัวกรองของหน้าใช้ช่องชุดเดียวกับใบขอในช่วง (`RecruitRequestRow`) */
export type StuckRequest = RecruitRequestRow & {
  /** ไม่มี = เส้นรุ่นเก่า (ใบที่ยังเปิดทั้งหมด) */
  state?: StuckState;
  /** ใบส่งเข้ามาในช่วงที่เลือก (ขอใหม่) · false = ใบที่เปิดอยู่ก่อนเริ่มช่วง (ยกมา) */
  inRange?: boolean;
  /** ผ่านมากี่วัน (วันทำงาน ตัวเดียวกับเมนูใบขอ) · null = ล่วงหน้า/ไม่มีวันที่ */
  ageDays: number | null;
  bu: string | null;
  screener: string | null;
  signals: StuckSignals;
  reason: StuckReasonKey;
  /** วันที่ประกาศครั้งแรก + ใคร */
  releasedAt: string | null;
  releasedBy: string | null;
};

/* ═══ สมการบนสุด (เจ้าของ 4 พ.ย. 2569 "กรองแค่ใบที่ไม่มีคน … มันต้อง Fil ดูได้หมดเลย") ═══
 * ยกมา + ขอใหม่ − ปิดแล้ว − ยกเลิก = เหลือหา — นิยามเดียวกับสมการหน้าหลัก (review 9 พ.ย. 2569 เจ้าของเลือก "เหมือนหน้าหลัก")
 * ยกมา = ใบที่เปิดอยู่ก่อนวันเริ่มช่วง · ขอใหม่ = ใบที่ส่งเข้ามาในช่วง · ปิดแล้ว/ยกเลิก = ใบที่จบในช่วง (ทั้งยกมาและขอใหม่)
 * แต่ละใบเป็นยกมาหรือขอใหม่อย่างเดียว และจบที่สถานะเดียว ⇒ สมการลงตัวเสมอ มีเทสต์ */
export type StuckScope = 'remaining' | 'carried' | 'new' | 'filled' | 'cancelled';
export const STUCK_SCOPE_LABEL: Record<StuckScope, string> = {
  carried: 'ยกมา',
  new: 'ขอใหม่',
  filled: 'ปิดแล้ว',
  cancelled: 'ยกเลิก',
  remaining: 'เหลือหา',
};
const stateOf = (r: StuckRequest): StuckState => r.state ?? 'open';
export function stuckInScope(r: StuckRequest, scope: StuckScope): boolean {
  if (scope === 'remaining') return stateOf(r) === 'open';
  if (scope === 'carried') return r.inRange === false;
  if (scope === 'new') return r.inRange !== false;
  return stateOf(r) === scope;
}
export function stuckEquation(rows: readonly StuckRequest[]): Record<StuckScope, StuckRequest[]> {
  const out: Record<StuckScope, StuckRequest[]> = { carried: [], new: [], filled: [], cancelled: [], remaining: [] };
  for (const r of rows) for (const k of Object.keys(out) as StuckScope[]) if (stuckInScope(r, k)) out[k].push(r);
  return out;
}

export const NO_RECRUITER_LABEL = 'ยังไม่ได้ตั้งเจ้าหน้าที่สรรหา';
export const recruiterLabelOf = (r: Pick<StuckRequest, 'recruiter'>) => r.recruiter?.trim() || NO_RECRUITER_LABEL;

/** นับต่อเหตุ (ทุกเหตุอยู่เสมอ ว่าง = 0) */
export function stuckByReason(rows: readonly StuckRequest[]): Record<StuckReasonKey, StuckRequest[]> {
  const out = Object.fromEntries(Object.keys(STUCK_REASON_LABEL).map((k) => [k, [] as StuckRequest[]])) as Record<StuckReasonKey, StuckRequest[]>;
  for (const r of rows) out[r.reason].push(r);
  return out;
}

/** นับต่อช่วง — 4 ช่วงรวมเท่าทั้งหมด */
export function stuckByPhase(rows: readonly StuckRequest[]): Record<StuckPhaseKey, StuckRequest[]> {
  const out: Record<StuckPhaseKey, StuckRequest[]> = { before: [], uncalled: [], calling: [], closing: [] };
  for (const r of rows) out[stuckPhaseOf(r.reason)].push(r);
  return out;
}

const oldestOf = (rows: readonly StuckRequest[]) => rows.reduce((m, r) => Math.max(m, r.ageDays ?? 0), 0);

export type StuckOwnerRow = { name: string; rows: StuckRequest[]; byPhase: Record<StuckPhaseKey, StuckRequest[]>; oldest: number; need: number };

/** ติดที่ใคร — ใบมากสุดก่อน · ยังไม่ได้ตั้งเจ้าหน้าที่อยู่ท้าย */
export function stuckByOwner(rows: readonly StuckRequest[]): StuckOwnerRow[] {
  const by = new Map<string, StuckRequest[]>();
  for (const r of rows) {
    const k = recruiterLabelOf(r);
    const list = by.get(k);
    if (list) list.push(r);
    else by.set(k, [r]);
  }
  return [...by.entries()]
    .map(([name, list]) => ({ name, rows: list, byPhase: stuckByPhase(list), oldest: oldestOf(list), need: list.reduce((s, r) => s + r.remaining, 0) }))
    .sort((a, b) => (a.name === NO_RECRUITER_LABEL ? 1 : 0) - (b.name === NO_RECRUITER_LABEL ? 1 : 0) || b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'th'));
}

export type StuckPlaceRow = { name: string; rows: StuckRequest[]; byPhase: Record<StuckPhaseKey, StuckRequest[]>; need: number; children: StuckPlaceRow[] };

const NO_PLACE = 'ไม่ระบุ';
/** พื้นที่ที่เหลือหา — จังหวัด → อำเภอ · ใบมากสุดก่อน · ไม่ระบุท้าย */
export function stuckByPlace(rows: readonly StuckRequest[]): StuckPlaceRow[] {
  const group = (list: readonly StuckRequest[], keyOf: (r: StuckRequest) => string, deeper: (l: StuckRequest[]) => StuckPlaceRow[]): StuckPlaceRow[] => {
    const by = new Map<string, StuckRequest[]>();
    for (const r of list) {
      const k = keyOf(r) || NO_PLACE;
      const l = by.get(k);
      if (l) l.push(r);
      else by.set(k, [r]);
    }
    return [...by.entries()]
      .map(([name, l]) => ({ name, rows: l, byPhase: stuckByPhase(l), need: l.reduce((s, r) => s + r.remaining, 0), children: deeper(l) }))
      .sort((a, b) => (a.name === NO_PLACE ? 1 : 0) - (b.name === NO_PLACE ? 1 : 0) || b.rows.length - a.rows.length || a.name.localeCompare(b.name, 'th'));
  };
  return group(rows, (r) => r.province ?? '', (l) => group(l, (r) => r.district ?? '', () => []));
}

/** รายการใบ — ค้างนานสุดก่อน */
export const sortStuck = (rows: readonly StuckRequest[]) => [...rows].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));

/** คนที่สรุปเหตุต่อแถวในรายการ/ตาราง — เจ้าหน้าที่ 3 คนแรก + ค้างนานสุด */
export function stuckWhoLine(rows: readonly StuckRequest[]): string {
  if (rows.length === 0) return 'ไม่มี';
  const c = new Map<string, number>();
  for (const r of rows) c.set(recruiterLabelOf(r), (c.get(recruiterLabelOf(r)) ?? 0) + 1);
  const top = [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `${top.map(([n, k]) => `${n} ${k}`).join(' · ')} · ค้างนานสุด ${oldestOf(rows)} วัน`;
}

/** เส้นทางของใบหนึ่งใบ — ขั้น + เลข + ขั้นที่ติด (การ์ดรายใบ) */
export type StuckStep = { key: string; label: string; value: number | string; stuck: boolean };
export function stuckSteps(r: StuckRequest): StuckStep[] {
  const s = r.signals;
  const c = s.counts;
  const postText = s.post ? (s.post === 'posted' || s.post === 'completed' || s.post === 'filled' ? 'Autopost แล้ว' : s.post === 'rejected' ? 'ไม่สำเร็จ' : s.post === 'cancelled' ? 'ยกเลิก' : 'สั่งแล้ว') : s.links ? `ลิงก์ ${s.links}` : 'ยัง';
  const def: Array<[string, string, number | string, StuckReasonKey[]]> = [
    ['released', 'ประกาศ', s.released ? 'แล้ว' : 'ยัง', ['not_released']],
    ['posted', 'โพสต์', postText, ['not_posted']],
    ['apps', 'กรอกมา', c.apps, ['no_apps']],
    ['uncalled', 'ยังไม่โทร', s.uncalled, ['queued_not_called', 'names_not_called']],
    ['ai', 'AI โทรแล้ว', c.aiCalled, ['calling_no_interest', 'names_exhausted']],
    ['aiYes', 'สนใจ', c.aiYes, []],
    ['staff', 'คนโทรต่อ', c.staffFollowed, ['staff_not_calling']],
    ['reached', 'ติดต่อได้', c.staffReached, ['cannot_reach', 'not_interested']],
    ['appointed', 'นัดได้', c.appointed, ['no_appointment']],
    ['showed', 'มา', c.showed, ['appointed_not_show']],
    ['passed', 'ผ่าน', c.passed, ['showed_not_passed', 'waiting_start']],
  ];
  return def.map(([key, label, value, ks]) => ({ key, label, value, stuck: ks.includes(r.reason) }));
}

/* ═══ เทียบเดือน — เซิร์ฟเวอร์ส่งยอดต่อ (เดือน, ใบขอ) · หน้าเว็บรวมเฉพาะใบที่ผ่านตัวกรอง ═══ */
export type StuckMonthlyRow = {
  month: string;
  /** jobId · '' = ไม่ผูกใบขอ */
  jobId: string;
  requests: number;
  apps: number;
  booked: number;
  /** null = อ่านแจ้งเข้า ERP ไม่ได้ (ห้ามยุบเป็น 0) */
  informed: number | null;
};
export type StuckTrendKey = 'requests' | 'apps' | 'booked' | 'informed';
export const STUCK_TREND_LABEL: Record<StuckTrendKey, string> = { requests: 'ใบขอเข้ามา', apps: 'รายชื่อที่กรอกมา', booked: 'นัดได้', informed: 'ได้ลงงาน' };

/** ยอดชุดนี้อ่านไม่ได้ (แจ้งเข้า ERP) — การ์ดบอกว่าอ่านไม่ได้แทนแท่ง 0 */
export const monthlyUnreadable = (rows: readonly StuckMonthlyRow[], key: StuckTrendKey): boolean => rows.some((r) => r[key] === null);

export function monthlySeries(rows: readonly StuckMonthlyRow[], key: StuckTrendKey, ok: (jobId: string | null) => boolean): Array<{ month: string; value: number }> {
  const by = new Map<string, number>();
  for (const r of rows) {
    if (!ok(r.jobId || null)) continue;
    by.set(r.month, (by.get(r.month) ?? 0) + (r[key] ?? 0));
  }
  return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, value]) => ({ month, value }));
}

/* ═══ ข้อ 1 "ใครต้องทำอะไร" (เจ้าของ 11 พ.ย. 2569 รวมหน้าภาพรวมเป็นหน้าเดียว 4 ข้อ · Choice "ตารางต่อคน งานที่ค้าง") ═══
 * แถว = เจ้าหน้าที่สรรหาของใบ (งานประกาศ/โพสต์ และรายชื่อที่ยังไม่มีคนเก็บ ลงที่เจ้าของใบ — Choice) · ช่อง = เหตุที่ใบค้าง 6 กลุ่ม
 * ช่องที่มีคนบอกทั้งใบและคน (Choice "ใบ + คน"): มีชื่อยังไม่โทร = คนที่รอโทร · โทรแล้วยังไม่ได้คน = คนที่เหลือโทร · รอปิดใบ = คนที่นัดได้
 * ทุกใบอยู่ช่องเดียว (`reason` ตัวเดียวกับการ์ดขั้นที่ติด) ⇒ ทุกช่องรวมกันเท่าใบทั้งหมด (มีเทสต์) */
export type StuckTodoKey = 'not_released' | 'not_posted' | 'no_apps' | 'uncalled' | 'calling' | 'closing';
export const STUCK_TODO_COLUMNS: ReadonlyArray<{ key: StuckTodoKey; label: string; reasons: readonly StuckReasonKey[]; peopleLabel: string | null }> = [
  { key: 'not_released', label: 'ยังไม่ประกาศ', reasons: ['not_released'], peopleLabel: null },
  { key: 'not_posted', label: 'ยังไม่โพสต์', reasons: ['not_posted'], peopleLabel: null },
  { key: 'no_apps', label: 'ไม่มีคนกรอก', reasons: ['no_apps'], peopleLabel: null },
  { key: 'uncalled', label: 'มีชื่อ ยังไม่โทร', reasons: ['queued_not_called', 'names_not_called', 'staff_not_calling'], peopleLabel: 'รอโทร' },
  { key: 'calling', label: 'โทรแล้ว ยังไม่ได้คน', reasons: ['calling_no_interest', 'names_exhausted', 'cannot_reach', 'not_interested'], peopleLabel: 'เหลือโทร' },
  { key: 'closing', label: 'ได้คนแล้ว รอปิดใบ', reasons: ['no_appointment', 'appointed_not_show', 'showed_not_passed', 'waiting_start'], peopleLabel: 'นัดได้' },
];
const TODO_OF: Record<StuckReasonKey, StuckTodoKey> = Object.fromEntries(
  STUCK_TODO_COLUMNS.flatMap((c) => c.reasons.map((r) => [r, c.key])),
) as Record<StuckReasonKey, StuckTodoKey>;

/** คนของใบในช่องนั้น — ช่องที่ไม่มีคน = 0 */
export function stuckTodoPeople(r: StuckRequest): number {
  const c = r.signals.counts;
  switch (TODO_OF[r.reason]) {
    case 'uncalled':
      return r.reason === 'staff_not_calling' ? c.aiYesNoStaff : r.signals.uncalled;
    case 'calling':
      return r.signals.uncalled;
    case 'closing':
      return c.appointed;
    default:
      return 0;
  }
}

export type StuckTodoRow = { owner: string; cells: Record<StuckTodoKey, StuckRequest[]>; total: number };
export function stuckTodoByOwner(rows: readonly StuckRequest[]): StuckTodoRow[] {
  const by = new Map<string, StuckTodoRow>();
  for (const r of rows) {
    const owner = recruiterLabelOf(r);
    const row = by.get(owner) ?? { owner, cells: Object.fromEntries(STUCK_TODO_COLUMNS.map((c) => [c.key, []])) as unknown as Record<StuckTodoKey, StuckRequest[]>, total: 0 };
    row.cells[TODO_OF[r.reason]].push(r);
    row.total += 1;
    by.set(owner, row);
  }
  return [...by.values()].sort((a, b) => b.total - a.total || a.owner.localeCompare(b.owner, 'th'));
}
