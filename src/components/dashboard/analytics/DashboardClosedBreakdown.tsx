import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
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

  // สีบอกที่มาของยอด: ของงวดนี้ = โทนของ "หาได้แล้ว/ปิดครบ" · ของค้างเก่า = โทนของงานค้าง
  const cell = (label: string, value: number, toneKey: ToneKey, onClick?: () => void) => {
    const tone = TONE[toneKey];
    return (
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={cn('w-full rounded-lg px-3 py-2 text-left transition-colors', tone.tile)}
      >
        <p className={cn('text-xs', DASH.sub)}>{label}</p>
        <p className={cn('text-lg font-semibold tabular-nums', tone.num)}>{value.toLocaleString('th-TH')}</p>
      </button>
    );
  };

  return (
    <div className={cn(DASH.card, 'px-4 py-3 space-y-4')}>
      {filledTotal > 0 ? (
        <div>
          <p className={DASH.label}>หาได้แล้วในงวดนี้</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cell(
              'ของวดนี้ หาได้งวดนี้',
              breakdown.filledSamePeriod,
              'success',
              onFilledClick ? () => onFilledClick('same', 'ของวดนี้ หาได้งวดนี้') : undefined,
            )}
            {cell(
              'งานค้างเก่า หาได้งวดนี้',
              breakdown.filledBacklog,
              'neutral',
              onFilledClick ? () => onFilledClick('backlog', 'งานค้างเก่า หาได้งวดนี้') : undefined,
            )}
          </div>
        </div>
      ) : null}

      {fullyClosedTotal > 0 ? (
        <div>
          <p className={DASH.label}>ปิดครบใบขอในงวดนี้</p>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cell(
              'ของวดนี้ ปิดครบงวดนี้',
              breakdown.fullyClosedSamePeriod,
              'primary',
              onFullyClosedClick ? () => onFullyClosedClick('same', 'ของวดนี้ ปิดครบงวดนี้') : undefined,
            )}
            {cell(
              'งานค้างเก่า ปิดครบงวดนี้',
              breakdown.fullyClosedBacklog,
              'violet',
              onFullyClosedClick ? () => onFullyClosedClick('backlog', 'งานค้างเก่า ปิดครบงวดนี้') : undefined,
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardClosedBreakdownCard;
