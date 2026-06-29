import { probeOutboundIpAndTargets } from '../../_lib/outboundIpProbe.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type AuthedReq,
  type ApiRes,
} from '../../_lib/http.js';

async function handler(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'Only administrators can check outbound IP');
  }

  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const result = await probeOutboundIpAndTargets();
    return res.status(200).json(result);
  } catch (e) {
    return handleApiError(res, e, 'diagnostics/outbound-ip', { userId: req.user.sub });
  }
}

export default withAuth(handler, { roles: ['admin'] });
