import React from 'react';
import type { DashboardClosedBreakdown } from '@/lib/dashboard/types';

type Props = {
  breakdown: DashboardClosedBreakdown;
  closedTotal: number;
};

const DashboardClosedBreakdownCard: React.FC<Props> = ({ breakdown, closedTotal }) => {
  if (closedTotal <= 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-medium text-slate-600">รายละเอียดปิดใบงานในช่วง</p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg bg-emerald-50 px-3 py-2">
          <p className="text-xs text-emerald-800">ขอในช่วง + ปิดในช่วง</p>
          <p className="text-lg font-semibold text-emerald-900 tabular-nums">
            {breakdown.samePeriod.toLocaleString('th-TH')}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-600">ขอก่อนช่วง + ปิดในช่วง (backlog)</p>
          <p className="text-lg font-semibold text-slate-900 tabular-nums">
            {breakdown.backlog.toLocaleString('th-TH')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardClosedBreakdownCard;
