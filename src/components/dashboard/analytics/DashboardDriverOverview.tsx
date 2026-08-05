import React from 'react';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { DashboardRecruiterOverview, DashboardResponsibleRole } from '@/lib/dashboard/types';

type Props = {
  items: DashboardRecruiterOverview[];
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
  hideHeader?: boolean;
  /**
   * โหมด "ทั้งหมด" ไม่ดึงชุดใบปิด (ใช้ throughput แทน) — ยอด "ปิด" จึงยังไม่รู้ ไม่ใช่ศูนย์
   * false = โชว์ "—" แทนเลข 0 เพื่อไม่ให้อ่านว่าคนนั้นปิดงานไม่ได้เลย
   */
  closedTotalsAvailable?: boolean;
};

const ROLE_LABELS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'สรรหา',
  screener: 'คัดสรร',
};

const ROLE_BADGE_CLASS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
  screener: 'bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300',
};

const DashboardDriverOverview: React.FC<Props> = ({
  items,
  onRecruiterClick,
  hideHeader = false,
  closedTotalsAvailable = true,
}) => {
  if (items.length === 0) {
    return (
      <div className={cn(DASH.card, 'p-6 text-sm', DASH.sub)}>
        {!hideHeader ? (
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">ภาระงานตามผู้รับผิดชอบ</h3>
        ) : null}
        ยังไม่มีข้อมูลภาระงานตามผู้รับผิดชอบ
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">ภาระงานตามผู้รับผิดชอบ</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">มี · ปิด · คงเหลือ รายบุคคล (สรรหา / คัดสรร)</p>
        </div>
      ) : null}
      {!closedTotalsAvailable ? (
        <p className="rounded-lg bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
          ยอด <span className="font-medium">ปิด</span> ยังไม่ได้ดึงในโหมด "ทั้งหมด" — เลือกช่วงเวลาก่อนจึงจะเห็นยอดปิดต่อคน
        </p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.slice(0, 12).map((r) => (
          <button
            key={`${r.role}:${r.name}`}
            type="button"
            onClick={() => onRecruiterClick?.(r.name, r.role)}
            disabled={!onRecruiterClick}
            className={cn(
              DASH.card,
              'p-4 text-left w-full transition-colors',
              onRecruiterClick && 'hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer',
              !onRecruiterClick && 'cursor-default',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{r.name}</p>
                <span
                  className={cn(
                    'mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
                    ROLE_BADGE_CLASS[r.role],
                  )}
                >
                  {ROLE_LABELS[r.role]}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{r.sharePercent}%</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">{r.total}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">มี</p>
              </div>
              <div>
                {closedTotalsAvailable ? (
                  <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{r.completed}</p>
                ) : (
                  <p
                    className="text-lg font-semibold text-slate-300 dark:text-slate-600 tabular-nums"
                    title="ยังไม่รู้ — เลือกช่วงเวลาเพื่อดูยอดปิด"
                  >
                    —
                  </p>
                )}
                <p className="text-[10px] text-slate-500 dark:text-slate-400">ปิด</p>
              </div>
              <div>
                <p
                  className={
                    r.remaining > 0
                      ? 'text-lg font-semibold text-amber-600 dark:text-amber-400 tabular-nums'
                      : 'text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums'
                  }
                >
                  {r.remaining}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">คงเหลือ</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardDriverOverview;
