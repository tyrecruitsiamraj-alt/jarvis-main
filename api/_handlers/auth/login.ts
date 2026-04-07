import { dbQuery } from '../../_lib/postgres.js';
import {
  signAuthToken,
  buildSetCookieHeader,
  verifyPassword,
  getJwtSecret,
} from '../../_lib/auth.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import type { UserRole } from '../../_lib/auth.js';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
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

    const { rows } = await dbQuery<UserRow>(
      `
      select id, email, password_hash, role, full_name, is_active, created_at
      from users
      where lower(email) = lower($1)
      limit 1
    `,
      [email],
    );

    const row = rows[0];
    if (!row || !isUserRole(row.role)) {
      return sendError(res, 401, 'Unauthorized', 'Invalid email or password');
    }
    if (!row.is_active) {
      return sendError(res, 403, 'Forbidden', 'Account is disabled');
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return sendError(res, 401, 'Unauthorized', 'Invalid email or password');
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
    return handleApiError(res, e, 'auth/login');
  }
}
