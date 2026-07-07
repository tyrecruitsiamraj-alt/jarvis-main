import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LayoutGrid } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Props = {
  /** ในแถบเมนูหลัก (desktop) หรือปุ่มไอคอนแบบกะทัดรัด (mobile header) */
  variant?: 'nav' | 'compact';
};

const JobBoardHeaderMenu: React.FC<Props> = ({ variant = 'nav' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const onBoard = location.pathname.startsWith('/jobs/board');
  const isCompact = variant === 'compact';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            isCompact
              ? 'relative flex items-center justify-center rounded-lg p-2.5 text-muted-foreground transition-colors touch-manipulation min-h-[44px] min-w-[44px] hover:text-foreground hover:bg-secondary'
              : 'flex items-center gap-1.5 xl:gap-2 px-2.5 xl:px-3 py-2 rounded-lg text-xs xl:text-sm font-medium transition-all touch-manipulation',
            onBoard &&
              (isCompact
                ? 'bg-blue-500/12 text-blue-700 hover:bg-blue-500/12'
                : 'bg-blue-500/12 text-blue-700'),
            !onBoard && !isCompact && 'text-muted-foreground hover:text-foreground hover:bg-white/50',
          )}
          aria-label="บอร์ดรับสมัครงาน"
          title="บอร์ดรับสมัครงาน"
        >
          <LayoutGrid className={cn('shrink-0', isCompact ? 'h-5 w-5' : 'h-4 w-4')} />
          {!isCompact ? <span className="whitespace-nowrap">บอร์ดรับสมัคร</span> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={isCompact ? 'end' : 'start'} className="w-60 rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs font-normal text-muted-foreground">
          เลือกมุมมองบอร์ดงาน
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/jobs/board')}
          className="cursor-pointer rounded-lg px-2.5 py-2.5"
        >
          <LayoutGrid className="mr-2.5 h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-medium">บอร์ดเจ้าหน้าที่</p>
            <p className="text-[11px] text-muted-foreground">จัดการและดูรายละเอียดใบขอ</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open('/apply', '_blank', 'noopener,noreferrer')}
          className="cursor-pointer rounded-lg px-2.5 py-2.5"
        >
          <ExternalLink className="mr-2.5 h-4 w-4 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">หน้าสมัครสาธารณะ</p>
            <p className="text-[11px] text-muted-foreground">มุมมองผู้สมัคร /apply</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default JobBoardHeaderMenu;
