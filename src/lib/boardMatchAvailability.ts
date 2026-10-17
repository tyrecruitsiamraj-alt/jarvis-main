/**
 * กรอง "คนของเรา" ในผลแมทที่เก็บไว้ (board_match_results) ให้เหลือเฉพาะคนที่ "ยังพร้อม"
 *
 * ผลแมทเป็น snapshot ตอนคิด — คนในนั้นอาจถูกดึงไปใบขออื่นหรือหลุดจาก pool รอลงงานไปแล้ว
 * ฟังก์ชันนี้กรองตอน "แสดง/เสิร์ฟ" โดยไม่แตะ snapshot และไม่ต้องคิด AI ใหม่ เพื่อให้
 * server (matching-list, board-candidates) และ client (หน้า Matching) กรองด้วยตรรกะชุดเดียวกัน
 *
 * เกณฑ์ "ไม่พร้อม" (ซ่อน):
 *  - ไม่อยู่ใน board pool "รอลงงาน" ปัจจุบันแล้ว (ถูกลงงาน/เปลี่ยนสถานะใน ERP), หรือ
 *  - มีการจอง/ติดต่อ/ลงงาน (active proposal) ค้างอยู่กับใบขอ "อื่น"
 * ยังแสดง ถ้าคนนั้น active อยู่กับใบขอ "นี้" เอง (เป็นตัวเลือกของใบนี้)
 */
export type BoardAvailabilityContext = {
  /** card_id ของคนที่ยังอยู่ใน pool รอลงงานปัจจุบัน */
  availableCardIds: ReadonlySet<number>;
  /** card_id → job_id ของใบขอที่คนนั้นถูกจอง/ติดต่อ/ลงงานอยู่ (active) */
  activeJobByCardId: ReadonlyMap<number, string>;
  /**
   * card_id → ถังปัจจุบันบนบอร์ด (ไม่มีงาน / Re Use / Drop) — ป้ายถังในผลแมทเป็นค่าตอนคิด (snapshot)
   * QA 17 ต.ค. 2569: ผลแมท 3 ก.ย. ติดป้าย "To do" ทั้งที่คนนั้นอยู่ Drop แล้ว ⇒ ทับด้วยถังปัจจุบันตอนเสิร์ฟ
   */
  columnLabelByCardId?: ReadonlyMap<number, string>;
};

/** ทับป้ายถังในผลแมทด้วยถังปัจจุบัน (pure) — ไม่รู้ถังปัจจุบัน = คงค่าเดิม */
export function withCurrentColumnLabels<T extends { card_id: number; column_label?: string | null }>(
  matches: readonly T[],
  ctx: BoardAvailabilityContext,
): T[] {
  const labels = ctx.columnLabelByCardId;
  if (!labels || labels.size === 0) return [...matches];
  return matches.map((m) => {
    const now = labels.get(m.card_id);
    return now && now !== m.column_label ? { ...m, column_label: now } : m;
  });
}

/** คนนี้ยังพร้อมสำหรับใบขอ jobId ไหม (pure) */
export function isBoardCandidateAvailable(
  cardId: number,
  jobId: string,
  ctx: BoardAvailabilityContext,
): boolean {
  if (!ctx.availableCardIds.has(cardId)) return false;
  const activeJob = ctx.activeJobByCardId.get(cardId);
  if (activeJob != null && activeJob !== jobId) return false;
  return true;
}

/** กรอง array ของแมท (อะไรก็ได้ที่มี card_id) ให้เหลือเฉพาะคนที่ยังพร้อมสำหรับ jobId */
export function filterAvailableBoardMatches<T extends { card_id: number }>(
  matches: readonly T[] | null | undefined,
  jobId: string,
  ctx: BoardAvailabilityContext,
): T[] {
  if (!matches) return [];
  return matches.filter((m) => isBoardCandidateAvailable(m.card_id, jobId, ctx));
}
