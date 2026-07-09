import { listRecentAuditLogs } from '../_lib/auditLogsQuery.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';

const parseLimit = (q: unknown): number => {
  const n = typeof q === 'string' ? Number(q) : typeof q === 'number' ? q : 100;
  return Math.min(500, Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 100));
};

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const limit = parseLimit(req.query?.limit);
      const logs = await listRecentAuditLogs(limit);
      return res.status(200).json(logs);
    } catch (e) {
      return handleApiError(res, e, 'audit-logs GET', { userId: req.user.sub });
    }
  }

  // Audit logs are server-written only — clients cannot create audit events.
  if (method === 'POST') {
    return sendError(
      res,
      403,
      'Forbidden',
      'Audit logs are written by the server on successful mutations',
    );
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'audit-logs');
