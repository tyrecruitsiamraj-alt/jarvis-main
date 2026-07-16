import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret, type UserRole } from '../../_lib/auth.js';
import {
  azureAuthErrorRedirect,
  buildOAuthClearCookies,
  exchangeAzureAuthCode,
  fetchAzureProfile,
  isAzureAdConfigured,
  readOAuthCookies,
} from '../../_lib/azureAdAuth.js';
import { isCompanyEmail, isCompanyEmailLoginEnforced } from '../../_lib/companyEmail.js';
import { sendError, handleApiError, sendRedirect, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { issueAuthSessionRedirect, type AuthUserRow } from '../../_lib/authSession.js';
import { auditFromAnonymous } from '../../_lib/audit.js';

function getQuery(req: ApiReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff' || v === 'opl';
}

function redirectWithClear(
  res: ApiRes,
  location: string,
): void {
  sendRedirect(res, location, buildOAuthClearCookies());
}

export default async function azureAdCallbackHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  if (!isAzureAdConfigured()) {
    return sendError(res, 503, 'Service unavailable', 'Azure AD login is not configured');
  }

  const { state: savedState, returnTo } = readOAuthCookies(req);
  const oauthError = getQuery(req, 'error');
  if (oauthError) {
    redirectWithClear(res, azureAuthErrorRedirect('oauth', returnTo));
    return;
  }

  const state = getQuery(req, 'state');
  const code = getQuery(req, 'code');
  if (!savedState || !state || savedState !== state) {
    redirectWithClear(res, azureAuthErrorRedirect('state', returnTo));
    return;
  }
  if (!code) {
    redirectWithClear(res, azureAuthErrorRedirect('oauth', returnTo));
    return;
  }

  try {
    const tokens = await exchangeAzureAuthCode(code);
    const profile = await fetchAzureProfile(tokens.access_token!);

    if (isCompanyEmailLoginEnforced() && !isCompanyEmail(profile.email)) {
      await auditFromAnonymous(req, { userName: profile.email }, {
        action: 'auth.azure_ad.failed',
        entityType: 'auth',
        entityId: 'callback',
        after: { reason: 'company_email_required' },
      });
      redirectWithClear(res, azureAuthErrorRedirect('domain', returnTo));
      return;
    }

    const { rows } = await dbQuery<AuthUserRow & { azure_oid: string | null }>(
      `
      select id, email, role, full_name, is_active, created_at, azure_oid, department_code
      from users
      where azure_oid = $1 or lower(email) = lower($2)
      order by case when azure_oid = $1 then 0 else 1 end
      limit 1
    `,
      [profile.oid, profile.email],
    );

    const row = rows[0];
    if (!row || !isUserRole(row.role)) {
      await auditFromAnonymous(req, { userName: profile.email }, {
        action: 'auth.azure_ad.failed',
        entityType: 'auth',
        entityId: 'callback',
        after: { reason: 'no_account', oid: profile.oid },
      });
      redirectWithClear(res, azureAuthErrorRedirect('no_account', returnTo));
      return;
    }

    if (!row.is_active) {
      await auditFromAnonymous(req, { userId: row.id, userName: profile.email, userRole: row.role }, {
        action: 'auth.azure_ad.failed',
        entityType: 'auth',
        entityId: row.id,
        after: { reason: 'account_disabled' },
      });
      redirectWithClear(res, azureAuthErrorRedirect('disabled', returnTo));
      return;
    }

    if (!row.azure_oid) {
      await dbQuery(
        `update users set azure_oid = $1, updated_at = now() where id = $2 and azure_oid is null`,
        [profile.oid, row.id],
      );
    }

    const redirectUrl = await issueAuthSessionRedirect(
      req,
      res,
      row,
      returnTo,
      'auth.azure_ad.success',
      buildOAuthClearCookies(),
    );
    sendRedirect(res, redirectUrl);
  } catch (e) {
    return handleApiError(res, e, 'auth/azure-ad-callback');
  }
}
