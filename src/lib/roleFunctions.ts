import type { UserRole } from '@/types';
import { meetsMinimumRole } from '@/lib/rbac';

export type AppFunctionId =
  | 'dashboard'
  | 'candidates_read'
  | 'candidates_create'
  | 'candidates_edit'
  | 'jobs_read'
  | 'jobs_edit'
  | 'jobs_assign_staff'
  | 'unit_requests_read'
  | 'unit_notes_edit'
  | 'employees_read'
  | 'employees_edit'
  | 'clients_read'
  | 'clients_edit'
  | 'work_calendar_read'
  | 'work_calendar_manage'
  | 'driver_care_read'
  | 'driver_care_log'
  | 'driver_care_manage'
  | 'settings_access'
  | 'users_manage'
  | 'audit_logs';

export type AppFunctionDef = {
  id: AppFunctionId;
  label: string;
  group: string;
  minimumRole: UserRole;
};

export type RoleFunctionMatrix = Record<UserRole, Record<AppFunctionId, boolean>>;

/** ฟังก์ชันในระบบ — สิทธิ์ขั้นต่ำตาม api/_lib/rbac.ts */
export const APP_FUNCTIONS: AppFunctionDef[] = [
  { id: 'dashboard', label: 'Dashboard / หน้าหลัก', group: 'ทั่วไป', minimumRole: 'staff' },
  { id: 'candidates_read', label: 'ดูผู้สมัคร', group: 'ผู้สมัคร', minimumRole: 'staff' },
  { id: 'candidates_create', label: 'เพิ่มผู้สมัคร', group: 'ผู้สมัคร', minimumRole: 'staff' },
  { id: 'candidates_edit', label: 'แก้ไข / ปิดผู้สมัคร', group: 'ผู้สมัคร', minimumRole: 'supervisor' },
  { id: 'jobs_read', label: 'ดูงาน / ใบขอ', group: 'งาน & หน่วยงาน', minimumRole: 'staff' },
  { id: 'jobs_edit', label: 'แก้ไขงาน', group: 'งาน & หน่วยงาน', minimumRole: 'supervisor' },
  { id: 'jobs_assign_staff', label: 'กำหนดสรรหา / คัดสรร', group: 'งาน & หน่วยงาน', minimumRole: 'supervisor' },
  { id: 'unit_requests_read', label: 'ดูใบขอหน่วยงาน Siamraj', group: 'งาน & หน่วยงาน', minimumRole: 'staff' },
  { id: 'unit_notes_edit', label: 'แก้ไขหมายเหตุใบขอ', group: 'งาน & หน่วยงาน', minimumRole: 'staff' },
  { id: 'employees_read', label: 'ดูพนักงาน WL', group: 'WL', minimumRole: 'staff' },
  { id: 'employees_edit', label: 'เพิ่ม / แก้ไขพนักงาน WL', group: 'WL', minimumRole: 'supervisor' },
  { id: 'clients_read', label: 'ดูลูกค้า / สถานที่', group: 'ลูกค้า', minimumRole: 'staff' },
  { id: 'clients_edit', label: 'จัดการลูกค้า', group: 'ลูกค้า', minimumRole: 'supervisor' },
  { id: 'work_calendar_read', label: 'ดูปฏิทินงาน', group: 'ปฏิทิน', minimumRole: 'staff' },
  { id: 'work_calendar_manage', label: 'จัดการปฏิทินทีม', group: 'ปฏิทิน', minimumRole: 'supervisor' },
  { id: 'driver_care_read', label: 'ดู Driver Care', group: 'Driver Care', minimumRole: 'staff' },
  { id: 'driver_care_log', label: 'บันทึกการดูแล / action', group: 'Driver Care', minimumRole: 'staff' },
  { id: 'driver_care_manage', label: 'จัดการทรัพยากร Driver Care', group: 'Driver Care', minimumRole: 'supervisor' },
  { id: 'settings_access', label: 'เข้า Settings', group: 'ผู้ดูแลระบบ', minimumRole: 'admin' },
  { id: 'users_manage', label: 'จัดการ Users / Role', group: 'ผู้ดูแลระบบ', minimumRole: 'admin' },
  { id: 'audit_logs', label: 'ดู Audit Log', group: 'ผู้ดูแลระบบ', minimumRole: 'admin' },
];

export const OPL_READ_FUNCTIONS: ReadonlySet<AppFunctionId> = new Set([
  'dashboard',
  'candidates_read',
  'jobs_read',
  'unit_requests_read',
  'employees_read',
  'clients_read',
  'work_calendar_read',
  'driver_care_read',
]);

export const ROLE_ORDER: UserRole[] = ['opl', 'staff', 'supervisor', 'admin'];

export const ROLE_LABELS: Record<UserRole, string> = {
  opl: 'OPL (อ่านอย่างเดียว)',
  staff: 'Staff',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

function defaultEnabledForRole(role: UserRole, fn: AppFunctionDef): boolean {
  if (role === 'opl') return OPL_READ_FUNCTIONS.has(fn.id);
  return meetsMinimumRole(role, fn.minimumRole);
}

export function roleHasFunction(role: UserRole, fn: AppFunctionDef, matrix?: RoleFunctionMatrix | null): boolean {
  if (matrix?.[role]?.[fn.id] !== undefined) return matrix[role][fn.id];
  return defaultEnabledForRole(role, fn);
}

export function isFunctionEnabledForRole(
  role: UserRole,
  functionId: AppFunctionId,
  matrix?: RoleFunctionMatrix | null,
): boolean {
  if (matrix?.[role]?.[functionId] !== undefined) return matrix[role][functionId];
  const fn = APP_FUNCTIONS.find((f) => f.id === functionId);
  if (!fn) return false;
  return defaultEnabledForRole(role, fn);
}

/** ใช้กับ route guard / bottom nav */
export function primaryFunctionForPath(pathname: string): AppFunctionId | null {
  const path = pathname.split('?')[0] ?? pathname;
  if (path === '/settings' || path.startsWith('/settings/')) return 'settings_access';
  if (path === '/admin') return 'users_manage';
  if (path === '/dashboard') return 'dashboard';
  if (path.startsWith('/matching')) return 'candidates_read';
  if (path.startsWith('/jobs')) return 'unit_requests_read';
  if (path.startsWith('/wl')) return 'work_calendar_read';
  if (path.startsWith('/driver-care')) return 'driver_care_read';
  return null;
}

export function buildDefaultMatrix(): RoleFunctionMatrix {
  const matrix = {} as RoleFunctionMatrix;
  for (const role of ROLE_ORDER) {
    matrix[role] = {} as Record<AppFunctionId, boolean>;
    for (const fn of APP_FUNCTIONS) {
      matrix[role][fn.id] = defaultEnabledForRole(role, fn);
    }
  }
  return matrix;
}

export function functionGroups(): string[] {
  return [...new Set(APP_FUNCTIONS.map((f) => f.group))];
}
