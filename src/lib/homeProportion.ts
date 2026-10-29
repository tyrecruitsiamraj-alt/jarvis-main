/**
 * ═══ แท็บ "สัดส่วน" หน้าหลัก — แต่ละเรื่อง AI ทำเท่าไหร่ คนทำเท่าไหร่ (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"ใช้เพื่อดูว่าระบบเนี่ย คนหรือ Ai ทำไปเท่าไหร่ เรื่องไหนจะผลักดันให้ Ai เยอะ เรื่องไหนคนก็ปล่อยไป
 * > ฉันต้องตอบผู้บริหารเวลาเขาถามว่าตอนนี้ระบบไปกี่ %"*
 *
 * Choice เจ้าของ:
 *   - เรื่องที่มี: ติดตามคนเริ่มงาน · ติดตามส่งคนแทน · ดูแลหลังเริ่มงาน · สรรหา 3 ขั้น (Prescreen · โทรหลัง Prescreen · นัดได้)
 *     + จับคู่งาน · AI โทรไม่ติดแล้วคนตามต่อ · ทางเข้าของงาน · ขั้นที่ยังเป็นคน 100% ("เอามาก่อน อันไหนไม่เอาค่อยเอาออก")
 *   - **ไม่มีเลขรวมเลขเดียว** — แยกรายเรื่อง (แต่ละเรื่องนับคนละหน่วย)
 *   - **% = AI ได้โทร รวมที่คนตามต่อ** — (AI + ทั้งสองทาง) ÷ งานที่ทำแล้ว · ยังไม่มีงาน = null (ห้ามขึ้น 0% ให้ดูเหมือนคนทำหมด)
 *   - ชื่อแท็บ "สัดส่วน" (ไม่ใช่ "AI กับคน")
 * 🔴 กดแถว = แตกให้ครบ (เจ้าของ 28 ต.ค. 2569: *"รายชื่อเท่าไหร่ โทรไปแล้วเท่าไหร่ ผลเป็นไง รอโทรเท่าไหร่ ไม่โทรเท่าไหร่ เพราะอะไร
 *    … ทุกอย่างต้องขี้สงสัยแล้วตอบให้หมด"*) ⇒ `Ladder`: รายชื่อ = โทรแล้ว + รอโทร + ไม่โทร · ผลรวมกัน = โทรแล้ว · เหตุรวมกัน = ไม่โทร
 *    (`ladderAddsUp` · เทสต์คุม) · เหตุที่หาไม่เจอต้องขึ้นเป็นช่อง "ยังไม่รู้เหตุ" ห้ามหายไปเงียบ ๆ
 *
 * ไฟล์นี้ pure — ตัวเลขจาก `/api/home-ai-share?proportion=1` (ติดตาม · ทางเข้า · เหตุของใบสมัคร) + ใบสมัครของหน้าหลัก (`ro.apps`)
 * + ก้อนจับคู่งาน + ใบขอที่เปิดอยู่ (ใบขอปิด) · เทสต์ `tests/api/homeProportion2569-10-28.test.ts`
 */
import type { RecruitAppFact } from './recruitOverviewTypes';
import type { AiShareMatching } from './homeAiShare';
import type { ToneKey } from './designTokens';
import { aiAnswerOf, aiStage, staffResultOf } from './recruitJourney';
import { FOLLOW_DISPATCH_META, type FollowDispatchState } from './followDispatchState';

/** ช่องหนึ่งของขั้น · `stuck` = ค้างอยู่ ต้องมีคนทำ (ขึ้นในก้อน "งานที่ค้างอยู่" บนสุดของแท็บ) */
export type LadderPart = { key: string; label: string; value: number; tone: ToneKey; stuck?: boolean };

/**
 * ขั้นของแถว — รายชื่อ = โทรแล้ว + รอโทร + ไม่โทร
 * `called.ai/both/staff` = ใครโทร · `results` = ผลของที่โทรแล้ว · `waiting` = ยังต้องโทร · `notCalled` = จะไม่โทร + เหตุ
 */
export type Ladder = {
  unit: string;
  total: number;
  called: { total: number; ai: number; both: number; staff: number };
  results: LadderPart[];
  waiting: LadderPart[];
  notCalled: LadderPart[];
  /** ไม่นับในรายชื่อ (เช่น สายยกเลิก — กติกาเดียวกับแท็บภาพรวม) บอกไว้ใต้สมการ */
  excluded?: { label: string; value: number };
};

