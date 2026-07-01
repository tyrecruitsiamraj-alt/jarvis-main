import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret, type UserRole } from '../../_lib/auth.js';
import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { consumeMagicLinkToken } from '../../_lib/magicLinkLogin.js';
import { issueAuthSession, type AuthUserRow } from '../../_lib/authSession.js';
import { auditFromAnonymous } from '../../_lib/audit.js';

function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff';
}

async function magicLinkVerifyHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  if (!rateLimitOrReject(req, res, 'auth:magic-link-verify', 10, 15 * 60 * 1000)) return;

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const token = getString((raw as Record<string, unknown>).token);
    if (!token) {
      return sendError(res, 400, 'Bad request', 'token is required');
    }

    const consumed = await consumeMagicLinkToken(token);
    if (!consumed) {
      await auditFromAnonymous(req, { userName: 'magic-link' }, {
        action: 'auth.magic_link.failed',
        entityType: 'auth',
        entityId: 'verify',
        after: { reason: 'invalid_or_expired' },
      });
      return sendError(res, 400, 'Bad request', 'ลิงก์เข้าสู่ระบบไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    const { rows } = await dbQuery<AuthUserRow>(
      `
      select id, email, role, full_name, is_active, created_at
      from users
      where id = $1
      limit 1
    `,
      [consumed.userId],
    );
    const row = rows[0];
    if (!row || !isUserRole(row.role) || !row.is_active) {
      return sendError(res, 403, 'Forbidden', 'บัญชีนี้ไม่สามารถเข้าสู่ระบบได้');
    }

    await issueAuthSession(req, res, row, 'auth.magic_link.success');
  } catch (e) {
    return handleApiError(res, e, 'auth/magic-link-verify');
  }
}

export default magicLinkVerifyHandler;
