/**
 * เลนคัดสรร — เส้น "ชวนกลับ" ที่วิ่งขนานกับใบสมัครใหม่ (เจ้าของสั่ง 16 ส.ค. 2569)
 *
 * GET /api/matching/selection-recall?jobId=...&send=1
 *   - ค้นจาก **กองคนที่เคยตอบไม่สนใจงานอื่น** (สมัครกับเราแล้ว ไม่ต้องเก็บใบใหม่)
 *   - `send=1` → ส่งเขียว+เหลืองเข้าคิว Lumos ทันที ("อันที่ AI หามาก็โทรไปเลย")
 *
 * ⚠️ คนละเส้นกับ `/api/matching/recruit-lane` (เลนสรรหา = คนยังไม่สมัคร) โดยตั้งใจ —
 * กองคนละกอง สิทธิ์แยกกันได้ และเลิกเส้นไหนก็ไม่กระทบอีกเส้น
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { getOllamaConfig } from '../_lib/ollamaClient.js';
import { matchDeclinedApplicantsForJob } from '../_lib/selectionRecallMatcher.js';
import { enqueueLumosInterviewForRecall } from '../_lib/lumosDispatch.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only selection recall');
    }
    if (!getOllamaConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ตั้งค่า OLLAMA_BASE_URL / OLLAMA_MODEL ก่อน');
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) return sendError(res, 400, 'Bad request', 'jobId is required');

    // จำกัดตามแผนกเหมือนเส้นอื่น — ห้ามอ้าง jobId ข้ามแผนกเพื่อดึงรายชื่อ
    const job = await getSiamrajUnitRequestById(jobId, await loadMatchingBuScope(req.user));
    if (!job) return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');

    const result = await matchDeclinedApplicantsForJob(jobId, job as Record<string, unknown>, {
      refresh: getQuery(req, 'refresh') === '1',
    });

    const dispatch =
      getQuery(req, 'send') === '1'
        ? await enqueueLumosInterviewForRecall(job as Record<string, unknown>, result)
        : null;

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ ...result, dispatch });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (/เชื่อมต่อ Ollama|ตั้งค่า OLLAMA|ไม่พบโมเดล|ตอบกลับว่าง|ใช้เวลานานเกินไป/i.test(message)) {
      return sendError(res, 503, 'Service unavailable', message);
    }
    return handleApiError(res, e, 'matching-selection-recall');
  }
}

export default withRbac(handler, 'matching-selection-recall');
