import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardData } from '@/lib/dashboard/types';

type Props = {
  data: Pick<DashboardData, 'activityTrend' | 'statusBreakdown' | 'periodLabel'>;
};

const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const activityData = data.activityTrend;

  const periodTotals = activityData.reduce(
    (acc, p) => ({
      resignations: acc.resignations + p.resignations,
      replacements: acc.replacements + p.replacements,
      newOpenings: acc.newOpenings + p.newOpenings,
    }),
    { resignations: 0, replacements: 0, newOpenings: 0 },
  );
  const activityTotal =
    periodTotals.resignations + periodTotals.replacements + periodTotals.newOpenings;

  const statusData = data.statusBreakdown.map((s) => ({
    name: s.label,
    count: s.count,
    fill: s.color,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">แนวโน้มรายเดือน — ลาออก / เปลี่ยนตัว / เปิดงานใหม่</h3>
            <p className="text-xs text-slate-500">{data.periodLabel}</p>
            <p className="text-xs text-slate-600 mt-1">
              รวมช่วงที่เลือก {activityTotal} ใบ — ลาออก {periodTotals.resignations} · เปลี่ยนตัว{' '}
              {periodTotals.replacements} · เปิดงานใหม่ {periodTotals.newOpenings}
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="resignations" name="ลาออก" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replacements" name="เปลี่ยนตัว" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="newOpenings" name="เปิดงานใหม่" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">สัดส่วนสถานะงาน</h3>
            <p className="text-xs text-slate-500">งานในช่วงที่เลือก</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Bar dataKey="count" name="จำนวน" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardChartSection;
