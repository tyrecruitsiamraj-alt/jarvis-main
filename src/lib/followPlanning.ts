import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';
import { CALL_OUTCOME_TONE, followCallOutcomeText } from '@/lib/callOutcomeTone';
import { followDispatchLabel } from '@/lib/followDispatchState';
import { followRoundSlot } from '@/lib/followRoundBuckets';
import type { ToneKey } from '@/lib/designTokens';
import {
  FOLLOW_OUTCOME_LABEL,
  isLostOutcome,
  isSuccessOutcome,
  type FollowOutcomeAny,
} from '@/lib/followOutcome';

/**
 * ═══ ตาราง Planning ของหน้าติดตาม (F3 · เจ้าของสั่ง 1 ก.ย. 2569) ═══
 *
 * > *"เป็นเหมือน Planning เพื่อบอกว่ามีใครบ้าง และติดตามวันไหนบ้าง
 * >  และใน Planning ก็มีบอกว่าติดตามกี่รอบด้วย และเวลาไหนบ้าง"*
 *
 * หนึ่งแถว = หนึ่งคน (ชุดเดียวกับ `groupFollowEntries` — **ห้ามจัดกลุ่มใหม่ที่นี่**)
 * แถวบอก: ติดตามวันไหนบ้าง · กี่รอบ · เวลาไหน · **รอบนั้นไปถึงไหนแล้ว**
 *
 * 🔴 **สภาพของรอบต้องต่อสองที่** (แผน F3): เวลานัดอยู่ที่ `scheduled_at`
 * ส่วนความคืบหน้าอยู่ในคิวโทร (`call_status` / `call_outcome`) และการปิดงานของ
 * เจ้าหน้าที่ (`completed_at`) — เดาจากอันเดียวแล้วจอโกหกทันที
 * (เคยเกิด: `call_status` ค้าง `pending` ทั้งที่ผลกลับมาแล้ว 8 แถว วัด 26 ส.ค. 2569)
 *
 * 🔴 **ผลชนะสถานะเสมอ** — บทเรียนเดียวกับ `_lib/lumosQueueDefs`
 */

export type FollowRoundState =
  /** ยกเลิกรอบนี้ทิ้ง — ไม่ต้องโทรแล้ว */
  | 'cancelled'
  /** เจ้าหน้าที่ปิดงานเองแล้ว (ตามจนจบ) — คนละเรื่องกับยกเลิก */
  | 'closed'
  /** ได้ผลการโทรกลับมาแล้ว */
  | 'result'
  /** เลยเวลานัดแล้วยังไม่มีผลกลับ — มีคนรอสายอยู่จริง */
  | 'overdue'
  /**
   * **ไม่เคยถูกส่งให้ AI เลย** — เบอร์อยู่ในบัญชีห้ามโทร / มีคนจองโทรเอง /
   * ตรวจไม่ได้ / ไม่มีเบอร์ / ปิดส่งอัตโนมัติ
   *
   * 🔴 แยกจาก `overdue` เพราะ **ไม่มีสายไหนกำลังจะเกิดขึ้น** — เขียนว่า "ยังไม่มีผล"
   * เฉย ๆ คือหลอกให้รอ (เจ้าของถามเอง 1 ก.ย. 2569: *"แล้วทำไมไม่มีผล"*)
   */
  | 'notSent'
  /** ส่งเข้าคิว AI แล้ว ยังไม่ถึงเวลา/ยังไม่มีผล */
  | 'sent'
  /** ยังไม่ถึงเวลา และไม่เคยเข้าคิว AI เลย */
  | 'waiting';

export const FOLLOW_ROUND_STATE_LABEL: Record<FollowRoundState, string> = {
  cancelled: 'ยกเลิกแล้ว',
  closed: 'ปิดงานแล้ว',
  result: 'ได้ผลแล้ว',
  overdue: 'เลยเวลานัด',
  notSent: 'ไม่ได้ส่งให้ AI',
  sent: 'ส่งแล้วรอผล',
  waiting: 'ยังไม่ถึงเวลา',
};

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * สภาพของรอบหนึ่งรอบ — เรียงลำดับความชนะจากบนลงล่าง
 * (ยกเลิก > ปิดงาน > มีผล > เลยเวลา > ส่งแล้ว > ยังไม่ถึงเวลา)
 */
