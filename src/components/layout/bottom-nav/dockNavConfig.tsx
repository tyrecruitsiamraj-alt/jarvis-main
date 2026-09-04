import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Search, Users, Briefcase, BarChart3, PhoneForwarded, UserCheck } from 'lucide-react';
import { CONVEYOR_HOME, CONVEYOR_STEPS } from '@/lib/soRecruitNav';
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
/**
 * 🔴 **ชื่อ+ไอคอนของหน้าเดียวกันต้องตรงกันทุกเมนู** (แก้ 4 ก.ย. 2569 หลังเจ้าของ
 * ให้ไล่ตรวจไอคอนทั้งระบบ) — เดิมลิสต์นี้ตั้งชื่อ/ไอคอนของตัวเอง ทำให้หน้าเดียวกัน
 * มีสองชื่อสองไอคอน แล้วแต่ว่าดูจากเมนูไหน (วัดจริง 4 ก.ย.):
 *   `/jobs/list` → แถบซ้ายว่า **"ใบขอ"** (คลิปบอร์ด) · ลิสต์นี้ว่า **"หน่วยงาน"** (กระเป๋า)
 *   `/follow` → **"ติดตาม"** vs **"Follow"** (คนละภาษาด้วย)
 *   `/matching/candidates` → **"คลังคน"** vs **"ผู้สมัคร"**
 * ⇒ ยกป้าย/ไอคอนมาจาก `soRecruitNav` ที่เดียว · เหลือแค่ path/สิทธิ์ที่นี่
 * มีเทสต์คุมว่าห้ามแตกกันอีก
 */
const STEP = Object.fromEntries(CONVEYOR_STEPS.map((s) => [s.path, s])) as Record<
  string,
  (typeof CONVEYOR_STEPS)[number]
>;

export const DOCK_NAV_ITEMS: DockNavItem[] = [
  { path: '/', label: CONVEYOR_HOME.label, icon: CONVEYOR_HOME.icon },
  {
    path: '/jobs/list',
    label: STEP['/jobs/list'].label,
    icon: STEP['/jobs/list'].icon,
    functionId: 'unit_requests_read',
  },
  // ← กลุ่ม "บอร์ดรับสมัคร" ถูกแทรกตรงนี้โดย AppNavDrawer
  {
    path: '/follow',
    label: STEP['/follow'].label,
    icon: STEP['/follow'].icon,
    functionId: 'follow_read',
  },
  // เจ้าของเคาะ 23 ส.ค. 2569: **เมนูหลักของตัวเอง ข้าง Follow** (ไม่ใช่แท็บในหน้า Follow)
  {
    path: '/aftercare',
    label: STEP['/aftercare'].label,
    icon: STEP['/aftercare'].icon,
    functionId: 'aftercare_read',
  },
  { path: '/wl', label: 'WL', icon: CalendarDays, functionId: 'work_calendar_read' },
  {
    path: '/matching/candidates',
    label: 'คลังคน',
    icon: Users,
    functionId: 'candidates_read',
  },
  // หัวข้อ "Matching" ถูกถอดจากเมนู 17 ส.ค. 2569 (เจ้าของ: "อันนี้ก็เอาออกได้เลย") —
  // ลูกย้ายออกไปอยู่กับงานจริงหมดแล้ว เหลือหัวข้อที่กดกางแล้วไม่มีอะไรข้างใน:
  //   จับคู่กับงาน → แท็บในหน้าหน่วยงาน · การติดต่อ (คัดสรร) → แท็บในใบขอ
  //   Pre-Check → ปุ่มแถบตัวกรองในกล่องงาน · คำขอโพสต์งานใหม่ → แท็บบนบอร์ดรับสมัคร
  // route `/matching` ยังอยู่ (RoleHubPage + ลิงก์เก่ายังเปิดได้) แค่ไม่มีทางเข้าจากเมนู
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
