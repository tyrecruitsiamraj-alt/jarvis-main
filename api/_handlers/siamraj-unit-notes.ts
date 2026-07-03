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
  getUnitNote,
  upsertUnitNote,
  listDistinctUnitNoteSuggestions,
} from '../_lib/siamrajUnitNotes.js';
import { checkFunctionAccess } from '../_lib/roleFunctionGrants.js';

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
      if (getQuery(req, 'history') === '1') {
        const limit = Number(getQuery(req, 'limit') || '50');
        const items = await listDistinctUnitNoteSuggestions(limit);
        return res.status(200).json({ items });
      }

      const requestNo = getString(req.query?.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no query is required');
      const item = await getUnitNote(requestNo);
      return res.status(200).json(item ?? { request_no: requestNo, note: null, updated_at: null });
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-notes GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST' || method === 'PUT') {
    try {
      const access = await checkFunctionAccess(req.user.role, 'unit_notes_edit');
      if (!access.ok) return sendError(res, 403, 'Forbidden', access.message);

      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const requestNo = getString(body.request_no);
      if (!requestNo) return sendError(res, 400, 'Bad request', 'request_no is required');

      const item = await upsertUnitNote({
        requestNo,
        note: body.note,
        userId: req.user.sub,
      });

      await auditFromAuthed(req, {
        action: 'siamraj_unit_note.upsert',
        entityType: 'siamraj_unit_note',
        entityId: requestNo,
        after: { note: item.note },
      });

      return res.status(200).json(item);
    } catch (e) {
      return handleApiError(res, e, 'siamraj-unit-notes POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'siamraj-unit-notes');
