/**
 * ═══ "ติดตามครบ" → ย้ายไปดูแลหลังเริ่มงาน (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ติดตามนาย ก ตั้งแต่วันที่ 1-7 ติดตามครบเอาชื่อมากองไว้แล้วให้คนไปกดว่าจะย้าย
 * ไปติดตามหลังเริ่มงานไหม ถ้าติดตามจะให้ติดตามในอีกกี่วันข้างหน้า"*
 * Choice วันเดียวกัน: การ์ดแยกบนหน้า · ปุ่ม 3 / 7 / 30 + พิมพ์เอง · **เพิ่มรอบเองได้**
 * · แต่ละรอบตั้งได้ว่า AI โทรหรือคนโทร · กด "ไม่ย้าย" = เลือกผลปิดงาน 5 แบบ
 *
 * 🔴 5 ต.ค. 2569 (เจ้าของ): *"ติดตาม 5/ตค ดูแลหลังเริ่มงาน 3 ก็บวกไป พอเลือก 7 ก็บวกต่อจากของ 3
 * เป็นวันที่ 15"* + Choice "นับจากวันติดตามวันสุดท้าย" ⇒
 *   · วันฐาน = วันติดตามวันสุดท้ายของชุด (ไม่ใช่วันที่กดปุ่ม)
 *   · จำนวนวันของแต่ละรอบ = **บวกต่อจากรอบก่อนหน้า** (3 → 7 → 15 → 30 = 8 / 15 / 30 ต.ค. / 29 พ.ย.)
 *   · ปุ่มลัดเพิ่ม 15 · รอบที่ตกวันเวลาที่ผ่านมาแล้วกดไม่ได้ (บอกรอบไหน)
 * "ไม่ย้าย" มีทาง **ติดตามต่อ** อีก N วัน (Choice เดียวกัน) — `buildContinueCalls`
 *
 * ตรรกะล้วน — ไม่แตะ DB/เวลาจริง (หน้าจอส่ง `today` เข้ามาเอง ให้เทสต์ล็อกวันได้)
 * ⚠️ ใครอยู่ในกองนี้ ตัดสินที่ `followCompletion.ts` ที่เดียว ไฟล์นี้แค่ตั้งรอบ
 */
import { AFTERCARE_TOPIC } from '@/lib/aftercareRounds';
import type { FollowEntry } from '@/lib/followApi';
import { bangkokInputToIso } from '@/lib/followScheduleEdit';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { ScheduleCall } from '@/lib/followWizard';

export type MoveRoundMode = 'ai' | 'manual';

/** หนึ่งรอบบนฟอร์ม — เก็บเป็นข้อความตามช่อง (ช่องตัวเลขพิมพ์ค้างได้ระหว่างแก้) */
export type MoveRoundDraft = {
  /** อีกกี่วันนับต่อจากรอบก่อนหน้า (รอบแรก = นับจากวันติดตามวันสุดท้าย) */
  days: string;
  /** HH:MM เวลาไทย */
  time: string;
  mode: MoveRoundMode;
};

/**
 * ปุ่มลัดจำนวนวัน (บวกต่อกัน) — เจ้าของสั่ง 3 / 7 / 15 / 30 (5 ต.ค. 2569)
 * ⚠️ แยกจาก `AFTERCARE_PRESET_DAYS` (3/7/30 นับจากวันเริ่มงานของหน้าดูแลหลังเริ่มงาน) — คนละความหมาย
 */
export const MOVE_DAY_PRESETS: readonly number[] = [3, 7, 15, 30];
/** เวลาเริ่มต้นของรอบใหม่ — ค่าเดียวกับฟอร์มเพิ่มคนของหน้าติดตาม */
export const MOVE_DEFAULT_TIME = '07:00';
export const MOVE_MAX_DAYS = 365;
export const MOVE_MAX_ROUNDS = 10;

