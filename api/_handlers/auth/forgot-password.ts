import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { dbQuery } from '../../_lib/postgres.js';
import { hashPassword } from '../../_lib/auth.js';

function genTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function forgotPasswordHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const email = getString((raw as Record<string, unknown>).email)?.toLowerCase();
    if (!email) {
      return sendError(res, 400, 'Bad request', 'email is required');
    }

    const lookup = await dbQuery<{ id: string; is_active: boolean }>(
      `
      select id, is_active
      from users
      where lower(email) = lower($1)
      limit 1
    `,
      [email],
    );
    const user = lookup.rows[0];
    if (!user) {
      return sendError(res, 404, 'Not found', 'ไม่พบบัญชีผู้ใช้นี้ในระบบ');
    }
    if (!user.is_active) {
      return sendError(res, 403, 'Forbidden', 'บัญชีนี้ถูกปิดใช้งาน');
    }

    const tempPassword = genTempPassword(12);
    const password_hash = await hashPassword(tempPassword);
    await dbQuery(
      `
      update users
      set password_hash = $1
      where id = $2
    `,
      [password_hash, user.id],
    );

    return res.status(200).json({
      message: `รีเซ็ตรหัสผ่านแล้ว ใช้รหัสชั่วคราวนี้เพื่อล็อกอิน: ${tempPassword}`,
    });
  } catch (e) {
    return handleApiError(res, e, 'auth/forgot-password');
  }
}

export default forgotPasswordHandler;
