/**
 * ═══ หน้าหลัก "ระบบไปกี่ %" — AI โทร vs คนโทร (เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"ฉันจะใช้เพื่อบอกว่าตอนนี้ระบบไปกี่ % … หน้าการติดตาม คนโทรเองเท่าไหร่ ส่งให้ AI โทรเท่าไหร่
 * จากทั้งหมดเท่าไหร่ · กล่องงานที่สมัครเข้ามา AI โทรเท่าไหร่ คนโทรเองเท่าไหร่"* → รอบสอง: *"เอาหน้าติดตาม
 * หลังเริ่มงานมาด้วย จับคู่งานด้วยเพิ่มมา · ช่วงฉันขอเป็น calendar"*
 *
 * นิยามที่เคาะผ่าน Choice (ห้ามเปลี่ยนเอง):
 * 1. นับจาก **โทรจริงที่มีผลบันทึก** ไม่ใช่จากการตั้ง/มอบหมาย · AI โทรไม่ติดก็นับว่า AI โทรแล้ว
 * 2. งานที่ทั้ง AI และคนโทร = ก้อน **"ทั้งสองทาง"** · 4 ก้อนรวมกันเท่ากับทั้งหมดพอดี (ไม่นับซ้ำ)
 * 3. ตัวหาร 2 แบบ: เลขตัวใหญ่ = AI ÷ ที่โทรแล้ว · แถบ = 4 ก้อนจากทั้งหมด
 * 4. ช่วงเวลาเลือกบนปฏิทิน ค่าตั้งต้น **7 วันล่าสุด** รวมวันนี้ (รอบ 3 เปลี่ยนจาก 30 วัน)
 * 5. ดูแลหลังเริ่มงาน = **สายที่ตั้งไว้ในระบบ** แบบเดียวกับหน้าติดตาม (รอบ 3/7/30 วันที่ยังไม่ได้ตั้งไม่นับ)
 *
 * หน่วย: ติดตาม / ดูแลหลังเริ่มงาน = **สาย** (หนึ่งแถว follow_entries = หนึ่งรอบ · ตามวันที่ถึงคิว) ·
 * ผู้สมัคร = **ใบ** (ตามวันสมัคร ไม่นับ Lead) · จับคู่งาน = **คน ต่อหนึ่งใบขอ** (หน่วยเดียวกับแผง "AI โทร" ของหน้านั้น)
 * SQL อยู่ `api/_lib/homeAiShareSql.ts` ที่เดียว
 *
 * ไฟล์นี้ pure — ช่วงวันที่ + ตัวคิดสัดส่วน · เทสต์ที่ `tests/api/homeAiShare.test.ts`
 */
import type { ToneKey } from '@/lib/designTokens';
import { parseYmd, toYmdBangkok } from '@/lib/dateTh';
import { addDays, daysBetween } from '@/lib/trends/timeBuckets';
import { SITE_BU_TO_DEPT, trendBuLabel } from '@/lib/trends/bu';
import {
  TH_MONTH_FULL,
  TH_MONTH_SHORT,
  TH_WEEKDAY_FULL,
  TH_WEEKDAY_SHORT,
  mondayOf,
  monthOf,
  periodModeOf,
  rangeText,
  unitCount,
  unitSpan,
  type PeriodWindow,
} from '@/lib/periodPick';

/**
 * ช่วงวันที่ตามปฏิทินกรุงเทพ (YYYY-MM-DD) · สองค่าเป็น null = ทั้งหมด · `unit` = หน่วยที่เลือกบนปฏิทิน (รอบ 18 ·
 * ใช้จัดแท่งของกราฟฝั่งหน้าเว็บเท่านั้น — เส้นหลังบ้านอ่านแค่ช่วงวันที่)
 */
export type AiShareWindow = PeriodWindow;

/**
 * ค่าตั้งต้น = **7 วันล่าสุดรวมวันนี้** (เจ้าของเปลี่ยน 30 ก.ย. 2569 รอบ 3: *"แค่ default ให้เป็นย้อนหลัง 7 วันพอ"*
 * · รอบแรกเคาะไว้ 30 วัน) — ปุ่มลัดตัวแรกของปฏิทิน (`QUICK_PERIODS`) ตัวเดียวกัน
 */
export function defaultAiShareWindow(now: Date = new Date()): AiShareWindow {
  const today = toYmdBangkok(now);
  return { from: addDays(today, -6), to: today };
}

const ymdOrNull = (raw: unknown): string | null =>
  typeof raw === 'string' && parseYmd(raw.trim()) ? raw.trim() : null;

/**
 * อ่านช่วงจาก query — วันที่อ่านไม่ออก = ไม่มีขอบฝั่งนั้น · ไม่ส่งทั้งคู่ = ทั้งหมด
 * กรอกกลับหัว (จากหลังถึง) = สลับให้ ไม่ใช่ตอบว่างเปล่า
 */
