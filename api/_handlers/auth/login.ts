import { dbQuery } from '../../_lib/postgres.js';
import {
  verifyPassword,
  getJwtSecret,
  type UserRole,
} from '../../_lib/auth.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import {
  companyEmailRequiredMessage,
  isCompanyEmail,
  isCompanyEmailLoginEnforced,
} from '../../_lib/companyEmail.js';
import { issueAuthSession, type AuthUserRow } from '../../_lib/authSession.js';
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

type UserRow = AuthUserRow & {
  password_hash: string;
};

function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff' || v === 'opl';
}

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const body = raw as Record<string, unknown>;
    const email = getString(body.email)?.toLowerCase();
    const password = getString(body.password);
    if (!email || !password) {
      return sendError(res, 400, 'Bad request', 'email and password are required');
    }

    // ต่ออีเมล (กัน brute force) + เพดาน IP สูงสำหรับออฟฟิศ NAT
    if (!rateLimitOrReject(req, res, `auth:login:user:${email}`, 30, 15 * 60 * 1000)) return;
    if (!rateLimitOrReject(req, res, 'auth:login:office', 500, 15 * 60 * 1000)) return;

    if (isCompanyEmailLoginEnforced() && !isCompanyEmail(email)) {
      return sendError(res, 400, 'Bad request', companyEmailRequiredMessage());
    }

    const { rows } = await dbQuery<UserRow>(
      `
      select id, email, password_hash, role, full_name, is_active, created_at, department_code
      from ${usersTable}
      where lower(email) = lower($1)
      limit 1
    `,
      [email],
    );

    const row = rows[0];
    if (!row || !isUserRole(row.role)) {
      await auditFromAnonymous(req, { userName: email }, {
        action: 'auth.login.failed',
        entityType: 'auth',
        entityId: 'login',
        after: { reason: 'invalid_credentials' },
      });
      return sendError(res, 401, 'Unauthorized', 'Invalid email or password');
    }
    if (!row.is_active) {
      await auditFromAnonymous(req, { userId: row.id, userName: email, userRole: row.role }, {
        action: 'auth.login.failed',
        entityType: 'auth',
        entityId: row.id,
        after: { reason: 'account_disabled' },
      });
      return sendError(res, 403, 'Forbidden', 'Account is disabled');
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      await auditFromAnonymous(req, { userId: row.id, userName: email, userRole: row.role }, {
        action: 'auth.login.failed',
        entityType: 'auth',
        entityId: row.id,
        after: { reason: 'invalid_credentials' },
      });
      return sendError(res, 401, 'Unauthorized', 'Invalid email or password');
    }

    await issueAuthSession(req, res, row, 'auth.login.success');
  } catch (e) {
    return handleApiError(res, e, 'auth/login');
  }
}
