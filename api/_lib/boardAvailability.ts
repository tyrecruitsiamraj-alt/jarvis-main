import { listBoardReadyCandidates } from './boardCandidatesSql.js';
import { listActiveProposals } from './candidateProposals.js';
import { logError } from './logger.js';
// pure filter ใช้ร่วมกับหน้าเว็บ (zero-drift) — src ถูก ship เข้า production image แล้ว (ดู deploy-topology)
import type { BoardAvailabilityContext } from '@/lib/boardMatchAvailability';

/**
 * รวบรวมสถานะ "ความพร้อม" ของคนของเรา ณ ปัจจุบัน เพื่อกรองผลแมทที่เก็บไว้:
 *  - availableCardIds = คนที่ยังอยู่ใน board pool รอลงงาน
 *  - activeJobByCardId = คนที่ถูกจอง/ติดต่อ/ลงงานค้างอยู่ (source=board) แมพไปยังใบขอนั้น
 */
export async function loadBoardAvailabilityContext(): Promise<BoardAvailabilityContext> {
  const availableCardIds = new Set<number>();
  const activeJobByCardId = new Map<number, string>();
  try {
    const [pool, active] = await Promise.all([
      listBoardReadyCandidates({ limit: 5000 }),
      listActiveProposals(),
    ]);
    for (const c of pool) {
      if (Number.isFinite(c.card_id)) availableCardIds.add(c.card_id);
    }
    for (const p of active) {
      if (p.source !== 'board') continue;
      const cardId = Number(String(p.candidate_ref).replace(/[^0-9]/g, ''));
      if (Number.isFinite(cardId) && cardId !== 0) activeJobByCardId.set(cardId, p.job_id);
    }
  } catch (e) {
    logError('board-availability.load.fail', { message: e instanceof Error ? e.message : String(e) });
  }
  return { availableCardIds, activeJobByCardId };
}
