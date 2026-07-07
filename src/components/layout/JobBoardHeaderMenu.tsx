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

const JobBoardHeaderMenu: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const onBoard = location.pathname.startsWith('/jobs/board');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-medium transition-all touch-manipulation min-h-[44px]',
            onBoard
              ? 'bg-blue-500/12 text-blue-700'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/50',
          )}
          aria-label="บอร์ดรับสมัครงาน"
        >
          <LayoutGrid className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap hidden sm:inline">บอร์ดรับสมัคร</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground font-normal">
          เลือกมุมมองบอร์ดงาน
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/jobs/board')}
          className="rounded-lg px-2.5 py-2.5 cursor-pointer"
        >
          <LayoutGrid className="mr-2.5 h-4 w-4 text-blue-600" />
          <div>
            <p className="text-sm font-medium">บอร์ดเจ้าหน้าที่</p>
            <p className="text-[11px] text-muted-foreground">จัดการและดูรายละเอียดใบขอ</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.open('/apply', '_blank', 'noopener,noreferrer')}
          className="rounded-lg px-2.5 py-2.5 cursor-pointer"
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
