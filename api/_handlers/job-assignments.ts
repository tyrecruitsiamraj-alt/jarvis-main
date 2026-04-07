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

const table = tableInAppSchema('job_assignments');
const jobsTable = tableInAppSchema('jobs');

type Row = {
  id: string;
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  assignment_type: string;
  start_date: string | Date;
  end_date: string | Date | null;
  status: string;
  trial_days: number;
  created_at: string | Date;
};

function isAssignmentType(v: unknown): v is 'start' | 'replacement' | 'trial' {
  return v === 'start' || v === 'replacement' || v === 'trial';
}

function isAssignmentStatus(v: unknown): v is 'sent' | 'passed' | 'failed' | 'started' | 'cancelled' {
  return v === 'sent' || v === 'passed' || v === 'failed' || v === 'started' || v === 'cancelled';
}

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function toResponse(row: Row) {
  return {
    id: row.id,
    job_id: row.job_id,
    candidate_id: row.candidate_id,
    candidate_name: row.candidate_name,
    assignment_type: row.assignment_type,
    start_date: toYmd(row.start_date),
    end_date: row.end_date ? toYmd(row.end_date) : undefined,
    status: row.status,
    trial_days: row.trial_days,
    created_at: toIsoString(row.created_at),
  };
}

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const jobId = getString(req.query?.job_id);
      if (!jobId) return sendError(res, 400, 'Bad request', 'job_id query is required');

      const { rows } = await dbQuery<Row>(
        `select * from ${table} where job_id = $1 order by created_at desc`,
        [jobId],
      );
      return res.status(200).json(rows.map(toResponse));
    } catch (e) {
      return handleApiError(res, e, 'job-assignments GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (typeof raw !== 'object' || raw === null) {
        return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      }
      const body = raw as Record<string, unknown>;

      const job_id = getString(body.job_id);
      const candidate_id = getString(body.candidate_id);
      const candidate_name = getString(body.candidate_name);
      const assignment_type = body.assignment_type;
      const start_date = body.start_date;
      const end_date = body.end_date;
      const status = body.status;
      const trial_days =
        typeof body.trial_days === 'number' && Number.isFinite(body.trial_days)
          ? Math.max(0, Math.trunc(body.trial_days))
          : typeof body.trial_days === 'string'
            ? Math.max(0, Math.trunc(Number(body.trial_days)) || 0)
            : 0;

      if (!job_id || !candidate_id || !candidate_name) {
        return sendError(res, 400, 'Bad request', 'job_id, candidate_id, candidate_name are required');
      }
      if (!isAssignmentType(assignment_type)) {
        return sendError(res, 400, 'Bad request', 'Invalid assignment_type');
      }
      if (!isDateYmd(start_date)) {
        return sendError(res, 400, 'Bad request', 'start_date must be YYYY-MM-DD');
      }
      if (!isAssignmentStatus(status)) {
        return sendError(res, 400, 'Bad request', 'Invalid status');
      }

      const endYmd =
        end_date === null || end_date === undefined || end_date === ''
          ? null
          : isDateYmd(end_date)
            ? end_date
            : null;
      if (end_date !== null && end_date !== undefined && end_date !== '' && endYmd === null) {
        return sendError(res, 400, 'Bad request', 'end_date must be YYYY-MM-DD or empty');
      }

      const { rows: jobRows } = await dbQuery<{ id: string }>(
        `select id from ${jobsTable} where id = $1 limit 1`,
        [job_id],
      );
      if (jobRows.length === 0) {
        return sendError(res, 404, 'Not found', 'Job not found');
      }

      const { rows } = await dbQuery<Row>(
        `
        insert into ${table} (
          job_id, candidate_id, candidate_name,
          assignment_type, start_date, end_date, status, trial_days
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        returning *
      `,
        [job_id, candidate_id, candidate_name, assignment_type, start_date, endYmd, status, trial_days],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create assignment');
      return res.status(201).json(toResponse(row));
    } catch (e) {
      return handleApiError(res, e, 'job-assignments POST', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(handler);
