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
  listAllUnitAssignees,
  upsertUnitAssignment,
} from '../_lib/siamrajUnitAssignments.js';
import { checkSiamrajRequestScope } from '../_lib/siamrajUnitRequests.js';
import { requestScopeDenyMessage } from '../../src/lib/requestScopeMessage.js';


async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      /**
       * `?all=1` — ผู้รับผิดชอบทุกใบ (read-only) สำหรับ Dashboard กรองตามเจ้าหน้าที่
       * ไม่ผูก scope รายใบเพราะข้อมูลคือ "ใบเลขนี้ใครดูแล" เท่านั้น ไม่มีข้อมูลบุคคล
       * และหน้า Dashboard ถูกล็อก BU ของผู้ใช้อยู่แล้วอีกชั้น
       */
      if (getString(req.query?.all) === '1') {
        res.setHeader?.('Cache-Control', 'no-store');
        return res.status(200).json({ items: await listAllUnitAssignees() });
      }
      const requestNo = getString(req.query?.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');
      const scope = await checkSiamrajRequestScope(req.user, requestNo);
      if (!scope.ok) {
        // บอกเหตุผลจริง — "ไม่พบใบ" กับ "คนละ BU" คนละเรื่องกัน
        return sendError(
          res,
          scope.reason === 'not_found' ? 404 : 403,
          scope.reason === 'not_found' ? 'Not found' : 'Forbidden',
          requestScopeDenyMessage({ ...scope, requestNo }),
        );
      }
      const item = await getUnitAssignment(requestNo);
      return res.status(200).json(
        item ?? {
          request_no: requestNo,
          recruiter_name: null,
          screener_name: null,
          opl_name: null,
          online_name: null,
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
      const scope = await checkSiamrajRequestScope(req.user, requestNo);
      if (!scope.ok) {
        // บอกเหตุผลจริง — "ไม่พบใบ" กับ "คนละ BU" คนละเรื่องกัน
        return sendError(
          res,
          scope.reason === 'not_found' ? 404 : 403,
          scope.reason === 'not_found' ? 'Not found' : 'Forbidden',
          requestScopeDenyMessage({ ...scope, requestNo }),
        );
      }

      const before = await getUnitAssignment(requestNo);

      const item = await upsertUnitAssignment({
        requestNo,
        recruiterName: body.recruiter_name,
        screenerName: body.screener_name,
        oplName: body.opl_name,
        onlineName: body.online_name,
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
              online_name: before.online_name,
            }
          : null,
        after: {
          recruiter_name: item.recruiter_name,
          screener_name: item.screener_name,
          opl_name: item.opl_name,
          online_name: item.online_name,
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
