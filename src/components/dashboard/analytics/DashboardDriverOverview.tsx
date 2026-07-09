import React from 'react';
import { cn } from '@/lib/utils';
import type { DashboardRecruiterOverview, DashboardResponsibleRole } from '@/lib/dashboard/types';

type Props = {
  items: DashboardRecruiterOverview[];
  onRecruiterClick?: (name: string, role: DashboardResponsibleRole) => void;
};

const ROLE_LABELS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'สรรหา',
  screener: 'คัดสรร',
};

const ROLE_BADGE_CLASS: Record<DashboardResponsibleRole, string> = {
  recruiter: 'bg-blue-50 text-blue-700',
  screener: 'bg-violet-50 text-violet-700',
};

const DashboardDriverOverview: React.FC<Props> = ({ items, onRecruiterClick }) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        ยังไม่มีข้อมูลภาระงานตามผู้รับผิดชอบ
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">ภาระงานตามผู้รับผิดชอบ</h3>
        <p className="text-xs text-slate-500">ติดตามงานค้างและอัตราสำเร็จรายบุคคล (สรรหา / คัดสรร)</p>
      </div>
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
                <p className="text-[10px] text-slate-500">งาน</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600 tabular-nums">{r.completed}</p>
                <p className="text-[10px] text-slate-500">ปิดใบขอ</p>
              </div>
              <div>
                <p className={r.overdue > 0 ? 'text-lg font-semibold text-red-600 tabular-nums' : 'text-lg font-semibold text-slate-900 tabular-nums'}>
                  {r.overdue}
                </p>
                <p className="text-[10px] text-slate-500">ล่าช้า</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default DashboardDriverOverview;