export function parseAiShareWindow(q: { from?: unknown; to?: unknown }): AiShareWindow {
  const from = ymdOrNull(q.from);
  const to = ymdOrNull(q.to);
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

/**
 * ขอบเวลาจริงของช่วง — เริ่ม 00:00 น. ของวันแรก (เวลาไทย) · จบก่อน 00:00 น. ของวันถัดจากวันสุดท้าย
 * แต่ไม่เกิน "ตอนนี้" (งานที่ยังไม่ถึงเวลายังไม่ใช่งานของช่วงนี้)
 */
export function aiShareBounds(win: AiShareWindow, now: Date): { start: Date | null; end: Date } {
  const start = win.from ? new Date(`${win.from}T00:00:00+07:00`) : null;
  const toEnd = win.to ? new Date(`${addDays(win.to, 1)}T00:00:00+07:00`) : null;
  const end = toEnd && toEnd.getTime() < now.getTime() ? toEnd : now;
  return { start, end };
}

const DAY_MS = 86_400_000;

/** ถอยวันที่ 1 ของเดือนไป n เดือน */
function monthsBack(firstOfMonth: string, n: number): string {
  const idx = Number(firstOfMonth.slice(0, 4)) * 12 + Number(firstOfMonth.slice(5, 7)) - 1 - n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
}

/** ช่วงที่ตรงขอบปี/เดือนพอดี (หนึ่งหรือหลายหน่วย) — ใช้ถอยช่วงก่อนหน้าตามปฏิทิน ไม่ใช่ตามจำนวนวัน */
function alignedSpan(from: string, to: string): { unit: 'month' | 'year'; count: number } | null {
  const yr = unitSpan('year', from, to);
  if (yr.from === from && yr.to === to) return { unit: 'year', count: unitCount('year', from, to) };
  const mo = unitSpan('month', from, to);
  if (mo.from === from && mo.to === to) return { unit: 'month', count: unitCount('month', from, to) };
  return null;
}

/**
 * ═══ ช่วงก่อนหน้า (เทียบกับช่วงก่อน · รอบ 4) ═══
 * ยาวเท่ากัน **ณ จุดเดียวกันของช่วง** — สัปดาห์นี้ถึงวันพุธเที่ยง เทียบสัปดาห์ก่อนถึงวันพุธเที่ยง (ไม่เอาทั้งสัปดาห์ก่อนมาเทียบ
 * กับของที่ยังไม่จบ) · ทั้งเดือน = เดือนก่อนตั้งแต่วันที่ 1 เท่าจำนวนเวลาที่ผ่านไป · ทั้งปี (รอบ 17) = ปีก่อนตั้งแต่ 1 ม.ค.
 * เท่าจำนวนเวลาที่ผ่านไป · ทั้งหมด = ไม่มีช่วงก่อน
 * รอบ 18 (เลือกหลายเดือน/ปี/สัปดาห์มาเทียบ): ตรงขอบเดือน/ปีหลายหน่วย = ถอยไปเท่าจำนวนหน่วยตามปฏิทิน ("2 เดือนก่อนหน้า") ·
 * หลายสัปดาห์ = ถอยเท่าจำนวนสัปดาห์ ("3 สัปดาห์ก่อนหน้า")
 */
export function previousBounds(
  win: AiShareWindow,
  now: Date,
): { start: Date; end: Date; from: string; to: string; label: string } | null {
  if (!win.from || !win.to) return null;
  const { start, end } = aiShareBounds(win, now);
  if (!start || end.getTime() <= start.getTime()) return null;
  const mode = periodModeOf(win);
  const aligned = alignedSpan(win.from, win.to);
  let prevStart: Date;
  let prevEnd: Date;
  let label: string;
  if (aligned) {
    const back =
      aligned.unit === 'year' ? `${Number(win.from.slice(0, 4)) - aligned.count}-01-01` : monthsBack(win.from, aligned.count);
    prevStart = new Date(`${back}T00:00:00+07:00`);
    prevEnd = new Date(Math.min(prevStart.getTime() + (end.getTime() - start.getTime()), start.getTime()));
    const name = aligned.unit === 'year' ? 'ปี' : 'เดือน';
    label = aligned.count === 1 ? `${name}ก่อน` : `${aligned.count.toLocaleString('th-TH')} ${name}ก่อนหน้า`;
  } else {
    const len = daysBetween(win.from, win.to) + 1;
    prevStart = new Date(start.getTime() - len * DAY_MS);
    prevEnd = new Date(end.getTime() - len * DAY_MS);
    const weeks = win.from === mondayOf(win.from) && len % 7 === 0 ? len / 7 : 0;
    label =
      mode === 'week'
        ? 'สัปดาห์ก่อน'
        : mode === 'day'
          ? win.from === toYmdBangkok(now)
            ? 'เมื่อวาน'
            : 'วันก่อนหน้า'
          : weeks >= 2
            ? `${weeks.toLocaleString('th-TH')} สัปดาห์ก่อนหน้า`
            : `${len.toLocaleString('th-TH')} วันก่อนหน้า`;
  }
  return {
    start: prevStart,
    end: prevEnd,
    from: toYmdBangkok(prevStart),
    to: toYmdBangkok(new Date(prevEnd.getTime() - 1)),
    label,
  };
}

/** 4 ก้อนที่ไม่ทับกัน — `ai`/`staff` = ฝั่งเดียวล้วน · `both` = ทั้งสองทาง */
export type AiShareCounts = {
  total: number;
  ai: number;
  staff: number;
  both: number;
  notCalled: number;
};

/** หน้าติดตาม / ดูแลหลังเริ่มงาน — ยังไม่โทรแยกเป็น รอ AI โทร · รอคนโทร (ที่เหลือ = ไม่ได้ส่งให้ AI) */
export type AiShareFollow = AiShareCounts & { waitingAi: number; waitingStaff: number };

/** ผู้สมัคร — ยังไม่โทรแยกแบบเดียวกับถังของกล่องงาน: รอคิว AI · มีคนเก็บไว้ · ยังไม่มีใครแตะ */
export type AiShareApplicants = AiShareCounts & { waitingAi: number; held: number; untouched: number };

/** จับคู่งาน — ยังไม่โทรแยกเป็น รอ AI โทร · เจ้าหน้าที่รับไปแล้วยังไม่ลงผล (ที่เหลือ = ไม่มีผลกลับมา) */
export type AiShareMatching = AiShareCounts & { waitingAi: number; holding: number };

export const AI_SHARE_BLOCKS = ['follow', 'aftercare', 'applicants', 'matching'] as const;

/**
 * หน่วยบนจอของทุกหัวข้อ (รอบ 18 · เจ้าของ: *"คำว่าสายเปลี่ยนเป็นรายชื่อไหม เรานับจากรายชื่อหนิ งั้นก็ต้องเป็นรายชื่อหมดเลย"*)
 * เดิมติดตาม/ดูแลหลังเริ่มงาน = สาย · ผู้สมัคร = ใบ · จับคู่งาน = คน — ตัวที่นับยังเหมือนเดิมทุกหัวข้อ (หนึ่งแถวของรายการ = หนึ่งรายชื่อ)
 */
export const AI_SHARE_UNIT = 'รายชื่อ';
export type AiShareBlockKey = (typeof AI_SHARE_BLOCKS)[number];

export type AiShareResponse = {
  generated_at: string;
  /** ช่วงที่ใช้จริง (YYYY-MM-DD เวลาไทย) · null ทั้งคู่ = ทั้งหมด */
  from: string | null;
  to: string | null;
  /** BU ที่ใช้จริง — บัญชีที่ถูกล็อกแผนก = BU ของบัญชีเสมอ */
  bu: string | null;
  forced_bu: boolean;
  follow: AiShareFollow | null;
  aftercare: AiShareFollow | null;
  applicants: AiShareApplicants | null;
  matching: AiShareMatching | null;
  /** ฐานมีช่องลงผลของคนโทรแล้วหรือยัง (migration 130) — ยังไม่มี = นับคนโทรของสองก้อนแรกไม่ได้ ต้องบอกบนจอ */
  follow_staff_ready: boolean;
  /** ก้อนล้มแยกกัน — ก้อนที่ล้มเป็น null + เหตุ (ห้ามขึ้น 0 ปลอม) */
  errors: Partial<Record<AiShareBlockKey, string>>;
  /**
   * ช่วงก่อนหน้าที่ยาวเท่ากัน ณ จุดเดียวกัน (รอบ 4 · เจ้าของเลือก "เทียบกับช่วงก่อน") · ทั้งหมด = null
   * ก้อนที่อ่านช่วงก่อนไม่ได้ = null (การ์ดแค่ไม่โชว์การเทียบ ไม่ใช่ล้มทั้งก้อน)
   */
  previous: AiSharePrevious | null;
};

export type AiSharePrevious = {
  from: string;
  to: string;
  /** คำเรียกช่วงก่อน เช่น "7 วันก่อนหน้า" · "สัปดาห์ก่อน" · "เดือนก่อน" · "เมื่อวาน" */
  label: string;
  follow: AiShareCounts | null;
  aftercare: AiShareCounts | null;
  applicants: AiShareCounts | null;
  matching: AiShareCounts | null;
};

export function isAiShareBlock(v: unknown): v is AiShareBlockKey {
  return typeof v === 'string' && (AI_SHARE_BLOCKS as readonly string[]).includes(v);
}

/** หนึ่งแถวของกราฟตอนกดการ์ด — วัน (เวลาไทย) × BU (ชุดแผนก · null = ไม่รู้ BU) */
export type AiShareDetailRow = AiShareCounts & { day: string; bu: string | null };

export type AiShareDetailResponse = {
  generated_at: string;
  block: AiShareBlockKey;
  from: string | null;
  to: string | null;
  bu: string | null;
  rows: AiShareDetailRow[] | null;
  /** เฉพาะติดตาม/ดูแลหลังเริ่มงาน — ฐานยังไม่มีช่องลงผลของคนโทร */
  follow_staff_ready: boolean;
  error: string | null;
};

/** โทรแล้ว = สามก้อนแรกรวมกัน */
export function calledOf(c: AiShareCounts): number {
  return c.ai + c.staff + c.both;
}

/** ก้อนรวมกันต้องเท่ากับทั้งหมดเสมอ — ไม่เท่า = SQL นับทับกัน/ตกหล่น */
export function isBalanced(c: AiShareCounts): boolean {
  return c.ai + c.staff + c.both + c.notCalled === c.total;
}

/**
 * ปัด % ให้รวมกันได้ 100 พอดี (วิธีเศษมากสุด) — เจ้าของเลือก "รวมกันได้ 100% พอดี"
 * ปัดแยกทีละตัวแล้วได้ 99/101 = จอขัดกับคำที่ตกลงกันไว้
 * ตัวหาร 0 = ทุกตัวเป็น 0
 */
export function roundToHundred(values: readonly number[]): number[] {
  const sum = values.reduce((s, v) => s + Math.max(0, v), 0);
  if (sum <= 0) return values.map(() => 0);
  const raw = values.map((v) => (Math.max(0, v) / sum) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((s, v) => s + v, 0);
  // เศษมากก่อน · เศษเท่ากันให้ตัวที่ค่ามากกว่าก่อน (ผลคงที่ ไม่ขึ้นกับลำดับที่ส่งเข้ามา)
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v), v }))
    .sort((a, b) => b.frac - a.frac || b.v - a.v || a.i - b.i);
  for (const o of order) {
    if (left <= 0) break;
    if (o.frac === 0) continue;
    out[o.i] += 1;
    left -= 1;
  }
  return out;
}

