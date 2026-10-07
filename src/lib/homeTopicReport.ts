/**
 * ═══ รายงานผลโทรของหัวข้ออื่นบนหน้าหลัก — งานสรรหา · จับคู่งาน · ดูแลหลังเริ่มงาน (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"กล่องที่เหลือก็ทำมาคล้าย ๆ กัน … งานสรรหา ต้องบอกได้เลยว่าออกไปกี่ประกาศ รายชื่อเข้ามาเท่าไหร่ ai โทรไปเท่าไหร่
 * สนใจ ไม่สนใจ อายุเกิน คนไปใช้ต่อเท่าไหร่ คนใช้แล้วผลเป็นยังไง · Prescreen ก็ต้องเปรียบเทียบคนกับ Ai"*
 * → Choice "เอาตามนี้ครบ 3 ส่วน" (เส้นทาง → เทียบ AI/คนก้อนละ BU → ส่งต่อให้คน + ใบที่ค้าง) · "ทำพร้อมกันทั้ง 3"
 *
 * แถวมาจากโหมด `report` ของตัวนับกล่อง (`api/_lib/homeAiShareSql.ts`) ⇒ ชุดแถวเดียวกับกล่อง ทั้งหมด/AI/คน ด้านบนพอดี
 * ก้อน (AI โทร / คนโทร / ทั้งสองทาง / ยังไม่โทร) = กติกาเดียวกับกล่อง (`SEGMENT_WHERE`)
 * ผล = ผลล่าสุดผลเดียวต่อรายชื่อ (ฝั่งที่ใหม่กว่าชนะ แบบแผงผลโทรเดิม) · ทุกช่องรวมกัน = ทั้งหมดของแถว
 * ไฟล์นี้ pure — เทสต์ `tests/api/homeTopicReport.test.ts`
 */
import { classifyCallMicro, INTEREST_VOCAB, type CallMicroOutcome } from '@/lib/callMicroOutcome';
import { classifyStaffCallResult } from '@/lib/homeCallResults';
import type { TONE } from '@/lib/designTokens';

type ToneKey = keyof typeof TONE;
export type ReportSeg = 'ai' | 'staff' | 'both' | 'notCalled';
export const REPORT_SEGS: ReadonlyArray<{ key: ReportSeg; label: string }> = [
  { key: 'ai', label: 'AI โทร' },
  { key: 'staff', label: 'คนโทร' },
  { key: 'both', label: 'ทั้งสองทาง' },
  { key: 'notCalled', label: 'ยังไม่โทร' },
];

export type ReportCol = { key: string; label: string; tone: ToneKey };
export type ReportCell = { bu: string | null; seg: ReportSeg; col: string; n: number };
export type ReportItem = { key: string; label: string; value: number; tone?: ToneKey };
export type TopicReport = {
  /** เส้นทางซ้ายไปขวา */
  funnel: ReportItem[];
  cols: ReportCol[];
  /** BU × ก้อน × ผล — หน้ารวมเองเป็นก้อนละ BU */
  cells: ReportCell[];
  /** ส่วนท้าย: ส่งต่อให้คน · ใบที่ยังรอ */
  extra: Array<{ title: string; items: ReportItem[] }>;
};
export type TopicReportBlock = 'applicants' | 'matching' | 'aftercare';
export type TopicReportResponse = {
  generated_at: string;
  block: TopicReportBlock;
  from: string | null;
  to: string | null;
  bu: string | null;
  report: TopicReport | null;
  error: string | null;
};

