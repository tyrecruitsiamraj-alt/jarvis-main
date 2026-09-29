/**
 * กราฟแท่งเทียบ BU ต่อช่วงย่อย + เส้นแนวโน้มของแต่ละ BU (เจ้าของสั่ง 29 ก.ย. 2569:
 * *"ขอเป็นแท่งกราฟแบบเปรียบเทียบได้เลยแบบ รายวันสัปดาห์เดือนปี … พร้อมมีเส้นแนวโน้มว่าแต่ละ Bu เพิ่มขึ้นหรือลดลง"*)
 *
 * - แท่ง = ค่าของ BU ในช่วงย่อยนั้น (สีประจำ BU · `toneOfBu`) · เส้นประสีเดียวกัน = แนวโน้ม (`trendOf` · least squares)
 * - ช่วงย่อยสุดท้ายที่ยังไม่จบไม่นับในเส้นแนวโน้ม (ไม่งั้นเส้นดิ่งลงหลอก ๆ ทุกครั้ง)
 * - ช่วงย่อยเดียว = แท่งเทียบ BU เฉย ๆ (ไม่มีเส้น) · ไม่มีข้อมูลเลย = บอกตรง ๆ
 * - 🔴 สีแท่ง/เส้นใช้ `currentColor` + คลาส `TONE[...].value` (มีคู่ `dark:` ในตัว) — hex ของ TONE เป็นโทน 700
 *   ตายตัว บนพื้นโหมดมืดกรมท่าจมหายไปกับพื้น (เจอบนเว็บจริง 29 ก.ย.) · ไม่เพิ่ม hex ใหม่
 */
import React, { useMemo } from 'react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TREND_TEXT, trendOf, type TeamBucket, type TeamTrend } from '@/lib/teamOnline';
import { CHART, DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { toneOfBu } from './teamOnlineTones';

export type BuTrendSeries = { bu: string; label: string; values: ReadonlyArray<number | null> };

const ARROW: Record<TeamTrend['direction'], string> = { up: '↗', down: '↘', flat: '→', none: '·' };

const BuTrendChart: React.FC<{
  buckets: ReadonlyArray<TeamBucket>;
  series: ReadonlyArray<BuTrendSeries>;
  /** ช่วงย่อยสุดท้ายยังไม่จบ (มีวันนี้) */
  lastOpen: boolean;
  format: (v: number) => string;
  /** แกน Y เป็นสัดส่วน 0–1 */
  asPct?: boolean;
  /** BU ที่กำลังเลือก — BU อื่นจางลง */
  selected?: string | null;
  height?: number;
  ariaLabel: string;
}> = ({ buckets, series, lastOpen, format, asPct = false, selected = null, height = 260, ariaLabel }) => {
  const trends = useMemo(
    () => new Map(series.map((s) => [s.bu, trendOf(s.values, lastOpen && s.values.length > 1)])),
    [series, lastOpen],
  );
  const data = useMemo(
    () =>
      buckets.map((b, i) => {
        const row: Record<string, number | string | null> = { label: b.label };
        for (const s of series) {
          row[s.bu] = s.values[i] ?? null;
          row[`${s.bu}__trend`] = trends.get(s.bu)?.fitted[i] ?? null;
        }
        return row;
      }),
    [buckets, series, trends],
  );
  const hasData = series.some((s) => s.values.some((v) => v !== null && v > 0));
  const multi = buckets.length > 1;
  const faded = (bu: string) => !!selected && bu !== selected;

  return (
    <div className="space-y-2">
      {/* คำอธิบายสี + ทิศแนวโน้มของแต่ละ BU (ตอบ "เพิ่มขึ้นหรือลดลง" โดยไม่ต้องเพ่งเส้น) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {series.map((s) => {
          const t = trends.get(s.bu);
          // ทั้งช่วงเป็น 0/ว่าง = BU นี้ยังไม่มีเรื่องนี้เลย (บอกตรง ๆ ไม่ใช่ "ทรงตัว")
          const none = !s.values.some((v) => v !== null && v > 0);
          return (
            <span key={s.bu} className={cn('inline-flex items-center gap-1.5', faded(s.bu) ? DASH.muted : 'text-foreground')} title={s.label}>
              <span className={cn('inline-block h-2.5 w-2.5 rounded-sm bg-current', TONE[toneOfBu(s.bu)].value)} aria-hidden />
              {s.bu}
              {none ? (
                <span className={DASH.muted}>ยังไม่มี</span>
              ) : multi && t ? (
                <span className={DASH.muted}>
                  {ARROW[t.direction]} {TREND_TEXT[t.direction]}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>
      {!hasData ? (
        <p className={cn('py-12 text-center text-sm', DASH.muted)}>ยังไม่มีข้อมูลในช่วงนี้</p>
      ) : (
        <div className={cn('w-full', DASH.sub)} style={{ height }} role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="12%" barGap={1}>
              <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} minTickGap={8} />
              <YAxis
                tick={{ fontSize: 11, fill: CHART.axisFill }}
                tickLine={false}
                axisLine={false}
                width={48}
                allowDecimals={asPct}
                domain={asPct ? [0, 1] : [0, 'auto']}
                tickFormatter={(v: number) => (asPct ? `${Math.round(v * 100)}%` : format(v))}
              />
              <Tooltip
                contentStyle={CHART.tooltipLight.contentStyle}
                labelStyle={CHART.tooltipLight.labelStyle}
                itemStyle={CHART.tooltipLight.itemStyle}
                formatter={(v: number | null, name: string) => [v === null ? '—' : format(Number(v)), name]}
              />
              {series.map((s) => (
                <Bar
                  key={s.bu}
                  dataKey={s.bu}
                  name={s.bu}
                  fill="currentColor"
                  className={TONE[toneOfBu(s.bu)].value}
                  fillOpacity={faded(s.bu) ? 0.3 : 0.9}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
              ))}
              {multi
                ? series.map((s) =>
                    trends.get(s.bu)?.direction === 'none' ? null : (
                      <Line
                        key={`${s.bu}__trend`}
                        type="linear"
                        dataKey={`${s.bu}__trend`}
                        name={`${s.bu}__trend`}
                        stroke="currentColor"
                        className={TONE[toneOfBu(s.bu)].value}
                        strokeOpacity={faded(s.bu) ? 0.3 : 1}
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={false}
                        activeDot={false}
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                      />
                    ),
                  )
                : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default BuTrendChart;
