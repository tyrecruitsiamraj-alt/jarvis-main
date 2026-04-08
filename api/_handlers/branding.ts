import { dbQuery } from '../_lib/postgres.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type ApiReq,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const table = tableInAppSchema('app_branding');

const MAX_LOGO_CHARS = 1_200_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sanitizeBranding(body: unknown): Record<string, unknown> | null {
  if (!isPlainObject(body)) return null;
  const out: Record<string, unknown> = {};
  const s = (k: string) => (typeof body[k] === 'string' ? (body[k] as string) : undefined);

  const appName = s('appName');
  if (appName !== undefined) out.appName = appName.slice(0, 200);

  if ('logoDataUrl' in body) {
    const logo = body.logoDataUrl;
    if (logo === null) out.logoDataUrl = null;
    else if (typeof logo === 'string') {
      if (logo.length > MAX_LOGO_CHARS) return null;
      out.logoDataUrl = logo;
    }
  }

  for (const k of [
    'primaryHsl',
    'backgroundHsl',
    'foregroundHsl',
    'cardHsl',
    'gradientFromHsl',
    'gradientToHsl',
  ] as const) {
    const v = s(k);
    if (v !== undefined) out[k] = v.slice(0, 80);
  }

  const mode = s('pageBackgroundMode');
  if (mode === 'solid' || mode === 'gradient') out.pageBackgroundMode = mode;

  return out;
}

async function getBranding(_req: ApiReq, res: ApiRes): Promise<void> {
  try {
    const { rows } = await dbQuery<{ payload: unknown }>(
      `select payload from ${table} where id = 'default' limit 1`,
    );
    const row = rows[0];
    if (!row || row.payload === null || row.payload === undefined) {
      res.status(200).json({ config: null });
      return;
    }
    const p = row.payload;
    if (typeof p === 'object' && p !== null && !Array.isArray(p) && Object.keys(p as object).length === 0) {
      res.status(200).json({ config: null });
      return;
    }
    res.status(200).json({ config: typeof p === 'object' && p !== null ? p : null });
  } catch (e) {
    handleApiError(res, e, 'branding GET');
  }
}

async function putBranding(req: AuthedReq, res: ApiRes): Promise<void> {
  try {
    const raw = await readJsonBody(req);
    if (!isPlainObject(raw)) {
      return sendError(res, 400, 'Bad request', 'Expected JSON object');
    }
    const body = (raw as { config?: unknown }).config ?? raw;
    const sanitized = sanitizeBranding(body);
    if (!sanitized) {
      return sendError(res, 400, 'Bad request', 'Invalid branding payload or logo too large');
    }

    await dbQuery(
      `
      insert into ${table} (id, payload, updated_at)
      values ('default', $1::jsonb, now())
      on conflict (id) do update set
        payload = excluded.payload,
        updated_at = now()
      `,
      [JSON.stringify(sanitized)],
    );

    res.status(200).json({ ok: true, config: sanitized });
  } catch (e) {
    handleApiError(res, e, 'branding PUT', { userId: req.user.sub });
  }
}

const adminPut = withAuth(putBranding, { roles: ['admin'] });

export default async function brandingHandler(req: ApiReq, res: ApiRes): Promise<void> {
  const m = (req.method || 'GET').toUpperCase();
  if (m === 'GET') {
    await getBranding(req, res);
    return;
  }
  if (m === 'PUT' || m === 'PATCH') {
    await adminPut(req, res);
    return;
  }
  sendError(res, 405, 'Method not allowed');
}
