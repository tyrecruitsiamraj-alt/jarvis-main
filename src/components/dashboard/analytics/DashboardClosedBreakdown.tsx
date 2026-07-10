import React from 'react';
import type { DashboardFulfillmentBreakdown } from '@/lib/dashboard/types';

type Props = {
  breakdown: DashboardFulfillmentBreakdown;
  filledTotal: number;
  fullyClosedTotal: number;
  onFilledClick?: (segment: 'same' | 'backlog', label: string) => void;
  onFullyClosedClick?: (segment: 'same' | 'backlog', label: string) => void;
};

const DashboardClosedBreakdownCard: React.FC<Props> = ({
  breakdown,
  filledTotal,
  fullyClosedTotal,
  onFilledClick,
  onFullyClosedClick,
}) => {
  if (filledTotal <= 0 && fullyClosedTotal <= 0) return null;

  const cell = (
    label: string,
    value: number,
    className: string,
    onClick?: () => void,
  ) => (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`rounded-lg px-3 py-2 text-left w-full ${className} ${onClick ? 'hover:opacity-90' : ''}`}
    >
      <p className="text-xs opacity-90">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString('th-TH')}</p>
    </button>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm space-y-4">
      {filledTotal > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-600">หาได้แล้วในงวดนี้</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cell(
              'ของวดนี้ หาได้งวดนี้',
              breakdown.filledSamePeriod,
              'bg-emerald-50 text-emerald-900',
              onFilledClick
                ? () => onFilledClick('same', 'ของวดนี้ หาได้งวดนี้')
                : undefined,
            )}
            {cell(
              'งานค้างเก่า หาได้งวดนี้',
              breakdown.filledBacklog,
              'bg-slate-50 text-slate-900',
              onFilledClick
                ? () => onFilledClick('backlog', 'งานค้างเก่า หาได้งวดนี้')
                : undefined,
            )}
          </div>
        </div>
      ) : null}

      {fullyClosedTotal > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-600">ปิดครบใบขอในงวดนี้</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cell(
              'ของวดนี้ ปิดครบงวดนี้',
              breakdown.fullyClosedSamePeriod,
              'bg-blue-50 text-blue-900',
              onFullyClosedClick
                ? () => onFullyClosedClick('same', 'ของวดนี้ ปิดครบงวดนี้')
                : undefined,
            )}
            {cell(
              'งานค้างเก่า ปิดครบงวดนี้',
              breakdown.fullyClosedBacklog,
              'bg-indigo-50 text-indigo-900',
              onFullyClosedClick
                ? () => onFullyClosedClick('backlog', 'งานค้างเก่า ปิดครบงวดนี้')
                : undefined,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardClosedBreakdownCard;