/** สัดส่วนในงานที่โทรแล้ว (เลขตัวใหญ่) — ยังไม่มีงานที่โทรแล้ว = `null` (ห้ามขึ้น 0% ให้ดูเหมือนคนทำหมด) */
export function sharesOfCalled(c: AiShareCounts): { ai: number; staff: number; both: number } | null {
  if (calledOf(c) <= 0) return null;
  const [ai, staff, both] = roundToHundred([c.ai, c.staff, c.both]);
  return { ai, staff, both };
}

export type AiShareSegment = 'ai' | 'both' | 'staff' | 'notCalled';

/** ลำดับบนแถบและป้าย — AI → คน → ทั้งสองทาง → ยังไม่โทร (ตามภาพที่เจ้าของเลือก 30 ก.ย. 2569) */
export const AI_SHARE_SEGMENTS: readonly AiShareSegment[] = ['ai', 'staff', 'both', 'notCalled'];

export const AI_SHARE_SEGMENT_LABEL: Record<AiShareSegment, string> = {
  ai: 'AI โทร',
  both: 'ทั้งสองทาง',
  staff: 'คนโทร',
  notCalled: 'ยังไม่โทร',
};

/**
 * สีของก้อนที่โทรแล้ว — กรมท่า = AI (สีเดียวกับ "โทรแล้ว" ของแผง Lumos) · ม่วง = คน (สีเดียวกับ
 * "เก็บไปโทรเอง" ของหน้าหลักเดิม) · เขียวหัวเป็ด = ทั้งสองทาง
 * "ยังไม่โทร" ไม่มีสี — คือส่วนที่แถบยังว่าง (พื้นของแถบ) ตามภาพที่เจ้าของเลือก
 */
