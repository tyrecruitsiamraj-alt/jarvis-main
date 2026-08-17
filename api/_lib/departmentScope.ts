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

/**
 * BU scope for the job-staff roster. Unlike loadUserDepartmentScope, this locks
 * to the user's OWN department even for admins — the roster page mirrors the
 * department chosen at Login. Admins without a department fall back to 'all'.
 */
export async function loadRosterBuScope(user: {
  sub: string;
  role: UserRole;
}): Promise<DepartmentScope> {
  let code: string | null = null;
  try {
    const { rows } = await dbQuery<{ department_code: string | null }>(
      `select department_code from ${usersTable} where id = $1 limit 1`,
      [user.sub],
    );
    const c = normalizeDepartmentCode(rows[0]?.department_code ?? null);
    if (c && isAllowedDepartmentCode(c)) code = c;
  } catch {
    /* fall through to role-based default */
  }
  if (code) return { mode: 'code', code };
  if (user.role === 'admin') return { mode: 'all' };
  return { mode: 'none' };
}

/**
 * ขอบเขต BU ของ **หน้า Matching ทั้งหมด** (เจ้าของสั่ง 10 ส.ค. 2569:
 * "หน้า matching ทุกคนจะเห็นแต่งานตัวเอง")
 *
 * ต่างจาก `loadUserDepartmentScope` ตรงที่ **ล็อก BU ของตัวเองแม้เป็น admin**
 * (ตัวเดิม admin เห็นทุก BU) — ใช้ตรรกะเดียวกับหน้าโรสเตอร์ที่ล็อกอยู่แล้ว
 *
 * ⚠️ ต้องใช้ให้ครบทุก endpoint ของเส้น matching ไม่ใช่แค่ตัวลิสต์ — ไม่งั้น admin
 * ยังเปิดใบขอนอก BU ได้ด้วยการยิง `?jobId=` ตรง ๆ (ลิสต์กรองแล้วแต่หน้ารายละเอียดไม่กรอง)
 * ตอนนี้ใช้ที่: matching-list · matching-board-candidates · matching-irecruit-candidates ·
 * matching-candidate-spec · matching-parse-branch-demand-job · matching-flow-summary
 *
 * ⚠️ admin ที่ยังไม่ถูกกำหนด department ตกไปที่ 'all' (พฤติกรรมเดียวกับโรสเตอร์)
 * — ถ้าอยากให้เข้มกว่านี้ต้องบังคับตั้ง department ให้ admin ทุกคนก่อน
 */
export async function loadMatchingBuScope(user: {
  sub: string;
  role: UserRole;
}): Promise<DepartmentScope> {
  return loadRosterBuScope(user);
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
