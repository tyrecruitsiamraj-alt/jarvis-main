import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Search, Briefcase, BarChart3, Settings, ArrowRight } from 'lucide-react';
import { CONVEYOR_STEPS } from '@/lib/soRecruitNav';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import type { AppFunctionId } from '@/lib/roleFunctions';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
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
 * ("Follow" · "หน่วยงาน") ไม่ตรงกับเมนูหลัก ("ติดตาม" · "ใบขอ") · กติกาเดียวกับเมนูล่าง:
 * หน้าเดียวกันต้องชื่อเดียวไอคอนเดียวทุกที่ (มีเทสต์คุม)
 * ⚠️ หน้าตาการ์ดคืนเป็นแบบเดิมตามที่เจ้าของสั่ง 4 ก.ย. 2569 (*"ย้อนคืน ๆ ไม่สวย"*)
 */
const STEP = Object.fromEntries(CONVEYOR_STEPS.map((s) => [s.path, s])) as Record<
  string,
  (typeof CONVEYOR_STEPS)[number]
>;

const STAFF_LINKS: HubLink[] = [
  { path: '/wl', label: 'WL', desc: 'ปฏิทิน / ลงงาน / พนักงาน', icon: CalendarDays, tone: 'primary' as const, functionId: 'work_calendar_read' },
  { path: '/follow', label: STEP['/follow'].label, desc: 'ลงรายชื่อคนที่ต้องติดตาม — AI โทรให้', icon: STEP['/follow'].icon, tone: 'danger' as const, functionId: 'follow_read' },
  { path: '/jobs/list', label: STEP['/jobs/list'].label, desc: 'ดูรายการใบขอ', icon: STEP['/jobs/list'].icon, tone: 'warn' as const, functionId: 'unit_requests_read' },
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
          {links.map((item, i) => (
            <motion.button
              key={item.path}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() =>
                navigate(item.path === '/jobs/list' ? resolveUnitNavPath() : item.path)
              }
              className="jarvis-menu-card rounded-3xl p-4 md:p-6 group touch-manipulation"
            >
              <div
                className={cn(
                  'w-11 h-11 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105',
                  TONE[item.tone].tile,
                  TONE[item.tone].value,
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-foreground text-sm md:text-base">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{item.desc}</div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                เปิด
                <ArrowRight className="h-3 w-3" aria-hidden />
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleHubPage;
