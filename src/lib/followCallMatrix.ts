/**
 * ═══ ตารางสายรวมก้อนเดียวของหน้าติดตาม (เจ้าของเคาะ 3 ต.ค. 2569) ═══
 *
 * แทนการ์ดตัวเลข 4 ใบ + กล่อง Call Pipeline ที่เคยพูดเรื่องเดียวกันสองที่จนเลขชนกัน
 * (*"มันข้อมูลชุดเดียวกัน รวมกันแล้วทำให้ดูง่ายดีกว่าไหม"*) · เจ้าของกำหนดว่าต้องบอกครบ:
 *   1. ทั้งหมดเท่าไหร่ · 2. สาย 1 2 3 เท่าไหร่ · 3. แต่ละสาย ตอบว่าไป / ไม่ไป / สรุปไม่ได้ เท่าไหร่
 * + เคยสั่งให้โชว์ยกเลิก *"ไม่งั้นจะงงว่าหายไปไหน 1"*
 *
 * 🔴 **ทุกแถวบวกกันได้พอดี**: ไป + ไม่ไป + สรุปไม่ได้ + รอโทร + ยกเลิก = ทั้งหมด
 * และ แถวทุกสาย = สาย 1 + สาย 2 + สาย 3 ขึ้นไป ทุกคอลัมน์
 *
 * นิยามยืมของกลางทั้งหมด (หนึ่งเมตริกหนึ่งนิยาม):
 *   · สายที่เท่าไหร่ = `followRoundSlot` (ตัวเดียวกับปฏิทิน/ตารางรายวัน)
 *   · ไป / ไม่ไป / สรุปไม่ได้ / รอโทร = `callCategory` (ตัวเดียวกับตาราง — รวมผลปิดงาน
 *     และผลที่คนลงเอง) · ยกเลิก = หมวด cancelled
 *   · สายที่ไม่มีเลขสาย (ยังไม่เคยเข้าคิวและยังไม่มีผล) ไม่อยู่สายไหน — นิยามเดิมของแผง
 */
import type { FollowEntry } from '@/lib/followApi';
import { callCategory, dayVerdictOf, followRoundState, staffDayVerdicts, type FollowCallCategory } from '@/lib/followPlanning';
import { followGroupKey, followPersonKey } from '@/lib/followGrouping';
import { followRoundSlot } from '@/lib/followRoundBuckets';

export type FollowMatrixRowKey = 'all' | 1 | 2 | 3;
/**
 * 🔴 "รอโทร" กับ "สรุปไม่ได้" แยกกัน (เจ้าของสั่ง 4 ต.ค. 2569: *"สรุปผลไม่ได้คือโทรไปแล้วแต่ไม่รู้ผล
 * คือไปหรือไม่"*) — เดิมรวมเป็นช่องเดียว "สรุปไม่ได้" ทั้งที่ 30 สายยังไม่ได้โทรเลย
 */
export type FollowMatrixCol = 'total' | 'went' | 'notWent' | 'noAnswer' | 'unclear' | 'waiting' | 'cancelled';

export const FOLLOW_MATRIX_ROWS: readonly FollowMatrixRowKey[] = ['all', 1, 2, 3];
/** 🔴 ไป · ไม่ไป · ไม่รับสาย · สรุปไม่ได้ — 4 ช่องตามที่เจ้าของนิยาม (6 ต.ค. 2569) */
export const FOLLOW_MATRIX_COLS: readonly FollowMatrixCol[] = ['total', 'went', 'notWent', 'noAnswer', 'unclear', 'waiting', 'cancelled'];

export const FOLLOW_MATRIX_ROW_LABEL: Record<FollowMatrixRowKey, string> = {
  all: 'ทุกสาย',
  1: 'สายที่ 1',
  2: 'สายที่ 2',
  3: 'สายที่ 3 ขึ้นไป',
};

export const FOLLOW_MATRIX_COL_LABEL: Record<FollowMatrixCol, string> = {
  total: 'ทั้งหมด',
  went: 'ตอบว่าไป',
  notWent: 'ตอบว่าไม่ไป',
  noAnswer: 'ไม่รับสาย',
  unclear: 'สรุปไม่ได้',
  waiting: 'รอโทร',
  cancelled: 'ยกเลิก',
};

/** สีของคอลัมน์ — สีที่มีความหมายชุดเดิม (เขียว = ไป · แดง = ไม่ไป · เหลือง = ยังไม่รู้) */
export const FOLLOW_MATRIX_COL_TONE: Record<FollowMatrixCol, 'neutral' | 'success' | 'danger' | 'warn' | 'info' | 'violet'> = {
  total: 'neutral',
  went: 'success',
  notWent: 'danger',
  noAnswer: 'warn',
  // สีเดียวกับหมวด "สรุปไม่ได้" ของตาราง (FOLLOW_CALL_CATEGORY_TONE.other)
  unclear: 'violet',
  /** ฟ้า = ยังไม่ถึงเวลา/รอผล (สีเดียวกับป้ายในตาราง) */
  waiting: 'info',
  cancelled: 'neutral',
};

export type FollowMatrix = Record<FollowMatrixRowKey, Record<FollowMatrixCol, FollowEntry[]>>;

const emptyRow = (): Record<FollowMatrixCol, FollowEntry[]> => ({
  total: [],
  went: [],
  notWent: [],
  noAnswer: [],
  unclear: [],
  waiting: [],
  cancelled: [],
});

