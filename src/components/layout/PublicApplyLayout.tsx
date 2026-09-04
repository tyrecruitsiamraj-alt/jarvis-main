import React, { useEffect } from 'react';
import { useBranding } from '@/contexts/BrandingContext';
import { getAppShellBackgroundStyle } from '@/lib/brandingStorage';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import { cn } from '@/lib/utils';
import { isEmbedMode, startEmbedHeightReporter } from '@/lib/embedMode';

/**
 * เลย์เอาต์สำหรับผู้สมัครงานเท่านั้น — ไม่มีเมนูเข้าระบบภายใน
 */
const PublicApplyLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { config } = useBranding();
  const shellBg = getAppShellBackgroundStyle(config);
  /**
   * 🔴 โหมดฝัง `?embed=1` (เจ้าของถาม 3 ก.ย. 2569 ว่าเอาหน้าสาธารณะไปทำ iframe ได้ไหม)
   * ตัด **หัว-ท้าย-พื้นหลัง** ของเราออก เหลือแต่เนื้อในให้กลืนกับหน้าที่เอาไปวาง
   * ⚠️ เนื้อหา/ปุ่มสมัคร/ตัวกรอง ยังครบเหมือนเดิมทุกอย่าง
   */
  const embed = isEmbedMode();

  useEffect(() => startEmbedHeightReporter(), []);

  if (embed) {
    return <div className="min-h-screen bg-transparent">{children}</div>;
  }

  return (
    <div
      className={cn('min-h-screen flex flex-col jarvis-warm-bg relative overflow-hidden', config.pageBackgroundMode !== 'solid' && 'bg-background')}
      style={config.pageBackgroundMode !== 'solid' ? shellBg : undefined}
    >

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
