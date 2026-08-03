import { randomBytes } from 'node:crypto';
import { dbQuery } from '../../_lib/postgres.js';
import { getJwtSecret, hashPassword, type UserRole } from '../../_lib/auth.js';
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
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

function getQuery(req: ApiReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

function isUserRole(v: unknown): v is UserRole {
  return v === 'admin' || v === 'supervisor' || v === 'staff' || v === 'opl';
}

type AzureUserRow = AuthUserRow & { azure_oid: string | null };

const FIND_USER_SQL = `
  select id, email, role, full_name, is_active, created_at, azure_oid, department_code
  from ${usersTable}
  where azure_oid = $1 or lower(email) = lower($2)
  order by case when azure_oid = $1 then 0 else 1 end
  limit 1
`;

/**
 * สร้าง account ใหม่อัตโนมัติสำหรับคนที่ login ผ่าน Microsoft แล้วยังไม่มีในระบบ
 * (นโยบาย 3 ส.ค. 2569: ทั้งบริษัทจะย้ายไป login ด้วย Microsoft — อีเมลตรงใช้ account เดิม
 * ไม่มีก็เปิดให้เลย ไม่ต้องสมัครเอง)
 *
 * ปลอดภัยเพราะ token แลกกับ tenant ของบริษัทเท่านั้น (AZURE_AD_TENANT_ID เจาะจง ไม่ใช่ common)
 * — คนนอก tenant ผ่านขั้น exchangeAzureAuthCode ไม่ได้ · role เริ่มต้น staff เหมือนสมัครปกติ
 * password_hash ใส่ค่าสุ่มที่ไม่มีใครรู้ (ตาราง users บังคับ not null) — บัญชีนี้เข้าได้ทาง SSO เท่านั้น
 * จนกว่าจะตั้งรหัสผ่านผ่าน forgot-password
 */
async function provisionAzureUser(profile: {
  oid: string;
  email: string;
  name: string;
}): Promise<AzureUserRow | null> {
  const unusablePassword = await hashPassword(randomBytes(32).toString('hex'));
  const { rows } = await dbQuery<AzureUserRow>(
    `
    insert into ${usersTable} (email, password_hash, role, full_name, is_active, azure_oid)
    values ($1, $2, 'staff', $3, true, $4)
    on conflict (lower(email)) do nothing
    returning id, email, role, full_name, is_active, created_at, azure_oid, department_code
  `,
    [profile.email, unusablePassword, profile.name || profile.email, profile.oid],
  );
  if (rows[0]) return rows[0];
  // แพ้ race กับ insert อื่น (เช่นแอดมินเพิ่งสร้างให้) → อ่านแถวที่มีอยู่มาใช้แทน
  const again = await dbQuery<AzureUserRow>(FIND_USER_SQL, [profile.oid, profile.email]);
  return again.rows[0] ?? null;
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

    const { rows } = await dbQuery<AzureUserRow>(FIND_USER_SQL, [profile.oid, profile.email]);

    let row = rows[0];
    if (!row) {
      // อีเมลนี้ยังไม่มีในระบบ → เปิด account ใหม่ให้เลย (role staff) แล้ว login ต่อทันที
      const created = await provisionAzureUser(profile);
      if (created) {
        await auditFromAnonymous(req, { userId: created.id, userName: profile.email, userRole: created.role }, {
          action: 'auth.azure_ad.provisioned',
          entityType: 'app_user',
          entityId: created.id,
          after: { email: profile.email, role: created.role, oid: profile.oid },
        });
      }
      row = created ?? undefined;
    }

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
        `update ${usersTable} set azure_oid = $1, updated_at = now() where id = $2 and azure_oid is null`,
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
