/** แผนกที่ล็อกสิทธิ์ใบขอหน่วยงาน (ต้อง sync กับ api/_lib/departmentScope.ts) */
export const APP_DEPARTMENT_CODES = ['LBD', 'LBA'] as const;
export type AppDepartmentCode = (typeof APP_DEPARTMENT_CODES)[number];

export function isAppDepartmentCode(value: unknown): value is AppDepartmentCode {
  return typeof value === 'string' && (APP_DEPARTMENT_CODES as readonly string[]).includes(value.trim().toUpperCase());
}

export function normalizeAppDepartmentCode(value?: string | null): AppDepartmentCode | null {
  const c = (value || '').trim().toUpperCase();
  return isAppDepartmentCode(c) ? c : null;
}
