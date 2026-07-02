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
  { id: 'unit_notes_edit', label: 'แก้ไขหมายเหตุใบขอ', group: 'งาน & หน่วยงาน', minimumRole: 'supervisor' },
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

export const ROLE_ORDER: UserRole[] = ['staff', 'supervisor', 'admin'];

export const ROLE_LABELS: Record<UserRole, string> = {
  staff: 'Staff',
  supervisor: 'Supervisor',
  admin: 'Admin',
};

export function roleHasFunction(role: UserRole, fn: AppFunctionDef): boolean {
  return meetsMinimumRole(role, fn.minimumRole);
}

export function functionGroups(): string[] {
  return [...new Set(APP_FUNCTIONS.map((f) => f.group))];
}
