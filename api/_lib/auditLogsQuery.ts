import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const auditTable = tableInAppSchema('audit_logs');

type AuditRow = {
  id: string;
  user_id: string | null;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: string | null;
  new_value: string | null;
  request_id: string | null;
  user_role: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | Date;
};

function toIso(value: string | Date): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

export type AuditLogDto = {
  id: string;
  user_id: string;
  user_name: string;
  user_role?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: string;
  new_value?: string;
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
};

function toDto(row: AuditRow): AuditLogDto {
  return {
    id: row.id,
    user_id: row.user_id ?? '',
    user_name: row.user_name,
    user_role: row.user_role ?? undefined,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    old_value: row.old_value ?? undefined,
    new_value: row.new_value ?? undefined,
    request_id: row.request_id ?? undefined,
    ip_address: row.ip_address ?? undefined,
    user_agent: row.user_agent ?? undefined,
    timestamp: toIso(row.created_at),
  };
}

/** รายการ audit ล่าสุดทั้งระบบ (admin) */
export async function listRecentAuditLogs(limit = 100): Promise<AuditLogDto[]> {
  const cap = Math.min(500, Math.max(1, limit));
  const { rows } = await dbQuery<AuditRow>(
    `select * from ${auditTable} order by created_at desc limit $1`,
    [cap],
  );
  return rows.map(toDto);
}
