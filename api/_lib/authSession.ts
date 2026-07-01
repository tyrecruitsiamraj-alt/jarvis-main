import {
  signAuthToken,
  buildSetCookieHeader,
  type UserRole,
} from './auth.js';
import { azureAuthSuccessRedirect } from './azureAdAuth.js';
import type { ApiReq, ApiRes } from './http.js';
import { auditFromAnonymous } from './audit.js';

export type AuthUserRow = {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  is_active: boolean;
  created_at: string | Date;
};

export function toUserResponse(row: AuthUserRow) {
  const created =
    row.created_at instanceof Date
      ? row.created_at.toISOString().slice(0, 10)
      : String(row.created_at).slice(0, 10);
  return {
    id: row.id,
    username: row.email,
    full_name: row.full_name || row.email,
    email: row.email,
    role: row.role,
    is_active: row.is_active,
    created_at: created,
  };
}

export type AuthSessionAuditAction =
  | 'auth.login.success'
  | 'auth.magic_link.success'
  | 'auth.azure_ad.success';

export async function issueAuthSession(
  req: ApiReq,
  res: ApiRes,
  row: AuthUserRow,
  auditAction: AuthSessionAuditAction,
): Promise<void> {
  const ttl = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 1800) || 1800;
  const token = signAuthToken({
    sub: row.id,
    email: row.email,
    role: row.role,
  });

  res.setHeader?.('Set-Cookie', buildSetCookieHeader(token, ttl));
  await auditFromAnonymous(req, { userId: row.id, userName: row.email, userRole: row.role }, {
    action: auditAction,
    entityType: 'auth',
    entityId: row.id,
    after: { role: row.role },
  });
  res.status(200).json({ user: toUserResponse(row) });
}

/** ออก session แล้วคืน URL สำหรับ redirect (OAuth callback) */
export async function issueAuthSessionRedirect(
  req: ApiReq,
  res: ApiRes,
  row: AuthUserRow,
  returnTo: string,
  auditAction: 'auth.azure_ad.success',
  extraCookies: string[] = [],
): Promise<string> {
  const ttl = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 1800) || 1800;
  const token = signAuthToken({
    sub: row.id,
    email: row.email,
    role: row.role,
  });

  const cookies = [buildSetCookieHeader(token, ttl), ...extraCookies];
  res.setHeader?.('Set-Cookie', cookies);
  await auditFromAnonymous(req, { userId: row.id, userName: row.email, userRole: row.role }, {
    action: auditAction,
    entityType: 'auth',
    entityId: row.id,
    after: { role: row.role },
  });

  return azureAuthSuccessRedirect(returnTo);
}
