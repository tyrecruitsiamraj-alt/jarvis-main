/**
 * ═══ แท็บ "สัดส่วน" หน้าหลัก — แต่ละเรื่อง AI ทำเท่าไหร่ คนทำเท่าไหร่ (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"ใช้เพื่อดูว่าระบบเนี่ย คนหรือ Ai ทำไปเท่าไหร่ เรื่องไหนจะผลักดันให้ Ai เยอะ เรื่องไหนคนก็ปล่อยไป
 * > ฉันต้องตอบผู้บริหารเวลาเขาถามว่าตอนนี้ระบบไปกี่ %"*
 *
 * Choice เจ้าของ:
 *   - ไม่มีเลขรวมเลขเดียว — แยกรายเรื่อง · ชื่อแท็บ "สัดส่วน"
 *   - **% = AI ได้โทร รวมที่คนตามต่อ** — (AI + ทั้งสองทาง) ÷ งานที่ทำแล้ว · ยังไม่มีงาน = null (ห้ามขึ้น 0%)
 *   - กดแถว = แผงแตกเป็นขั้นที่ลงตัว (`Ladder`) · ตัวที่หาเหตุไม่เจอขึ้นเป็น "ยังไม่รู้เหตุ" ห้ามหาย
 * 🔴 โครงขั้นของแต่ละเรื่อง (เจ้าของ 29 ต.ค. 2569 — Prescreen สั่งเอง ที่เหลือเลือกผ่าน Choice):
 *   - Prescreen: รายชื่อทั้งหมด → 1 โทรไปแล้ว → 2 ติดต่อสำเร็จ (สนใจ · ไม่สนใจ · คนละพื้นที่ · ขอคิดก่อน · สรุปไม่ได้)
 *     → 3 ติดต่อไม่สำเร็จ (ไม่รับสาย · รับแล้วเงียบ · ไม่ใช่เจ้าตัว …) → 4 รอโทร → 5 ไม่โทร เพราะอะไร
 *   - โทรหลัง Prescreen · นัดได้ แยกเรื่อง · นัดได้ตอบ "จากที่ติดต่อสำเร็จทั้งหมด นัดได้เท่าไหร่ มาเท่าไหร่ ไม่มาเท่าไหร่"
 *   - ติดตามคนเริ่มงาน / คนแทน นับเป็นสาย: ได้คำตอบ · ติดต่อไม่ได้ · รอโทร · ไม่โทร
 *   - ดูแลหลังเริ่มงาน นับเป็นคน ตาม 3 หัวข้อ Healthy / Warning / High Risk
 *   - จับคู่งาน แบบเดียวกับ Prescreen · ทางเข้าของงาน คงไว้ · ถอดก้อน "ขั้นที่ยังเป็นคน 100%" (มา/ไม่มา อยู่ในนัดได้แล้ว)
 *
 * ไฟล์นี้ pure — เทสต์ `tests/api/homeProportion2569-10-28.test.ts`
 */
import type { RecruitAppFact } from './recruitOverviewTypes';
import type { TopicReport } from './homeTopicReport';
import type { ToneKey } from './designTokens';
import { aiStage, staffResultOf } from './recruitJourney';
import { FOLLOW_DISPATCH_META, type FollowDispatchState } from './followDispatchState';

/** ช่องหนึ่งของขั้น · `stuck` = ค้างอยู่ ต้องมีคนทำ (ขึ้นในก้อน "งานที่ค้างอยู่" บนสุดของแท็บ) */
export type LadderPart = { key: string; label: string; value: number; tone: ToneKey; stuck?: boolean };

/** ขั้นหนึ่งของแผง — `parts` รวมกัน = `value` เสมอ (มีช่อง) · `sub` = บรรทัดเล็กใต้หัวขั้น · `indent` = ขั้นย่อยของขั้นก่อน */
export type LadderStep = { key: string; title: string; value: number; parts: LadderPart[]; sub?: string; indent?: boolean; deep?: boolean };

/** แผงของแถว — `equation` รวมกัน = `total` · `checks` = คู่ตัวเลขที่ต้องเท่ากัน (เช่น ติดต่อสำเร็จ + ไม่สำเร็จ = โทรแล้ว) */
export type Ladder = {
  unit: string;
  totalLabel: string;
  total: number;
  equation: Array<{ label: string; value: number }>;
  steps: LadderStep[];
  checks: Array<[number, number]>;
  /** ไม่นับในรายชื่อ (เช่น สายยกเลิก — กติกาเดียวกับแท็บภาพรวม) บอกไว้ใต้สมการ */
  excluded?: { label: string; value: number };
};

const sum = (parts: ReadonlyArray<{ value: number }>) => parts.reduce((t, p) => t + p.value, 0);

/** บวกลบลงตัวทุกชั้น */
export function ladderAddsUp(l: Ladder): boolean {
  return (
    sum(l.equation) === l.total &&
    l.steps.every((s) => s.parts.length === 0 || sum(s.parts) === s.value) &&
    l.checks.every(([a, b]) => a === b)
  );
}

/** นับเข้าช่องตามลำดับที่ประกาศ — ช่อง 0 ตัดทิ้ง */
function tally(order: ReadonlyArray<{ key: string; label: string; tone: ToneKey; stuck?: boolean }>, keys: readonly string[]): LadderPart[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return order.map((o) => ({ ...o, value: counts.get(o.key) ?? 0 })).filter((p) => p.value > 0);
}

