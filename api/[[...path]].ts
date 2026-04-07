/**
 * Vercel: one Serverless Function for all /api/* (Hobby plan 12-fn limit).
 * Local dev uses server/local-api.ts instead.
 */
import { apiRoutes } from './_handlers/registry.js';
import type { ApiReq, ApiRes } from './_lib/http.js';

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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  if (resolveHttpMethod(req) === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const pathname = resolveApiPathname(req);
  const fn = apiRoutes[pathname];
  if (!fn) {
    res.status(404).json({ error: 'Not found', path: pathname });
    return;
  }

  const query: Record<string, unknown> = { ...((req.query ?? {}) as Record<string, unknown>) };
  delete query.path;

  const vercelReq: ApiReq = {
    method: resolveHttpMethod(req),
    query,
    body: req.body,
    headers: (req.headers ?? {}) as Record<string, string | string[] | undefined>,
  };

  try {
    await fn(vercelReq, res as unknown as ApiRes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    try {
      res.status(500).json({ error: 'Internal server error', message });
    } catch {
      /* response already sent */
    }
  }
}
