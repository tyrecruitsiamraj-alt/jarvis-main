import { dbQuery } from './postgres.js';
import { getSiamrajSqlServerConfig } from './siamrajSqlServer.js';
import {
  getSiamrajSqlServerUnitRequestById,
  listSiamrajSqlServerUnitRequests,
  SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT,
} from './siamrajSqlServerRequests.js';
import {
  listSiamrajSqlServerThroughput,
  type SiamrajThroughputRecord,
} from './siamrajSqlServerThroughput.js';
import { listSiamrajSqlServerClosedRequests } from './siamrajSqlServerClosed.js';
import { inferJobTypeFromDescription, primaryJobRoleLabel } from './siamrajJobMapping.js';
import { toBangkokYmd } from './businessDate.js';

export type SiamrajDbSource = 'postgres' | 'sqlserver';

export function getSiamrajDbSource(): SiamrajDbSource | null {
  const explicit = (process.env.SIAMRAJ_DB_SOURCE || 'auto').toLowerCase();
  const hasSql = !!getSiamrajSqlServerConfig();
  const hasPg = !!getSiamrajSchema();

  if (explicit === 'sqlserver' && hasSql) return 'sqlserver';
  if (explicit === 'postgres' && hasPg) return 'postgres';
  if (explicit === 'auto' || explicit === '') {
    if (hasSql) return 'sqlserver';
    if (hasPg) return 'postgres';
  }
  return null;
}

function normalizeLookupId(id: string): string {
  const t = id.trim();
  if (t.startsWith('siamraj-sql:')) return t.slice('siamraj-sql:'.length);
  if (t.startsWith('siamraj:')) return t.slice('siamraj:'.length);
  return t;
}

function quotePgIdent(ident: string): string {
  return `"${String(ident).replace(/"/g, '""')}"`;
}

export function getSiamrajSchema(): string | null {
  const s = (process.env.SIAMRAJ_SCHEMA || process.env.SO_OPERATION_SCHEMA || '').trim();
  if (!s) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}

export function isSiamrajUnitRequestsEnabled(): boolean {
  const flag = (process.env.SIAMRAJ_UNIT_REQUESTS_ENABLED || 'true').toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  return !!getSiamrajDbSource();
}

function fq(schema: string, table: string): string {
  return `${quotePgIdent(schema)}.${quotePgIdent(table)}`;
}

export type SiamrajUnitRequestRow = {
  act_saleco_id: string;
  request_no: string | null;
  act_saleco_datetime: string | Date | null;
  act_saleco_effective_date: string | Date | null;
  site_code: string | null;
  status: string | null;
  staff_fullname: string | null;
  staff_id: string | null;
  mobile_phone: string | null;
  job_description_code_1: string | null;
  job_description_code_2: string | null;
  staff_title_code: string | null;
  requester_name: string | null;
  requester_email: string | null;
  request_action_name: string | null;
  request_action_code: string | null;
  request_position_unit: number | null;
  resignation: string | null;
  reason_leaving_main_code: string | null;
  reason_main_name: string | null;
  reason_sub_name: string | null;
  vehicle_type_code: string | null;
  vehicle_type_name: string | null;
  vehicle_remark: string | null;
  vehicle_kind_code: string | null;
  rm_staffing_ack_at: string | Date | null;
  act_saleco_need_staff: boolean | null;
};