/** เหตุเป็นข้อความ — เรียงตามที่เจอก่อน · "ยังไม่รู้เหตุ" แดง + ค้าง */
const UNKNOWN = 'ยังไม่รู้เหตุ';
function reasons(labels: readonly string[], stuckLabels: readonly string[] = []): LadderPart[] {
  const order = [...new Set(labels)].map((label) => ({
    key: label,
    label,
    tone: (label === UNKNOWN ? 'danger' : 'neutral') as ToneKey,
    stuck: label === UNKNOWN || stuckLabels.includes(label),
  }));
  return tally(order, labels);
}

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number) => NUM.format(v);
const whoSub = (ai: number, both: number, staff: number) => `AI ${n(ai)} · ทั้งสองทาง ${n(both)} · คน ${n(staff)}`;

// ── ติดตาม (นับเป็นสาย) ───────────────────────────────────────────────

/** ติดตาม / ดูแล หนึ่งก้อน — AI/คน ของแถว + แผง */
export type ProportionCallCounts = {
  ai: number;
  both: number;
  staff: number;
  none: number;
  /** AI โทรแล้วไม่ได้คุย (ไม่รับ · สายไม่ว่าง · ล้ม) */
  aiUnreached: number;
  ladder?: Ladder;
};

/** แถวสายหนึ่งสาย (Node ประกอบจากแถวฐาน + `followLedgerBucket`) */
export type FollowLadderInput = {
  ai: boolean;
  staff: boolean;
  aiUnreached: boolean;
  /** ช่องผลของการ์ดผลโทร — went · notWent · dayOff · leave · reschedule · unclear · waiting · failed · cancelled */
  bucket: string;
  mode: 'ai' | 'manual';
  dispatch: string | null;
  queueStatus: string | null;
  /** ยังไม่ถึงเวลาสาย */
  future?: boolean;
  /** แถวถูกสร้างหลังเวลาสายแล้ว (ใบลงย้อนหลังใน iRecruit) */
  backfilled?: boolean;
};

/** 🔴 ลงย้อนหลัง ≠ งานค้าง (เจ้าของ 29 ต.ค. 2569) — สายที่ถูกสร้างหลังเวลาโทรไปแล้ว ไม่มีใครโทรได้ตั้งแต่แรก ⇒ ช่อง "ไม่โทร" */
export const FOLLOW_BACKFILLED_LABEL = 'ลงย้อนหลัง ดึงมาตอนเวลาโทรผ่านไปแล้ว';

const FOLLOW_ANSWER = [
  { key: 'went', label: 'ไป', tone: 'success' },
  { key: 'notWent', label: 'ไม่ไป', tone: 'danger' },
  { key: 'reschedule', label: 'ขอเลื่อน', tone: 'orange' },
  { key: 'dayOff', label: 'วันหยุด', tone: 'teal' },
  { key: 'leave', label: 'ลางาน', tone: 'violet' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: 'warn' },
] as const satisfies ReadonlyArray<{ key: string; label: string; tone: ToneKey }>;
const FOLLOW_ANSWER_KEYS = new Set<string>(FOLLOW_ANSWER.map((x) => x.key));

const AI_NOT_SENT = new Set<string>(['held', 'suppressed', 'guarded', 'no_phone', 'off', 'push_failed', 'not_imported']);
/** เหตุที่ AI ไม่ได้ส่ง — คำเดียวกับป้ายบนหน้าติดตาม ตัด "ไม่ได้ส่ง — " หน้าคำ */
const dispatchReason = (d: string) => (FOLLOW_DISPATCH_META[d as FollowDispatchState]?.label ?? d).replace(/^ไม่ได้ส่ง — /, '');

