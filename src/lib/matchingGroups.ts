/**
 * ═══ หน้าจับคู่งาน · 4 กล่องของใบขอ (เจ้าของ 26 พ.ย. 2569 · Choice "ทำตามแบบร่าง ถอดตามนี้") ═══
 *
 * เจ้าของ: "หน้าจับคู่ … ยังดูยาก ๆ ดูงง ๆ" — ค่าเริ่มเดิมเรียงเลยกำหนดก่อน ใบแรกที่เห็นเป็นใบเก่า 440–584 วัน
 * ที่ไม่มีคนแนะนำเลย ⇒ แบ่งใบเป็น 4 กล่องตามสิ่งที่ต้องทำต่อ เปิดหน้ามาเจอกล่องแรก
 *
 * 1 ใบอยู่กล่องเดียวเสมอ · 4 กล่องรวมกัน = ใบทั้งหมด (เทสต์คุม)
 * ลำดับตัดสิน: มีคนรอตาม → ต้องคนตาม · มีคนแนะนำ + เคยส่ง AI → ส่ง AI แล้ว · มีคนแนะนำ → มีคน ยังไม่ส่ง AI · ที่เหลือ → ไม่มีคนตรง
 * ไฟล์ล้วน ใช้ทั้งหน้าเว็บและ `/api/matching/list` (ตัวกรองชุดเดียว เลขบนกล่องตรงกับรายการ)
 */

export type MatchGroup = 'call_ready' | 'needs_human' | 'ai_sent' | 'no_match';

export const MATCH_GROUPS: ReadonlyArray<{ key: MatchGroup; label: string }> = [
  { key: 'call_ready', label: 'มีคน ยังไม่ส่ง AI' },
  { key: 'needs_human', label: 'ต้องคนตาม' },
  { key: 'ai_sent', label: 'ส่ง AI แล้ว' },
  { key: 'no_match', label: 'ไม่มีคนตรง' },
];

export function isMatchGroup(v: unknown): v is MatchGroup {
  return typeof v === 'string' && MATCH_GROUPS.some((g) => g.key === v);
}

/** ยอดสายของใบ (ชุดเดียวกับ `lumosSummary` ของ `/api/matching/list`) — ไม่มี = ยังไม่เคยส่ง */
export type MatchCallCounts = { sent: number; pendingApproval: number; needsHuman: number };

/** ขอเงินเดือนเกินใบขอเกิน 30% = ขึ้นคำว่า "ขอเกิน" ในตารางคน (แบบร่างที่เจ้าของเคาะ 26 พ.ย. 2569) */
export const SALARY_OVER_RATIO = 1.3;

export function isSalaryOver(asked: number | null | undefined, offered: number | null | undefined): boolean {
  const a = Number(asked);
  const o = Number(offered);
  return Number.isFinite(a) && Number.isFinite(o) && o > 0 && a > o * SALARY_OVER_RATIO;
}


export function matchGroupOf(recommended: number, calls?: MatchCallCounts | null): MatchGroup {
  if ((calls?.needsHuman ?? 0) > 0) return 'needs_human';
  if (recommended > 0) {
    return (calls?.sent ?? 0) > 0 || (calls?.pendingApproval ?? 0) > 0 ? 'ai_sent' : 'call_ready';
  }
  return 'no_match';
}
