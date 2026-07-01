import type { PoolClient } from 'pg';
import type { UserRole } from './auth.js';
import { writeAuditInTx, auditContextFromActor } from './audit.js';
import { DomainError } from './domainErrors.js';
import { dbQueryInTx, dbTransaction, isPgForeignKeyViolation, isPgUniqueViolation } from './postgres.js';
import { checkApiAccess } from './rbac.js';
import { tableInAppSchema } from './schema.js';

const calendarTable = tableInAppSchema('work_calendar');
const employeesTable = tableInAppSchema('employees');

export type WorkCalendarStatus =
  | 'normal_work'
  | 'cancel_by_employee'
  | 'late'
  | 'cancel_by_client'
  | 'no_show'
  | 'day_off'
  | 'available';

export const WORK_CALENDAR_STATUSES = new Set<WorkCalendarStatus>([
  'normal_work',
  'cancel_by_employee',
  'late',
  'cancel_by_client',
  'no_show',
  'day_off',
  'available',
]);

/** Statuses that require issue_reason per current WL workflow. */
export const ISSUE_REASON_REQUIRED_STATUSES = new Set<WorkCalendarStatus>([
  'cancel_by_employee',
  'late',
  'cancel_by_client',
  'no_show',
]);

export type WorkCalendarRow = {
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

export type CreateWorkCalendarInput = {
  employee_id: string;
  work_date: string;
  client_id?: string | null;
  client_name?: string | null;
  shift?: string | null;
  status: WorkCalendarStatus;
  income?: number | null;
  cost?: number | null;
  issue_reason?: string | null;
  notes?: string | null;
};

export type UpdateWorkCalendarInput = {
  id: string;
  status?: WorkCalendarStatus;
  client_name?: string | null;
  shift?: string | null;
  income?: number | null;
  cost?: number | null;
  issue_reason?: string | null;
  notes?: string | null;
};

export type CalendarActor = {
  userId: string;
  userEmail: string;
  role: UserRole;
  requestId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

const isDateYmd = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

const uuidRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWorkCalendarStatus(v: unknown): v is WorkCalendarStatus {
  return typeof v === 'string' && WORK_CALENDAR_STATUSES.has(v as WorkCalendarStatus);
}

export function requiresIssueReason(status: WorkCalendarStatus): boolean {
  return ISSUE_REASON_REQUIRED_STATUSES.has(status);
}

export function parseIntOrNull(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function assertIssueReasonForStatus(
  status: WorkCalendarStatus,
  issueReason: string | null | undefined,
): void {
  if (requiresIssueReason(status) && !(issueReason && issueReason.trim())) {
    throw new DomainError(
      400,
      'Bad request',
      'issue_reason is required when work status is not normal',
    );
  }
}

/**
 * Explicit allowed transitions — predictable calendar state changes.
 * day_off / available are scheduling states; problem statuses need issue_reason.
 */
export function assertAllowedStatusTransition(
  from: WorkCalendarStatus,
  to: WorkCalendarStatus,
): void {
  if (from === to) return;
  const allowed: Record<WorkCalendarStatus, Set<WorkCalendarStatus>> = {
    normal_work: new Set([
      'normal_work',
      'late',
      'cancel_by_employee',
      'cancel_by_client',
      'no_show',
      'day_off',
      'available',
    ]),
    available: new Set([
      'available',
      'normal_work',
      'late',
      'cancel_by_employee',
      'cancel_by_client',
      'no_show',
      'day_off',
    ]),
    day_off: new Set(['day_off', 'available', 'normal_work']),
    late: new Set(['late', 'normal_work', 'cancel_by_employee', 'no_show']),
    cancel_by_employee: new Set(['cancel_by_employee', 'normal_work', 'available', 'day_off']),
    cancel_by_client: new Set(['cancel_by_client', 'normal_work', 'available', 'day_off']),
    no_show: new Set(['no_show', 'normal_work', 'cancel_by_employee', 'day_off']),
  };
  if (!allowed[from]?.has(to)) {
    throw new DomainError(
      400,
      'Bad request',
      `Cannot change work calendar status from "${from}" to "${to}"`,
    );
  }
}

export function parseCreateWorkCalendarInput(raw: unknown): CreateWorkCalendarInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new DomainError(400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;
  const employee_id = typeof b.employee_id === 'string' ? b.employee_id.trim() : '';
  const work_date = b.work_date;
  if (!employee_id || !uuidRe.test(employee_id)) {
    throw new DomainError(400, 'Bad request', 'employee_id must be a valid UUID');
  }
  if (!isDateYmd(work_date)) {
    throw new DomainError(400, 'Bad request', 'work_date must be YYYY-MM-DD');
  }

  const cidRaw = typeof b.client_id === 'string' ? b.client_id.trim() : '';
  const client_id = uuidRe.test(cidRaw) ? cidRaw : null;
  const client_name =
    typeof b.client_name === 'string' && b.client_name.trim() ? b.client_name.trim() : null;
  const shift = typeof b.shift === 'string' && b.shift.trim() ? b.shift.trim() : null;
  const status = isWorkCalendarStatus(b.status) ? b.status : 'normal_work';
  const issue_reason =
    typeof b.issue_reason === 'string' && b.issue_reason.trim() ? b.issue_reason.trim() : null;
  const notes = typeof b.notes === 'string' && b.notes.trim() ? b.notes.trim() : null;

  assertIssueReasonForStatus(status, issue_reason);

  return {
    employee_id,
    work_date,
    client_id,
    client_name,
    shift,
    status,
    income: parseIntOrNull(b.income),
    cost: parseIntOrNull(b.cost),
    issue_reason,
    notes,
  };
}

export function parseUpdateWorkCalendarInput(raw: unknown): UpdateWorkCalendarInput {
  if (typeof raw !== 'object' || raw === null) {
    throw new DomainError(400, 'Bad request', 'Invalid JSON body');
  }
  const b = raw as Record<string, unknown>;
  const id = typeof b.id === 'string' ? b.id.trim() : '';
  if (!id || !uuidRe.test(id)) {
    throw new DomainError(400, 'Bad request', 'id must be a valid UUID');
  }
  const patch: UpdateWorkCalendarInput = { id };
  if (b.status !== undefined) {
    if (!isWorkCalendarStatus(b.status)) {
      throw new DomainError(400, 'Bad request', 'Invalid status');
    }
    patch.status = b.status;
  }
  if (b.client_name !== undefined) {
    patch.client_name =
      typeof b.client_name === 'string' ? b.client_name.trim() || null : null;
  }
  if (b.shift !== undefined) {
    patch.shift = typeof b.shift === 'string' ? b.shift.trim() || null : null;
  }
  if (b.income !== undefined) patch.income = parseIntOrNull(b.income);
  if (b.cost !== undefined) patch.cost = parseIntOrNull(b.cost);
  if (b.issue_reason !== undefined) {
    patch.issue_reason =
      typeof b.issue_reason === 'string' ? b.issue_reason.trim() || null : null;
  }
  if (b.notes !== undefined) {
    patch.notes = typeof b.notes === 'string' ? b.notes.trim() || null : null;
  }
  return patch;
}

function toYmd(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export function toWorkCalendarResponse(row: WorkCalendarRow) {
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

async function assertEmployeeExists(client: PoolClient, employeeId: string): Promise<void> {
  const { rows } = await dbQueryInTx<{ id: string }>(
    client,
    `select id from ${employeesTable} where id = $1::uuid limit 1`,
    [employeeId],
  );
  if (!rows[0]) {
    throw new DomainError(404, 'Not found', 'Employee not found');
  }
}

async function findByEmployeeDate(
  client: PoolClient,
  employeeId: string,
  workDate: string,
): Promise<WorkCalendarRow | null> {
  const { rows } = await dbQueryInTx<WorkCalendarRow>(
    client,
    `select * from ${calendarTable} where employee_id = $1::uuid and work_date = $2::date limit 1`,
    [employeeId, workDate],
  );
  return rows[0] ?? null;
}

function mapPgCalendarError(e: unknown): never {
  if (isPgUniqueViolation(e)) {
    throw new DomainError(
      409,
      'Conflict',
      'A calendar entry already exists for this employee on this date',
    );
  }
  if (isPgForeignKeyViolation(e)) {
    throw new DomainError(404, 'Not found', 'Employee or client reference not found');
  }
  throw e;
}

/** POST create — duplicate employee+date returns 409, not 500. */
export async function createWorkCalendarEntry(
  input: CreateWorkCalendarInput,
  actor: CalendarActor,
): Promise<WorkCalendarRow> {
  const access = checkApiAccess(actor.role, 'work-calendar', 'POST');
  if (!access.ok) {
    throw new DomainError(403, 'Forbidden', access.message);
  }

  try {
    return await dbTransaction(async (client) => {
      await assertEmployeeExists(client, input.employee_id);

      const existing = await findByEmployeeDate(client, input.employee_id, input.work_date);
      if (existing) {
        throw new DomainError(
          409,
          'Conflict',
          'A calendar entry already exists for this employee on this date — use PATCH to update',
        );
      }

      const { rows } = await dbQueryInTx<WorkCalendarRow>(
        client,
        `
        insert into ${calendarTable} (
          employee_id, work_date, client_id, client_name, shift, status,
          income, cost, issue_reason, notes, updated_at
        )
        values ($1::uuid, $2::date, $3::uuid, $4, $5, $6, $7, $8, $9, $10, now())
        returning *
      `,
        [
          input.employee_id,
          input.work_date,
          input.client_id || null,
          input.client_name,
          input.shift,
          input.status,
          input.income,
          input.cost,
          input.issue_reason,
          input.notes,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error('Failed to create calendar entry');

      const auditCtx = auditContextFromActor(actor);
      await writeAuditInTx(client, auditCtx, {
        action: 'work_calendar.create',
        entityType: 'work_calendar',
        entityId: row.id,
        after: {
          employee_id: input.employee_id,
          work_date: input.work_date,
          status: input.status,
        },
      });

      return row;
    });
  } catch (e) {
    if (e instanceof DomainError) throw e;
    mapPgCalendarError(e);
  }
}

/** PATCH update — explicit status transition + issue_reason validation. */
export async function updateWorkCalendarEntry(
  input: UpdateWorkCalendarInput,
  actor: CalendarActor,
): Promise<WorkCalendarRow> {
  const access = checkApiAccess(actor.role, 'work-calendar', 'PATCH');
  if (!access.ok) {
    throw new DomainError(403, 'Forbidden', access.message);
  }

  return dbTransaction(async (client) => {
    const { rows: curRows } = await dbQueryInTx<WorkCalendarRow>(
      client,
      `select * from ${calendarTable} where id = $1::uuid limit 1 for update`,
      [input.id],
    );
    const cur = curRows[0];
    if (!cur) {
      throw new DomainError(404, 'Not found', 'Calendar entry not found');
    }

    const fromStatus = cur.status as WorkCalendarStatus;
    const nextStatus = input.status ?? fromStatus;
    if (!isWorkCalendarStatus(nextStatus)) {
      throw new DomainError(400, 'Bad request', 'Invalid status');
    }

    assertAllowedStatusTransition(fromStatus, nextStatus);

    const nextIssue =
      input.issue_reason !== undefined ? input.issue_reason : cur.issue_reason;
    assertIssueReasonForStatus(nextStatus, nextIssue);

    const nextClientName =
      input.client_name !== undefined ? input.client_name : cur.client_name;
    const nextShift = input.shift !== undefined ? input.shift : cur.shift;
    const nextIncome = input.income !== undefined ? input.income : cur.income;
    const nextCost = input.cost !== undefined ? input.cost : cur.cost;
    const nextNotes = input.notes !== undefined ? input.notes : cur.notes;

    const { rows } = await dbQueryInTx<WorkCalendarRow>(
      client,
      `
      update ${calendarTable} set
        status = $2,
        client_name = $3,
        shift = $4,
        income = $5,
        cost = $6,
        issue_reason = $7,
        notes = $8,
        updated_at = now()
      where id = $1::uuid
      returning *
    `,
      [input.id, nextStatus, nextClientName, nextShift, nextIncome, nextCost, nextIssue, nextNotes],
    );
    const row = rows[0];
    if (!row) throw new Error('Failed to update calendar entry');

    const auditCtx = auditContextFromActor(actor);
    await writeAuditInTx(client, auditCtx, {
      action: 'work_calendar.update',
      entityType: 'work_calendar',
      entityId: row.id,
      before: { status: cur.status, issue_reason: cur.issue_reason },
      after: { status: row.status, issue_reason: row.issue_reason },
    });

    return row;
  });
}
