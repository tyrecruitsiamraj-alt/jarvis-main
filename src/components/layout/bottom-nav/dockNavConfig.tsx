import type { LucideIcon } from 'lucide-react';
import { Home, CalendarDays, Search, Users, Briefcase, BarChart3, Settings, HeartPulse } from 'lucide-react';
import type { UserRole } from '@/types';

export type DockNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role to show in navigation (default: staff). */
  minimumRole?: UserRole;
};

/** 8 เมนูหลัก — ลำดับต้องตรงกับ UI bottom dock */
export const DOCK_NAV_ITEMS: DockNavItem[] = [
  { path: '/', label: 'หน้าหลัก', icon: Home },
  { path: '/wl', label: 'WL', icon: CalendarDays },
  { path: '/matching', label: 'Matching', icon: Search },
  { path: '/driver-care', label: 'Driver Care', icon: HeartPulse },
  { path: '/matching/candidates', label: 'ผู้สมัคร', icon: Users },
  { path: '/jobs', label: 'หน่วยงาน', icon: Briefcase },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3, minimumRole: 'supervisor' },
  { path: '/settings', label: 'ตั้งค่า', icon: Settings, minimumRole: 'admin' },
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
  return p.startsWith(path);
}

export function dockActiveIndex(pathname: string, items: DockNavItem[] = DOCK_NAV_ITEMS): number {
  const idx = items.findIndex((item) => isDockPathActive(item.path, pathname));
  return idx >= 0 ? idx : 0;
}
