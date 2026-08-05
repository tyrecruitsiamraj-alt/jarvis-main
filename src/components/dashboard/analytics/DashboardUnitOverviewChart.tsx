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
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE } from '@/lib/designTokens';

type Props = {
  items: DashboardUnitOverview[];
  periodLabel: string;
  onSiteClick?: (siteCode: string | undefined, label: string) => void;
  hideHeader?: boolean;
};

function truncateLabel(name: string, max = 22): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

const BAR_ROW_PX = 30;
const CHART_MIN_HEIGHT = 224;
const CHART_MAX_HEIGHT = 720;

const DashboardUnitOverviewChart: React.FC<Props> = ({ items, periodLabel, onSiteClick, hideHeader = false }) => {
  const activeUnits = useMemo(() => items.filter((u) => u.open > 0), [items]);

  const chartData = useMemo(
    () =>
      activeUnits.map((u) => ({
        name: truncateLabel(u.name),
        fullName: u.name,
        siteCode: u.siteCode,
        unitName: u.unitName,
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
      <div className={cn(DASH.card, 'p-4 xl:col-span-2')}>
        {!hideHeader ? <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">ภาระงานตามรหัสไซต์</h3> : null}
        <p className={hideHeader ? 'text-sm text-slate-500 dark:text-slate-400' : 'mt-2 text-sm text-slate-500 dark:text-slate-400'}>
          ยังไม่มีข้อมูลไซต์ในช่วงที่เลือก
        </p>
      </div>
    );
  }

  return (
    <div className={cn(DASH.card, 'p-4 xl:col-span-2')}>
      {!hideHeader ? (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">ภาระงานตามรหัสไซต์</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            ตำแหน่งที่รอดำเนินการต่อรหัสไซต์ · {periodLabel}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
            รวมรอดำเนินการ {openTotal.toLocaleString('th-TH')} ตำแหน่ง ·{' '}
            {activeUnits.length.toLocaleString('th-TH')} ไซต์
          </p>
        </div>
      ) : null}
      <div
        className="overflow-y-auto overflow-x-hidden rounded-lg border border-slate-100 dark:border-slate-800"
        style={{ maxHeight: CHART_MAX_HEIGHT }}
      >
        {/* div ครอบพากสีตัวหนังสือไปให้แกนกราฟผ่าน currentColor — สลับตามธีมเอง */}
        <div className={DASH.sub} style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tick={{ fontSize: 11, fill: CHART.axisFill }}
            />
            <Tooltip
              {...CHART.tooltip}
              formatter={(value: number, key: string) => [
                value.toLocaleString('th-TH'),
                key === 'open' ? 'รอดำเนินการ' : key,
              ]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                if (!row) return '';
                const head = row.unitName ? `${row.fullName} · ${row.unitName}` : row.fullName;
                return `${head} · รวม ${row.total} · ล่าช้า ${row.overdue}`;
              }}
            />
            <Bar
              dataKey="open"
              name="รอดำเนินการ"
              fill={TONE.primary.hex}
              radius={[0, 4, 4, 0]}
              cursor={onSiteClick ? 'pointer' : 'default'}
              onClick={(entry) => {
                const row = entry?.payload as (typeof chartData)[number] | undefined;
                if (row && onSiteClick) onSiteClick(row.siteCode, row.fullName);
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
