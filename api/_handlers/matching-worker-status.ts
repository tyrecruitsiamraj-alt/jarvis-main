import { getWorkerStatus } from '../_lib/matchPrecomputeWorker.js';
import { sendError, type ApiReq, type ApiRes } from '../_lib/http.js';

export default async function matchingWorkerStatusHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');
  return res.status(200).json(getWorkerStatus());
}
