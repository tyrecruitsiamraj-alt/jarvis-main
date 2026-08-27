import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, KeyRound, LogOut, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import { shouldShowPasswordUi } from '@/lib/authConfig';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { resolveDockNavTarget, type DockNavItem } from '@/components/layout/bottom-nav/dockNavConfig';
import {
  CONVEYOR_HOME,
  CONVEYOR_STEPS,
  CONVEYOR_VAULT,
  isStepActive,
  isVaultActive,
} from '@/lib/soRecruitNav';

const groupLabelClass =
  'px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground';

type Props = {
  open: boolean;
  onClose: () => void;
  items: DockNavItem[];
  showJobBoard: boolean;
  showSettings: boolean;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
};

/** เมนูนำทางหลักแบบ drawer เลื่อนออกจากซ้าย (ใช้เหมือนกันทั้งจอใหญ่และมือถือ) */
const AppNavDrawer: React.FC<Props> = ({
  open,
  onClose,
  items,
  showJobBoard,
  showSettings,
  userName,
  userRole,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  // ล็อกเข้าทาง Microsoft = ซ่อนเมนูเปลี่ยนรหัสผ่าน (เงื่อนไขเดียวกับแถบบน/หน้า Login)
  const showPasswordUi = shouldShowPasswordUi(useAuthConfig());

  /**
   * เมนูที่แอดมินซ่อนไว้ที่หน้าตั้งค่า — ยังต้องมีผลกับโครงใหม่
   * (ลำดับกับชื่อไม่รับแล้ว เพราะเลขขั้นผูกกับหัวหน้าจอทุกหน้า · ดูคอมเมนต์ที่ <nav>)
   *
   * ⚠️ `applyNavPreferences` **กรองของที่ซ่อนออกไปแล้ว** ก่อนส่งมาที่นี่
   * ⇒ ตรวจจาก "หายไปจากลิสต์" ไม่ใช่จากธง `hidden` (ซึ่งไม่มีในชนิดข้อมูลนี้)
   * ขั้นที่ไม่มีเมนูเดิมคู่กัน (ขั้น 2/3/4) ไม่มีอะไรให้ซ่อน — โชว์เสมอ
   */
  const OWNER_DOCK_PATH: Record<string, string> = {
    requests: '/jobs/list',
    follow: '/follow',
    aftercare: '/aftercare',
    candidates: '/matching/candidates',
    wl: '/wl',
    dashboard: '/dashboard',
  };
  const visiblePaths = React.useMemo(() => new Set(items.map((i) => i.path)), [items]);
  const shown = (key: string) => {
    const owner = OWNER_DOCK_PATH[key];
    return owner === undefined || visiblePaths.has(owner);
  };
  const visibleSteps = CONVEYOR_STEPS.filter(
    (s) => shown(s.key) && (s.key === 'requests' || !s.path.startsWith('/jobs/board') || showJobBoard),
  );
  const visibleVault = CONVEYOR_VAULT.filter((v) => shown(v.key));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (path: string) => {
    navigate(resolveDockNavTarget(path));
    onClose();
  };

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
      active
        ? 'bg-blue-500/12 text-blue-700 dark:bg-sky-400/15 dark:text-sky-200'
        : 'text-foreground/80 hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
    );

  return (
    <>
      {/* overlay */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* panel */}
      <aside
        role="dialog"
        aria-label="เมนูหลัก"
        aria-modal={open}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-[17rem] max-w-[85vw] flex-col border-r border-white/60 bg-white/85 shadow-2xl dark:border-slate-700/70 dark:bg-slate-900/90 backdrop-blur-xl transition-transform duration-250 ease-out safe-area-pt',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/60 px-4 py-3 dark:border-slate-700/70">
          <button type="button" onClick={() => go('/')} className="flex min-w-0 items-center gap-2">
            <BrandMark size="sm" />
            <BrandTitle className="truncate text-base font-bold text-foreground" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userName ? (
          <div className="flex items-center gap-2 border-b border-white/50 px-4 py-2.5 dark:border-slate-700/70">
            <span className="truncate text-sm font-medium text-foreground">{userName}</span>
            {userRole ? (
              <span className="ml-auto rounded-full bg-[#141210] px-2 py-0.5 text-[10px] font-medium uppercase text-white">
                {userRole}
              </span>
            ) : null}
          </div>
        ) : null}

        {/*
          🔴 **เมนูหลักของทั้งระบบอยู่ที่นี่ที่เดียวแล้ว** (27 ส.ค. 2569 ถอดแถบติดซ้ายออก
          ตามที่เจ้าของสั่งให้กลับไปเป็น burger เพื่อไม่ให้กินพื้นที่) — ทั้งจอเล็กและจอใหญ่
          🔴 **ลำดับขั้นห้ามสลับ** เพราะเลข "ขั้นที่ N" ผูกกับหัวหน้าจอทุกหน้า
          ⇒ ที่นี่จึงไม่ใช้ลำดับจาก `items` (navPreferences) เหมือนเดิม แต่ยัง
          **เคารพการซ่อนของแอดมิน**: เมนูที่แอดมินซ่อนไว้จะไม่โผล่ (ดู hiddenPaths)
        */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="เมนูหลัก">
          <div className={groupLabelClass}>งานของฉัน</div>
          <button
            type="button"
            onClick={() => go(CONVEYOR_HOME.path)}
            className={rowClass(location.pathname === '/')}
          >
            <CONVEYOR_HOME.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{CONVEYOR_HOME.label}</span>
          </button>

          <div className={groupLabelClass}>สายพานงาน</div>
          {visibleSteps.map((step) => {
            const active = isStepActive(step, location.pathname, location.search);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => go(step.path)}
                className={rowClass(active)}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-semibold',
                    active
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-200/80 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
                  )}
                >
                  {step.step}
                </span>
                <span className="truncate">{step.label}</span>
              </button>
            );
          })}

          <div className={groupLabelClass}>คลังข้อมูล</div>
          {visibleVault.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go(item.path)}
              className={rowClass(isVaultActive(item, location.pathname, location.search))}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ))}

          <div className={groupLabelClass}>ทางเข้าอื่น</div>
          <button
            type="button"
            onClick={() => {
              window.open('/apply', '_blank', 'noopener,noreferrer');
              onClose();
            }}
            className={cn(rowClass(false), 'text-muted-foreground')}
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">หน้าสมัครสาธารณะ (/apply)</span>
          </button>
        </nav>

        <div className="space-y-1 border-t border-white/60 p-3 dark:border-slate-700/70">
          {showSettings ? (
            <button
              type="button"
              onClick={() => go('/settings')}
              className={rowClass(location.pathname.startsWith('/settings'))}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">ตั้งค่า</span>
            </button>
          ) : null}
          {/* ย้ายมาจากหัวเว็บ — จอมือถือใส่ปุ่มพวกนี้ไว้บนหัวไม่พอ ปุ่มจะเบียดทับกัน
              ซ่อนพร้อมกับปุ่มบนแถบบนเมื่อระบบล็อกให้เข้าทาง Microsoft (เงื่อนไขเดียวกัน) */}
          {showPasswordUi ? (
            <button
              type="button"
              onClick={() => go('/account/change-password')}
              className={rowClass(location.pathname.startsWith('/account/change-password'))}
            >
              <KeyRound className="h-4 w-4 shrink-0" />
              <span className="truncate">เปลี่ยนรหัสผ่าน</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={cn(rowClass(false), 'text-muted-foreground hover:text-destructive')}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppNavDrawer;