export function followRoundState(entry: FollowEntry, now: Date = new Date()): FollowRoundState {
  if (entry.cancelled) return 'cancelled';
  if (entry.completed_at) return 'closed';
  if (entry.call_outcome) return 'result';
  /**
   * 🔴 ไม่เคยเข้าคิวเลย = **ไม่ได้ส่ง** ไม่ใช่ "เลยเวลา/รอโทร"
   * (`call_status` เป็น null เมื่อไม่มีแถวในคิว — เหตุผลอยู่ที่ `dispatch_state`)
   */
  if (!entry.call_status) return 'notSent';
  const at = ms(entry.scheduled_at);
  // ไม่มีเวลานัดที่อ่านได้ = ยังไม่ถึงคิวใคร — ห้ามเดาว่าเลยเวลา
  if (at !== null && at < now.getTime()) return 'overdue';
  return 'sent';
}

/** รอบนี้ยัง "ต้องทำอะไรต่อ" อยู่ไหม — ใช้เรียงว่าใครต้องโทรก่อน */
export function isRoundOpen(state: FollowRoundState): boolean {
  return state === 'overdue' || state === 'sent' || state === 'waiting' || state === 'notSent';
}

export type FollowPlanningRound = {
  entry: FollowEntry;
  state: FollowRoundState;
  /** เวลานัดรูปแบบ HH:MM ตามเวลาไทย — `null` = ไม่ได้ตั้งเวลา */
  time: string | null;
  /** วันของนัด (YYYY-MM-DD ตามเวลาไทย) — `null` = ไม่ได้ตั้งเวลา */
  ymd: string | null;
};

export type FollowPlanningRow = {
  group: FollowGroup;
  rounds: FollowPlanningRound[];
  /** วันที่ต้องติดตาม (YYYY-MM-DD) เรียงจากเก่าไปใหม่ · ไม่ซ้ำ · ไม่รวมรอบที่ยกเลิก */
  days: string[];
  /** จำนวนรอบที่ยังไม่ยกเลิก */
  roundCount: number;
  /** จำนวนรอบที่ยังต้องตามต่อ */
  openCount: number;
  /**
   * เวลานัดของรอบที่ต้องทำถัดไป (ms) — `null` = ไม่เหลือรอบที่ต้องทำแล้ว
   * เลยเวลาแล้วก็ยังนับ ⇒ ของค้างลอยขึ้นบนสุดเอง (เวลาน้อยกว่า = อยู่บน)
   */
  dueAtMs: number | null;
};

const bangkokYmd = (iso: string): string | null => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
};

const bangkokTime = (iso: string): string | null => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * แปลงกลุ่ม (การ์ดเดิม) เป็นแถวของตาราง Planning
 *
 * เรียง: **คนที่ต้องโทรก่อนอยู่บนสุด** (นัดที่ใกล้ที่สุดของรอบที่ยังไม่จบ)
 * คนที่ไม่เหลือรอบต้องทำแล้วไปอยู่ท้ายสุด เรียงตามรายการที่ลงล่าสุดเหมือนเดิม
 */
