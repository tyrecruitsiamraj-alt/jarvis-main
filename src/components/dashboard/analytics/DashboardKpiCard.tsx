import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { DashboardKpi } from '@/lib/dashboard/types';

type Props = {
  kpi: DashboardKpi;
  onClick?: () => void;
};

/**
 * โทนพาสเทลต่อ KPI — ตามความหมายของตัวเลข (ล็อกความหมายสีเดียวกับทั้งระบบ):
 * เข้ามา = ฟ้า · ปิดแล้ว = เขียว · ยกเลิก = เทา · คงเหลือ = เหลือง (งานที่ยังค้าง)
 * KPI สถานะทำงานอื่น ๆ = ขาวเรียบ ไม่แย่งสายตา
 */
const KPI_TONE: Record<string, { tile: string; num: string }> = {
  total_requests: { tile: 'bg-sky-50 hover:bg-sky-100/70 dark:bg-sky-950/60 dark:hover:bg-sky-950', num: 'text-sky-900 dark:text-sky-200' },
  closed: { tile: 'bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-950', num: 'text-emerald-900 dark:text-emerald-200' },
  cancelled: { tile: 'bg-slate-100/80 hover:bg-slate-200/60 dark:bg-slate-800/70 dark:hover:bg-slate-800', num: 'text-slate-700 dark:text-slate-300' },
  remaining: { tile: 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/60 dark:hover:bg-amber-950', num: 'text-amber-900 dark:text-amber-200' },
  overdue: { tile: 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/60 dark:hover:bg-red-950', num: 'text-red-900 dark:text-red-200' },
};

const DashboardKpiCard: React.FC<Props> = ({ kpi, onClick }) => {
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
  const tone = KPI_TONE[kpi.id] ?? { tile: 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800', num: 'text-slate-900 dark:text-slate-100' };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full rounded-2xl p-4 text-left shadow-sm transition-colors',
        tone.tile,
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
      <p className={cn('mt-1.5 text-2xl font-semibold tracking-tight tabular-nums', tone.num)}>
        {kpi.format === 'percent' ? `${kpi.value}%` : kpi.value.toLocaleString('th-TH')}
        {kpi.secondaryCount != null ? (
          <span className="ml-1.5 text-sm font-normal text-slate-500">
            · {kpi.secondaryCount.toLocaleString('th-TH')} {kpi.secondaryLabel ?? 'ใบขอ'}
          </span>
        ) : null}
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
    </button>
  );
};

export default DashboardKpiCard;
