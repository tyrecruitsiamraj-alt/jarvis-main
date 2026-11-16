import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { formatYmdTh } from '@/lib/dateTh';
import type { TopicPart } from '@/lib/recruitTopics';
import { useGrown } from '../stuck/GrowBar';
import TopicEquation from './TopicEquation';
import TrendDelta from '../stuck/TrendDelta';

export type TimeMonth = { month: string; label: string; value: number | null };
export type TimeDay = { day: string; parts: TopicPart[] };

/**
 * ═══ กราฟเวลาของเรื่องที่เลือก (เจ้าของ 16 พ.ย. 2569) ═══
 * > *"การเปรียบเทียบ … มันต้องบอกได้ในทุกๆส่วน ก็ตั้ง default เป็นเดือน พอกดเดือนไหนก็แตกเป็นรายวันให้ดู"*
 * > *"ในกราฟยังไม่ต้องแยก … พอกดไปก็เด้ง popup มาให้ดูว่าแบ่งเป็นอะไรเท่าไหร่ … เริ่มต้นเป็นยอดรวมไปก่อน"*
 * แท่งยอดรวมสีเดียว · Choice "เดือนเปลี่ยนทั้งหน้า · วันแค่ป๊อป": กดเดือน = `onPickMonth` (ทั้งหน้าเป็นเดือนนั้น) · กดวัน = ป๊อปสมการของวันนั้น
 * `value` null = อ่านไม่ได้/ยังไม่มีข้อมูลเดือนนั้น (ขีด ไม่ใช่ 0)
 */
export default function TopicTimeCard({
  title,
  unit,
  months,
  currentMonth,
  onPickMonth,
  days,
  prevDays,
  note,
  onOpenNames,
}: {
  title: string;
  unit: string;
  months: readonly TimeMonth[] | null;
  /** เดือนที่ทั้งหน้าดูอยู่ (YYYY-MM) */
  currentMonth: string | null;
  onPickMonth: (month: string) => void;
  /** รายวันของช่วงที่ดูอยู่ · null = เรื่องนี้ยังไม่มีรายวัน */
  days: readonly TimeDay[] | null;
  /** ยอดรวมวันเดียวกันของช่วงก่อน (key = วันที่ของช่วงนี้) — ป๊อปเทียบให้ */
  prevDays?: ReadonlyMap<string, number> | null;
  note?: string | null;
  onOpenNames?: (title: string, ids: readonly string[]) => void;
}) {
  const grown = useGrown();
  const [open, setOpen] = React.useState<TimeDay | null>(null);
  const mMax = Math.max(1, ...(months ?? []).map((m) => m.value ?? 0));
  const dTotals = (days ?? []).map((d) => d.parts.reduce((s, p) => s + p.value, 0));
  const dMax = Math.max(1, ...dTotals);
  const barCls = cn('w-3/5 rounded-t-md transition-all duration-700 ease-out motion-reduce:transition-none', TONE.primary.dot);
  return (
    <div className="space-y-4" data-testid="topic-time">
      <div>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
      </div>
      <div className="grid h-36 items-end gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, months?.length ?? 1)}, minmax(3rem, 1fr))` }}>
        {(months ?? []).map((m) => {
          const on = m.month === currentMonth;
          return (
            <Button
              key={m.month}
              type="button"
              variant="ghost"
              aria-pressed={on}
              onClick={() => onPickMonth(m.month)}
              className={cn('flex h-full flex-col items-center justify-end gap-1 rounded-xl px-1 py-1 font-normal', on && 'bg-muted ring-1 ring-primary')}
              data-testid={`topic-month-${m.month}`}
            >
              <span className="text-xs font-medium tabular-nums text-foreground">{m.value == null ? '—' : fmt(m.value)}</span>
              <span className={barCls} style={{ height: `${grown && m.value ? Math.max(2, (m.value / mMax) * 88) : 0}px` }} />
              <span className={cn('text-xs', DASH.sub)}>{m.label}</span>
            </Button>
          );
        })}
      </div>
      {days ? (
        <div className="space-y-2">
          <p className={cn('text-xs', DASH.sub)}>รายวัน</p>
          <div className="overflow-x-auto">
            <div className="grid h-32 min-w-full items-end gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(1.25rem, 1fr))` }}>
              {days.map((d, i) => (
                <Button
                  key={d.day}
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(d)}
                  className="flex h-full flex-col items-center justify-end gap-1 rounded-lg px-0 py-1 font-normal"
                  title={`${formatYmdTh(d.day)} ${fmt(dTotals[i])} ${unit}`}
                  data-testid={`topic-day-${d.day}`}
                >
                  <span className="text-[10px] tabular-nums text-foreground">{dTotals[i] ? fmt(dTotals[i]) : ''}</span>
                  <span className={barCls} style={{ height: `${grown && dTotals[i] ? Math.max(2, (dTotals[i] / dMax) * 80) : 0}px` }} />
                  <span className={cn('text-[10px]', DASH.sub)}>{Number(d.day.slice(8))}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {note ? <p className={cn('border-l-2 border-border pl-2 text-xs', DASH.sub)}>{note}</p> : null}
      <Dialog open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {title} · {open ? formatYmdTh(open.day) : ''}
            </DialogTitle>
          </DialogHeader>
          {open ? (
            <div className="space-y-2">
              <TopicEquation
                label={title}
                total={open.parts.reduce((s, p) => s + p.value, 0)}
                parts={open.parts}
                unit={unit}
                onOpenNames={onOpenNames}
              />
              {prevDays ? (
                <p className={cn('flex flex-wrap items-center gap-2 text-xs', DASH.sub)}>
                  วันเดียวกันของช่วงก่อน {fmt(prevDays.get(open.day) ?? 0)} {unit}
                  <TrendDelta cur={open.parts.reduce((s, p) => s + p.value, 0)} prev={prevDays.get(open.day) ?? 0} />
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