export function summarizeFollowLane(rows: readonly FollowLadderInput[], excludedCancelled = 0): ProportionCallCounts {
  let ai = 0;
  let both = 0;
  let staff = 0;
  let none = 0;
  let aiUnreached = 0;
  const answered: string[] = [];
  const unreached: string[] = [];
  const noVerdict: string[] = [];
  const waiting: string[] = [];
  const notCalled: string[] = [];
  for (const r of rows) {
    if (r.ai && r.staff) both += 1;
    else if (r.ai) ai += 1;
    else if (r.staff) staff += 1;
    else none += 1;
    if (r.ai && r.aiUnreached) aiUnreached += 1;
    if (r.ai || r.staff) {
      if (FOLLOW_ANSWER_KEYS.has(r.bucket)) answered.push(r.bucket);
      else if (r.bucket === 'failed') unreached.push('failed');
      else noVerdict.push(r.bucket === 'cancelled' ? 'cancelled' : 'waiting');
      continue;
    }
    if (r.bucket === 'cancelled') notCalled.push('หยุดในคิว ได้คำตอบจากสายอื่นแล้ว');
    else if (!r.future && r.backfilled) notCalled.push(FOLLOW_BACKFILLED_LABEL);
    else if (r.mode === 'manual') waiting.push(r.future ? 'staffLater' : 'staff');
    else if (r.dispatch && AI_NOT_SENT.has(r.dispatch)) notCalled.push(dispatchReason(r.dispatch));
    else if (r.future) waiting.push('aiLater');
    else if (r.queueStatus === 'pending' || r.queueStatus === 'delivered') waiting.push('aiNoResult');
    else notCalled.push(UNKNOWN);
  }
  const called = ai + both + staff;
  const steps: LadderStep[] = [
    { key: 'called', title: 'โทรไปแล้ว', value: called, parts: [], sub: whoSub(ai, both, staff) },
    { key: 'answered', title: 'ได้คำตอบ', value: answered.length, parts: tally(FOLLOW_ANSWER, answered), indent: true },
    {
      key: 'unreached',
      title: 'ติดต่อไม่ได้',
      value: unreached.length,
      parts: tally([{ key: 'failed', label: 'ไม่รับสาย / สายไม่ว่าง / รับแล้วเงียบ', tone: 'neutral' }], unreached),
      indent: true,
    },
  ];
  if (noVerdict.length) {
    steps.push({
      key: 'noVerdict',
      title: 'ยังไม่มีผลสรุป',
      value: noVerdict.length,
      parts: tally(
        [
          { key: 'waiting', label: 'โทรแล้ว รอผลกลับ', tone: 'info' },
          { key: 'cancelled', label: 'โทรแล้ว ภายหลังยกเลิก', tone: 'neutral' },
        ],
        noVerdict,
      ),
      indent: true,
    });
  }
  steps.push(
    {
      key: 'waiting',
      title: 'รอโทร',
      value: waiting.length,
      parts: tally(
        [
          { key: 'aiLater', label: 'AI จะโทรตามเวลา', tone: 'info' },
          { key: 'staffLater', label: 'คนจะโทรตามเวลา', tone: 'violet' },
          { key: 'aiNoResult', label: 'ส่ง AI แล้ว เลยเวลายังไม่มีผลกลับ', tone: 'warn', stuck: true },
          { key: 'staff', label: 'คนโทร เลยเวลาแล้วยังไม่ลงผล', tone: 'danger', stuck: true },
        ],
        waiting,
      ),
    },
    { key: 'notCalled', title: 'ไม่โทร', value: notCalled.length, parts: reasons(notCalled) },
  );
  return {
    ai,
    both,
    staff,
    none,
    aiUnreached,
    ladder: {
      unit: 'สาย',
      totalLabel: 'สายทั้งหมด',
      total: rows.length,
      equation: [
        { label: 'โทรแล้ว', value: called },
        { label: 'รอโทร', value: waiting.length },
        { label: 'ไม่โทร', value: notCalled.length },
      ],
      steps,
      checks: [[answered.length + unreached.length + noVerdict.length, called]],
      excluded: excludedCancelled > 0 ? { label: 'ยกเลิก ไม่นับ', value: excludedCancelled } : undefined,
    },
  };
}

// ── ดูแลหลังเริ่มงาน (นับเป็นคน) ───────────────────────────────────────

/** คนหนึ่งคนในการดูแล (ไม่ปิด) — Node ประกอบจาก aftercare_people + ผลล่าสุด + สายถามความเป็นอยู่ */
export type AftercarePersonInput = {
  /** AI เคยโทรถามความเป็นอยู่แล้ว (มีผลกลับ) */
  aiCalled: boolean;
  /** ผลล่าสุดที่เจ้าหน้าที่ลง (working · issue · resigned · unreachable) · ไม่เคย = null */
  result: string | null;
  expectation: string | null;
  supervisor: string | null;
  escalation: string | null;
  /** ตั้งรอบโทรไว้แล้ว (ไม่ยกเลิก) */
  hasRounds: boolean;
  /** มีรอบที่ยังไม่ถึงเวลา */
  upcoming: boolean;
  /** มีรอบที่เลยเวลาแล้วยังไม่มีผล */
  overdue: boolean;
};

const SCORE_PARTS = [
  { key: 'healthy', label: 'Healthy', tone: 'success' },
  { key: 'warning', label: 'Warning', tone: 'warn' },
  { key: 'high_risk', label: 'High Risk', tone: 'danger' },
  { key: 'none', label: 'ยังไม่ได้ลงคะแนน', tone: 'neutral' },
] as const satisfies ReadonlyArray<{ key: string; label: string; tone: ToneKey }>;

export const AFTERCARE_TOPIC_STEPS = [
  { key: 'expectation', title: 'งานตรงกับที่คาดหวังหรือไม่' },
  { key: 'supervisor', title: 'ได้รับการดูแลจากหัวหน้างานหรือไม่' },
  { key: 'escalation', title: 'หากมีปัญหารู้หรือไม่ต้องปรึกษาใคร' },
] as const;

