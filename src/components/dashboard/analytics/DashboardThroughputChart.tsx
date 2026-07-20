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
  requested: 'เข้ามา',
  filled: 'ปิดแล้ว',
  cancelled: 'ยกเลิก',
  remaining: 'คงเหลือ',
};

const DashboardThroughputChart: React.FC<Props> = ({ data, periodLabel }) => {
  const chartData = useMemo(
    () =>
      data.map((p) => ({
        label: p.label,
        requested: p.requestedPositions ?? 0,
        filled: p.filledPositions ?? p.closedPositions ?? 0,
        cancelled: p.cancelledPositions ?? 0,
        remaining: p.remainingPositions ?? 0,
      })),
    [data],
  );

  const totals = useMemo(
    () =>
      chartData.reduce(
        (acc, p) => ({
          requested: acc.requested + p.requested,
          filled: acc.filled + p.filled,
          cancelled: acc.cancelled + p.cancelled,
          remaining: acc.remaining + p.remaining,
        }),
        { requested: 0, filled: 0, cancelled: 0, remaining: 0 },
      ),
    [chartData],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900">
          แนวโน้มรายเดือน — เข้ามา / ปิดแล้ว / ยกเลิก / คงเหลือ
        </h3>
        <p className="text-xs text-slate-500">
          นับเป็นอัตรา · ตามเดือนที่กรอก/เปิดใบ · เข้ามา/ปิด/ยกเลิกจาก cohort · คงเหลือ = ใบเปิดที่ต้องหา (เท่าการ์ดคงเหลือ) ·{' '}
          {periodLabel}
        </p>
        <p className="text-xs text-slate-600 mt-1">
          รวมช่วง เข้ามา {totals.requested.toLocaleString('th-TH')} · ปิดแล้ว{' '}
          {totals.filled.toLocaleString('th-TH')} · ยกเลิก {totals.cancelled.toLocaleString('th-TH')} ·
          คงเหลือ {totals.remaining.toLocaleString('th-TH')}
          {totals.remaining > 0 ? ' (= การ์ดคงเหลือ)' : ''}
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
                `${Number(value).toLocaleString('th-TH')} อัตรา`,
                SERIES_LABELS[name] ?? name,
              ]}
            />
            <Legend formatter={(value) => SERIES_LABELS[value] ?? value} />
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
              dataKey="filled"
              name="filled"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              name="cancelled"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              name="remaining"
              stroke="#f59e0b"
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
