/**
 * Vercel: one Serverless Function for all /api/* (Hobby plan 12-fn limit).
 * Local dev uses server/local-api.ts instead.
 */
import { apiRoutes } from './_handlers/registry.js';
import type { ApiReq, ApiRes } from './_lib/http.js';
import { applyCorsHeaders } from './_lib/cors.js';
import { isProductionRuntime } from './_lib/runtime.js';
import { logError } from './_lib/logger.js';

/** Vercel injects Node-compatible req/res; avoid @vercel/node dependency here. */
type VercelishReq = {
  method?: string;
  /** บน Vercel บางกรณีเป็น `undefined` — อย่าเข้าถึงตรงๆ โดยไม่มี fallback */
  query?: Record<string, string | string[] | undefined>;
  url?: string;
  body?: unknown;
  headers?: import('http').IncomingHttpHeaders;
};
type VercelishRes = {
  status: (code: number) => { json: (body: unknown) => void; end: (chunk?: string) => void };
  setHeader: (name: string, value: string | number | ReadonlyArray<string>) => void;
  end: (chunk?: string) => void;
};

function pathnameFromCatchAll(pathParam: string | string[] | undefined): string {
  if (pathParam === undefined) return '/api';
  const segments = Array.isArray(pathParam) ? pathParam : [pathParam];
  const joined = segments
    .filter((s) => s !== undefined && s !== '')
    .map((s) => decodeURIComponent(String(s)))
    .join('/');
  return joined ? `/api/${joined}` : '/api';
}

/** ถ้า catch-all query ว่าง ให้อ่าน path จาก req.url (พฤติกรรม Vercel / rewrite) */
function resolveApiPathname(req: VercelishReq): string {
  const q = req.query ?? {};
  const fromCatchAll = pathnameFromCatchAll(q.path);
  if (fromCatchAll !== '/api') return fromCatchAll;

  const raw = req.url || '';
  try {
    const pathname = new URL(raw, 'http://localhost').pathname;
    if (pathname.startsWith('/api') && pathname.length > 4) return pathname;
  } catch {
    /* ignore */
  }
  return fromCatchAll;
}

/** Vercel / proxy บางกรณีส่ง method ว่าง — อ่านจาก header สำรอง */
function resolveHttpMethod(req: VercelishReq): string {
  const raw = req.method;
  if (typeof raw === 'string' && raw.trim() !== '') {
    return raw.toUpperCase();
  }
  const h = req.headers ?? {};
  const pick = (key: string): string | undefined => {
    const v = h[key] ?? h[key.toLowerCase()];
    if (Array.isArray(v)) return v[0];
    return typeof v === 'string' ? v : undefined;
  };
  const override = pick('x-http-method-override') ?? pick('x-vercel-http-method');
  if (override?.trim()) return override.toUpperCase();
  return 'GET';
}

export default async function handler(req: VercelishReq, res: VercelishRes): Promise<void> {
  const method = resolveHttpMethod(req);
  const vercelReq: ApiReq = {
    method,
    query: {},
    body: req.body,
    headers: (req.headers ?? {}) as Record<string, string | string[] | undefined>,
  };

  const apiRes = res as unknown as ApiRes;
  const allowedOrigin = applyCorsHeaders(vercelReq, apiRes);

  if (method === 'OPTIONS') {
    if (allowedOrigin) {
      res.status(204).end();
    } else {
      res.status(403).json({ error: 'Forbidden', message: 'CORS origin not allowed' });
    }
    return;
  }

  const pathname = resolveApiPathname(req);
  const fn = apiRoutes[pathname];
  if (!fn) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const query: Record<string, unknown> = { ...((req.query ?? {}) as Record<string, unknown>) };
  delete query.path;
  vercelReq.query = query;

  try {
    await fn(vercelReq, apiRes);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    logError('api.catch-all', { path: pathname, message: detail, stack: e instanceof Error ? e.stack : undefined });
    try {
      if (isProductionRuntime()) {
        res.status(500).json({ error: 'Internal server error' });
      } else {
        res.status(500).json({ error: 'Internal server error', message: detail });
      }
    } catch {
      /* response already sent */
    }
  }
}
