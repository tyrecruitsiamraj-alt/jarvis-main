import React from 'react';
import { ArrowDown, ArrowUp, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { deltaOf, type CompareRow } from '@/lib/recruitCompare';
import { OverviewCard } from './RecruitOverviewParts';

/**
 * ═══ แท่งคู่ ช่วงนี้ vs ช่วงก่อน + ▲▼ (เจ้าของ 21 ต.ค. 2569 · Choice "เทียบเดือนก่อน แท่งคู่ + ▲▼") ═══
 * ทุกแถวใช้สเกลเดียวกัน (ค่ามากสุดของการ์ด) · ช่วงก่อนสีจาง ช่วงนี้สีหลัก · เพิ่ม = เขียว ลด = แดง
 * เทียบไม่ได้ = "—" ไม่ใช่ 0 · การ์ดไม่หายแม้เป็น 0 ทั้งหมด (กติกา 1 ต.ค.)
 * กดแถว = เลือกตัวชี้วัด · กดชื่อช่วง (เดือน/ช่วงวัน) = กราฟรายวันข้างล่างเป็นวันของช่วงนั้น
 * (เจ้าของ "พอกดเดือนไหนก็เป็นวันของเดือนนั้นๆ แบบ interactive")
 */
export type ComparePeriod = 'cur' | 'prev';

export default function CompareBarsCard({
  rows,
  curLabel,
  prevLabel,
  note,
  seriesOf,
}: {
  rows: readonly CompareRow[];
  curLabel: string;
  prevLabel: string;
  /** เหตุที่เทียบไม่ได้ (เช่น ข้อมูลเพิ่งเริ่ม) */
  note?: string | null;
  /** ยอดรายวันของตัวชี้วัดในช่วงที่เลือก (`dailySeriesOf`) */
  seriesOf: (key: string, period: ComparePeriod) => Array<{ day: string; n: number }>;
}) {
  const [metric, setMetric] = React.useState<string>(rows[0]?.key ?? '');
  const [period, setPeriod] = React.useState<ComparePeriod>('cur');
  const picked = rows.find((r) => r.key === metric) ?? rows[0];
  const series = picked ? seriesOf(picked.key, period) : [];
  const dayMax = Math.max(1, ...series.map((s) => s.n));
  const max = Math.max(1, ...rows.flatMap((r) => [r.cur ?? 0, r.prev ?? 0]));
  const w = (n: number | null) => `${n ? Math.max(2, (n / max) * 100) : 0}%`;
  const periodBtn = (p: ComparePeriod, label: string, swatch: string) => (
    <Button
      type="button"
      size="xs"
      variant={period === p ? 'secondary' : 'ghost'}
      aria-pressed={period === p}
      onClick={() => setPeriod(p)}
      data-testid={`compare-period-${p}`}
    >
      <span className={cn('h-2 w-4 rounded-full', swatch)} aria-hidden />
      {label}
    </Button>
  );
  return (
    <OverviewCard icon={BarChart3} title="เทียบกับช่วงก่อน" sub={note ?? undefined}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-testid="compare-legend">
        {periodBtn('prev', prevLabel, 'bg-muted-foreground/30')}
        {periodBtn('cur', curLabel, 'bg-primary')}
      </div>
      <ul className="space-y-1" data-testid="compare-bars">
        {rows.map((r) => {
          const d = deltaOf(r.cur, r.prev);
          const active = picked?.key === r.key;
          return (
            <li
              key={r.key}
              className={cn(
                'grid cursor-pointer grid-cols-1 gap-1.5 rounded-xl px-2 py-1.5 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-center sm:gap-3',
                active ? 'bg-muted' : 'hover:bg-muted/50',
              )}
              onClick={() => setMetric(r.key)}
              aria-selected={active}
              data-testid={`compare-row-${r.key}`}
            >
              <span className="text-sm text-foreground">{r.label}</span>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: w(r.prev) }} />
                  </div>
                  <span className={cn('w-14 text-right text-xs tabular-nums', DASH.sub)}>{r.prev === null ? '—' : fmt(r.prev)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: w(r.cur) }} />
                  </div>
                  <span className="w-14 text-right text-sm font-medium tabular-nums text-foreground">{r.cur === null ? '—' : fmt(r.cur)}</span>
                </div>
              </div>
              <span
                className={cn(
                  'flex w-fit items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums',
                  d.kind === 'up' || d.kind === 'new' ? cn(TONE.success.soft, TONE.success.value) : d.kind === 'down' ? cn(TONE.danger.soft, TONE.danger.value) : 'border-border text-muted-foreground',
                )}
                data-testid={`compare-delta-${r.key}`}
              >
                {d.kind === 'up' ? <ArrowUp className="size-3" aria-hidden /> : d.kind === 'down' ? <ArrowDown className="size-3" aria-hidden /> : null}
                {d.kind === 'up' || d.kind === 'down'
                  ? `${d.kind === 'up' ? 'เพิ่ม' : 'ลด'} ${d.pct.toLocaleString('th-TH')}%`
                  : d.kind === 'new'
                    ? 'ใหม่'
                    : d.kind === 'same'
                      ? 'เท่าเดิม'
                      : 'เทียบไม่ได้'}
              </span>
            </li>
          );
        })}
      </ul>
      {/* รายวันของช่วงที่กด × ตัวชี้วัดที่กด — วันที่ไม่มี = 0 ไม่หาย */}
      {picked ? (
        <div className="space-y-2 border-t border-border/70 pt-3" data-testid="compare-daily">
          <p className={cn('text-xs', DASH.sub)}>
            {picked.label} รายวัน · {period === 'cur' ? curLabel : prevLabel}
          </p>
          <div className="overflow-x-auto">
            <div className="flex h-32 min-w-full items-end gap-1" style={{ minWidth: `${series.length * 1.25}rem` }}>
              {series.map((s) => (
                <div key={s.day} className="flex min-w-4 flex-1 flex-col items-center justify-end gap-1" title={`${s.day} · ${fmt(s.n)} ${picked.unit}`}>
                  <span className="text-xs tabular-nums text-muted-foreground">{s.n > 0 ? fmt(s.n) : ''}</span>
                  <div
                    className={cn('w-full rounded-t-md', period === 'cur' ? 'bg-primary' : 'bg-muted-foreground/40')}
                    style={{ height: `${s.n > 0 ? Math.max(4, (s.n / dayMax) * 88) : 1}px` }}
                  />
                  <span className="text-xs tabular-nums text-muted-foreground">{Number(s.day.slice(8, 10))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </OverviewCard>
  );
}
