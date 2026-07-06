import type { LucideIcon } from 'lucide-react';
import { Home, CalendarDays, Search, Users, Briefcase, BarChart3, Settings, HeartPulse } from 'lucide-react';
import type { UserRole } from '@/types';
import type { AppFunctionId } from '@/lib/roleFunctions';

export type DockNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role to show in navigation (default: staff). */
  minimumRole?: UserRole;
  functionId?: AppFunctionId;
};

/** 8 เมนูหลัก — ลำดับต้องตรงกับ UI bottom dock */
export const DOCK_NAV_ITEMS: DockNavItem[] = [
  { path: '/', label: 'หน้าหลัก', icon: Home },
  { path: '/wl', label: 'WL', icon: CalendarDays, functionId: 'work_calendar_read' },
  { path: '/matching', label: 'Matching', icon: Search, functionId: 'candidates_read' },
  { path: '/driver-care', label: 'Driver Care', icon: HeartPulse, functionId: 'driver_care_read' },
  { path: '/matching/candidates', label: 'ผู้สมัคร', icon: Users, functionId: 'candidates_read' },
  { path: '/jobs/list', label: 'หน่วยงาน', icon: Briefcase, functionId: 'unit_requests_read' },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3, functionId: 'dashboard' },
  { path: '/settings', label: 'ตั้งค่า', icon: Settings, minimumRole: 'admin', functionId: 'settings_access' },
];

export function isDockPathActive(path: string, pathname: string): boolean {
  const p = pathname;
  if (path === '/') return p === '/';
  if (path === '/matching/candidates') return p.startsWith('/matching/candidates');
  if (path === '/matching') {
    if (p.startsWith('/matching/candidates')) return false;
    return p.startsWith('/matching');
  }
  if (path === '/driver-care') return p.startsWith('/driver-care');
  if (path === '/jobs/list') return p.startsWith('/jobs');
  return p.startsWith(path);
}

export function dockActiveIndex(pathname: string, items: DockNavItem[] = DOCK_NAV_ITEMS): number {
  const idx = items.findIndex((item) => isDockPathActive(item.path, pathname));
  return idx >= 0 ? idx : 0;
}
