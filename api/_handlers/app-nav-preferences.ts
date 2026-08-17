/**
 * เมนูที่แอดมินจัดเอง (migration 093) — GET อ่านได้ทุกคน · PUT เฉพาะ admin
 *
 * อ่านได้ทุกคนเพราะทุกหน้าต้องใช้ตอน render เมนู · เขียนได้เฉพาะ admin เพราะ
 * เป็นค่าระดับระบบ (ทุกคนเห็นเหมือนกัน ไม่ใช่ค่าส่วนตัวรายคน)
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { normalizeNavPreferences } from '../../src/lib/navPreferences.js';

const table = tableInAppSchema('app_nav_preferences');

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  try {
    if (method === 'GET') {
      try {
        const { rows } = await dbQuery<{ payload: unknown }>(
          `select payload from ${table} where id = 'default' limit 1`,
        );
        res.setHeader?.('Cache-Control', 'no-store');
        return res.status(200).json({ preferences: normalizeNavPreferences(rows[0]?.payload) });
      } catch (e) {
        // ยังไม่รัน 093 → เมนูตั้งต้น (ห้ามพังทั้งแอปเพราะตารางเสริม)
        if (!isPgUndefinedTable(e)) throw e;
        return res.status(200).json({ preferences: {} });
      }
    }

    if (method === 'PUT') {
      if (req.user.role !== 'admin') {
        return sendError(res, 403, 'Forbidden', 'เฉพาะผู้ดูแลระบบเท่านั้นที่จัดเมนูได้');
      }
      const raw = await readJsonBody(req);
      const body = (raw ?? {}) as { preferences?: unknown };
      const preferences = normalizeNavPreferences(body.preferences);
      await dbQuery(
        `insert into ${table} (id, payload, updated_at, updated_by_name)
         values ('default', $1::jsonb, now(), $2)
         on conflict (id) do update
           set payload = excluded.payload, updated_at = now(),
               updated_by_name = excluded.updated_by_name`,
        [JSON.stringify(preferences), req.user.email ?? null],
      );
      return res.status(200).json({ preferences });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'app-nav-preferences');
  }
}

export default withRbac(handler, 'app-nav-preferences');
