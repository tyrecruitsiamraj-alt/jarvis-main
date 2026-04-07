import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Search, Briefcase, Users, BarChart3, Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BrandTitle } from '@/components/shared/BrandMark';
import { motion } from 'framer-motion';

const menuItems: {
  path: string;
  label: string;
  desc?: string;
  subtitle?: string;
  icon: LucideIcon;
  color: string;
  adminOnly?: boolean;
}[] = [
  { path: '/wl', label: 'WL', desc: 'บริหารกำลังคน / ปฏิทินงาน', icon: CalendarDays, color: 'bg-primary/10 text-primary' },
  { path: '/matching', label: 'Matching', desc: 'จับคู่ผู้สมัครกับงาน', icon: Search, color: 'bg-info/10 text-info' },
  { path: '/jobs', label: 'หน่วยงาน', desc: 'จัดการใบขอและหน่วยงาน', icon: Briefcase, color: 'bg-warning/10 text-warning' },
  { path: '/matching/candidates', label: 'ผู้สมัคร', subtitle: 'Candidates', icon: Users, color: 'bg-success/10 text-success' },
  { path: '/dashboard', label: 'Dashboard', desc: 'ภาพรวมและ KPI', icon: BarChart3, color: 'bg-destructive/10 text-destructive' },
  {
    path: '/settings',
    label: 'Settings',
    desc: 'ตั้งค่าระบบ / ธีม',
    icon: Settings,
    color: 'bg-muted text-muted-foreground',
    adminOnly: true,
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();

  const filteredMenus = menuItems.filter((item) => !item.adminOnly || hasPermission('admin'));

  return (
    <div className="px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground">สวัสดี, {user?.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          ยินดีต้อนรับสู่ระบบ <BrandTitle className="font-semibold text-foreground" />
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
        {filteredMenus.map((item, i) => (
          <motion.button
            key={item.path}
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
            {item.subtitle ? (
              <div className="text-[11px] font-medium text-muted-foreground tracking-wide mt-0.5">{item.subtitle}</div>
            ) : null}
            {item.desc ? (
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.desc}</div>
            ) : null}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
