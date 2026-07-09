import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { UserRole, JwtUserPayload } from './auth.js';
import { logError } from './logger.js';
import { dbQuery, dbQueryInTx } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import type { ApiReq, AuthedReq } from './http.js';

const auditTable = tableInAppSchema('audit_logs');

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Server-written audit event — clients must not spoof these as source of truth. */
export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
};

export type AuditContext = {
  requestId: string;
  userId: string | null;
  userName: string;
  userRole: UserRole | null;
  ipAddress: string | null;
  userAgent: string | null;
};

/** @deprecated Use AuditEventInput — kept for assignment/calendar services. */
export type AuditLogWrite = {
  userId: string | null;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string | null;
  newValue?: string | null;
  userRole?: UserRole | null;
  requestId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

let auditDisabled = false;
let extendedColumns: boolean | null = null;

function headerOne(req: ApiReq, name: string): string | null {
  const raw = req.headers?.[name];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function resolveRequestId(req: ApiReq): string {
  return (
    headerOne(req, 'x-request-id') ||
    headerOne(req, 'x-correlation-id') ||
    randomUUID()
  );
}

export function resolveClientIp(req: ApiReq): string | null {
  const forwarded = headerOne(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return headerOne(req, 'x-real-ip') || headerOne(req, 'x-vercel-forwarded-for');
}

export function resolveUserAgent(req: ApiReq): string | null {
  const ua = headerOne(req, 'user-agent');
  return ua ? ua.slice(0, 500) : null;
}

export function auditContextFromAuthed(req: AuthedReq): AuditContext {
  return {
    requestId: resolveRequestId(req),
    userId: uuidRe.test(req.user.sub) ? req.user.sub : null,
    userName: req.user.email || 'user',
    userRole: req.user.role,
    ipAddress: resolveClientIp(req),
    userAgent: resolveUserAgent(req),
  };
}

export function auditContextFromAnonymous(
  req: ApiReq,
  actor?: { userId?: string | null; userName?: string; userRole?: UserRole | null },
): AuditContext {
  const userId = actor?.userId && uuidRe.test(actor.userId) ? actor.userId : null;
  return {
    requestId: resolveRequestId(req),
    userId,
    userName: actor?.userName || 'anonymous',
    userRole: actor?.userRole ?? null,
    ipAddress: resolveClientIp(req),
    userAgent: resolveUserAgent(req),
  };
}

export function auditContextFromActor(
  actor: {
    userId: string;
    userEmail: string;
    role: UserRole;
    requestId?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): AuditContext {
  return {
    requestId: actor.requestId || randomUUID(),
    userId: uuidRe.test(actor.userId) ? actor.userId : null,
    userName: actor.userEmail || 'user',
    userRole: actor.role,
    ipAddress: actor.ipAddress ?? null,
    userAgent: actor.userAgent ?? null,
  };
}

function snapshotJson(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    const s = JSON.stringify(value);
    return s.length > 8000 ? `${s.slice(0, 8000)}…` : s;
  } catch {
    return String(value).slice(0, 8000);
  }
}

function isMissingAuditTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /audit_logs/i.test(msg) && /(does not exist|relation)/i.test(msg);
}

function isMissingExtendedColumn(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /audit_logs/i.test(msg) && /(request_id|user_role|ip_address|user_agent)/i.test(msg);
}

async function insertAuditRow(
  client: PoolClient | null,
  ctx: AuditContext,
  event: AuditEventInput,
): Promise<void> {
  if (auditDisabled) return;

  const oldValue = snapshotJson(event.before);
  const newValue = snapshotJson(event.after);
  const userId = ctx.userId && uuidRe.test(ctx.userId) ? ctx.userId : null;

  const baseParams = [
    userId,
    ctx.userName,
    event.action,
    event.entityType,
    event.entityId,
    oldValue,
    newValue,
  ];

  const run = async (sql: string, params: unknown[]) => {
    if (client) {
      await dbQueryInTx(client, sql, params);
    } else {
      await dbQuery(sql, params);
    }
  };

  if (extendedColumns !== false) {
    try {
      await run(
        `
        insert into ${auditTable} (
          user_id, user_name, action, entity_type, entity_id,
          old_value, new_value, request_id, user_role, ip_address, user_agent
        )
        values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
        [
          ...baseParams,
          ctx.requestId,
          ctx.userRole,
          ctx.ipAddress,
          ctx.userAgent,
        ],
      );
      extendedColumns = true;
      return;
    } catch (e) {
      if (isMissingAuditTable(e)) {
        auditDisabled = true;
        logError('audit.table_missing', { message: 'audit_logs table not available — skipping audit' });
        return;
      }
      if (isMissingExtendedColumn(e)) {
        extendedColumns = false;
      } else {
        throw e;
      }
    }
  }

  try {
    await run(
      `
      insert into ${auditTable} (user_id, user_name, action, entity_type, entity_id, old_value, new_value)
      values ($1::uuid, $2, $3, $4, $5, $6, $7)
    `,
      baseParams,
    );
  } catch (e) {
    if (isMissingAuditTable(e)) {
      auditDisabled = true;
      logError('audit.table_missing', { message: 'audit_logs table not available — skipping audit' });
      return;
    }
    throw e;
  }
}

/** Alias for createAuditEvent — server-side mutation audit. */
export async function writeAudit(ctx: AuditContext, event: AuditEventInput): Promise<void> {
  return createAuditEvent(ctx, event);
}

/**
 * Write audit after a successful mutation (best-effort — never throws to caller).
 * Use from HTTP handlers outside transactions.
 */
export async function createAuditEvent(ctx: AuditContext, event: AuditEventInput): Promise<void> {
  try {
    await insertAuditRow(null, ctx, event);
  } catch (e) {
    logError('audit.write_failed', {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      requestId: ctx.requestId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/** Convenience for authenticated handlers. */
export async function auditFromAuthed(req: AuthedReq, event: AuditEventInput): Promise<void> {
  return createAuditEvent(auditContextFromAuthed(req), event);
}

/** Convenience for unauthenticated auth flows (login, password reset). */
export async function auditFromAnonymous(
  req: ApiReq,
  actor: { userId?: string | null; userName?: string; userRole?: UserRole | null },
  event: AuditEventInput,
): Promise<void> {
  return createAuditEvent(auditContextFromAnonymous(req, actor), event);
}

/** Write audit inside an open DB transaction (participates in commit/rollback). */
export async function writeAuditInTx(
  client: PoolClient,
  ctx: AuditContext,
  event: AuditEventInput,
): Promise<void> {
  try {
    await insertAuditRow(client, ctx, event);
  } catch (e) {
    if (isMissingAuditTable(e)) {
      auditDisabled = true;
      return;
    }
    logError('audit.write_failed_in_tx', {
      action: event.action,
      message: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

/** @deprecated Use writeAuditInTx — adapter for existing services. */
export async function writeAuditLogInTx(client: PoolClient, entry: AuditLogWrite): Promise<void> {
  const ctx: AuditContext = {
    requestId: entry.requestId || randomUUID(),
    userId: entry.userId && uuidRe.test(entry.userId) ? entry.userId : null,
    userName: entry.userName,
    userRole: entry.userRole ?? null,
    ipAddress: entry.ipAddress ?? null,
    userAgent: entry.userAgent ?? null,
  };
  await writeAuditInTx(client, ctx, {
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: entry.oldValue ? tryParseJson(entry.oldValue) : null,
    after: entry.newValue ? tryParseJson(entry.newValue) : null,
  });
}

function tryParseJson(s: string): unknown {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return s;
  }
}
