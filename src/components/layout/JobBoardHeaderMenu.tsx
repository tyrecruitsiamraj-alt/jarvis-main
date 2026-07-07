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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>บอร์ดรับสมัครงาน</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('/jobs/board')}>
          <LayoutGrid className="mr-2 h-4 w-4" />
          บอร์ดงานเจ้าหน้าที่
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => window.open('/apply', '_blank', 'noopener,noreferrer')}>
          <ExternalLink className="mr-2 h-4 w-4" />
          หน้าสมัครสาธารณะ (/apply)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default JobBoardHeaderMenu;
