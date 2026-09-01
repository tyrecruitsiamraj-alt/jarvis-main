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
