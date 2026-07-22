import { randomBytes } from 'node:crypto';
import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('short_links');

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; // no 0/O/1/I/l
const CODE_LEN = 6;

function genCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = '';
  for (let i = 0; i < CODE_LEN; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** Only allow shortening in-app public paths (prevents open-redirect abuse). */
function isAllowedTarget(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return path === '/apply' || path.startsWith('/apply?') || path.startsWith('/apply/');
}

/** POST /api/short-links { targetPath } → { code, path } (authed) */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const raw = await readJsonBody(req);
    const targetPath = getString((raw as Record<string, unknown> | null)?.targetPath);
    if (!targetPath || !isAllowedTarget(targetPath)) {
      return sendError(res, 400, 'Bad request', 'targetPath ต้องเป็นลิงก์ /apply ภายในระบบ');
    }

    // one short link per target — reuse if it already exists
    const existing = await dbQuery<{ code: string }>(
      `select code from ${tbl} where target_path = $1 limit 1`,
      [targetPath],
    );
    if (existing.rows[0]) {
      return res.status(200).json({ code: existing.rows[0].code, path: `/s/${existing.rows[0].code}` });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = genCode();
      try {
        const { rows } = await dbQuery<{ code: string }>(
          `insert into ${tbl} (code, target_path, created_by) values ($1, $2, $3) returning code`,
          [code, targetPath, req.user.sub],
        );
        return res.status(201).json({ code: rows[0].code, path: `/s/${rows[0].code}` });
      } catch (e) {
        // unique violation on code → retry; unique violation on target → someone raced us, re-read
        const msg = e instanceof Error ? e.message : '';
        if (/target_path/.test(msg)) {
          const raced = await dbQuery<{ code: string }>(
            `select code from ${tbl} where target_path = $1 limit 1`,
            [targetPath],
          );
          if (raced.rows[0]) {
            return res.status(200).json({ code: raced.rows[0].code, path: `/s/${raced.rows[0].code}` });
          }
        }
        if (attempt === 4) throw e;
      }
    }
    return sendError(res, 500, 'Failed to create short link');
  } catch (e) {
    return handleApiError(res, e, 'short-links POST', { userId: req.user.sub });
  }
}

export default withRbac(handler, 'job-applications');
