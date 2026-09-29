/**
 * การ์ดตัวเลขหนึ่งใบของหน้าทีม Online — ตามภาพต้นแบบของเจ้าของ (29 ก.ย. 2569)
 * ค่า + หน่วย · ข้อความเทียบช่วงก่อน ("ลด 14 คน (20.6%)") · ฐาน/ช่วงก่อน · เส้นเล็กช่วงนี้ (ทึบ) เทียบช่วงก่อน (ประ)
 *
 * วาดอย่างเดียว — ตัวเลข/ข้อความทั้งหมดคิดมาจาก `src/lib/teamOnline.ts` · ป้าย/นิยามจากพจนานุกรมเลข
 * ธงคุณภาพข้อมูล (ข้อมูลเริ่มกลางช่วง · ERP มีแต่วันที่ · สำเนาเก่า) ต้องขึ้นเสมอ ห้ามกลบ
 */
import React from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import type { DeltaTone } from '@/lib/teamOnline';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type TeamKpiCardProps = {
  metric: MetricKey;
  /** ต่อท้ายป้าย เช่น " · ทุก BU" */
  labelSuffix?: string;
  /** ค่าที่จัดรูปแล้ว — ไม่มีข้อมูล = "—" */
  value: string;
  unit?: string;
  delta?: { text: string; tone: DeltaTone } | null;
  /** ทิศที่ดี — `null` = ไม่มีดี/เสีย (เช่น ใบขอเข้า) */
  upIsGood?: boolean | null;
  foot?: string | null;
  flags?: ReadonlyArray<string>;
  series?: ReadonlyArray<number>;
  prevSeries?: ReadonlyArray<number>;
  tone?: ToneKey;
  loading?: boolean;
  error?: string | null;
};

function deltaClass(tone: DeltaTone, upIsGood: boolean | null | undefined): string {
  if (tone === 'none' || tone === 'flat' || upIsGood == null) return DASH.muted;
  const good = tone === 'up' ? upIsGood : !upIsGood;
  return good ? TONE.success.value : TONE.danger.value;
}

const TeamKpiCard: React.FC<TeamKpiCardProps> = ({
  metric,
  labelSuffix = '',
  value,
  unit,
  delta,
  upIsGood = true,
  foot,
  flags = [],
  series,
  prevSeries,
  tone = 'primary',
  loading = false,
  error,
}) => {
  const spark =
    series && series.length > 1
      ? series.map((v, i) => ({ i, cur: v, prev: prevSeries?.[i] ?? null }))
      : null;
  return (
    <Card className="flex min-w-0 flex-col gap-1 rounded-2xl p-4">
      <p className={cn('truncate text-sm', DASH.sub)} title={metricHelp(metric)}>
        {METRICS[metric].label}
        {labelSuffix}
      </p>
      {loading ? (
        <div className="space-y-2 pt-1">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : error ? (
        <p className={cn('text-xs', TONE.danger.value)}>{error}</p>
      ) : (
        <>
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-3xl font-medium tabular-nums', TONE[tone].num)}>{value}</span>
            {unit && value !== '—' ? <span className={cn('text-sm', DASH.sub)}>{unit}</span> : null}
          </div>
          {delta ? (
            <p className={cn('text-xs font-medium tabular-nums', deltaClass(delta.tone, upIsGood))}>{delta.text}</p>
          ) : null}
          {foot ? <p className={cn('text-xs tabular-nums', DASH.muted)}>{foot}</p> : null}
          {spark ? (
            <div className="mt-1 h-10 w-full" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                {/* สีเส้นใช้ currentColor + คลาส TONE (มีคู่ dark:) — hex โทน 700 จมพื้นโหมดมืด */}
                <LineChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <Line
                    type="monotone"
                    dataKey="prev"
                    stroke="currentColor"
                    className={TONE.neutral.value}
                    strokeWidth={1.25}
                    strokeDasharray="4 3"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cur"
                    stroke="currentColor"
                    className={TONE[tone].value}
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : null}
          {flags.map((f) => (
            <p key={f} className={cn('text-xs', TONE.warn.value)}>
              {f}
            </p>
          ))}
        </>
      )}
    </Card>
  );
};

export default TeamKpiCard;
