import { dbQuery } from '../../_lib/postgres.js';
import { hashPassword } from '../../_lib/auth.js';
import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { consumePasswordResetToken } from '../../_lib/passwordReset.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

async function resetPasswordHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!rateLimitOrReject(req, res, 'auth:reset-password', 10, 60 * 60 * 1000)) return;

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const body = raw as Record<string, unknown>;
    const token = getString(body.token);
    const newPassword = getString(body.new_password) || getString(body.password);

    if (!token || !newPassword) {
      return sendError(res, 400, 'Bad request', 'token and new_password are required');
    }
    if (newPassword.length < 8) {
      return sendError(res, 400, 'Bad request', 'new_password must be at least 8 characters');
    }

    const consumed = await consumePasswordResetToken(token);
    if (!consumed) {
      return sendError(res, 400, 'Bad request', 'ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว');
    }

    const password_hash = await hashPassword(newPassword);
    await dbQuery(
      `
      update ${usersTable}
      set password_hash = $1, updated_at = now()
      where id = $2 and is_active = true
    `,
      [password_hash, consumed.userId],
    );

    await auditFromAnonymous(req, { userId: consumed.userId, userName: 'password-reset' }, {
      action: 'auth.password_reset.completed',
      entityType: 'auth',
      entityId: consumed.userId,
    });

    return res.status(200).json({ message: 'ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว — กรุณาเข้าสู่ระบบ' });
  } catch (e) {
    return handleApiError(res, e, 'auth/reset-password');
  }
}

export default resetPasswordHandler;
