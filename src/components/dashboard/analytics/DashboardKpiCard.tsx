import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { DashboardKpi } from '@/lib/dashboard/types';

type Props = {
  kpi: DashboardKpi;
};

const DashboardKpiCard: React.FC<Props> = ({ kpi }) => {
  const trend = kpi.trendPercent;
  const TrendIcon = trend == null || trend === 0 ? Minus : trend > 0 ? ArrowUp : ArrowDown;
  const trendColor =
    trend == null || trend === 0
      ? 'text-slate-400'
      : kpi.id === 'overdue'
        ? trend > 0
          ? 'text-red-600'
          : 'text-emerald-600'
        : trend > 0
          ? 'text-emerald-600'
          : 'text-red-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900 tabular-nums">
        {kpi.format === 'percent' ? `${kpi.value}%` : kpi.value.toLocaleString('th-TH')}
      </p>
      <p className="mt-1 text-xs text-slate-500">{kpi.description}</p>
      {trend != null ? (
        <div className={cn('mt-2 flex items-center gap-1 text-xs font-medium', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" aria-hidden />
          <span>
            {trend > 0 ? '+' : ''}
            {trend}% เทียบช่วงก่อน
          </span>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardKpiCard;
