import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getSiamrajUnitRequestById } from '../_lib/siamrajUnitRequests.js';
import { buildErpBranchDemandInput, parseErpBranchDemand } from '../_lib/erpBranchDemandParser.js';
import { buildBranchMatchingSuggestions } from '../_lib/matchingEngine.js';

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

    const jobId = getQuery(req, 'jobId') || getQuery(req, 'job_id');
    if (!jobId.trim()) {
      return sendError(res, 400, 'Bad request', 'jobId is required');
    }

    const job = await getSiamrajUnitRequestById(jobId);
    if (!job) {
      return sendError(res, 404, 'Not found', 'ไม่พบใบงาน ERP');
    }

    const parserInput = buildErpBranchDemandInput(job);
    const branchMatches = await buildBranchMatchingSuggestions({ jobId });
    return res.status(200).json({
      jobId: job.id,
      parser_input: parserInput,
      parsed: parseErpBranchDemand(parserInput),
      branch_matches: branchMatches?.branches || [],
    });
  } catch (e) {
    return handleApiError(res, e, 'matching-parse-branch-demand-job');
  }
}

export default withRbac(handler, 'matching-parse-branch-demand');
