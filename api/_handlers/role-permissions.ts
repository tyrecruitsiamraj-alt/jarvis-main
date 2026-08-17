import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { auditFromAuthed } from '../_lib/audit.js';
import type { UserRole } from '../_lib/auth.js';
import {
  VALID_FUNCTION_IDS,
  VALID_ROLES,
  buildEffectiveMatrix,
  canToggleGrant,
  loadGrantOverrides,
  upsertGrant,
} from '../_lib/roleFunctionGrants.js';

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      const overrides = await loadGrantOverrides();
      res.status(200).json({ matrix: buildEffectiveMatrix(overrides) });
      return;
    }

    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      if (!raw || typeof raw !== 'object') return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const body = raw as Record<string, unknown>;
      const role = body.role;
      const functionId = typeof body.functionId === 'string' ? body.functionId.trim() : '';
      const enabled = body.enabled;

      if (!VALID_ROLES.includes(role as UserRole)) {
        return sendError(res, 400, 'Bad request', 'role must be opl/staff/supervisor/admin');
      }
      if (!VALID_FUNCTION_IDS.has(functionId)) {
        return sendError(res, 400, 'Bad request', 'Invalid functionId');
      }
      if (typeof enabled !== 'boolean') {
        return sendError(res, 400, 'Bad request', 'enabled must be boolean');
      }

      const gate = canToggleGrant(role as UserRole, functionId, enabled);
      if (!gate.ok) return sendError(res, 400, 'Bad request', gate.message);

      // updated_by เป็น uuid FK — token ฝั่ง dev ใช้ sub ที่ไม่ใช่ uuid ได้ ต้องกรองก่อน
      const updatedBy = uuidRe.test(req.user.sub) ? req.user.sub : null;
      await upsertGrant(role as UserRole, functionId, enabled, updatedBy);
      await auditFromAuthed(req, {
        action: 'role_permission.update',
        entityType: 'role_function_grant',
        entityId: `${role}:${functionId}`,
        after: { role, functionId, enabled },
      });

      const overrides = await loadGrantOverrides();
      res.status(200).json({ matrix: buildEffectiveMatrix(overrides) });
      return;
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    handleApiError(res, e, 'role-permissions');
  }
}

export default withRbac(handler, 'app-users');
