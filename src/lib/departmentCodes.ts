/** แผนกที่ล็อกสิทธิ์ใบขอหน่วยงาน (ต้อง sync กับ api/_lib/departmentScope.ts) */
export const APP_DEPARTMENT_CODES = [
  'LBD',
  'LBA',
  'LBF',
  'LBH',
  'LBM',
  'LBP',
  'LCA',
  'LCB',
  'LCC',
  'LCD',
  'LCE',
  'LCG',
  'LCP',
  'LDD',
  'LDH',
  'LAH',
] as const;

export type AppDepartmentCode = (typeof APP_DEPARTMENT_CODES)[number];

/** ชื่อสั้นสำหรับ dropdown สมัคร / settings */
export const APP_DEPARTMENT_LABELS: Record<AppDepartmentCode, string> = {
  LBD: 'LBD — Labor Driver',
  LBA: 'LBA — Labor Contact A',
  LBF: 'LBF — Labor Forklift',
  LBH: 'LBH — Head Hunter',
  LBM: 'LBM — LB Marketing',
  LBP: 'LBP — LB Payment',
  LCA: 'LCA — Labor Private',
  LCB: 'LCB — Labor Gov',
  LCC: 'LCC — Labor PEA',
  LCD: 'LCD — Labor Driver (1)',
  LCE: 'LCE — Labor Driver (2)',
  LCG: 'LCG',
  LCP: 'LCP',
  LDD: 'LDD',
  LDH: 'LDH',
  LAH: 'LAH — Head Hunter (LCA)',
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
