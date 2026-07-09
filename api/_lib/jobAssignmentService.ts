import type { PoolClient } from 'pg';
import type { UserRole } from './auth.js';
import { writeAuditInTx, auditContextFromActor } from './audit.js';
import { DomainError } from './domainErrors.js';
import { dbQueryInTx, dbTransaction } from './postgres.js';
import { checkApiAccess } from './rbac.js';
import { tableInAppSchema } from './schema.js';

const assignmentsTable = tableInAppSchema('job_assignments');
const jobsTable = tableInAppSchema('jobs');
const candidatesTable = tableInAppSchema('candidates');

export type AssignmentType = 'start' | 'replacement' | 'trial';
export type AssignmentStatus = 'sent' | 'passed' | 'failed' | 'started' | 'cancelled';

export type JobAssignmentRow = {
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

export type CreateJobAssignmentInput = {
  job_id: string;
  candidate_id: string;
  candidate_name: string;
  assignment_type: AssignmentType;
  start_date: string;
  end_date?: string | null;
  status: AssignmentStatus;
  trial_days: number;
};

export type AssignmentActor = {
  userId: string;
  userEmail: string;
  role: UserRole;
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Active assignments block duplicate assign to the same job. */
export const ACTIVE_ASSIGNMENT_STATUSES: AssignmentStatus[] = ['sent', 'passed', 'started'];

/** Candidates in these states cannot receive new assignments. */
export const TERMINAL_CANDIDATE_STATUSES = new Set(['drop', 'done', 'no_job']);

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function isAssignmentType(v: unknown): v is AssignmentType {
  return v === 'start' || v === 'replacement' || v === 'trial';
}

export function isAssignmentStatus(v: unknown): v is AssignmentStatus {
  return (
    v === 'sent' ||
    v === 'passed' ||
    v === 'failed' ||
    v === 'started' ||
    v === 'cancelled'
  );
}

export function isTerminalCandidateStatus(status: string): boolean {
  return TERMINAL_CANDIDATE_STATUSES.has(status);
}

/** Candidate status after a new assignment is created (business rule). */
export function candidateStatusAfterAssignment(
  currentStatus: string,
  assignmentStatus: AssignmentStatus,
): string | null {
  if (isTerminalCandidateStatus(currentStatus)) return null;
  if (assignmentStatus === 'started') return 'waiting_to_start';
  if (assignmentStatus === 'passed') return 'waiting_to_start';
  if (currentStatus === 'inprocess' || currentStatus === 'waiting_interview') {
    return 'waiting_interview';
  }
  return null;
}

export function parseCreateAssignmentInput(raw: unknown): CreateJobAssignmentInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new DomainError(400, 'Bad request', 'Invalid JSON body');
  }
  const body = raw as Record<string, unknown>;

  const job_id = typeof body.job_id === 'string' ? body.job_id.trim() : '';
  const candidate_id = typeof body.candidate_id === 'string' ? body.candidate_id.trim() : '';
  const candidate_name = typeof body.candidate_name === 'string' ? body.candidate_name.trim() : '';
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
    throw new DomainError(400, 'Bad request', 'job_id, candidate_id, candidate_name are required');
  }
  if (!isAssignmentType(assignment_type)) {
    throw new DomainError(400, 'Bad request', 'Invalid assignment_type');
  }
  if (!isDateYmd(start_date)) {
    throw new DomainError(400, 'Bad request', 'start_date must be YYYY-MM-DD');
  }
  if (!isAssignmentStatus(status)) {
    throw new DomainError(400, 'Bad request', 'Invalid status');
  }

  const endYmd =
    end_date === null || end_date === undefined || end_date === ''
      ? null
      : isDateYmd(end_date)
        ? end_date
        : null;
  if (end_date !== null && end_date !== undefined && end_date !== '' && endYmd === null) {
    throw new DomainError(400, 'Bad request', 'end_date must be YYYY-MM-DD or empty');
  }

  return {
    job_id,
    candidate_id,
    candidate_name,
    assignment_type,
    start_date,
    end_date: endYmd,
    status,
    trial_days,
  };
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

