/**
 * ═══ แผนการโทรทั้งเดือน — "นาย ก โทรวันไหนบ้าง วันละกี่รอบ รอบไหนกี่โมง" ═══
 *
 * เจ้าของสั่ง 21 ก.ย. 2569: *"ปฏิทินเอาเป็นกดแล้วเห็นแบบยาว ๆ ดิ นี่เห็นเป็นไรก็ไม่รู้
 * แบบเห็นเลยว่า เดือนนี้วันที่ 1-สิ้นเดือน นาย ก โทรวันไหนบ้าง วันละกี่รอบ รอบไหนกี่โมง
 * คือให้ขึ้นเป็น Planning อะ"*
 *
 * ⇒ ตารางเดียว: **แถว = คน · คอลัมน์ = วันที่ 1 ถึงสิ้นเดือน** · ในช่องบอกว่าใครโทร
 * และโทรกี่โมงบ้าง
 *
 * 🔴 กติกา:
 * 1. **วันตามเวลาไทยเสมอ** — ใช้วัน UTC เมื่อไหร่ สายตอนเช้า 06:50 จะเลื่อนไปวันก่อนหน้า
 * 2. **รอบของวันอ่านจาก `call_times` ก่อน** แล้วค่อยถอยไปใช้เวลาใน `scheduled_at`
 *    (หนึ่งแถว = หนึ่งวัน แต่ในวันนั้นมีได้หลายรอบ — เก็บไว้ที่ `call_times`)
 * 3. **ยกเลิกแล้วไม่นับเป็นรอบ** แต่ยังต้องเห็นในช่อง ไม่ใช่หายไปเฉย ๆ
 */
import type { FollowEntry } from '@/lib/followApi';
import { followGroupKey } from '@/lib/followGrouping';

/** ใครโทรในวันนั้น — `mixed` = วันเดียวมีทั้ง AI และคนโทรเอง */
export type MonthPlanMode = 'ai' | 'manual' | 'mixed';

/** สภาพของวันนั้นเมื่อมองจากผลที่กลับมาแล้ว */
export type MonthPlanState =
  /** ยังไม่ถึง/ยังไม่มีผล */
  | 'pending'
  /** มีผลกลับแล้วอย่างน้อยหนึ่งรอบ */
  | 'done'
  /** ทุกรอบของวันนั้นถูกยกเลิก */
  | 'cancelled';

export type MonthPlanCell = {
  ymd: string;
  mode: MonthPlanMode;
  state: MonthPlanState;
  /** เวลาโทรของวันนั้น เรียงแล้ว ไม่ซ้ำ (HH:MM) */
  times: string[];
  /** จำนวนรอบที่ยังไม่ถูกยกเลิก */
  rounds: number;
  /** แถวติดตามของวันนั้น — จอกดแล้วเปิดต่อได้ */
  entries: FollowEntry[];
};

export type MonthPlanRow = {
  key: string;
  name: string;
  phone: string;
  unitName: string | null;
  topic: string;
  /** ช่องของวันที่มีของเท่านั้น (คีย์ = YYYY-MM-DD) */
  cells: Record<string, MonthPlanCell>;
  /** วันแรก/วันสุดท้ายที่มีการโทรในเดือนนี้ — ใช้เขียน "ช่วงแผน" ใต้ชื่อ */
  firstYmd: string | null;
  lastYmd: string | null;
  totals: {
    /** จำนวนวันที่มีการโทร */
    days: number;
    /** จำนวนรอบรวมทั้งเดือน */
    rounds: number;
    aiRounds: number;
    manualRounds: number;
  };
};

export type MonthPlan = {
  /** 'YYYY-MM' ของเดือนที่กำลังดู */
  month: string;
  /** ทุกวันของเดือน (YYYY-MM-DD) — คอลัมน์ของตาราง */
  days: string[];
  rows: MonthPlanRow[];
  summary: {
    people: number;
    rounds: number;
    aiRounds: number;
    manualRounds: number;
    /** วันที่มีสายอย่างน้อยหนึ่งรอบ */
    activeDays: number;
  };
};

const BKK = 'Asia/Bangkok';

/** 'YYYY-MM-DD' ตามเวลาไทย — `null` เมื่ออ่านเวลาไม่ออก */
export function bangkokYmd(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-CA', { timeZone: BKK });
}

/** 'HH:MM' ตามเวลาไทย */
export function bangkokHhmm(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', {
    timeZone: BKK,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** ทุกวันของเดือน 'YYYY-MM' — คอลัมน์ทั้งแถบ ไม่ใช่เฉพาะวันที่มีของ */
export function daysOfMonth(month: string): string[] {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [];
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) return [];
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนนี้
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return Array.from(
    { length: last },
    (_, i) => `${m[1]}-${m[2]}-${String(i + 1).padStart(2, '0')}`,
  );
}

