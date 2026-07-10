import React from 'react';
import type { DashboardSlaSummary } from '@/lib/dashboard/types';

type Props = {
  summary: DashboardSlaSummary;
  onBucketClick?: (bucket: string, label: string) => void;
};

const BUCKETS: { key: keyof DashboardSlaSummary; label: string; className: string }[] = [
  { key: 'onTrack', label: 'On track', className: 'bg-emerald-50 text-emerald-900' },
  { key: 'atRisk', label: 'At risk', className: 'bg-amber-50 text-amber-900' },
  { key: 'breached', label: 'Breached', className: 'bg-red-50 text-red-900' },
  { key: 'closedOnTime', label: 'Closed on time', className: 'bg-sky-50 text-sky-900' },
  { key: 'closedLate', label: 'Closed late', className: 'bg-orange-50 text-orange-900' },
];

const DashboardSlaSummaryCard: React.FC<Props> = ({ summary, onBucketClick }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
    <div className="flex items-center justify-between gap-2">
      <p className="text-xs font-medium text-slate-600">SLA — ใบขอที่ยังไม่ปิดครบ</p>
      <p className="text-xs text-slate-500">Breach rate {summary.breachRatePercent}%</p>
    </div>
    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {BUCKETS.map((b) => {
        const value = summary[b.key];
        if (typeof value !== 'number') return null;
        return (
          <button
            key={b.key}
            type="button"
            disabled={!onBucketClick}
            onClick={onBucketClick ? () => onBucketClick(b.key, b.label) : undefined}
            className={`rounded-lg px-3 py-2 text-left ${b.className} ${onBucketClick ? 'hover:opacity-90' : ''}`}
          >
            <p className="text-[11px] opacity-80">{b.label}</p>
            <p className="text-lg font-semibold tabular-nums">{value.toLocaleString('th-TH')}</p>
          </button>
        );
      })}
    </div>
  </div>
);

export default DashboardSlaSummaryCard;
