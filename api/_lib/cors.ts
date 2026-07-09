import type { ApiReq, ApiRes } from './http.js';
import { isProductionRuntime } from './runtime.js';

function parseAllowedOrigins(): Set<string> {
  const raw = (process.env.CORS_ALLOWED_ORIGINS || '').trim();
  const defaults = isProductionRuntime()
    ? []
    : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:8080', 'http://127.0.0.1:8080'];
  const fromEnv = raw
    ? raw.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
    : defaults;
  return new Set(fromEnv);
}

let cachedOrigins: Set<string> | null = null;

export function getCorsAllowedOrigins(): Set<string> {
  if (!cachedOrigins) cachedOrigins = parseAllowedOrigins();
  return cachedOrigins;
}

export function resetCorsCacheForTests(): void {
  cachedOrigins = null;
}

export function resolveCorsOrigin(req: ApiReq): string | null {
  const originHeader = req.headers?.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  if (!origin || typeof origin !== 'string') return null;
  const trimmed = origin.trim();
  if (!trimmed) return null;
  const allowed = getCorsAllowedOrigins();
  if (allowed.size === 0) return null;
  return allowed.has(trimmed) ? trimmed : null;
}

/** Set CORS response headers. Returns matched origin or null. */
export function applyCorsHeaders(req: ApiReq, res: ApiRes): string | null {
  const allowedOrigin = resolveCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader?.('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader?.('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader?.('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader?.('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader?.('Vary', 'Origin');
  return allowedOrigin;
}
