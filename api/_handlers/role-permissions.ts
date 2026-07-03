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

      await upsertGrant(role as UserRole, functionId, enabled, req.user?.id ?? null);
      await auditFromAuthed(req, {
        action: 'role_permission.update',
        entity_type: 'role_function_grant',
        entity_id: `${role}:${functionId}`,
        metadata: { role, functionId, enabled },
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