export const AI_SHARE_CALLED_TONE: Record<Exclude<AiShareSegment, 'notCalled'>, ToneKey> = {
  ai: 'primary',
  both: 'teal',
  staff: 'violet',
};

/** 4 ก้อนจากทั้งหมด (แถบ) — % ปัดรวมกันได้ 100 · ทั้งหมด 0 = ทุกก้อน 0% */
export function segmentsOfTotal(c: AiShareCounts): Array<{ key: AiShareSegment; value: number; pct: number }> {
  const values = AI_SHARE_SEGMENTS.map((k) => c[k]);
  const pct = roundToHundred(values);
  return AI_SHARE_SEGMENTS.map((key, i) => ({ key, value: values[i], pct: pct[i] }));
}

export function isAiShareSegment(v: unknown): v is AiShareSegment {
  return typeof v === 'string' && (AI_SHARE_SEGMENTS as readonly string[]).includes(v);
}

/*
 * ─────────────── รายชื่อหลังเลขในกล่อง (รอบ 17 · 30 ก.ย. 2569) ───────────────
 * เจ้าของ: *"Visual พอกดแล้วเด้ง Popup แสดงรายชื่อมา"*
 * กดกล่องไหน = รายชื่อของก้อนนั้น (ทั้งหมด = ทุกก้อน) · ช่วง/BU เดียวกับตัวเลข · SQL ใช้ CTE ตัวเดียวกับตัวนับ
 * และเงื่อนไขก้อนชุดเดียวกัน (`SEGMENT_WHERE` ของ `api/_lib/homeAiShareSql.ts`) ⇒ จำนวนชื่อ = เลขในกล่องเสมอ
 * 🔴 ไม่มีเบอร์ในคำตอบ — จับคู่งานต่อด้วยเบอร์ ⇒ กุญแจแถวเป็นค่าแฮช ไม่ใช่เบอร์
 */

/** กล่องที่กดได้ — ทั้งหมด หรือก้อนใดก้อนหนึ่ง */
export type AiShareListKey = 'total' | AiShareSegment;
export const AI_SHARE_LIST_KEYS: readonly AiShareListKey[] = ['total', ...AI_SHARE_SEGMENTS];

export function isAiShareListKey(v: unknown): v is AiShareListKey {
  return typeof v === 'string' && (AI_SHARE_LIST_KEYS as readonly string[]).includes(v);
}

/** หน้าละกี่ชื่อ */
export const AI_SHARE_LIST_PAGE = 20;
/** หน้าสุดท้ายที่ยอมให้ขอ — กันเลขหน้าใหญ่ ๆ ให้ฐานไล่ข้ามแถวเปล่า ๆ */
export const AI_SHARE_LIST_MAX_PAGE = 5000;

