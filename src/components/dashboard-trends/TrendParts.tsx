import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, RefreshCw } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import DateRangeCalendarPicker from '@/components/shared/DateRangeCalendarPicker';
import { ChoiceDropdown } from '@/components/jobs/BoardFilterPanel';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { deltaPct, TREND_GRAIN_LABEL, TREND_GRAINS, type DimRow } from '@/lib/trends/timeBuckets';
import { TREND_COMPARE_OPTIONS, type TrendWindow } from '@/hooks/useTrendWindow';
import { formatTrendNumber, formatTrendPct } from '@/lib/trends/format';

/**
 * ═══ ชิ้นส่วนของแท็บ Dashboard (กล่องงาน + ติดตาม) ═══
 * 🔴 ประกอบจาก shadcn (Button · Card · Skeleton) + recharts เท่านั้น · สีจาก `TONE[..].hex` / `CHART` ที่เดียว
 * ปุ่มบนแท็บของกล่องงานใช้ `size="xs"` ทุกตัว (เจ้าของสั่งย่อสองรอบ)
 */

const fmt = formatTrendNumber;
const fmtPct = formatTrendPct;

/** แถบบน: ดูเป็น วัน/สัปดาห์/เดือน/ไตรมาส/ปี · ช่วงวันที่ · เทียบกับ */
export function TrendToolbar({ win, note }: { win: TrendWindow; note?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="ดูเป็น">
        {TREND_GRAINS.map((g) => (
          <Button
            key={g}
            type="button"
            size="xs"
            variant={win.grain === g && !win.custom ? 'default' : 'outline'}
            aria-pressed={win.grain === g && !win.custom}
            onClick={() => win.setGrain(g)}
          >
            {TREND_GRAIN_LABEL[g]}
          </Button>
        ))}
      </div>
      <DateRangeCalendarPicker triggerVariant="filter" value={win.custom} onChange={(v) => win.setCustom(v)} />
      <ChoiceDropdown
        value={win.compare}
        options={TREND_COMPARE_OPTIONS}
        onChange={win.setCompare}
        ariaLabel="เทียบกับช่วงไหน"
        active={win.compare !== 'previous'}
      />
      {note ? <span className={cn('text-xs', DASH.sub)}>{note}</span> : null}
    </div>
  );
}

export type Polarity = 'up-good' | 'down-good' | 'neutral';

function DeltaChip({ current, previous, polarity }: { current: number; previous: number; polarity: Polarity }) {
  const d = deltaPct(current, previous);
  if (d === null) {
    return <span className={cn('text-xs', DASH.muted)}>{previous === 0 && current > 0 ? 'ช่วงก่อนยังไม่มี' : '—'}</span>;
  }
  const up = d > 0;
  const flat = d === 0;
  const good = polarity === 'neutral' ? null : polarity === 'up-good' ? up : !up;
  const tone: ToneKey = flat || good === null ? 'neutral' : good ? 'success' : 'danger';
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular-nums', TONE[tone].value)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {up ? '+' : ''}
      {d}%
    </span>
  );
}