export function summarizeAftercarePeople(people: readonly AftercarePersonInput[]): ProportionCallCounts {
  let ai = 0;
  let both = 0;
  let staff = 0;
  let none = 0;
  const talked: AftercarePersonInput[] = [];
  const notTalked: string[] = [];
  const waiting: string[] = [];
  const notCalled: string[] = [];
  for (const p of people) {
    const staffDid = p.result !== null;
    if (p.aiCalled && staffDid) both += 1;
    else if (p.aiCalled) ai += 1;
    else if (staffDid) staff += 1;
    else none += 1;
    if (p.result === 'working' || p.result === 'issue') talked.push(p);
    else if (p.result === 'resigned' || p.result === 'unreachable') notTalked.push(p.result);
    else if (p.aiCalled) notTalked.push('aiOnly');
    else if (p.overdue) waiting.push('overdue');
    else if (p.upcoming) waiting.push('upcoming');
    else if (!p.hasRounds) notCalled.push('ยังไม่ตั้งรอบโทร');
    else notCalled.push(UNKNOWN);
  }
  const called = ai + both + staff;
  const scoreOf = (v: string | null) => (v === 'healthy' || v === 'warning' || v === 'high_risk' ? v : 'none');
  const steps: LadderStep[] = [
    { key: 'called', title: 'โทรไปแล้ว', value: called, parts: [], sub: whoSub(ai, both, staff) },
    { key: 'talked', title: 'คุยได้', value: talked.length, parts: [], indent: true },
    ...AFTERCARE_TOPIC_STEPS.map((t) => ({
      key: t.key,
      title: t.title,
      value: talked.length,
      parts: tally(
        SCORE_PARTS,
        talked.map((p) => scoreOf(p[t.key])),
      ),
      indent: true,
      deep: true,
    })),
    {
      key: 'notTalked',
      title: 'คุยไม่ได้',
      value: notTalked.length,
      parts: tally(
        [
          { key: 'resigned', label: 'ลาออก', tone: 'danger' },
          { key: 'unreachable', label: 'ติดต่อไม่ได้', tone: 'neutral' },
          { key: 'aiOnly', label: 'AI โทรแล้ว ยังไม่มีคนลงผล', tone: 'warn', stuck: true },
        ],
        notTalked,
      ),
      indent: true,
    },
    {
      key: 'waiting',
      title: 'รอโทร',
      value: waiting.length,
      parts: tally(
        [
          { key: 'upcoming', label: 'ยังไม่ถึงรอบ', tone: 'info' },
          { key: 'overdue', label: 'เลยรอบแล้ว ยังไม่โทร', tone: 'danger', stuck: true },
        ],
        waiting,
      ),
    },
    { key: 'notCalled', title: 'ไม่โทร', value: notCalled.length, parts: reasons(notCalled, ['ยังไม่ตั้งรอบโทร']) },
  ];
  return {
    ai,
    both,
    staff,
    none,
    aiUnreached: 0,
    ladder: {
      unit: 'คน',
      totalLabel: 'คนที่ดูแลอยู่',
      total: people.length,
      equation: [
        { label: 'โทรแล้ว', value: called },
        { label: 'รอโทร', value: waiting.length },
        { label: 'ไม่โทร', value: notCalled.length },
      ],
      steps,
      checks: [[talked.length + notTalked.length, called]],
    },
  };
}

// ── สรรหา ──────────────────────────────────────────────────────────────

/** เหตุที่ใบสมัครยังไม่มีใครโทร (ฝั่งฐาน) — `null` = ยังไม่รู้จากฐาน (หน้าเว็บเช็กใบขอปิดต่อ) */
export type AppNoCallReason = 'dup' | 'soScraping' | 'keyed' | 'noJob' | 'block' | 'suppressed' | 'noIncome';
export type ProportionAppFlag = { id: string; jobId: string | null; claimed: boolean; reason: AppNoCallReason | null; blockReason: string | null };

export const APP_NO_CALL_LABEL: Record<AppNoCallReason | 'closed' | 'unknown', string> = {
  dup: 'ซ้ำ iRecruit ภายใน 14 วัน AI ไม่โทรเอง',
  soScraping: 'มาจาก So Scraping ยังไม่ส่ง AI',
  keyed: 'คนคีย์ / นำเข้า Excel AI ไม่โทรเอง',
  noJob: 'ไม่ผูกใบขอ AI ไม่มีงานให้เสนอ',
  block: 'ตัวส่งบอกเหตุ',
  suppressed: 'เบอร์ถูกพัก (ไม่หางานแล้ว / เบอร์เสีย)',
  noIncome: 'ใบขอยังไม่ตั้งรายได้',
  closed: 'ใบขอปิดแล้ว',
  unknown: UNKNOWN,
};

const TALKED = [
  { key: 'yes', label: 'สนใจ', tone: 'success' },
  { key: 'no', label: 'ไม่สนใจ', tone: 'danger' },
  { key: 'area', label: 'คนละพื้นที่', tone: 'orange' },
  { key: 'thinking', label: 'ขอคิดก่อน', tone: 'warn' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: 'violet' },
  { key: 'staffOk', label: 'คนโทรเอง ติดต่อได้', tone: 'teal' },
] as const satisfies ReadonlyArray<{ key: string; label: string; tone: ToneKey }>;
const NOT_TALKED = [
  { key: 'noPickup', label: 'ไม่รับสาย', tone: 'neutral' },
  { key: 'silent', label: 'รับแล้วเงียบ', tone: 'neutral' },
  { key: 'wrongPerson', label: 'ไม่ใช่เจ้าตัว', tone: 'orange' },
  { key: 'noResult', label: 'ไม่มีผลกลับ', tone: 'warn' },
  { key: 'staffFail', label: 'คนโทรเอง ติดต่อไม่ได้', tone: 'neutral' },
  { key: 'staffPending', label: 'คนโทรเอง ยังไม่ลงผล', tone: 'warn' },
] as const satisfies ReadonlyArray<{ key: string; label: string; tone: ToneKey }>;

