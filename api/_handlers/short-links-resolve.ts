import { dbQuery } from '../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('short_links');

/** GET /api/short-links/resolve?code=CODE → { targetPath } (public, used by /s/:code) */
export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');

  const code = getString(req.query?.code);
  if (!code) return sendError(res, 400, 'Bad request', 'code required');

  try {
    const { rows } = await dbQuery<{ target_path: string }>(
      `update ${tbl} set hit_count = hit_count + 1 where code = $1 returning target_path`,
      [code],
    );
    if (!rows[0]) return sendError(res, 404, 'Not found', 'ลิงก์ไม่ถูกต้องหรือหมดอายุ');
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({ targetPath: rows[0].target_path });
  } catch (e) {
    return handleApiError(res, e, 'short-links resolve');
  }
}