export function toAssignmentResponse(row: JobAssignmentRow) {
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

async function assertNoActiveDuplicate(
  client: PoolClient,
  jobId: string,
  candidateId: string,
): Promise<void> {
  const { rows } = await dbQueryInTx<{ id: string }>(
    client,
    `
    select id from ${assignmentsTable}
    where job_id = $1::uuid and candidate_id = $2::uuid
      and status = any($3::text[])
    limit 1
    for update
  `,
    [jobId, candidateId, ACTIVE_ASSIGNMENT_STATUSES],
  );
  if (rows[0]) {
    throw new DomainError(
      409,
      'Conflict',
      'Candidate is already actively assigned to this job',
    );
  }
}

/**
 * Create assignment atomically: validate → insert → update candidate/job status → audit.
 * Assumption: caller authenticated; RBAC checked here for defense in depth.
 */
export async function createJobAssignment(
  input: CreateJobAssignmentInput,
  actor: AssignmentActor,
): Promise<JobAssignmentRow> {
  const access = checkApiAccess(actor.role, 'job-assignments', 'POST');
  if (!access.ok) {
    throw new DomainError(403, 'Forbidden', access.message);
  }

  return dbTransaction(async (client) => {
    const { rows: jobRows } = await dbQueryInTx<{ id: string; status: string }>(
      client,
      `select id, status from ${jobsTable} where id = $1::uuid limit 1 for update`,
      [input.job_id],
    );
    const job = jobRows[0];
    if (!job) {
      throw new DomainError(404, 'Not found', 'Job not found');
    }
    if (job.status === 'cancelled' || job.status === 'closed') {
      throw new DomainError(400, 'Bad request', 'Cannot assign candidates to a closed or cancelled job');
    }

    const { rows: candidateRows } = await dbQueryInTx<{ id: string; status: string }>(
      client,
      `select id, status from ${candidatesTable} where id = $1::uuid limit 1 for update`,
      [input.candidate_id],
    );
    const candidate = candidateRows[0];
    if (!candidate) {
      throw new DomainError(404, 'Not found', 'Candidate not found');
    }
    if (isTerminalCandidateStatus(candidate.status)) {
      throw new DomainError(
        400,
        'Bad request',
        `Candidate cannot be assigned while status is "${candidate.status}"`,
      );
    }

    await assertNoActiveDuplicate(client, input.job_id, input.candidate_id);

    const { rows: inserted } = await dbQueryInTx<JobAssignmentRow>(
      client,
      `
      insert into ${assignmentsTable} (
        job_id, candidate_id, candidate_name,
        assignment_type, start_date, end_date, status, trial_days
      )
      values ($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7, $8)
      returning *
    `,
      [
        input.job_id,
        input.candidate_id,
        input.candidate_name,
        input.assignment_type,
        input.start_date,
        input.end_date,
        input.status,
        input.trial_days,
      ],
    );
    const row = inserted[0];
    if (!row) {
      throw new Error('Failed to create assignment');
    }

    const nextCandidateStatus = candidateStatusAfterAssignment(candidate.status, input.status);
    if (nextCandidateStatus && nextCandidateStatus !== candidate.status) {
      await dbQueryInTx(
        client,
        `update ${candidatesTable} set status = $2 where id = $1::uuid`,
        [input.candidate_id, nextCandidateStatus],
      );
    }

    if (job.status === 'open' && ACTIVE_ASSIGNMENT_STATUSES.includes(input.status)) {
      await dbQueryInTx(
        client,
        `update ${jobsTable} set status = 'in_progress' where id = $1::uuid and status = 'open'`,
        [input.job_id],
      );
    }

    const auditCtx = auditContextFromActor(actor);
    await writeAuditInTx(client, auditCtx, {
      action: 'job_assignment.create',
      entityType: 'job_assignment',
      entityId: row.id,
      after: {
        job_id: input.job_id,
        candidate_id: input.candidate_id,
        status: input.status,
        assignment_type: input.assignment_type,
      },
    });

    return row;
  });
}
