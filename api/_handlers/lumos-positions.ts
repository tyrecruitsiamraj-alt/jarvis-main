/**
 * Lumos AI Recruit — Positions endpoint
 *
 * GET /api/lumos/positions
 *
 * ตาม spec: [Lumos AI Recruit] Positions API Spec
 * Logic เหมือน /api/public/jobs:
 *   - ถ้า isSiamrajUnitRequestsEnabled() → ดึงจาก Siamraj (MSSQL / PG schema)
 *   - ไม่เช่นนั้น → ดึงจาก jarvis_rm.jobs (PostgreSQL)
 *
 * Response เป็น plain array เรียง created_at DESC (newest first)
 */
import {
  isSiamrajUnitRequestsEnabled,
  listSiamrajUnitRequests,
} from '../_lib/siamrajUnitRequests.js';
import { dbQuery } from '../_lib/postgres.js';
import { sendError, handleApiError, type ApiReq, type ApiRes } from '../_lib/http.js';
import { withLumosAuth } from '../_lib/lumos-auth.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type PgJobRow = {
  id: string;
  unit_name: string;
  department_name?: string | null;
  request_date: string | Date;
  required_date: string | Date;
  urgency: string;
  total_income: number;
  location_address: string;
  job_type: string;
  job_category: string;
  job_description_code_1?: string | null;
  job_description_code_2?: string | null;
  request_action_name?: string | null;
  resigned_employee_name?: string | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  gender_requirement?: string | null;
  vehicle_required?: string | null;
  work_schedule?: string | null;
  status: string;
  created_at: string | Date;
  updated_at?: string | Date | null;
  submittedByName?: string | null;
  submittedByEmail?: string | null;
};

type LumosRequirements = {
  hard_skills: string[];
  soft_skills: string[];
  responsibilities: string[];
  [key: string]: unknown;
};

type LumosPosition = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  description: string | null;
  requirements: LumosRequirements | null;
  base_salary: number | null;
  status: string;
  created_by: string | null;
  interview_questions: string[] | null;
  created_at: string;
  updated_at: string;
  active_config_version: number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toIso(value: string | Date | null | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

/** SO job_type → Lumos employment_type */
function mapEmploymentType(jobType: string | null | undefined): string {
  if (!jobType) return 'Outsource';
  const t = jobType.toLowerCase();
  if (t.includes('full') || t.includes('permanent') || t.includes('executive')) return 'Full-time';
  if (t.includes('part')) return 'Part-time';
  if (t.includes('freelance')) return 'Freelance';
  return 'Outsource';
}

/** SO status → Lumos status */
function mapStatus(status: string | null | undefined): string {
  switch (status) {
    case 'open':
    case 'in_progress': return 'open';
    case 'closed':
    case 'cancelled': return 'closed';
    default: return 'open';
  }
}

/** build requirements object from available SO fields */
function buildRequirements(row: Record<string, unknown>): LumosRequirements | null {
  const reqs: LumosRequirements = {
    hard_skills: [],
    soft_skills: [],
    responsibilities: [],
  };

  // job_description_code_2 → treat as a hard skill tag when present
  const code2 = typeof row.job_description_code_2 === 'string' ? row.job_description_code_2.trim() : '';
  if (code2) reqs.hard_skills.push(code2);

  // request_action_name → responsibility description
  const actionName = typeof row.request_action_name === 'string' ? row.request_action_name.trim() : '';
  if (actionName) reqs.responsibilities.push(actionName);

  // age range
  const ageMin = typeof row.age_range_min === 'number' ? row.age_range_min : null;
  const ageMax = typeof row.age_range_max === 'number' ? row.age_range_max : null;
  if (ageMin !== null || ageMax !== null) {
    reqs['age_range'] = { min: ageMin, max: ageMax };
  }

  // gender_requirement
  const gender = typeof row.gender_requirement === 'string' ? row.gender_requirement.trim() : '';
  if (gender) reqs['gender_requirement'] = gender;

  // vehicle_required
  const vehicle = typeof row.vehicle_required === 'string' ? row.vehicle_required.trim() : '';
  if (vehicle) reqs['vehicle_required'] = vehicle;

  // work_schedule
  const schedule = typeof row.work_schedule === 'string' ? row.work_schedule.trim() : '';
  if (schedule) reqs['work_schedule'] = schedule;

  // return null when nothing meaningful was found
  const hasData =
    reqs.hard_skills.length > 0 ||
    reqs.soft_skills.length > 0 ||
    reqs.responsibilities.length > 0 ||
    Object.keys(reqs).length > 3;

  return hasData ? reqs : null;
}

/** Convert a generic SO job row (PG or Siamraj) → Lumos Position */
function toLumosPosition(row: Record<string, unknown>): LumosPosition {
  const id = String(row.id ?? '');
  const title = String(row.job_description_code_1 ?? row.request_action_name ?? '—');
  const department = (row.department_name as string | null) ?? (row.unit_name as string | null) ?? null;
  const location = (row.location_address as string | null) || null;
  const jobType = (row.job_type as string | null) ?? null;
  const income = typeof row.total_income === 'number' ? row.total_income : null;
  const status = mapStatus(row.status as string | null);
  const createdAt = toIso(row.created_at as string | Date | null);
  const updatedAt = toIso((row.updated_at as string | Date | null) ?? (row.created_at as string | Date | null));
  const createdBy = (row.submittedByName as string | null) ?? (row.submittedByEmail as string | null) ?? null;

  return {
    id,
    title,
    department: department || null,
    location: location || null,
    employment_type: mapEmploymentType(jobType),
    description: null,
    requirements: buildRequirements(row),
    base_salary: income && income > 0 ? income : null,
    status,
    created_by: createdBy || null,
    interview_questions: null,
    created_at: createdAt,
    updated_at: updatedAt,
    active_config_version: null,
  };
}

function isActiveStatus(row: { status?: unknown }): boolean {
  return row.status === 'open' || row.status === 'in_progress';
}

// ─── Data fetchers ────────────────────────────────────────────────────────────

const parseIntOrNull = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

async function listSiamrajPositions(limit: number): Promise<LumosPosition[]> {
  const items = await listSiamrajUnitRequests({ limit, mode: 'all' });
  return items
    .filter(isActiveStatus)
    .map((j) => toLumosPosition(j as unknown as Record<string, unknown>));
}

async function listPgPositions(limit: number): Promise<LumosPosition[]> {
  const { rows } = await dbQuery<PgJobRow>(
    `select * from jarvis_rm.jobs
     where status in ('open', 'in_progress')
     order by created_at desc
     limit $1`,
    [limit],
  );
  return rows.map((r) => toLumosPosition(r as unknown as Record<string, unknown>));
}

// ─── Handler ──────────────────────────────────────────────────────────────────

async function handler(req: ApiReq, res: ApiRes): Promise<void> {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method Not Allowed');
  }

  try {
    const limit = Math.min(2000, Math.max(1, parseIntOrNull(req.query?.limit) ?? 500));

    const positions = isSiamrajUnitRequestsEnabled()
      ? await listSiamrajPositions(limit)
      : await listPgPositions(limit);

    return res.status(200).json(positions);
  } catch (e) {
    return handleApiError(res, e, 'lumos.positions');
  }
}

export default withLumosAuth(handler);
