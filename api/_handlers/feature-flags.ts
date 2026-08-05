import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody } from '../_lib/body.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { isFeatureId, type FeatureFlag } from '../../src/lib/featureFlags.js';

const table = tableInAppSchema('feature_flags');

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

type Row = {
  feature_id: string;
  enabled: boolean;
  note: string | null;
  updated_at: string | null;
};

/**
 * สวิตช์แม่ระดับฟีเจอร์ — คนละชั้นกับ /api/role-permissions (สิทธิ์)
 *
 * GET   — ทุก role ที่ล็อกอิน (หน้าเว็บต้องรู้ว่าอะไรเปิดอยู่ถึงจะซ่อนเมนูได้ถูก)
 * PATCH — admin เท่านั้น (บังคับที่ rbac)
 *
 * ฟีเจอร์ที่ไม่มีแถวในตาราง = เปิด (ค่าเริ่มต้น) จึงไม่ต้อง seed ตอนเพิ่มฟีเจอร์ใหม่
 */
async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') {
      const { rows } = await dbQuery<Row>(
        `SELECT feature_id, enabled, note, updated_at FROM ${table}`,
      );
      const items: FeatureFlag[] = rows.map((r) => ({
        featureId: r.feature_id,
        enabled: !!r.enabled,
        note: r.note,
        updatedAt: r.updated_at,
      }));
      return res.status(200).json(items);
    }

    if (method === 'PATCH') {
      const body = await readJsonBody(req);
      if (!isPlainObject(body)) return sendError(res, 400, 'Bad request');
      const featureId = typeof body.featureId === 'string' ? body.featureId : '';
      if (!isFeatureId(featureId)) {
        return sendError(res, 400, 'Bad request', 'ไม่รู้จักฟีเจอร์นี้');
      }
      const enabled = !!body.enabled;
      const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) || null : null;

      await dbQuery(
        `INSERT INTO ${table} (feature_id, enabled, note, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (feature_id) DO UPDATE
           SET enabled = excluded.enabled,
               note = excluded.note,
               updated_at = now(),
               updated_by = excluded.updated_by`,
        [featureId, enabled, note, req.user?.sub ?? null],
      );
      return res.status(200).json({ featureId, enabled, note });
    }

    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'feature-flags', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'feature-flags');
