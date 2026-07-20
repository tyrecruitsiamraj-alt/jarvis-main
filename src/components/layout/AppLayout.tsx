import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Settings, UserCircle, MessageSquarePlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { cn } from '@/lib/utils';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import JobNotificationWatcher from '@/components/notifications/JobNotificationWatcher';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import BottomDockNav from '@/components/layout/bottom-nav/BottomDockNav';
import JobBoardHeaderMenu from '@/components/layout/JobBoardHeaderMenu';
import { DOCK_NAV_ITEMS, isDockPathActive, resolveDockNavTarget } from '@/components/layout/bottom-nav/dockNavConfig';
import { filterByMinimumRole } from '@/lib/rbac';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { config } = useBranding();
  const { isFunctionEnabled } = useRolePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const shellBg = getAppShellBackgroundStyle(config);
  const navItems = filterByMinimumRole(DOCK_NAV_ITEMS, user?.role);
  const showJobBoardMenu = isFunctionEnabled('unit_requests_read');
  const showSettings = isFunctionEnabled('settings_access');

  return (
    <div
      className={cn(
        'min-h-[100dvh] min-h-screen flex flex-col',
        config.pageBackgroundMode === 'solid' ? 'jarvis-warm-bg' : 'bg-background',
      )}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      <JobNotificationWatcher />

      {/* Top header — จอใหญ่ (lg+) */}
      <header className="hidden lg:flex items-center justify-between gap-2 2xl:gap-4 px-3 xl:px-4 2xl:px-8 py-3 border-b border-white/60 bg-white/45 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 2xl:gap-6 min-w-0 flex-1">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <BrandMark size="md" />
            <BrandTitle className="hidden 2xl:block text-lg font-bold text-foreground truncate max-w-[200px]" />
          </button>
          <nav
            className="flex min-w-0 flex-1 flex-nowrap items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="เมนูหลัก"
          >
            {navItems.flatMap((item) => {
              const Icon = item.icon;
              const active = isDockPathActive(item.path, location.pathname);
              const button = (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => navigate(resolveDockNavTarget(item.path))}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 px-2 2xl:gap-2 2xl:px-3 py-2 rounded-lg text-xs 2xl:text-sm font-medium transition-all touch-manipulation',
                    active ? 'bg-blue-500/12 text-blue-700' : 'text-muted-foreground hover:text-foreground hover:bg-white/50',
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </button>
              );
              if (item.path === '/jobs/list' && showJobBoardMenu) {
                return [button, <JobBoardHeaderMenu key="job-board-nav" variant="nav" />];
              }
              return [button];
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          <NotificationPanel />
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55 border border-white/70 max-w-[280px]">
            <UserCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{user?.full_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#141210] text-white shrink-0 capitalize">{user?.role}</span>
            {showSettings ? (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors shrink-0',
                  location.pathname.startsWith('/settings')
                    ? 'border-blue-300 bg-blue-500/12 text-blue-700'
                    : 'border-white/80 bg-white/70 text-muted-foreground hover:text-foreground hover:bg-white',
                )}
              >
                <Settings className="h-3.5 w-3.5" aria-hidden />
                ตั้งค่า
              </button>
            ) : null}
          </div>
          <div className="flex 2xl:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-white/55 border border-white/70">
            <UserCircle className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700 uppercase">{user?.role}</span>
            {showSettings ? (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className="p-1 rounded-full text-muted-foreground hover:text-blue-600 hover:bg-blue-500/12 touch-manipulation"
                aria-label="ตั้งค่า"
              >
                <Settings className="w-4 h-4" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => navigate('/feedback')}
            className="p-2.5 rounded-full text-muted-foreground hover:text-teal-700 hover:bg-teal-500/12 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="ส่งคำขอ / แจ้งบัค"
            title="ส่งคำขอ / แจ้งบัค"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
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
          {showJobBoardMenu ? <JobBoardHeaderMenu variant="compact" /> : null}
          <NotificationPanel />
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-[#141210] text-white font-medium uppercase">
            {user?.role}
          </span>
          <button
            type="button"
            onClick={() => navigate('/feedback')}
            className="p-2.5 rounded-lg text-muted-foreground hover:text-teal-700 hover:bg-teal-500/12 touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="ส่งคำขอ / แจ้งบัค"
          >
            <MessageSquarePlus className="w-4 h-4" />
          </button>
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
        {children}
      </main>

      <div className="lg:hidden">
        <BottomDockNav pathname={location.pathname} items={navItems} />
      </div>
    </div>
  );
};

export default AppLayout;
