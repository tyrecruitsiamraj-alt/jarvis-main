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
import { useCountUp } from '@/hooks/useCountUp';
import { Pill } from '@/components/team-online/TeamKpiCard';
import { TONE } from '@/lib/designTokens';
import type { DeltaPill } from '@/lib/teamOnline';
import type { FollowTeamBreakdown } from '@/lib/homeAiShare';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const OUTER = cn(
  'h-auto w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-2xl p-1.5 text-left font-normal',
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
      <span className="block space-y-3 rounded-xl bg-card p-4 text-foreground">
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
  dotClass?: string;
  pct?: number;
};

/** รวมทั้งช่วง — รายการชื่อ · เลข · (AI โทร / คนโทร หรือ %) แบบรายการในภาพอ้างอิง */
export function RangeSummary({
  title,
  rows,
  unit,
  onClear,
  testId,
}: {
  title: string;
  rows: RangeRow[] | null;
  unit: string;
  /** แท่งที่กดอยู่ → ปุ่มกลับทั้งช่วง */
  onClear?: () => void;
  testId?: string;
}) {
  return (
    <Card variant="glass" className="space-y-4 p-5 sm:p-6" data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {onClear ? (
          <Button type="button" variant="link" size="xs" className="h-auto p-0" onClick={onClear}>
            ดูทั้งช่วง
          </Button>
        ) : null}
      </div>
      {rows === null ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : (
        <ul className="divide-y divide-foreground/10">
          {rows.map((r) => (
            <li key={r.key} className="space-y-1 py-3 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  {r.dotClass ? <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', r.dotClass)} aria-hidden /> : null}
                  {r.label}
                </span>
                <span className="tabular-nums text-foreground">
                  <span className="text-xl font-medium">{NUM.format(r.value)}</span>
                  {r.pct !== undefined ? (
                    <span className="ml-2 text-xs text-muted-foreground">{NUM.format(r.pct)}%</span>
                  ) : (
                    <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
                  )}
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
  {
    key: 'main',
    label: 'ติดตามคนเริ่มงาน',
    value: b.main.total,
    ai: b.main.ai,
    staff: b.main.staff,
  },
  {
    key: 'replacement',
    label: 'ติดตามส่งคนแทน',
    value: b.replacement.total,
    ai: b.replacement.ai,
    staff: b.replacement.staff,
  },
];
