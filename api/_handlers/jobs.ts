import { dbQuery } from '../_lib/postgres.js';
import {
  withAuthDataRoute,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';

type JobRow = {
  id: string;
  unit_name: string;
  request_date: string | Date;
  required_date: string | Date;
  urgency: string;
  total_income: number;
  location_address: string;
  lat: number | null;
  lng: number | null;
  job_type: string;
  job_category: string;
  recruiter_name: string | null;
  screener_name: string | null;
  age_range_min: number | null;
  age_range_max: number | null;
  vehicle_required: string | null;
  work_schedule: string | null;
  penalty_per_day: number;
  days_without_worker: number;
  total_penalty: number;
  status: string;
  closed_date: string | Date | null;
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

const isJobType = (v: unknown): v is 'thai_executive' | 'foreign_executive' | 'central' | 'valet_parking' =>
  v === 'thai_executive' || v === 'foreign_executive' || v === 'central' || v === 'valet_parking';

const isJobCategory = (v: unknown): v is 'private' | 'government' | 'bank' =>
  v === 'private' || v === 'government' || v === 'bank';

const isJobUrgency = (v: unknown): v is 'urgent' | 'advance' => v === 'urgent' || v === 'advance';

const isJobStatus = (v: unknown): v is 'open' | 'in_progress' | 'closed' | 'cancelled' =>
  v === 'open' || v === 'in_progress' || v === 'closed' || v === 'cancelled';

function toJobResponse(row: JobRow) {
  return {
    id: row.id,
    unit_name: row.unit_name,
    request_date: toYmd(row.request_date),
    required_date: toYmd(row.required_date),
    urgency: row.urgency,
    total_income: row.total_income,
    location_address: row.location_address,
    lat: row.lat === null ? undefined : row.lat,
    lng: row.lng === null ? undefined : row.lng,
    job_type: row.job_type,
    job_category: row.job_category,
    recruiter_name: row.recruiter_name || undefined,
    screener_name: row.screener_name || undefined,
    age_range_min: row.age_range_min === null ? undefined : row.age_range_min,
    age_range_max: row.age_range_max === null ? undefined : row.age_range_max,
    vehicle_required: row.vehicle_required || undefined,
    work_schedule: row.work_schedule || undefined,
    penalty_per_day: row.penalty_per_day,
    days_without_worker: row.days_without_worker,
    total_penalty: row.total_penalty,
    status: row.status,
    closed_date: row.closed_date ? toYmd(row.closed_date) : undefined,
    created_at: toIsoString(row.created_at),
  };
}

function parseLimitOffset(query: Record<string, unknown> | undefined): { limit: number; offset: number } {
  const limit = Math.min(500, Math.max(1, parseIntOrNull(query?.limit) ?? 100));
  const offset = Math.max(0, parseIntOrNull(query?.offset) ?? 0);
  return { limit, offset };
}

async function jobsHandler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    try {
      const id = getString(req.query?.id);
      if (id) {
        const { rows } = await dbQuery<JobRow>(
          `select * from jarvis_rm.jobs where id = $1 limit 1`,
          [id],
        );
        if (rows.length === 0) return sendError(res, 404, 'Not found', 'Job not found');
        return res.status(200).json(toJobResponse(rows[0]));
      }

      const statusFilter = getString(req.query?.status);
      const statusOk = statusFilter && isJobStatus(statusFilter) ? statusFilter : null;
      const { limit, offset } = parseLimitOffset(req.query);

      const { rows } = await dbQuery<JobRow>(
        statusOk
          ? `
          select * from jarvis_rm.jobs
          where status = $1
          order by created_at desc
          limit $2 offset $3
        `
          : `
          select * from jarvis_rm.jobs
          order by created_at desc
          limit $1 offset $2
        `,
        statusOk ? [statusOk, limit, offset] : [limit, offset],
      );
      return res.status(200).json(rows.map(toJobResponse));
    } catch (e) {
      return handleApiError(res, e, 'jobs GET', { userId: req.user.sub });
    }
  }

  if (method === 'POST') {
    try {
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');

      const unit_name = getString(raw.unit_name);
      const request_date = raw.request_date;
      const required_date = raw.required_date;
      const job_type = raw.job_type;
      const job_category = raw.job_category;
      const location_address = getString(raw.location_address);

      const missing = [
        !unit_name ? 'unit_name' : null,
        !isDateYmd(request_date) ? 'request_date' : null,
        !isDateYmd(required_date) ? 'required_date' : null,
        !isJobType(job_type) ? 'job_type' : null,
        !isJobCategory(job_category) ? 'job_category' : null,
        !location_address ? 'location_address' : null,
      ].filter(Boolean);

      if (missing.length > 0) {
        return sendError(res, 400, 'Bad request', 'Missing or invalid required fields', { fields: missing });
      }

      const total_income = parseIntOrNull(raw.total_income) ?? 0;

      const lat = parseFloatOrNull(raw.lat);
      const lng = parseFloatOrNull(raw.lng);

      const recruiter_name = getString(raw.recruiter_name);
      const screener_name = getString(raw.screener_name);

      const age_range_min = parseIntOrNull(raw.age_range_min);
      const age_range_max = parseIntOrNull(raw.age_range_max);
      const vehicle_required =
        typeof raw.vehicle_required === 'string' && raw.vehicle_required.trim() ? raw.vehicle_required.trim() : null;
      const work_schedule =
        typeof raw.work_schedule === 'string' && raw.work_schedule.trim() ? raw.work_schedule.trim() : null;

      const penalty_per_day = parseIntOrNull(raw.penalty_per_day) ?? 0;
      const days_without_worker = 0;
      const total_penalty = penalty_per_day * days_without_worker;

      const urgency = isJobUrgency(raw.urgency) ? raw.urgency : 'urgent';
      const status = isJobStatus(raw.status) ? raw.status : 'open';

      const { rows } = await dbQuery<JobRow>(
        `
          insert into jarvis_rm.jobs (
            unit_name, request_date, required_date,
            urgency, total_income,
            location_address, lat, lng,
            job_type, job_category,
            recruiter_name, screener_name,
            age_range_min, age_range_max,
            vehicle_required, work_schedule,
            penalty_per_day, days_without_worker, total_penalty,
            status
          )
          values (
            $1, $2, $3,
            $4, $5,
            $6, $7, $8,
            $9, $10,
            $11, $12,
            $13, $14,
            $15, $16,
            $17, $18, $19,
            $20
          )
          returning *
        `,
        [
          unit_name,
          request_date,
          required_date,
          urgency,
          total_income,
          location_address,
          lat,
          lng,
          job_type,
          job_category,
          recruiter_name,
          screener_name,
          age_range_min,
          age_range_max,
          vehicle_required,
          work_schedule,
          penalty_per_day,
          days_without_worker,
          total_penalty,
          status,
        ],
      );

      if (rows.length === 0) return sendError(res, 500, 'Failed to create job');
      return res.status(201).json(toJobResponse(rows[0]));
    } catch (e) {
      return handleApiError(res, e, 'jobs POST', { userId: req.user.sub });
    }
  }

  if (method === 'PATCH') {
    try {
      if (req.user.role !== 'admin') {
        return sendError(res, 403, 'Forbidden', 'Only administrators can update job details');
      }
      const raw = await readJsonBody(req);
      if (!isPlainObject(raw)) return sendError(res, 400, 'Bad request', 'Invalid JSON body');
      const id = getString(raw.id);
      if (!id) return sendError(res, 400, 'Bad request', 'id is required');

      const { rows: curRows } = await dbQuery<JobRow>(
        `select * from jarvis_rm.jobs where id = $1 limit 1`,
        [id],
      );
      const cur = curRows[0];
      if (!cur) return sendError(res, 404, 'Not found', 'Job not found');

      const unit_name = raw.unit_name !== undefined ? getString(raw.unit_name) : cur.unit_name;
      const request_date =
        raw.request_date !== undefined
          ? isDateYmd(raw.request_date)
            ? raw.request_date
            : toYmd(cur.request_date)
          : toYmd(cur.request_date);
      const required_date =
        raw.required_date !== undefined
          ? isDateYmd(raw.required_date)
            ? raw.required_date
            : toYmd(cur.required_date)
          : toYmd(cur.required_date);
      const job_type =
        raw.job_type !== undefined ? (isJobType(raw.job_type) ? raw.job_type : cur.job_type) : cur.job_type;
      const job_category =
        raw.job_category !== undefined
          ? isJobCategory(raw.job_category)
            ? raw.job_category
            : cur.job_category
          : cur.job_category;
      const location_address =
        raw.location_address !== undefined ? getString(raw.location_address) : cur.location_address;

      if (!unit_name || !location_address || !isDateYmd(request_date) || !isDateYmd(required_date)) {
        return sendError(res, 400, 'Bad request', 'Invalid field values after merge');
      }

      const total_income =
        raw.total_income !== undefined ? parseIntOrNull(raw.total_income) ?? cur.total_income : cur.total_income;
      const lat = raw.lat !== undefined ? parseFloatOrNull(raw.lat) : cur.lat;
      const lng = raw.lng !== undefined ? parseFloatOrNull(raw.lng) : cur.lng;
      const recruiter_name =
        raw.recruiter_name !== undefined ? getString(raw.recruiter_name) : cur.recruiter_name;
      const screener_name =
        raw.screener_name !== undefined ? getString(raw.screener_name) : cur.screener_name;
      const age_range_min =
        raw.age_range_min !== undefined ? parseIntOrNull(raw.age_range_min) : cur.age_range_min;
      const age_range_max =
        raw.age_range_max !== undefined ? parseIntOrNull(raw.age_range_max) : cur.age_range_max;
      const vehicle_required =
        raw.vehicle_required !== undefined
          ? typeof raw.vehicle_required === 'string' && raw.vehicle_required.trim()
            ? raw.vehicle_required.trim()
            : null
          : cur.vehicle_required;
      const work_schedule =
        raw.work_schedule !== undefined
          ? typeof raw.work_schedule === 'string' && raw.work_schedule.trim()
            ? raw.work_schedule.trim()
            : null
          : cur.work_schedule;
      const penalty_per_day =
        raw.penalty_per_day !== undefined
          ? parseIntOrNull(raw.penalty_per_day) ?? cur.penalty_per_day
          : cur.penalty_per_day;
      const days_without_worker =
        raw.days_without_worker !== undefined
          ? Math.max(0, parseIntOrNull(raw.days_without_worker) ?? cur.days_without_worker)
          : cur.days_without_worker;
      const total_penalty = penalty_per_day * days_without_worker;
      const urgency =
        raw.urgency !== undefined ? (isJobUrgency(raw.urgency) ? raw.urgency : cur.urgency) : cur.urgency;
      const status =
        raw.status !== undefined ? (isJobStatus(raw.status) ? raw.status : cur.status) : cur.status;
      const closed_date =
        raw.closed_date === null
          ? null
          : raw.closed_date !== undefined
            ? isDateYmd(raw.closed_date)
              ? raw.closed_date
              : cur.closed_date
                ? toYmd(cur.closed_date)
                : null
            : cur.closed_date
              ? toYmd(cur.closed_date)
              : null;

      const { rows } = await dbQuery<JobRow>(
        `
        update jarvis_rm.jobs set
          unit_name = $2, request_date = $3::date, required_date = $4::date,
          urgency = $5, total_income = $6,
          location_address = $7, lat = $8, lng = $9,
          job_type = $10, job_category = $11,
          recruiter_name = $12, screener_name = $13,
          age_range_min = $14, age_range_max = $15,
          vehicle_required = $16, work_schedule = $17,
          penalty_per_day = $18, days_without_worker = $19, total_penalty = $20,
          status = $21, closed_date = $22::date
        where id = $1
        returning *
      `,
        [
          id,
          unit_name,
          request_date,
          required_date,
          urgency,
          total_income,
          location_address,
          lat,
          lng,
          job_type,
          job_category,
          recruiter_name,
          screener_name,
          age_range_min,
          age_range_max,
          vehicle_required,
          work_schedule,
          penalty_per_day,
          days_without_worker,
          total_penalty,
          status,
          closed_date,
        ],
      );

      const updated = rows[0];
      if (!updated) return sendError(res, 500, 'Failed to update job');
      return res.status(200).json(toJobResponse(updated));
    } catch (e) {
      return handleApiError(res, e, 'jobs PATCH', { userId: req.user.sub });
    }
  }

  if (method === 'DELETE') {
    try {
      const id = getString(req.query?.id);
      if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');
      const { rows } = await dbQuery<{ id: string }>(
        `delete from jarvis_rm.jobs where id = $1 returning id`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Job not found');
      return res.status(200).json({ ok: true, id: rows[0].id });
    } catch (e) {
      return handleApiError(res, e, 'jobs DELETE', { userId: req.user.sub });
    }
  }

  return sendError(res, 405, 'Method not allowed');
}

export default withAuthDataRoute(jobsHandler);
