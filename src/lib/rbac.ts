import type { UserRole } from '@/types';

/**
 * Frontend RBAC mirror of api/_lib/rbac.ts — UX only; backend enforces access.
 * Always use authenticated user.role, never URL segments like /admin.
 */

export const ROLE_LEVEL: Record<UserRole, number> = {
  admin: 3,
  supervisor: 2,
  staff: 1,
};

export function meetsMinimumRole(userRole: UserRole, minimum: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimum];
}

/** Home route for each role (redirect target when access denied). */
export function roleHomePath(role: UserRole): string {
  return `/${role}`;
}

type RouteRule = {
  match: (pathname: string) => boolean;
  minimumRole: UserRole;
  note?: string;
};

/**
 * Route access rules — most specific paths first.
 * Assumption: all authenticated users may access staff-level modules (WL, matching read, jobs read, driver-care read).
 */
const ROUTE_RULES: RouteRule[] = [
  { match: (p) => p === '/admin', minimumRole: 'admin', note: 'admin hub' },
  { match: (p) => p === '/settings' || p.startsWith('/settings/'), minimumRole: 'admin', note: 'settings' },
  { match: (p) => p === '/supervisor', minimumRole: 'supervisor', note: 'supervisor hub' },
  { match: (p) => p === '/wl/employees/add', minimumRole: 'supervisor', note: 'create employee' },
];

export function minimumRoleForPath(pathname: string): UserRole {
  const path = pathname.split('?')[0] ?? pathname;
  for (const rule of ROUTE_RULES) {
    if (rule.match(path)) return rule.minimumRole;
  }
  return 'staff';
}

export function canAccessPath(userRole: UserRole | null | undefined, pathname: string): boolean {
  if (!userRole) return false;
  return meetsMinimumRole(userRole, minimumRoleForPath(pathname));
}

/** หน้า Settings และฟีเจอร์ที่ผูกกับ Settings เท่านั้น */
export function canAccessSettings(userRole: UserRole | null | undefined): boolean {
  return userRole === 'admin';
}

/** Filter dock / menu items by minimum role. */
export function filterByMinimumRole<T extends { minimumRole?: UserRole }>(
  items: T[],
  userRole: UserRole | null | undefined,
): T[] {
  if (!userRole) return [];
  return items.filter((item) => meetsMinimumRole(userRole, item.minimumRole ?? 'staff'));
}

/**
 * Permission matrix (documentation + UI helpers).
 * Backend api/_lib/rbac.ts is authoritative for API mutations.
 * Supervisor: operational access แบบ admin — ยกเว้นหน้า /settings และ API ที่เกี่ยวกับ settings
 */
export const PERMISSION_MATRIX = {
  dashboard: { staff: 'read own/limited', supervisor: 'read team + KPI', admin: 'read all' },
  candidates: { staff: 'create/read', supervisor: 'create/update/archive', admin: 'all' },
  jobs: { staff: 'read', supervisor: 'create/update/archive', admin: 'all' },
  employees: { staff: 'read limited', supervisor: 'create/update', admin: 'all' },
  clients: { staff: 'read', supervisor: 'create/update/delete', admin: 'all' },
  workCalendar: { staff: 'create own/team', supervisor: 'manage team', admin: 'all' },
  driverCare: { staff: 'read/action if assigned', supervisor: 'manage + recalc', admin: 'all' },
  settings: { staff: 'none', supervisor: 'none', admin: 'all' },
  auditLogs: { staff: 'none', supervisor: 'none', admin: 'all' },
} as const;