/**
 * ช่องของสายหนึ่งสาย — ไป / ไม่ไป / สรุปไม่ได้ / รอโทร / ยกเลิก (หมวดกลาง `callCategory` ตัวเดียวกับตาราง)
 *   · สรุปไม่ได้ = **มีผลแล้ว** แต่ไม่รู้ว่าไปไหม: ไม่ได้คำตอบ (unreachable) · ปิดงานด้วย ลา/เลื่อน/จำวันผิด (other)
 *   · รอโทร = **ยังไม่มีผล**: ยังไม่ถึงเวลา (waiting) · เลยเวลาแต่ผลยังไม่กลับ (overdue) · ไม่ได้ส่ง AI/รอคนโทร (notSent)
 */
export function followMatrixCol(
  entry: FollowEntry,
  now: Date = new Date(),
  /** ผลที่คนกดจัดการของคน+วันนี้ (`staffDayVerdicts`) — มีค่า = ทับหมวดของสาย (5 ต.ค. 2569) */
  dayVerdict: FollowCallCategory | null = null,
): Exclude<FollowMatrixCol, 'total'> {
  const round = { entry, state: followRoundState(entry, now), time: null, ymd: null, dayVerdict };
  return followMatrixColOfCategory(callCategory(round));
}

/**
 * หมวดของสาย → กล่องบนแผง (ตัวเดียวกับ `followMatrixCol`) — ตารางรายวันใช้กรอง "ชื่อย้ายไปตามกล่อง"
 * (เจ้าของสั่ง 5 ต.ค. 2569) ด้วยนิยามเดียวกับเลขบนกล่อง
 */
export function followMatrixColOfCategory(category: FollowCallCategory): Exclude<FollowMatrixCol, 'total'> {
  switch (category) {
    case 'cancelled':
      return 'cancelled';
    case 'agreed':
      return 'went';
    case 'lost':
      return 'notWent';
    case 'unreachable':
      return 'noAnswer';
    case 'other':
      return 'unclear';
    default:
      return 'waiting';
  }
}

/** ตารางเต็ม — แต่ละช่องถือรายชื่อจริง (กดดูรายชื่อได้ · เลข = ความยาวลิสต์ ไม่มีตัวนับแยก) */
export function buildFollowCallMatrix(entries: readonly FollowEntry[], now: Date = new Date()): FollowMatrix {
  const m: FollowMatrix = { all: emptyRow(), 1: emptyRow(), 2: emptyRow(), 3: emptyRow() };
  // คนกดจัดการแล้ว = ทุกสายของคนนั้นในวันนั้นย้ายไปถังที่กด (ตัวเดียวกับตารางรายวัน — คีย์กลุ่มเดียวกัน)
  const verdicts = staffDayVerdicts(entries, followGroupKey);
  for (const e of entries) {
    const slot = followRoundSlot(e);
    if (slot === null) continue;
    const col = followMatrixCol(e, now, dayVerdictOf(verdicts, followGroupKey(e), e));
    for (const key of ['all', slot] as const) {
      m[key].total.push(e);
      m[key][col].push(e);
    }
  }
  return m;
}

/**
 * ═══ แผงตัวเลขหน้าติดตามแบบตาราง AI | คน | รวม (เจ้าของ Choice 12 ต.ค. 2569 "แบบ A") ═══
 * เรียง: โทรทั้งหมด → โทรไปแล้ว (= ไป + ไม่ไป + ไม่รับสาย + สรุปไม่ได้) → รอโทร → ยกเลิก · นับเป็นสาย
 * โทรไปแล้ว + รอโทร + ยกเลิก = โทรทั้งหมด (ช่องของ matrix แบ่งกันพอดีอยู่แล้ว) · AI + คน = รวม (`followCallerOf`)
 */
export type FollowPanelLine = 'total' | 'called' | Exclude<FollowMatrixCol, 'total'>;
export const FOLLOW_PANEL_LINES: ReadonlyArray<{ key: FollowPanelLine; label: string; indent: 0 | 1 | 2; box: FollowMatrixCol | null }> = [
  { key: 'total', label: 'โทรทั้งหมด', indent: 0, box: 'total' },
  { key: 'called', label: 'โทรไปแล้ว', indent: 1, box: null },
  { key: 'went', label: FOLLOW_MATRIX_COL_LABEL.went, indent: 2, box: 'went' },
  { key: 'notWent', label: FOLLOW_MATRIX_COL_LABEL.notWent, indent: 2, box: 'notWent' },
  { key: 'noAnswer', label: FOLLOW_MATRIX_COL_LABEL.noAnswer, indent: 2, box: 'noAnswer' },
  { key: 'unclear', label: FOLLOW_MATRIX_COL_LABEL.unclear, indent: 2, box: 'unclear' },
  { key: 'waiting', label: FOLLOW_MATRIX_COL_LABEL.waiting, indent: 1, box: 'waiting' },
  { key: 'cancelled', label: FOLLOW_MATRIX_COL_LABEL.cancelled, indent: 1, box: 'cancelled' },
];

export function followPanelLists(row: Record<FollowMatrixCol, FollowEntry[]>): Record<FollowPanelLine, FollowEntry[]> {
  return {
    total: row.total,
    called: [...row.went, ...row.notWent, ...row.noAnswer, ...row.unclear],
    went: row.went,
    notWent: row.notWent,
    noAnswer: row.noAnswer,
    unclear: row.unclear,
    waiting: row.waiting,
    cancelled: row.cancelled,
  };
}

/** จำนวนคน (ไม่ซ้ำ) ของชุดสาย — "25 คน · 400 สาย" (เจ้าของ 12 ต.ค. 2569) · คนเดียวกัน = `followPersonKey` */
export function followPeopleCount(list: readonly FollowEntry[]): number {
  return new Set(list.map(followPersonKey)).size;
}
