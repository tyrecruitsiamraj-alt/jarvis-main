/**
 * การ์ดตัวเลขหนึ่งใบของหน้าทีม Online — แบบภาพอ้างอิงที่เจ้าของเลือก (29 ก.ย. 2569 · ลิงก์ 2 "การ์ดตัวเลขแบบลิงก์ 2")
 *
 * ไอคอน · ชื่อ · "เทียบช่วงก่อน" ด้านบน → ค่าตัวใหญ่ + ป้ายเปลี่ยนแปลงมุมขวา (↑/↓ สีดี/เสีย) → บรรทัดฐาน/ช่วงก่อน → ธงข้อมูล
 * แทนการ์ดเดิมที่เป็นข้อความหลายบรรทัด + เส้นเล็ก (เทรนด์ดูที่กราฟข้างล่างแทน)
 *
 * วาดอย่างเดียว — ตัวเลข/ป้ายคิดมาจาก `src/lib/teamOnline.ts` · ป้าย/นิยามจากพจนานุกรมเลข
 * 🔴 ธงคุณภาพข้อมูล (ข้อมูลเริ่มกลางช่วง · สำเนา ERP เก่า) ต้องขึ้นเสมอ ห้ามกลบ
 */
import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import type { DeltaPill } from '@/lib/teamOnline';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export type TeamKpiCardProps = {
  metric: MetricKey;
  /** ต่อท้ายชื่อ เช่น " · ทุก BU" */
  labelSuffix?: string;
  icon: LucideIcon;
  /** ค่าที่จัดรูปแล้ว — ไม่มีข้อมูล = "—" */
  value: string;
  unit?: string;
  /** บรรทัดเล็กใต้ชื่อ — "เทียบช่วงก่อน" / "เทียบปีก่อน" / "ช่วงก่อนยังไม่มีข้อมูล" */
  sub: string;
  pill?: DeltaPill | null;
  foot?: string | null;
  flags?: ReadonlyArray<string>;
  tone?: ToneKey;
  loading?: boolean;
  error?: string | null;
};

const PILL_TONE: Record<DeltaPill['tone'], ToneKey> = { good: 'success', bad: 'danger', neutral: 'neutral' };
const PILL_ICON: Record<DeltaPill['dir'], LucideIcon> = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus };

function Pill({ pill }: { pill: DeltaPill }) {
  const Icon = PILL_ICON[pill.dir];
  const tone = TONE[PILL_TONE[pill.tone]];
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums', tone.soft, tone.value)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {pill.text}
    </span>
  );
}

const TeamKpiCard: React.FC<TeamKpiCardProps> = ({
  metric,
  labelSuffix = '',
  icon: Icon,
  value,
  unit,
  sub,
  pill,
  foot,
  flags = [],
  tone = 'primary',
  loading = false,
  error,
}) => (
  <Card className="flex min-w-0 flex-col gap-3 rounded-2xl p-4">
    <div className="flex items-start gap-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONE[tone].wash, TONE[tone].value)} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm text-foreground" title={metricHelp(metric)}>
          {METRICS[metric].label}
          {labelSuffix}
        </p>
        <p className={cn('truncate text-xs', DASH.muted)}>{sub}</p>
      </div>
    </div>
    {loading ? (
      <div className="space-y-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    ) : error ? (
      <p className={cn('text-xs', TONE.danger.value)}>{error}</p>
    ) : (
      <>
        <div className="flex items-end justify-between gap-2">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <span className={cn('text-3xl font-medium tabular-nums', TONE[tone].num)}>{value}</span>
            {unit && value !== '—' ? <span className={cn('text-sm', DASH.sub)}>{unit}</span> : null}
          </div>
          {pill ? <Pill pill={pill} /> : null}
        </div>
        {foot ? <p className={cn('text-xs tabular-nums', DASH.muted)}>{foot}</p> : null}
        {flags.map((f) => (
          <p key={f} className={cn('text-xs', TONE.warn.value)}>
            {f}
          </p>
        ))}
      </>
    )}
  </Card>
);

export default TeamKpiCard;
