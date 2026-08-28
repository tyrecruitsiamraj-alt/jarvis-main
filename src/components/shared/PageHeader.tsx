import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  /**
   * คำบนปุ่มย้อนกลับ — 🔴 **ลูกศรเปล่าไม่บอกว่ากลับไปไหน**
   * เจ้าของทัก 27 ส.ค. 2569 ว่ากดจากกล่องงานมาแล้วงงว่าอยู่ไหน ⇒ ปุ่มต้องมีคำ
   * ไม่ส่งมาก็ยังเป็นลูกศรเปล่าเหมือนเดิม (หน้าอื่นทั้งระบบไม่ต้องแก้)
   */
  backLabel?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backPath,
  backLabel,
  actions,
}) => {
  const navigate = useNavigate();

  return (
    /*
      จอเล็ก: ให้แถวตกบรรทัดได้ ไม่งั้นช่อง actions (ซึ่งเดิมเป็น `shrink-0`)
      จะดันตัวเองออกนอกจอ — เจอที่ /jobs/list บนจอ 320px ล้นออกไป 16px
      กระทบทุกหน้าที่ส่ง actions มา ไม่ใช่หน้าเดียว จึงแก้ที่ตัวกลางนี้
    */
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 md:px-6 py-4 md:py-5">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {backPath && (
          <button
            type="button"
            onClick={() => navigate(backPath)}
            aria-label={backLabel ? undefined : 'ย้อนกลับ'}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border border-transparent text-muted-foreground transition-all touch-manipulation hover:border-white/80 hover:bg-white/60 hover:text-foreground',
              backLabel ? 'px-3 py-2 text-sm font-medium' : 'p-2.5',
            )}
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            {backLabel ? <span className="whitespace-nowrap">{backLabel}</span> : null}
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
};

export default PageHeader;
