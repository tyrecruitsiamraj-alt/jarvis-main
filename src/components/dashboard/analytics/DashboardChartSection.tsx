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
import DashboardThroughputChart from './DashboardThroughputChart';
import DashboardLifecycleBoard from './DashboardLifecycleBoard';

type Props = {
  data: Pick<
    DashboardData,
    'activityTrend' | 'activityTrendLabel' | 'lifecycleInsights' | 'lifecycleBoard' | 'periodLabel'
  >;
};

function sumPoint(p: DashboardData['activityTrend'][number]) {
  return (
    p.resignations +
    p.replacements +
    (p.increaseHeadcount ?? 0) +
    (p.newSite ?? 0) +
    (p.other ?? 0)
  );
}

const DashboardChartSection: React.FC<Props> = ({ data }) => {
  const activityData = data.activityTrend;

  const periodTotals = activityData.reduce(
    (acc, p) => ({
      resignations: acc.resignations + p.resignations,
      replacements: acc.replacements + p.replacements,
      increaseHeadcount: acc.increaseHeadcount + (p.increaseHeadcount ?? 0),
      newSite: acc.newSite + (p.newSite ?? 0),
      other: acc.other + (p.other ?? 0),
    }),
    { resignations: 0, replacements: 0, increaseHeadcount: 0, newSite: 0, other: 0 },
  );
  const activityTotal =
    periodTotals.resignations +
    periodTotals.replacements +
    periodTotals.increaseHeadcount +
    periodTotals.newSite +
    periodTotals.other;

  const currentMonth = activityData.length > 0 ? activityData[activityData.length - 1] : null;
  const previousMonth = activityData.length > 1 ? activityData[activityData.length - 2] : null;

  return (
    <div className="space-y-4">
      {data.lifecycleBoard ? (
        <DashboardLifecycleBoard board={data.lifecycleBoard} periodLabel={data.periodLabel} />
      ) : null}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <DashboardThroughputChart data={data.activityTrend} periodLabel={data.activityTrendLabel} />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-900">
              ประเภทใบขอคงเหลือ — ลาออก / เปลี่ยนตัว / เพิ่มอัตรา / เปิดไซต์
            </h3>
            <p className="text-xs text-slate-500">
              นับอัตราคงเหลือจากใบที่ยังเปิดอยู่ แยกตามประเภท · รวมต้องเท่าการ์ดคงเหลือ ·{' '}
              {data.activityTrendLabel}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              รวม {activityTotal} อัตรา — ลาออก {periodTotals.resignations} · เปลี่ยนตัว{' '}
              {periodTotals.replacements} · เพิ่มอัตรา {periodTotals.increaseHeadcount} · เปิดไซต์{' '}
              {periodTotals.newSite}
              {periodTotals.other > 0 ? ` · อื่นๆ ${periodTotals.other}` : ''}
            </p>
            {data.lifecycleInsights && data.lifecycleInsights.length > 0 ? (
              <ul className="text-xs text-slate-600 mt-2 space-y-0.5 list-disc list-inside">
                {data.lifecycleInsights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : null}
            {currentMonth && previousMonth ? (
              <p className="text-xs text-slate-500 mt-1">
                {previousMonth.label}: {sumPoint(previousMonth)} → {currentMonth.label}:{' '}
                {sumPoint(currentMonth)}
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
                  dataKey="increaseHeadcount"
                  name="เพิ่มอัตรา"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="newSite"
                  name="เปิดไซต์"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                {periodTotals.other > 0 ? (
                  <Line
                    type="monotone"
                    dataKey="other"
                    name="อื่นๆ"
                    stroke="#64748b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ) : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardChartSection;
