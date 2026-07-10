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

const SERIES_LABELS: Record<string, string> = {
  requested: 'ขอมา (ตำแหน่ง)',
  closed: 'ปิดได้/หาได้แล้ว (ตำแหน่ง)',
  closeRate: 'อัตราสำเร็จ (%)',
};

const DashboardThroughputChart: React.FC<Props> = ({ data, periodLabel }) => {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        label: p.label,
        requested: p.requestedPositions ?? 0,
        closed: p.closedPositions ?? 0,
        closeRate: p.closeRatePercent ?? 0,
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

  const overallRate =
    totals.requested > 0 ? Math.round((totals.closed / totals.requested) * 1000) / 10 : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">ขอ vs ปิดรายเดือน</h3>
        <p className="text-xs text-slate-500">
          ตำแหน่งคงเหลือ · ย้อนหลัง=วันที่กรอก · ฉุกเฉิน/ล่วงหน้า=วันที่ต้องการ · {periodLabel}
        </p>
        <p className="text-xs text-slate-600 mt-1">
          รวมช่วง ขอ {totals.requested.toLocaleString('th-TH')} · ปิดได้{' '}
          {totals.closed.toLocaleString('th-TH')} · อัตราสำเร็จ {overallRate}%
        </p>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 'auto']}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === 'closeRate') return [`${value}%`, SERIES_LABELS[name] ?? name];
                return [value.toLocaleString('th-TH'), SERIES_LABELS[name] ?? name];
              }}
            />
            <Legend formatter={(value) => SERIES_LABELS[value] ?? value} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="requested"
              name="requested"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="closed"
              name="closed"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="closeRate"
              name="closeRate"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 4"
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
