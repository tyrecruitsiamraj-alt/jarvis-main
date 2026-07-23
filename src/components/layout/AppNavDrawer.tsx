import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ExternalLink, LayoutGrid, LogOut, Settings, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandMark, BrandTitle } from '@/components/shared/BrandMark';
import {
  isDockPathActive,
  resolveDockNavTarget,
  type DockNavItem,
} from '@/components/layout/bottom-nav/dockNavConfig';

type Props = {
  open: boolean;
  onClose: () => void;
  items: DockNavItem[];
  showJobBoard: boolean;
  showSettings: boolean;
  userName?: string;
  userRole?: string;
  onLogout: () => void;
};

/** เมนูนำทางหลักแบบ drawer เลื่อนออกจากซ้าย (ใช้เหมือนกันทั้งจอใหญ่และมือถือ) */
const AppNavDrawer: React.FC<Props> = ({
  open,
  onClose,
  items,
  showJobBoard,
  showSettings,
  userName,
  userRole,
  onLogout,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const go = (path: string) => {
    navigate(resolveDockNavTarget(path));
    onClose();
  };

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors touch-manipulation',
      active
        ? 'bg-blue-500/12 text-blue-700'
        : 'text-foreground/80 hover:bg-white/60 hover:text-foreground',
    );

  return (
    <>
      {/* overlay */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* panel */}
      <aside
        role="dialog"
        aria-label="เมนูหลัก"
        aria-modal={open}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-[17rem] max-w-[85vw] flex-col border-r border-white/60 bg-white/85 shadow-2xl backdrop-blur-xl transition-transform duration-250 ease-out safe-area-pt',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/60 px-4 py-3">
          <button type="button" onClick={() => go('/')} className="flex min-w-0 items-center gap-2">
            <BrandMark size="sm" />
            <BrandTitle className="truncate text-base font-bold text-foreground" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/70 hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userName ? (
          <div className="flex items-center gap-2 border-b border-white/50 px-4 py-2.5">
            <span className="truncate text-sm font-medium text-foreground">{userName}</span>
            {userRole ? (
              <span className="ml-auto rounded-full bg-[#141210] px-2 py-0.5 text-[10px] font-medium uppercase text-white">
                {userRole}
              </span>
            ) : null}
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="เมนูหลัก">
          {items.map((item) => {
            const Icon = item.icon;
            const rows = [
              <button
                key={item.path}
                type="button"
                onClick={() => go(item.path)}
                className={rowClass(isDockPathActive(item.path, location.pathname))}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>,
            ];
            // แทรก "บอร์ดรับสมัคร" ต่อจาก "หน่วยงาน"
            if (item.path === '/jobs/list' && showJobBoard) {
              rows.push(
                <button
                  key="/jobs/board"
                  type="button"
                  onClick={() => go('/jobs/board')}
                  className={rowClass(location.pathname.startsWith('/jobs/board'))}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="truncate">บอร์ดรับสมัคร</span>
                </button>,
                <button
                  key="apply-public"
                  type="button"
                  onClick={() => {
                    window.open('/apply', '_blank', 'noopener,noreferrer');
                    onClose();
                  }}
                  className={cn(rowClass(false), 'text-muted-foreground')}
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">หน้าสมัครสาธารณะ (/apply)</span>
                </button>,
              );
            }
            return rows;
          })}
        </nav>

        <div className="space-y-1 border-t border-white/60 p-3">
          {showSettings ? (
            <button
              type="button"
              onClick={() => go('/settings')}
              className={rowClass(location.pathname.startsWith('/settings'))}
            >
              <Settings className="h-4 w-4 shrink-0" />
              <span className="truncate">ตั้งค่า</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              onClose();
              onLogout();
            }}
            className={cn(rowClass(false), 'text-muted-foreground hover:text-destructive')}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate">ออกจากระบบ</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppNavDrawer;
