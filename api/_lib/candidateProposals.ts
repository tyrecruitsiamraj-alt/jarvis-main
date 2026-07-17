import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const table = tableInAppSchema('candidate_proposals');
const MAX_TEXT = 400;
const MAX_REASON = 2000;

export type ProposalSource = 'board' | 'irecruit';
export type ProposalTier = 'green' | 'yellow' | 'red';
export type ProposalStatus =
  | 'proposed'
  | 'reserved'
  | 'contacted'
  | 'placed'
  | 'rejected'
  | 'cancelled';

const SOURCES: ProposalSource[] = ['board', 'irecruit'];
const TIERS: ProposalTier[] = ['green', 'yellow', 'red'];
const STATUSES: ProposalStatus[] = [
  'proposed',
  'reserved',
  'contacted',
  'placed',
  'rejected',
  'cancelled',
];
/** สถานะที่ถือว่า "กำลังจอง/ทำงานอยู่" — ผู้สมัครคนเดียวมีได้ใบขอเดียวในสถานะเหล่านี้ */
export const ACTIVE_PROPOSAL_STATUSES: ProposalStatus[] = ['reserved', 'contacted', 'placed'];

export function isActiveProposalStatus(s: ProposalStatus): boolean {
  return (ACTIVE_PROPOSAL_STATUSES as string[]).includes(s);
}

export type CandidateProposal = {
  id: string;
  job_id: string;
  request_no: string | null;
  source: ProposalSource;
  candidate_ref: string;
  candidate_name: string | null;
  candidate_phone: string | null;
  candidate_position: string | null;
  tier: ProposalTier | null;
  reason: string | null;
  status: ProposalStatus;
  proposed_by_user_id: string | null;
  proposed_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type Row = {
  id: string;
  job_id: string;
  request_no: string | null;
  source: string;
  candidate_ref: string;
  candidate_name: string | null;
  candidate_phone: string | null;
  candidate_position: string | null;
  tier: string | null;
  reason: string | null;
  status: string;
  proposed_by_user_id: string | null;
  proposed_by_name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const COLS =
  'id, job_id, request_no, source, candidate_ref, candidate_name, candidate_phone, ' +
  'candidate_position, tier, reason, status, proposed_by_user_id, proposed_by_name, ' +
  'created_at, updated_at';

function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /candidate_proposals/i.test(msg) && /(does not exist|relation)/i.test(msg);
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

function mapRow(r: Row): CandidateProposal {
  return {
    id: r.id,
    job_id: r.job_id,
    request_no: r.request_no,
    source: (SOURCES as string[]).includes(r.source) ? (r.source as ProposalSource) : 'board',
    candidate_ref: r.candidate_ref,
    candidate_name: r.candidate_name,
    candidate_phone: r.candidate_phone,
    candidate_position: r.candidate_position,
    tier: r.tier && (TIERS as string[]).includes(r.tier) ? (r.tier as ProposalTier) : null,
    reason: r.reason,
    status: (STATUSES as string[]).includes(r.status) ? (r.status as ProposalStatus) : 'reserved',
    proposed_by_user_id: r.proposed_by_user_id,
    proposed_by_name: r.proposed_by_name,
    created_at: toIso(r.created_at),
    updated_at: toIso(r.updated_at),
  };
}

export function normalizeSource(v: unknown): ProposalSource | null {
  return typeof v === 'string' && (SOURCES as string[]).includes(v) ? (v as ProposalSource) : null;
}

export function normalizeStatus(v: unknown): ProposalStatus | null {
  return typeof v === 'string' && (STATUSES as string[]).includes(v)
    ? (v as ProposalStatus)
    : null;
}

function normalizeTier(v: unknown): ProposalTier | null {
  return typeof v === 'string' && (TIERS as string[]).includes(v) ? (v as ProposalTier) : null;
}

/** ประวัติการเสนอทั้งหมดของใบขอเดียว (ล่าสุดก่อน) */
export async function listProposalsForJob(jobId: string): Promise<CandidateProposal[]> {
  const key = jobId.trim();
  if (!key) return [];
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table} where job_id = $1 order by created_at desc`,
      [key],
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

/** ประวัติการเสนอของหลายใบขอ — คืน map job_id → รายการ (สำหรับนับ/กันเสนอซ้ำหน้ารวม) */
export async function listProposalsForJobs(
  jobIds: string[],
): Promise<Map<string, CandidateProposal[]>> {
  const keys = [...new Set(jobIds.map((j) => (j || '').trim()).filter(Boolean))];
  const map = new Map<string, CandidateProposal[]>();
  if (keys.length === 0) return map;
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table} where job_id = ANY($1::text[]) order by created_at desc`,
      [keys],
    );
    for (const r of rows) {
      const item = mapRow(r);
      const list = map.get(item.job_id) ?? [];
      list.push(item);
      map.set(item.job_id, list);
    }
    return map;
  } catch (e) {
    if (isMissingTable(e)) return map;
    throw e;
  }
}