function toIso(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function toYmd(v: string | Date | null | undefined): string {
  return toBangkokYmd(v);
}

export function mapSiamrajRow(r: SiamrajUnitRequestRow) {
  const reasonParts = [r.reason_main_name, r.reason_sub_name].filter(Boolean);
  const vehicleParts = [r.vehicle_type_name, r.vehicle_remark].filter(Boolean);
  const roleLabel = primaryJobRoleLabel(r.job_description_code_1, r.staff_title_code, r.job_description_code_1);
  const jobType = inferJobTypeFromDescription(r.job_description_code_1, r.job_description_code_2, r.staff_title_code);

  return {
    id: `siamraj:${r.act_saleco_id}`,
    externalId: r.act_saleco_id,
    source: 'siamraj' as const,
    readOnly: true,
    request_no: r.request_no || undefined,
    submittedByName: r.requester_name?.trim() || undefined,
    submittedByEmail: r.requester_email?.trim() || undefined,
    submittedAt: toIso(r.act_saleco_datetime) || undefined,
    required_date: toYmd(r.act_saleco_effective_date) || toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    lastWorkingDay: toYmd(r.act_saleco_effective_date) || undefined,
    unit_name: r.site_code || '—',
    site_code: r.site_code || undefined,
    position_units: r.request_position_unit ?? undefined,
    location_address: r.site_code || '',
    request_action_code: r.request_action_code || undefined,
    request_action_name: r.request_action_name || undefined,
    resigned_employee_name: r.staff_fullname?.trim() || undefined,
    resigned_reason: reasonParts.length ? reasonParts.join(' — ') : undefined,
    vehicle_required: vehicleParts.length ? vehicleParts.join(' ') : r.vehicle_type_code || undefined,
    contact_name: undefined,
    contact_phone: r.mobile_phone?.trim() || undefined,
    status: r.rm_staffing_ack_at ? 'closed' : 'open',
    siamraj_status: r.status || undefined,
    need_staff: r.act_saleco_need_staff ?? undefined,
    staff_title_code: r.staff_title_code || undefined,
    job_description_code_1: roleLabel || r.job_description_code_1 || undefined,
    job_description_code_2: r.job_description_code_2 || undefined,
    request_date: toYmd(r.act_saleco_datetime) || new Date().toISOString().slice(0, 10),
    created_at: toIso(r.act_saleco_datetime) || new Date().toISOString(),
    urgency: 'advance' as const,
    total_income: 0,
    job_type: jobType,
    job_category: 'private' as const,
    penalty_per_day: 0,
    days_without_worker: 0,
    total_penalty: 0,
  };
}

const BASE_SELECT = `
  h.act_saleco_id,
  h.request_no,
  h.act_saleco_datetime,
  h.act_saleco_effective_date,
  h.site_code,
  h.status,
  h.staff_fullname,
  h.staff_id,
  h.mobile_phone,
  h.job_description_code_1,
  h.job_description_code_2,
  h.staff_title_code,
  trim(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')) AS requester_name,
  u.email AS requester_email,
  ma.request_action_name,
  ma.request_action_code,
  p.request_position_unit,
  a.resignation,
  a.reason_leaving_main_code,
  rm.name AS reason_main_name,
  rs.name AS reason_sub_name,
  a.vehicle_type_code,
  vt.name AS vehicle_type_name,
  a.vehicle_remark,
  a.vehicle_kind_code,
  h.rm_staffing_ack_at,
  h.act_saleco_need_staff
`;

function buildFromClause(schema: string): string {
  const head = fq(schema, 'activity_to_saleco_head');
  const body = fq(schema, 'activity_to_saleco');
  const pos = fq(schema, 'activity_to_saleco_request_position');
  const activity = fq(schema, 'ms_activity');
  const user = fq(schema, 'sys_user');
  const reasonMain = fq(schema, 'ms_reason_leaving_main');
  const reasonSub = fq(schema, 'ms_reason_leaving_sub');
  const vehicleType = fq(schema, 'ms_vehicle_type');

  return `
    FROM ${head} h
    LEFT JOIN ${user} u ON u.id = h.created_by_user_id
    LEFT JOIN ${activity} ma ON ma.request_action_code = h.request_action_code
    LEFT JOIN ${body} a ON a.act_saleco_id::text = h.act_saleco_id::text
    LEFT JOIN ${pos} p ON p.act_saleco_id::text = h.act_saleco_id::text AND p.seq = 1
    LEFT JOIN ${reasonMain} rm ON rm.code = a.reason_leaving_main_code
    LEFT JOIN ${reasonSub} rs ON rs.code = a.reason_leaving_sub_code
    LEFT JOIN ${vehicleType} vt ON vt.code = a.vehicle_type_code
  `;
}

function staffingQueueWhere(): string {
  return `
    h.act_saleco_need_staff = true
    AND h.rm_staffing_ack_at IS NULL
    AND h.status IN ('OP', 'PA', 'RE', 'IP')
  `;
}

export async function listSiamrajUnitRequests(options: { limit?: number; mode?: string }) {
  const source = getSiamrajDbSource();
  if (!source) return [];

  if (source === 'sqlserver') {
    return listSiamrajSqlServerUnitRequests(options);
  }

  const schema = getSiamrajSchema();
  if (!schema) return [];

  const limit = Math.min(Math.max(options.limit ?? 200, 1), SIAMRAJ_UNIT_REQUESTS_MAX_LIMIT);
  const mode = (options.mode || process.env.SIAMRAJ_UNIT_REQUESTS_MODE || 'staffing_queue').toLowerCase();
  const where = mode === 'all' ? '1=1' : staffingQueueWhere();

  const { rows } = await dbQuery<SiamrajUnitRequestRow>(
    `SELECT ${BASE_SELECT}
     ${buildFromClause(schema)}
     WHERE ${where}
     ORDER BY h.act_saleco_datetime DESC NULLS LAST
     LIMIT $1`,
    [limit],
  );

  return rows.map(mapSiamrajRow);
}

export async function getSiamrajUnitRequestById(id: string) {
  const source = getSiamrajDbSource();
  if (!source) return null;

  if (source === 'sqlserver') {
    return getSiamrajSqlServerUnitRequestById(normalizeLookupId(id));
  }

  const schema = getSiamrajSchema();
  if (!schema) return null;

  const lookupId = normalizeLookupId(id);
  const { rows } = await dbQuery<SiamrajUnitRequestRow>(
    `SELECT ${BASE_SELECT}
     ${buildFromClause(schema)}
     WHERE h.act_saleco_id::text = $1 OR h.request_no = $1
     LIMIT 1`,
    [lookupId],
  );

  return rows[0] ? mapSiamrajRow(rows[0]) : null;
}

export type { SiamrajThroughputRecord };

export async function listSiamrajThroughput(options: {
  from: string;
  to: string;
}): Promise<SiamrajThroughputRecord[]> {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listSiamrajSqlServerThroughput(options);
  }
  return [];
}

/** รายการใบขอที่ปิด/แจ้งเข้าในช่วง — สำหรับ drill-down การ์ด "ปิดใบขอ" (เลขตรงกับ throughput) */
export async function listSiamrajClosedRequests(options: {
  from: string;
  to: string;
  limit?: number;
}) {
  const source = getSiamrajDbSource();
  if (source === 'sqlserver') {
    return listSiamrajSqlServerClosedRequests(options);
  }
  return [];
}
