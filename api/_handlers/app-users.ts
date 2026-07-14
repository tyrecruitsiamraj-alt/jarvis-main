import { dbQuery } from '../_lib/postgres.js';
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { isAllowedDepartmentCode, normalizeDepartmentCode } from '../_lib/departmentScope.js';

const usersTable = tableInAppSchema('users');

type UserRow = {
  id: string;
  email: string;
  role: string;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
  department_code: string | null;
};
type UserRole = 'admin' | 'supervisor' | 'staff' | 'opl';

function isRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff' || v === 'opl';
}

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function toUserJson(u: UserRow) {
  const department_code = normalizeDepartmentCode(u.department_code) || undefined;
  return {
    id: u.id,
    username: u.email,
    full_name: u.full_name || u.email,
    email: u.email,
    role: u.role,
    is_active: u.is_active,
    created_at: toYmd(u.created_at),
    ...(department_code ? { department_code } : {}),
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
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
      const hasDepartmentPatch = Object.prototype.hasOwnProperty.call(body, 'department_code');
      let department_code: string | null | undefined;
      if (hasDepartmentPatch) {
        const raw =
          body.department_code === null || body.department_code === ''
            ? null
            : typeof body.department_code === 'string'
              ? body.department_code
              : null;
        if (raw !== null && !isAllowedDepartmentCode(raw)) {
          return sendError(res, 400, 'Bad request', 'department_code ต้องเป็น LBD หรือ LBA');
        }
        department_code = raw === null ? null : raw.trim().toUpperCase();
      }

      if (!id) return sendError(res, 400, 'Bad request', 'id is required');
      if (role !== undefined && !isRole(role)) {
        return sendError(res, 400, 'Bad request', 'role must be admin/supervisor/staff/opl');
      }
      if (is_active !== undefined && typeof is_active !== 'boolean') {
        return sendError(res, 400, 'Bad request', 'is_active must be boolean');
      }
      if (role === undefined && is_active === undefined && !hasDepartmentPatch) {
        return sendError(res, 400, 'Bad request', 'Nothing to update');
      }

      const { rows: beforeRows } = await dbQuery<UserRow>(
        `select id, email, role, full_name, is_active, created_at, department_code from ${usersTable} where id = $1 limit 1`,
        [id],
      );
      const beforeUser = beforeRows[0];
      if (!beforeUser) return sendError(res, 404, 'Not found', 'User not found');

      if (role && role !== 'admin') {
        const cur = beforeUser;
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
          is_active = coalesce($3, is_active),
          department_code = case when $4::boolean then $5 else department_code end
        where id = $1
        returning id, email, role, full_name, is_active, created_at, department_code
        `,
        [
          id,
          role ?? null,
          is_active ?? null,
          hasDepartmentPatch,
          hasDepartmentPatch ? department_code : null,
        ],
      );
      const u = updatedRows[0];
      if (!u) return sendError(res, 404, 'Not found', 'User not found');

      await auditFromAuthed(req, {
        action: 'user.update',
        entityType: 'user',
        entityId: u.id,
        before: {
          role: beforeUser.role,
          is_active: beforeUser.is_active,
          email: beforeUser.email,
          department_code: beforeUser.department_code,
        },
        after: {
          role: u.role,
          is_active: u.is_active,
          email: u.email,
          department_code: u.department_code,
        },
      });

      return res.status(200).json(toUserJson(u));
    }

    const { rows } = await dbQuery<UserRow>(
      `select id, email, role, full_name, is_active, created_at, department_code from ${usersTable} order by created_at desc`,
    );
    return res.status(200).json(rows.map(toUserJson));
  } catch (e) {
    return handleApiError(res, e, `app-users ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'app-users');
