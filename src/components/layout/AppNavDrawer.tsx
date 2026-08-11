import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, ExternalLink, KeyRound, LayoutGrid, LogOut, Settings, X } from 'lucide-react';
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

  /**
   * "บอร์ดรับสมัคร" กับ "หน้าสมัครสาธารณะ" เคยเป็นสองแถวเรียงกันในเมนู ซึ่งอ่านแล้วดูเหมือน
   * เมนูซ้ำกันสองอัน (เจ้าของทัก 10 ส.ค. 2569) — ยุบเป็นหัวข้อเดียวที่กดกางเห็นทั้งสอง
   * เปิดค้างไว้ให้เองเมื่ออยู่ในบอร์ดอยู่แล้ว จะได้ไม่ต้องกดหาทุกครั้ง
   */
  const [boardOpen, setBoardOpen] = useState(() => location.pathname.startsWith('/jobs/board'));

  /**
   * "Matching" ใช้แพตเทิร์นเดียวกับบอร์ด (เจ้าของสั่ง 11 ส.ค. 2569) — หัวข้อเดียวกดกาง
   * เห็นทางเข้าทั้งสามของโมดูล แทนที่จะต้องเข้าหน้ารวม /matching แล้วกดต่ออีกที
   *
   * ⚠️ หัวข้อ**กางอย่างเดียว ไม่พาไปไหน** (เหมือนบอร์ด) ทางเข้าหน้า Matching จริงจึงต้อง
   * อยู่ในลูกด้วย ไม่งั้นกดเมนูแล้วไปหน้าจับคู่ไม่ได้เลย
   * ไม่ได้ตัดหน้ารวม /matching ทิ้ง — RoleHubPage กับลิงก์เก่ายังชี้ไปที่นั่นได้เหมือนเดิม
   */
  const [matchingOpen, setMatchingOpen] = useState(() =>
    location.pathname.startsWith('/matching') && !location.pathname.startsWith('/matching/candidates'),
  );

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
        ? 'bg-blue-500/12 text-blue-700 dark:bg-sky-400/15 dark:text-sky-200'
        : 'text-foreground/80 hover:bg-white/60 hover:text-foreground dark:hover:bg-white/10',
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
          'fixed inset-y-0 left-0 z-50 flex h-full w-[17rem] max-w-[85vw] flex-col border-r border-white/60 bg-white/85 shadow-2xl dark:border-slate-700/70 dark:bg-slate-900/90 backdrop-blur-xl transition-transform duration-250 ease-out safe-area-pt',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/60 px-4 py-3 dark:border-slate-700/70">
          <button type="button" onClick={() => go('/')} className="flex min-w-0 items-center gap-2">
            <BrandMark size="sm" />
            <BrandTitle className="truncate text-base font-bold text-foreground" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดเมนู"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/70 hover:text-foreground dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {userName ? (
          <div className="flex items-center gap-2 border-b border-white/50 px-4 py-2.5 dark:border-slate-700/70">
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

            // "Matching" เป็นหัวข้อกดกาง ไม่ใช่ปุ่มพาไปหน้า — ทางเข้าทั้งสามอยู่ในลูก
            if (item.path === '/matching') {
              const inMatching = isDockPathActive('/matching', location.pathname);
              const child = (path: string, label: string) => (
                <button
                  key={path}
                  type="button"
                  onClick={() => go(path)}
                  className={cn(rowClass(location.pathname.startsWith(path)), 'pl-10')}
                >
                  <span className="truncate">{label}</span>
                </button>
              );
              return [
                <button
                  key="matching-group"
                  type="button"
                  onClick={() => setMatchingOpen((v) => !v)}
                  aria-expanded={matchingOpen}
                  className={rowClass(inMatching)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0 transition-transform',
                      matchingOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>,
                ...(matchingOpen
                  ? [
                      child('/matching/match', 'จับคู่กับงาน'),
                      child('/matching/pre-check', 'Pre-Check'),
                      child('/matching/job-postings', 'คำขอโพสหางานใหม่'),
                    ]
                  : []),
              ];
            }

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
            // แทรกกลุ่ม "บอร์ดรับสมัคร" ต่อจาก "หน่วยงาน" — หัวข้อเดียว กดแล้วกางเห็น 2 ทางเข้า
            if (item.path === '/jobs/list' && showJobBoard) {
              const inBoard = location.pathname.startsWith('/jobs/board');
              rows.push(
                <button
                  key="board-group"
                  type="button"
                  onClick={() => setBoardOpen((v) => !v)}
                  aria-expanded={boardOpen}
                  className={rowClass(inBoard)}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span className="truncate">บอร์ดรับสมัคร</span>
                  <ChevronDown
                    className={cn(
                      'ml-auto h-4 w-4 shrink-0 transition-transform',
                      boardOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>,
              );
              if (boardOpen) {
                rows.push(
                  <button
                    key="/jobs/board"
                    type="button"
                    onClick={() => go('/jobs/board')}
                    className={cn(rowClass(inBoard), 'pl-10')}
                  >
                    <span className="truncate">เปิดบอร์ด</span>
                  </button>,
                  <button
                    key="apply-public"
                    type="button"
                    onClick={() => {
                      window.open('/apply', '_blank', 'noopener,noreferrer');
                      onClose();
                    }}
                    className={cn(rowClass(false), 'pl-10 text-muted-foreground')}
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    <span className="truncate">หน้าสมัครสาธารณะ (/apply)</span>
                  </button>,
                );
              }
            }
            return rows;
          })}
        </nav>

        <div className="space-y-1 border-t border-white/60 p-3 dark:border-slate-700/70">
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
          {/* ย้ายมาจากหัวเว็บ — จอมือถือใส่ปุ่มพวกนี้ไว้บนหัวไม่พอ ปุ่มจะเบียดทับกัน */}
          <button
            type="button"
            onClick={() => go('/account/change-password')}
            className={rowClass(location.pathname.startsWith('/account/change-password'))}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <span className="truncate">เปลี่ยนรหัสผ่าน</span>
          </button>
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
