import React from 'react';
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
import type { DashboardData } from '@/lib/dashboard/types';
import DashboardUnitOverviewChart from './DashboardUnitOverviewChart';

type Props = {
  data: Pick<DashboardData, 'activityTrend' | 'unitOverview' | 'periodLabel' | 'activityTrendLabel'>;
  onUnitClick?: (unitName: string) => void;
};

function sumPoint(p: DashboardData['activityTrend'][number]) {
  return p.resignations + p.replacements + p.newOpenings;
}

const DashboardChartSection: React.FC<Props> = ({ data, onUnitClick }) => {
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

  const currentMonth = activityData.length > 0 ? activityData[activityData.length - 1] : null;
  const previousMonth = activityData.length > 1 ? activityData[activityData.length - 2] : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">แนวโน้มรายเดือน — ลาออก / เปลี่ยนตัว / เปิดงานใหม่</h3>
            <p className="text-xs text-slate-500">{data.activityTrendLabel}</p>
            <p className="text-xs text-slate-600 mt-1">
              รวมปีนี้ {activityTotal} ใบ — ลาออก {periodTotals.resignations} · เปลี่ยนตัว{' '}
              {periodTotals.replacements} · เปิดงานใหม่ {periodTotals.newOpenings}
            </p>
            {currentMonth && previousMonth ? (
              <p className="text-xs text-slate-500 mt-1">
                {previousMonth.label}: {sumPoint(previousMonth)} ใบ → {currentMonth.label}:{' '}
                {sumPoint(currentMonth)} ใบ
                {sumPoint(previousMonth) > 0 ? (
                  <>
                    {' '}
                    (
                    {sumPoint(currentMonth) >= sumPoint(previousMonth) ? '+' : ''}
                    {Math.round(
                      ((sumPoint(currentMonth) - sumPoint(previousMonth)) / sumPoint(previousMonth)) *
                        100,
                    )}
                    % จากเดือนที่แล้ว)
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="resignations"
                  name="ลาออก"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="replacements"
                  name="เปลี่ยนตัว"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="newOpenings"
                  name="เปิดงานใหม่"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <DashboardUnitOverviewChart
          items={data.unitOverview}
          periodLabel={data.periodLabel}
          onUnitClick={onUnitClick}
        />
      </div>
    </div>
  );
};

export default DashboardChartSection;
