import React from 'react';
import type { DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
};

const DashboardAgeOverview: React.FC<Props> = ({ items }) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">สถานะใบขอ / วันผ่านมา</h3>
        <p className="text-xs text-slate-500">
          ล่วงหน้า = ยังไม่ถึงวันที่ต้องการ · ช่องอื่นนับวันผ่านมาตั้งแต่กรอก (รวมแล้วเท่าทั้งหมด)
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