const sum = (parts: readonly LadderPart[]) => parts.reduce((n, p) => n + p.value, 0);

/** บวกลบลงตัวทุกชั้น */
export function ladderAddsUp(l: Ladder): boolean {
  const waiting = sum(l.waiting);
  const notCalled = sum(l.notCalled);
  return (
    l.total === l.called.total + waiting + notCalled &&
    l.called.total === l.called.ai + l.called.both + l.called.staff &&
    (l.results.length === 0 || sum(l.results) === l.called.total)
  );
}

/** ติดตาม / ดูแลหลังเริ่มงาน หนึ่งก้อน — สายที่ถึงเวลาในช่วง ไม่นับยกเลิก */
export type ProportionCallCounts = {
  /** AI โทรอย่างเดียว */
  ai: number;
  /** AI โทรแล้วคนลงผลด้วย (ทั้งสองทาง) */
  both: number;
  /** คนโทรอย่างเดียว */
  staff: number;
  /** ยังไม่มีใครโทร */
  none: number;
  /** AI โทรแล้วไม่ได้คุย (ไม่รับ · สายไม่ว่าง · ล้ม) */
  aiUnreached: number;
  ladder?: Ladder;
};

/** เหตุที่ใบสมัครยังไม่มีใครโทร (ฝั่งฐาน) — `null` = ยังไม่รู้จากฐาน (หน้าเว็บเช็กใบขอปิดต่อ) */
export type AppNoCallReason = 'dup' | 'soScraping' | 'keyed' | 'noJob' | 'block' | 'suppressed' | 'noIncome';
export type ProportionAppFlag = { id: string; jobId: string | null; claimed: boolean; reason: AppNoCallReason | null; blockReason: string | null };

export type ProportionPayload = {
  generated_at: string;
  from: string | null;
  to: string | null;
  bu: string | null;
  follow: { starter: ProportionCallCounts; replacement: ProportionCallCounts; aftercare: ProportionCallCounts } | null;
  entry: {
    /** ผู้สมัครกรอกเอง (ลิงก์/หน้าประกาศ) */
    selfApply: number;
    /** ดึงจาก iRecruit */
    irecruit: number;
    /** So Scraping ส่งเข้ามา */
    soScraping: number;
    /** เจ้าหน้าที่คีย์ / นำเข้า Excel */
    staffKeyed: number;
    /** ใบส่งคนแทน ดึงจาก iRecruit / คีย์เอง (นับใบ) */
    replaceSync: number;
    replaceManual: number;
    /** สั่งโพสต์ผ่านระบบ (So Scraping) — คนโพสต์เองระบบไม่เห็น */
    postOrders: number;
  } | null;
  /** ใบสมัครที่ยังไม่มีเจ้าหน้าที่โทร: มีคนเก็บไว้ไหม + เหตุที่ AI ไม่โทร */
  apps?: ProportionAppFlag[] | null;
  errors: { follow?: string; entry?: string; apps?: string };
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
  /** บรรทัดเล็กใต้ชื่อ (หน่วย + ตัวเลขประกอบ) */
  note: string;
  ai: number;
  both: number;
  staff: number;
  none: number;
  /** ป้ายของก้อนว่าง (ยังไม่โทร · ยังไม่มีใครโทร) */
  noneLabel?: string;
  /** ทางเข้าใช้คำว่า ระบบ / คน แทน AI / คน */
  aiLabel?: string;
  /** วัดไม่ได้ (โพสต์ประกาศ) — ไม่มีแถบ ไม่มี % */
  unknown?: boolean;
  /** ขั้นที่กดดูได้ — ไม่มี = แถวนี้ดูแค่ตัวเลขบนแถว */
  ladder?: Ladder;
  /** แผงของแถวที่ไม่ใช่งานโทร (ทางเข้า · ขั้นที่ยังเป็นคน) — แตกตามที่มา/ผล */
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

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number) => NUM.format(v);

