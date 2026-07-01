import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { dbQuery } from '../../_lib/postgres.js';
import { createPasswordResetToken } from '../../_lib/passwordReset.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { logInfo } from '../../_lib/logger.js';
import { isProductionRuntime } from '../../_lib/runtime.js';
import { auditFromAnonymous } from '../../_lib/audit.js';

const GENERIC_FORGOT_MESSAGE =
  'หากมีบัญชีอีเมลนี้ในระบบ เราได้ส่งคำแนะนำการรีเซ็ตรหัสผ่านแล้ว กรุณาตรวจสอบอีเมลของคุณ';

async function forgotPasswordHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!rateLimitOrReject(req, res, 'auth:forgot-password', 5, 60 * 60 * 1000)) return;

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

    if (user?.is_active) {
      const token = await createPasswordResetToken(user.id);
      const appUrl = (process.env.APP_PUBLIC_URL || process.env.VITE_APP_URL || '').trim();
      const resetPath = `/reset-password?token=${encodeURIComponent(token)}`;
      const resetUrl = appUrl ? `${appUrl.replace(/\/$/, '')}${resetPath}` : resetPath;

      logInfo('auth.password_reset_issued', {
        userId: user.id,
        email,
        resetUrl: isProductionRuntime() ? '[redacted]' : resetUrl,
      });

      await auditFromAnonymous(req, { userId: user.id, userName: email }, {
        action: 'auth.password_reset.requested',
        entityType: 'auth',
        entityId: user.id,
      });

      // Email delivery is not wired yet — token is never returned in API response.
    }

    return res.status(200).json({ message: GENERIC_FORGOT_MESSAGE });
  } catch (e) {
    return handleApiError(res, e, 'auth/forgot-password');
  }
}

export default forgotPasswordHandler;
