import React, { useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, KeyRound, LogOut, Settings } from 'lucide-react';
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
        ? 'bg-primary/10 text-primary dark:bg-primary/25 dark:text-rose-100'
        : 'text-foreground/80 hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
    );

  return (
    /**
     * 🔴 **ใช้ Sheet ของ shadcn** (4 ก.ย. 2569 — เจ้าของสั่ง *"ห้ามหลุด Framework"*)
     * เดิมปั้นลิ้นชักเอง: overlay `fixed inset-0` + `<aside role="dialog">` + สั่ง
     * translate เองตาม `open` ⇒ ไม่มี focus trap · ปิดด้วย Esc ไม่ได้ · ไม่ล็อกสกรอลล์พื้นหลัง
     * Sheet ให้ครบทั้งสามอย่างในตัว และปุ่มปิดมากับ `SheetContent` แล้ว
     */
    <Sheet open={open} onOpenChange={(o) => (o ? undefined : onClose())}>
      <SheetContent
        side="left"
        className="flex w-[17rem] max-w-[85vw] flex-col gap-0 p-0 sm:max-w-[17rem]"
      >
        <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-white/60 px-4 py-3 text-left dark:border-slate-700/70">
          <SheetTitle asChild>
            <button type="button" onClick={() => go('/')} className="flex min-w-0 items-center gap-2">
              <BrandMark size="sm" />
              <BrandTitle className="truncate text-base font-bold text-foreground" />
            </button>
          </SheetTitle>
          <SheetDescription className="sr-only">เมนูหลักของระบบ</SheetDescription>
        </SheetHeader>

        {userName ? (
          <div className="flex items-center gap-2 border-b border-white/50 px-4 py-2.5 dark:border-slate-700/70">
            <span className="truncate text-sm font-medium text-foreground">{userName}</span>
            {userRole ? (
              <span className="ml-auto rounded-full bg-ink px-2 py-0.5 text-[10px] font-medium uppercase text-white">
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
                {/* 🔴 **ไอคอนแทนเลขขั้น** (เจ้าของสั่ง 28 ส.ค. 2569:
                    *"ไม่เอาตัวเลข ขอเป็นสัญลักษณ์ที่บ่งบอกถึงข้อนั้น ๆ"*)
                    ไอคอนมาจาก `CONVEYOR_STEPS[].icon` — แหล่งเดียวกับหัวหน้าจอ */}
                <step.icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    active ? 'text-blue-600 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500',
                  )}
                  aria-hidden
                />
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
      </SheetContent>
    </Sheet>
  );
};

export default AppNavDrawer;