/** เดือนของวันนี้ (เวลาไทย) */
export function currentMonth(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: BKK }).slice(0, 7);
}

/** เลื่อนเดือน +1 / -1 */
export function shiftMonth(month: string, delta: number): string {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return month;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** เวลาโทรของแถวนั้น — `call_times` มาก่อน ถอยไปใช้เวลาใน `scheduled_at` */
function timesOf(entry: FollowEntry): string[] {
  const listed = (entry.call_times ?? []).filter((t) => /^\d{1,2}:\d{2}$/.test(t));
  if (listed.length > 0) {
    return listed.map((t) => (t.length === 4 ? `0${t}` : t));
  }
  const one = bangkokHhmm(entry.scheduled_at);
  return one ? [one] : [];
}

export function buildMonthPlan(
  entries: readonly FollowEntry[],
  month: string,
): MonthPlan {
  const days = daysOfMonth(month);
  const dayset = new Set(days);
  const byPerson = new Map<string, MonthPlanRow>();

  for (const e of entries) {
    const ymd = bangkokYmd(e.scheduled_at);
    if (!ymd || !dayset.has(ymd)) continue;

    const key = followGroupKey(e);
    let row = byPerson.get(key);
    if (!row) {
      row = {
        key,
        name: e.recipient_name,
        phone: e.recipient_phone,
        unitName: e.unit_name ?? null,
        topic: e.topic,
        cells: {},
        firstYmd: null,
        lastYmd: null,
        totals: { days: 0, rounds: 0, aiRounds: 0, manualRounds: 0 },
      };
      byPerson.set(key, row);
    }
    // หน่วยงานเติมจากรอบไหนก็ได้ที่ระบุไว้ — บางรอบเว้นว่าง
    if (!row.unitName && e.unit_name) row.unitName = e.unit_name;

    const cell = row.cells[ymd] ?? {
      ymd,
      mode: 'ai' as MonthPlanMode,
      state: 'pending' as MonthPlanState,
      times: [],
      rounds: 0,
      entries: [],
    };
    cell.entries.push(e);
    for (const t of timesOf(e)) if (!cell.times.includes(t)) cell.times.push(t);
    row.cells[ymd] = cell;
  }

  // สรุปแต่ละช่องหลังเก็บครบ — ต้องดูทุกแถวของวันนั้นพร้อมกันถึงจะบอก mixed ได้
  let activeDays = 0;
  const activeDaySet = new Set<string>();
  for (const row of byPerson.values()) {
    for (const ymd of Object.keys(row.cells)) {
      const cell = row.cells[ymd];
      const live = cell.entries.filter((e) => !e.cancelled);
      cell.rounds = live.reduce((n, e) => n + Math.max(1, timesOf(e).length), 0);

      const modes = new Set(live.map((e) => (e.call_mode === 'manual' ? 'manual' : 'ai')));
      cell.mode = modes.size > 1 ? 'mixed' : modes.has('manual') ? 'manual' : 'ai';

      if (live.length === 0) cell.state = 'cancelled';
      else if (live.some((e) => e.call_outcome)) cell.state = 'done';
      else cell.state = 'pending';

      cell.times.sort();

      if (cell.rounds > 0) {
        row.totals.days += 1;
        row.totals.rounds += cell.rounds;
        if (cell.mode === 'manual') row.totals.manualRounds += cell.rounds;
        else if (cell.mode === 'ai') row.totals.aiRounds += cell.rounds;
        else {
          // วันผสม — แยกตามรอบจริง ไม่ปัดไปข้างใดข้างหนึ่ง
          for (const e of live) {
            const n = Math.max(1, timesOf(e).length);
            if (e.call_mode === 'manual') row.totals.manualRounds += n;
            else row.totals.aiRounds += n;
          }
        }
        activeDaySet.add(ymd);
      }
    }
    const used = Object.keys(row.cells).sort();
    row.firstYmd = used[0] ?? null;
    row.lastYmd = used[used.length - 1] ?? null;
  }
  activeDays = activeDaySet.size;

  /** เรียงคน: ใครมีนัดเร็วสุดขึ้นก่อน · เท่ากันเรียงตามชื่อ */
  const rows = [...byPerson.values()].sort((a, b) => {
    const fa = a.firstYmd ?? '9999-99-99';
    const fb = b.firstYmd ?? '9999-99-99';
    if (fa !== fb) return fa < fb ? -1 : 1;
    return a.name.localeCompare(b.name, 'th');
  });

  const summary = rows.reduce(
    (acc, r) => ({
      people: acc.people + 1,
      rounds: acc.rounds + r.totals.rounds,
      aiRounds: acc.aiRounds + r.totals.aiRounds,
      manualRounds: acc.manualRounds + r.totals.manualRounds,
      activeDays,
    }),
    { people: 0, rounds: 0, aiRounds: 0, manualRounds: 0, activeDays },
  );

  return { month, days, rows, summary };
}
