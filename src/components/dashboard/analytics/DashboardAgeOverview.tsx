import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import type { DashboardAgeDaysBreakdown } from '@/lib/dashboard/types';

type Props = {
  items: DashboardAgeDaysBreakdown[];
  requestTotal: number;
  positionTotal: number;
  onBucketClick?: (bucket: DashboardAgeDaysBreakdown['bucket'], label: string) => void;
};

/**
 * ความหมายของแต่ละถังอายุ — สีจริงมาจาก token กลาง (@/lib/designTokens)
 * เกณฑ์ที่เจ้าของกำหนด: ล่วงหน้า = รอได้ · ≤7 วัน = ยังไม่ด่วน · 8–30 = เริ่มด่วน · 30+ = ด่วนมาก
 * จำนวน/นิยามถังไม่เปลี่ยน — เปลี่ยนเฉพาะการแสดงผลให้กวาดตาแล้วรู้ทันที
 * ถัง 30+ เป็น "บล็อกสีอิ่ม" ตัวเดียวของหน้านี้ (ตามรูป reference: เลขที่ต้องลงมือวันนี้ต้องกระโดดออกมา)
 */
const BUCKET_TONE: Record<DashboardAgeDaysBreakdown['bucket'], { urgency: string; tone: ToneKey; solid?: true }> = {
  advance: { urgency: 'รอได้', tone: 'info' },
  '1-7': { urgency: 'ยังไม่ด่วน', tone: 'success' },
  '8-15': { urgency: 'เริ่มด่วน', tone: 'warn' },
  '16-30': { urgency: 'เริ่มด่วน', tone: 'orange' },
  '30+': { urgency: 'ด่วนมาก', tone: 'danger', solid: true },
};

const DashboardAgeOverview: React.FC<Props> = ({ items, requestTotal, positionTotal, onBucketClick }) => {
  const bucketTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.count, 0),
    [items],
  );

  return (
    <div className={cn(DASH.cardLg, 'p-5')}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={DASH.title}>งานไหนด่วนแค่ไหน · ตามวันที่ผ่านมา</h3>
        <p className={DASH.sub}>
          รวม {bucketTotal.toLocaleString('th-TH')} ตำแหน่ง · {requestTotal.toLocaleString('th-TH')} ใบขอ
          {positionTotal !== bucketTotal
            ? ` · สต็อก ${positionTotal.toLocaleString('th-TH')} ตำแหน่ง`
            : ''}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => {
          const meta = BUCKET_TONE[item.bucket];
          const tone = TONE[meta.tone];
          const solid = meta.solid === true;
          return (
            <button
              key={item.bucket}
              type="button"
              onClick={() => onBucketClick?.(item.bucket, item.label)}
              disabled={!onBucketClick || item.count === 0}
              className={cn(
                'rounded-2xl px-4 py-4 text-left transition-colors',
                solid ? tone.solid : tone.tile,
                onBucketClick && item.count > 0 && 'cursor-pointer',
                (!onBucketClick || item.count === 0) && 'cursor-default opacity-60',
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 rounded-full', solid ? 'bg-white/80' : tone.dot)} aria-hidden />
                <span
                  className={cn(
                    'text-xs font-semibold',
                    solid ? 'text-white' : 'text-slate-700 dark:text-slate-200',
                  )}
                >
                  {meta.urgency}
                </span>
              </div>
              <p
                className={cn(
                  'mt-2 text-3xl font-semibold tracking-tight tabular-nums',
                  solid ? 'text-white' : tone.num,
                )}
              >
                {item.count.toLocaleString('th-TH')}
              </p>
              <p className={cn('mt-1 text-[11px]', solid ? 'text-white/80' : 'text-slate-500 dark:text-slate-400')}>
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
