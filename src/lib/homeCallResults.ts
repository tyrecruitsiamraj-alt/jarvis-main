/**
 * ═══ แผง "ผลโทร" ของหน้าหลัก — โทรไปแล้วผลเป็นไง (รอบ 18 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"มีอีก กราฟที่บอกผมว่าการโทรเนี่ยโทรไปแล้วผลเป็นไง โทรแล้วไป รับแล้ววาง รับแล้วไม่ไปไรงี้ แต่ทำเป็นแบบซ่อนไว้
 * เหมือน ใครอยู่ในระบบ แต่เอามาก่อน ใครอยู่ในระบบ"*
 *
 * 🔴 ไม่มีนิยามใหม่ — ยืมของเดิมทั้งหมด (หนึ่งเมตริกหนึ่งนิยาม):
 * - รายชื่อที่นับ = ของหัวข้อ/ช่วง/BU ชุดเดียวกับกล่องตัวเลข (CTE ตัวเดียวกัน โหมด `results` ของ `homeAiShareSql.ts`)
 * - **หนึ่งรายชื่อ = หนึ่งผล** (เจ้าของ: *"เรานับจากรายชื่อ ต้องเป็นรายชื่อหมด"*) = ผลล่าสุดของรายชื่อนั้น ·
 *   รายชื่อที่ทั้ง AI และคนโทร = นับฝั่งที่โทรทีหลัง (เวลาเท่ากัน = คน) ⇒ รวมทุกแถว = รายชื่อที่มีผลพอดี ไม่นับซ้ำ
 * - จัดถัง = `classifyCallMicro` (รหัสผลก่อน แล้วค่อยอ่านคำพูด) · คลังคำตามหัวข้อ — ติดตาม/ดูแลหลังเริ่มงานถามว่า "ไปไหม" ·
 *   ผู้สมัคร/จับคู่งานถามว่า "สนใจไหม"
 * - ป้ายถัง = พจนานุกรมเมตริก `lumos.result.*` (คำเดียวกับ Dashboard) — "รับแล้ววาง" ของเจ้าของ = ถัง **"รับแล้วเงียบ"**
 * ⚠️ บันทึกผลติดต่อของกล่องงาน (สำเร็จ/ไม่สำเร็จ ไม่มีรหัสผล) ไม่อยู่ในแผงนี้ — จัดถังไม่ได้ ห้ามเดา
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/homeCallResults.test.ts`
 */
import { FOLLOW_VOCAB, INTEREST_VOCAB, classifyCallMicro, type CallMicroOutcome, type CallMicroVocab } from '@/lib/callMicroOutcome';
import { METRICS, type MetricKey } from '@/lib/metricDictionary';
import { roundToHundred, type AiShareBlockKey } from '@/lib/homeAiShare';

/** คำถามตอนโทร — ติดตาม = "ไปไหม" · ที่เหลือ = "สนใจไหม" */
export type CallResultVocab = 'follow' | 'interest';

export const vocabOfBlock = (block: AiShareBlockKey): CallResultVocab =>
  block === 'follow' || block === 'aftercare' ? 'follow' : 'interest';

/** ลำดับบนจอ — ตามที่เจ้าของไล่: โทรแล้วไป → รับแล้ววาง → รับแล้วไม่ไป → ที่เหลือ (ยังไม่ได้คุยไว้ท้าย) */
export const CALL_RESULT_ORDER: readonly CallMicroOutcome[] = [
  'said_yes',
  'picked_silent',
  'said_no',
  'not_yet',
  'talked_unclear',
  'wrong_person',
  'no_pickup',
];

const SHARED: Pick<Record<CallMicroOutcome, MetricKey>, 'picked_silent' | 'talked_unclear' | 'wrong_person' | 'no_pickup'> = {
  picked_silent: 'lumos.result.silent',
  talked_unclear: 'lumos.result.unclear',
  wrong_person: 'lumos.result.wrong_person',
  no_pickup: 'lumos.result.no_pickup',
};

/** ถังกลาง → คำในพจนานุกรม (ชุดเดียวกับ `lumosPipeline` ของ Dashboard) */
const METRIC_OF: Record<CallResultVocab, Record<CallMicroOutcome, MetricKey>> = {
  follow: { ...SHARED, said_yes: 'lumos.result.went', said_no: 'lumos.result.not_went', not_yet: 'lumos.result.not_ready' },
  interest: {
    ...SHARED,
    said_yes: 'lumos.result.interested',
    said_no: 'lumos.result.not_interested',
    not_yet: 'lumos.result.thinking',
  },
};

export const callResultLabel = (vocab: CallResultVocab, k: CallMicroOutcome) => METRICS[METRIC_OF[vocab][k]].label;
export const callResultHint = (vocab: CallResultVocab, k: CallMicroOutcome) => METRICS[METRIC_OF[vocab][k]].what;

