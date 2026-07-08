import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { parseErpBranchDemand } from '../_lib/erpBranchDemandParser.js';

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

    const text = getQuery(req, 'text');
    if (!text.trim()) {
      return sendError(res, 400, 'Bad request', 'text is required');
    }

    return res.status(200).json(parseErpBranchDemand(text));
  } catch (e) {
    return handleApiError(res, e, 'matching-parse-branch-demand');
  }
}

export default withRbac(handler, 'matching-parse-branch-demand');
