import { dbQuery } from './postgres.js';
import type { UserRole } from './auth.js';
import { meetsMinimumRole } from './rbac.js';
import { tableInAppSchema } from './schema.js';

const grantsTable = tableInAppSchema('role_function_grants');

/** Keep in sync with src/lib/roleFunctions.ts */
export const FUNCTION_DEFAULT_MIN_ROLE: Record<string, UserRole> = {
  dashboard: 'staff',
  candidates_read: 'staff',
  candidates_create: 'staff',
  candidates_edit: 'supervisor',
  jobs_read: 'staff',
  jobs_edit: 'supervisor',
  jobs_assign_staff: 'supervisor',
  unit_requests_read: 'staff',
  unit_notes_edit: 'staff',
  employees_read: 'staff',
  employees_edit: 'supervisor',
  clients_read: 'staff',
  clients_edit: 'supervisor',
  work_calendar_read: 'staff',
  work_calendar_manage: 'supervisor',
  driver_care_read: 'staff',
  driver_care_log: 'staff',
  driver_care_manage: 'supervisor',
  settings_access: 'admin',
  users_manage: 'admin',
  audit_logs: 'admin',
};

export const VALID_FUNCTION_IDS = new Set(Object.keys(FUNCTION_DEFAULT_MIN_ROLE));
export const VALID_ROLES: UserRole[] = ['opl', 'staff', 'supervisor', 'admin'];

/** Keep in sync with src/lib/roleFunctions.ts */
export const OPL_READ_FUNCTIONS = new Set([
  'dashboard',
  'candidates_read',
  'jobs_read',
  'unit_requests_read',
  'employees_read',
  'clients_read',
  'work_calendar_read',
  'driver_care_read',
]);

export type GrantOverride = { role: UserRole; function_id: string; enabled: boolean };

export function defaultFunctionEnabled(role: UserRole, functionId: string): boolean {
  if (role === 'opl') return OPL_READ_FUNCTIONS.has(functionId);
  const minimum = FUNCTION_DEFAULT_MIN_ROLE[functionId];
  if (!minimum) return false;
  return meetsMinimumRole(role, minimum);
}

export function grantKey(role: UserRole, functionId: string): string {
  return `${role}:${functionId}`;
}

export async function loadGrantOverrides(): Promise<Map<string, boolean>> {
  try {
    const { rows } = await dbQuery<{ role: string; function_id: string; enabled: boolean }>(
      `select role, function_id, enabled from ${grantsTable}`,
    );
    const map = new Map<string, boolean>();
    for (const row of rows) {
      if (!VALID_ROLES.includes(row.role as UserRole) || !VALID_FUNCTION_IDS.has(row.function_id)) continue;
      map.set(grantKey(row.role as UserRole, row.function_id), row.enabled);
    }
    return map;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/role_function_grants/i.test(msg) && /(does not exist|relation)/i.test(msg)) {
      return new Map();
    }
    throw e;
  }
}

export function effectiveFunctionEnabled(
  role: UserRole,
  functionId: string,
  overrides: Map<string, boolean>,
): boolean {
  const key = grantKey(role, functionId);
  if (overrides.has(key)) return overrides.get(key)!;
  return defaultFunctionEnabled(role, functionId);
}

export function buildEffectiveMatrix(overrides: Map<string, boolean>): Record<UserRole, Record<string, boolean>> {
  const matrix = {} as Record<UserRole, Record<string, boolean>>;
  for (const role of VALID_ROLES) {
    matrix[role] = {};
    for (const functionId of VALID_FUNCTION_IDS) {
      matrix[role][functionId] = effectiveFunctionEnabled(role, functionId, overrides);
    }
  }
  return matrix;
}

export async function upsertGrant(
  role: UserRole,
  functionId: string,
  enabled: boolean,
  updatedBy: string | null,
): Promise<void> {
  await dbQuery(
    `
    insert into ${grantsTable} (role, function_id, enabled, updated_by, updated_at)
    values ($1, $2, $3, $4, now())
    on conflict (role, function_id)
    do update set enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = now()
    `,
    [role, functionId, enabled, updatedBy],
  );
}

/** Prevent admin from locking everyone out of Settings */
export async function checkFunctionAccess(
  role: UserRole,
  functionId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!VALID_FUNCTION_IDS.has(functionId)) {
    return { ok: false, message: 'Unknown function' };
  }
  const overrides = await loadGrantOverrides();
  if (!effectiveFunctionEnabled(role, functionId, overrides)) {
    return { ok: false, message: 'ฟังก์ชันนี้ถูกปิดสำหรับ role ของคุณ' };
  }
  return { ok: true };
}

export function canToggleGrant(
  role: UserRole,
  functionId: string,
  enabled: boolean,
): { ok: true } | { ok: false; message: string } {
  if (enabled) {
    if (role === 'opl' && !OPL_READ_FUNCTIONS.has(functionId)) {
      return { ok: false, message: 'OPL เปิดได้เฉพาะฟังก์ชันอ่านอย่างเดียว' };
    }
    return { ok: true };
  }
  if (role === 'admin' && (functionId === 'settings_access' || functionId === 'users_manage')) {
    return { ok: false, message: 'ไม่สามารถปิดสิทธิ์ Settings / จัดการ Users ของ Admin ได้' };
  }
  return { ok: true };
}