export type CallResultCounts = Record<CallMicroOutcome, number>;

export function emptyCallResultCounts(): CallResultCounts {
  return { no_pickup: 0, wrong_person: 0, picked_silent: 0, said_yes: 0, said_no: 0, not_yet: 0, talked_unclear: 0 };
}

/**
 * ═══ ผลโทรของหัวข้อติดตาม — ช่องเดียวกับแผงขั้นตอนของสายบนหน้าติดตาม (6 ต.ค. 2569) ═══
 * เจ้าของ: *"หน้าหลัก ก็คือยอดที่มาจากตัวเลขพวกนี้เพราะงั้นอย่าเพี้ยน"* + *"หน้าหลักรวมได้แต่ต้องแยกให้เห็น"*
 * ⇒ หนึ่งแถว = หนึ่งสาย (ชุดเดียวกับกล่อง "ทั้งหมด" ด้านบน รวมรอโทร/ยกเลิก) · หมวดจาก `callCategory` (เซิร์ฟเวอร์
 *   `api/_lib/followCategory.ts`) · แยกแท็บ ติดตามคนเริ่มงาน / ติดตามส่งคนแทน และ AI โทร / คนโทร
 * ทุกช่องรวมกัน = ทั้งหมด (เทสต์คุม `followNumbersReconcile.test.ts`)
 */
export const FOLLOW_RESULT_KEYS = ['went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled'] as const;
export type FollowResultKey = (typeof FOLLOW_RESULT_KEYS)[number];
export type FollowResultCounts = Record<FollowResultKey, number>;
export type FollowResultTeam = 'main' | 'replacement';
/** แท็บ × ใครโทร × ช่อง */
export type FollowResultsSplit = Record<FollowResultTeam, Record<'ai' | 'staff', FollowResultCounts>>;

export function emptyFollowResultCounts(): FollowResultCounts {
  return { went: 0, notWent: 0, noAnswer: 0, unclear: 0, waiting: 0, cancelled: 0 };
}
export function emptyFollowResultsSplit(): FollowResultsSplit {
  return {
    main: { ai: emptyFollowResultCounts(), staff: emptyFollowResultCounts() },
    replacement: { ai: emptyFollowResultCounts(), staff: emptyFollowResultCounts() },
  };
}

export type FollowResultRow = {
  key: FollowResultKey;
  main: number;
  replacement: number;
  ai: number;
  staff: number;
  total: number;
  /** % ของทั้งหมด — ปัดรวมกันได้ 100 */
  pct: number;
};

/** แถวของแผง (ลำดับเดียวกับแผงขั้นตอนของสาย) · `total` = ทุกสาย = กล่อง "ทั้งหมด" */
export type FollowResultScope = 'all' | FollowResultTeam;

/**
 * ตารางผลของแผง — แท็บ รวม / แยกแท็บ (เจ้าของ 7 ต.ค. 2569 "เอาเป็นตารางเลย": ไป 651 = AI เท่าไหร่ คนเท่าไหร่)
 * ทุกแถว AI + คนโทร = รวม · ผลรวมทุกแถว = ทั้งหมด (คอลัมน์ไหนก็ได้) — เทสต์คุม `followNumbersReconcile.test.ts`
 */
export function followResultRows(
  split: FollowResultsSplit,
  scope: FollowResultScope = 'all',
): {
  rows: FollowResultRow[];
  total: number;
  byTeam: Record<FollowResultTeam, number>;
  byCaller: Record<'ai' | 'staff', number>;
} {
  const teams: FollowResultTeam[] = scope === 'all' ? ['main', 'replacement'] : [scope];
  const sumTeam = (t: FollowResultTeam, k: FollowResultKey) => split[t].ai[k] + split[t].staff[k];
  const of = (c: 'ai' | 'staff', k: FollowResultKey) => teams.reduce((n, t) => n + split[t][c][k], 0);
  const totals = FOLLOW_RESULT_KEYS.map((k) => of('ai', k) + of('staff', k));
  const pct = roundToHundred(totals);
  const rows = FOLLOW_RESULT_KEYS.map((key, i) => ({
    key,
    main: teams.includes('main') ? sumTeam('main', key) : 0,
    replacement: teams.includes('replacement') ? sumTeam('replacement', key) : 0,
    ai: of('ai', key),
    staff: of('staff', key),
    total: totals[i],
    pct: pct[i],
  }));
  return {
    rows,
    total: totals.reduce((s, v) => s + v, 0),
    byTeam: {
      main: rows.reduce((s, r) => s + r.main, 0),
      replacement: rows.reduce((s, r) => s + r.replacement, 0),
    },
    byCaller: {
      ai: rows.reduce((s, r) => s + r.ai, 0),
      staff: rows.reduce((s, r) => s + r.staff, 0),
    },
  };
}

