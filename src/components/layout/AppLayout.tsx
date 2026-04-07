import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Briefcase, BarChart3, Settings, LogOut, UserCircle, CalendarDays, Search, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { cn } from '@/lib/utils';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
const mainNav = [
  { path: '/', label: 'หน้าหลัก', icon: Home },
  { path: '/wl', label: 'WL', icon: CalendarDays },
  { path: '/matching', label: 'Matching', icon: Search },
  { path: '/matching/candidates', label: 'ผู้สมัคร', icon: Users },
  { path: '/jobs', label: 'หน่วยงาน', icon: Briefcase },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, hasPermission } = useAuth();
  const { config } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();
  const shellBg = getAppShellBackgroundStyle(config);

  const isActive = (path: string) => {
    const p = location.pathname;
    if (path === '/') return p === '/';
    if (path === '/matching/candidates') return p.startsWith('/matching/candidates');
    if (path === '/matching') {
      if (p.startsWith('/matching/candidates')) return false;
      return p.startsWith('/matching');
    }
    return p.startsWith(path);
  };

  const canOpenSettings = hasPermission('admin');

  return (
    <div
      className={cn('min-h-screen flex flex-col', config.pageBackgroundMode === 'solid' && 'bg-background')}
      style={shellBg}
    >
      {/* Top header - desktop */}
      <header className="hidden md:flex items-center justify-between px-6 py-3 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-8">
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2">
            <BrandMark size="md" />
            <BrandTitle className="text-lg font-bold text-foreground" />
          </button>
          <nav className="flex items-center gap-1">
            {mainNav.map(item => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
            {canOpenSettings && (
              <button
                type="button"
                onClick={() => navigate('/settings')}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  isActive('/settings')
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationPanel />
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary">
            <UserCircle className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{user?.full_name}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">{user?.role}</span>
          </div>
          <button type="button" onClick={() => void logout()} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left">
          <BrandMark size="sm" />
          <BrandTitle className="text-base font-bold text-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          <NotificationPanel />
          {canOpenSettings && (
            <button
              type="button"
              onClick={() => navigate('/settings')}
              className={cn(
                'p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary',
                isActive('/settings') && 'text-primary bg-primary/10',
              )}
              aria-label="การตั้งค่า"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary max-[380px]:hidden">
            {user?.role}
          </span>
          <button type="button" onClick={() => void logout()} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50 safe-area-bottom">
        <div className="flex items-stretch justify-start gap-0.5 overflow-x-auto px-1 py-2 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {mainNav.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'flex shrink-0 flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[3.25rem] max-w-[4.5rem]',
                isActive(item.path)
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )}
            >
              <item.icon className={cn('w-5 h-5 shrink-0', isActive(item.path) && 'drop-shadow-[0_0_6px_hsl(var(--primary))]')} />
              <span className="text-[9px] font-medium text-center leading-tight line-clamp-2 w-full">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
