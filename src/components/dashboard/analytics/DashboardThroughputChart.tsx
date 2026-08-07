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
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE } from '@/lib/designTokens';

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
    <div className={cn(DASH.card, 'p-4 xl:col-span-2')}>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          แนวโน้มรายเดือน — เข้ามา / ปิดแล้ว / ยกเลิก / คงเหลือ
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          นับเป็นอัตรา · ตามเดือนที่กรอก/เปิดใบ · เข้ามา/ปิด/ยกเลิกจาก cohort · คงเหลือ = ใบเปิดที่ต้องหา (เท่าการ์ดคงเหลือ) ·{' '}
          {periodLabel}
        </p>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
          รวมช่วง เข้ามา {totals.requested.toLocaleString('th-TH')} · ปิดแล้ว{' '}
          {totals.filled.toLocaleString('th-TH')} · ยกเลิก {totals.cancelled.toLocaleString('th-TH')} ·
          คงเหลือ {totals.remaining.toLocaleString('th-TH')}
          {totals.remaining > 0 ? ' (= การ์ดคงเหลือ)' : ''}
        </p>
      </div>
      {/* div ครอบพากสีตัวหนังสือ (DASH.sub) ไปให้แกนกราฟผ่าน currentColor — สลับตามธีมเอง */}
      <div className={cn('h-64', DASH.sub)}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <Tooltip
              {...CHART.tooltip}
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
              stroke={TONE.info.hex}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="filled"
              name="filled"
              stroke={TONE.success.hex}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="cancelled"
              name="cancelled"
              stroke={TONE.neutral.hex}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              name="remaining"
              stroke={TONE.warn.hex}
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
