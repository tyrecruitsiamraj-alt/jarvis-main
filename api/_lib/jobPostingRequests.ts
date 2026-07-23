import { dbQuery, isPgUniqueViolation } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('job_posting_requests');
const MAX_TEXT = 400;
const MAX_LONG_TEXT = 2000;

export type JobPostingStatus = 'pending' | 'in_progress' | 'posted' | 'completed' | 'filled' | 'cancelled';
export type JobPostingRequestType = 'content' | 'scraping';
const STATUSES: JobPostingStatus[] = ['pending', 'in_progress', 'posted', 'completed', 'filled', 'cancelled'];
const REQUEST_TYPES: JobPostingRequestType[] = ['content', 'scraping'];
/** สถานะที่ถือว่า "ยังเปิดอยู่" — กันสร้างคำขอซ้ำต่อใบขอเดียวกัน (ตรงกับ partial unique index) */
const ACTIVE_STATUSES: JobPostingStatus[] = ['pending', 'in_progress', 'posted'];

export type JobPostingRequest = {
  id: string;
  job_id: string;
  request_no: string | null;
  request_type: JobPostingRequestType;
  status: JobPostingStatus;
  reason: string | null;
  notes: string | null;
  requested_by_user_id: string | null;
  requested_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type Row = {
  id: string;
  job_id: string;
  request_no: string | null;
  request_type: string;
  status: string;
  reason: string | null;
  notes: string | null;
  requested_by_user_id: string | null;
  requested_by_name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLS =
  'id, job_id, request_no, request_type, status, reason, notes, requested_by_user_id, requested_by_name, created_at, updated_at';

function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /job_posting_requests/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

function toIso(v: string | Date | null): string {
  if (v == null) return '';
  return v instanceof Date ? v.toISOString() : String(v);
}

function trimTo(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

function mapRow(r: Row): JobPostingRequest {
  return {
    id: r.id,
    job_id: r.job_id,
    request_no: r.request_no,
    request_type: REQUEST_TYPES.includes(r.request_type as JobPostingRequestType)
      ? (r.request_type as JobPostingRequestType)
      : 'content',
    status: (STATUSES as string[]).includes(r.status) ? (r.status as JobPostingStatus) : 'pending',
    reason: r.reason,
    notes: r.notes,
    requested_by_user_id: r.requested_by_user_id,
    requested_by_name: r.requested_by_name,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  };
}

export function normalizeJobPostingStatus(v: unknown): JobPostingStatus | null {
  return typeof v === 'string' && (STATUSES as string[]).includes(v) ? (v as JobPostingStatus) : null;
}

export function normalizeJobPostingRequestType(v: unknown): JobPostingRequestType | null {
  return typeof v === 'string' && REQUEST_TYPES.includes(v as JobPostingRequestType)
    ? (v as JobPostingRequestType)
    : null;
}

/** คำขอที่ยัง active อยู่ของใบขอนี้ (ถ้ามี) */
export async function getActiveJobPostingForJob(jobId: string): Promise<JobPostingRequest | null> {
  const key = jobId.trim();
  if (!key) return null;
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table} where job_id = $1 and status = ANY($2::text[]) order by created_at desc limit 1`,
      [key, ACTIVE_STATUSES],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

export type ListJobPostingsFilter = { status?: JobPostingStatus };

/** รายการคำขอทั้งหมด (สำหรับหน้าให้ทีมอื่นมาหยิบงานต่อ) */
export async function listJobPostingRequests(filter?: ListJobPostingsFilter): Promise<JobPostingRequest[]> {
  try {
    if (filter?.status) {
      const { rows } = await dbQuery<Row>(
        `select ${COLS} from ${table} where status = $1 order by created_at desc`,
        [filter.status],
      );
      return rows.map(mapRow);
    }
    const { rows } = await dbQuery<Row>(`select ${COLS} from ${table} order by created_at desc`);
    return rows.map(mapRow);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export type CreateJobPostingInput = {
  jobId: string;
  requestNo?: string | null;
  requestType?: JobPostingRequestType;
  reason?: unknown;
  userId?: string | null;
  userName?: string | null;
  /** ข้อมูลใบขอ (ตำแหน่ง/พื้นที่/รายได้ ฯลฯ) แนบให้ทีมคอนเทนต์ปลายทาง — เก็บลง job_snapshot */
  jobSnapshot?: Record<string, unknown> | null;
};

/**
 * สร้างคำขอโพสหางานใหม่ — ถ้ามีคำขอ active ของใบขอนี้อยู่แล้ว คืนอันเดิม (ไม่สร้างซ้ำ)
 * กันซ้ำสองชั้น: เช็คก่อน insert + partial unique index กันแข่งกันเขียนพร้อมกัน
 */
export async function createJobPostingRequest(input: CreateJobPostingInput): Promise<JobPostingRequest> {
  const jobId = input.jobId.trim();
  if (!jobId) throw new Error('job_id is required');

  const existing = await getActiveJobPostingForJob(jobId);
  if (existing) return existing;

  const userId = input.userId && uuidRe.test(input.userId) ? input.userId : null;
  const snapshot =
    input.jobSnapshot && typeof input.jobSnapshot === 'object' ? JSON.stringify(input.jobSnapshot) : null;
  const params = [
    jobId,
    trimTo(input.requestNo, MAX_TEXT),
    input.requestType ?? 'content',
    trimTo(input.reason, MAX_LONG_TEXT),
    userId,
    trimTo(input.userName, MAX_TEXT),
    snapshot,
  ];

  const insert = (withSnapshot: boolean) =>
    dbQuery<Row>(
      withSnapshot
        ? `insert into ${table} (job_id, request_no, request_type, reason, requested_by_user_id, requested_by_name, job_snapshot)
           values ($1, $2, $3, $4, $5::uuid, $6, $7::jsonb)
           returning ${COLS}`
        : `insert into ${table} (job_id, request_no, request_type, reason, requested_by_user_id, requested_by_name)
           values ($1, $2, $3, $4, $5::uuid, $6)
           returning ${COLS}`,
      withSnapshot ? params : params.slice(0, 6),
    );

  try {
    let rows: Row[];
    try {
      ({ rows } = await insert(true));
    } catch (e) {
      // ยังไม่ migrate 055 (ไม่มีคอลัมน์ job_snapshot) — เก็บแบบเดิมไปก่อน ไม่ให้ผู้ใช้พัง
      const msg = e instanceof Error ? e.message : String(e);
      if (!/job_snapshot/i.test(msg)) throw e;
      ({ rows } = await insert(false));
    }
    return mapRow(rows[0]);
  } catch (e) {
    if (isPgUniqueViolation(e)) {
      const race = await getActiveJobPostingForJob(jobId);
      if (race) return race;
    }
    throw e;
  }
}

/** อัปเดตสถานะ/หมายเหตุของคำขอ (เช่น รับไปทำ → in_progress, โพสแล้ว → posted, ได้คนแล้ว → filled) */
export async function updateJobPostingRequest(
  id: string,
  patch: { status?: unknown; notes?: unknown },
): Promise<JobPostingRequest | null> {
  const key = id.trim();
  if (!key || !uuidRe.test(key)) throw new Error('valid job posting id is required');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (patch.status !== undefined) {
    const status = normalizeJobPostingStatus(patch.status);
    if (!status) throw new Error('invalid status');
    sets.push(`status = $${idx++}`);
    params.push(status);
  }
  if (patch.notes !== undefined) {
    sets.push(`notes = $${idx++}`);
    params.push(trimTo(patch.notes, MAX_LONG_TEXT));
  }
  if (sets.length === 0) throw new Error('nothing to update');

  sets.push('updated_at = now()');
  params.push(key);

  const { rows } = await dbQuery<Row>(
    `update ${table} set ${sets.join(', ')} where id = $${idx} returning ${COLS}`,
    params,
  );
  return rows[0] ? mapRow(rows[0]) : null;
}
