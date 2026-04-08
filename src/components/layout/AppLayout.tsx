import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { cn } from '@/lib/utils';
import { isDemoMode, isRuntimeDemoFallback } from '@/lib/demoMode';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import BottomDockNav from '@/components/layout/bottom-nav/BottomDockNav';
import { DOCK_NAV_ITEMS, isDockPathActive } from '@/components/layout/bottom-nav/dockNavConfig';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { config } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const shellBg = getAppShellBackgroundStyle(config);

  return (
    <div
      className={cn('min-h-[100dvh] min-h-screen flex flex-col', config.pageBackgroundMode === 'solid' && 'bg-background')}
      style={shellBg}
    >
      {(isDemoMode() || isRuntimeDemoFallback()) ? (
        <div
          role="status"
          className="text-center text-xs py-2 px-4 sm:px-6 border-b border-amber-500/35 bg-amber-500/15 text-amber-950 dark:text-amber-100"
        >
          {isRuntimeDemoFallback()
            ? 'ต่อ API ไม่ได้ — ใช้ข้อมูลตัวอย่างในเบราว์เซอร์อยู่ เมื่อเชื่อมฐานข้อมูลแล้วให้ออกจากระบบและรีเฟรชเพื่อใช้ข้อมูลจริง'
            : 'โหมดสาธิต — ใช้ข้อมูลตัวอย่างในเบราว์เซอร์ บางส่วนอาจไม่ตรงกับฐานข้อมูลจริง'}
        </div>
      ) : null}

      {/* Top header — จอใหญ่ (lg+) */}
      <header className="hidden lg:flex items-center justify-between gap-4 px-4 xl:px-8 py-3 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-4 xl:gap-8 min-w-0 flex-1">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <BrandMark size="md" />
            <BrandTitle className="text-lg font-bold text-foreground truncate max-w-[200px] xl:max-w-none" />
          </button>
          <nav className="flex items-center gap-0.5 xl:gap-1 flex-wrap min-w-0" aria-label="เมนูหลัก">
            {DOCK_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isDockPathActive(item.path, location.pathname);
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all touch-manipulation',
                    active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
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
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary max-w-[220px]">
            <UserCircle className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{user?.full_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">{user?.role}</span>
          </div>
          <div className="flex xl:hidden items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary">
            <UserCircle className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase">{user?.role}</span>
          </div>
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
      <header className="lg:hidden flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-40 safe-area-pt">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left min-w-0 touch-manipulation py-1">
          <BrandMark size="sm" />
          <BrandTitle className="text-base font-bold text-foreground truncate" />
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <NotificationPanel />
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-medium uppercase">
            {user?.role}
          </span>
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

      <main className="flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-5 md:px-6 lg:px-8 pb-[7.5rem] lg:pb-8">
        {children}
      </main>

      <div className="lg:hidden">
        <BottomDockNav pathname={location.pathname} />
      </div>
    </div>
  );
};

export default AppLayout;
