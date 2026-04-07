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

const tbl = tableInAppSchema('work_calendar');

type Row = {
  id: string;
  employee_id: string;
  work_date: string | Date;
  client_id: string | null;
  client_name: string | null;
  shift: string | null;
  status: string;
  income: number | null;
  cost: number | null;
  issue_reason: string | null;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date;
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

const WORK_STATUSES = new Set([
  'normal_work',
  'cancel_by_employee',
  'late',
  'cancel_by_client',
  'no_show',
  'day_off',
  'available',
]);

function isWorkStatus(v: unknown): v is Row['status'] {
  return typeof v === 'string' && WORK_STATUSES.has(v);
}

function toEntry(row: Row) {
  return {
    id: row.id,
    employee_id: row.employee_id,
    work_date: toYmd(row.work_date),
    client_id: row.client_id ?? undefined,
    client_name: row.client_name ?? undefined,
    shift: row.shift ?? undefined,
    status: row.status,
    income: row.income ?? undefined,
    cost: row.cost ?? undefined,
    issue_reason: row.issue_reason ?? undefined,
    notes: row.notes ?? undefined,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const from = getString(req.query?.from);
      const to = getString(req.query?.to);
      const employeeId = getString(req.query?.employee_id);

      const defaultFrom = () => {
        const d = new Date();
        d.setDate(d.getDate() - 60);
        return d.toISOString().slice(0, 10);
      };
      const defaultTo = () => {
        const d = new Date();
        d.setDate(d.getDate() + 120);
        return d.toISOString().slice(0, 10);
      };

      const f = from && isDateYmd(from) ? from : defaultFrom();
      const t = to && isDateYmd(to) ? to : defaultTo();

      const params: unknown[] = [f, t];
      let where = `where work_date >= $1::date and work_date <= $2::date`;
      if (employeeId) {
        params.push(employeeId);
        where += ` and employee_id = $${params.length}::uuid`;
      }

      const { rows } = await dbQuery<Row>(
        `select * from ${tbl} ${where} order by work_date asc, employee_id asc`,
        params,
      );
      return res.status(200).json(rows.map(toEntry));
    } catch (e) {
      return handleApiError(res, e, 'work-calendar GET', { userId: req.user.sub });
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
      const work_date = b.work_date;
      if (!employee_id || !isDateYmd(work_date)) {
        return sendError(res, 400, 'Bad request', 'employee_id and work_date (YYYY-MM-DD) required');
      }

      const cidRaw = typeof b.client_id === 'string' ? b.client_id.trim() : '';
      const client_id = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        cidRaw,
      )
        ? cidRaw
        : null;
      const client_name =
        typeof b.client_name === 'string' && b.client_name.trim() ? b.client_name.trim() : null;
      const shift = typeof b.shift === 'string' && b.shift.trim() ? b.shift.trim() : null;
      const status = isWorkStatus(b.status) ? b.status : 'normal_work';
      const income = parseIntOrNull(b.income);
      const cost = parseIntOrNull(b.cost);
      const issue_reason =
        typeof b.issue_reason === 'string' && b.issue_reason.trim() ? b.issue_reason.trim() : null;
      const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;

      const { rows } = await dbQuery<Row>(
        `
        insert into ${tbl} (
          employee_id, work_date, client_id, client_name, shift, status,
          income, cost, issue_reason, notes, updated_at
        )
        values ($1, $2::date, $3::uuid, $4, $5, $6, $7, $8, $9, $10, now())
        returning *
      `,
        [
          employee_id,
          work_date,
          client_id || null,
          client_name,
          shift,
          status,
          income,
          cost,
          issue_reason,
          notes,
        ],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to create entry');
      return res.status(201).json(toEntry(row));
    } catch (e) {
      return handleApiError(res, e, 'work-calendar POST', { userId: req.user.sub });
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
      if (!cur) return sendError(res, 404, 'Not found', 'Entry not found');

      const nextStatus =
        b.status !== undefined && isWorkStatus(b.status) ? b.status : cur.status;
      const nextClientName =
        b.client_name !== undefined && typeof b.client_name === 'string'
          ? b.client_name.trim() || null
          : cur.client_name;
      const nextShift =
        b.shift !== undefined && typeof b.shift === 'string' ? b.shift.trim() || null : cur.shift;
      const nextIncome = b.income !== undefined ? parseIntOrNull(b.income) : cur.income;
      const nextCost = b.cost !== undefined ? parseIntOrNull(b.cost) : cur.cost;
      const nextIssue =
        b.issue_reason !== undefined && typeof b.issue_reason === 'string'
          ? b.issue_reason.trim() || null
          : cur.issue_reason;

      const { rows } = await dbQuery<Row>(
        `
        update ${tbl} set
          status = $2,
          client_name = $3,
          shift = $4,
          income = $5,
          cost = $6,
          issue_reason = $7,
          updated_at = now()
        where id = $1
        returning *
      `,
        [id, nextStatus, nextClientName, nextShift, nextIncome, nextCost, nextIssue],
      );

      const row = rows[0];
      if (!row) return sendError(res, 500, 'Failed to update');
      return res.status(200).json(toEntry(row));
    } catch (e) {
      return handleApiError(res, e, 'work-calendar PATCH', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(handler);
