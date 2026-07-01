import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, RefreshCw, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { cn } from '@/lib/utils';
import { isConfiguredDemoMode, isRuntimeDemoFallback, isRuntimeDemoFallbackEnabled } from '@/lib/demoMode';
import { reloadForLiveData, tryRecoverFromRuntimeDemo } from '@/lib/apiRecovery';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import JobNotificationWatcher from '@/components/notifications/JobNotificationWatcher';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import BottomDockNav from '@/components/layout/bottom-nav/BottomDockNav';
import { DOCK_NAV_ITEMS, isDockPathActive } from '@/components/layout/bottom-nav/dockNavConfig';
import { filterByMinimumRole } from '@/lib/rbac';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { config } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const shellBg = getAppShellBackgroundStyle(config);
  const navItems = filterByMinimumRole(DOCK_NAV_ITEMS, user?.role);
  const [runtimeFallback, setRuntimeFallback] = useState(
    () => isRuntimeDemoFallbackEnabled() && isRuntimeDemoFallback(),
  );
  const [recovering, setRecovering] = useState(false);

  const attemptRecovery = async (reloadOnSuccess = true) => {
    if (!isRuntimeDemoFallbackEnabled() || !isRuntimeDemoFallback()) {
      setRuntimeFallback(false);
      return;
    }
    setRecovering(true);
    try {
      const result = await tryRecoverFromRuntimeDemo();
      if (result === 'recovered') {
        setRuntimeFallback(false);
        if (reloadOnSuccess) reloadForLiveData();
      }
    } finally {
      setRecovering(false);
    }
  };

  useEffect(() => {
    if (!runtimeFallback) return;

    void attemptRecovery(true);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void attemptRecovery(true);
    };
    document.addEventListener('visibilitychange', onVisible);
    const id = window.setInterval(() => void attemptRecovery(true), 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(id);
    };
  }, [runtimeFallback]);

  const showDemoBanner = isConfiguredDemoMode() || (isRuntimeDemoFallbackEnabled() && runtimeFallback);

  return (
    <div
      className={cn(
        'min-h-[100dvh] min-h-screen flex flex-col',
        config.pageBackgroundMode === 'solid' ? 'jarvis-warm-bg' : 'bg-background',
      )}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      <JobNotificationWatcher />
      {showDemoBanner ? (
        <div
          role="status"
          className="flex flex-col sm:flex-row sm:items-center sm:justify-center gap-2 text-center text-xs py-2 px-4 sm:px-6 border-b border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-100"
        >
          <span>
            {runtimeFallback
              ? recovering
                ? 'กำลังตรวจสอบการเชื่อมต่อ API…'
                : 'ต่อ API ไม่ได้ — ใช้ข้อมูลตัวอย่างชั่วคราว ระบบจะสลับเป็นข้อมูลจริงอัตโนมัติเมื่อ API พร้อม'
              : 'โหมดสาธิต — ใช้ข้อมูลตัวอย่างในเบราว์เซอร์ บางส่วนอาจไม่ตรงกับฐานข้อมูลจริง'}
          </span>
          {runtimeFallback ? (
            <button
              type="button"
              disabled={recovering}
              onClick={() => void attemptRecovery(true)}
              className="inline-flex items-center justify-center gap-1.5 self-center rounded-full border border-amber-600/30 bg-white/80 px-3 py-1 text-xs font-medium text-amber-950 hover:bg-white disabled:opacity-60 touch-manipulation"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', recovering && 'animate-spin')} />
              ใช้ข้อมูลจริง
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Top header — จอใหญ่ (lg+) */}
      <header className="hidden lg:flex items-center justify-between gap-4 px-4 xl:px-8 py-3 border-b border-white/60 bg-white/45 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-4 xl:gap-8 min-w-0 flex-1">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <BrandMark size="md" />
            <BrandTitle className="text-lg font-bold text-foreground truncate max-w-[200px] xl:max-w-none" />
          </button>
          <nav className="flex items-center gap-0.5 xl:gap-1 flex-wrap min-w-0" aria-label="เมนูหลัก">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isDockPathActive(item.path, location.pathname);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all touch-manipulation',
                    active ? 'bg-blue-500/12 text-blue-700' : 'text-muted-foreground hover:text-foreground hover:bg-white/50',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          <NotificationPanel />
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55 border border-white/70 max-w-[220px]">
            <UserCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{user?.full_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#141210] text-white shrink-0">{user?.role}</span>
          </div>
          <div className="flex xl:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-white/55 border border-white/70">
            <UserCircle className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 uppercase">{user?.role}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/account/change-password')}
            className="p-2.5 rounded-full text-muted-foreground hover:text-blue-600 hover:bg-white/60 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="เปลี่ยนรหัสผ่าน"
            title="เปลี่ยนรหัสผ่าน"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* หัวแบบย่อ — แท็บเล็ต/มือถือ (ต่ำกว่า lg) */}
      <header className="lg:hidden flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/60 bg-white/45 backdrop-blur-xl sticky top-0 z-40 safe-area-pt">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left min-w-0 touch-manipulation py-1">
          <BrandMark size="sm" />
          <BrandTitle className="text-base font-bold text-foreground truncate" />
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <NotificationPanel />
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-[#141210] text-white font-medium uppercase">
            {user?.role}
          </span>
          <button
            type="button"
            onClick={() => navigate('/account/change-password')}
            className="p-2.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-500/12 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="เปลี่ยนรหัสผ่าน"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="ออกจากระบบ"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="relative flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-5 md:px-6 lg:px-8 pb-[7.5rem] lg:pb-8 overflow-x-clip">
        <div className="jarvis-page-orb top-0 right-4 h-48 w-48 opacity-[0.18] pointer-events-none hidden md:block" aria-hidden />
        {children}
      </main>

      <div className="lg:hidden">
        <BottomDockNav pathname={location.pathname} items={navItems} />
      </div>
    </div>
  );
};

export default AppLayout;