/** แถวจากโหมด `report` (คอลัมน์ที่ใช้ — หัวข้อละชุดเพิ่มนิดหน่อย) */
export type ReportSourceRow = {
  ai: boolean;
  staff: boolean;
  bu: string | null;
  ai_outcome: string | null;
  ai_summary: string | null;
  ai_reply: string | null;
  ai_at: string | Date | null;
  staff_outcome: string | null;
  staff_at: string | Date | null;
  // ผู้สมัคร
  age?: number | null;
  appointment?: boolean | null;
  attendance?: string | null;
  log_ok?: boolean | null;
  log_at?: string | Date | null;
  retry?: boolean | null;
  in_queue?: boolean | null;
  held?: boolean | null;
  // จับคู่งาน / ดูแล
  waiting_ai?: boolean | null;
  holding?: boolean | null;
  waiting_staff?: boolean | null;
};

/** ผลแบบ "สนใจ" (ผู้สมัคร · จับคู่งาน) */
export const INTEREST_COLS: ReportCol[] = [
  { key: 'interested', label: 'สนใจ', tone: 'success' },
  { key: 'notInterested', label: 'ไม่สนใจ', tone: 'danger' },
  { key: 'notYet', label: 'ขอคิดก่อน', tone: 'orange' },
  { key: 'noAnswer', label: 'ไม่รับสาย', tone: 'warn' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: 'violet' },
  { key: 'noResult', label: 'ยังไม่มีผล', tone: 'info' },
];

/**
 * ดูแลหลังเริ่มงาน — ยังไม่มีศัพท์ผลของงานนี้เอง (คำถามคือความเป็นอยู่ ไม่ใช่ไป/ไม่ไป) ⇒ แบ่งแค่ติดต่อได้หรือไม่ ไม่ตีความเกิน
 */
export const REACH_COLS: ReportCol[] = [
  { key: 'reached', label: 'ติดต่อได้', tone: 'success' },
  { key: 'wrongPerson', label: 'ผิดคน', tone: 'danger' },
  { key: 'noAnswer', label: 'ไม่รับสาย', tone: 'warn' },
  { key: 'noResult', label: 'ยังไม่มีผล', tone: 'info' },
];

const ms = (v: string | Date | null | undefined) => (v ? new Date(v).getTime() : -1);

export const segOf = (r: Pick<ReportSourceRow, 'ai' | 'staff'>): ReportSeg =>
  r.ai && r.staff ? 'both' : r.ai ? 'ai' : r.staff ? 'staff' : 'notCalled';

/** ผลล่าสุดผลเดียว (คำเล็ก) — ฝั่งที่ใหม่กว่าชนะ · null = ยังไม่มีผล */
export function latestMicro(r: ReportSourceRow): CallMicroOutcome | null {
  const hasAi = !!r.ai_outcome;
  const hasStaff = !!r.staff_outcome;
  if (hasStaff && (!hasAi || ms(r.staff_at) >= ms(r.ai_at))) return classifyStaffCallResult(r.staff_outcome, INTEREST_VOCAB);
  if (hasAi) return classifyCallMicro({ outcome: r.ai_outcome, summary: r.ai_summary, reply: r.ai_reply }, INTEREST_VOCAB);
  return null;
}

export function interestColOf(r: ReportSourceRow): string {
  // บันทึกติดต่อของเจ้าหน้าที่ใหม่กว่าผลโทร = ใช้บันทึก (ไม่สำเร็จ = ไม่สนใจ · กติกาเดียวกับกล่องงาน `applicantCallOutcome`)
  if (typeof r.log_ok === 'boolean' && ms(r.log_at) > Math.max(ms(r.ai_at), ms(r.staff_at))) {
    if (!r.log_ok) return 'notInterested';
    return r.appointment ? 'interested' : 'unclear';
  }
  switch (latestMicro(r)) {
    case 'said_yes':
      return 'interested';
    case 'said_no':
    case 'wrong_person':
      return 'notInterested';
    case 'not_yet':
      return 'notYet';
    case 'no_pickup':
      return 'noAnswer';
    case null:
      return 'noResult';
    default:
      return 'unclear';
  }
}

export function reachColOf(r: ReportSourceRow): string {
  switch (latestMicro(r)) {
    case 'no_pickup':
      return 'noAnswer';
    case 'wrong_person':
      return 'wrongPerson';
    case null:
      return 'noResult';
    default:
      return 'reached';
  }
}

