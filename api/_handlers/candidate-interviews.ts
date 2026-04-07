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

const tbl = tableInAppSchema('candidate_interviews');

type Row = {
  id: string;
  candidate_id: string;
  interview_date: string | Date;
  location: string;
  client_name: string;
  attended: boolean;
  result: string | null;
  notes: string | null;
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

function isResult(v: unknown): v is 'passed' | 'failed' | 'pending' {
  return v === 'passed' || v === 'failed' || v === 'pending';
}

function toRow(r: Row) {
  return {
    id: r.id,
    candidate_id: r.candidate_id,
    interview_date: toYmd(r.interview_date),
    location: r.location,
    client_name: r.client_name,
    attended: r.attended,
    result: (r.result as 'passed' | 'failed' | 'pending' | undefined) ?? undefined,
    notes: r.notes ?? undefined,
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
        `select * from ${tbl} where candidate_id = $1 order by interview_date desc`,
        [candidateId],
      );
      return res.status(200).json(rows.map(toRow));
    } catch (e) {
      return handleApiError(res, e, 'candidate-interviews GET', { userId: req.user.sub });
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
      const interview_date = b.interview_date;
      if (!candidate_id || !isDateYmd(interview_date)) {
        return sendError(res, 400, 'Bad request', 'candidate_id and interview_date required');
      }
      const location = typeof b.location === 'string' ? b.location : '';
      const client_name = typeof b.client_name === 'string' ? b.client_name : '';
      const attended = Boolean(b.attended);
      const result = b.result !== undefined && isResult(b.result) ? b.result : null;
      const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (candidate_id, interview_date, location, client_name, attended, result, notes)
        values ($1, $2::date, $3, $4, $5, $6, $7)
        returning *
      `,
        [candidate_id, interview_date, location, client_name, attended, result, notes],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create');
      return res.status(201).json(toRow(row));
    } catch (e) {
      return handleApiError(res, e, 'candidate-interviews POST', { userId: req.user.sub });
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

      const interview_date =
        b.interview_date !== undefined && isDateYmd(b.interview_date)
          ? b.interview_date
          : toYmd(cur.interview_date);
      const location =
        b.location !== undefined && typeof b.location === 'string' ? b.location : cur.location;
      const client_name =
        b.client_name !== undefined && typeof b.client_name === 'string' ? b.client_name : cur.client_name;
      const attended = b.attended !== undefined ? Boolean(b.attended) : cur.attended;
      const result =
        b.result !== undefined ? (isResult(b.result) ? b.result : null) : cur.result;
      const notes =
        b.notes !== undefined
          ? typeof b.notes === 'string'
            ? b.notes.trim() || null
            : cur.notes
          : cur.notes;

      const { rows } = await dbQuery<Row>(
        `
        update ${tbl} set
          interview_date = $2::date, location = $3, client_name = $4,
          attended = $5, result = $6, notes = $7
        where id = $1
        returning *
      `,
        [id, interview_date, location, client_name, attended, result, notes],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to update');
      return res.status(200).json(toRow(row));
    } catch (e) {
      return handleApiError(res, e, 'candidate-interviews PATCH', { userId: req.user.sub });
    }
  }

  if (method === 'DELETE') {
    try {
      const id = getString(req.query?.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id query required');
      const { rows } = await dbQuery<{ id: string }>(`delete from ${tbl} where id = $1 returning id`, [id]);
      if (rows.length === 0) return sendError(res, 404, 'Not found');
      return res.status(200).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return handleApiError(res, e, 'candidate-interviews DELETE', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(handler);
