import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/shared/PageHeader';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { CalendarDays, Search, Briefcase, Users, BarChart3, Settings } from 'lucide-react';

export type HubRole = 'staff' | 'supervisor' | 'admin';

type HubLink = {
  path: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  color: string;
};

const STAFF_LINKS: HubLink[] = [
  { path: '/wl', label: 'WL', desc: 'ปฏิทิน / ลงงาน / พนักงาน', icon: CalendarDays, color: 'bg-primary/10 text-primary' },
  { path: '/jobs/list', label: 'หน่วยงาน', desc: 'ดูรายการใบขอ', icon: Briefcase, color: 'bg-warning/10 text-warning' },
];

const SUPERVISOR_EXTRA: HubLink[] = [
  { path: '/matching', label: 'Matching', desc: 'จับคู่ผู้สมัครกับงาน', icon: Search, color: 'bg-info/10 text-info' },
  { path: '/jobs', label: 'แดชบอร์ดหน่วยงาน', desc: 'สรุปและสร้างงาน', icon: Briefcase, color: 'bg-warning/10 text-warning' },
  { path: '/dashboard', label: 'Dashboard', desc: 'ภาพรวมและ KPI', icon: BarChart3, color: 'bg-destructive/10 text-destructive' },
];

const ADMIN_EXTRA: HubLink[] = [
  { path: '/settings', label: 'Settings', desc: 'ตั้งค่าระบบ / ธีม', icon: Settings, color: 'bg-muted text-muted-foreground' },
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
    <div>
      <PageHeader title={title} subtitle={subtitle} backPath="/" />
      <div className="px-4 md:px-6 py-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {links.map((item, i) => (
            <motion.button
              key={item.path}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(item.path)}
              className="glass-card rounded-xl p-4 md:p-6 border border-border hover:border-primary/40 transition-all text-left group"
            >
              <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mb-3`}>
                <item.icon className="w-5 h-5" />
              </div>
              <div className="font-semibold text-foreground text-sm">{item.label}</div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.desc}</div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RoleHubPage;
