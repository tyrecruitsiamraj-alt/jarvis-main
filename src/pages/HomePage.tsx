import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Search,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  HeartPulse,
  ArrowRight,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import type { AppFunctionId } from '@/lib/roleFunctions';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';
import { motion } from 'framer-motion';

const menuItems: {
  path: string;
  label: string;
  desc?: string;
  subtitle?: string;
  icon: LucideIcon;
  accent: string;
  adminOnly?: boolean;
  functionId?: AppFunctionId;
}[] = [
  {
    path: '/wl',
    label: 'WL',
    desc: 'บริหารกำลังคน / ปฏิทินงาน',
    icon: CalendarDays,
    accent: 'text-blue-500 bg-blue-500/10',
  },
  {
    path: '/matching',
    label: 'Matching',
    desc: 'จับคู่ผู้สมัครกับงาน',
    icon: Search,
    accent: 'text-amber-700 bg-amber-500/12',
  },
  {
    path: '/driver-care',
    label: 'Driver Care',
    desc: 'เตือนความเสี่ยงคนขับลาออก',
    icon: HeartPulse,
    accent: 'text-rose-700 bg-rose-500/12',
  },
  {
    path: '/jobs/board',
    label: 'บอร์ดงานเปิดรับ',
    desc: 'มุมมองเดียวกับลิงก์สมัครงาน /apply',
    icon: LayoutGrid,
    accent: 'text-sky-700 bg-sky-500/12',
    functionId: 'unit_requests_read',
  },
  {
    path: '/jobs/list',
    label: 'หน่วยงาน',
    desc: 'จัดการใบขอและหน่วยงาน',
    icon: Briefcase,
    accent: 'text-blue-600 bg-blue-400/12',
    functionId: 'unit_requests_read',
  },
  {
    path: '/matching/candidates',
    label: 'ผู้สมัคร',
    subtitle: 'Candidates',
    icon: Users,
    accent: 'text-stone-700 bg-stone-500/10',
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    desc: 'ภาพรวมและ KPI',
    icon: BarChart3,
    accent: 'text-neutral-800 bg-neutral-500/10',
  },
  {
    path: '/settings',
    label: 'Settings',
    desc: 'ตั้งค่าระบบ / ธีม',
    icon: Settings,
    accent: 'text-muted-foreground bg-white/60',
    adminOnly: true,
  },
];

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { isFunctionEnabled } = useRolePermissions();

  const filteredMenus = menuItems.filter((item) => {
    if (item.adminOnly && !hasPermission('admin')) return false;
    if (item.functionId && !isFunctionEnabled(item.functionId)) return false;
    return true;
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';

  return (
    <div className="relative -mx-4 sm:-mx-5 md:-mx-6 lg:-mx-8 px-4 sm:px-5 md:px-6 lg:px-8 py-6 md:py-8">
      {/* subtle orb accent */}
      <div
        className="pointer-events-none absolute -top-8 right-0 h-40 w-40 jarvis-blue-orb opacity-30 blur-sm"
        aria-hidden
      />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="jarvis-frost relative mb-8 overflow-hidden p-6 md:p-8"
      >
        <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 border border-white/80 shadow-sm">
              <BrandMark size="md" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{greeting}</p>
              <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-foreground truncate">
                {user?.full_name}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                ยินดีต้อนรับสู่ระบบ{' '}
                <BrandTitle className="font-semibold text-foreground" />
              </p>
            </div>
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-blue-100/25"
          aria-hidden
        />
      </motion.div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">เมนูหลัก</h2>
        <span className="text-xs text-muted-foreground hidden sm:inline">{filteredMenus.length} modules</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
        {filteredMenus.map((item, i) => (
          <motion.button
            key={item.path}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() =>
              navigate(item.path === '/jobs/list' ? resolveUnitNavPath() : item.path)
            }
            className="jarvis-menu-card rounded-[1.5rem] p-4 md:p-6 group touch-manipulation"
          >
            <div
              className={`w-11 h-11 rounded-2xl ${item.accent} flex items-center justify-center mb-4 transition-transform group-hover:scale-105`}
            >
              <item.icon className="w-5 h-5" />
            </div>
            <div className="font-semibold text-foreground text-sm md:text-base">{item.label}</div>
            {item.subtitle ? (
              <div className="text-[11px] font-medium text-muted-foreground tracking-wide mt-0.5">{item.subtitle}</div>
            ) : null}
            {item.desc ? (
              <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{item.desc}</div>
            ) : null}
            <div className="mt-4 flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
              เปิด
              <ArrowRight className="h-3 w-3" aria-hidden />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;
