import { dbQuery } from '../_lib/postgres.js';
import { withAuth, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { readJsonBody, getString } from '../_lib/body.js';

const usersTable = tableInAppSchema('users');

type UserRow = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
};
type UserRole = 'admin' | 'supervisor' | 'staff';

function isRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff';
}

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
  if (method !== 'GET' && method !== 'PATCH') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      if (!raw || typeof raw !== 'object') return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const body = raw as Record<string, unknown>;
      const id = getString(body.id);
      const role = body.role;
      const is_active = body.is_active;

      if (!id) return sendError(res, 400, 'Bad request', 'id is required');
      if (role !== undefined && !isRole(role)) {
        return sendError(res, 400, 'Bad request', 'role must be admin/supervisor/staff');
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return sendError(res, 400, 'Bad request', 'is_active must be boolean');
      }
      if (role === undefined && is_active === undefined) {
        return sendError(res, 400, 'Bad request', 'Nothing to update');
      }

      if (role && role !== 'admin') {
        const { rows: curRows } = await dbQuery<{ role: string; is_active: boolean }>(
          `select role, is_active from ${usersTable} where id = $1 limit 1`,
          [id],
        );
        const cur = curRows[0];
        if (!cur) return sendError(res, 404, 'Not found', 'User not found');
        if (cur.role === 'admin' && cur.is_active) {
          const { rows: adminRows } = await dbQuery<{ count: string }>(
            `select count(*)::text as count from ${usersTable} where role = 'admin' and is_active = true`,
          );
          const adminCount = Number(adminRows[0]?.count || '0');
          if (adminCount <= 1) {
            return sendError(res, 400, 'Bad request', 'Cannot remove the last active admin');
          }
        }
      }

      const { rows: updatedRows } = await dbQuery<UserRow>(
        `
        update ${usersTable}
        set
          role = coalesce($2, role),
          is_active = coalesce($3, is_active)
        where id = $1
        returning id, email, role, full_name, is_active, created_at
        `,
        [id, role ?? null, is_active ?? null],
      );
      const u = updatedRows[0];
      if (!u) return sendError(res, 404, 'Not found', 'User not found');

      return res.status(200).json({
        id: u.id,
        username: u.email,
        full_name: u.full_name || u.email,
        email: u.email,
        role: u.role,
        is_active: u.is_active,
        created_at: toYmd(u.created_at),
      });
    }

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
    return handleApiError(res, e, `app-users ${method}`, { userId: req.user.sub });
  }
}

export default withAuth(handler);
