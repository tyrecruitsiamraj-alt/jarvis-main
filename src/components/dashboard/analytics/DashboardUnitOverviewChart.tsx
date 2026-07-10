import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardUnitOverview } from '@/lib/dashboard/types';

type Props = {
  items: DashboardUnitOverview[];
  periodLabel: string;
  onUnitClick?: (unitName: string) => void;
  hideHeader?: boolean;
};

function truncateLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const BAR_ROW_PX = 30;
const CHART_MIN_HEIGHT = 224;
const CHART_MAX_HEIGHT = 720;

const DashboardUnitOverviewChart: React.FC<Props> = ({ items, periodLabel, onUnitClick, hideHeader = false }) => {
  const activeUnits = useMemo(() => items.filter((u) => u.open > 0), [items]);

  const chartData = useMemo(
    () =>
      activeUnits.map((u) => ({
        name: truncateLabel(u.name),
        fullName: u.name,
        open: u.open,
        total: u.total,
        overdue: u.overdue,
      })),
    [activeUnits],
  );

  const openTotal = useMemo(() => activeUnits.reduce((s, u) => s + u.open, 0), [activeUnits]);

  const chartHeight = Math.max(CHART_MIN_HEIGHT, chartData.length * BAR_ROW_PX + 48);

  if (activeUnits.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        {!hideHeader ? <h3 className="text-sm font-semibold text-slate-900">ภาระงานตามหน่วยงาน</h3> : null}
        <p className={hideHeader ? 'text-sm text-slate-500' : 'mt-2 text-sm text-slate-500'}>
          ยังไม่มีข้อมูลหน่วยงานในช่วงที่เลือก
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
      {!hideHeader ? (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">ภาระงานตามหน่วยงาน</h3>
          <p className="text-xs text-slate-500">
            ตำแหน่งที่รอดำเนินการต่อหน่วยงาน · {periodLabel}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            รวมรอดำเนินการ {openTotal.toLocaleString('th-TH')} ตำแหน่ง ·{' '}
            {activeUnits.length.toLocaleString('th-TH')} หน่วยงาน
          </p>
        </div>
      ) : null}
      <div
        className="overflow-y-auto overflow-x-hidden rounded-lg border border-slate-100"
        style={{ maxHeight: CHART_MAX_HEIGHT }}
      >
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <Tooltip
              formatter={(value: number, key: string) => [
                value.toLocaleString('th-TH'),
                key === 'open' ? 'รอดำเนินการ' : key,
              ]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return '';
                return `${row.fullName} · รวม ${row.total} · ล่าช้า ${row.overdue}`;
              }}
            />
            <Bar
              dataKey="open"
              name="รอดำเนินการ"
              fill="#3b82f6"
              radius={[0, 4, 4, 0]}
              cursor={onUnitClick ? 'pointer' : 'default'}
              onClick={(entry) => {
                const row = entry?.payload as (typeof chartData)[number] | undefined;
                if (row && onUnitClick) onUnitClick(row.fullName);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardUnitOverviewChart;
