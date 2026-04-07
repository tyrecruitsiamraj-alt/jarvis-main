import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthDataRoute,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';

type EmployeeRow = {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  phone: string;
  status: string;
  position: string;
  join_date: string | Date;
  address: string | null;
  lat: number | null;
  lng: number | null;
  reliability_score: number;
  utilization_rate: number;
  total_days_worked: number;
  total_income: number;
  total_cost: number;
  total_issues: number;
  avatar_url: string | null;
  created_at: string | Date;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const parseFloatOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const isEmployeeStatus = (v: unknown): v is 'active' | 'inactive' | 'suspended' =>
  v === 'active' || v === 'inactive' || v === 'suspended';

function toEmployeeResponse(row: EmployeeRow) {
  return {
    id: row.id,
    employee_code: row.employee_code,
    first_name: row.first_name,
    last_name: row.last_name,
    nickname: row.nickname || undefined,
    phone: row.phone,
    status: row.status,
    position: row.position,
    join_date: toYmd(row.join_date),
    address: row.address || undefined,
    lat: row.lat === null ? undefined : row.lat,
    lng: row.lng === null ? undefined : row.lng,
    reliability_score: row.reliability_score,
    utilization_rate: row.utilization_rate,
    total_days_worked: row.total_days_worked,
    total_income: row.total_income,
    total_cost: row.total_cost,
    total_issues: row.total_issues,
    avatar_url: row.avatar_url || undefined,
    created_at: toIsoString(row.created_at),
  };
}

function parseLimitOffset(query: Record<string, unknown> | undefined): { limit: number; offset: number } {
  const limit = Math.min(500, Math.max(1, parseIntOrNull(query?.limit) ?? 100));
  const offset = Math.max(0, parseIntOrNull(query?.offset) ?? 0);
  return { limit, offset };
}

async function employeesHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const id = getString(req.query?.id);
      if (id) {
        const { rows } = await dbQuery<EmployeeRow>(
          `select * from jarvis_rm.employees where id = $1 limit 1`,
          [id],
        );
        if (rows.length === 0) return sendError(res, 404, 'Not found', 'Employee not found');
        return res.status(200).json(toEmployeeResponse(rows[0]));
      }

      const statusFilter = getString(req.query?.status);
      const statusOk = statusFilter && isEmployeeStatus(statusFilter) ? statusFilter : null;
      const { limit, offset } = parseLimitOffset(req.query);

      const { rows } = await dbQuery<EmployeeRow>(
        statusOk
          ? `
          select * from jarvis_rm.employees
          where status = $1
          order by created_at desc
          limit $2 offset $3
        `
          : `
          select * from jarvis_rm.employees
          order by created_at desc
          limit $1 offset $2
        `,
        statusOk ? [statusOk, limit, offset] : [limit, offset],
      );
      return res.status(200).json(rows.map(toEmployeeResponse));
    } catch (e) {
      return handleApiError(res, e, 'employees GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');

      const employee_code = getString(raw.employee_code);
      const first_name = getString(raw.first_name);
      const last_name = getString(raw.last_name);
      const phone = getString(raw.phone);
      const position = getString(raw.position);
      const join_date = raw.join_date;
      const status = raw.status;

      const missing = [
        !employee_code ? 'employee_code' : null,
        !first_name ? 'first_name' : null,
        !last_name ? 'last_name' : null,
        !phone ? 'phone' : null,
        !isEmployeeStatus(status) ? 'status' : null,
        !position ? 'position' : null,
        !isDateYmd(join_date) ? 'join_date' : null,
      ].filter(Boolean);

      if (missing.length > 0) {
        return sendError(res, 400, 'Bad request', 'Missing or invalid required fields', { fields: missing });
      }

      const nickname = getString(raw.nickname);
      const address = getString(raw.address);

      const lat = parseFloatOrNull(raw.lat);
      const lng = parseFloatOrNull(raw.lng);

      const reliability_score = parseIntOrNull(raw.reliability_score) ?? 0;
      const utilization_rate = parseIntOrNull(raw.utilization_rate) ?? 0;
      const total_days_worked = parseIntOrNull(raw.total_days_worked) ?? 0;
      const total_income = parseIntOrNull(raw.total_income) ?? 0;
      const total_cost = parseIntOrNull(raw.total_cost) ?? 0;
      const total_issues = parseIntOrNull(raw.total_issues) ?? 0;
      const avatar_url = getString(raw.avatar_url);

      const { rows } = await dbQuery<EmployeeRow>(
        `
          insert into jarvis_rm.employees (
            employee_code, first_name, last_name, nickname,
            phone, status, position, join_date,
            address, lat, lng,
            reliability_score, utilization_rate,
            total_days_worked, total_income, total_cost, total_issues,
            avatar_url
          )
          values (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11,
            $12, $13,
            $14, $15, $16, $17,
            $18
          )
          returning *
        `,
        [
          employee_code,
          first_name,
          last_name,
          nickname,
          phone,
          status,
          position,
          join_date,
          address,
          lat,
          lng,
          reliability_score,
          utilization_rate,
          total_days_worked,
          total_income,
          total_cost,
          total_issues,
          avatar_url,
        ],
      );

      if (rows.length === 0) return sendError(res, 500, 'Failed to create employee');
      return res.status(201).json(toEmployeeResponse(rows[0]));
    } catch (e) {
      return handleApiError(res, e, 'employees POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const id = getString(raw.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id is required');

      const { rows: curRows } = await dbQuery<EmployeeRow>(
        `select * from jarvis_rm.employees where id = $1 limit 1`,
        [id],
      );
      const cur = curRows[0];
      if (!cur) return sendError(res, 404, 'Not found', 'Employee not found');

      const employee_code =
        raw.employee_code !== undefined ? getString(raw.employee_code) : cur.employee_code;
      const first_name = raw.first_name !== undefined ? getString(raw.first_name) : cur.first_name;
      const last_name = raw.last_name !== undefined ? getString(raw.last_name) : cur.last_name;
      const nickname = raw.nickname !== undefined ? getString(raw.nickname) : cur.nickname;
      const phone = raw.phone !== undefined ? getString(raw.phone) : cur.phone;
      const status =
        raw.status !== undefined
          ? isEmployeeStatus(raw.status)
            ? raw.status
            : cur.status
          : cur.status;
      const position = raw.position !== undefined ? getString(raw.position) : cur.position;
      const join_date =
        raw.join_date !== undefined
          ? isDateYmd(raw.join_date)
            ? raw.join_date
            : toYmd(cur.join_date)
          : toYmd(cur.join_date);
      const address = raw.address !== undefined ? getString(raw.address) : cur.address;
      const lat = raw.lat !== undefined ? parseFloatOrNull(raw.lat) : cur.lat;
      const lng = raw.lng !== undefined ? parseFloatOrNull(raw.lng) : cur.lng;
      const reliability_score =
        raw.reliability_score !== undefined
          ? parseIntOrNull(raw.reliability_score) ?? cur.reliability_score
          : cur.reliability_score;
      const utilization_rate =
        raw.utilization_rate !== undefined
          ? parseIntOrNull(raw.utilization_rate) ?? cur.utilization_rate
          : cur.utilization_rate;
      const total_days_worked =
        raw.total_days_worked !== undefined
          ? parseIntOrNull(raw.total_days_worked) ?? cur.total_days_worked
          : cur.total_days_worked;
      const total_income =
        raw.total_income !== undefined ? parseIntOrNull(raw.total_income) ?? cur.total_income : cur.total_income;
      const total_cost =
        raw.total_cost !== undefined ? parseIntOrNull(raw.total_cost) ?? cur.total_cost : cur.total_cost;
      const total_issues =
        raw.total_issues !== undefined ? parseIntOrNull(raw.total_issues) ?? cur.total_issues : cur.total_issues;
      const avatar_url = raw.avatar_url !== undefined ? getString(raw.avatar_url) : cur.avatar_url;

      if (!employee_code || !first_name || !last_name || !phone || !position) {
        return sendError(res, 400, 'Bad request', 'Invalid field values after merge');
      }

      const { rows } = await dbQuery<EmployeeRow>(
        `
        update jarvis_rm.employees set
          employee_code = $2, first_name = $3, last_name = $4, nickname = $5,
          phone = $6, status = $7, position = $8, join_date = $9::date,
          address = $10, lat = $11, lng = $12,
          reliability_score = $13, utilization_rate = $14,
          total_days_worked = $15, total_income = $16, total_cost = $17, total_issues = $18,
          avatar_url = $19
        where id = $1
        returning *
      `,
        [
          id,
          employee_code,
          first_name,
          last_name,
          nickname,
          phone,
          status,
          position,
          join_date,
          address,
          lat,
          lng,
          reliability_score,
          utilization_rate,
          total_days_worked,
          total_income,
          total_cost,
          total_issues,
          avatar_url,
        ],
      );

      const updated = rows[0];
      if (!updated) return sendError(res, 500, 'Failed to update employee');
      return res.status(200).json(toEmployeeResponse(updated));
    } catch (e) {
      return handleApiError(res, e, 'employees PATCH', { userId: req.user.sub });
    }
  }

  if (method === 'DELETE') {
    try {
      const id = getString(req.query?.id);
      if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');
      const { rows } = await dbQuery<{ id: string }>(
        `delete from jarvis_rm.employees where id = $1 returning id`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Employee not found');
      return res.status(200).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return handleApiError(res, e, 'employees DELETE', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(employeesHandler);
