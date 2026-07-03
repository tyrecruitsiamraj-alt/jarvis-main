import React from 'react';
import type { DashboardRecruiterOverview } from '@/lib/dashboard/types';

type Props = {
  items: DashboardRecruiterOverview[];
};

const DashboardDriverOverview: React.FC<Props> = ({ items }) => {
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
        <p className="text-xs text-slate-500">ติดตามงานค้างและอัตราสำเร็จรายบุคคล</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.slice(0, 9).map((r) => (
          <div key={r.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 truncate">{r.name}</p>
              <span className="text-xs font-medium text-slate-500 shrink-0">{r.sharePercent}%</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-semibold text-slate-900 tabular-nums">{r.total}</p>
                <p className="text-[10px] text-slate-500">งาน</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-emerald-600 tabular-nums">{r.completed}</p>
                <p className="text-[10px] text-slate-500">สำเร็จ</p>
              </div>
              <div>
                <p className={r.overdue > 0 ? 'text-lg font-semibold text-red-600 tabular-nums' : 'text-lg font-semibold text-slate-900 tabular-nums'}>
                  {r.overdue}
                </p>
                <p className="text-[10px] text-slate-500">ล่าช้า</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardDriverOverview;
