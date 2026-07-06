import React from 'react';
import type { DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
};

const DashboardAgeOverview: React.FC<Props> = ({ items }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">วันผ่านมา (ใบขอฉุกเฉิน/ย้อนหลัง)</h3>
        <p className="text-xs text-slate-500">จำนวนใบขอตามช่วงวันที่กรอกมาแล้ว — ไม่รวมงานล่วงหน้า</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => (
          <div
            key={item.bucket}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-center"
          >
            <p className="text-xs font-medium text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
              {item.count.toLocaleString('th-TH')}
            </p>
            <p className="text-[11px] text-slate-400">ใบ</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardAgeOverview;
