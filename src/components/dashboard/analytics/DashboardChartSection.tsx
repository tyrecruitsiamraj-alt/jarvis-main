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
  data: Pick<DashboardData, 'activityTrend' | 'statusBreakdown' | 'periodLabel'>;
};

const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const activityData = data.activityTrend.map((p) => ({
    ...p,
    label: formatYmdDmyBe(p.date).slice(0, 5),
  }));

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
            <h3 className="text-sm font-semibold text-slate-900">แนวโน้มรายวัน — ลาออก / เปลี่ยนตัว / เปิดงานใหม่</h3>
            <p className="text-xs text-slate-500">{data.periodLabel}</p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="resignations" name="ลาออก" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="replacements" name="เปลี่ยนตัว" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="newOpenings" name="เปิดงานใหม่" stroke="#22c55e" strokeWidth={2} dot={false} />
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

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">สรุปประเภทงานในช่วง</h3>
            <p className="text-xs text-slate-500">รวมทั้งช่วงที่เลือก</p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  {
                    name: 'รวม',
                    ลาออก: activityData.reduce((s, p) => s + p.resignations, 0),
                    เปลี่ยนตัว: activityData.reduce((s, p) => s + p.replacements, 0),
                    เปิดงานใหม่: activityData.reduce((s, p) => s + p.newOpenings, 0),
                  },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ลาออก" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="เปลี่ยนตัว" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="เปิดงานใหม่" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardChartSection;
