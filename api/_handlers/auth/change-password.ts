import { dbQuery } from '../../_lib/postgres.js';
import { hashPassword, verifyPassword } from '../../_lib/auth.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type AuthedReq,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';

type UserRow = {
  id: string;
  password_hash: string;
  is_active: boolean;
};

async function changePasswordHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const body = raw as Record<string, unknown>;
    const currentPassword = getString(body.current_password);
    const newPassword = getString(body.new_password);

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Bad request', 'current_password and new_password are required');
    }
    if (newPassword.length < 8) {
      return sendError(res, 400, 'Bad request', 'new_password must be at least 8 characters');
    }
    if (currentPassword === newPassword) {
      return sendError(res, 400, 'Bad request', 'new_password must be different from current password');
    }

    const { rows } = await dbQuery<UserRow>(
      `
      select id, password_hash, is_active
      from users
      where id = $1
      limit 1
    `,
      [req.user.sub],
    );
    const user = rows[0];
    if (!user || !user.is_active) {
      return sendError(res, 401, 'Unauthorized', 'User not found or inactive');
    }

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      return sendError(res, 401, 'Unauthorized', 'รหัสผ่านเดิมไม่ถูกต้อง');
    }

    const nextHash = await hashPassword(newPassword);
    await dbQuery(
      `
      update users
      set password_hash = $1
      where id = $2
    `,
      [nextHash, user.id],
    );

    return res.status(200).json({ message: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
  } catch (e) {
    return handleApiError(res, e, 'auth/change-password');
  }
}

export default withAuth(changePasswordHandler, { roles: ['staff', 'supervisor', 'admin'] });
