import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
  requestTotal: number;
  positionTotal: number;
  onBucketClick?: (bucket: DashboardAgeDaysBreakdown['bucket'], label: string) => void;
};

/**
 * โทนสีต่อถังอายุ — ภาษาเดียวกับแถบสีบนหน้า Matching (เกณฑ์ที่เจ้าของกำหนด):
 * ล่วงหน้า = รอได้ · ≤7 วัน = ยังไม่ด่วน · 8–30 = เริ่มด่วน · 30+ = ด่วนมาก
 * จำนวน/นิยามถังไม่เปลี่ยน — เปลี่ยนเฉพาะการแสดงผลให้กวาดตาแล้วรู้ทันที
 */
const BUCKET_TONE: Record<
  DashboardAgeDaysBreakdown['bucket'],
  { urgency: string; tile: string; num: string; dot: string }
> = {
  advance: {
    urgency: 'รอได้',
    tile: 'bg-sky-50 hover:bg-sky-100/70 dark:bg-sky-950/60 dark:hover:bg-sky-950',
    num: 'text-sky-900 dark:text-sky-200',
    dot: 'bg-sky-400',
  },
  '1-7': {
    urgency: 'ยังไม่ด่วน',
    tile: 'bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/60 dark:hover:bg-emerald-950',
    num: 'text-emerald-900 dark:text-emerald-200',
    dot: 'bg-emerald-400',
  },
  '8-15': {
    urgency: 'เริ่มด่วน',
    tile: 'bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/60 dark:hover:bg-amber-950',
    num: 'text-amber-900 dark:text-amber-200',
    dot: 'bg-amber-400',
  },
  '16-30': {
    urgency: 'เริ่มด่วน',
    tile: 'bg-orange-50 hover:bg-orange-100/70 dark:bg-orange-950/60 dark:hover:bg-orange-950',
    num: 'text-orange-900 dark:text-orange-200',
    dot: 'bg-orange-400',
  },
  '30+': {
    urgency: 'ด่วนมาก',
    tile: 'bg-red-50 hover:bg-red-100/70 dark:bg-red-950/60 dark:hover:bg-red-950',
    num: 'text-red-900 dark:text-red-200',
    dot: 'bg-red-500',
  },
};

const DashboardAgeOverview: React.FC<Props> = ({ items, requestTotal, positionTotal, onBucketClick }) => {
  const bucketTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.count, 0),
    [items],
  );

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">งานไหนด่วนแค่ไหน · ตามวันที่ผ่านมา</h3>
        <p className="text-xs text-slate-400">
          รวม {bucketTotal.toLocaleString('th-TH')} ตำแหน่ง · {requestTotal.toLocaleString('th-TH')} ใบขอ
          {positionTotal !== bucketTotal
            ? ` · สต็อก ${positionTotal.toLocaleString('th-TH')} ตำแหน่ง`
            : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const tone = BUCKET_TONE[item.bucket];
          return (
            <button
              key={item.bucket}
              type="button"
              onClick={() => onBucketClick?.(item.bucket, item.label)}
              disabled={!onBucketClick || item.count === 0}
              className={cn(
                'rounded-2xl px-4 py-4 text-left transition-colors',
                tone.tile,
                onBucketClick && item.count > 0 && 'cursor-pointer',
                (!onBucketClick || item.count === 0) && 'cursor-default opacity-60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{tone.urgency}</span>
              </div>
              <p className={cn('mt-2 text-3xl font-semibold tracking-tight tabular-nums', tone.num)}>
                {item.count.toLocaleString('th-TH')}
              </p>
              <p className="mt-1 text-[11px] text-slate-500">
                {item.label} · ตำแหน่ง
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardAgeOverview;
