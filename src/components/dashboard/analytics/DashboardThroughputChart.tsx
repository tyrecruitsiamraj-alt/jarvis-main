import React, { useMemo } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardActivityTrendPoint } from '@/lib/dashboard/types';

type Props = {
  data: DashboardActivityTrendPoint[];
  periodLabel: string;
};

const DashboardThroughputChart: React.FC<Props> = ({ data, periodLabel }) => {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        label: p.label,
        requested: p.requestedPositions ?? 0,
        closed: p.closedPositions ?? 0,
      })),
    [data],
  );

  const totals = useMemo(
    () =>
      chartData.reduce(
        (acc, p) => ({
          requested: acc.requested + p.requested,
          closed: acc.closed + p.closed,
        }),
        { requested: 0, closed: 0 },
      ),
    [chartData],
  );

  if (totals.requested === 0 && totals.closed === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">ขอ vs ปิดรายเดือน</h3>
        <p className="text-xs text-slate-500">
          ตำแหน่งที่ขอ (ตามวันที่กรอก) เทียบปิดแล้วทุกประเภท — แจ้งเข้า / Stop / ยกเลิก · {periodLabel}
        </p>
        <p className="text-xs text-slate-600 mt-1">
          รวมปีนี้ ขอ {totals.requested.toLocaleString('th-TH')} · ปิด {totals.closed.toLocaleString('th-TH')} ตำแหน่ง
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip
              formatter={(value: number, name: string) => [
                value.toLocaleString('th-TH'),
                name === 'requested' ? 'ขอมา' : 'ปิดแล้ว',
              ]}
            />
            <Legend
              formatter={(value) => (value === 'requested' ? 'ขอมา (ตำแหน่ง)' : 'ปิดแล้ว (ตำแหน่ง)')}
            />
            <Line
              type="monotone"
              dataKey="requested"
              name="requested"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="closed"
              name="closed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DashboardThroughputChart;