export function buildFollowPlanningRows(
  groups: readonly FollowGroup[],
  now: Date = new Date(),
): FollowPlanningRow[] {
  const rows: FollowPlanningRow[] = groups.map((group) => {
    const rounds: FollowPlanningRound[] = group.rounds.map((entry) => ({
      entry,
      state: followRoundState(entry, now),
      time: entry.scheduled_at ? bangkokTime(entry.scheduled_at) : null,
      ymd: entry.scheduled_at ? bangkokYmd(entry.scheduled_at) : null,
    }));

    const days: string[] = [];
    for (const r of rounds) {
      if (r.state === 'cancelled' || !r.ymd) continue;
      if (!days.includes(r.ymd)) days.push(r.ymd);
    }
    days.sort();

    const open = rounds.filter((r) => isRoundOpen(r.state));
    const dueTimes = open
      .map((r) => ms(r.entry.scheduled_at))
      .filter((t): t is number => t !== null);

    return {
      group,
      rounds,
      days,
      roundCount: rounds.filter((r) => r.state !== 'cancelled').length,
      openCount: open.length,
      dueAtMs: dueTimes.length ? Math.min(...dueTimes) : null,
    };
  });

  const createdMs = (row: FollowPlanningRow): number => ms(row.group.latestCreatedAt) ?? 0;
  return rows.sort((a, b) => {
    if (a.dueAtMs !== null && b.dueAtMs !== null) return a.dueAtMs - b.dueAtMs;
    if (a.dueAtMs !== null) return -1;
    if (b.dueAtMs !== null) return 1;
    return createdMs(b) - createdMs(a);
  });
}

/**
 * วันทั้งหมดของเดือน (YYYY-MM-DD) + เลขวัน + ตัวย่อวันไทย + ธงวันอาทิตย์
 * — คอลัมน์ของตาราง Planning ที่ชื่อคนอยู่ซ้าย (เจ้าของสั่ง 1 ก.ย. 2569:
 * *"ตรงปฏิทินเอาชื่อคนไปไว้ด้านซ้ายสิ"*)
 * ⚠️ คำนวณด้วย UTC ล้วน — ไม่เกี่ยวกับเขตเวลาเครื่องผู้ใช้ (คีย์วันเป็นสตริงอยู่แล้ว)
 */
export function monthDayColumns(
  month: string,
): Array<{ ymd: string; day: number; weekday: string; isSunday: boolean }> {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return [];
  const WEEKDAYS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const out: Array<{ ymd: string; day: number; weekday: string; isSunday: boolean }> = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    out.push({
      ymd: `${month}-${String(d).padStart(2, '0')}`,
      day: d,
      weekday: WEEKDAYS[dow],
      isSunday: dow === 0,
    });
  }
  return out;
}

/**
 * แถวของตาราง Planning แบบชื่ออยู่ซ้าย — เฉพาะคนที่มีนัดในเดือนนั้น
 * คีย์ของ `byDay` เป็น YYYY-MM-DD · เรียงรอบในวันตามเวลา
 */
export type FollowMonthRow = {
  row: FollowPlanningRow;
  byDay: Map<string, FollowPlanningRound[]>;
};

/**
 * 🔴 **รอบที่ยกเลิกต้องอยู่ในตารางด้วย** (เจ้าของทัก 1 ก.ย. 2569:
 * *"ทำไมขึ้นว่าเสร็จสิ้น เพราะในระบบ Lumos บอกยกเลิก งี้จะเชื่อนายได้ไง"*)
 *
 * เดิมกรองรอบที่ยกเลิกออกจากปฏิทินด้วยเหตุผลว่า "ไม่ใช่งานของวันนั้นแล้ว" — ผลคือ
 * สายที่ Lumos โชว์ว่า **ยกเลิก** หายไปจากจอเราเงียบ ๆ ⇒ สองระบบเล่าไม่ตรงกัน
 * แล้วคนเลิกเชื่อทั้งจอ · ของที่เกิดขึ้นจริงต้องเห็นได้ ต่อให้จบไปแล้ว (โชว์จาง ๆ + ป้ายกำกับ)
 */
export function buildFollowMonthRows(
  rows: readonly FollowPlanningRow[],
  month: string,
): FollowMonthRow[] {
  const out: FollowMonthRow[] = [];
  for (const row of rows) {
    const byDay = new Map<string, FollowPlanningRound[]>();
    for (const round of row.rounds) {
      if (!round.ymd) continue;
      if (round.ymd.slice(0, 7) !== month) continue;
      const list = byDay.get(round.ymd);
      if (list) list.push(round);
      else byDay.set(round.ymd, [round]);
    }
    if (byDay.size === 0) continue; // ไม่มีนัดในเดือนนี้ = ไม่ต้องมีแถว
    for (const list of byDay.values()) list.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    out.push({ row, byDay });
  }
  return out;
}

