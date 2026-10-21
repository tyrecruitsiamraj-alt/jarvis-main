import React from 'react';
import { ArrowDown, ArrowUp, LineChart as LineIcon } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CHART, chartDayLabel, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { deltaOf, type CompareRow } from '@/lib/recruitCompare';
import { OverviewCard } from './RecruitOverviewParts';

export type ComparePeriod = 'cur' | 'prev';

/** สีเส้นตามลำดับแถว — จากโทเค็น (`TONE.*.hex`) ที่เดียว */
const LINE_TONES: ToneKey[] = ['info', 'success', 'warn', 'violet'];

/**
 * ═══ กราฟเส้นรายวัน + ▲▼ เทียบช่วงก่อน — บนสุดทุกแท็บของภาพรวม ═══
 * เจ้าของ 21 ต.ค. 2569: *"อยากให้มันวิ่งแบบอันนี้"* (ชี้กราฟเส้นแนวโน้มรายเดือนของ Dashboard) +
 * *"Default 7 วัน … ถ้าเป็นแบบเทียบเดือนก็ขึ้นเป็นเดือนเทียบกัน พอกดเดือนไหนก็เป็นวันของเดือนนั้นๆ"*
 * - เส้นละตัวชี้วัดของแท็บ · แกนนอน = วันของช่วงที่เลือก
 * - ป้ายบนหัว: ยอดช่วงนี้ + เพิ่ม/ลด % จากช่วงก่อน · กดชื่อช่วง = ดูวันของช่วงนั้น
 */
export default function TrendLinesCard({
  rows,
  curLabel,
  prevLabel,
  note,
  seriesOf,
}: {
  rows: readonly CompareRow[];
  curLabel: string;
  prevLabel: string;
  note?: string | null;
  seriesOf: (key: string, period: ComparePeriod) => Array<{ day: string; n: number }>;
}) {
  const [period, setPeriod] = React.useState<ComparePeriod>('cur');
  const chart = React.useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      for (const p of seriesOf(r.key, period)) {
        const row = byDay.get(p.day) ?? { day: p.day, label: String(Number(p.day.slice(8, 10))) };
        row[r.key] = p.n;
        byDay.set(p.day, row);
      }
    }
    return [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [rows, period, seriesOf]);
  const labelOf = new Map(rows.map((r) => [r.key, r.label]));

  return (
    <OverviewCard icon={LineIcon} title="แนวโน้มรายวัน" sub={note ?? undefined}>
      {/* ยอดช่วงนี้ + เทียบช่วงก่อน ต่อตัวชี้วัด */}
      <div className="flex flex-wrap gap-2" data-testid="trend-totals">
        {rows.map((r, i) => {
          const d = deltaOf(r.cur, r.prev);
          return (
            <div key={r.key} className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border px-3 py-2" data-testid={`trend-total-${r.key}`}>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-0.5 w-4 rounded-full" style={{ background: TONE[LINE_TONES[i % LINE_TONES.length]].hex }} aria-hidden />
                {r.label}
              </span>
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-medium tabular-nums text-foreground">{r.cur === null ? '—' : fmt(r.cur)}</span>
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-medium tabular-nums',
                    d.kind === 'up' || d.kind === 'new' ? TONE.success.value : d.kind === 'down' ? TONE.danger.value : 'text-muted-foreground',
                  )}
                >
                  {d.kind === 'up' ? <ArrowUp className="size-3" aria-hidden /> : d.kind === 'down' ? <ArrowDown className="size-3" aria-hidden /> : null}
                  {d.kind === 'up' || d.kind === 'down'
                    ? `${d.pct.toLocaleString('th-TH')}%`
                    : d.kind === 'new'
                      ? 'ใหม่'
                      : d.kind === 'same'
                        ? 'เท่าเดิม'
                        : 'เทียบไม่ได้'}
                </span>
              </span>
              <span className={cn('text-xs tabular-nums', DASH.sub)}>ช่วงก่อน {r.prev === null ? '—' : fmt(r.prev)}</span>
            </div>
          );
        })}
      </div>
      {/* กดชื่อช่วง = กราฟเป็นวันของช่วงนั้น */}
      <div className="flex flex-wrap items-center gap-2" data-testid="trend-periods">
        {(['prev', 'cur'] as const).map((p) => (
          <Button
            key={p}
            type="button"
            size="xs"
            variant={period === p ? 'secondary' : 'ghost'}
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            data-testid={`trend-period-${p}`}
          >
            {p === 'cur' ? curLabel : prevLabel}
          </Button>
        ))}
      </div>
      <div className={cn('h-56', DASH.sub)} data-testid="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <Tooltip
              {...CHART.tooltip}
              cursor={CHART.cursorLine}
              labelFormatter={(_l, p) => chartDayLabel((p?.[0]?.payload as { day?: string } | undefined)?.day ?? '')}
              formatter={(value: number, name: string) => [fmt(Number(value)), labelOf.get(name) ?? name]}
            />
            {rows.map((r, i) => (
              <Line
                key={r.key}
                type="monotone"
                dataKey={r.key}
                name={r.key}
                stroke={TONE[LINE_TONES[i % LINE_TONES.length]].hex}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={CHART.activeDot}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </OverviewCard>
  );
}