function cellsOf(rows: readonly ReportSourceRow[], colOf: (r: ReportSourceRow) => string): ReportCell[] {
  const m = new Map<string, ReportCell>();
  for (const r of rows) {
    const seg = segOf(r);
    const col = colOf(r);
    const k = `${r.bu ?? ''}|${seg}|${col}`;
    const c = m.get(k) ?? { bu: r.bu ?? null, seg, col, n: 0 };
    c.n += 1;
    m.set(k, c);
  }
  return [...m.values()];
}

const count = (rows: readonly ReportSourceRow[], f: (r: ReportSourceRow) => boolean) => rows.reduce((n, r) => n + (f(r) ? 1 : 0), 0);

/** อายุเกินที่ระบบไม่ส่งให้ AI (`OVER_AGE_MIN` = 58 · `src/lib/applicantAge.ts`) */
export const OVER_AGE_MIN = 58;

export function buildApplicantsReport(rows: readonly ReportSourceRow[], published: number): TopicReport {
  const col = (r: ReportSourceRow) => interestColOf(r);
  const staffResult = (r: ReportSourceRow) => !!r.staff_outcome || typeof r.log_ok === 'boolean';
  const overAge = (r: ReportSourceRow) => (r.age ?? 0) >= OVER_AGE_MIN;
  return {
    funnel: [
      { key: 'published', label: 'ประกาศ', value: published },
      { key: 'total', label: 'ใบสมัครเข้ามา', value: rows.length },
      { key: 'called', label: 'ติดต่อแล้ว', value: count(rows, (r) => r.ai || r.staff) },
      { key: 'interested', label: 'สนใจ', value: count(rows, (r) => col(r) === 'interested') },
      { key: 'appointment', label: 'นัดหมาย', value: count(rows, (r) => !!r.appointment) },
      { key: 'showed', label: 'มาตามนัด', value: count(rows, (r) => r.attendance === 'showed') },
    ],
    cols: INTEREST_COLS,
    cells: cellsOf(rows, col),
    extra: [
      {
        title: 'ส่งต่อให้คน',
        items: [
          { key: 'handoff', label: 'AI โทรแล้ว คนรับต่อ', value: count(rows, (r) => r.ai && r.staff) },
          { key: 'staffResult', label: 'คนลงผลแล้ว', value: count(rows, (r) => r.staff && staffResult(r)) },
          { key: 'noShow', label: 'ไม่มาตามนัด', value: count(rows, (r) => r.attendance === 'no_show'), tone: 'danger' },
        ],
      },
      {
        title: 'ใบที่ยังรอ',
        items: [
          { key: 'retry', label: 'รอ AI ลองใหม่', value: count(rows, (r) => !!r.retry), tone: 'warn' },
          { key: 'inQueue', label: 'อยู่ในคิว AI ยังไม่มีผล', value: count(rows, (r) => !!r.in_queue && !r.retry), tone: 'info' },
          {
            key: 'held',
            label: 'เจ้าหน้าที่รับไว้ รอบันทึกผล',
            value: count(rows, (r) => !!r.held && !staffResult(r) && !r.in_queue),
            tone: 'violet',
          },
          {
            key: 'overAge',
            label: 'อายุเกิน ไม่ส่ง AI',
            value: count(rows, (r) => segOf(r) === 'notCalled' && overAge(r)),
            tone: 'neutral',
          },
          {
            key: 'untouched',
            label: 'ยังไม่มีใครแตะ',
            value: count(rows, (r) => segOf(r) === 'notCalled' && !r.in_queue && !r.held && !overAge(r)),
            tone: 'danger',
          },
        ],
      },
    ],
  };
}