/** เลขหน้าจาก query (เริ่มที่ 0) — อ่านไม่ออก/ติดลบ = หน้าแรก · เกินเพดาน = หน้าเพดาน */
export function parseListPage(raw: unknown): number {
  const t = typeof raw === 'string' ? raw.trim() : '';
  const n = /^\d+$/.test(t) ? Number(t) : 0;
  return Math.min(Number.isSafeInteger(n) ? n : 0, AI_SHARE_LIST_MAX_PAGE);
}

export type AiShareListRow = {
  /** กุญแจของแถว (ไม่ใช่เบอร์) */
  id: string;
  /** null = ต้นทางไม่ได้เก็บชื่อไว้ */
  name: string | null;
  bu: string | null;
  /** วันของงาน (เวลาไทย) — วันถึงคิวโทร · วันสมัคร · วันส่งเข้าคิวครั้งแรก ตามหัวข้อ (ตัวเดียวกับแท่งของกราฟ) */
  day: string;
  segment: AiShareSegment;
};

export type AiShareListResponse = {
  generated_at: string;
  block: AiShareBlockKey;
  segment: AiShareListKey;
  from: string | null;
  to: string | null;
  bu: string | null;
  /** หน้าที่ตอบ (เริ่มที่ 0) */
  page: number;
  page_size: number;
  /** จำนวนชื่อทั้งก้อน (ทุกหน้า) */
  total: number;
  rows: AiShareListRow[] | null;
  follow_staff_ready: boolean;
  error: string | null;
};

/*
 * ─────────────── กราฟยอดใช้งาน + แผงเลื่อน "มาจาก BU ไหน" (รอบ 3 → รอบ 5 · 30 ก.ย. 2569) ───────────────
 * รอบ 5 เจ้าของ: *"กราฟโชว์ว่ายอดใช้งานของแต่ละวัน แต่ละเดือนเท่าไหร่ · กดดูกราฟไหนก็โชว์แบบ Slide มาทางขวาว่า
 * ยอดใช้งาน 800 เกิดจาก BU ไหนบ้าง แล้วแต่ละ BU ใช้คนหรือ AI อย่างละเท่าไหร่"*
 * ⇒ แท่งซ้อน 4 ก้อน (`detailSegments`) · กดแท่ง = แถวของช่วงนั้น (`rowsInRange`) → ต่อ BU (`detailBreakdown`)
 * ทุกตัวอ่านแถววัน×BU ชุดเดียวกัน ⇒ รวมทุก BU = ยอดของแท่ง · รวมทุกแท่ง = ยอดของการ์ดเสมอ
 */

/** BU ทั้งหมดของบริษัท (ชุดแผนก) — ตารางโชว์ครบทุก BU รวมที่เป็น 0 (ทีมที่ยังไม่ใช้ต้องเห็น ห้ามหายเงียบ) */
export const AI_SHARE_BUS: readonly string[] = [...new Set(Object.values(SITE_BU_TO_DEPT))];

/** แถวที่ไม่รู้ BU — ห้ามยัดเข้า BU ไหน */
export const UNKNOWN_BU = 'ไม่ระบุ BU';

export type AiShareBucket = { key: string; label: string; from: string; to: string };

const DAY_LABEL = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayLabel = (ymd: string) => DAY_LABEL.format(new Date(`${ymd}T00:00:00Z`));

/** เกินนี้แท่งรายวันเบียดกันจนอ่านไม่ออก ⇒ รวมเป็นรายเดือน (เจ้าของ: *"ยอดใช้งานของแต่ละวัน แต่ละเดือน"*) */
export const DAILY_BUCKET_LIMIT = 62;

/**
 * ป้ายแกนล่าง (รอบ 17 · เจ้าของ: *"ไอพวก ก.ย. ไรพวกนี้ไม่ต้องมีก็ได้ แต่ให้บอกในกราฟว่าดูเดือนอะไร วันไหนถึงวันไหน"*)
 * รายวัน = เลขวันอย่างเดียว · รายเดือน = ชื่อเดือนย่อ (ปีต่อท้ายเฉพาะตอนช่วงคร่อมหลายปี) — เดือน/ช่วงวันไปอยู่หัวกราฟ (`rangeTextFull`)
 */
const dayTick = (ymd: string) => String(Number(ymd.slice(8, 10)));
const monthTick = (ymd: string, withYear: boolean) =>
  withYear
    ? `${TH_MONTH_SHORT[Number(ymd.slice(5, 7)) - 1]} ${String((Number(ymd.slice(0, 4)) + 543) % 100).padStart(2, '0')}`
    : TH_MONTH_SHORT[Number(ymd.slice(5, 7)) - 1];

/** ขนาดของแท่งในกราฟ — วัน · สัปดาห์ · เดือน · ปี (รอบ 18 เพิ่มสัปดาห์/ปี) */
export type AiShareGrain = 'day' | 'week' | 'month' | 'year';

/** คำของแต่ละขนาด — "ยอดใช้งานราย…" · "เฉลี่ย x สาย/…" */
export const AI_SHARE_GRAIN_LABEL: Record<AiShareGrain, string> = { day: 'วัน', week: 'สัปดาห์', month: 'เดือน', year: 'ปี' };