/**
 * **คำสั้นบอกว่า "รอบนี้ผลเป็นยังไง"** — สำหรับโชว์ใต้เวลาในช่องปฏิทิน
 *
 * เจ้าของทัก 1 ก.ย. 2569: *"แล้วทำไมไม่มีบอกผลด้วยเลยอะว่าผลเป็นยังไง"* —
 * ช่องปฏิทินเดิมมีแต่เวลากับสี ⇒ ต้องกดเข้าไปดูถึงจะรู้ว่าคุยจบยังไง
 *
 * 🔴 **อ่านจากตารางคำแปลกลาง ไม่ประดิษฐ์คำเอง** (`CALL_OUTCOME_LABEL` /
 * `FOLLOW_OUTCOME_LABEL`) · รหัสที่ไม่มีคำแปลให้คืนรหัสไปตามตรง ห้ามซ่อน
 * ⚠️ ลำดับต้องตรงกับ `followRoundState` — ไม่งั้นสีกับคำบนชิปเดียวกันจะขัดกันเอง
 */
export function roundResultLabel(round: FollowPlanningRound): string {
  const e = round.entry;
  switch (round.state) {
    case 'cancelled':
      return 'ยกเลิก';
    case 'closed':
      return e.outcome_code
        ? (FOLLOW_OUTCOME_LABEL[e.outcome_code as FollowOutcomeAny] ?? e.outcome_code)
        : 'ปิดงาน';
    case 'result':
      return e.call_outcome ? followCallOutcomeText(e.call_outcome) : 'มีผลแล้ว';
    case 'notSent':
      // 🔴 ไม่มีสายไหนกำลังจะเกิด — บอกให้รู้ตัว ไม่ใช่ปล่อยให้นั่งรอผลที่ไม่มีวันมา
      return 'ไม่ได้ส่ง';
    case 'overdue':
      // เลยเวลาแล้วยังไม่มีผล — ต้องบอกว่า "ยังไม่มีผล" ไม่ใช่ปล่อยว่างให้เดา
      return 'ยังไม่มีผล';
    case 'sent':
      return 'รอผล';
    default:
      return 'รอถึงเวลา';
  }
}

/**
 * **สีของรอบ — ตัดสินจาก "ผลเป็นยังไง" ไม่ใช่ "มีผลหรือยัง"**
 *
 * 🔴 เจ้าของทัก 1 ก.ย. 2569: *"ไม่ไปแล้วแต่เป็นเขียวเนี่ยนะ · ไม่มีผลเป็นสีแดงเพราะอะไร"*
 * ของเดิมทาสีตาม **สภาพ** (มีผลแล้ว = เขียว · เลยเวลา = แดง) ⇒ คนที่บอกว่า
 * "ไม่ไปแล้ว" กลายเป็นเขียวเพราะ "ได้ผลแล้ว" ส่วนสายที่แค่ยังไม่ถึงคิวกลายเป็นแดง
 * **สีต้องแปลว่าเรื่องดีหรือเรื่องร้าย ไม่ใช่แปลว่าข้อมูลมาถึงหรือยัง**
 *
 * เขียว = จบดี · แดง = จบไม่ดี · เหลือง = ยังไม่จบ ต้องตามต่อ ·
 * ส้ม = ไม่ได้ส่ง ต้องคนจัดการ · น้ำเงิน = สายกำลังเดิน · เทา = ยังไม่ถึงเวลา/ทิ้งแล้ว
 *
 * ⚠️ ผลการโทรใช้ `CALL_OUTCOME_TONE` ตัวกลาง — สีเดียวกันต้องแปลว่าเรื่องเดียวกันทุกหน้า
 */
