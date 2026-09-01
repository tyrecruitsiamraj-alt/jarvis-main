import type { FollowEntry } from '@/lib/followApi';
import type { FollowGroup } from '@/lib/followGrouping';

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
  /** ส่งเข้าคิว AI แล้ว ยังไม่ถึงเวลา/ยังไม่มีผล */
  | 'sent'
  /** ยังไม่ถึงเวลา และไม่เคยเข้าคิว AI เลย */
  | 'waiting';

export const FOLLOW_ROUND_STATE_LABEL: Record<FollowRoundState, string> = {
  cancelled: 'ยกเลิกแล้ว',
  closed: 'ปิดงานแล้ว',
  result: 'ได้ผลแล้ว',
  overdue: 'เลยเวลานัด',
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
  const at = ms(entry.scheduled_at);
  // ไม่มีเวลานัดที่อ่านได้ = ยังไม่ถึงคิวใคร — ห้ามเดาว่าเลยเวลา
  if (at !== null && at < now.getTime()) return 'overdue';
  return entry.call_status ? 'sent' : 'waiting';
}

/** รอบนี้ยัง "ต้องทำอะไรต่อ" อยู่ไหม — ใช้เรียงว่าใครต้องโทรก่อน */
export function isRoundOpen(state: FollowRoundState): boolean {
  return state === 'overdue' || state === 'sent' || state === 'waiting';
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

/* ═══ มุมปฏิทินของ Planning (เจ้าของสั่งเพิ่ม 1 ก.ย. 2569) ═══
 *
 * > *"ตรง Planning ยังไม่ได้เป็นแบบปฏิทินที่มีรายละเอียด มีชื่อคนบอก
 * >  เหมือนเป็นตารางบอกว่าวันนี้มีใครต้องติดตาม"*
 *
 * ⇒ ตารางแถวยาวอย่างเดียวไม่พอ ต้องเห็น **ทั้งเดือนเป็นช่องวัน แล้วในช่องมีชื่อคน**
 * ⚠️ นับตามปฏิทินกรุงเทพเสมอ (สายตี 1 ของไทยยังเป็น "เมื่อวาน" ที่ UTC)
 * ⚠️ รอบที่ยกเลิกไม่ใช่งานของวันนั้นอีกแล้ว — ไม่นับ ไม่โชว์
 */

export type FollowDayPerson = {
  /** คีย์กลุ่ม (เบอร์|เรื่อง) — ใช้เป็น React key ได้ */
  key: string;
  name: string;
  /** รอบของคนนี้ในวันนั้น เรียงตามเวลา */
  rounds: FollowPlanningRound[];
  /** สภาพที่ "แรงที่สุด" ของวันนั้น — ใช้เป็นสีจุดหน้าชื่อ */
  worst: FollowRoundState;
};

export type FollowPlanningDay = {
  ymd: string;
  people: FollowDayPerson[];
  /** จำนวนสายของวันนั้น (ไม่นับที่ยกเลิก) */
  calls: number;
  /** เลยเวลานัดแล้วยังไม่มีผล — ของค้างของวันนั้น */
  overdue: number;
  /** ได้ผลกลับมาแล้ว/ปิดงานแล้ว */
  done: number;
};

/** ความแรงของสภาพ — ของค้างชนะทุกอย่าง (จอต้องเตือนก่อน ไม่ใช่กลบ) */
const STATE_RANK: Record<FollowRoundState, number> = {
  overdue: 5,
  sent: 4,
  waiting: 3,
  result: 2,
  closed: 1,
  cancelled: 0,
};

/** ปฏิทินรายวันของทั้งชุด — คีย์เป็น YYYY-MM-DD ตามเวลาไทย */
export function buildFollowPlanningDays(
  rows: readonly FollowPlanningRow[],
): Map<string, FollowPlanningDay> {
  const out = new Map<string, FollowPlanningDay>();
  for (const row of rows) {
    for (const round of row.rounds) {
      if (!round.ymd || round.state === 'cancelled') continue;
      const day = out.get(round.ymd) ?? { ymd: round.ymd, people: [], calls: 0, overdue: 0, done: 0 };
      out.set(round.ymd, day);
      day.calls += 1;
      if (round.state === 'overdue') day.overdue += 1;
      if (round.state === 'result' || round.state === 'closed') day.done += 1;
      const person =
        day.people.find((p) => p.key === row.group.key) ??
        (() => {
          const p: FollowDayPerson = { key: row.group.key, name: row.group.name, rounds: [], worst: round.state };
          day.people.push(p);
          return p;
        })();
      person.rounds.push(round);
      if (STATE_RANK[round.state] > STATE_RANK[person.worst]) person.worst = round.state;
    }
  }
  // ในแต่ละวัน: คนที่มีของค้างขึ้นก่อน แล้วเรียงตามเวลานัดแรกของวันนั้น
  for (const day of out.values()) {
    for (const p of day.people) p.rounds.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    day.people.sort(
      (a, b) =>
        STATE_RANK[b.worst] - STATE_RANK[a.worst] ||
        (a.rounds[0]?.time ?? '').localeCompare(b.rounds[0]?.time ?? ''),
    );
  }
  return out;
}
