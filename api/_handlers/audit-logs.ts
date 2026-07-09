import { dbQuery } from '../_lib/postgres.js';
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { getString } from '../_lib/body.js';
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
  request_id: string | null;
  user_role: string | null;
  ip_address: string | null;
  user_agent: string | null;
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
    user_role: row.user_role ?? undefined,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value: row.old_value ?? undefined,
    new_value: row.new_value ?? undefined,
    request_id: row.request_id ?? undefined,
    ip_address: row.ip_address ?? undefined,
    user_agent: row.user_agent ?? undefined,
    timestamp: toIso(row.created_at),
  };
}

const parseLimit = (q: unknown): number => {
  const n = typeof q === 'string' ? Number(q) : typeof q === 'number' ? q : 100;
  return Math.min(500, Math.max(1, Number.isFinite(n) ? Math.trunc(n) : 100));
};

async function handler(req: AuthedReq, res: ApiRes) {
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

  // Audit logs are server-written only — clients cannot create audit events.
  if (method === 'POST') {
    return sendError(
      res,
      403,
      'Forbidden',
      'Audit logs are written by the server on successful mutations',
    );
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withRbac(handler, 'audit-logs');
