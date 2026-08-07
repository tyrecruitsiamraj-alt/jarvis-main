/**
 * ตัวปล่อยชุดส่งงานเข้าคิวจริง — เสียบเข้า callBatchStore ผ่าน setCallBatchDispatcher()
 *
 * แยกไฟล์เพราะ callBatchStore ถูก import จาก lumosDispatch (กัน import วงกลม):
 *   callBatchStore  ← lumosDispatch (ปล่อยชุดตอนเสิร์ฟคิว)
 *   callBatchStore  ← ไฟล์นี้ → lumosDispatch (ตัว enqueue จริง)
 *
 * **ชื่อ/เบอร์ถูกอ่านใหม่ตอนปล่อย ไม่ใช่ snapshot ตอนกดเลือก** — คนอาจย้ายถัง
 * หรือเปลี่ยนเบอร์ระหว่างรออนุมัติ ถ้าใช้ค่าเก่าจะโทรผิดเบอร์
 * ใช้ตัวตรวจ pool ชุดเดียวกับการส่งเองที่หน้า Matching (resolveBoardSelection)
 */
import { logInfo, logError } from './logger.js';
import { setCallBatchDispatcher } from './callBatchStore.js';
import { enqueueLumosReminderForSelected, enqueueLumosInterviewForSelected } from './lumosDispatch.js';
import { listBoardReadyCandidates, boardPrimaryColumnId, boardFallbackColumnId } from './boardCandidatesSql.js';
import { listRecruitCandidatesByIds } from './recruitRegisterSql.js';
import { getSiamrajUnitRequestById } from './siamrajUnitRequests.js';
import { getStoredBoardMatch } from './boardMatchStore.js';
import type { CallBatch } from '../../src/lib/callBatch.js';

const BOARD_POOL_LIMIT = 4000;

/** ถังที่อนุญาตให้ส่งได้ — ชุดเดียวกับหน้า Matching */
function pickerColumnIds(): number[] {
  const ids = [boardPrimaryColumnId(), boardFallbackColumnId()].filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );
  return [...new Set(ids)];
}

async function dispatchBatch(batch: CallBatch): Promise<void> {
  const active = batch.items.filter((i) => !i.removed);
  if (active.length === 0) {
    logInfo('call-batch.release.empty', { batchId: batch.id });
    return;
  }

  // ใบขอต้องยังอยู่ — scope mode 'all' เพราะตอนนี้เป็นระบบทำงานเอง ไม่ใช่คนกด
  const job = await getSiamrajUnitRequestById(batch.jobId, { mode: 'all' });
  if (!job) {
    logError('call-batch.release.no-job', new Error('job not found'), { batchId: batch.id });
    return;
  }
  const jobRecord = job as Record<string, unknown>;

  if (batch.channel === 'reminder') {
    const wanted = new Set(active.map((i) => Number(i.candidateRef)).filter(Number.isFinite));
    const pool = await listBoardReadyCandidates({ columnIds: pickerColumnIds(), limit: BOARD_POOL_LIMIT });
    const selected = pool
      .filter((c) => wanted.has(c.card_id))
      .map((c) => ({
        card_id: c.card_id,
        full_name: c.full_name || c.nick_name || `การ์ด ${c.card_id}`,
        mobile: c.mobile,
      }));
    const missing = [...wanted].filter((id) => !selected.some((s) => s.card_id === id));
    if (missing.length > 0) {
      // คนที่หลุด pool ไปแล้ว (ย้ายคอลัมน์/ลงงาน) ข้ามไป ไม่ทำให้ชุดทั้งชุดล้ม
      logInfo('call-batch.release.missing', { batchId: batch.id, missing });
    }
    if (selected.length === 0) return;

    const stored = await getStoredBoardMatch(batch.jobId);
    const outcome = await enqueueLumosReminderForSelected(
      jobRecord,
      {
        jobId: batch.jobId,
        request_no: stored?.result.request_no ?? batch.requestNo,
        job_family_label: stored?.result.job_family_label ?? null,
      },
      selected,
    );
    logInfo('call-batch.release.reminder', { batchId: batch.id, ...outcome });
    return;
  }

  const ids = active.map((i) => Number(i.candidateRef)).filter(Number.isFinite);
  const candidates = await listRecruitCandidatesByIds(ids);
  if (candidates.length === 0) return;
  const stored = await getStoredBoardMatch(batch.jobId);
  const outcome = await enqueueLumosInterviewForSelected(
    jobRecord,
    {
      jobId: batch.jobId,
      request_no: stored?.result.request_no ?? batch.requestNo,
      job_family_label: stored?.result.job_family_label ?? null,
    },
    candidates.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      phone_number: c.phone_number,
    })),
  );
  logInfo('call-batch.release.interview', { batchId: batch.id, ...outcome });
}

/** เรียกครั้งเดียวตอนบูต (import ไฟล์นี้ = ลงทะเบียนให้เลย) */
setCallBatchDispatcher(dispatchBatch);

export { dispatchBatch };