/** นับเข้าช่องตามลำดับที่ประกาศ — ช่อง 0 ตัดทิ้ง (ยกเว้น `keepZero`) */
function tally(
  order: ReadonlyArray<{ key: string; label: string; tone: ToneKey; stuck?: boolean }>,
  keys: readonly string[],
  keepZero = false,
): LadderPart[] {
  const counts = new Map<string, number>();
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
  return order
    .map((o) => ({ ...o, value: counts.get(o.key) ?? 0 }))
    .filter((p) => keepZero || p.value > 0);
}

// ── ติดตาม ──────────────────────────────────────────────────────────────

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
  /** ยังไม่ถึงเวลาสาย (สายต่อไปของวัน/ช่วง) */
  future?: boolean;
  /** แถวถูกสร้างหลังเวลาสายแล้ว (ใบลงย้อนหลังใน iRecruit) */
  backfilled?: boolean;
};

/**
 * 🔴 ลงย้อนหลัง ≠ งานค้าง (เจ้าของ 29 ต.ค. 2569 "แก้ข้อ 1 เลย") — วัด 28 ต.ค.: สายคนแทนที่ "เลยเวลายังไม่ลงผล" 697 สาย
 * 693 สายถูกสร้างหลังเวลาโทรไปแล้ว (ระบบตั้งเป็นคนโทรให้เอง) ไม่มีใครโทรได้ตั้งแต่แรก ⇒ ย้ายไปช่อง "ไม่โทร" ไม่นับเป็นค้าง
 */
export const FOLLOW_BACKFILLED_LABEL = 'ลงย้อนหลัง — ดึงมาตอนเวลาโทรผ่านไปแล้ว';

const FOLLOW_RESULT_ORDER = [
  { key: 'went', label: 'ไป', tone: 'success' },
  { key: 'notWent', label: 'ไม่ไป', tone: 'danger' },
  { key: 'reschedule', label: 'ขอเลื่อน', tone: 'orange' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: 'warn' },
  { key: 'failed', label: 'ไม่รับสาย / ติดต่อไม่ได้', tone: 'neutral' },
  { key: 'dayOff', label: 'วันหยุด', tone: 'teal' },
  { key: 'leave', label: 'ลางาน', tone: 'violet' },
  { key: 'waiting', label: 'โทรแล้ว รอผลสรุป', tone: 'info' },
  { key: 'cancelled', label: 'โทรแล้ว ภายหลังยกเลิก', tone: 'neutral' },
] as const satisfies ReadonlyArray<{ key: string; label: string; tone: ToneKey }>;

const AI_NOT_SENT = new Set<string>(['held', 'suppressed', 'guarded', 'no_phone', 'off', 'push_failed', 'not_imported']);

/** เหตุที่ AI ไม่ได้ส่ง — คำเดียวกับป้ายบนหน้าติดตาม ตัด "ไม่ได้ส่ง — " หน้าคำ */
const dispatchReason = (d: string) =>
  (FOLLOW_DISPATCH_META[d as FollowDispatchState]?.label ?? d).replace(/^ไม่ได้ส่ง — /, '');

