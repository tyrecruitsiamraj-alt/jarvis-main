import React from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardKpi } from '@/lib/dashboard/types';

type Props = {
  kpi: DashboardKpi;
  onClick?: () => void;
  /** 0–100 = โชว์แถบสัดส่วนเทียบ "เข้ามา" ใต้ตัวเลข (mockup rev.3) · null/ไม่ส่ง = ไม่มีแถบ */
  progressPercent?: number | null;
};

/**
 * ความหมายสีของ KPI — ตัวคลาสจริงมาจาก token กลาง (@/lib/designTokens) ที่นี่บอกแค่ว่า
 * ตัวเลขไหนหมายถึงอะไร: เข้ามา = ฟ้า · ปิดแล้ว/หาได้ = เขียว · ยกเลิก = เทา ·
 * คงเหลือ = เหลือง (ยังต้องหา) · เกินกำหนด = แดง
 * KPI สถานะทำงานที่ไม่อยู่ในนี้ = ขาวเรียบ ไม่แย่งสายตา
 */
const KPI_TONE: Record<string, ToneKey> = {
  total_requests: 'info',
  total: 'info',
  closed: 'success',
  completed: 'success',
  cancelled: 'neutral',
  remaining: 'warn',
  overdue: 'danger',
};

/**
 * KPI ที่ต้องลงมือวันนี้ = บล็อกสีอิ่ม (ตามรูป reference ที่เจ้าของส่งมา)
 * เติมชื่อเข้ามาที่นี่ได้ แต่อย่าให้เกิน 1-2 ตัวต่อหน้า ไม่งั้นจะไม่เหลือของที่เด่นจริง
 */
const KPI_SOLID_IDS = new Set(['overdue']);

const NEUTRAL_TILE = 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800';
const NEUTRAL_NUM = 'text-slate-900 dark:text-slate-100';

const DashboardKpiCard: React.FC<Props> = ({ kpi, onClick, progressPercent = null }) => {
  const trend = kpi.trendPercent;
  const TrendIcon = trend == null || trend === 0 ? Minus : trend > 0 ? ArrowUp : ArrowDown;
  const solid = KPI_SOLID_IDS.has(kpi.id);
  const toneKey = KPI_TONE[kpi.id];
  const tone = toneKey ? TONE[toneKey] : null;
  const trendColor =
    trend == null || trend === 0
      ? solid
        ? 'text-white/70'
        : 'text-slate-400'
      : solid
        ? 'text-white/90'
        : kpi.id === 'overdue'
          ? trend > 0
            ? 'text-red-600'
            : 'text-emerald-600'
          : trend > 0
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-red-600 dark:text-red-400';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full rounded-2xl p-4 text-left shadow-sm transition-colors',
        solid && tone ? tone.solid : (tone?.tile ?? NEUTRAL_TILE),
        onClick ? 'cursor-pointer' : 'cursor-default',
      )}
    >
      <p className={cn('text-xs font-medium', solid ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
        {kpi.label}
      </p>
      <p
        className={cn(
          'mt-1.5 text-2xl font-semibold tracking-tight tabular-nums',
          solid ? 'text-white' : (tone?.num ?? NEUTRAL_NUM),
        )}
      >
        {kpi.format === 'percent' ? `${kpi.value}%` : kpi.value.toLocaleString('th-TH')}
        {kpi.secondaryCount != null ? (
          <span
            className={cn('ml-1.5 text-sm font-normal', solid ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}
          >
            · {kpi.secondaryCount.toLocaleString('th-TH')} {kpi.secondaryLabel ?? 'ใบขอ'}
          </span>
        ) : null}
      </p>
      <p className={cn('mt-1 text-xs', solid ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
        {kpi.description}
      </p>
      {progressPercent != null ? (
        <div
          className={cn('mt-2 h-[5px] overflow-hidden rounded-full', solid ? 'bg-white/25' : 'bg-slate-900/10 dark:bg-white/10')}
          title={`${progressPercent}% ของเข้ามา`}
          aria-hidden
        >
          <span
            className={cn('block h-full rounded-full', solid ? 'bg-white/90' : (tone?.dot ?? 'bg-slate-400'))}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      ) : null}
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
