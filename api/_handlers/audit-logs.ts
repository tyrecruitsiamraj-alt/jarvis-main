import { dbQuery } from '../_lib/postgres.js';
import {
  withAuth,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('audit_logs');

type Row = {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string | Date;
};

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toLog(row: Row) {
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    user_name: row.user_name,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value: row.old_value ?? undefined,
    new_value: row.new_value ?? undefined,
    timestamp: toIso(row.created_at),
  };
}

const parseLimit = (q: unknown): number => {
  const n = typeof q === 'string' ? Number(q) : typeof q === 'number' ? q : 100;
  return Math.min(500, Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 100));
};

async function handler(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'Only administrators can access audit logs');
  }

  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const limit = parseLimit(req.query?.limit);
      const { rows } = await dbQuery<Row>(
        `select * from ${tbl} order by created_at desc limit $1`,
        [limit],
      );
      return res.status(200).json(rows.map(toLog));
    } catch (e) {
      return handleApiError(res, e, 'audit-logs GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const action = getString(b.action);
      const entity_type = getString(b.entity_type);
      const entity_id = getString(b.entity_id);
      if (!action || !entity_type || !entity_id) {
        return sendError(res, 400, 'Bad request', 'action, entity_type, entity_id required');
      }
      const user_name =
        typeof b.user_name === 'string' && b.user_name.trim()
          ? b.user_name.trim()
          : req.user.email || 'user';
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const bodyUid = getString(b.user_id);
      const user_id = uuidRe.test(bodyUid) ? bodyUid : uuidRe.test(req.user.sub) ? req.user.sub : null;
      const old_value =
        typeof b.old_value === 'string' && b.old_value.trim() ? b.old_value.trim() : null;
      const new_value =
        typeof b.new_value === 'string' && b.new_value.trim() ? b.new_value.trim() : null;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
        values ($1, $2, $3, $4, $5, $6, $7)
        returning *
      `,
        [user_id, user_name, action, entity_type, entity_id, old_value, new_value],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to write log');
      return res.status(201).json(toLog(row));
    } catch (e) {
      return handleApiError(res, e, 'audit-logs POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuth(handler);