/** ผู้สมัครคนนี้ (source+candidate_ref) กำลังจองอยู่กับใบขออื่นหรือไม่ — กันเสนอซ้อนข้ามใบขอ */
export async function findActiveConflict(
  source: ProposalSource,
  candidateRef: string,
  excludeJobId: string,
): Promise<CandidateProposal | null> {
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table}
       where source = $1 and candidate_ref = $2 and job_id <> $3 and status = ANY($4::text[])
       order by updated_at desc limit 1`,
      [source, candidateRef, excludeJobId, ACTIVE_PROPOSAL_STATUSES],
    );
    return rows[0] ? mapRow(rows[0]) : null;
  } catch (e) {
    if (isMissingTable(e)) return null;
    throw e;
  }
}

/** รายชื่อคนที่กำลังจอง/ติดต่อ/ลงงานอยู่ ทั่วทุกใบขอ (สำหรับหน้า "รายชื่อคนจอง") */
export async function listActiveProposals(): Promise<CandidateProposal[]> {
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${table} where status = ANY($1::text[]) order by updated_at desc`,
      [ACTIVE_PROPOSAL_STATUSES],
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export type UpsertProposalInput = {
  jobId: string;
  requestNo?: string | null;
  source: ProposalSource;
  candidateRef: string;
  candidateName?: unknown;
  candidatePhone?: unknown;
  candidatePosition?: unknown;
  tier?: unknown;
  reason?: unknown;
  status?: unknown;
  userId?: string | null;
  userName?: string | null;
};

/**
 * บันทึกการเสนอ/จองตัว — idempotent ต่อ (job_id, source, candidate_ref).
 * เสนอซ้ำ = อัปเดตเหตุผล/สถานะ/เวลา (ไม่สร้างแถวใหม่).
 */
export async function upsertProposal(input: UpsertProposalInput): Promise<CandidateProposal> {
  const jobId = input.jobId.trim();
  const candidateRef = String(input.candidateRef ?? '').trim();
  if (!jobId) throw new Error('job_id is required');
  if (!candidateRef) throw new Error('candidate_ref is required');
  if (!normalizeSource(input.source)) throw new Error('source must be board or irecruit');

  const status = normalizeStatus(input.status) ?? 'reserved';
  const userId =
    input.userId && uuidRe.test(input.userId) ? input.userId : null;

  const params: unknown[] = [
    jobId,
    trimTo(input.requestNo, MAX_TEXT),
    input.source,
    candidateRef.slice(0, MAX_TEXT),
    trimTo(input.candidateName, MAX_TEXT),
    trimTo(input.candidatePhone, MAX_TEXT),
    trimTo(input.candidatePosition, MAX_TEXT),
    normalizeTier(input.tier),
    trimTo(input.reason, MAX_REASON),
    status,
    userId,
    trimTo(input.userName, MAX_TEXT),
  ];

  const { rows } = await dbQuery<Row>(
    `
    insert into ${table} (
      job_id, request_no, source, candidate_ref, candidate_name, candidate_phone,
      candidate_position, tier, reason, status, proposed_by_user_id, proposed_by_name
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $12)
    on conflict (job_id, source, candidate_ref) do update set
      request_no = excluded.request_no,
      candidate_name = coalesce(excluded.candidate_name, ${table}.candidate_name),
      candidate_phone = coalesce(excluded.candidate_phone, ${table}.candidate_phone),
      candidate_position = coalesce(excluded.candidate_position, ${table}.candidate_position),
      tier = coalesce(excluded.tier, ${table}.tier),
      reason = coalesce(excluded.reason, ${table}.reason),
      status = excluded.status,
      proposed_by_user_id = excluded.proposed_by_user_id,
      proposed_by_name = excluded.proposed_by_name,
      updated_at = now()
    returning ${COLS}
    `,
    params,
  );
  return mapRow(rows[0]);
}

/** อัปเดตสถานะ/เหตุผลของการเสนอที่มีอยู่ (เช่น ยกเลิก, เลื่อนเป็นลงงาน) */
export async function updateProposal(
  id: string,
  patch: { status?: unknown; reason?: unknown },
): Promise<CandidateProposal | null> {
  const key = id.trim();
  if (!key || !uuidRe.test(key)) throw new Error('valid proposal id is required');

  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const status = normalizeStatus(patch.status);
  if (patch.status !== undefined) {
    if (!status) throw new Error('invalid status');
    sets.push(`status = $${idx++}`);
    params.push(status);
  }
  if (patch.reason !== undefined) {
    sets.push(`reason = $${idx++}`);
    params.push(trimTo(patch.reason, MAX_REASON));
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
