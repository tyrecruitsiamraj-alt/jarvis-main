import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Search, Briefcase, BarChart3, Settings, ArrowRight } from 'lucide-react';
import FeatureCard from '@/components/shared/FeatureCard';
import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import type { AppFunctionId } from '@/lib/roleFunctions';
import { type ToneKey } from '@/lib/designTokens';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';

export type HubRole = 'opl' | 'staff' | 'supervisor' | 'admin';

type HubLink = {
  path: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** โทนของเมนู — สีพื้น/ไอคอนมาจาก token กลาง (มีคู่ dark ครบ) */
  tone: ToneKey;
  functionId?: AppFunctionId;
};

/**
 * 🔴 **ชื่อ+ไอคอนยกมาจาก `soRecruitNav` ที่เดียว** (4 ก.ย. 2569) — หน้านี้เคยตั้งชื่อเอง
 * ("Follow" · "หน่วยงาน") ซึ่งไม่ตรงกับเมนูหลัก ("ติดตาม" · "ใบขอ") · กติกาเดียวกับ
 * เมนูล่างที่แก้ไปแล้ว: หน้าเดียวกันต้องชื่อเดียวไอคอนเดียวทุกที่
 */
const STEP = Object.fromEntries(CONVEYOR_STEPS.map((s) => [s.path, s])) as Record<
  string,
  (typeof CONVEYOR_STEPS)[number]
>;

const STAFF_LINKS: HubLink[] = [
  { path: '/wl', label: 'WL', desc: 'ปฏิทิน / ลงงาน / พนักงาน', icon: CalendarDays, tone: 'primary' as const, functionId: 'work_calendar_read' },
  {
    path: '/follow',
    label: STEP['/follow'].label,
    desc: 'ลงรายชื่อคนที่ต้องติดตาม — AI โทรให้',
    icon: STEP['/follow'].icon,
    tone: 'danger' as const,
    functionId: 'follow_read',
  },
  {
    path: '/jobs/list',
    label: STEP['/jobs/list'].label,
    desc: 'หน่วยงานขอคนมา — ดูว่าค้างมานานเท่าไหร่',
    icon: STEP['/jobs/list'].icon,
    tone: 'warn' as const,
    functionId: 'unit_requests_read',
  },
  { path: '/dashboard', label: 'Dashboard', desc: 'ภาพรวมและ KPI', icon: BarChart3, tone: 'neutral' as const, functionId: 'dashboard' },
];

const SUPERVISOR_EXTRA: HubLink[] = [
  { path: '/matching', label: 'Matching', desc: 'จับคู่ผู้สมัครกับงาน', icon: Search, tone: 'info' as const, functionId: 'candidates_read' },
  { path: '/jobs/overview', label: 'แดชบอร์ดหน่วยงาน', desc: 'สรุปใบขอและหน่วยงาน', icon: Briefcase, tone: 'warn' as const, functionId: 'unit_requests_read' },
];

const ADMIN_EXTRA: HubLink[] = [
  { path: '/settings', label: 'Settings', desc: 'ตั้งค่าระบบ / สิทธิ์ฟังก์ชัน', icon: Settings, tone: 'neutral' as const, functionId: 'settings_access' },
];

function linksForRole(role: HubRole): HubLink[] {
  if (role === 'opl' || role === 'staff') return STAFF_LINKS;
  if (role === 'supervisor') return [...STAFF_LINKS, ...SUPERVISOR_EXTRA];
  return [...STAFF_LINKS, ...SUPERVISOR_EXTRA, ...ADMIN_EXTRA];
}

const titles: Record<HubRole, { title: string; subtitle: string }> = {
  opl: { title: 'OPL', subtitle: 'เมนูสำหรับผู้ใช้งานอ่านอย่างเดียว' },
  staff: { title: 'Staff', subtitle: 'เมนูสำหรับพนักงาน / สตาฟ' },
  supervisor: { title: 'Supervisor', subtitle: 'เมนูสำหรับหัวหน้างาน' },
  admin: { title: 'Admin', subtitle: 'เมนูสำหรับผู้ดูแลระบบ' },
};

const RoleHubPage: React.FC<{ role: HubRole }> = ({ role }) => {
  const navigate = useNavigate();
  const { isFunctionEnabled } = useRolePermissions();
  const { title, subtitle } = titles[role];
  const links = linksForRole(role).filter((item) => !item.functionId || isFunctionEnabled(item.functionId, role));

  return (
    <div className="relative">
      <PageHeader title={title} subtitle={subtitle} backPath="/" />
      <div className="px-4 md:px-6 py-4">
        {/* 🔴 **ภาษาการ์ดกลาง** (`FeatureCard` ประกอบจาก Card ของ shadcn) —
            เจ้าของเลือก 4 ก.ย. 2569 ว่าเอาเฉพาะภาษาการ์ดจากสเปก Premium Features
            ⇒ กล่องไอคอนสีประจำเรื่อง + ไหลเข้าทีละใบ + ไอคอนโตตอนชี้
            เลิกใช้คลาส `jarvis-menu-card` ที่ปั้นเอง และเลิกใช้ framer-motion
            (แอนิเมชันมาจาก utility ของ tailwindcss-animate ไม่ต้องมี lib เพิ่ม) */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 md:gap-4">
          {links.map((item, i) => (
            <FeatureCard
              key={item.path}
              icon={item.icon}
              title={item.label}
              description={item.desc}
              tone={item.tone}
              index={i}
              onClick={() =>
                navigate(item.path === '/jobs/list' ? resolveUnitNavPath() : item.path)
              }
              action={<ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleHubPage;