export const MOVE_MODE_LABEL: Record<MoveRoundMode, string> = {
  ai: 'AI โทร',
  manual: 'คนโทร',
};

/** กองนี้เป็นชุดถามความเป็นอยู่อยู่แล้วไหม — ปุ่มเปลี่ยนคำเป็น "ตามต่อ" (ย้ายซ้ำไม่มีความหมาย) */
export function isAftercareTopic(topic: string | null | undefined): boolean {
  return (topic ?? '').trim() === AFTERCARE_TOPIC;
}

export function firstMoveRound(): MoveRoundDraft {
  return { days: String(MOVE_DAY_PRESETS[0]), time: MOVE_DEFAULT_TIME, mode: 'ai' };
}

/**
 * รอบที่กด "เพิ่มรอบ" — ไล่ปุ่มลัดถัดจากรอบท้าย (3 → 7 → 15 → 30)
 * เลยปุ่มลัดแล้วบวกต่ออีก 30 วัน · เวลากับคนโทรตามรอบท้าย (คนส่วนใหญ่ตั้งเหมือนกันทุกรอบ)
 */
export function nextMoveRound(rounds: readonly MoveRoundDraft[]): MoveRoundDraft {
  const last = rounds[rounds.length - 1];
  if (!last) return firstMoveRound();
  const lastDays = parseMoveDays(last.days);
  if (lastDays === null) return { ...firstMoveRound(), time: last.time, mode: last.mode };
  const preset = MOVE_DAY_PRESETS.find((d) => d > lastDays);
  const days = preset ?? MOVE_DAY_PRESETS[MOVE_DAY_PRESETS.length - 1];
  return { days: String(days), time: last.time, mode: last.mode };
}