/** ก้อนหนึ่งของติดตาม — ตัวเลขบนแถวกับขั้นมาจากสายชุดเดียวกัน */
export function summarizeFollowLane(rows: readonly FollowLadderInput[], excludedCancelled = 0): ProportionCallCounts {
  let ai = 0;
  let both = 0;
  let staff = 0;
  let none = 0;
  let aiUnreached = 0;
  const results: string[] = [];
  const waiting: string[] = [];
  const notCalled: string[] = [];
  for (const r of rows) {
    if (r.ai && r.staff) both += 1;
    else if (r.ai) ai += 1;
    else if (r.staff) staff += 1;
    else none += 1;
    if (r.ai && r.aiUnreached) aiUnreached += 1;
    if (r.ai || r.staff) {
      results.push(r.bucket);
      continue;
    }
    // ยังไม่มีใครโทร — รอโทร (ยังไม่ถึงเวลา / เลยเวลาแล้ว) หรือ จะไม่โทร (+ เหตุ)
    if (r.bucket === 'cancelled') notCalled.push('หยุดในคิว — ได้คำตอบจากสายอื่น / เปลี่ยนให้คนโทร');
    else if (!r.future && r.backfilled) notCalled.push(FOLLOW_BACKFILLED_LABEL);
    else if (r.mode === 'manual') waiting.push(r.future ? 'staffLater' : 'staff');
    else if (r.dispatch && AI_NOT_SENT.has(r.dispatch)) notCalled.push(dispatchReason(r.dispatch));
    else if (r.future) waiting.push('aiLater');
    else if (r.queueStatus === 'pending' || r.queueStatus === 'delivered') waiting.push('aiNoResult');
    else notCalled.push('ยังไม่รู้เหตุ');
  }
  const reasonOrder = [...new Set(notCalled)].map((label) => ({
    key: label,
    label,
    tone: (label === 'ยังไม่รู้เหตุ' ? 'danger' : 'neutral') as ToneKey,
    stuck: label === 'ยังไม่รู้เหตุ',
  }));
  const ladder: Ladder = {
    unit: 'สาย',
    total: rows.length,
    called: { total: ai + both + staff, ai, both, staff },
    results: tally(FOLLOW_RESULT_ORDER, results),
    waiting: tally(
      [
        { key: 'aiLater', label: 'AI จะโทรตามเวลา', tone: 'info' },
        { key: 'staffLater', label: 'คนจะโทรตามเวลา', tone: 'violet' },
        { key: 'aiNoResult', label: 'ส่ง AI แล้ว เลยเวลายังไม่มีผลกลับ', tone: 'warn', stuck: true },
        { key: 'staff', label: 'คนโทร เลยเวลาแล้วยังไม่ลงผล', tone: 'danger', stuck: true },
      ],
      waiting,
    ),
    notCalled: tally(reasonOrder, notCalled),
    excluded: excludedCancelled > 0 ? { label: 'ยกเลิก ไม่นับ', value: excludedCancelled } : undefined,
  };
  return { ai, both, staff, none, aiUnreached, ladder };
}

// ── สรรหา ──────────────────────────────────────────────────────────────

export const APP_NO_CALL_LABEL: Record<AppNoCallReason | 'closed' | 'unknown', string> = {
  dup: 'ซ้ำ iRecruit ภายใน 14 วัน — AI ไม่โทรเอง ให้คนเลือก',
  soScraping: 'มาจาก So Scraping — ยังไม่ส่ง AI',
  keyed: 'คนคีย์ / นำเข้า Excel — AI ไม่โทรเอง',
  noJob: 'ไม่ผูกใบขอ — AI ไม่มีงานให้เสนอ',
  block: 'ตัวส่งบอกเหตุ',
  suppressed: 'เบอร์ถูกพัก (ไม่หางานแล้ว / เบอร์เสีย)',
  noIncome: 'ใบขอยังไม่ตั้งรายได้',
  closed: 'ใบขอปิดแล้ว',
  unknown: 'ยังไม่รู้เหตุ',
};

/**
 * สรรหา 3 ขั้น + ขั้นที่ยังเป็นคน จากใบสมัครชุดเดียวกับหน้าหลัก (`ro.apps` · ช่วง/BU เดียวกัน)
 * จัดช่องด้วยตัวจัดของ Journey งานสรรหา (`aiStage` · `aiAnswerOf` · `staffResultOf`) ⇒ เลขเท่าแท็บภาพรวมงานสรรหา
 * `flags` = เหตุ/คนเก็บ จากฐาน · `openJobIds` = ใบขอที่เปิดอยู่ (null = อ่านไม่ได้ ⇒ ไม่เดาว่าปิด)
 */
