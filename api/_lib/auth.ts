import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

/** Matches frontend `UserRole` in src/types */
export type UserRole = 'admin' | 'supervisor' | 'staff';

export const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'jarvis_auth';

export function getJwtSecret(): string | null {
  const s = (process.env.AUTH_JWT_SECRET || '').trim();
  return s || null;
}

export function isProductionLike(): boolean {
  return process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
}

export type JwtUserPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export function signAuthToken(payload: JwtUserPayload, expiresInSeconds?: number): string {
  const secret = getJwtSecret();
  if (!secret) throw new Error('AUTH_JWT_SECRET is not configured');
  const ttl =
    expiresInSeconds ??
    (() => {
      const n = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 1800);
      return Number.isFinite(n) && n > 0 ? n : 1800;
    })();
  return jwt.sign(payload, secret, { expiresIn: ttl, algorithm: 'HS256' });
}

export function verifyAuthToken(token: string): JwtUserPayload {
  const secret = getJwtSecret();
  if (!secret) throw new Error('AUTH_JWT_SECRET is not configured');
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Invalid token payload');
  }
  const o = decoded as Record<string, unknown>;
  const sub = typeof o.sub === 'string' ? o.sub : '';
  const email = typeof o.email === 'string' ? o.email : '';
  const role = o.role;
  if (!sub || !email) throw new Error('Invalid token claims');
  if (role !== 'admin' && role !== 'supervisor' && role !== 'staff') {
    throw new Error('Invalid role in token');
  }
  return { sub, email, role };
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};
  const out: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getTokenFromReq(req: { headers?: Record<string, string | string[] | undefined> }): string | null {
  const raw = req.headers?.cookie;
  const cookieHeader = Array.isArray(raw) ? raw.join('; ') : raw;
  const cookies = parseCookies(cookieHeader);
  const t = cookies[AUTH_COOKIE_NAME];
  return t && t.trim() ? t.trim() : null;
}

export function buildSetCookieHeader(token: string, maxAgeSeconds: number): string {
  const secure = isProductionLike() ? 'Secure; ' : '';
  const sameSite = process.env.AUTH_COOKIE_SAMESITE === 'strict' ? 'Strict' : 'Lax';
  return `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secure}SameSite=${sameSite}; Max-Age=${maxAgeSeconds}`;
}

export function buildClearCookieHeader(): string {
  const secure = isProductionLike() ? 'Secure; ' : '';
  const sameSite = process.env.AUTH_COOKIE_SAMESITE === 'strict' ? 'Strict' : 'Lax';
  return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; ${secure}SameSite=${sameSite}; Max-Age=0`;
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