const clip = (lo: string, hi: string, from: string, to: string) => ({ from: lo < from ? from : lo, to: hi > to ? to : hi });

function dayBuckets(from: string, to: string): AiShareBucket[] {
  const out: AiShareBucket[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push({ key: d, label: dayTick(d), from: d, to: d });
  return out;
}

/** หนึ่งแท่งต่อสัปดาห์ (จันทร์–อาทิตย์ ตัดขอบให้อยู่ในช่วง) · ป้าย = เลขวันแรก–วันสุดท้าย */
function weekBuckets(from: string, to: string): AiShareBucket[] {
  const out: AiShareBucket[] = [];
  for (let m = mondayOf(from); m <= to; m = addDays(m, 7)) {
    const b = clip(m, addDays(m, 6), from, to);
    out.push({ key: m, label: `${dayTick(b.from)}–${dayTick(b.to)}`, ...b });
  }
  return out;
}

function monthBuckets(from: string, to: string): AiShareBucket[] {
  const out: AiShareBucket[] = [];
  const withYear = from.slice(0, 4) !== to.slice(0, 4);
  for (let m = monthOf(from); m.from <= to; m = monthOf(addDays(m.to, 1))) {
    out.push({ key: m.from, label: monthTick(m.from, withYear), ...clip(m.from, m.to, from, to) });
  }
  return out;
}

/** หนึ่งแท่งต่อปี · ป้าย = ปี พ.ศ. */
function yearBuckets(from: string, to: string): AiShareBucket[] {
  const out: AiShareBucket[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y += 1) {
    out.push({ key: `${y}-01-01`, label: String(y + 543), ...clip(`${y}-01-01`, `${y}-12-31`, from, to) });
  }
  return out;
}

/**
 * ช่วงย่อยของกราฟ — **หนึ่งแท่งต่อวันตลอดช่วงที่เลือก** (เจ้าของ: *"ดูรายเดือนต้องเห็นวันที่ 1-30 ·
 * รายสัปดาห์ก็เห็น 1-7"*) รวมวันที่ยังไม่ถึงด้วย (แท่งว่าง) · ทั้งหมด = เริ่มวันแรกที่มีข้อมูล
 * ช่วงยาวเกิน 62 วัน = หนึ่งแท่งต่อเดือน (ตัดขอบเดือนแรก/สุดท้ายให้อยู่ในช่วงจริง)
 * รอบ 18 (เลือกเทียบบนปฏิทิน): **เลือกหลายหน่วย = หนึ่งแท่งต่อหน่วย** (ยอดรวมทั้งหน่วย) — หลายเดือน = รายเดือน ·
 * หลายปี = รายปี · หลายสัปดาห์ = รายสัปดาห์ · ปีเดียว = รายเดือน · เดือน/สัปดาห์เดียว = รายวันเหมือนเดิม
 */
export function detailBuckets(
  win: AiShareWindow,
  rows: ReadonlyArray<{ day: string }>,
  today: string,
): { buckets: AiShareBucket[]; grain: AiShareGrain } {
  const firstData = rows.reduce<string | null>((m, r) => (!m || r.day < m ? r.day : m), null);
  const from = win.from ?? firstData ?? today;
  const to = win.to ?? today;
  if (to < from) return { buckets: [], grain: 'day' };
  const unit = win.unit ?? 'day';
  if (unit === 'year' && unitCount('year', from, to) >= 2) return { buckets: yearBuckets(from, to), grain: 'year' };
  if (unit === 'year' || (unit === 'month' && unitCount('month', from, to) >= 2)) {
    return { buckets: monthBuckets(from, to), grain: 'month' };
  }
  if (unit === 'week' && unitCount('week', from, to) >= 2) return { buckets: weekBuckets(from, to), grain: 'week' };
  if (daysBetween(from, to) + 1 <= DAILY_BUCKET_LIMIT) return { buckets: dayBuckets(from, to), grain: 'day' };
  return { buckets: monthBuckets(from, to), grain: 'month' };
}

/**
 * กดแท่งของหน่วยใหญ่ = ลงไปดูข้างใน (รอบ 18 · เจ้าของ: *"ถ้ากดเข้าไปก็แสดงเป็นกราฟแท่งวันของเดือนนั้น"*)
 * สัปดาห์/เดือน → รายวันของหน่วยนั้น · ปี → รายเดือนของปีนั้น · แท่งรายวัน = ไม่มีข้างใน (`null` · หน้าเปิดแผงเลื่อนแทน)
 */
export function drillWindow(b: AiShareBucket, grain: AiShareGrain): AiShareWindow | null {
  if (grain === 'day') return null;
  return { from: b.from, to: b.to, unit: grain === 'year' ? 'month' : 'day' };
}

/** แถวของช่วงย่อยเดียว (หรือทั้งช่วง) — ฐานของแผงเลื่อน "มาจาก BU ไหน" */
export function rowsInRange(rows: ReadonlyArray<AiShareDetailRow>, from: string, to: string): AiShareDetailRow[] {
  return rows.filter((r) => r.day >= from && r.day <= to);
}

/**
 * ยอดใช้งานต่อช่วงย่อย แยก 4 ก้อน (แท่งซ้อน AI โทร · คนโทร · ทั้งสองทาง · ยังไม่โทร) — ความสูงทั้งแท่ง = ยอดใช้งานของวันนั้น
 */
export function detailSegments(
  rows: ReadonlyArray<AiShareDetailRow>,
  buckets: ReadonlyArray<AiShareBucket>,
): Record<AiShareSegment, number[]> {
  const out: Record<AiShareSegment, number[]> = { ai: [], staff: [], both: [], notCalled: [] };
  for (const b of buckets) {
    const inB = rowsInRange(rows, b.from, b.to);
    for (const k of AI_SHARE_SEGMENTS) out[k].push(inB.reduce((s, r) => s + r[k], 0));
  }
  return out;
}

/** ยอดใช้งานรวมต่อช่วงย่อย (ความสูงทั้งแท่ง) = 4 ก้อนรวมกัน — ฐานของ "มากสุด" กับ "เฉลี่ย" */
export function segmentTotals(segments: Record<AiShareSegment, readonly number[]>, n: number): number[] {
  return Array.from({ length: n }, (_, i) => AI_SHARE_SEGMENTS.reduce((s, k) => s + (segments[k][i] ?? 0), 0));
}

/**
 * ชื่อช่วงย่อยแบบคนอ่าน — รายวัน "ศ. 25 ก.ย." (`long` = "วันศุกร์ 25 ก.ย." หัวแผงเลื่อน) · รายเดือน "กันยายน 2569"
 * เดือนแรก/สุดท้ายที่ถูกตัดขอบ = บอกช่วงวันจริง ไม่ให้อ่านว่าได้ทั้งเดือน
 * รอบ 18: รายสัปดาห์ = ช่วงวันจริง "14–20 ก.ย. 2569" (`long` นำหน้า "สัปดาห์") · รายปี "ปี 2569" (ตัดขอบ = ช่วงวันจริง)
 */
export function bucketText(b: AiShareBucket, grain: AiShareGrain, style: 'short' | 'long' = 'short'): string {
  const d = new Date(`${b.from}T00:00:00Z`);
  if (grain === 'year') {
    const y = d.getUTCFullYear();
    return b.from === `${y}-01-01` && b.to === `${y}-12-31` ? `ปี ${y + 543}` : rangeText(b.from, b.to);
  }
  if (grain === 'week') return style === 'long' ? `สัปดาห์ ${rangeText(b.from, b.to)}` : rangeText(b.from, b.to);
  if (grain === 'month') {
    const m = monthOf(b.from);
    return b.from === m.from && b.to === m.to ? `${TH_MONTH_FULL[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}` : rangeText(b.from, b.to);
  }
  const dow = d.getUTCDay();
  const wd = style === 'long' ? `วัน${TH_WEEKDAY_FULL[dow]}` : TH_WEEKDAY_SHORT[dow];
  return `${wd} ${dayLabel(b.from)}`;
}

const buKey = (bu: string | null) => (bu && bu.trim() ? bu : UNKNOWN_BU);

/**
 * ลำดับ BU ของตาราง/กราฟ — ชุดแผนกของบริษัทก่อน → รหัสอื่นที่มีงานจริง (ตามตัวอักษร) → ไม่รู้ BU ท้ายสุด
 * 🔴 SQL ส่งรหัสนอกชุดแผนกผ่านมาได้ (แผนกของคนคีย์ · `trendBuSql` ไม่ตัดทิ้ง) ⇒ ห้ามทิ้งเงียบ ๆ
 *    ไม่งั้นรวมทุก BU ไม่เท่ายอดของแท่ง/การ์ด
 */
function buOrder(withWork: ReadonlySet<string>, base: readonly string[] = AI_SHARE_BUS): string[] {
  const extras = [...withWork].filter((b) => b !== UNKNOWN_BU && !base.includes(b)).sort();
  return [...base, ...extras, ...(withWork.has(UNKNOWN_BU) && !base.includes(UNKNOWN_BU) ? [UNKNOWN_BU] : [])];
}

const buLabelOf = (bu: string) => (bu === UNKNOWN_BU ? UNKNOWN_BU : trendBuLabel(bu));

export type AiShareBuRow = AiShareCounts & { bu: string; label: string };

/** ตารางต่อ BU — ครบทุก BU (0 ก็ขึ้น) + รหัสอื่น/ไม่รู้ BU เมื่อมีจริง · แถวรวมเท่ากับยอดของการ์ดเสมอ */
export function detailTable(rows: ReadonlyArray<AiShareDetailRow>): { rows: AiShareBuRow[]; total: AiShareCounts } {
  const zero = (): AiShareCounts => ({ total: 0, ai: 0, staff: 0, both: 0, notCalled: 0 });
  const add = (a: AiShareCounts, r: AiShareCounts) => {
    a.total += r.total;
    a.ai += r.ai;
    a.staff += r.staff;
    a.both += r.both;
    a.notCalled += r.notCalled;
  };
  const by = new Map<string, AiShareCounts>();
  const total = zero();
  for (const r of rows) {
    const k = buKey(r.bu);
    const cur = by.get(k) ?? zero();
    add(cur, r);
    by.set(k, cur);
    add(total, r);
  }
  const withWork = new Set([...by].filter(([, c]) => c.total > 0).map(([bu]) => bu));
  return {
    rows: buOrder(withWork).map((bu) => ({ bu, label: buLabelOf(bu), ...(by.get(bu) ?? zero()) })),
    total,
  };
}

/**
 * แท่งซ้อนตาม BU (สวิตช์ "แยก BU" ของกราฟ · รอบ 7 · เจ้าของ: *"กด Switch เป็น BU ละเท่าไหร่"*)
 * รอบ 17 เจ้าของ: *"การ์ดแท่งฝั่ง BU ทำสีของทุก BU อธิบายรอไว้เลย"* ⇒ **ครบทุก BU ของ `base` เสมอ** (ไม่มีงานก็อยู่
 * ป้ายสีขึ้นรอไว้) + รหัสอื่น/ไม่รู้ BU เมื่อมีงานจริง · `base` = ชุดแผนกของบริษัท (ค่าตั้งต้น) — บัญชีที่ถูกล็อก BU
 * ส่ง BU ของตัวเองตัวเดียว (ไม่ขึ้น BU ที่ดูไม่ได้) · ลำดับเดียวกับตาราง · รวมทุก BU ต่อแท่ง = ยอดใช้งานของแท่งนั้น
 * (แถวชุดเดียวกับ `detailSegments`)
 */
export function detailBuSeries(
  rows: ReadonlyArray<AiShareDetailRow>,
  buckets: ReadonlyArray<AiShareBucket>,
  base: readonly string[] = AI_SHARE_BUS,
): Array<{ bu: string; label: string; values: number[] }> {
  const withWork = new Set(rows.filter((r) => r.total > 0).map((r) => buKey(r.bu)));
  return buOrder(withWork, base)
    .map((bu) => ({
      bu,
      label: buLabelOf(bu),
      values: buckets.map((b) =>
        rows.filter((r) => buKey(r.bu) === bu && r.day >= b.from && r.day <= b.to).reduce((s, r) => s + r.total, 0),
      ),
    }))
    .filter((x) => base.includes(x.bu) || x.values.some((v) => v > 0));
}

/**
 * แท่งที่สูงสุดของกราฟเปรียบเทียบในแผงเลื่อน (รอบ 13 · เจ้าของ: *"กราฟแท่งเปรียบเทียบเลยว่า AI คน ไม่โทร แท่งไหนสูงสุด
 * พอเป็นฝั่ง BU ก็บอกว่า BU ไหนเยอะสุด"*) — คืนทุกตัวที่เท่ากับค่ามากสุด (เท่ากันก็ติดป้ายทุกแท่ง ไม่เลือกให้เอง) ·
 * ทุกตัวเป็น 0 = ไม่มีแท่งสูงสุด
 */
export function topKeys(items: ReadonlyArray<{ key: string; value: number }>): string[] {
  const max = items.reduce((m, x) => Math.max(m, x.value), 0);
  return max > 0 ? items.filter((x) => x.value === max).map((x) => x.key) : [];
}

/**
 * แผงเลื่อน "ยอดใช้งานนี้มาจาก BU ไหน" — เฉพาะ BU ที่มีงาน เรียงมากไปน้อย (เท่ากันเรียงตามลำดับ BU เดิม) ·
 * BU ที่ยังไม่มีงานรวมเป็นบรรทัดเดียว (ห้ามหายเงียบ) · `total` = ยอดของแท่งนั้นเสมอ
 */
export function detailBreakdown(rows: ReadonlyArray<AiShareDetailRow>): {
  total: AiShareCounts;
  used: AiShareBuRow[];
  quiet: string[];
} {
  const t = detailTable(rows);
  const used = t.rows.filter((r) => r.total > 0);
  const order = new Map(t.rows.map((r, i) => [r.bu, i]));
  used.sort((a, b) => b.total - a.total || (order.get(a.bu) ?? 0) - (order.get(b.bu) ?? 0));
  const quiet = t.rows.filter((r) => r.total === 0 && r.bu !== UNKNOWN_BU).map((r) => r.bu);
  return { total: t.total, used, quiet };
}

/**
 * วันที่มากสุด (รอบ 4 · จากแบบอ้างอิง "Peak: Wed") — ค่าเท่ากันเลือกวันหลังสุด · ไม่มีงานเลย = null
 */
export function detailPeak(buckets: ReadonlyArray<AiShareBucket>, totals: readonly number[]): { bucket: AiShareBucket; value: number } | null {
  let best = -1;
  for (let i = 0; i < buckets.length; i += 1) if ((totals[i] ?? 0) > 0 && (best < 0 || totals[i] >= totals[best])) best = i;
  return best < 0 ? null : { bucket: buckets[best], value: totals[best] };
}

/**
 * เฉลี่ยต่อช่วงย่อย (รอบ 4 · จากแบบอ้างอิง "Avg") — หารด้วยช่วงย่อยที่ **ถึงแล้ว** (รวมวันที่เป็น 0)
 * วันที่ยังไม่ถึงไม่เอามาหาร ไม่งั้นค่าเฉลี่ยต่ำหลอกทุกครั้งที่ดูทั้งเดือน · ไม่มีช่วงที่ถึงแล้ว = null
 */
export function detailAverage(buckets: ReadonlyArray<AiShareBucket>, totals: readonly number[], today: string): number | null {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < buckets.length; i += 1) {
    if (buckets[i].from > today) continue;
    sum += totals[i] ?? 0;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}
