import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Menu, Moon, Settings, Sun, UserCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { cn } from '@/lib/utils';
import { useAuthConfig } from '@/hooks/useAuthConfig';
import { shouldShowPasswordUi } from '@/lib/authConfig';
import NotificationPanel from '@/components/notifications/NotificationPanel';
import JobNotificationWatcher from '@/components/notifications/JobNotificationWatcher';
import ClaimIdleAlertDialog from '@/components/notifications/ClaimIdleAlertDialog';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import AppNavDrawer from '@/components/layout/AppNavDrawer';
import ConveyorSidebar from '@/components/layout/ConveyorSidebar';
import StageBanner from '@/components/layout/StageBanner';
import { DOCK_NAV_ITEMS } from '@/components/layout/bottom-nav/dockNavConfig';
import { applyNavPreferences, type NavPreferences } from '@/lib/navPreferences';
import { fetchNavPreferences } from '@/lib/navPreferencesApi';
import { NAV_PREFERENCES_CHANGED_EVENT } from '@/lib/navPreferencesEvent';
import { Switch } from '@/components/ui/switch';
import { filterByMinimumRole } from '@/lib/rbac';
import { useRolePermissions } from '@/contexts/RolePermissionsContext';
import { loadThemeMode, resolveTheme, setThemeMode } from '@/lib/theme';

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  // ล็อกเข้าทาง Microsoft = ซ่อนของที่เกี่ยวกับรหัสผ่าน (ดู shouldShowPasswordUi)
  const showPasswordUi = shouldShowPasswordUi(useAuthConfig());
  const { config } = useBranding();
  const { isFunctionEnabled } = useRolePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const shellBg = getAppShellBackgroundStyle(config);
  /**
   * เมนูที่แอดมินจัดเอง (093) — ทับลำดับ/ชื่อ/ซ่อน ของลิสต์ตั้งต้น
   * ⚠️ โหลดไม่ได้ = ใช้ตั้งต้น (fetchNavPreferences ไม่ throw) — เมนูต้องขึ้นเสมอ
   */
  const [navPrefs, setNavPrefs] = useState<NavPreferences>({});
  useEffect(() => {
    let cancelled = false;
    void fetchNavPreferences().then((p) => {
      if (!cancelled) setNavPrefs(p);
    });
    // ฟังสัญญาณจากหน้าตั้งค่า — บันทึกแล้วเมนูเปลี่ยนทันที ไม่ต้องรีเฟรช
    const onChanged = () => void fetchNavPreferences().then((p) => setNavPrefs(p));
    window.addEventListener(NAV_PREFERENCES_CHANGED_EVENT, onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener(NAV_PREFERENCES_CHANGED_EVENT, onChanged);
    };
  }, []);
  const navItems = applyNavPreferences(
    filterByMinimumRole(DOCK_NAV_ITEMS, user?.role),
    navPrefs,
  );
  const showJobBoardMenu = isFunctionEnabled('unit_requests_read');
  const showSettings = isFunctionEnabled('settings_access');
  const [navOpen, setNavOpen] = useState(false);
  /** ธีมที่ใช้จริงตอนนี้ — ปุ่มสลับ light/dark (จำค่าต่อเครื่อง) */
  const [theme, setTheme] = useState<'light' | 'dark'>(() => resolveTheme(loadThemeMode()));
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    setTheme(next);
  };
  /** สลับธีมด้วย Switch — เห็นสถานะปัจจุบันจากตำแหน่งปุ่ม ไม่ต้องเดาจากไอคอน
   *  ไอคอนสองข้างบอกทิศ · ข้างที่ใช้อยู่เข้มขึ้น */
  const themeSwitch = (
    <div
      className="flex min-h-[44px] items-center gap-1.5 px-1"
      title={theme === 'dark' ? 'ตอนนี้โหมดมืด' : 'ตอนนี้โหมดสว่าง'}
    >
      <Sun
        aria-hidden
        className={cn('h-4 w-4 transition-colors', theme === 'dark' ? 'text-muted-foreground/40' : 'text-amber-500')}
      />
      <Switch
        checked={theme === 'dark'}
        onCheckedChange={toggleTheme}
        aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
        className="data-[state=checked]:bg-slate-700 data-[state=unchecked]:bg-slate-300"
      />
      <Moon
        aria-hidden
        className={cn('h-4 w-4 transition-colors', theme === 'dark' ? 'text-sky-300' : 'text-muted-foreground/40')}
      />
    </div>
  );

  /**
   * สลับธีมแบบปุ่มเดียว — ใช้เฉพาะหัวเว็บจอเล็ก
   * ตัวเต็ม (Sun + Switch + Moon) กว้าง 108px ซึ่งกินที่จนปุ่มอื่นเบียดทับกันบนมือถือ
   * ตัวนี้กว้าง 44px เท่าเกณฑ์นิ้วโป้ง · ไอคอนบอก "กดแล้วจะไปโหมดไหน"
   */
  const themeSwitchCompact = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
      title={theme === 'dark' ? 'ตอนนี้โหมดมืด — กดเพื่อไปโหมดสว่าง' : 'ตอนนี้โหมดสว่าง — กดเพื่อไปโหมดมืด'}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10 hover:text-foreground touch-manipulation"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4 text-amber-500" />
      ) : (
        <Moon className="h-4 w-4 text-sky-600" />
      )}
    </button>
  );

  const hamburger = (
    <button
      type="button"
      onClick={() => setNavOpen(true)}
      aria-label="เปิดเมนู"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/60 dark:hover:bg-white/10 hover:text-foreground touch-manipulation"
    >
      <Menu className="h-5 w-5" />
    </button>
  );

  return (
    <div
      className={cn(
        'min-h-[100dvh] min-h-screen flex flex-col',
        config.pageBackgroundMode === 'solid' ? 'jarvis-warm-bg' : 'bg-background',
      )}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      <JobNotificationWatcher />
      {/* เตือนหัวหน้าทันทีเมื่อระบบถอดชื่อที่เก็บไว้แล้วไม่โทร (Phase 5.8) —
          อ่านจากกล่องขาเข้าที่ poll อยู่แล้ว ไม่ยิง query ใหม่ · เด้งครั้งเดียวต่อใบ */}
      <ClaimIdleAlertDialog />

      {/* Top header — จอใหญ่ (lg+) */}
      <header className="hidden lg:flex items-center justify-between gap-2 2xl:gap-4 px-3 xl:px-4 2xl:px-8 py-3 border-b border-white/60 bg-white/45 dark:border-white/10 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          {hamburger}
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 shrink-0">
            <BrandMark size="md" />
            <BrandTitle className="text-lg font-bold text-foreground truncate max-w-[220px]" />
          </button>
        </div>
        <div className="flex items-center gap-2 xl:gap-3 shrink-0">
          <NotificationPanel />
          <div className="hidden 2xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/55 border border-white/70 dark:bg-white/10 dark:border-white/15 max-w-[280px]">
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
          <div className="flex 2xl:hidden items-center gap-1.5 px-2 py-1 rounded-full bg-white/55 border border-white/70 dark:bg-white/10 dark:border-white/15">
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
          {themeSwitch}
          {/* ซ่อนเมื่อระบบล็อกให้เข้าทาง Microsoft (เจ้าของสั่ง 22 ส.ค. 2569)
              เงื่อนไขเดียวกับฟอร์มบนหน้า Login — อยู่ที่ shouldShowPasswordUi ที่เดียว
              🔴 หน้า /account/change-password กับ API ยังอยู่ครบ (ทางหนีไฟ) แค่ไม่มีทางเข้าจาก UI */}
          {showPasswordUi ? (
            <button
              type="button"
              onClick={() => navigate('/account/change-password')}
              className="p-2.5 rounded-full text-muted-foreground hover:text-blue-600 hover:bg-white/60 dark:hover:bg-white/10 transition-colors touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="เปลี่ยนรหัสผ่าน"
              title="เปลี่ยนรหัสผ่าน"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          ) : null}
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
      <header className="lg:hidden flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/60 bg-white/45 dark:border-white/10 dark:bg-slate-900/50 backdrop-blur-xl sticky top-0 z-40 safe-area-pt">
        <div className="flex items-center gap-1 min-w-0">
          {hamburger}
          <button type="button" onClick={() => navigate('/')} className="flex items-center gap-2 text-left min-w-0 touch-manipulation py-1">
            <BrandMark size="sm" />
            <BrandTitle className="text-base font-bold text-foreground truncate" />
          </button>
        </div>
        {/*
          จอเล็กใส่ได้เท่าที่พอจริง ๆ — เดิมยัด 5 ชิ้น (กระดิ่ง + ป้าย role + สลับธีมตัวเต็ม
          + กุญแจ + ออกจากระบบ) รวม 306px ในกลุ่มที่ `shrink-0` มันจึงไปบีบกลุ่มซ้าย
          (burger + โลโก้) ให้เหลือ 24px ทั้งที่ปุ่ม burger เองกว้าง 50px
          ผลคือ burger ทะลุออกไปซ้อนกับกระดิ่ง 17px และชื่อแอปหายทั้งอัน
          เกณฑ์เดิมต้องการจอกว้าง ~438px ขึ้นไปถึงจะไม่เบียด = มือถือทุกรุ่นพัง

          "เปลี่ยนรหัสผ่าน" กับ "ออกจากระบบ" **ย้ายเข้าเมนูข้าง ไม่ได้ตัดทิ้ง**
          (ออกจากระบบมีอยู่ในเมนูอยู่แล้ว · เปลี่ยนรหัสผ่านเพิ่มเข้าไปคู่กัน)
        */}
        <div className="flex items-center gap-1 shrink-0">
          <NotificationPanel />
          <span className="text-[10px] sm:text-xs px-2 py-1 rounded-full bg-[#141210] text-white font-medium uppercase">
            {user?.role}
          </span>
          {themeSwitchCompact}
        </div>
      </header>

      {/*
        โครงใหม่ (26 ส.ค. 2569): แถบสายพานติดซ้ายบนจอใหญ่ · จอเล็กยังใช้ drawer เดิม
        `items-start` สำคัญ — ไม่มีแล้ว sidebar `sticky` จะยืดเต็มความสูงแล้วไม่ติดตาม
      */}
      <div className="flex flex-1 items-start">
        <ConveyorSidebar />
        {/* lg ใช้ px-6 (เดิม px-8) — แถบเมนูกินที่ไปแล้ว ระยะขอบเท่าเดิมทำให้ตาราง
            ที่จูนไว้พอดีจอ (รอบสี่สิบหก) ตกขอบ · จอเล็กไม่มีแถบ จึงคงระยะเดิมไว้ */}
        <main className="relative min-w-0 flex-1 w-full max-w-[1920px] mx-auto px-4 sm:px-5 md:px-6 pb-8 pt-3 overflow-x-clip">
          <StageBanner />
          {children}
        </main>
      </div>

      <AppNavDrawer
        open={navOpen}
        onClose={() => setNavOpen(false)}
        items={navItems}
        showJobBoard={showJobBoardMenu}
        showSettings={showSettings}
        userName={user?.full_name}
        userRole={user?.role}
        onLogout={() => void logout()}
      />
    </div>
  );
};

export default AppLayout;
