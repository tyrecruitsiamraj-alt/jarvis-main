import React from 'react';
import { Link } from 'react-router-dom';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { cn } from '@/lib/utils';
import { LogIn } from 'lucide-react';

/**
 * เลย์เอาต์สำหรับผู้สมัครงานเท่านั้น — ไม่มีเมนูเข้าระบบภายใน
 */
const PublicApplyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);

  return (
    <div
      className={cn('min-h-screen flex flex-col', config.pageBackgroundMode === 'solid' && 'bg-background')}
      style={shellBg}
    >
      <header className="sticky top-0 z-50 border-b border-border/80 bg-card/80 backdrop-blur-md supports-[backdrop-filter]:bg-card/70">
        <div className="mx-auto flex h-14 md:h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" className="md:hidden" />
            <BrandMark size="md" className="hidden md:flex" />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs font-medium uppercase tracking-widest text-muted-foreground">
                รับสมัครงาน
              </p>
              <BrandTitle className="truncate text-base md:text-lg font-semibold text-foreground tracking-tight" />
            </div>
          </div>
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-secondary/80 px-3 py-2 text-xs md:text-sm font-medium text-foreground transition-colors hover:bg-secondary hover:border-primary/30"
          >
            <LogIn className="h-4 w-4 text-primary" />
            <span className="hidden sm:inline">เข้าระบบพนักงาน</span>
            <span className="sm:hidden">พนักงาน</span>
          </Link>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border/80 bg-card/40 py-6 text-center text-xs text-muted-foreground">
        <p className="px-4">
          หน้านี้สำหรับผู้สมัครงานเท่านั้น ข้อมูลตำแหน่งแสดงตามที่บริษัทประกาศ หากมีข้อสงสัยโปรดใช้ช่องทางสมัครที่ระบุ
        </p>
      </footer>
    </div>
  );
};

export default PublicApplyLayout;
