import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Search,
  Briefcase,
  Users,
  BarChart3,
  Settings,
  PhoneForwarded,
  ArrowRight,
  ArrowDown,
  LayoutGrid,
  PhoneCall,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import type { AppFunctionId } from '@/lib/roleFunctions';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { resolveUnitNavPath } from '@/lib/jobUnitSessionState';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  fetchFlowSummary,
  confirmedThisMonth,
  type FlowSummary,
  type FlowFollowUpItem,
} from '@/lib/flowSummaryApi';

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
    path: '/follow',
    label: 'Follow',
    desc: 'ลงรายชื่อคนที่ต้องติดตาม — Lumos โทรให้',
    icon: PhoneForwarded,
    accent: 'text-rose-700 bg-rose-500/12',
    functionId: 'follow_read',
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

/** ก้อนตัวเลข 1 ขั้นใน funnel — กดแล้วพาไปหน้าที่เกี่ยวข้อง */
function FlowStage({
  label,
  value,
  sub,
  onClick,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-card min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/50 px-3 py-2.5 text-left transition-colors hover:border-blue-300/60 hover:bg-blue-50/40"
    >
      <div className="text-[11px] font-medium leading-snug text-muted-foreground">{label}</div>
      <div className={cn('mt-0.5 text-2xl font-bold tabular-nums', accent)}>{value}</div>
      {sub ? <div className="text-[10px] text-muted-foreground">{sub}</div> : null}
    </button>
  );
}