/** ผลของใบที่โทรแล้ว — AI โทร = คำตอบกับ AI (Prescreen เป็นขั้นของ AI) · คนโทรอย่างเดียว = ผลติดต่อของเจ้าหน้าที่ */
function prescreenResultOf(a: RecruitAppFact): { talked: boolean; key: string } {
  if (!a.calledByAi) {
    const s = staffResultOf(a);
    return s === 'ok' ? { talked: true, key: 'staffOk' } : { talked: false, key: s === 'fail' ? 'staffFail' : 'staffPending' };
  }
  const area = a.aiOutOfArea === true;
  switch (a.aiAnswer) {
    case 'said_yes':
      return { talked: true, key: 'yes' };
    case 'said_no':
      return { talked: true, key: area ? 'area' : 'no' };
    case 'not_yet':
      return { talked: true, key: area ? 'area' : 'thinking' };
    case 'talked_unclear':
      return { talked: true, key: area ? 'area' : 'unclear' };
    case 'no_pickup':
      return { talked: false, key: 'noPickup' };
    case 'picked_silent':
      return { talked: false, key: 'silent' };
    case 'wrong_person':
      return { talked: false, key: 'wrongPerson' };
    default:
      return { talked: false, key: 'noResult' };
  }
}

/**
 * สรรหา 3 เรื่อง จากใบสมัครชุดเดียวกับหน้าหลัก (`ro.apps` · ช่วง/BU เดียวกัน)
 * `flags` = เหตุ/คนเก็บ จากฐาน · `openJobIds` = ใบขอที่เปิดอยู่ (null = อ่านไม่ได้ ⇒ ไม่เดาว่าปิด)
 */
