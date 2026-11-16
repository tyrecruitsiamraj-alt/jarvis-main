import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RECRUIT_TOPIC_WORDS as W } from '@/lib/uiWords';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { BuBar } from '@/lib/recruitTopics';
import { useGrown } from '../stuck/GrowBar';

/**
 * กราฟเทียบ BU ของเรื่องที่เลือก (เจ้าของ 16 พ.ย. 2569 "ทั้งหมดมันต้องเทียบเป็น Bu ให้ดู") — แท่งยาวตามยอด แบ่งก้อนสีตามสมการ
 * กดแถว = เลือก BU ทางขวา · BU ไม่มีข้อมูลยังขึ้นแถว 0 (ว่างห้ามหาย) · `meta` = บรรทัดใต้แท่ง (ยอด + เทียบช่วงก่อน)
 */
export default function TopicBuBars({
  title,
  sub,
  bars,
  selected,
  onSelect,
  meta,
  loading = false,
}: {
  title: string;
  sub?: React.ReactNode;
  bars: readonly BuBar[] | null;
  selected: string | null;
  onSelect: (bu: string) => void;
  meta?: (b: BuBar) => React.ReactNode;
  loading?: boolean;
}) {
  const grown = useGrown();
  const max = Math.max(1, ...(bars ?? []).map((b) => b.total));
  const legend = bars?.find((b) => !b.unavailable)?.parts ?? [];
  return (
    <div className="min-w-0 space-y-3" data-testid="topic-bu-bars">
      <div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {sub ? <p className={cn('text-xs', DASH.sub)}>{sub}</p> : null}
      </div>
      {legend.length > 1 ? (
        <div className={cn('flex flex-wrap gap-x-3 gap-y-1 text-xs', DASH.sub)}>
          {legend.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className={cn('size-2.5 rounded-sm', TONE[p.tone].dot)} aria-hidden />
              {p.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        {(bars ?? []).map((b) => {
          const on = b.bu === selected;
          return (
            <Button
              key={b.bu}
              type="button"
              variant="ghost"
              aria-pressed={on}
              onClick={() => onSelect(b.bu)}
              className={cn(
                'grid h-auto w-full grid-cols-[3rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 whitespace-normal rounded-xl border px-3 py-2 text-left font-normal',
                on ? 'border-primary bg-muted' : 'border-transparent',
              )}
              data-testid={`topic-bu-${b.bu}`}
            >
              <span className="font-medium text-foreground">{b.bu}</span>
              <span className="flex h-3 overflow-hidden rounded-full bg-muted" style={{ width: `${grown ? Math.max(b.total ? 2 : 0, (b.total / max) * 100) : 0}%` }}>
                {b.parts
                  .filter((p) => p.value > 0)
                  .map((p) => (
                    <span key={p.key} className={cn('block h-full', TONE[p.tone].dot)} style={{ width: `${(p.value / b.total) * 100}%` }} title={`${p.label} ${fmt(p.value)}`} />
                  ))}
              </span>
              <span className={cn('col-start-2 flex min-w-0 flex-wrap break-words gap-x-3 text-xs tabular-nums', DASH.sub)}>{meta ? meta(b) : <span>รวม {fmt(b.total)}</span>}</span>
            </Button>
          );
        })}
        <p className={cn('min-h-4 text-xs', DASH.sub)} aria-live="polite">{loading ? W.loading : '\u00a0'}</p>
      </div>
    </div>
  );
}