/** รายการคนที่ต้องตามต่อจากผลโทร Lumos — กดแล้วเปิดใบขอนั้นในหน้า Matching */
function FollowUpList({
  items,
  emptyHidden,
  onOpen,
}: {
  items: FlowFollowUpItem[];
  emptyHidden?: boolean;
  onOpen: (item: FlowFollowUpItem) => void;
}) {
  if (items.length === 0 && emptyHidden) return null;
  return (
    <div className="mt-1.5 space-y-1">
      {items.slice(0, 3).map((it) => (
        <button
          key={`${it.job_ref}:${it.person_ref}`}
          type="button"
          onClick={() => onOpen(it)}
          className="w-full rounded-lg border border-white/80 bg-white/70 px-2 py-1.5 text-left hover:bg-white"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[11px] font-medium text-foreground">{it.name || it.person_ref}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.request_no}</span>
          </div>
          {it.summary ? <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{it.summary}</p> : null}
        </button>
      ))}
      {items.length > 3 ? (
        <p className="text-[10px] text-muted-foreground">…และอีก {items.length - 3} รายการ</p>
      ) : null}
    </div>
  );
}

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { isFunctionEnabled } = useRolePermissions();

  // สรุปการไหลของงาน — โหลดพลาดก็แค่ไม่แสดง (ไม่บล็อกเมนูหลัก)
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);

  const loadFlow = async () => {
    setFlowLoading(true);
    try {
      setFlow(await fetchFlowSummary());
    } catch {
      setFlow(null);
    } finally {
      setFlowLoading(false);
    }
  };

  useEffect(() => {
    void loadFlow();
  }, []);

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

      {/* การไหลของงานสรรหา — งานเข้า → AI → โทร → จอง → ลงงาน (กดตัวเลขเพื่อไปหน้านั้น) */}
      {flow ? (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              การไหลของงานสรรหา · เดือนนี้
            </h2>
            <button
              type="button"
              onClick={() => void loadFlow()}
              disabled={flowLoading}
              className="inline-flex items-center gap-1 rounded-full border border-white/80 bg-white/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-white disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', flowLoading && 'animate-spin')} /> รีเฟรช
            </button>
          </div>

          {/* Funnel หลัก */}
          <div className="glass-card rounded-[1.5rem] border border-white/70 p-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
              <FlowStage
                label="ใบขอเปิดอยู่"
                value={flow.jobs.open_total}
                sub={`ด่วน ${flow.jobs.urgent} ใบ`}
                accent="text-slate-800"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="AI แนะนำคนแล้ว"
                value={flow.jobs.with_recommend}
                sub={`จากที่ประเมิน ${flow.jobs.analyzed} ใบ`}
                accent="text-sky-700"
                onClick={() => navigate('/matching/match?workflow=green')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="ส่งให้ Lumos โทร"
                value={flow.lumos.sent_month}
                sub={`รอโทรอีก ${flow.lumos.waiting_call + flow.lumos.delivered_waiting}`}
                accent="text-blue-700"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="สนใจงาน (จากผลโทร)"
                value={confirmedThisMonth(flow)}
                sub={`ปฏิเสธ ${flow.lumos.outcomes_month['declined'] ?? 0} · ไม่รับสาย ${(flow.lumos.outcomes_month['no_answer'] ?? 0) + (flow.lumos.outcomes_month['unresponsive'] ?? 0)}`}
                accent="text-emerald-700"
                onClick={() => navigate('/matching/match')}
              />
              <div className="flex items-center justify-center text-muted-foreground/60">
                <ArrowRight className="hidden h-4 w-4 sm:block" aria-hidden />
                <ArrowDown className="h-4 w-4 sm:hidden" aria-hidden />
              </div>
              <FlowStage
                label="จองตัวอยู่ / ลงงาน"
                value={flow.proposals.reserved_active + flow.proposals.placed_month}
                sub={`จอง ${flow.proposals.reserved_active} · ลงงานเดือนนี้ ${flow.proposals.placed_month}`}
                accent="text-violet-700"
                onClick={() => navigate('/matching/reservations')}
              />
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              ตัวเลขการเคลื่อนไหวนับเดือนนี้ · ของค้างนับทั้งหมด · เป็นสถานะการทำงานของทีม Matching ไม่ใช่ยอด
              "หาได้แล้ว/ปิดครบใบขอ" ทางการจากใบขอ
            </p>
          </div>

          {/* ต้องติดตาม + สำเร็จ */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {flow.follow_ups.confirmed_waiting.length > 0 ? (
              <div className="glass-card rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
                  <PhoneCall className="h-3.5 w-3.5" />
                  สนใจงานแล้ว — รอคนกดจอง ({flow.follow_ups.confirmed_waiting.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.confirmed_waiting}
                  onOpen={(it) => navigate(`/matching/match?jobId=${encodeURIComponent(it.job_ref)}`)}
                />
              </div>
            ) : null}

            {flow.follow_ups.no_answer.length > 0 ? (
              <div className="glass-card rounded-2xl border border-amber-200/80 bg-amber-50/40 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900">
                  <PhoneForwarded className="h-3.5 w-3.5" />
                  ไม่รับสาย — ควรโทรซ้ำ ({flow.follow_ups.no_answer.length})
                </div>
                <FollowUpList
                  items={flow.follow_ups.no_answer}
                  onOpen={(it) => navigate(`/matching/match?jobId=${encodeURIComponent(it.job_ref)}`)}
                />
              </div>
            ) : null}

            {flow.jobs.urgent_stuck > 0 || flow.lumos.stale_delivered > 0 ? (
              <div className="glass-card rounded-2xl border border-red-200/80 bg-red-50/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  ติดขัด — ต้องมีคนตัดสินใจ
                </div>
                {flow.jobs.urgent_stuck > 0 ? (
                  <button
                    type="button"
                    onClick={() => navigate('/matching/match?urgent=1&workflow=none')}
                    className="w-full rounded-lg border border-white/80 bg-white/70 px-2 py-1.5 text-left text-[11px] text-foreground hover:bg-white"
                  >
                    ใบด่วนที่ AI ไม่พบคน และยังไม่ส่งโพสหาคนใหม่ —{' '}
                    <span className="font-bold text-red-700">{flow.jobs.urgent_stuck} ใบ</span>
                  </button>
                ) : null}
                {flow.lumos.stale_delivered > 0 ? (
                  <div className="rounded-lg border border-white/80 bg-white/70 px-2 py-1.5 text-[11px] text-foreground">
                    Lumos รับสายไปเกิน 2 วันยังไม่มีผลกลับ —{' '}
                    <span className="font-bold text-red-700">{flow.lumos.stale_delivered} ราย</span>
                    <span className="text-muted-foreground"> · ควรเช็คกับทีม Lumos</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {flow.follow_ups.confirmed_waiting.length === 0 &&
            flow.follow_ups.no_answer.length === 0 &&
            flow.jobs.urgent_stuck === 0 &&
            flow.lumos.stale_delivered === 0 ? (
              <div className="glass-card rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-3 lg:col-span-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  ไม่มีเรื่องค้างที่ต้องตามตอนนี้ — ผลโทรที่สนใจถูกจองครบ และใบด่วนมีคนดูแลแล้ว
                </div>
              </div>
            ) : null}
          </div>
        </motion.section>
      ) : null}

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