export function recruitProportionRows(
  apps: readonly RecruitAppFact[],
  flags: readonly ProportionAppFlag[] | null = null,
  openJobIds: ReadonlySet<string> | null = null,
): ProportionRow[] {
  const flagOf = new Map((flags ?? []).map((f) => [f.id, f]));
  // ── Prescreen ──
  let ai = 0;
  let both = 0;
  let staff = 0;
  const talked: string[] = [];
  const notTalked: string[] = [];
  const waiting: string[] = [];
  const notCalled: string[] = [];
  for (const a of apps) {
    const fl = a.id ? flagOf.get(a.id) : undefined;
    if (a.calledByAi && a.calledByStaff) both += 1;
    else if (a.calledByAi) ai += 1;
    else if (a.calledByStaff) staff += 1;
    if (a.calledByAi || a.calledByStaff) {
      const r = prescreenResultOf(a);
      (r.talked ? talked : notTalked).push(r.key);
      continue;
    }
    const stage = aiStage(a);
    if (stage === 'queued') waiting.push('aiQueued');
    else if (fl?.claimed) waiting.push('claimed');
    else if (stage === 'bad') notCalled.push('เบอร์ผิด โทรไม่ได้');
    else if (stage === 'overAge') notCalled.push('อายุ 58 ปีขึ้นไป ระบบไม่ส่ง AI');
    else if (stage === 'irecruit') notCalled.push('ดึงจาก iRecruit AI ไม่โทรเอง');
    else if (fl?.reason === 'block') notCalled.push(fl.blockReason?.split(' — ')[0] || UNKNOWN);
    else if (fl?.reason) notCalled.push(APP_NO_CALL_LABEL[fl.reason]);
    else if (openJobIds && a.jobId && !openJobIds.has(a.jobId)) notCalled.push(APP_NO_CALL_LABEL.closed);
    else notCalled.push(UNKNOWN);
  }
  const called = ai + both + staff;
  const prescreen: Ladder = {
    unit: 'ใบ',
    totalLabel: 'รายชื่อทั้งหมด',
    total: apps.length,
    equation: [
      { label: 'โทรแล้ว', value: called },
      { label: 'รอโทร', value: waiting.length },
      { label: 'ไม่โทร', value: notCalled.length },
    ],
    steps: [
      { key: 'called', title: 'โทรไปแล้ว', value: called, parts: [], sub: whoSub(ai, both, staff) },
      { key: 'talked', title: 'ติดต่อสำเร็จ', value: talked.length, parts: tally(TALKED, talked), indent: true },
      { key: 'notTalked', title: 'ติดต่อไม่สำเร็จ', value: notTalked.length, parts: tally(NOT_TALKED, notTalked), indent: true },
      {
        key: 'waiting',
        title: 'รอโทร',
        value: waiting.length,
        parts: tally(
          [
            { key: 'aiQueued', label: 'AI รอโทร', tone: 'info' },
            { key: 'claimed', label: 'เจ้าหน้าที่เก็บไปแล้ว ยังไม่โทร', tone: 'violet', stuck: true },
          ],
          waiting,
        ),
      },
      { key: 'notCalled', title: 'ไม่โทร', value: notCalled.length, parts: reasons(notCalled) },
    ],
    checks: [[talked.length + notTalked.length, called]],
  };

  // ── โทรหลัง Prescreen: คนที่บอก AI ว่าสนใจ ──
  const interested = apps.filter((a) => a.calledByAi && a.aiAnswer === 'said_yes');
  const ok = interested.filter((a) => staffResultOf(a) === 'ok');
  const fail = interested.filter((a) => staffResultOf(a) === 'fail');
  const afterWait = interested
    .filter((a) => staffResultOf(a) === 'waiting')
    .map((a) => (a.id && flagOf.get(a.id)?.claimed ? 'claimed' : 'nobody'));
  const afterCalled = ok.length + fail.length;
  const after: Ladder = {
    unit: 'คน',
    totalLabel: 'คนที่บอก AI ว่าสนใจ',
    total: interested.length,
    equation: [
      { label: 'โทรแล้ว', value: afterCalled },
      { label: 'รอโทร', value: afterWait.length },
    ],
    steps: [
      { key: 'called', title: 'โทรไปแล้ว', value: afterCalled, parts: [], sub: whoSub(0, 0, afterCalled) },
      { key: 'talked', title: 'ติดต่อสำเร็จ', value: ok.length, parts: [], indent: true },
      { key: 'notTalked', title: 'ติดต่อไม่สำเร็จ', value: fail.length, parts: [], indent: true },
      {
        key: 'waiting',
        title: 'รอโทร',
        value: afterWait.length,
        parts: tally(
          [
            { key: 'claimed', label: 'เก็บไปแล้ว ยังไม่โทร', tone: 'violet', stuck: true },
            { key: 'nobody', label: 'ยังไม่มีใครเก็บ', tone: 'danger', stuck: true },
          ],
          afterWait,
        ),
      },
    ],
    checks: [],
  };

  // ── นัดได้: จากที่ติดต่อสำเร็จทั้งหมด (เจ้าของ 29 ต.ค. 2569) ──
  const nowMs = Date.now();
  const booked = ok.filter((a) => Boolean(a.appointmentAt));
  const noBook = ok.filter((a) => !a.appointmentAt && a.appointmentFailed === true);
  const pendingBook = ok.filter((a) => !a.appointmentAt && a.appointmentFailed !== true);
  const showed = booked.filter((a) => a.attendance === 'showed');
  const passed = showed.filter((a) => a.screening === 'passed').length;
  const informed = showed.filter((a) => a.informed === true).length;
  const appt: Ladder = {
    unit: 'คน',
    totalLabel: 'ติดต่อสำเร็จทั้งหมด',
    total: ok.length,
    equation: [
      { label: 'นัดได้', value: booked.length },
      { label: 'นัดไม่ได้', value: noBook.length },
      { label: 'ยังไม่ลงนัด', value: pendingBook.length },
    ],
    steps: [
      {
        key: 'booked',
        title: 'นัดได้',
        value: booked.length,
        parts: tally(
          [
            { key: 'showed', label: 'มาตามนัด', tone: 'success' },
            { key: 'noShow', label: 'ไม่มา', tone: 'danger' },
            { key: 'upcoming', label: 'ยังไม่ถึงวันนัด', tone: 'info' },
            { key: 'unrecorded', label: 'เลยวันนัดแล้ว ยังไม่ลงผล', tone: 'warn', stuck: true },
          ],
          booked.map((a) =>
            a.attendance === 'showed' ? 'showed' : a.attendance ? 'noShow' : Date.parse(a.appointmentAt ?? '') > nowMs ? 'upcoming' : 'unrecorded',
          ),
        ),
        sub: `มาแล้ว ผ่าน ${n(passed)} · แจ้งเข้า ERP ${n(informed)}`,
      },
      { key: 'noBook', title: 'นัดไม่ได้', value: noBook.length, parts: [] },
      {
        key: 'pendingBook',
        title: 'ยังไม่ลงนัด',
        value: pendingBook.length,
        parts: pendingBook.length
          ? [{ key: 'pending', label: 'ติดต่อได้แล้ว ยังไม่ลงผลนัด', value: pendingBook.length, tone: 'warn', stuck: true }]
          : [],
      },
    ],
    checks: [],
  };

  return [
    {
      key: 'prescreen',
      name: 'AI โทร Prescreen',
      note: `ใบสมัคร ${n(apps.length)} ใบ`,
      ai,
      both,
      staff,
      none: apps.length - called,
      noneLabel: 'ยังไม่โทร',
      ladder: prescreen,
    },
    {
      key: 'afterPrescreen',
      name: 'โทรหลัง Prescreen',
      note: `คนที่บอก AI ว่าสนใจ ${n(interested.length)} คน`,
      ai: 0,
      both: 0,
      staff: afterCalled,
      none: afterWait.length,
      noneLabel: 'ยังไม่มีใครโทร',
      ladder: after,
    },
    {
      key: 'appointment',
      name: 'นัดได้',
      note: `จากที่ติดต่อสำเร็จ ${n(ok.length)} คน`,
      ai: 0,
      both: 0,
      staff: booked.length,
      none: ok.length - booked.length,
      noneLabel: 'นัดไม่ได้ / ยังไม่ลงนัด',
      ladder: appt,
    },
  ];
}