export function recruitProportionRows(
  apps: readonly RecruitAppFact[],
  flags: readonly ProportionAppFlag[] | null = null,
  openJobIds: ReadonlySet<string> | null = null,
): { recruit: ProportionRow[]; human: ProportionRow[] } {
  const flagOf = new Map((flags ?? []).map((f) => [f.id, f]));
  // ── Prescreen ──
  let ai = 0;
  let both = 0;
  let staff = 0;
  const preResults: string[] = [];
  const preWaiting: string[] = [];
  const preNot: string[] = [];
  for (const a of apps) {
    const fl = a.id ? flagOf.get(a.id) : undefined;
    if (a.calledByAi && a.calledByStaff) both += 1;
    else if (a.calledByAi) ai += 1;
    else if (a.calledByStaff) staff += 1;
    if (a.calledByAi) {
      preResults.push(aiAnswerOf(a));
      continue;
    }
    if (a.calledByStaff) {
      preResults.push('staffOnly');
      continue;
    }
    const stage = aiStage(a);
    if (stage === 'queued') preWaiting.push('aiQueued');
    else if (fl?.claimed) preWaiting.push('claimed');
    else if (stage === 'bad') preNot.push('เบอร์ผิด โทรไม่ได้');
    else if (stage === 'overAge') preNot.push('อายุ 58 ปีขึ้นไป — ระบบไม่ส่ง AI');
    else if (stage === 'irecruit') preNot.push('ดึงจาก iRecruit — AI ไม่โทรเอง');
    else if (fl?.reason === 'block') preNot.push(fl.blockReason?.split(' — ')[0] || APP_NO_CALL_LABEL.unknown);
    else if (fl?.reason) preNot.push(APP_NO_CALL_LABEL[fl.reason]);
    else if (openJobIds && a.jobId && !openJobIds.has(a.jobId)) preNot.push(APP_NO_CALL_LABEL.closed);
    else preNot.push(APP_NO_CALL_LABEL.unknown);
  }
  const preReasonOrder = [...new Set(preNot)].map((label) => ({
    key: label,
    label,
    tone: (label === APP_NO_CALL_LABEL.unknown ? 'danger' : 'neutral') as ToneKey,
    stuck: label === APP_NO_CALL_LABEL.unknown,
  }));
  const prescreen: Ladder = {
    unit: 'ใบ',
    total: apps.length,
    called: { total: ai + both + staff, ai, both, staff },
    results: tally(
      [
        { key: 'yes', label: 'สนใจ', tone: 'success' },
        { key: 'no', label: 'ไม่สนใจ', tone: 'danger' },
        { key: 'area', label: 'คนละพื้นที่', tone: 'orange' },
        { key: 'thinking', label: 'ขอคิดก่อน', tone: 'warn' },
        { key: 'unreached', label: 'ติดต่อไม่ได้', tone: 'neutral' },
        { key: 'staffOnly', label: 'คนโทรเอง ไม่ผ่าน AI', tone: 'violet' },
      ],
      preResults,
    ),
    waiting: tally(
      [
        { key: 'aiQueued', label: 'AI รอโทร', tone: 'info' },
        { key: 'claimed', label: 'เจ้าหน้าที่เก็บไปแล้ว ยังไม่โทร', tone: 'violet', stuck: true },
      ],
      preWaiting,
    ),
    notCalled: tally(preReasonOrder, preNot),
  };

  // ── โทรหลัง Prescreen: คนที่บอก AI ว่าสนใจ ──
  const interested = apps.filter((a) => aiStage(a) === 'called' && aiAnswerOf(a) === 'yes');
  const afterRes: string[] = [];
  const afterWait: string[] = [];
  for (const a of interested) {
    const s = staffResultOf(a);
    if (s === 'ok') afterRes.push(a.appointmentAt ? 'okBooked' : a.appointmentFailed ? 'okNoBook' : 'okPending');
    else if (s === 'fail') afterRes.push('fail');
    else afterWait.push(a.id && flagOf.get(a.id)?.claimed ? 'claimed' : 'nobody');
  }
  const afterCalled = afterRes.length;
  const after: Ladder = {
    unit: 'คน',
    total: interested.length,
    called: { total: afterCalled, ai: 0, both: 0, staff: afterCalled },
    results: tally(
      [
        { key: 'okBooked', label: 'ติดต่อได้ · นัดได้', tone: 'success' },
        { key: 'okNoBook', label: 'ติดต่อได้ · นัดไม่ได้', tone: 'warn' },
        { key: 'okPending', label: 'ติดต่อได้ · ยังไม่ลงนัด', tone: 'info' },
        { key: 'fail', label: 'ติดต่อไม่สำเร็จ', tone: 'danger' },
      ],
      afterRes,
    ),
    waiting: tally(
      [
        { key: 'claimed', label: 'เก็บไปแล้ว ยังไม่โทร', tone: 'violet', stuck: true },
        { key: 'nobody', label: 'ยังไม่มีใครเก็บ', tone: 'danger', stuck: true },
      ],
      afterWait,
    ),
    notCalled: [],
  };

  // ── นัด ──
  const nowMs = Date.now();
  const booked = apps.filter((a) => Boolean(a.appointmentAt));
  const apptRes: string[] = booked.map((a) =>
    a.attendance === 'showed' ? 'showed' : a.attendance ? 'noShow' : Date.parse(a.appointmentAt ?? '') > nowMs ? 'upcoming' : 'unrecorded',
  );
  // นัด = ผลของนัด (ไม่ใช่งานโทร) ⇒ แผงเป็นช่องผลอย่างเดียว ไม่มีสมการโทรแล้ว/รอโทร
  const apptParts = tally(
    [
      { key: 'showed', label: 'มาตามนัด', tone: 'success' },
      { key: 'noShow', label: 'ไม่มา', tone: 'danger' },
      { key: 'upcoming', label: 'ยังไม่ถึงวันนัด', tone: 'info' },
      { key: 'unrecorded', label: 'เลยวันนัดแล้ว ยังไม่ลงผล', tone: 'warn', stuck: true },
    ],
    apptRes,
    true,
  );

  const showed = booked.filter((a) => a.attendance === 'showed').length;
  const noShow = booked.filter((a) => a.attendance && a.attendance !== 'showed').length;
  const passed = apps.filter((a) => a.screening === 'passed').length;
  const notPassed = apps.filter((a) => a.screening === 'not_passed').length;
  const informed = apps.filter((a) => a.informed === true).length;
  return {
    recruit: [
      { key: 'prescreen', name: 'AI โทร Prescreen', note: `ใบสมัคร ${n(apps.length)} ใบ`, ai, both, staff, none: apps.length - ai - both - staff, noneLabel: 'ยังไม่โทร', ladder: prescreen },
      {
        key: 'afterPrescreen',
        name: 'โทรหลัง Prescreen',
        note: `คนที่บอก AI ว่าสนใจ ${n(interested.length)} คน`,
        ai: 0,
        both: 0,
        staff: afterCalled,
        none: interested.length - afterCalled,
        noneLabel: 'ยังไม่มีใครโทร',
        ladder: after,
      },
      { key: 'appointment', name: 'นัดมาสมัครได้', note: `${n(booked.length)} นัด`, ai: 0, both: 0, staff: booked.length, none: 0, parts: apptParts },
    ],
    human: [
      {
        key: 'attendance',
        name: 'ลงผลมา / ไม่มาตามนัด',
        note: `มา ${n(showed)} · ไม่มา ${n(noShow)}`,
        ai: 0,
        both: 0,
        staff: showed + noShow,
        none: 0,
        parts: [
          { key: 'showed', label: 'มา', value: showed, tone: 'success' },
          { key: 'noShow', label: 'ไม่มา', value: noShow, tone: 'danger' },
        ],
      },
      {
        key: 'screening',
        name: 'ผ่าน / ไม่ผ่าน',
        note: `ผ่าน ${n(passed)} · ไม่ผ่าน ${n(notPassed)}`,
        ai: 0,
        both: 0,
        staff: passed + notPassed,
        none: 0,
        parts: [
          { key: 'passed', label: 'ผ่าน', value: passed, tone: 'success' },
          { key: 'notPassed', label: 'ไม่ผ่าน', value: notPassed, tone: 'danger' },
        ],
      },
      {
        key: 'inform',
        name: 'แจ้งเข้า ERP',
        note: `${n(informed)} คน`,
        ai: 0,
        both: 0,
        staff: informed,
        none: 0,
        parts: [{ key: 'informed', label: 'มีใบแจ้งเข้า ERP', value: informed, tone: 'success' }],
      },
    ],
  };
}

