/** แผนกที่ล็อกสิทธิ์ใบขอหน่วยงาน (ต้อง sync กับ api/_lib/departmentScope.ts) */
export const APP_DEPARTMENT_CODES = ['SN', 'DS', 'LM', 'LBA', 'LBD'] as const;

export type AppDepartmentCode = (typeof APP_DEPARTMENT_CODES)[number];

/** ชื่อแสดงใน dropdown — ตัวพิมพ์ใหญ่ตามรหัสแผนก */
export const APP_DEPARTMENT_LABELS: Record<AppDepartmentCode, string> = {
  SN: 'SN',
  DS: 'DS',
  LM: 'LM',
  LBA: 'LBA',
  LBD: 'LBD',
};

export function isAppDepartmentCode(value: unknown): value is AppDepartmentCode {
  return (
    typeof value === 'string' &&
    (APP_DEPARTMENT_CODES as readonly string[]).includes(value.trim().toUpperCase())
  );
}

export function normalizeAppDepartmentCode(value?: string | null): AppDepartmentCode | null {
  const c = (value || '').trim().toUpperCase();
  return isAppDepartmentCode(c) ? c : null;
}