/** จับคู่งาน — จากรายงานผลโทรของหัวข้อจับคู่งาน (ช่วง/BU เดียวกัน) แบบเดียวกับ Prescreen */
export function matchingProportionRow(report: TopicReport | null): ProportionRow {
  const cells = report?.cells ?? [];
  const seg = (s: string) => cells.filter((c) => c.seg === s).reduce((t, c) => t + c.n, 0);
  const ai = seg('ai');
  const both = seg('both');
  const staff = seg('staff');
  const none = seg('notCalled');
  const calledCells = cells.filter((c) => c.seg !== 'notCalled');
  const colN = (k: string) => calledCells.filter((c) => c.col === k).reduce((t, c) => t + c.n, 0);
  const labelOf = (k: string, fallback: string) => report?.cols.find((c) => c.key === k)?.label ?? fallback;
  const part = (key: string, label: string, tone: ToneKey): LadderPart => ({ key, label, value: colN(key), tone });
  const talkedParts = [
    part('interested', labelOf('interested', 'สนใจ'), 'success'),
    part('notInterested', labelOf('notInterested', 'ไม่สนใจ'), 'danger'),
    part('notYet', labelOf('notYet', 'ขอคิดก่อน'), 'warn'),
    part('unclear', labelOf('unclear', 'สรุปไม่ได้'), 'violet'),
  ].filter((p) => p.value > 0);
  const notTalkedParts = [part('noAnswer', labelOf('noAnswer', 'ไม่รับสาย'), 'neutral'), part('noResult', 'ไม่มีผลกลับ', 'warn')].filter(
    (p) => p.value > 0,
  );
  const called = ai + both + staff;
  return {
    key: 'matching',
    name: 'จับคู่งาน',
    note: 'คน',
    ai,
    both,
    staff,
    none,
    noneLabel: 'ยังไม่มีใครโทร',
    ladder: {
      unit: 'คน',
      totalLabel: 'รายชื่อทั้งหมด',
      total: called + none,
      equation: [
        { label: 'โทรแล้ว', value: called },
        { label: 'รอโทร', value: none },
      ],
      steps: [
        { key: 'called', title: 'โทรไปแล้ว', value: called, parts: [], sub: whoSub(ai, both, staff) },
        { key: 'talked', title: 'ติดต่อสำเร็จ', value: sum(talkedParts), parts: talkedParts, indent: true },
        { key: 'notTalked', title: 'ติดต่อไม่สำเร็จ', value: sum(notTalkedParts), parts: notTalkedParts, indent: true },
        { key: 'waiting', title: 'รอโทร', value: none, parts: none ? [{ key: 'waiting', label: 'ยังไม่มีใครโทร', value: none, tone: 'info' }] : [] },
      ],
      checks: [[sum(talkedParts) + sum(notTalkedParts), called]],
    },
  };
}

// ── ทั้งแท็บ ─────────────────────────────────────────────────────────────

export type ProportionPayload = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  follow: { starter: ProportionCallCounts; replacement: ProportionCallCounts; aftercare: ProportionCallCounts } | null;
  entry: {
    selfApply: number;
    irecruit: number;
    soScraping: number;
    staffKeyed: number;
    replaceSync: number;
    replaceManual: number;
    postOrders: number;
  } | null;
  /** ใบสมัครที่ยังไม่มีเจ้าหน้าที่โทร: มีคนเก็บไว้ไหม + เหตุที่ AI ไม่โทร */
  apps?: ProportionAppFlag[] | null;
  errors: { follow?: string; entry?: string; apps?: string; aftercare?: string };
};

export type ProportionTag = 'ai' | 'mix' | 'staff' | 'noAi' | 'empty' | 'unknown';
export const PROPORTION_TAG_LABEL: Record<ProportionTag, string> = {
  ai: 'AI ทำหลัก',
  mix: 'แบ่งกัน',
  staff: 'คนทำหลัก',
  noAi: 'ยังไม่มี AI',
  empty: 'ยังไม่มีงาน',
  unknown: 'วัดไม่ได้',
};

export type ProportionRow = {
  key: string;
  name: string;
  note: string;
  ai: number;
  both: number;
  staff: number;
  none: number;
  noneLabel?: string;
  /** ทางเข้าใช้คำว่า ระบบ / คน แทน AI / คน */
  aiLabel?: string;
  /** วัดไม่ได้ (โพสต์ประกาศ) — ไม่มีแถบ ไม่มี % */
  unknown?: boolean;
  ladder?: Ladder;
  /** แผงของแถวที่ไม่ใช่งานโทร (ทางเข้า) — แตกตามที่มา */
  parts?: LadderPart[];
};

export type ProportionGroup = { key: string; title: string; rows: ProportionRow[] };

/** % ของ AI (รวมทั้งสองทาง) ในงานที่ทำแล้ว · ยังไม่มีงาน = null */
export function proportionPct(r: Pick<ProportionRow, 'ai' | 'both' | 'staff'>): number | null {
  const done = r.ai + r.both + r.staff;
  return done > 0 ? Math.round(((r.ai + r.both) / done) * 100) : null;
}

export function proportionTag(r: ProportionRow): ProportionTag {
  if (r.unknown) return 'unknown';
  const p = proportionPct(r);
  if (p === null) return 'empty';
  if (p === 0) return 'noAi';
  if (p >= 60) return 'ai';
  if (p >= 30) return 'mix';
  return 'staff';
}

/** AI ได้โทรกี่ % ของ **ทั้งหมด** (รวมที่ยังไม่โทร) · ไม่มีส่วนที่ยังไม่โทร = null */
export function proportionCoverage(r: Pick<ProportionRow, 'ai' | 'both' | 'staff' | 'none'>): number | null {
  const all = r.ai + r.both + r.staff + r.none;
  if (r.none <= 0 || all <= 0) return null;
  return Math.round(((r.ai + r.both) / all) * 100);
}

