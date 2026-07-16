import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import type { UserRole } from './auth.js';

const usersTable = tableInAppSchema('users');

/** แผนกที่ล็อกสิทธิ์ใบขอหน่วยงาน (ต้อง sync กับ src/lib/departmentCodes.ts) */
export const APP_DEPARTMENT_CODES = ['SN', 'DS', 'LM', 'LBA', 'LBD'] as const;
export type AppDepartmentCode = (typeof APP_DEPARTMENT_CODES)[number];

export type DepartmentScope =
  | { mode: 'all' }
  | { mode: 'code'; code: string }
  | { mode: 'none' };

export function normalizeDepartmentCode(code?: string | null): string | null {
  const c = (code || '').trim().toUpperCase();
  return c || null;
}

export function isAllowedDepartmentCode(code?: string | null): code is AppDepartmentCode {
  const c = normalizeDepartmentCode(code);
  return Boolean(c && (APP_DEPARTMENT_CODES as readonly string[]).includes(c));
}

/**
 * admin เห็นทุกแผนก
 * ผู้ใช้ที่มี department_code ที่อนุญาต → ล็อกแผนกนั้น
 * ไม่มีรหัส → ไม่เห็นใบขอ (ต้องเลือกแผนกก่อน / ให้ admin ตั้ง)
 */
export function departmentScopeFromUser(input: {
  role: UserRole;
  department_code?: string | null;
}): DepartmentScope {
  if (input.role === 'admin') return { mode: 'all' };
  const code = normalizeDepartmentCode(input.department_code);
  if (!code || !isAllowedDepartmentCode(code)) return { mode: 'none' };
  return { mode: 'code', code };
}

export async function loadUserDepartmentScope(user: {
  sub: string;
  role: UserRole;
}): Promise<DepartmentScope> {
  if (user.role === 'admin') return { mode: 'all' };
  try {
    const { rows } = await dbQuery<{ department_code: string | null }>(
      `select department_code from ${usersTable} where id = $1 limit 1`,
      [user.sub],
    );
    return departmentScopeFromUser({
      role: user.role,
      department_code: rows[0]?.department_code ?? null,
    });
  } catch {
    return { mode: 'none' };
  }
}

export function jobAllowedByDepartmentScope(
  job: { department_code?: string | null },
  scope: DepartmentScope,
): boolean {
  if (scope.mode === 'all') return true;
  if (scope.mode === 'none') return false;
  const code = normalizeDepartmentCode(job.department_code);
  return code === scope.code;
}

/** SQL AND clause + params for site department filter */
export function sqlServerDepartmentScopeClause(
  scope: DepartmentScope,
  alias = 'SS',
): { sql: string; params: Record<string, string> } {
  if (scope.mode === 'all') return { sql: '', params: {} };
  if (scope.mode === 'none') return { sql: 'AND 1 = 0', params: {} };
  return {
    sql: `AND RTRIM(${alias}.department_code) = @scopeDept`,
    params: { scopeDept: scope.code },
  };
}
