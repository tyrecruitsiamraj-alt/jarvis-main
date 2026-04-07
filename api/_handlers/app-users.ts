import { dbQuery } from '../_lib/postgres.js';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { tableInAppSchema } from '../_lib/schema.js';

const usersTable = tableInAppSchema('users');

type UserRow = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
};

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

async function handler(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'Only administrators can list users');
  }

  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const { rows } = await dbQuery<UserRow>(
      `select id, email, role, full_name, is_active, created_at from ${usersTable} order by created_at desc`,
    );
    const list = rows.map((r) => ({
      id: r.id,
      username: r.email,
      full_name: r.full_name || r.email,
      email: r.email,
      role: r.role,
      is_active: r.is_active,
      created_at: toYmd(r.created_at),
    }));
    return res.status(200).json(list);
  } catch (e) {
    return handleApiError(res, e, 'app-users GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
