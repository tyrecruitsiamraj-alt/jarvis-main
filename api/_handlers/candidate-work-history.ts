import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthDataRoute,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { tableInAppSchema } from '../_lib/schema.js';

const tbl = tableInAppSchema('candidate_work_history');

type Row = {
  id: string;
  candidate_id: string;
  client_name: string;
  work_type: string;
  start_date: string | Date;
  end_date: string | Date | null;
  status: string;
  created_at: string | Date;
};

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function isWorkType(v: unknown): v is 'replacement' | 'start' {
  return v === 'replacement' || v === 'start';
}

function isWhStatus(v: unknown): v is 'completed' | 'ongoing' | 'cancelled' {
  return v === 'completed' || v === 'ongoing' || v === 'cancelled';
}

function toRow(r: Row) {
  return {
    id: r.id,
    candidate_id: r.candidate_id,
    client_name: r.client_name,
    work_type: r.work_type as 'replacement' | 'start',
    start_date: toYmd(r.start_date),
    end_date: r.end_date ? toYmd(r.end_date) : undefined,
    status: r.status as 'completed' | 'ongoing' | 'cancelled',
    created_at: toIso(r.created_at),
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const candidateId = getString(req.query?.candidate_id);
      if (!candidateId) return sendError(res, 400, 'Bad request', 'candidate_id required');

      const { rows } = await dbQuery<Row>(
        `select * from ${tbl} where candidate_id = $1 order by start_date desc`,
        [candidateId],
      );
      return res.status(200).json(rows.map(toRow));
    } catch (e) {
      return handleApiError(res, e, 'candidate-work-history GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const candidate_id = getString(b.candidate_id);
      const client_name = getString(b.client_name);
      const work_type = b.work_type;
      const start_date = b.start_date;
      const status = b.status;
      if (!candidate_id || !client_name || !isWorkType(work_type) || !isDateYmd(start_date)) {
        return sendError(res, 400, 'Bad request', 'Invalid required fields');
      }
      if (!isWhStatus(status)) {
        return sendError(res, 400, 'Bad request', 'Invalid status');
      }
      const end_date =
        b.end_date === null || b.end_date === undefined || b.end_date === ''
          ? null
          : isDateYmd(b.end_date)
            ? b.end_date
            : null;
      if (b.end_date && end_date === null) {
        return sendError(res, 400, 'Bad request', 'end_date must be YYYY-MM-DD');
      }

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (candidate_id, client_name, work_type, start_date, end_date, status)
        values ($1, $2, $3, $4::date, $5::date, $6)
        returning *
      `,
        [candidate_id, client_name, work_type, start_date, end_date, status],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create');
      return res.status(201).json(toRow(row));
    } catch (e) {
      return handleApiError(res, e, 'candidate-work-history POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const id = getString(b.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id required');

      const { rows: curRows } = await dbQuery<Row>(`select * from ${tbl} where id = $1 limit 1`, [id]);
      const cur = curRows[0];
      if (!cur) return sendError(res, 404, 'Not found');

      const client_name = b.client_name !== undefined ? getString(b.client_name) : cur.client_name;
      const work_type =
        b.work_type !== undefined && isWorkType(b.work_type) ? b.work_type : cur.work_type;
      const start_date =
        b.start_date !== undefined && isDateYmd(b.start_date) ? b.start_date : toYmd(cur.start_date);
      const end_date =
        b.end_date === null
          ? null
          : b.end_date !== undefined
            ? isDateYmd(b.end_date)
              ? b.end_date
              : cur.end_date
                ? toYmd(cur.end_date)
                : null
            : cur.end_date
              ? toYmd(cur.end_date)
              : null;
      const status =
        b.status !== undefined && isWhStatus(b.status) ? b.status : cur.status;

      if (!client_name) return sendError(res, 400, 'Bad request', 'client_name empty');

      const { rows } = await dbQuery<Row>(
        `
        update ${tbl} set
          client_name = $2, work_type = $3, start_date = $4::date, end_date = $5::date, status = $6
        where id = $1
        returning *
      `,
        [id, client_name, work_type, start_date, end_date, status],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to update');
      return res.status(200).json(toRow(row));
    } catch (e) {
      return handleApiError(res, e, 'candidate-work-history PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(handler);
