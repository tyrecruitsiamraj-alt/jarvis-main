import type { UserRole } from './auth.js';

/** Role hierarchy — backend source of truth (admin > supervisor > staff > opl). */
export const ROLE_LEVEL: Record<UserRole, number> = {
  admin: 4,
  supervisor: 3,
  staff: 2,
  opl: 1,
};

export function isReadOnlyRole(role: UserRole): boolean {
  return role === 'opl';
}

export function meetsMinimumRole(userRole: UserRole, minimum: UserRole): boolean {
  if (userRole === 'opl') {
    // OPL = read-only viewer: only pass routes/APIs whose minimum is staff or opl
    return minimum === 'staff' || minimum === 'opl';
  }
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimum];
}

export type ApiResource =
  | 'candidates'
  | 'jobs'
  | 'employees'
  | 'clients'
  | 'work-calendar'
  | 'job-assignments'
  | 'candidate-interviews'
  | 'candidate-work-history'
  | 'training-records'
  | 'follow'
  | 'job-staff'
  | 'app-users'
  | 'audit-logs'
  | 'branding'
  | 'siamraj-unit-requests'
  | 'siamraj-unit-assignments'
  | 'siamraj-unit-notes'
  | 'siamraj-unit-work-status'
  | 'siamraj-opl-import'
  | 'recruit-registrations'
  | 'matching-suggestions'
  | 'matching-parse-branch-demand'
  | 'matching-candidate-spec'
  | 'matching-irecruit-candidates'
  | 'matching-board-candidates'
  | 'matching-proposals'
  | 'matching-job-postings'
  | 'matching-flow-summary'
  | 'lumos-dispatch'
  | 'job-applications'
  | 'work-status-master';

/**
 * Minimum role per API resource and HTTP method.
 * Fine-grained hints refine write permissions per resource.
 */
export function minimumRoleFor(
  resource: ApiResource,
  method: string,
  hint?: string,
): UserRole {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD';

  switch (resource) {
    case 'candidates':
      // staff: create/read; supervisor+: update/archive
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'jobs':
      // staff: read only; supervisor+: create/update/archive
      if (isRead) return 'staff';
      return 'supervisor';

    case 'employees':
      // staff: read; supervisor+: create/update
      if (isRead) return 'staff';
      return 'supervisor';

    case 'clients':
      // staff: read; supervisor+: create/update/delete; settings ไม่เกี่ยว
      if (isRead) return 'staff';
      return 'supervisor';

    case 'work-calendar':
      // staff: read + create entries; supervisor+: manage team calendar
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'job-assignments':
    case 'training-records':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'candidate-interviews':
    case 'candidate-work-history':
      if (isRead || m === 'POST') return 'staff';
      return 'supervisor';

    case 'follow':
      // staff: ดู + เพิ่ม/ยกเลิกรายชื่อที่ต้องติดตามเอง
      return 'staff';

    case 'job-staff':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'app-users':
    case 'audit-logs':
    case 'branding':
      return 'admin';

    case 'work-status-master':
      // อ่านได้ทุกคน (dropdown สถานะทำงานทั้งระบบใช้) — เพิ่ม/แก้/ลบเฉพาะ admin
      if (isRead) return 'staff';
      return 'admin';

    case 'siamraj-unit-requests':
      return 'staff';

    case 'siamraj-unit-assignments':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'siamraj-unit-notes':
      return 'staff';

    case 'siamraj-unit-work-status':
      return 'staff';

    case 'siamraj-opl-import':
      return 'admin';

    case 'recruit-registrations':
    case 'matching-suggestions':
    case 'matching-parse-branch-demand':
    case 'matching-candidate-spec':
    case 'matching-irecruit-candidates':
    case 'matching-board-candidates':
    case 'matching-proposals':
    case 'matching-job-postings':
    case 'matching-flow-summary':
      return 'staff';

    case 'lumos-dispatch':
      // staff: ดูผลการโทร + ติ๊กเลือกส่งให้ Lumos โทรเอง (โมเดลเดียวกับ follow)
      // opl ถูกกันที่ checkApiAccess อยู่แล้ว (read-only role ห้าม POST/DELETE)
      return 'staff';

    case 'job-applications':
      // recruiter pipeline: staff read applicants and update their status/note
      return 'staff';

    default:
      return 'admin';
  }
}

export function checkApiAccess(
  userRole: UserRole,
  resource: ApiResource,
  method: string,
  hint?: string,
): { ok: true } | { ok: false; message: string } {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD';

  if (isReadOnlyRole(userRole) && !isRead) {
    return { ok: false, message: 'Read-only role (opl)' };
  }

  const minimum = minimumRoleFor(resource, method, hint);
  if (!meetsMinimumRole(userRole, minimum)) {
    return {
      ok: false,
      message: `Requires ${minimum} role or higher`,
    };
  }
  return { ok: true };
}
