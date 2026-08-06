import React from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardSlaSummary } from '@/lib/dashboard/types';

type Props = {
  summary: DashboardSlaSummary;
  onBucketClick?: (bucket: string, label: string) => void;
};

/** ถัง SLA — ความหมายสีเดียวกับป้าย SLA ในตาราง (ทันกำหนด=เขียว · เสี่ยง=เหลือง · เกิน=แดง) */
const BUCKETS: { key: keyof DashboardSlaSummary; label: string; tone: ToneKey }[] = [
  { key: 'onTrack', label: 'On track', tone: 'success' },
  { key: 'atRisk', label: 'At risk', tone: 'warn' },
  { key: 'breached', label: 'Breached', tone: 'danger' },
  { key: 'closedOnTime', label: 'Closed on time', tone: 'info' },
  { key: 'closedLate', label: 'Closed late', tone: 'orange' },
];

const DashboardSlaSummaryCard: React.FC<Props> = ({ summary, onBucketClick }) => (
  <div className={cn(DASH.card, 'px-4 py-3')}>
    <div className="flex items-center justify-between gap-2">
      <p className={DASH.label}>SLA — ใบขอที่ยังไม่ปิดครบ</p>
      <p className={DASH.sub}>Breach rate {summary.breachRatePercent}%</p>
    </div>
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {BUCKETS.map((b) => {
        const value = summary[b.key];
        if (typeof value !== 'number') return null;
        const tone = TONE[b.tone];
        return (
          <button
            key={b.key}
            type="button"
            disabled={!onBucketClick}
            onClick={onBucketClick ? () => onBucketClick(b.key, b.label) : undefined}
            className={cn('rounded-lg px-3 py-2 text-left transition-colors', tone.tile)}
          >
            <p className={cn('text-[11px]', DASH.muted)}>{b.label}</p>
            <p className={cn('text-lg font-semibold tabular-nums', tone.num)}>
              {value.toLocaleString('th-TH')}
            </p>
          </button>
        );
      })}
    </div>
  </div>
);

export default DashboardSlaSummaryCard;
