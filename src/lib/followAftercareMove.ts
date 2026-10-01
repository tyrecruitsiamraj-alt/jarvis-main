/**
 * ═══ "ติดตามครบ" → ย้ายไปดูแลหลังเริ่มงาน (เจ้าของสั่ง 1 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"ติดตามนาย ก ตั้งแต่วันที่ 1-7 ติดตามครบเอาชื่อมากองไว้แล้วให้คนไปกดว่าจะย้าย
 * ไปติดตามหลังเริ่มงานไหม ถ้าติดตามจะให้ติดตามในอีกกี่วันข้างหน้า"*
 * Choice วันเดียวกัน: การ์ดแยกบนหน้า · ปุ่ม 3 / 7 / 30 + พิมพ์เอง · **เพิ่มรอบเองได้**
 * · แต่ละรอบตั้งได้ว่า AI โทรหรือคนโทร · กด "ไม่ย้าย" = เลือกผลปิดงาน 5 แบบ
 *
 * ตรรกะล้วน — ไม่แตะ DB/เวลาจริง (หน้าจอส่ง `today` เข้ามาเอง ให้เทสต์ล็อกวันได้)
 * ⚠️ ใครอยู่ในกองนี้ ตัดสินที่ `followCompletion.ts` ที่เดียว ไฟล์นี้แค่ตั้งรอบ
 */
import { AFTERCARE_PRESET_DAYS, AFTERCARE_TOPIC } from '@/lib/aftercareRounds';
import type { FollowEntry } from '@/lib/followApi';
import { bangkokInputToIso } from '@/lib/followScheduleEdit';
import type { ScheduleCall } from '@/lib/followWizard';

export type MoveRoundMode = 'ai' | 'manual';

/** หนึ่งรอบบนฟอร์ม — เก็บเป็นข้อความตามช่อง (ช่องตัวเลขพิมพ์ค้างได้ระหว่างแก้) */
export type MoveRoundDraft = {
  /** อีกกี่วันนับจากวันนี้ (วันตามปฏิทินไทย) */
  days: string;
  /** HH:MM เวลาไทย */
  time: string;
  mode: MoveRoundMode;
};

/** ปุ่มลัดจำนวนวัน — ชุดเดียวกับรอบโทรของหน้าดูแลหลังเริ่มงาน (ห้ามตั้งชุดใหม่) */
export const MOVE_DAY_PRESETS: readonly number[] = AFTERCARE_PRESET_DAYS;
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
 * รอบที่กด "เพิ่มรอบ" — ไล่ปุ่มลัดถัดจากรอบท้าย (3 → 7 → 30)
 * เลยปุ่มลัดแล้วบวกอีก 30 วันจากรอบท้าย · เวลากับคนโทรตามรอบท้าย (คนส่วนใหญ่ตั้งเหมือนกันทุกรอบ)
 */
export function nextMoveRound(rounds: readonly MoveRoundDraft[]): MoveRoundDraft {
  const last = rounds[rounds.length - 1];
  if (!last) return firstMoveRound();
  const lastDays = parseMoveDays(last.days);
  if (lastDays === null) return { ...firstMoveRound(), time: last.time, mode: last.mode };
  const preset = MOVE_DAY_PRESETS.find((d) => d > lastDays);
  const days = preset ?? Math.min(lastDays + 30, MOVE_MAX_DAYS);
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

/** ผิดตรงไหน (ข้อความขึ้นบนจอ) · ถูกหมด = null */
export function validateMoveRounds(rounds: readonly MoveRoundDraft[]): string | null {
  if (rounds.length === 0) return 'ตั้งอย่างน้อย 1 รอบ';
  if (rounds.length > MOVE_MAX_ROUNDS) return `ตั้งได้ไม่เกิน ${MOVE_MAX_ROUNDS} รอบ`;
  const seen = new Set<string>();
  for (let i = 0; i < rounds.length; i += 1) {
    const r = rounds[i];
    const days = parseMoveDays(r.days);
    if (days === null) return `รอบที่ ${i + 1}: ใส่จำนวนวัน 1–${MOVE_MAX_DAYS}`;
    if (!isTime24(r.time)) return `รอบที่ ${i + 1}: เวลาไม่ถูกต้อง`;
    const key = `${days}|${r.time.trim()}`;
    if (seen.has(key)) return `รอบที่ ${i + 1}: ซ้ำกับรอบก่อนหน้า`;
    seen.add(key);
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

/** วันที่ของรอบนี้ (YYYY-MM-DD เวลาไทย) · จำนวนวันใช้ไม่ได้ = null */
export function moveRoundDay(round: MoveRoundDraft, today: Date): string | null {
  const days = parseMoveDays(round.days);
  return days === null ? null : addDaysToYmd(bangkokYmd(today), days);
}

/**
 * ฟอร์ม → รายการสาย (เรียงตามเวลา) ให้ส่งต่อด้วย `scheduleCallsByDay` เหมือนตารางหลายวัน
 *
 * ⚠️ เรียกหลัง `validateMoveRounds` ผ่านแล้วเท่านั้น — รอบที่อ่านไม่ออกจะถูกข้าม
 * `callRound` นับใหม่ 1..n ของชุดนี้ (ชุดถามความเป็นอยู่เป็นชุดใหม่ ไม่ต่อเลขจากชุดเดิม)
 */
export function buildMoveCalls(
  rounds: readonly MoveRoundDraft[],
  today: Date,
  staffPhone: string,
): ScheduleCall[] {
  const calls: Omit<ScheduleCall, 'callRound'>[] = [];
  for (const r of rounds) {
    const day = moveRoundDay(r, today);
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
