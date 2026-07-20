import React from 'react';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { cn } from '@/lib/utils';

/**
 * เลย์เอาต์สำหรับผู้สมัครงานเท่านั้น — ไม่มีเมนูเข้าระบบภายใน
 */
const PublicApplyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);

  return (
    <div
      className={cn('min-h-screen flex flex-col jarvis-warm-bg relative overflow-hidden', config.pageBackgroundMode !== 'solid' && 'bg-background')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >
      <div className="jarvis-page-orb top-0 right-0 h-56 w-56 opacity-20" aria-hidden />

      <header className="sticky top-0 z-50 border-b border-white/60 bg-white/45 backdrop-blur-xl">
        <div className="mx-auto flex h-14 md:h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
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
        </div>
      </header>

      <div className="flex-1 relative z-10">{children}</div>

      <footer className="relative z-10 border-t border-white/60 bg-white/35 backdrop-blur-md py-6 text-center text-xs text-muted-foreground">
        <p className="px-4">
          หน้านี้สำหรับผู้สมัครงานเท่านั้น ข้อมูลตำแหน่งแสดงตามที่บริษัทประกาศ หากมีข้อสงสัยโปรดใช้ช่องทางสมัครที่ระบุ
        </p>
      </footer>
    </div>
  );
};

export default PublicApplyLayout;