function followRow(key: string, name: string, c: ProportionCallCounts): ProportionRow {
  const unreached = c.aiUnreached > 0 ? ` · AI โทรไม่ติด ${n(c.aiUnreached)} คนตามต่อ ${n(c.both)}` : '';
  return { key, name, note: `สาย${unreached}`, ai: c.ai, both: c.both, staff: c.staff, none: c.none, noneLabel: 'ยังไม่มีใครโทร', ladder: c.ladder };
}

const ZERO: ProportionCallCounts = { ai: 0, both: 0, staff: 0, none: 0, aiUnreached: 0 };

/** จับคู่งาน — ก้อนของหน้า "ระบบไปกี่ %" (ยังไม่โทร = รอ AI · เจ้าหน้าที่รับไปแล้ว · ที่เหลือไม่มีผลกลับ) */
function matchingRow(m: AiShareMatching | null): ProportionRow {
  const ai = m?.ai ?? 0;
  const both = m?.both ?? 0;
  const staff = m?.staff ?? 0;
  const none = m?.notCalled ?? 0;
  const waitingAi = m?.waitingAi ?? 0;
  const holding = m?.holding ?? 0;
  const rest = Math.max(0, none - waitingAi - holding);
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
      total: ai + both + staff + none,
      called: { total: ai + both + staff, ai, both, staff },
      results: [],
      waiting: [
        { key: 'waitingAi', label: 'รอ AI โทร', value: waitingAi, tone: 'info' },
        { key: 'holding', label: 'เจ้าหน้าที่รับไปแล้ว ยังไม่ลงผล', value: holding, tone: 'violet', stuck: true },
      ].filter((p) => p.value > 0) as LadderPart[],
      notCalled: rest > 0 ? [{ key: 'noResult', label: 'ส่ง AI แล้ว ไม่มีผลกลับ', value: rest, tone: 'neutral' }] : [],
    },
  };
}

