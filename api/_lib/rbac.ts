import type { UserRole } from './auth.js';

/** Role hierarchy — backend source of truth (admin > supervisor > staff). */
export const ROLE_LEVEL: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  staff: 1,
};

export function meetsMinimumRole(userRole: UserRole, minimum: UserRole): boolean {
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
  | 'driver-care'
  | 'driver-care-recalculate'
  | 'job-staff'
  | 'app-users'
  | 'audit-logs'
  | 'branding'
  | 'siamraj-unit-requests'
  | 'siamraj-unit-assignments'
  | 'siamraj-unit-notes'
  | 'diagnostics-outbound-ip';

/**
 * Minimum role per API resource and HTTP method.
 * Fine-grained hints (e.g. driver-care `action`) refine write permissions.
 */
export function minimumRoleFor(
  resource: ApiResource,
  method: string,
  hint?: string,
): UserRole {
  const m = method.toUpperCase();
  const isRead = m === 'GET' || m === 'HEAD';
  const action = hint?.trim().toLowerCase();

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

    case 'driver-care':
      // staff: read + log/update assigned actions; supervisor+: manage resources & recalc
      if (isRead) return 'staff';
      if (action === 'log' || action === 'update-action') return 'staff';
      return 'supervisor';

    case 'driver-care-recalculate':
      return 'supervisor';

    case 'job-staff':
      if (isRead) return 'staff';
      return 'admin';

    case 'app-users':
    case 'audit-logs':
    case 'branding':
    case 'diagnostics-outbound-ip':
      return 'admin';

    case 'siamraj-unit-requests':
      return 'staff';

    case 'siamraj-unit-assignments':
      if (isRead) return 'staff';
      return 'supervisor';

    case 'siamraj-unit-notes':
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
  const minimum = minimumRoleFor(resource, method, hint);
  if (!meetsMinimumRole(userRole, minimum)) {
    return {
      ok: false,
      message: `Requires ${minimum} role or higher`,
    };
  }
  return { ok: true };
}
