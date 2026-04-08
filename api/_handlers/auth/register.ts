import { dbQuery } from '../../_lib/postgres.js';
import { hashPassword, getJwtSecret } from '../../_lib/auth.js';
import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import type { UserRole } from '../../_lib/auth.js';

async function registerHandler(req: ApiReq, res: ApiRes) {
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
    const first_name = getString(body.first_name);
    const last_name = getString(body.last_name);
    const legacyFull = getString(body.full_name);
    const role: UserRole = 'staff';

    let full_name: string;
    if (first_name && last_name) {
      full_name = `${first_name} ${last_name}`.replace(/\s+/g, ' ').trim();
    } else if (legacyFull) {
      full_name = legacyFull;
    } else {
      return sendError(
        res,
        400,
        'Bad request',
        'first_name and last_name are required',
      );
    }

    if (!email || !password) {
      return sendError(res, 400, 'Bad request', 'email and password are required');
    }
    if (password.length < 8) {
      return sendError(res, 400, 'Bad request', 'password must be at least 8 characters');
    }

    const password_hash = await hashPassword(password);
    const { rows } = await dbQuery<{
      id: string;
      email: string;
      role: UserRole;
      full_name: string;
      is_active: boolean;
      created_at: string | Date;
    }>(
      `
      insert into users (email, password_hash, role, full_name)
      values (lower($1::text), $2, $3, $4)
      returning id, email, role, full_name, is_active, created_at
    `,
      [email, password_hash, role, full_name],
    );

    const row = rows[0];
    if (!row) return sendError(res, 500, 'Failed to create user');
    return res.status(201).json({
      user: {
        id: row.id,
        username: row.email,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString().slice(0, 10)
            : String(row.created_at).slice(0, 10),
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return sendError(res, 409, 'Conflict', 'Email already registered');
    }
    return handleApiError(res, e, 'auth/register');
  }
}

export default registerHandler;
