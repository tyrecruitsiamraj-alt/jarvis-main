import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { getIrecruitSqlServerConfig } from '../_lib/irecruitSqlServer.js';
import { getOllamaConfig } from '../_lib/ollamaClient.js';
import { matchIrecruitCandidatesForJob } from '../_lib/irecruitCandidateMatcher.js';

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
      return sendError(res, 405, 'Method not allowed', 'Read-only iRecruit matching');
    }

    if (!getIrecruitSqlServerConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ยังไม่ได้ตั้งค่า iRecruit DB');
    }
    if (!getOllamaConfig()) {
      return sendError(res, 503, 'Service unavailable', 'ตั้งค่า OLLAMA_BASE_URL / OLLAMA_MODEL ก่อน');
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    const job = await getSiamrajUnitRequestById(jobId);
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    const refresh = getQuery(req, 'refresh') === '1';
    const owner = getQuery(req, 'owner') || undefined;

    const result = await matchIrecruitCandidatesForJob(jobId, job as Record<string, unknown>, {
      owner,
      refresh,
    });

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      /เชื่อมต่อ Ollama|ตั้งค่า OLLAMA|ไม่พบโมเดล|ตอบกลับว่าง|ใช้เวลานานเกินไป|iRecruit/i.test(
        message,
      )
    ) {
      return sendError(res, 503, 'Service unavailable', message);
    }
    return handleApiError(res, e, 'matching-irecruit-candidates');
  }
}

export default withRbac(handler, 'matching-irecruit-candidates');
