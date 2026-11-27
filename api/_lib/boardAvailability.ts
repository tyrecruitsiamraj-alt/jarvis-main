import { listBoardMatchPool } from './boardCandidatesSql.js';
import { listActiveProposals } from './candidateProposals.js';
import { logError } from './logger.js';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
// pure filter ใช้ร่วมกับหน้าเว็บ (zero-drift) — src ถูก ship เข้า production image แล้ว (ดู deploy-topology)
import type { BoardAvailabilityContext } from '@/lib/boardMatchAvailability';

/**
 * รวบรวมสถานะ "ความพร้อม" ของคนของเรา ณ ปัจจุบัน เพื่อกรองผลแมทที่เก็บไว้:
 *  - availableCardIds = คนที่ยังอยู่ในกองจับคู่งาน (ไม่มีงาน/Re Use/Drop · 17 ต.ค. 2569)
 *  - activeJobByCardId = คนที่ถูกจอง/ติดต่อ/ลงงานค้างอยู่ (source=board) แมพไปยังใบขอนั้น
 */
export async function loadBoardAvailabilityContext(): Promise<BoardAvailabilityContext> {
  const availableCardIds = new Set<number>();
  const activeJobByCardId = new Map<number, string>();
  const columnLabelByCardId = new Map<number, string>();
  try {
    const [pool, active] = await Promise.all([
      listBoardMatchPool(5000),
      listActiveProposals(),
    ]);
    for (const c of pool) {
      if (Number.isFinite(c.card_id)) availableCardIds.add(c.card_id);
      if (Number.isFinite(c.card_id) && c.column_label) columnLabelByCardId.set(c.card_id, c.column_label);
    }
    for (const p of active) {
      if (p.source !== 'board') continue;
      const cardId = Number(String(p.candidate_ref).replace(/[^0-9]/g, ''));
      if (Number.isFinite(cardId) && cardId !== 0) activeJobByCardId.set(cardId, p.job_id);
    }
  } catch (e) {
    logError('board-availability.load.fail', { message: e instanceof Error ? e.message : String(e) });
  }
  const held = await loadBoardHoldBlocks();
  return { availableCardIds, activeJobByCardId, columnLabelByCardId, ...held };
}

/**
 * ล็อก "เก็บไปโทรเอง" ของคนของเรา (source=board) → ใครออกจากกองจับคู่ (เจ้าของ 27 พ.ย. 2569)
 * - ล็อกที่ยังถืออยู่ (ไม่ปล่อย · ไม่หมดอายุ) = ออกทุกใบ
 * - ไม่สนใจงานนี้ (declined · job) · ติดต่อไม่ได้ (no_answer) = ไม่จับคู่ใบเดิม
 * - ไม่หางานแล้ว (declined · all) · ผิดคน/เบอร์ผิด (wrong_person) = ไม่จับคู่ทุกใบ
 * อ่านไม่ได้ = ไม่กรอง (ถอยไปพฤติกรรมเดิม · ห้ามทำให้หน้าจับคู่ล้ม)
 */
async function loadBoardHoldBlocks(): Promise<Pick<BoardAvailabilityContext, 'heldCardIds' | 'blockedJobsByCardId' | 'blockedAllCardIds'>> {
  const heldCardIds = new Set<number>();
  const blockedAllCardIds = new Set<number>();
  const blockedJobsByCardId = new Map<number, Set<string>>();
  try {
    const { rows } = await dbQuery<{ candidate_ref: string; job_id: string; held: boolean; result_outcome: string | null; result_scope: string | null }>(
      `select candidate_ref, job_id,
              (released_at is null and expires_at > now()) as held,
              result_outcome, result_scope
         from ${tableInAppSchema('candidate_call_holds')}
        where source = 'board'
          and ((released_at is null and expires_at > now()) or result_outcome in ('declined', 'no_answer', 'wrong_person'))`,
    );
    for (const r of rows) {
      const cardId = Number(String(r.candidate_ref).replace(/[^0-9]/g, ''));
      if (!Number.isFinite(cardId) || cardId === 0) continue;
      if (r.held) heldCardIds.add(cardId);
      if (r.result_outcome === 'wrong_person' || (r.result_outcome === 'declined' && r.result_scope === 'all')) blockedAllCardIds.add(cardId);
      else if (r.result_outcome === 'no_answer' || r.result_outcome === 'declined') {
        const set = blockedJobsByCardId.get(cardId) ?? new Set<string>();
        set.add(r.job_id);
        blockedJobsByCardId.set(cardId, set);
      }
    }
  } catch (e) {
    logError('board-availability.holds.fail', { message: e instanceof Error ? e.message : String(e) });
  }
  return { heldCardIds, blockedJobsByCardId, blockedAllCardIds };
}