export function roundTone(round: FollowPlanningRound): ToneKey {
  const e = round.entry;
  switch (round.state) {
    case 'cancelled':
      return 'neutral';
    case 'closed':
      if (isSuccessOutcome(e.outcome_code)) return 'success';
      if (isLostOutcome(e.outcome_code)) return 'danger';
      return 'warn'; // ลา/เลื่อน — ยังไม่จบจริง
    case 'result':
      return CALL_OUTCOME_TONE[(e.call_outcome ?? '') as keyof typeof CALL_OUTCOME_TONE] ?? 'warn';
    case 'notSent':
      return 'orange';
    case 'overdue':
      return 'warn';
    case 'sent':
      return 'primary';
    default:
      return 'neutral';
  }
}

/** เหตุผลเต็มว่าทำไมไม่ได้ส่ง — ช่องในปฏิทินแคบ เก็บคำเต็มไว้ที่ tooltip/ป๊อป */
export function roundDispatchReason(round: FollowPlanningRound): string {
  return followDispatchLabel({
    state: round.entry.dispatch_state,
    callStatus: round.entry.call_status,
  }).label;
}

/**
 * **กรองให้เหลือเฉพาะ "การโทรครั้งที่ N"** — ทั้งแถวและช่อง
 *
 * 🔴 เจ้าของทัก 1 ก.ย. 2569: *"ถ้าเลือกการโทรครั้งที่เท่าไหร่ ก็โชว์ข้อมูลของ
 * การโทรรอบนั้น ๆ พอสิ"* — รอบก่อนกรองแค่ **แถว** (ใครอยู่รอบนั้น) แต่ช่องยังโชว์
 * ทุกสายของคนนั้น ⇒ เลือกครั้งที่ 1 แล้วยังเห็นสายของครั้งที่ 2 ปนอยู่
 *
 * ตัวเลข `days`/`roundCount`/`openCount`/`dueAtMs` ถูก **คิดใหม่จากสายที่เหลือ**
 * ไม่ใช่ยกของเดิมมา ไม่งั้นหัวแถวจะบอกจำนวนรอบที่มองไม่เห็นในตาราง
 */
export function filterPlanningRowsByRound(
  rows: readonly FollowPlanningRow[],
  slot: number,
): FollowPlanningRow[] {
  const out: FollowPlanningRow[] = [];
  for (const row of rows) {
    const rounds = row.rounds.filter((r) => followRoundSlot(r.entry) === slot);
    if (rounds.length === 0) continue;

    const days: string[] = [];
    for (const r of rounds) {
      if (r.state === 'cancelled' || !r.ymd) continue;
      if (!days.includes(r.ymd)) days.push(r.ymd);
    }
    days.sort();

    const open = rounds.filter((r) => isRoundOpen(r.state));
    const dueTimes = open
      .map((r) => (r.entry.scheduled_at ? new Date(r.entry.scheduled_at).getTime() : Number.NaN))
      .filter((t) => Number.isFinite(t));

    out.push({
      ...row,
      rounds,
      days,
      roundCount: rounds.filter((r) => r.state !== 'cancelled').length,
      openCount: open.length,
      dueAtMs: dueTimes.length ? Math.min(...dueTimes) : null,
    });
  }
  return out;
}

/**
 * 🗑️ `firstCallOfRow()` ถูกลบ 7 ก.ย. 2569 — ตารางเลิกโชว์เฉพาะ "สายแรก" แล้ว
 * เจ้าของสั่งให้โชว์ผล **ทุกสาย** (*"ถ้าเพิ่มไว้ 2 สาย ช่วยเอาผลมาทั้ง 2 สาย"*)
 * คอลัมน์จึงวนจาก `row.rounds` ตรง ๆ ซึ่งเรียงตามเวลานัดมาแล้วจากชั้นจัดกลุ่ม
 * (ของเดิมอยู่ในประวัติ git ถ้าต้องการ "สายแรก" กลับมา)
 */

/** สายนี้จบด้วยดีแล้วหรือยัง — ใช้ติดเครื่องหมายถูกสีเขียว */
export function isGoodResult(round: FollowPlanningRound): boolean {
  return roundTone(round) === 'success';
}

