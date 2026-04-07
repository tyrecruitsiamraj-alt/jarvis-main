/**
 * Issue a session as the first active DB user matching role (no password).
 * Default: allowed unless JARVIS_DEV_ROLE_LOGIN is explicitly false/0/no/off.
 * For strict production, set JARVIS_DEV_ROLE_LOGIN=false.
 */
import { dbQuery } from '../../_lib/postgres.js';
import {
  signAuthToken,
  buildSetCookieHeader,
  getJwtSecret,
} from '../../_lib/auth.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody } from '../../_lib/body.js';
import type { UserRole } from '../../_lib/auth.js';
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
};

function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff';
}

function toUserResponse(row: UserRow) {
  const created =
    row.created_at instanceof Date
      ? row.created_at.toISOString().slice(0, 10)
      : String(row.created_at).slice(0, 10);
  return {
    id: row.id,
    username: row.email,
    full_name: row.full_name || row.email,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: created,
  };
}

function devRoleLoginAllowed(): boolean {
  const raw = process.env.JARVIS_DEV_ROLE_LOGIN;
  if (raw === undefined || String(raw).trim() === '') return true;
  const v = String(raw).toLowerCase().trim();
  if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return v === 'true' || v === '1' || v === 'yes';
}

export default async function handler(req: ApiReq, res: ApiRes) {
  let method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST' && req.body && typeof req.body === 'object' && req.body !== null) {
    const b = req.body as Record<string, unknown>;
    if (b.role === 'admin' || b.role === 'supervisor' || b.role === 'staff') {
      method = 'POST';
    }
  }
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed', 'Use POST with JSON body { "role": "staff"|"supervisor"|"admin" }');
  }

  if (!devRoleLoginAllowed()) {
    return sendError(
      res,
      403,
      'Forbidden',
      'Role pick login is disabled (JARVIS_DEV_ROLE_LOGIN=false).',
    );
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
    const role = body.role;
    if (!isUserRole(role)) {
      return sendError(res, 400, 'Bad request', 'role must be admin, supervisor, or staff');
    }

    const { rows } = await dbQuery<UserRow>(
      `
      select id, email, role, full_name, is_active, created_at
      from ${usersTable}
      where role = $1 and is_active = true
      order by created_at asc
      limit 1
    `,
      [role],
    );

    const row = rows[0];
    if (!row) {
      return sendError(
        res,
        404,
        'Not found',
        `No active user with role "${role}". Run npm run db:seed first.`,
      );
    }

    const ttl = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 1800) || 1800;
    const token = signAuthToken({
      sub: row.id,
      email: row.email,
      role: row.role,
    });

    res.setHeader?.('Set-Cookie', buildSetCookieHeader(token, ttl));
    return res.status(200).json({ user: toUserResponse(row) });
  } catch (e) {
    return handleApiError(res, e, 'auth/dev-role');
  }
}