/**
 * เส้นทางจับคู่งาน (เจ้าของ 7 ต.ค. 2569 "จับคู่งานก็ต้องเป็น เข้ามากี่ใบ Ai match รอแล้วเท่าไหร่ คนโทร … คิดต่อให้บ้าง"
 * → Choice "เอาตามนี้") — ใบขอที่เข้ามาในช่วง (ใบที่ยังเปิด) · ผลจับคู่ของใบเหล่านั้น · การเสนอ/จอง/ส่งตัวของทีมจับคู่งาน
 * ⚠️ จอง/ส่งตัว = สถานะทีมจับคู่งาน (`candidate_proposals`) ไม่ใช่หาได้ทางการจาก ERP
 */
export type MatchingFlow = {
  jobsIn: number;
  jobsMatched: number;
  /** มีคนเขียว/เหลืองที่ยังว่าง */
  jobsRecommend: number;
  jobsNone: number;
  /** ใบด่วน ไม่มีคนแนะนำ ยังไม่ส่งโพสต์ */
  urgentStuck: number;
  matched: number;
  green: number;
  yellow: number;
  red: number;
  greenAvailable: number;
  /** เขียวที่ยังว่าง และยังไม่มีใครโทร (ไม่มีคิว/ไม่มีคนรับ) */
  greenUncontacted: number;
  reserved: number;
  placed: number;
  retry: number;
  needsHuman: number;
  stale: number;
};

export const emptyMatchingFlow = (): MatchingFlow => ({
  jobsIn: 0,
  jobsMatched: 0,
  jobsRecommend: 0,
  jobsNone: 0,
  urgentStuck: 0,
  matched: 0,
  green: 0,
  yellow: 0,
  red: 0,
  greenAvailable: 0,
  greenUncontacted: 0,
  reserved: 0,
  placed: 0,
  retry: 0,
  needsHuman: 0,
  stale: 0,
});

/**
 * จับคู่งาน — เส้นทาง: ใบขอเข้ามา → AI จับคู่แล้ว → มีคนแนะนำ → คนที่จับคู่รอ → ส่งโทร (= กล่อง) → ติดต่อแล้ว → สนใจ → จอง → ส่งตัว
 */
export function buildMatchingReport(rows: readonly ReportSourceRow[], f: MatchingFlow): TopicReport {
  const col = (r: ReportSourceRow) => interestColOf(r);
  return {
    funnel: [
      { key: 'jobsIn', label: 'ใบขอเข้ามา', value: f.jobsIn },
      { key: 'jobsMatched', label: 'AI จับคู่แล้ว', value: f.jobsMatched },
      { key: 'jobsRecommend', label: 'มีคนแนะนำ', value: f.jobsRecommend },
      { key: 'matched', label: 'คนที่จับคู่รอ', value: f.matched },
      { key: 'total', label: 'ส่งโทร', value: rows.length },
      { key: 'called', label: 'ติดต่อแล้ว', value: count(rows, (r) => r.ai || r.staff) },
      { key: 'interested', label: 'สนใจ', value: count(rows, (r) => col(r) === 'interested') },
      { key: 'reserved', label: 'จอง', value: f.reserved },
      { key: 'placed', label: 'ส่งตัว', value: f.placed },
    ],
    cols: INTEREST_COLS,
    cells: cellsOf(rows, col),
    extra: [
      {
        title: 'คนที่จับคู่รอ',
        items: [
          { key: 'green', label: 'เขียว', value: f.green, tone: 'success' },
          { key: 'yellow', label: 'เหลือง', value: f.yellow, tone: 'warn' },
          { key: 'red', label: 'แดง', value: f.red, tone: 'danger' },
        ],
      },
      {
        title: 'ต้องสั่งงาน',
        items: [
          { key: 'greenUncontacted', label: 'เขียวที่ยังว่าง ยังไม่มีใครโทร', value: f.greenUncontacted, tone: 'success' },
          { key: 'jobsNone', label: 'ใบขอที่ไม่มีคนเหมาะ', value: f.jobsNone, tone: 'danger' },
          { key: 'urgentStuck', label: 'ใบด่วน ไม่มีคน ยังไม่ส่งโพสต์', value: f.urgentStuck, tone: 'danger' },
        ],
      },
      {
        title: 'ที่ยังรอ',
        items: [
          {
            key: 'inQueue',
            label: 'อยู่ในคิว AI ยังไม่มีผล',
            value: count(rows, (r) => segOf(r) === 'notCalled' && !!r.waiting_ai),
            tone: 'info',
          },
          { key: 'stale', label: 'ส่ง AI แล้วค้างเกิน 2 วัน', value: f.stale, tone: 'warn' },
          { key: 'retry', label: 'รอ AI โทรซ้ำ', value: f.retry, tone: 'warn' },
          { key: 'needsHuman', label: 'ต้องให้คนเร่งจัดการ', value: f.needsHuman, tone: 'danger' },
          {
            key: 'held',
            label: 'เจ้าหน้าที่รับไว้ รอบันทึกผล',
            value: count(rows, (r) => segOf(r) === 'notCalled' && !r.waiting_ai && !!r.holding),
            tone: 'violet',
          },
        ],
      },
    ],
  };
}