/** การ์ดตัวเลขหนึ่งใบ: ค่า · ลูกศรเทียบช่วงก่อน · เส้นเล็กแนวโน้ม */
export function TrendKpiCard({
  label,
  value,
  previous,
  unit,
  polarity = 'up-good',
  spark,
  tone = 'primary',
  asRate = false,
  foot,
}: {
  label: string;
  value: number | null;
  previous?: number | null;
  unit?: string;
  polarity?: Polarity;
  spark?: number[];
  tone?: ToneKey;
  /** ค่าเป็นสัดส่วน 0–1 (โชว์เป็น %) */
  asRate?: boolean;
  foot?: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-1 rounded-2xl p-3 sm:p-4">
      <p className={cn('truncate text-xs sm:text-sm', DASH.sub)}>{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-medium tabular-nums', TONE[tone].num)}>
          {value === null ? '—' : asRate ? fmtPct(value) : fmt(value)}
        </span>
        {unit && value !== null && !asRate ? <span className={cn('text-xs', DASH.sub)}>{unit}</span> : null}
      </div>
      <div className="flex min-h-5 items-center justify-between gap-2">
        {value !== null && previous != null ? (
          asRate ? (
            <span className={cn('text-xs tabular-nums', DASH.muted)}>ช่วงก่อน {fmtPct(previous)}</span>
          ) : (
            <DeltaChip current={value} previous={previous} polarity={polarity} />
          )
        ) : (
          <span />
        )}
        {spark && spark.length > 1 ? (
          /* จอแคบ (การ์ด 2 ใบต่อแถว) เส้นเล็กดันเกินขอบการ์ด — ซ่อนไว้ โชว์ตั้งแต่ sm */
          <div className="hidden h-6 w-20 shrink-0 sm:block" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={spark.map((v, i) => ({ i, v }))}>
                <Line type="monotone" dataKey="v" stroke={TONE[tone].hex} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
      {foot ? <div className={cn('text-xs', DASH.muted)}>{foot}</div> : null}
    </Card>
  );
}

export type TrendSeries = {
  key: string;
  label: string;
  kind: 'bar' | 'line';
  tone: ToneKey;
  /** แท่งที่ stack ด้วยกันใส่ชื่อเดียวกัน */
  stack?: string;
  dashed?: boolean;
};

/** กราฟแนวโน้ม — แท่ง/เส้นผสม · แกนเดียว (ห้ามสองแกน) · ป้ายแกน X = ป้ายงวดไทย */
export function TrendChart({
  data,
  series,
  height = 240,
  ariaLabel,
}: {
  data: Array<Record<string, number | string>>;
  series: TrendSeries[];
  height?: number;
  ariaLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className={cn('flex flex-wrap gap-3 text-xs', DASH.sub)}>
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span
              className={cn('inline-block h-2.5 w-2.5', s.kind === 'line' ? 'rounded-full' : 'rounded-sm')}
              style={{ backgroundColor: TONE[s.tone].hex }}
              aria-hidden
            />
            {s.label}
            {s.kind === 'line' ? ' (เส้น)' : ''}
          </span>
        ))}
      </div>
      <div className="w-full" style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} minTickGap={8} />
            <YAxis tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip
              contentStyle={CHART.tooltip.contentStyle}
              labelStyle={CHART.tooltip.labelStyle}
              itemStyle={CHART.tooltip.itemStyle}
              formatter={(v: number, name: string) => [fmt(Number(v)), name]}
            />
            {series.map((s) =>
              s.kind === 'bar' ? (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  name={s.label}
                  fill={TONE[s.tone].hex}
                  stackId={s.stack}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={TONE[s.tone].hex}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? '5 4' : undefined}
                  dot={data.length <= 16}
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** ตารางแยกมิติ: ชื่อ · จำนวน · สัดส่วน · ช่วงก่อน · เปลี่ยน */
export function TrendBreakdown<D extends string>({
  dims,
  dim,
  onDimChange,
  rows,
  unit,
  polarity = 'up-good',
  tone = 'primary',
}: {
  dims: readonly { value: D; label: string }[];
  dim: D;
  onDimChange: (d: D) => void;
  rows: DimRow[];
  unit: string;
  polarity?: Polarity;
  tone?: ToneKey;
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('text-xs', DASH.sub)}>แยกตาม</span>
        <ChoiceDropdown value={dim} options={dims} onChange={onDimChange} ariaLabel="แยกตามมิติ" />
      </div>
      {rows.length === 0 ? (
        <p className={cn('text-xs', DASH.muted)}>ช่วงนี้ยังไม่มีข้อมูล</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={cn('text-xs', DASH.tableHead)}>
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">{dims.find((d) => d.value === dim)?.label}</th>
                <th className="px-2 py-1.5 text-right font-medium">{unit}</th>
                <th className="w-32 px-2 py-1.5 text-left font-medium">สัดส่วน</th>
                <th className="px-2 py-1.5 text-right font-medium">ช่วงก่อน</th>
                <th className="px-2 py-1.5 text-right font-medium">เปลี่ยน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.dim} className={cn('border-t', DASH.tableRow)}>
                  <td className={cn('max-w-56 truncate px-2 py-1.5', DASH.cellStrong)} title={r.dim}>
                    {r.dim}
                  </td>
                  <td className={cn('px-2 py-1.5 text-right tabular-nums', DASH.cell)}>{fmt(r.value)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${max ? (r.value / max) * 100 : 0}%`, backgroundColor: TONE[tone].hex }}
                        />
                      </div>
                      <span className={cn('w-9 text-right text-xs tabular-nums', DASH.cellMuted)}>{fmtPct(r.share)}</span>
                    </div>
                  </td>
                  <td className={cn('px-2 py-1.5 text-right tabular-nums', DASH.cellMuted)}>{fmt(r.previous)}</td>
                  <td className="px-2 py-1.5 text-right">
                    <DeltaChip current={r.value} previous={r.previous} polarity={polarity} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** กล่องของแต่ละส่วน — หัวเรื่อง + ป้ายที่มาของข้อมูล */
export function TrendSection({
  title,
  badge,
  actions,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-medium text-foreground">{title}</h2>
          {badge}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** ป้ายเล็กบอกที่มา/สภาพข้อมูล */
export function TrendBadge({ tone = 'neutral', children }: { tone?: ToneKey; children: React.ReactNode }) {
  return <span className={cn('rounded-md px-2 py-0.5 text-xs', TONE[tone].chip)}>{children}</span>;
}

/** กำลังโหลด / โหลดไม่ได้ — 🔴 โหลดไม่ได้ต้องบอก ห้ามโชว์ 0 */
export function TrendState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!error) return null;
  return (
    <Card className={cn('flex flex-wrap items-center justify-between gap-2 rounded-2xl p-3 text-sm', TONE.danger.soft)}>
      <span className={TONE.danger.value}>{error}</span>
      {onRetry ? (
        <Button type="button" size="xs" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden /> ลองใหม่
        </Button>
      ) : null}
    </Card>
  );
}

/** ตารางเปรียบเทียบแบบง่าย — หัวคอลัมน์ + แถว (ใช้กับตารางเจ้าหน้าที่) */
export function TrendTable({
  columns,
  rows,
  empty = 'ช่วงนี้ยังไม่มีข้อมูล',
}: {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: Array<{ key: string; cells: Record<string, React.ReactNode> }>;
  empty?: string;
}) {
  if (rows.length === 0) return <p className={cn('text-xs', DASH.muted)}>{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn('text-xs', DASH.tableHead)}>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn('px-2 py-1.5 font-medium', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={cn('border-t', DASH.tableRow)}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'px-2 py-1.5',
                    c.align === 'right' ? 'text-right tabular-nums' : '',
                    c.key === columns[0].key ? DASH.cellStrong : DASH.cell,
                  )}
                >
                  {r.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { DeltaChip };
