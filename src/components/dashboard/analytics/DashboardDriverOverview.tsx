import React from 'react';
import { cn } from '@/lib/utils';
import type { DashboardRecruiterOverview, DashboardResponsibleRole } from '@/lib/dashboard/types';

type Props = {
  items: DashboardRecruiterOverview[];
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
  hideHeader?: boolean;
};

const ROLE_LABELS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'สรรหา',
  screener: 'คัดสรร',
};

const ROLE_BADGE_CLASS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'bg-blue-50 text-blue-700',
  screener: 'bg-violet-50 text-violet-700',
};

const DashboardDriverOverview: React.FC<Props> = ({ items, onRecruiterClick, hideHeader = false }) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {!hideHeader ? (
          <h3 className="text-sm font-semibold text-slate-900 mb-2">ภาระงานตามผู้รับผิดชอบ</h3>
        ) : null}
        ยังไม่มีข้อมูลภาระงานตามผู้รับผิดชอบ
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hideHeader ? (
        <div>
          <h3 className="text-sm font-semibold text-slate-900">ภาระงานตามผู้รับผิดชอบ</h3>
          <p className="text-xs text-slate-500">มี · ปิด · คงเหลือ รายบุคคล (สรรหา / คัดสรร)</p>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.slice(0, 12).map((r) => (
          <button
            key={`${r.role}:${r.name}`}
            type="button"
            onClick={() => onRecruiterClick?.(r.name, r.role)}
            disabled={!onRecruiterClick}
            className={cn(
              'rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left w-full transition-colors',
              onRecruiterClick && 'hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer',
              !onRecruiterClick && 'cursor-default',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
                <span
                  className={cn(
                    'mt-1 inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium',
                    ROLE_BADGE_CLASS[r.role],
                  )}
                >
                  {ROLE_LABELS[r.role]}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-500 shrink-0">{r.sharePercent}%</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">{r.total}</p>
                <p className="text-[10px] text-slate-500">มี</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600 tabular-nums">{r.completed}</p>
                <p className="text-[10px] text-slate-500">ปิด</p>
              </div>
              <div>
                <p
                  className={
                    r.remaining > 0
                      ? 'text-lg font-semibold text-amber-600 tabular-nums'
                      : 'text-lg font-semibold text-slate-900 tabular-nums'
                  }
                >
                  {r.remaining}
                </p>
                <p className="text-[10px] text-slate-500">คงเหลือ</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardDriverOverview;
