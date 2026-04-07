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

const tbl = tableInAppSchema('training_records');

type Row = {
  id: string;
  employee_id: string;
  training_name: string;
  training_date: string | Date;
  result: string;
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
    employee_id: r.employee_id,
    training_name: r.training_name,
    training_date: toYmd(r.training_date),
    result: r.result as 'passed' | 'failed' | 'pending',
    notes: r.notes ?? undefined,
    created_at: toIso(r.created_at),
  };
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const employeeId = getString(req.query?.employee_id);
      if (!employeeId) return sendError(res, 400, 'Bad request', 'employee_id required');

      const { rows } = await dbQuery<Row>(
        `select * from ${tbl} where employee_id = $1 order by training_date desc`,
        [employeeId],
      );
      return res.status(200).json(rows.map(toRow));
    } catch (e) {
      return handleApiError(res, e, 'training-records GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const b = raw as Record<string, unknown>;
      const employee_id = getString(b.employee_id);
      const training_name = getString(b.training_name);
      const training_date = b.training_date;
      const result = b.result;
      if (!employee_id || !training_name || !isDateYmd(training_date) || !isResult(result)) {
        return sendError(res, 400, 'Bad request', 'Invalid required fields');
      }
      const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (employee_id, training_name, training_date, result, notes)
        values ($1, $2, $3::date, $4, $5)
        returning *
      `,
        [employee_id, training_name, training_date, result, notes],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create');
      return res.status(201).json(toRow(row));
    } catch (e) {
      return handleApiError(res, e, 'training-records POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(handler);