/**
 * **สรุปบทสนทนาที่ AI เขียนกลับมา** — `null` = ยังไม่มี (ห้ามเดา ห้ามแต่งแทน)
 *
 * 🔴 เจ้าของสั่ง 7 ก.ย. 2569: *"เวลาได้ผลจาก Lumos ถ้าตกลงไปให้ขึ้นสีเขียว
 * และบอกว่าเขาตอบว่าอะไร ... และเอาสรุปผลโดย AI มาด้วย"*
 * เดิมค่านี้มาถึงหน้าจอแล้ว (`call_summary` จาก `result->>'summary'`) แต่ถูกใช้
 * เฉพาะในป๊อป ⇒ ต้องกดเข้าไปอ่านทีละคน · ตารางจึงต้องโชว์ให้เห็นเลย
 *
 * ⚠️ ค่าว่าง/ช่องว่างล้วน = ถือว่าไม่มี — จอจะได้ไม่ขึ้นกล่องเปล่าให้เข้าใจผิดว่า AI เงียบ
 */
export function roundAiSummary(round: FollowPlanningRound): string | null {
  const s = (round.entry.call_summary ?? '').trim();
  return s === '' ? null : s;
}

/**
 * ═══ ปฏิทินติดตามสองหน้า (เจ้าของสั่ง 7 ก.ย. 2569 · ฉบับที่ 2 หลังย้อนฉบับแรกออก) ═══
 *
 * > *"หน้าแรก: บอกว่ามีกี่สายที่ต้องตาม · แยกผลของทุกสายตาม Filter · สายแรกจบเอาผลมาบอก
 * >  สีต้องบอกได้ว่า เขียวคือตกลง เหลืองติดต่อไม่ได้ แดงคือไม่ไป · บอกด้วยว่าเขาตอบว่ายังไง
 * >  · เลือกวันได้จากปฏิทิน"*
 * > *"หน้าสอง: ภาพรวมทั้งเดือน นาย ก ข ค ทั้งเดือนติดตามกี่ครั้ง วันไหนไป วันไหนไม่ไป
 * >  วันไหนติดต่อไม่ได้"*
 *
 * ทั้งสองหน้าใช้ **หมวดผล** ชุดเดียวกันข้างล่างนี้ — เลขหน้าแรกกับสีหน้าสองจึงเล่าเรื่องเดียวกัน
 *
 * 🔴 หมวดตัดสินจาก `followRoundState` + `CALL_OUTCOME_TONE` **ไม่ประดิษฐ์นิยามใหม่**
 * (กติกาหนึ่งเมตริกหนึ่งนิยาม) · "เลยเวลายังไม่มีผล" แยกจาก "ติดต่อไม่ได้" โดยตั้งใจ —
 * อันแรกยังไม่มีใครรับสายเลย อันหลัง AI โทรแล้วแต่ไม่ถึงตัว คนละงานที่ต้องทำต่อ
 */
export type FollowCallCategory =
  /** ตกลง — ยืนยันว่าไป / รับสายแล้ว / ปิดงานว่าไป */
  | 'agreed'
  /** ติดต่อไม่ได้ — ไม่รับ/ไม่ว่าง/ไม่ตอบ/โทรไม่สำเร็จ/เบอร์ผิด/ขอเลื่อน */
  | 'unreachable'
  /** ไม่ไป — ปฏิเสธ / ปิดงานว่าไม่ไป */
  | 'lost'
  /** ส่งแล้ว รอผล (ยังไม่เลยเวลา) หรือยังไม่ถึงเวลา */
  | 'waiting'
  /** เลยเวลานัดแล้วยังไม่มีผลกลับ */
  | 'overdue'
  /** ไม่ได้ส่งให้ AI เลย — ต้องคนจัดการ */
  | 'notSent'
  /** ยกเลิกทิ้ง */
  | 'cancelled'
  /** ปิดงานด้วยผลที่ยังไม่รู้ว่าไปหรือไม่ (ลา/เลื่อน/อื่น ๆ) */
  | 'other';

