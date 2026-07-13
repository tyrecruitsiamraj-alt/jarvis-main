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
  getUnitWorkStatus,
  isUnitRequestWorkStatus,
  upsertUnitWorkStatus,
} from '../_lib/siamrajUnitWorkStatus.js';

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const requestNo = getString(req.query?.request_no) || getQuery(req, 'request_no');
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');
      const item = await getUnitWorkStatus(requestNo);
      return res.status(200).json(
        item ?? {
          request_no: requestNo,
          status: 'in_progress',
          person_first_name: null,
          person_last_name: null,
          status_date: null,
          updated_at: null,
        },
      );
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-work-status GET', { userId: req.user.sub });
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
      if (!isUnitRequestWorkStatus(body.status)) {
        return sendError(res, 400, 'Bad request', 'status is invalid');
      }

      const item = await upsertUnitWorkStatus({
        requestNo,
        status: body.status,
        person_first_name: body.person_first_name,
        person_last_name: body.person_last_name,
        status_date: body.status_date,
        userId: req.user.sub,
      });

      await auditFromAuthed(req, {
        action: 'siamraj_unit_work_status.upsert',
        entityType: 'siamraj_unit_work_status',
        entityId: requestNo,
        after: item,
      });

      return res.status(200).json(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/กรุณากรอก|must be|invalid status|บันทึกสถานะทำงานไม่สำเร็จ|บันทึกไม่สำเร็จ/i.test(msg)) {
        return sendError(res, 400, 'Bad request', msg);
      }
      return handleApiError(res, e, 'siamraj-unit-work-status POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'siamraj-unit-work-status');
