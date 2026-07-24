import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { buildMatchingSuggestions } from '../_lib/matchingEngine.js';
import { isSiamrajRequestInScope } from '../_lib/siamrajUnitRequests.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      res.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate');
    }

    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed', 'Read-only matching suggestions');
    }

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }
    if (!(await isSiamrajRequestInScope(req.user, jobId))) {
      return sendError(res, 403, 'Forbidden', 'ไม่มีสิทธิ์เข้าถึงใบขอของแผนกอื่น');
    }

    const owner = getQuery(req, 'owner') || undefined;
    const limitRaw = getQuery(req, 'limit');
    const limit = limitRaw ? Number(limitRaw) : 200;
    const poolRaw = getQuery(req, 'poolSize') || getQuery(req, 'pool_size');
    const poolSize = poolRaw ? Number(poolRaw) : undefined;

    const result = await buildMatchingSuggestions({
      jobId,
      owner,
      limit,
      poolSize: Number.isFinite(poolSize as number) ? (poolSize as number) : undefined,
    });
    if (!result) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบขอ ERP');
    }

    return res.status(200).json(result);
  } catch (e) {
    return handleApiError(res, e, 'matching-suggestions');
  }
}

export default withRbac(handler, 'matching-suggestions');
