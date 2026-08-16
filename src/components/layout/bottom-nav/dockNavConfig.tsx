import type { LucideIcon } from 'lucide-react';
import { Home, CalendarDays, Search, Users, Briefcase, BarChart3, PhoneForwarded, } from 'lucide-react';
import type { UserRole } from '@/types';
import type { AppFunctionId } from '@/lib/roleFunctions';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';

export type DockNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role to show in navigation (default: staff). */
  minimumRole?: UserRole;
  functionId?: AppFunctionId;
};

/**
 * เมนูหลัก — ลำดับต้องตรงกับ UI bottom dock
 *
 * ลำดับตามที่เจ้าของสั่ง 16 ส.ค. 2569 เย็น: *"หน้าหลัก หน่วยงาน บอร์ดรับสมัคร Follow
 * แล้วก็ตามด้วยที่เหลือ"* — กลุ่ม "บอร์ดรับสมัคร" ไม่ได้อยู่ในลิสต์นี้ แต่ถูกแทรก
 * ต่อจาก "หน่วยงาน" ที่ `AppNavDrawer` (ดูตรงนั้น) จึงได้ลำดับตามสั่งพอดี
 *
 * ⚠️ นี่คือ **ลำดับตั้งต้น** — แอดมินย้าย/เปลี่ยนชื่อ/ซ่อนทับได้ที่หน้าตั้งค่า
 * (`applyNavPreferences` ใน src/lib/navPreferences.ts) · แก้ตรงนี้ = เปลี่ยนค่าตั้งต้น
 * ของคนที่ยังไม่เคยตั้งเอง ไม่ทับค่าที่แอดมินตั้งไว้แล้ว
 */
export const DOCK_NAV_ITEMS: DockNavItem[] = [
  { path: '/', label: 'หน้าหลัก', icon: Home },
  { path: '/jobs/list', label: 'หน่วยงาน', icon: Briefcase, functionId: 'unit_requests_read' },
  // ← กลุ่ม "บอร์ดรับสมัคร" ถูกแทรกตรงนี้โดย AppNavDrawer
  { path: '/follow', label: 'Follow', icon: PhoneForwarded, functionId: 'follow_read' },
  { path: '/wl', label: 'WL', icon: CalendarDays, functionId: 'work_calendar_read' },
  { path: '/matching/candidates', label: 'ผู้สมัคร', icon: Users, functionId: 'candidates_read' },
  // "จับคู่กับงาน" ถูกถอดจากเมนู 16 ส.ค. 2569 — ไปเป็นแท็บในหน้าหน่วยงานแล้ว
  // (เจ้าของ: "คำว่าจับคู่กับงานก็หายไปด้วย ไม่งั้นงงตาย") · หัวข้อนี้เหลือไว้เพราะ
  // ยังมีลูกอื่น (คำขอโพสหางานใหม่) และ RoleHubPage ยังชี้มาที่ /matching
  { path: '/matching', label: 'Matching', icon: Search, functionId: 'candidates_read' },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3, functionId: 'dashboard' },
];

/** path ที่ควร navigate เมื่อกดเมนู (หน่วยงาน เก็บ filter+หน้าไว้ใน session) */
export function resolveDockNavTarget(path: string): string {
  if (path === '/jobs/list') return resolveUnitNavPath();
  return path;
}

export function isDockPathActive(path: string, pathname: string): boolean {
  const p = pathname;
  if (path === '/') return p === '/';
  if (path === '/matching/candidates') return p.startsWith('/matching/candidates');
  if (path === '/matching') {
    if (p.startsWith('/matching/candidates')) return false;
    return p.startsWith('/matching');
  }
  if (path === '/follow') return p.startsWith('/follow');
  if (path === '/jobs/list') {
    if (p === '/jobs/board' || p.startsWith('/jobs/board/')) return false;
    return p.startsWith('/jobs');
  }
  return p.startsWith(path);
}

export function dockActiveIndex(pathname: string, items: DockNavItem[] = DOCK_NAV_ITEMS): number {
  const idx = items.findIndex((item) => isDockPathActive(item.path, pathname));
  return idx >= 0 ? idx : 0;
}
