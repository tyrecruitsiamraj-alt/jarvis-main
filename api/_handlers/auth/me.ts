import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret } from '../../_lib/auth.js';
import { withAuth, sendError, handleApiError, type AuthedReq, type ApiRes } from '../../_lib/http.js';
import type { UserRole } from '../../_lib/auth.js';

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
};

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

async function meHandler(req: AuthedReq, res: ApiRes) {
  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }
  try {
    const { rows } = await dbQuery<UserRow>(
      `
      select id, email, role, full_name, is_active, created_at
      from users
      where id = $1
      limit 1
    `,
      [req.user.sub],
    );
    const row = rows[0];
    if (!row || !row.is_active) {
      return sendError(res, 401, 'Unauthorized', 'User not found or inactive');
    }
    return res.status(200).json({ user: toUserResponse(row) });
  } catch (e) {
    return handleApiError(res, e, 'auth/me');
  }
}

export default withAuth(meHandler, { roles: ['staff', 'supervisor', 'admin'] });
