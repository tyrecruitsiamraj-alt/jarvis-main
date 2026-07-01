import {
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
  getSiamrajUnitRequestById,
} from '../../_lib/siamrajUnitRequests.js';
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
  gender_requirement?: string | null;
  job_description_code_1?: string | null;
  vehicle_required: string | null;
  work_schedule: string | null;
  penalty_per_day: number;
  days_without_worker: number;
  total_penalty: number;
  status: string;
  closed_date: string | Date | null;
  created_at: string | Date;
};

type PublicJob = ReturnType<typeof toPublicJob>;

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIsoString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

function toPublicJob(row: JobRow | Record<string, unknown>) {
  const r = row as JobRow & Record<string, unknown>;
  return {
    id: r.id,
    unit_name: r.unit_name,
    request_no: r.request_no ?? undefined,
    request_action_name: r.request_action_name ?? undefined,
    resigned_employee_name: r.resigned_employee_name ?? undefined,
    request_date: toYmd(r.request_date),
    required_date: toYmd(r.required_date),
    urgency: r.urgency,
    total_income: r.total_income,
    location_address: r.location_address,
    lat: r.lat === null || r.lat === undefined ? undefined : r.lat,
    lng: r.lng === null || r.lng === undefined ? undefined : r.lng,
    job_type: r.job_type,
    job_category: r.job_category,
    job_description_code_1: r.job_description_code_1 || undefined,
    age_range_min: r.age_range_min === null || r.age_range_min === undefined ? undefined : r.age_range_min,
    age_range_max: r.age_range_max === null || r.age_range_max === undefined ? undefined : r.age_range_max,
    gender_requirement: r.gender_requirement || undefined,
    vehicle_required: r.vehicle_required || undefined,
    work_schedule: r.work_schedule || undefined,
    status: r.status,
    source: r.source || undefined,
    created_at: toIsoString(r.created_at),
  };
}

function isPublicVisible(job: { status?: string }) {
  return job.status === 'open' || job.status === 'in_progress';
}

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

async function listPublicSiamrajJobs(limit: number): Promise<PublicJob[]> {
  const items = await listSiamrajUnitRequests({ limit, mode: 'all' });
  return items.filter(isPublicVisible).map((j) => toPublicJob(j as unknown as JobRow));
}

async function getPublicSiamrajJob(id: string): Promise<PublicJob | null> {
  const item = await getSiamrajUnitRequestById(id);
  if (!item || !isPublicVisible(item)) return null;
  return toPublicJob(item as unknown as JobRow);
}

export default async function handler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') return sendError(res, 405, 'Method not allowed');

  try {
    const id = getString(req.query?.id);
    const limit = Math.min(200, Math.max(1, parseIntOrNull(req.query?.limit) ?? 200));

    if (isSiamrajUnitRequestsEnabled()) {
      if (id) {
        const job = await getPublicSiamrajJob(id);
        if (!job) return sendError(res, 404, 'Not found', 'Job not found');
        return res.status(200).json(job);
      }
      const jobs = await listPublicSiamrajJobs(limit);
      return res.status(200).json(jobs);
    }

    if (id) {
      const { rows } = await dbQuery<JobRow>(
        `select * from jarvis_rm.jobs where id = $1 and status in ('open', 'in_progress') limit 1`,
        [id],
      );
      if (rows.length === 0) return sendError(res, 404, 'Not found', 'Job not found');
      return res.status(200).json(toPublicJob(rows[0]));
    }

    const { rows } = await dbQuery<JobRow>(
      `select * from jarvis_rm.jobs where status in ('open', 'in_progress') order by created_at desc limit $1`,
      [limit],
    );
    return res.status(200).json(rows.map(toPublicJob));
  } catch (e) {
    return handleApiError(res, e, 'public/jobs');
  }
}
