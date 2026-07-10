import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  getUnitAssignment,
  upsertUnitAssignment,
} from '../_lib/siamrajUnitAssignments.js';

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const requestNo = getString(req.query?.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');
      const item = await getUnitAssignment(requestNo);
      return res.status(200).json(
        item ?? {
          request_no: requestNo,
          recruiter_name: null,
          screener_name: null,
          opl_name: null,
          updated_at: null,
        },
      );
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-assignments GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const requestNo = getString(body.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no is required');

      const before = await getUnitAssignment(requestNo);

      const item = await upsertUnitAssignment({
        requestNo,
        recruiterName: body.recruiter_name,
        screenerName: body.screener_name,
        oplName: body.opl_name,
        userId: req.user.sub,
      });

      await auditFromAuthed(req, {
        action: 'siamraj_unit_assignment.upsert',
        entityType: 'siamraj_unit_assignment',
        entityId: requestNo,
        before: before
          ? {
              recruiter_name: before.recruiter_name,
              screener_name: before.screener_name,
              opl_name: before.opl_name,
            }
          : null,
        after: {
          recruiter_name: item.recruiter_name,
          screener_name: item.screener_name,
          opl_name: item.opl_name,
        },
      });

      return res.status(200).json(item);
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-assignments POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'siamraj-unit-assignments');