export const FOLLOW_CALL_CATEGORY_LABEL: Record<FollowCallCategory, string> = {
  agreed: 'ตกลง · ไป',
  unreachable: 'ติดต่อไม่ได้',
  lost: 'ไม่ไป',
  waiting: 'รอผล',
  overdue: 'เลยเวลา ยังไม่มีผล',
  notSent: 'ไม่ได้ส่งให้ AI',
  cancelled: 'ยกเลิก',
  other: 'ยังไม่รู้ผล',
};

/** สีของหมวด — ต้องเท่ากับ `roundTone` ของรอบในหมวดนั้น ไม่งั้นเลขกับชิปสีคนละเรื่อง */
export const FOLLOW_CALL_CATEGORY_TONE: Record<FollowCallCategory, ToneKey> = {
  agreed: 'success',
  unreachable: 'warn',
  lost: 'danger',
  waiting: 'primary',
  overdue: 'warn',
  notSent: 'orange',
  cancelled: 'neutral',
  other: 'warn',
};

export function callCategory(round: FollowPlanningRound): FollowCallCategory {
  const e = round.entry;
  switch (round.state) {
    case 'cancelled':
      return 'cancelled';
    case 'closed':
      if (isSuccessOutcome(e.outcome_code)) return 'agreed';
      if (isLostOutcome(e.outcome_code)) return 'lost';
      return 'other';
    case 'result': {
      const tone = CALL_OUTCOME_TONE[(e.call_outcome ?? '') as keyof typeof CALL_OUTCOME_TONE];
      if (tone === 'success') return 'agreed';
      if (tone === 'danger') return 'lost';
      if (tone === 'neutral') return 'cancelled';
      return 'unreachable';
    }
    case 'overdue':
      return 'overdue';
    case 'notSent':
      return 'notSent';
    default:
      return 'waiting';
  }
}

/** ตัวกรองรอบของหน้ารายวัน — `'all'` = ทุกสาย */
export type FollowRoundFilter = 'all' | 1 | 2 | 3;

export type FollowDayCall = {
  row: FollowPlanningRow;
  round: FollowPlanningRound;
  /** สายที่เท่าไหร่ (นิยามเดียวกับแท็บรอบ · null = ยังไม่รู้) */
  slot: 1 | 2 | 3 | null;
  category: FollowCallCategory;
};

/**
 * **ทุกสายของวันเดียว** — หนึ่งแถว = หนึ่งสาย (ไม่ใช่หนึ่งคน)
 * เพราะคำถามของหน้านี้คือ "สายไหนต้องตาม" ไม่ใช่ "ใครอยู่ในระบบ"
 *
 * 🔴 **เรียง: "ไม่ไป" ขึ้นบนสุดก่อน แล้วค่อยเรียงตามเวลา** (เจ้าของสั่ง 8 ก.ย. 2569:
 * *"คนไหนไม่ไปขอสีแดงอ่อน ๆ ในช่องนั้นไปเลย เปิดมารู้เลยว่านี่แหละไม่ไป และเรียงให้สีแดงอยู่บน ๆ"*)
 * — คนที่บอกว่าไม่ไปคือเรื่องที่ต้องหาคนแทน/แจ้งหน่วยงานทันที ห้ามจมอยู่กลางลิสต์ตามเวลานัด
 * ⚠️ รวมสายที่ยกเลิกด้วย (โชว์จาง) — Lumos โชว์ว่ายกเลิก จอเราต้องเห็นด้วย
 */