/** จำนวนวันที่ใช้ได้ (จำนวนเต็ม 1–365) · ใช้ไม่ได้ = null */
export function parseMoveDays(value: string): number | null {
  const t = value.trim();
  if (!/^\d{1,3}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= MOVE_MAX_DAYS ? n : null;
}

function isTime24(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  return Boolean(m) && Number(m?.[1]) <= 23 && Number(m?.[2]) <= 59;
}

/**
 * ผิดตรงไหน (ข้อความขึ้นบนจอ) · ถูกหมด = null
 * `baseYmd` = วันติดตามวันสุดท้าย · `now` = กันตั้งรอบในวันเวลาที่ผ่านมาแล้ว
 * (บวกต่อกัน ⇒ วันของรอบหลังมากกว่ารอบก่อนเสมอ ซ้ำกันไม่ได้อยู่แล้ว)
 */
export function validateMoveRounds(
  rounds: readonly MoveRoundDraft[],
  baseYmd: string,
  now: Date,
): string | null {
  if (rounds.length === 0) return 'ตั้งอย่างน้อย 1 รอบ';
  if (rounds.length > MOVE_MAX_ROUNDS) return `ตั้งได้ไม่เกิน ${MOVE_MAX_ROUNDS} รอบ`;
  let total = 0;
  for (let i = 0; i < rounds.length; i += 1) {
    const r = rounds[i];
    const days = parseMoveDays(r.days);
    if (days === null) return `รอบที่ ${i + 1}: ใส่จำนวนวัน 1–${MOVE_MAX_DAYS}`;
    if (!isTime24(r.time)) return `รอบที่ ${i + 1}: เวลาไม่ถูกต้อง`;
    total += days;
    if (total > MOVE_MAX_DAYS) return `รอบที่ ${i + 1}: รวมเกิน ${MOVE_MAX_DAYS} วัน`;
    const day = addDaysToYmd(baseYmd, total);
    const iso = bangkokInputToIso(`${day}T${r.time.trim()}`);
    if (!iso) return `รอบที่ ${i + 1}: เวลาไม่ถูกต้อง`;
    if (Date.parse(iso) <= now.getTime()) {
      return `รอบที่ ${i + 1}: ${formatYmdDmyBe(day)} ${r.time.trim()} ผ่านมาแล้ว`;
    }
  }
  return null;
}

/** 🔴 `Intl` ระดับโมดูลเท่านั้น (เคยสร้างในลูปแล้ว API ช้า 4.7 วิ) */
const BKK_YMD = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** วันที่ตามปฏิทินไทย (YYYY-MM-DD) — ห้ามใช้ toISOString ตรง ๆ (ก่อน 07:00 จะได้วันของเมื่อวาน) */
export function bangkokYmd(at: Date): string {
  return BKK_YMD.format(at);
}

export function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * วันที่ของทุกรอบ (YYYY-MM-DD เวลาไทย) — **บวกต่อกัน** จากวันฐาน
 * รอบที่จำนวนวันอ่านไม่ออก = null และรอบถัดจากนั้นก็ null (ไม่รู้ว่าต่อจากวันไหน)
 */
export function moveRoundDays(rounds: readonly MoveRoundDraft[], baseYmd: string): Array<string | null> {
  let total = 0;
  let broken = false;
  return rounds.map((r) => {
    const days = parseMoveDays(r.days);
    if (broken || days === null) {
      broken = true;
      return null;
    }
    total += days;
    return addDaysToYmd(baseYmd, total);
  });
}

/**
 * ฟอร์ม → รายการสาย (เรียงตามเวลา) ให้ส่งต่อด้วย `scheduleCallsByDay` เหมือนตารางหลายวัน
 *
 * ⚠️ เรียกหลัง `validateMoveRounds` ผ่านแล้วเท่านั้น — รอบที่อ่านไม่ออกจะถูกข้าม
 * `callRound` นับใหม่ 1..n ของชุดนี้ (ชุดถามความเป็นอยู่เป็นชุดใหม่ ไม่ต่อเลขจากชุดเดิม)
 */
export function buildMoveCalls(
  rounds: readonly MoveRoundDraft[],
  baseYmd: string,
  staffPhone: string,
): ScheduleCall[] {
  const calls: Omit<ScheduleCall, 'callRound'>[] = [];
  const days = moveRoundDays(rounds, baseYmd);
  for (let i = 0; i < rounds.length; i += 1) {
    const r = rounds[i];
    const day = days[i];
    if (!day || !isTime24(r.time)) continue;
    const time = r.time.trim();
    const scheduledAt = bangkokInputToIso(`${day}T${time}`);
    if (!scheduledAt) continue;
    calls.push({ day, time, scheduledAt, callMode: r.mode, staffPhone });
  }
  calls.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  return calls.map((c, i) => ({ ...c, callRound: i + 1 }));
}

/** รอบที่ยังเปิดอยู่ (ไม่ยกเลิก · ยังไม่ปิดงาน) — กด "ย้าย"/"ไม่ย้าย" แล้วต้องปิดให้ครบชุดนี้ */
export function openFollowRounds<T extends Pick<FollowEntry, 'cancelled' | 'completed_at'>>(
  rounds: readonly T[],
): T[] {
  return rounds.filter((r) => !r.cancelled && !r.completed_at);
}

/** วันติดตามวันสุดท้ายของชุด (สายที่ไม่ยกเลิก) — ไม่มีสายที่มีเวลาเลย = วันนี้ */
export function lastFollowYmd(
  rounds: readonly Pick<FollowEntry, 'cancelled' | 'scheduled_at'>[],
  today: Date,
): string {
  let last: string | null = null;
  for (const r of rounds) {
    if (r.cancelled || !r.scheduled_at) continue;
    const t = new Date(r.scheduled_at);
    if (Number.isNaN(t.getTime())) continue;
    const ymd = bangkokYmd(t);
    if (!last || ymd > last) last = ymd;
  }
  return last ?? bangkokYmd(today);
}

/* ═══ "ไม่ย้าย" → ติดตามต่อ (เจ้าของ 5 ต.ค. 2569: *"ไม่ย้ายเพราะอะไร จะติดตามต่อหรอ ถ้าติดตามต่อติดตามต่ออีกกี่วัน"*) ═══ */

/** ปุ่มลัด "ติดตามต่ออีกกี่วัน" */
export const CONTINUE_DAY_PRESETS: readonly number[] = [1, 3, 7];
export const CONTINUE_MAX_DAYS = 30;

export type ContinueDraft = { days: string; time: string; mode: MoveRoundMode };

export function firstContinueDraft(): ContinueDraft {
  return { days: String(CONTINUE_DAY_PRESETS[0]), time: MOVE_DEFAULT_TIME, mode: 'ai' };
}

/** จำนวนวันติดตามต่อ 1–30 · ใช้ไม่ได้ = null */
export function parseContinueDays(value: string): number | null {
  const t = value.trim();
  if (!/^\d{1,2}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= CONTINUE_MAX_DAYS ? n : null;
}

/**
 * วันฐานของ "ย้ายไปดูแลหลังเริ่มงาน" = วันติดตามวันสุดท้าย **แต่ไม่ย้อนหลังวันนี้**
 * (QA 5 ต.ค. 2569: ติดตามวันสุดท้าย 23/9 + 3 = 26/9 ซึ่งผ่านมาแล้ว ⇒ กดยืนยันขึ้น "ผ่านมาแล้ว" ทุกคน ต้องแก้วันเองทุกครั้ง)
 * ชุดที่ยังไม่ถึงวันสุดท้าย ⇒ บวกจากวันสุดท้ายตามที่เจ้าของสั่ง (5 ต.ค. 2569) เหมือนเดิม
 */
export function moveBaseYmd(lastYmd: string, today: Date): string {
  const t = bangkokYmd(today);
  return lastYmd > t ? lastYmd : t;
}

/**
 * วันแรกของการติดตามต่อ = วันถัดจากวันติดตามวันสุดท้าย — แต่ไม่ก่อนพรุ่งนี้
 * (กองไว้หลายวันแล้วค่อยกด ห้ามตั้งสายย้อนหลัง · วันนี้เวลาอาจเลยไปแล้วจึงเริ่มพรุ่งนี้)
 */
export function continueStartYmd(lastYmd: string, today: Date): string {
  const next = addDaysToYmd(lastYmd, 1);
  const tomorrow = addDaysToYmd(bangkokYmd(today), 1);
  return next > tomorrow ? next : tomorrow;
}

export function validateContinue(d: ContinueDraft): string | null {
  if (parseContinueDays(d.days) === null) return `ใส่จำนวนวัน 1–${CONTINUE_MAX_DAYS}`;
  if (!isTime24(d.time)) return 'เวลาไม่ถูกต้อง';
  return null;
}

/**
 * ติดตามต่อ N วัน = วันละ 1 สาย ติดกัน N วัน เริ่ม `startYmd`
 * `callRound` นับต่อจากสายสูงสุดของชุดเดิม (สายที่ 2 ขึ้นไป = บทรอบถัดไป ไม่ใช่บทสายแรก)
 * ⚠️ เรียกหลัง `validateContinue` ผ่านแล้วเท่านั้น
 */
export function buildContinueCalls(
  d: ContinueDraft,
  startYmd: string,
  staffPhone: string,
  lastCallRound: number,
): ScheduleCall[] {
  const n = parseContinueDays(d.days);
  if (n === null || !isTime24(d.time)) return [];
  const time = d.time.trim();
  const out: ScheduleCall[] = [];
  for (let i = 0; i < n; i += 1) {
    const day = addDaysToYmd(startYmd, i);
    const scheduledAt = bangkokInputToIso(`${day}T${time}`);
    if (!scheduledAt) continue;
    out.push({ day, time, scheduledAt, callMode: d.mode, staffPhone, callRound: lastCallRound + out.length + 1 });
  }
  return out;
}
