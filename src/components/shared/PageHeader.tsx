import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  actions?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, backPath, actions }) => {
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
            className="p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/60 border border-transparent hover:border-white/80 transition-all touch-manipulation"
          >
            <ArrowLeft className="w-5 h-5" />
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