export function buildAftercareReport(rows: readonly ReportSourceRow[]): TopicReport {
  const col = (r: ReportSourceRow) => reachColOf(r);
  return {
    funnel: [
      { key: 'total', label: 'สายที่ต้องโทร', value: rows.length },
      { key: 'called', label: 'โทรแล้ว', value: count(rows, (r) => r.ai || r.staff) },
      { key: 'reached', label: 'ติดต่อได้', value: count(rows, (r) => col(r) === 'reached') },
    ],
    cols: REACH_COLS,
    cells: cellsOf(rows, col),
    extra: [
      {
        title: 'ที่ยังรอ',
        items: [
          { key: 'waitingAi', label: 'รอ AI โทร', value: count(rows, (r) => segOf(r) === 'notCalled' && !!r.waiting_ai), tone: 'info' },
          {
            key: 'waitingStaff',
            label: 'รอคนโทร',
            value: count(rows, (r) => segOf(r) === 'notCalled' && !!r.waiting_staff),
            tone: 'violet',
          },
        ],
      },
    ],
  };
}

/** ก้อนละ BU — BU ที่ไม่มีงานไม่ขึ้น · ในก้อนครบ 4 ก้อน (0 ก็ขึ้น) · ทุกก้อนรวม = ทั้งหมด */
export type ReportBuBlock = {
  bu: string | null;
  total: number;
  bySeg: Record<ReportSeg, { total: number; cols: Record<string, number> }>;
  sum: Record<string, number>;
};

export function reportBuBlocks(report: TopicReport): ReportBuBlock[] {
  const map = new Map<string, ReportBuBlock>();
  const empty = () => Object.fromEntries(report.cols.map((c) => [c.key, 0])) as Record<string, number>;
  for (const c of report.cells) {
    const k = c.bu ?? '';
    const b =
      map.get(k) ??
      ({
        bu: c.bu,
        total: 0,
        bySeg: Object.fromEntries(REPORT_SEGS.map((s) => [s.key, { total: 0, cols: empty() }])) as ReportBuBlock['bySeg'],
        sum: empty(),
      } satisfies ReportBuBlock);
    b.total += c.n;
    b.bySeg[c.seg].total += c.n;
    b.bySeg[c.seg].cols[c.col] = (b.bySeg[c.seg].cols[c.col] ?? 0) + c.n;
    b.sum[c.col] = (b.sum[c.col] ?? 0) + c.n;
    map.set(k, b);
  }
  return [...map.values()]
    .filter((b) => b.total > 0)
    .sort((a, b) => (a.bu === null ? 1 : 0) - (b.bu === null ? 1 : 0) || b.total - a.total);
}