function followRow(key: string, name: string, c: ProportionCallCounts | undefined, unit: string): ProportionRow {
  const z = c ?? { ai: 0, both: 0, staff: 0, none: 0, aiUnreached: 0 };
  const unreached = z.aiUnreached > 0 ? ` · AI โทรไม่ติด ${n(z.aiUnreached)} คนตามต่อ ${n(z.both)}` : '';
  return { key, name, note: `${unit}${unreached}`, ai: z.ai, both: z.both, staff: z.staff, none: z.none, noneLabel: 'ยังไม่มีใครโทร', ladder: z.ladder };
}

/** ทุกก้อนของแท็บ — ลำดับตามเส้นทางงาน · ว่างแล้วไม่หาย (ขึ้น 0) */
export function buildProportionGroups(input: {
  apps: readonly RecruitAppFact[] | null;
  payload: ProportionPayload | null;
  matchingReport?: TopicReport | null;
  openJobIds?: ReadonlySet<string> | null;
}): ProportionGroup[] {
  const recruit = recruitProportionRows(input.apps ?? [], input.payload?.apps ?? null, input.openJobIds ?? null);
  const f = input.payload?.follow;
  const e = input.payload?.entry;
  const appsIn = e ? e.selfApply + e.irecruit + e.soScraping : 0;
  return [
    { key: 'recruit', title: 'งานสรรหา', rows: [...recruit, matchingProportionRow(input.matchingReport ?? null)] },
    {
      key: 'follow',
      title: 'ติดตามและดูแล',
      rows: [
        followRow('starter', 'ติดตามคนเริ่มงาน', f?.starter, 'สาย'),
        followRow('replacement', 'ติดตามส่งคนแทน', f?.replacement, 'สาย'),
        followRow('aftercare', 'ดูแลหลังเริ่มงาน', f?.aftercare, 'คน'),
      ],
    },
    {
      key: 'entry',
      title: 'ทางเข้าของงาน',
      rows: [
        {
          key: 'apps',
          name: 'ผู้สมัครเข้าระบบ',
          note: e
            ? `สมัครเอง ${n(e.selfApply)} · ดึง iRecruit ${n(e.irecruit)}${e.soScraping ? ` · So Scraping ${n(e.soScraping)}` : ''} · คนคีย์/นำเข้า ${n(e.staffKeyed)}`
            : 'ใบสมัคร',
          ai: appsIn,
          both: 0,
          staff: e?.staffKeyed ?? 0,
          none: 0,
          aiLabel: 'ระบบ',
          parts: [
            { key: 'self', label: 'สมัครเองผ่านลิงก์ / หน้าประกาศ', value: e?.selfApply ?? 0, tone: 'primary' },
            { key: 'irecruit', label: 'ดึงจาก iRecruit', value: e?.irecruit ?? 0, tone: 'primary' },
            { key: 'soScraping', label: 'So Scraping ส่งเข้ามา', value: e?.soScraping ?? 0, tone: 'primary' },
            { key: 'staff', label: 'เจ้าหน้าที่คีย์ / นำเข้า Excel', value: e?.staffKeyed ?? 0, tone: 'violet' },
          ],
        },
        {
          key: 'replaceSheets',
          name: 'ใบส่งคนแทน',
          note: e ? `ดึง iRecruit ${n(e.replaceSync)} · คีย์เอง ${n(e.replaceManual)}` : 'ใบ',
          ai: e?.replaceSync ?? 0,
          both: 0,
          staff: e?.replaceManual ?? 0,
          none: 0,
          aiLabel: 'ระบบ',
          parts: [
            { key: 'sync', label: 'ดึงจาก iRecruit ทุก 5 นาที', value: e?.replaceSync ?? 0, tone: 'primary' },
            { key: 'manual', label: 'เจ้าหน้าที่คีย์เองในแท็บส่งคนแทน', value: e?.replaceManual ?? 0, tone: 'violet' },
          ],
        },
        {
          key: 'posts',
          name: 'โพสต์ประกาศ',
          note: `สั่งโพสต์ผ่านระบบ ${n(e?.postOrders ?? 0)} ครั้ง · โพสต์เองระบบไม่เห็น`,
          ai: 0,
          both: 0,
          staff: 0,
          none: 0,
          unknown: true,
          parts: [{ key: 'orders', label: 'สั่งโพสต์ผ่านระบบ (ไม่นับที่ถูกปฏิเสธ)', value: e?.postOrders ?? 0, tone: 'primary' }],
        },
      ],
    },
  ];
}

/** งานที่ค้างอยู่ — ช่องที่ติด `stuck` ของทุกแถว (มีเลข) · บนสุดของแท็บ */
export type ProportionStuck = { rowKey: string; rowName: string; label: string; value: number; unit: string };

export function proportionStuck(groups: readonly ProportionGroup[]): ProportionStuck[] {
  const out: ProportionStuck[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      if (!r.ladder) continue;
      for (const s of r.ladder.steps) {
        for (const p of s.parts) {
          if (p.stuck && p.value > 0) out.push({ rowKey: r.key, rowName: r.name, label: p.label, value: p.value, unit: r.ladder.unit });
        }
      }
    }
  }
  return out.sort((a, b) => b.value - a.value);
}