export function buildFollowDayCalls(
  rows: readonly FollowPlanningRow[],
  ymd: string,
  roundFilter: FollowRoundFilter = 'all',
): FollowDayCall[] {
  const out: FollowDayCall[] = [];
  for (const row of rows) {
    for (const round of row.rounds) {
      if (round.ymd !== ymd) continue;
      const slot = followRoundSlot(round.entry);
      if (roundFilter !== 'all' && slot !== roundFilter) continue;
      out.push({ row, round, slot, category: callCategory(round) });
    }
  }
  const lostFirst = (c: FollowDayCall) => (c.category === 'lost' ? 0 : 1);
  return out.sort(
    (a, b) =>
      lostFirst(a) - lostFirst(b) ||
      (a.round.time ?? '99:99').localeCompare(b.round.time ?? '99:99') ||
      a.row.group.name.localeCompare(b.row.group.name, 'th'),
  );
}

/** สายที่มีในวันนั้น (ทุกรอบ) — ไว้สร้างชิปตัวกรอง "สายที่ N" เฉพาะที่มีจริง */
export function roundSlotsOfDay(rows: readonly FollowPlanningRow[], ymd: string): Array<1 | 2 | 3> {
  const found = new Set<1 | 2 | 3>();
  for (const c of buildFollowDayCalls(rows, ymd, 'all')) if (c.slot) found.add(c.slot);
  return [...found].sort((a, b) => a - b);
}

export type FollowCallSummary = Record<FollowCallCategory, number> & {
  /** สายที่ต้องตาม = ทุกสายที่ไม่ได้ยกเลิก */
  total: number;
};

/** นับสายตามหมวด — ใช้ทั้งหัวหน้ารายวันและสรุปรายคนของหน้ารายเดือน */
export function summarizeFollowCalls(rounds: readonly FollowPlanningRound[]): FollowCallSummary {
  const s: FollowCallSummary = {
    agreed: 0,
    unreachable: 0,
    lost: 0,
    waiting: 0,
    overdue: 0,
    notSent: 0,
    cancelled: 0,
    other: 0,
    total: 0,
  };
  for (const r of rounds) {
    const c = callCategory(r);
    s[c] += 1;
    if (c !== 'cancelled') s.total += 1;
  }
  return s;
}

/** สรุปทั้งเดือนของคนหนึ่งคน (หน้ารายเดือน: "ทั้งเดือนติดตามกี่ครั้ง ไป/ไม่ไป/ติดต่อไม่ได้") */
export function personMonthSummary(row: FollowPlanningRow, month: string): FollowCallSummary {
  return summarizeFollowCalls(row.rounds.filter((r) => r.ymd?.slice(0, 7) === month));
}

/**
 * **เบอร์ฉุกเฉินที่แนบไปกับสายนี้** — เบอร์ที่ AI โทรหาต่อเมื่อติดต่อผู้รับไม่ได้
 * `null` = ไม่ได้แนบไปเลย (AI ไม่มีใครให้โทรต่อ — เป็นความเสี่ยง ไม่ใช่แค่ช่องว่าง)
 *
 * 🔴 **บอกได้แค่ "แนบไปแล้ว" ห้ามเขียนว่า "โทรแล้ว"** (เจ้าของสั่ง 7 ก.ย. 2569:
 * *"ต้องมีบอกด้วยว่าโทรหาเบอร์ฉุกเฉินยัง"*)
 * ตรวจ `result` ที่ Lumos ส่งกลับจริงวันที่ 7 ก.ย. 2569 ครบทุกคีย์แล้ว:
 * `call_attempts · client_contact_id · ended_reason · event_id · language · message ·
 *  next_action · outcome · plan_id · plan_status · recipient_name · recipient_phone ·
 *  recording_url · scheduled_at · status · step_id · step_position · step_type ·
 *  stop_early · summary · title · tone · transcript`
 * ⇒ **ไม่มีช่องไหนบอกว่าโทรเบอร์ฉุกเฉินหรือยัง** · เขียนว่า "โทรแล้ว" ตอนนี้คือจอโกหก
 * ต้องให้ฝั่ง Lumos เพิ่มฟิลด์มาก่อนถึงจะรายงานได้จริง
 */
export function roundEmergencyPhone(round: FollowPlanningRound): string | null {
  const p = (round.entry.emergency_phone ?? '').trim();
  return p === '' ? null : p;
}
