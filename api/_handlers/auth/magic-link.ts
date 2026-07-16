import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret } from '../../_lib/auth.js';
import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import { auditFromAnonymous } from '../../_lib/audit.js';
import { createMagicLinkToken } from '../../_lib/magicLinkLogin.js';
import { sendEmail, isPostmarkConfigured } from '../../_lib/postmark.js';
import { buildAuthUrl, buildMagicLinkEmail } from '../../_lib/emailTemplates.js';
import {
  companyEmailRequiredMessage,
  isCompanyEmail,
} from '../../_lib/companyEmail.js';
import { logError } from '../../_lib/logger.js';
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

const GENERIC_MAGIC_LINK_MESSAGE =
  'หากมีบัญชีอีเมลบริษัทนี้ในระบบ เราได้ส่งลิงก์เข้าสู่ระบบไปแล้ว กรุณาตรวจสอบอีเมลของคุณ';

async function magicLinkHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'POST').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  if (!isPostmarkConfigured()) {
    return sendError(
      res,
      503,
      'Service unavailable',
      'ระบบส่งอีเมลยังไม่พร้อม — ติดต่อผู้ดูแลระบบ',
    );
  }

  if (!rateLimitOrReject(req, res, 'auth:magic-link', 5, 60 * 60 * 1000)) return;

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const email = getString((raw as Record<string, unknown>).email)?.toLowerCase();
    if (!email) {
      return sendError(res, 400, 'Bad request', 'email is required');
    }

    if (!isCompanyEmail(email)) {
      return sendError(res, 400, 'Bad request', companyEmailRequiredMessage());
    }

    const lookup = await dbQuery<{ id: string; is_active: boolean }>(
      `
      select id, is_active
      from ${usersTable}
      where lower(email) = lower($1)
      limit 1
    `,
      [email],
    );
    const user = lookup.rows[0];

    if (user?.is_active) {
      const token = await createMagicLinkToken(user.id);
      const loginPath = `/auth/magic-link?token=${encodeURIComponent(token)}`;
      const loginUrl = buildAuthUrl(loginPath);
      const expiresMinutes = Number(process.env.MAGIC_LINK_TTL_MINUTES || 15) || 15;
      const mail = buildMagicLinkEmail(loginUrl, expiresMinutes);

      try {
        await sendEmail({
          to: email,
          subject: mail.subject,
          textBody: mail.textBody,
          htmlBody: mail.htmlBody,
          tag: 'magic-link-login',
        });
      } catch (e) {
        logError('auth.magic_link.send_failed', { email });
        return sendError(res, 503, 'Service unavailable', 'ส่งอีเมลไม่สำเร็จ — ลองใหม่อีกครั้ง');
      }

      await auditFromAnonymous(req, { userId: user.id, userName: email }, {
        action: 'auth.magic_link.requested',
        entityType: 'auth',
        entityId: user.id,
      });
    }

    return res.status(200).json({ message: GENERIC_MAGIC_LINK_MESSAGE });
  } catch (e) {
    return handleApiError(res, e, 'auth/magic-link');
  }
}

export default magicLinkHandler;
