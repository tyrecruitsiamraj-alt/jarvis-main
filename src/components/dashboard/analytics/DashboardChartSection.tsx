import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardData } from '@/lib/dashboard/types';
import { formatYmdDmyBe } from '@/lib/dateTh';

type Props = {
  data: Pick<DashboardData, 'trend' | 'statusBreakdown' | 'resignationTrend' | 'periodLabel' | 'previousPeriodLabel'>;
};

const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const trendData = data.trend.map((p) => ({
    ...p,
    label: formatYmdDmyBe(p.date).slice(0, 5),
  }));

  const statusData = data.statusBreakdown.map((s) => ({
    name: s.label,
    count: s.count,
    fill: s.color,
  }));

  const resignData = data.resignationTrend.map((m) => ({
    name: m.label,
    ลาออก: m.resignations,
    ส่งคนแทน: m.replacements,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">แนวโน้มงานรายวัน</h3>
            <p className="text-xs text-slate-500">
              {data.periodLabel} เทียบ {data.previousPeriodLabel}
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="current" name="ช่วงนี้" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="previous" name="ช่วงก่อน" stroke="#94a3b8" strokeWidth={2} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
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

      {resignData.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">ลาออก vs ส่งคนแทน (รายเดือน)</h3>
            <p className="text-xs text-slate-500">ติดตามการเปลี่ยนตัวและความต้องการส่งคนแทน</p>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resignData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ลาออก" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ส่งคนแทน" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardChartSection;
