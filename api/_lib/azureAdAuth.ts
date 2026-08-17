import { createHash, randomBytes } from 'node:crypto';
import { getAppPublicUrl } from './postmark.js';
import { isProductionLike, parseCookies } from './auth.js';

const OAUTH_STATE_COOKIE = 'jarvis_oauth_state';
const OAUTH_RETURN_COOKIE = 'jarvis_oauth_return';
const OAUTH_STATE_TTL_SEC = 600;

export type AzureAdProfile = {
  oid: string;
  email: string;
  name: string;
};

export function isAzureAdConfigured(): boolean {
  const clientId = (process.env.AZURE_AD_CLIENT_ID || '').trim();
  const clientSecret = (process.env.AZURE_AD_CLIENT_SECRET || '').trim();
  const tenantId = (process.env.AZURE_AD_TENANT_ID || '').trim();
  return Boolean(clientId && clientSecret && tenantId);
}

function tenantId(): string {
  const id = (process.env.AZURE_AD_TENANT_ID || '').trim();
  if (!id) throw new Error('AZURE_AD_TENANT_ID is not configured');
  return id;
}

function clientId(): string {
  const id = (process.env.AZURE_AD_CLIENT_ID || '').trim();
  if (!id) throw new Error('AZURE_AD_CLIENT_ID is not configured');
  return id;
}

function clientSecret(): string {
  const s = (process.env.AZURE_AD_CLIENT_SECRET || '').trim();
  if (!s) throw new Error('AZURE_AD_CLIENT_SECRET is not configured');
  return s;
}

export function azureAdRedirectUri(): string {
  const base = getAppPublicUrl();
  if (!base) throw new Error('APP_PUBLIC_URL must be configured for Azure AD login');
  return `${base}/api/auth/azure-ad/callback`;
}

export function azureAdScopes(): string {
  return (
    (process.env.AZURE_AD_SCOPES || 'openid profile email User.Read').trim() ||
    'openid profile email User.Read'
  );
}

/**
 * อนุญาตเฉพาะ path ภายในแอป (ป้องกัน open redirect)
 *
 * ค่านี้จบที่ header `Location` ตอน login เสร็จ ถ้าหลุดออกนอกเว็บได้
 * = พาผู้ใช้ที่เพิ่งล็อกอินไปหน้าปลอมได้ทันที จึงต้องแน่นเป็นพิเศษ
 *
 * ⚠️ **เบราว์เซอร์ normalize URL ก่อนใช้** — สองอย่างนี้ผ่านด่าน "ขึ้นต้นด้วย / และไม่ใช่ //"
 * ได้ทั้งคู่แต่กลายเป็น protocol-relative ตอนเบราว์เซอร์อ่าน:
 *   · `\` ถูกแปลงเป็น `/` → `/\evil.com` กลายเป็น `//evil.com`
 *   · อักขระควบคุม (tab/newline/CR) ถูกตัดทิ้ง → `/<tab>/evil.com` กลายเป็น `//evil.com`
 * ตอนนี้ยังกันได้อีกชั้นเพราะ `azureAuthSuccessRedirect()` เติม origin ของแอปไว้ข้างหน้า
 * **แต่พึ่งไม่ได้** — `getAppPublicUrl()` คืนสตริงว่างเมื่อไม่ได้ตั้ง `APP_PUBLIC_URL`
 * และ `isAzureAdConfigured()` ไม่ได้บังคับให้ตั้งค่านั้น (เช็คแค่ client id/secret/tenant)
 * เจอสภาพนั้นเมื่อไหร่ base เป็นค่าว่าง แล้ว `/\evil.com` ก็ออกนอกเว็บได้จริง
 */
export function sanitizeReturnPath(raw: string | null | undefined): string {
  const v = (raw || '/').trim();
  if (!v.startsWith('/') || v.startsWith('//')) return '/';
  if (v.includes('\\')) return '/';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(v)) return '/';
  if (v.startsWith('/api/')) return '/';
  return v;
}