export type AiShareResultsResponse = {
  generated_at: string;
  block: AiShareBlockKey;
  from: string | null;
  to: string | null;
  bu: string | null;
  vocab: CallResultVocab;
  /** รายชื่อที่ผลล่าสุดมาจาก AI โทร */
  ai: CallResultCounts;
  /** รายชื่อที่ผลล่าสุดเป็นผลที่เจ้าหน้าที่ลงเอง */
  staff: CallResultCounts;
  /** ติดตาม/ดูแลหลังเริ่มงาน — ฐานยังไม่มีช่องลงผลของคนโทร (migration 130) */
  follow_staff_ready: boolean;
  /** หัวข้อติดตามเท่านั้น — ช่องเดียวกับหน้าติดตาม แยกแท็บ × ใครโทร · หัวข้ออื่น = null */
  follow?: FollowResultsSplit | null;
  error: string | null;
};

/** แถวจาก SQL โหมดผลโทร — ผลล่าสุดของแต่ละฝั่งพร้อมเวลา (pg ส่งเวลาเป็น Date หรือข้อความก็ได้) */
export type CallResultSourceRow = {
  ai_outcome: string | null;
  ai_summary: string | null;
  ai_reply: string | null;
  ai_at: Date | string | null;
  staff_outcome: string | null;
  staff_at: Date | string | null;
};

const timeOf = (v: Date | string | null) => {
  const t = v ? new Date(v).getTime() : Number.NaN;
  return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
};

/**
 * ถังของผลที่ **คนลงเอง** — มีแต่รหัส ไม่มีคำพูด
 * 🔴 "ติดต่อสำเร็จ" ของคนโทร (`acknowledged` · 1 ต.ค. 2569) = คุยได้แต่ไม่ได้บอกว่าไปหรือไม่ไป ⇒ `talked_unclear`
 *    (ปล่อยเข้าเครื่องอ่านคำพูด = ไม่มีคำ ⇒ ตก "รับแล้วเงียบ" ซึ่งผิด — คนโทรบอกเองว่าคุยได้)
 */
export function classifyStaffCallResult(outcome: string | null, words: CallMicroVocab): CallMicroOutcome | null {
  if ((outcome ?? '').trim() === 'acknowledged') return 'talked_unclear';
  return classifyCallMicro({ outcome, summary: null, reply: null }, words);
}

/**
 * นับผลโทรแบบ **หนึ่งรายชื่อหนึ่งผล** — เลือกผลล่าสุดระหว่างฝั่ง AI กับคน แล้วจัดถังด้วย `classifyCallMicro`
 * (ผลของ AI อ่านรหัสก่อนแล้วค่อยอ่านคำพูด · ผลของคนมีแต่รหัส) · คลังคำตามหัวข้อ
 */
export function tallyCallResults(
  rows: ReadonlyArray<CallResultSourceRow>,
  vocab: CallResultVocab,
): { ai: CallResultCounts; staff: CallResultCounts } {
  const words = vocab === 'follow' ? FOLLOW_VOCAB : INTEREST_VOCAB;
  const ai = emptyCallResultCounts();
  const staff = emptyCallResultCounts();
  for (const r of rows) {
    const hasAi = !!r.ai_outcome;
    const hasStaff = !!r.staff_outcome;
    const byStaff = hasStaff && (!hasAi || timeOf(r.staff_at) >= timeOf(r.ai_at));
    if (byStaff) {
      const k = classifyStaffCallResult(r.staff_outcome, words);
      if (k) staff[k] += 1;
    } else if (hasAi) {
      const k = classifyCallMicro({ outcome: r.ai_outcome, summary: r.ai_summary, reply: r.ai_reply }, words);
      if (k) ai[k] += 1;
    }
  }
  return { ai, staff };
}

export type CallResultRow = {
  key: CallMicroOutcome;
  label: string;
  hint: string;
  ai: number;
  staff: number;
  total: number;
  /** % ของผลทั้งหมด — ปัดรวมกันได้ 100 */
  pct: number;
};

/** แถวของแผง เรียงตาม `CALL_RESULT_ORDER` · `total` = รายชื่อที่มีผลทั้งหมด (AI + คน) */
export function callResultRows(res: Pick<AiShareResultsResponse, 'vocab' | 'ai' | 'staff'>): {
  rows: CallResultRow[];
  total: number;
} {
  const totals = CALL_RESULT_ORDER.map((k) => res.ai[k] + res.staff[k]);
  const pct = roundToHundred(totals);
  return {
    rows: CALL_RESULT_ORDER.map((key, i) => ({
      key,
      label: callResultLabel(res.vocab, key),
      hint: callResultHint(res.vocab, key),
      ai: res.ai[key],
      staff: res.staff[key],
      total: totals[i],
      pct: pct[i],
    })),
    total: totals.reduce((s, v) => s + v, 0),
  };
}
