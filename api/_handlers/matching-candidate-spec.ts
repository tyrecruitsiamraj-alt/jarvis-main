import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { analyzeCandidateSpecForJob } from '../_lib/candidateSpecAnalyzer.js';
import { getOllamaConfig, checkOllamaReachable } from '../_lib/ollamaClient.js';

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
      return sendError(res, 405, 'Method not allowed');
    }

    if (!getOllamaConfig()) {
      return sendError(
        res,
        503,
        'Service unavailable',
        'ตั้งค่า OLLAMA_BASE_URL และ OLLAMA_MODEL ใน .env.local ก่อน',
      );
    }

    const ping = getQuery(req, 'ping') === '1';
    if (ping) {
      const reach = await checkOllamaReachable();
      return res.status(reach.ok ? 200 : 503).json({
        ollama: reach,
        config: getOllamaConfig(),
      });
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    const refresh = getQuery(req, 'refresh') === '1';
    const job = await getSiamrajUnitRequestById(jobId);
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    const analysis = await analyzeCandidateSpecForJob(jobId, job as Record<string, unknown>, {
      refresh,
    });

    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      jobId,
      analysis,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      /เชื่อมต่อ Ollama|ตั้งค่า OLLAMA|ไม่พบโมเดล|ตอบกลับว่าง|ใช้เวลานานเกินไป/i.test(message)
    ) {
      return sendError(res, 503, 'Service unavailable', message);
    }
    return handleApiError(res, e, 'matching-candidate-spec');
  }
}

export default withRbac(handler, 'matching-candidate-spec');
