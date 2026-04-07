/**
 * Unauthenticated read-only job list/detail for public career board.
 */
import { dbQuery } from '../../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../../_lib/http.js';
import { getString } from '../../_lib/body.js';

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

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

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

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');

  try {
    const id = getString(req.query?.id);
    if (id) {
      const { rows } = await dbQuery<JobRow>(
        `select * from jarvis_rm.jobs where id = $1 and status in ('open', 'in_progress') limit 1`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Job not found');
      return res.status(200).json(toJobResponse(rows[0]));
    }

    const limit = Math.min(100, Math.max(1, parseIntOrNull(req.query?.limit) ?? 50));
    const { rows } = await dbQuery<JobRow>(
      `select * from jarvis_rm.jobs where status in ('open', 'in_progress') order by created_at desc limit $1`,
      [limit],
    );
    return res.status(200).json(rows.map(toJobResponse));
  } catch (e) {
    return handleApiError(res, e, 'public/jobs');
  }
}