function oauthCookieFlags(maxAgeSec: number): string {
  const https = (getAppPublicUrl() || '').startsWith('https://');
  if (https || isProductionLike()) {
    return `Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAgeSec}`;
  }
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

function cookieFlags(maxAgeSec: number): string {
  const secure = isProductionLike() ? 'Secure; ' : '';
  const sameSite = process.env.AUTH_COOKIE_SAMESITE === 'strict' ? 'Strict' : 'Lax';
  return `Path=/; HttpOnly; ${secure}SameSite=${sameSite}; Max-Age=${maxAgeSec}`;
}

export function buildOAuthStartCookies(state: string, returnTo: string): string[] {
  const flags = oauthCookieFlags(OAUTH_STATE_TTL_SEC);
  return [
    `${OAUTH_STATE_COOKIE}=${encodeURIComponent(state)}; ${flags}`,
    `${OAUTH_RETURN_COOKIE}=${encodeURIComponent(returnTo)}; ${flags}`,
  ];
}

export function buildOAuthClearCookies(): string[] {
  const flags = oauthCookieFlags(0);
  return [
    `${OAUTH_STATE_COOKIE}=; ${flags}`,
    `${OAUTH_RETURN_COOKIE}=; ${flags}`,
  ];
}

export function readOAuthCookies(req: {
  headers?: Record<string, string | string[] | undefined>;
}): { state: string | null; returnTo: string } {
  const raw = req.headers?.cookie;
  const cookieHeader = Array.isArray(raw) ? raw.join('; ') : raw;
  const cookies = parseCookies(cookieHeader);
  const state = cookies[OAUTH_STATE_COOKIE]?.trim() || null;
  const returnTo = sanitizeReturnPath(cookies[OAUTH_RETURN_COOKIE]);
  return { state, returnTo };
}

export function createOAuthState(): string {
  return randomBytes(24).toString('hex');
}

export function buildAzureAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: azureAdRedirectUri(),
    response_mode: 'query',
    scope: azureAdScopes(),
    state,
    prompt: 'select_account',
  });
  return `https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/authorize?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  id_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export async function exchangeAzureAuthCode(code: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: azureAdRedirectUri(),
    scope: azureAdScopes(),
  });

  const res = await fetch(`https://login.microsoftonline.com/${tenantId()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    const detail = data.error_description || data.error || `HTTP ${res.status}`;
    throw new Error(`Azure token exchange failed: ${detail}`);
  }
  if (!data.access_token) {
    throw new Error('Azure token exchange returned no access_token');
  }
  return data;
}

type GraphMe = {
  id?: string;
  displayName?: string;
  mail?: string | null;
  userPrincipalName?: string;
};

export async function fetchAzureProfile(accessToken: string): Promise<AzureAdProfile> {
  const res = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json().catch(() => ({}))) as GraphMe;
  if (!res.ok) {
    throw new Error('Failed to read Microsoft profile (User.Read)');
  }

  const oid = typeof data.id === 'string' ? data.id : '';
  const email = (data.mail || data.userPrincipalName || '').trim().toLowerCase();
  const name = (data.displayName || email).trim();
  if (!oid || !email) {
    throw new Error('Microsoft profile missing id or email');
  }
  return { oid, email, name };
}

export function azureAuthErrorRedirect(code: string, returnTo = '/'): string {
  const base = getAppPublicUrl() || '';
  const path = sanitizeReturnPath(returnTo);
  const q = new URLSearchParams({ auth_error: code });
  return `${base}${path}?${q.toString()}`;
}

export function azureAuthSuccessRedirect(returnTo: string): string {
  const base = getAppPublicUrl() || '';
  return `${base}${sanitizeReturnPath(returnTo)}`;
}

/** cache-bust fingerprint for OID (optional logging) */
export function hashOid(oid: string): string {
  return createHash('sha256').update(oid).digest('hex').slice(0, 16);
}
