import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret } from '../../_lib/auth.js';
import { withAuth, sendError, handleApiError, type AuthedReq, type ApiRes } from '../../_lib/http.js';
import type { UserRole } from '../../_lib/auth.js';
import { tableInAppSchema } from '../../_lib/schema.js';
import { isAllowedDepartmentCode, normalizeDepartmentCode } from '../../_lib/departmentScope.js';
import { readJsonBody, getString } from '../../_lib/body.js';

const usersTable = tableInAppSchema('users');

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
  department_code: string | null;
};

function toUserResponse(row: UserRow) {
  const created =
    row.created_at instanceof Date
      ? row.created_at.toISOString().slice(0, 10)
      : String(row.created_at).slice(0, 10);
  const department_code = normalizeDepartmentCode(row.department_code) || undefined;
  return {
    id: row.id,
    username: row.email,
    full_name: row.full_name || row.email,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: created,
    ...(department_code ? { department_code } : {}),
  };
}

async function meHandler(req: AuthedReq, res: ApiRes) {
  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'PATCH') {
      const raw = await readJsonBody(req);
      if (!raw || typeof raw !== 'object') {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;
      const department_code_raw = getString(body.department_code);
      if (!isAllowedDepartmentCode(department_code_raw)) {
        return sendError(res, 400, 'Bad request', 'ต้องเลือกแผนก (LBD หรือ LBA)');
      }
      const department_code = department_code_raw.trim().toUpperCase();

      const { rows: curRows } = await dbQuery<UserRow>(
        `
        select id, email, role, full_name, is_active, created_at, department_code
        from ${usersTable}
        where id = $1
        limit 1
      `,
        [req.user.sub],
      );
      const cur = curRows[0];
      if (!cur || !cur.is_active) {
        return sendError(res, 401, 'Unauthorized', 'User not found or inactive');
      }
      if (cur.role === 'admin') {
        return sendError(res, 400, 'Bad request', 'Admin ไม่ต้องเลือกแผนก');
      }
      if (normalizeDepartmentCode(cur.department_code)) {
        return sendError(
          res,
          403,
          'Forbidden',
          'เปลี่ยนแผนกไม่ได้ — ติดต่อ Admin ให้แก้ไขใน Settings',
        );
      }

      const { rows } = await dbQuery<UserRow>(
        `
        update ${usersTable}
        set department_code = $2
        where id = $1 and (department_code is null or btrim(department_code) = '')
        returning id, email, role, full_name, is_active, created_at, department_code
      `,
        [req.user.sub, department_code],
      );
      const row = rows[0];
      if (!row) {
        return sendError(
          res,
          403,
          'Forbidden',
          'เปลี่ยนแผนกไม่ได้ — ติดต่อ Admin ให้แก้ไขใน Settings',
        );
      }
      return res.status(200).json({ user: toUserResponse(row) });
    }

    if (method !== 'GET') {
      return sendError(res, 405, 'Method not allowed');
    }

    const { rows } = await dbQuery<UserRow>(
      `
      select id, email, role, full_name, is_active, created_at, department_code
      from ${usersTable}
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

export default withAuth(meHandler, { roles: ['opl', 'staff', 'supervisor', 'admin'] });
