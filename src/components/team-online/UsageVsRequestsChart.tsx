/**
 * กราฟ "คนใช้งาน เทียบ อัตราที่ขอเข้า" — แบบภาพอ้างอิงที่เจ้าของเลือก (29 ก.ย. 2569 · ลิงก์ 2 "Balance Overview")
 *
 * ตอบคำถามของผู้บริหาร *"อ้อคนใช้ลดลง ลดลงเพราะใบขอน้อย หรือเพราะอะไร"* ในกราฟเดียว:
 * เส้น = คนใช้งาน (% ของบัญชี · แกนซ้ายแกนเดียว) · แท่งจางด้านหลัง = อัตราที่ขอเข้า (บอกขนาดงาน ชี้ดูจำนวนจริง)
 *
 * 🔴 **แกนตัวเลขแกนเดียว** (กติกาเดียวกับ `TrendChart`: ห้ามสองแกน) — แท่งใช้สเกลซ่อนให้อยู่ช่วงล่างของกราฟแบบภาพอ้างอิง
 *    ไม่มีตัวเลขแกนที่สองให้อ่านผิด · ตัวเลขจริงดูจากป้ายตอนชี้
 * ไม่สรุปเหตุผลให้ (เจ้าของไม่ได้เลือก "สรุปสาเหตุอัตโนมัติ") — บอกแค่ทิศแนวโน้มของสองเส้นให้เทียบเอง
 */
import React, { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TREND_TEXT, fmtPct, trendOf, type TeamBucket } from '@/lib/teamOnline';
import { TREND_GRAIN_LABEL, type TrendGrain } from '@/lib/trends/timeBuckets';
import { CHART, DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const ARROW = { up: '↗', down: '↘', flat: '→', none: '·' } as const;

const UsageVsRequestsChart: React.FC<{
  buckets: ReadonlyArray<TeamBucket>;
  grain: TrendGrain;
  /** คนใช้งาน % ต่อช่วงย่อย (0–1 · null = ยังไม่มีบัญชี) */
  usage: ReadonlyArray<number | null> | null;
  /** อัตราที่ขอเข้าต่อช่วงย่อย · null = อ่าน ERP ไม่ได้ */
  positions: ReadonlyArray<number> | null;
  lastOpen: boolean;
  buLabel: string;
  loading?: boolean;
}> = ({ buckets, grain, usage, positions, lastOpen, buLabel, loading = false }) => {
  const data = useMemo(
    () =>
      buckets.map((b, i) => ({
        label: b.label,
        usage: usage ? (usage[i] ?? null) : null,
        positions: positions ? (positions[i] ?? 0) : null,
      })),
    [buckets, usage, positions],
  );
  const excludeLast = lastOpen && buckets.length > 1;
  const usageTrend = usage ? trendOf(usage, excludeLast) : null;
  const posTrend = positions ? trendOf(positions, excludeLast) : null;
  const maxPos = Math.max(1, ...(positions ?? [0]));
  const hasData = !!usage?.some((v) => v !== null) || !!positions?.some((v) => v > 0);

  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-foreground">คนใช้งาน เทียบ อัตราที่ขอเข้า</p>
        <Badge variant="secondary" className="text-xs">
          {buLabel}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span className={cn('inline-block h-0.5 w-4 rounded-full bg-current', TONE.primary.value)} aria-hidden />
          คนใช้งาน (%)
          {usageTrend && buckets.length > 1 ? (
            <span className={DASH.muted}>
              {ARROW[usageTrend.direction]} {TREND_TEXT[usageTrend.direction]}
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1.5 text-foreground">
          <span className={cn('inline-block h-2.5 w-2.5 rounded-sm bg-current opacity-40', TONE.neutral.value)} aria-hidden />
          อัตราที่ขอเข้า
          {posTrend && buckets.length > 1 ? (
            <span className={DASH.muted}>
              {ARROW[posTrend.direction]} {TREND_TEXT[posTrend.direction]}
            </span>
          ) : null}
        </span>
      </div>
      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : !hasData ? (
        <p className={cn('py-12 text-center text-sm', DASH.muted)}>ยังไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className={cn('h-64 w-full', DASH.sub)} role="img" aria-label="คนใช้งานเป็นเปอร์เซ็นต์ของบัญชี เทียบกับอัตราที่ขอเข้า">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis
                yAxisId="pct"
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: CHART.axisFill }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              />
              {/* สเกลซ่อนของแท่ง — ให้แท่งสูงสุดอยู่ราวหนึ่งในสามล่างของกราฟ (บอกขนาดงาน ไม่ใช่แกนที่สอง) */}
              <YAxis yAxisId="req" hide domain={[0, maxPos * 3]} />
              <Tooltip
                contentStyle={CHART.tooltipLight.contentStyle}
                labelStyle={CHART.tooltipLight.labelStyle}
                itemStyle={CHART.tooltipLight.itemStyle}
                formatter={(v: number | null, name: string) =>
                  name === 'usage'
                    ? [v === null ? '—' : fmtPct(Number(v)), 'คนใช้งาน']
                    : [v === null ? '—' : `${NUM.format(Number(v))} อัตรา`, 'อัตราที่ขอเข้า']
                }
              />
              {positions ? (
                <Bar
                  yAxisId="req"
                  dataKey="positions"
                  name="positions"
                  fill="currentColor"
                  className={TONE.neutral.value}
                  fillOpacity={0.3}
                  maxBarSize={28}
                  isAnimationActive={false}
                />
              ) : null}
              {usage ? (
                <Line
                  yAxisId="pct"
                  type="monotone"
                  dataKey="usage"
                  name="usage"
                  stroke="currentColor"
                  className={TONE.primary.value}
                  strokeWidth={2}
                  dot={buckets.length <= 16}
                  connectNulls
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      <p className={cn('text-xs', DASH.muted)}>
        ราย{TREND_GRAIN_LABEL[grain]} · แท่งจาง = อัตราที่ขอเข้า (ชี้ดูจำนวนจริง)
        {excludeLast ? ' · ช่วงสุดท้ายยังไม่จบ ไม่นับในแนวโน้ม' : ''}
      </p>
    </Card>
  );
};

export default UsageVsRequestsChart;
