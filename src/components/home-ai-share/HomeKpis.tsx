/**
 * ═══ กล่องตัวเลขของหน้าหลัก โฉมผู้บริหาร (เจ้าของ 7 ต.ค. 2569 ส่งภาพอ้างอิง 2 ภาพ "อยากไปประมาณนี้ แต่ขอโทนสีแบบของระบบฉัน") ═══
 * - กล่อง = แถบหัวสี (ป้าย) + แผ่นขาวด้านใน (เลขใหญ่ · ชิปเทียบช่วงก่อน · แถบสัดส่วน/บรรทัดท้าย) แบบภาพ "Total Revenue"
 * - ทั้งหมด = แถบหัวกรมท่า (`foreground` · โหมดมืด `accent`) · กล่องอื่น = แถบหัวเทา (`muted`)
 * - ทุกกล่องเป็นปุ่ม (กดแล้วหน้าเปิดป๊อป) · ชื่อปุ่ม = ป้าย + เลข (+ หน่วย) แบบเดิม · เลข 0 = กดไม่ได้ หน้าตาเท่าเดิม
 * - `RangeSummary` = "รวมทั้งช่วง" คอลัมน์ขวา (แบบรายการ "Win Rate by Region") · ติดตาม = แยก 2 แท็บ · หัวข้ออื่น = แยกก้อน
 * ชิปเทียบช่วงก่อน = `countPill` (ไม่ลงสีดี/เสีย) · % แถบ = `segmentsOfTotal` (ปัดรวม 100)
 * 🔴 shadcn Button/Card + Tailwind · สีจากตัวแปรธีม/TONE · ไม่มีไอคอน (เจ้าของเรียกว่าอิโมจิ) · ไม่มีประโยคอธิบายบนจอ
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Donut, type ResultSlice, type ToneKey } from '@/components/home-ai-share/AiShareLumosStats';
import { useCountUp } from '@/hooks/useCountUp';
import { Pill } from '@/components/team-online/TeamKpiCard';
import { TONE } from '@/lib/designTokens';
import type { DeltaPill } from '@/lib/teamOnline';
import type { FollowTeamBreakdown } from '@/lib/homeAiShare';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const OUTER = cn(
  'h-full w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-2xl p-1.5 text-left font-normal',
  'shadow-sm shadow-foreground/5 transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-100',
);

export function KpiTile({
  label,
  value,
  unit,
  pill,
  pillTitle,
  foot,
  share,
  shareClass,
  dotClass,
  hint,
  onClick,
  liveKey,
  emphasis = false,
  loading = false,
}: {
  label: string;
  value: number;
  unit?: string;
  pill: DeltaPill | null;
  pillTitle?: string;
  foot?: string | null;
  /** กี่ % ของทั้งหมด · null = ไม่มีแถบ */
  share?: number | null;
  shareClass?: string;
  dotClass?: string;
  hint?: string;
  onClick?: () => void;
  liveKey?: string;
  /** กล่องหลัก (ทั้งหมด) — แถบหัวกรมท่า */
  emphasis?: boolean;
  loading?: boolean;
}) {
  const shown = useCountUp(value, liveKey);
  return (
    <Button
      type="button"
      variant="ghost"
      aria-label={`${label} ${NUM.format(value)}${unit ? ` ${unit}` : ''}`}
      title={hint}
      disabled={!onClick || value <= 0}
      onClick={onClick}
      className={cn(
        OUTER,
        emphasis
          ? 'bg-foreground text-background hover:bg-foreground hover:text-background dark:bg-accent dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground'
          : 'bg-muted text-foreground hover:bg-muted hover:text-foreground dark:bg-muted/60 dark:hover:bg-muted/60',
      )}
    >
      <span className="flex items-center gap-2 px-3 py-2.5">
        {dotClass ? <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', dotClass)} aria-hidden /> : null}
        <span className={cn('truncate text-sm', emphasis ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
      </span>
      <span className="block flex-1 space-y-3 rounded-xl bg-card p-4 text-foreground">
        <span className="flex flex-wrap items-start justify-between gap-2">
          {loading ? (
            // ในปุ่มห้ามมีกล่องที่ตั้งขนาดเอง (เทสต์ typographyRules) — ระหว่างโหลดขึ้นขีดจาง ๆ ขนาดเท่าตัวเลข
            <span className={cn('block font-light text-muted-foreground', emphasis ? 'text-5xl' : 'text-3xl')}>—</span>
          ) : (
            <span className={cn('block font-light tabular-nums', emphasis ? 'text-5xl' : 'text-3xl')}>
              {NUM.format(shown)}
              {unit ? (
                <>
                  {' '}
                  <span className="text-sm text-muted-foreground">{unit}</span>
                </>
              ) : null}
            </span>
          )}
          {pill ? (
            <span className="shrink-0" title={pillTitle}>
              <Pill pill={pill} />
            </span>
          ) : null}
        </span>
        {share !== null && share !== undefined ? (
          <span className="flex items-center gap-2">
            <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn('block h-full rounded-full bg-current', shareClass)} style={{ width: `${share}%` }} />
            </span>
            <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{NUM.format(share)}%</span>
          </span>
        ) : foot ? (
          <span className="block text-xs tabular-nums text-muted-foreground" title={pillTitle}>
            {foot}
          </span>
        ) : null}
      </span>
    </Button>
  );
}

export type RangeRow = {
  key: string;
  label: string;
  value: number;
  ai?: number;
  staff?: number;
  tone?: ToneKey;
};

/**
 * รวมทั้งช่วง — โดนัท + รายการมีเส้นคั่น แบบการ์ด "Win Rate by Region" ในภาพอ้างอิง
 * ติดตาม: คนเริ่มงาน (ฟ้า) / ส่งคนแทน (ม่วง) สีเดียวกับแท่ง "ทีม" ในกราฟรายวัน · แถวละ AI โทร / คนโทร
 */
export function RangeSummary({
  title,
  rows,
  unit,
  onClear,
  testId,
  className,
}: {
  title: string;
  rows: RangeRow[] | null;
  unit: string;
  /** แท่งที่กดอยู่ → ปุ่มกลับทั้งช่วง */
  onClear?: () => void;
  testId?: string;
  className?: string;
}) {
  const total = rows ? rows.reduce((n, r) => n + r.value, 0) : null;
  const slices: ResultSlice[] = (rows ?? []).map((r) => ({ key: r.key, label: r.label, tone: r.tone ?? 'neutral', value: r.value }));
  return (
    <Card variant="glass" className={cn('space-y-4 p-5 sm:p-6', className)} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {onClear ? (
          <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={onClear}>
            ดูทั้งช่วง
          </Button>
        ) : null}
      </div>
      <Donut slices={slices} total={total} unit={unit} label={`${title} ${total === null ? '' : NUM.format(total)} ${unit}`} />
      {rows === null ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : (
        <ul className="divide-y divide-foreground/10">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1 py-3 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {r.tone ? <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[r.tone].dot)} aria-hidden /> : null}
                  {r.label}
                </span>
                <span className="tabular-nums text-foreground">
                  <span className="text-xl font-medium">{NUM.format(r.value)}</span>
                  <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
                </span>
              </div>
              {r.ai !== undefined && r.staff !== undefined ? (
                <div className="flex justify-end gap-4 text-xs tabular-nums text-muted-foreground">
                  <span>
                    AI โทร <span className="font-medium text-foreground">{NUM.format(r.ai)}</span>
                  </span>
                  <span>
                    คนโทร <span className="font-medium text-foreground">{NUM.format(r.staff)}</span>
                  </span>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** แถวของติดตาม 2 แท็บ จากตัวแตกทีมของกราฟ */
export const followRangeRows = (b: FollowTeamBreakdown): RangeRow[] => [
  { key: 'main', label: 'ติดตามคนเริ่มงาน', value: b.main.total, ai: b.main.ai, staff: b.main.staff, tone: 'info' },
  {
    key: 'replacement',
    label: 'ติดตามส่งคนแทน',
    value: b.replacement.total,
    ai: b.replacement.ai,
    staff: b.replacement.staff,
    tone: 'violet',
  },
];

/**
 * เกจ "AI ทำงาน" (เจ้าของ 7 ต.ค. 2569 Choice "AI ทำงานกี่ %" จากการ์ด "Forecast Accuracy") = AI โทร ÷ ทั้งหมด
 * พื้นเบอร์กันดี (`primary`) · ครึ่งวงจาง = ส่วนที่เหลือ · % ตัวเดียวกับแถบในกล่อง AI โทร
 */
export function AiGauge({ ai, total, unit, className }: { ai: number | null; total: number | null; unit: string; className?: string }) {
  const pct = ai !== null && total ? Math.round((ai / total) * 100) : 0;
  const data = [
    { key: 'ai', value: pct },
    { key: 'rest', value: 100 - pct },
  ];
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl bg-primary p-5 text-primary-foreground shadow-sm shadow-foreground/5',
        className,
      )}
      data-testid="ai-gauge"
    >
      <h2 className="text-base font-medium">AI ทำงาน</h2>
      <div className="relative h-32 w-full max-w-60" role="img" aria-label={`AI ทำงาน ${pct}%`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="key"
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius="150%"
              outerRadius="190%"
              stroke="none"
              cornerRadius={8}
              isAnimationActive={false}
            >
              <Cell fill="currentColor" />
              <Cell fill="currentColor" fillOpacity={0.25} />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
          <span className="text-4xl font-light tabular-nums">{ai === null ? '—' : `${NUM.format(pct)}%`}</span>
        </div>
      </div>
      <p className="mt-2 text-xs tabular-nums opacity-80">
        {ai === null || total === null ? '—' : `${NUM.format(ai)} จาก ${NUM.format(total)} ${unit}`}
      </p>
    </div>
  );
}