/** ทุกก้อนของแท็บ — ลำดับตามเส้นทางงาน · ว่างแล้วไม่หาย (ขึ้น 0) */
export function buildProportionGroups(input: {
  apps: readonly RecruitAppFact[] | null;
  payload: ProportionPayload | null;
  matching: AiShareMatching | null;
  openJobIds?: ReadonlySet<string> | null;
}): ProportionGroup[] {
  const r = recruitProportionRows(input.apps ?? [], input.payload?.apps ?? null, input.openJobIds ?? null);
  const f = input.payload?.follow;
  const e = input.payload?.entry;
  const appsIn = e ? e.selfApply + e.irecruit + e.soScraping : 0;
  return [
    { key: 'recruit', title: 'งานสรรหา', rows: [...r.recruit, matchingRow(input.matching)] },
    {
      key: 'follow',
      title: 'ติดตามและดูแล',
      rows: [
        followRow('starter', 'ติดตามคนเริ่มงาน', f?.starter ?? ZERO),
        followRow('replacement', 'ติดตามส่งคนแทน', f?.replacement ?? ZERO),
        followRow('aftercare', 'ดูแลหลังเริ่มงาน', f?.aftercare ?? ZERO),
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
    { key: 'human', title: 'ขั้นที่ยังเป็นคน 100%', rows: r.human },
  ];
}

/**
 * AI ได้โทรกี่ % ของ **ทั้งหมด** (รวมที่ยังไม่โทร) — เลขใหญ่นับแค่ที่โทรแล้ว (Choice เจ้าของ) จึงต้องมีบรรทัดนี้กำกับ
 * (Prescreen 98% ของที่โทรแล้ว แต่ใบที่ยังไม่โทรส่วนใหญ่มาจาก iRecruit ⇒ ของทั้งหมด ~62%) · ไม่มีส่วนที่ยังไม่โทร = null (ไม่ต้องขึ้น)
 */
export function proportionCoverage(r: Pick<ProportionRow, 'ai' | 'both' | 'staff' | 'none'>): number | null {
  const all = r.ai + r.both + r.staff + r.none;
  if (r.none <= 0 || all <= 0) return null;
  return Math.round(((r.ai + r.both) / all) * 100);
}

/** งานที่ค้างอยู่ — ช่องที่ติด `stuck` ของทุกแถว (มีเลข) · บนสุดของแท็บ กดแล้วเปิดแผงของแถวนั้น */
export type ProportionStuck = { rowKey: string; rowName: string; label: string; value: number; unit: string };

export function proportionStuck(groups: readonly ProportionGroup[]): ProportionStuck[] {
  const out: ProportionStuck[] = [];
  for (const g of groups) {
    for (const r of g.rows) {
      const unit = r.ladder?.unit ?? 'นัด';
      const parts = [...(r.ladder?.waiting ?? []), ...(r.ladder?.notCalled ?? []), ...(r.parts ?? [])];
      for (const p of parts) if (p.stuck && p.value > 0) out.push({ rowKey: r.key, rowName: r.name, label: p.label, value: p.value, unit });
    }
  }
  return out.sort((a, b) => b.value - a.value);
}
