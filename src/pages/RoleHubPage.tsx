import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Search, Briefcase, Users, BarChart3, Settings, HeartPulse, ArrowRight } from 'lucide-react';

export type HubRole = 'staff' | 'supervisor' | 'admin';

type HubLink = {
  path: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  accent: string;
};

const STAFF_LINKS: HubLink[] = [
  { path: '/wl', label: 'WL', desc: 'ปฏิทิน / ลงงาน / พนักงาน', icon: CalendarDays, accent: 'text-blue-600 bg-blue-500/12' },
  { path: '/driver-care', label: 'Driver Care', desc: 'เตือนความเสี่ยงคนขับลาออก', icon: HeartPulse, accent: 'text-rose-700 bg-rose-500/12' },
  { path: '/jobs/list', label: 'หน่วยงาน', desc: 'ดูรายการใบขอ', icon: Briefcase, accent: 'text-amber-700 bg-amber-500/12' },
];

const SUPERVISOR_EXTRA: HubLink[] = [
  { path: '/matching', label: 'Matching', desc: 'จับคู่ผู้สมัครกับงาน', icon: Search, accent: 'text-blue-700 bg-blue-400/12' },
  { path: '/jobs', label: 'แดชบอร์ดหน่วยงาน', desc: 'สรุปและสร้างงาน', icon: Briefcase, accent: 'text-amber-700 bg-amber-500/12' },
  { path: '/dashboard', label: 'Dashboard', desc: 'ภาพรวมและ KPI', icon: BarChart3, accent: 'text-neutral-800 bg-neutral-500/10' },
];

const ADMIN_EXTRA: HubLink[] = [
  { path: '/settings', label: 'Settings', desc: 'ตั้งค่าระบบ / ธีม', icon: Settings, accent: 'text-muted-foreground bg-white/60' },
];

function linksForRole(role: HubRole): HubLink[] {
  if (role === 'staff') return STAFF_LINKS;
  if (role === 'supervisor') return [...STAFF_LINKS, ...SUPERVISOR_EXTRA];
  return [...STAFF_LINKS, ...SUPERVISOR_EXTRA, ...ADMIN_EXTRA];
}

const titles: Record<HubRole, { title: string; subtitle: string }> = {
  staff: { title: 'Staff', subtitle: 'เมนูสำหรับพนักงาน / สตาฟ' },
  supervisor: { title: 'Supervisor', subtitle: 'เมนูสำหรับหัวหน้างาน' },
  admin: { title: 'Admin', subtitle: 'เมนูสำหรับผู้ดูแลระบบ' },
};

const RoleHubPage: React.FC<{ role: HubRole }> = ({ role }) => {
  const navigate = useNavigate();
  const { title, subtitle } = titles[role];
  const links = linksForRole(role);

  return (
    <div className="relative">
      <div className="jarvis-page-orb top-0 right-4 h-32 w-32" aria-hidden />
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
              onClick={() => navigate(item.path)}
              className="jarvis-menu-card rounded-[1.5rem] p-4 md:p-6 group touch-manipulation"
            >
              <div className={`w-11 h-11 rounded-2xl ${item.accent} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}>
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
