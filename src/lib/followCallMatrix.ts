/**
 * ═══ ตารางสายรวมก้อนเดียวของหน้าติดตาม (เจ้าของเคาะ 3 ต.ค. 2569) ═══
 *
 * แทนการ์ดตัวเลข 4 ใบ + กล่อง Call Pipeline ที่เคยพูดเรื่องเดียวกันสองที่จนเลขชนกัน
 * (*"มันข้อมูลชุดเดียวกัน รวมกันแล้วทำให้ดูง่ายดีกว่าไหม"*) · เจ้าของกำหนดว่าต้องบอกครบ:
 *   1. ทั้งหมดเท่าไหร่ · 2. สาย 1 2 3 เท่าไหร่ · 3. แต่ละสาย ตอบว่าไป / ไม่ไป / สรุปไม่ได้ เท่าไหร่
 * + เคยสั่งให้โชว์ยกเลิก *"ไม่งั้นจะงงว่าหายไปไหน 1"*
 *
 * 🔴 **ทุกแถวบวกกันได้พอดี**: ไป + ไม่ไป + สรุปไม่ได้ + ยกเลิก = ทั้งหมด
 * และ แถวทุกสาย = สาย 1 + สาย 2 + สาย 3 ขึ้นไป ทุกคอลัมน์
 *
 * นิยามยืมของกลางทั้งหมด (หนึ่งเมตริกหนึ่งนิยาม):
 *   · สายที่เท่าไหร่ = `followRoundSlot` (ตัวเดียวกับปฏิทิน/ตารางรายวัน)
 *   · ไป / ไม่ไป / สรุปไม่ได้ = `callCategory` → `callVerdict` (ตัวเดียวกับการ์ดเดิม — รวมผลปิดงาน
 *     และผลที่คนลงเอง) · ยกเลิก = หมวด cancelled
 *   · สายที่ไม่มีเลขสาย (ยังไม่เคยเข้าคิวและยังไม่มีผล) ไม่อยู่สายไหน — นิยามเดิมของแผง
 */
import type { FollowEntry } from '@/lib/followApi';
import { callCategory, callVerdict, followRoundState } from '@/lib/followPlanning';
import { followRoundSlot } from '@/lib/followRoundBuckets';

export type FollowMatrixRowKey = 'all' | 1 | 2 | 3;
export type FollowMatrixCol = 'total' | 'went' | 'notWent' | 'unknown' | 'cancelled';

export const FOLLOW_MATRIX_ROWS: readonly FollowMatrixRowKey[] = ['all', 1, 2, 3];
export const FOLLOW_MATRIX_COLS: readonly FollowMatrixCol[] = ['total', 'went', 'notWent', 'unknown', 'cancelled'];

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
  unknown: 'สรุปไม่ได้',
  cancelled: 'ยกเลิก',
};

/** สีของคอลัมน์ — สีที่มีความหมายชุดเดิม (เขียว = ไป · แดง = ไม่ไป · เหลือง = ยังไม่รู้) */
export const FOLLOW_MATRIX_COL_TONE: Record<FollowMatrixCol, 'neutral' | 'success' | 'danger' | 'warn'> = {
  total: 'neutral',
  went: 'success',
  notWent: 'danger',
  unknown: 'warn',
  cancelled: 'neutral',
};

export type FollowMatrix = Record<FollowMatrixRowKey, Record<FollowMatrixCol, FollowEntry[]>>;

const emptyRow = (): Record<FollowMatrixCol, FollowEntry[]> => ({
  total: [],
  went: [],
  notWent: [],
  unknown: [],
  cancelled: [],
});

/** ช่องของสายหนึ่งสาย — ไป / ไม่ไป / สรุปไม่ได้ / ยกเลิก */
export function followMatrixCol(entry: FollowEntry, now: Date = new Date()): Exclude<FollowMatrixCol, 'total'> {
  const round = { entry, state: followRoundState(entry, now), time: null, ymd: null };
  const verdict = callVerdict(callCategory(round));
  if (verdict === null) return 'cancelled';
  return verdict;
}

/** ตารางเต็ม — แต่ละช่องถือรายชื่อจริง (กดดูรายชื่อได้ · เลข = ความยาวลิสต์ ไม่มีตัวนับแยก) */
export function buildFollowCallMatrix(entries: readonly FollowEntry[], now: Date = new Date()): FollowMatrix {
  const m: FollowMatrix = { all: emptyRow(), 1: emptyRow(), 2: emptyRow(), 3: emptyRow() };
  for (const e of entries) {
    const slot = followRoundSlot(e);
    if (slot === null) continue;
    const col = followMatrixCol(e, now);
    for (const key of ['all', slot] as const) {
      m[key].total.push(e);
      m[key][col].push(e);
    }
  }
  return m;
}
