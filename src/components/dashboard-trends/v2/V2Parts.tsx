/**
 * ชิ้นส่วนของหน้าภาพรวมงานสรรหา v2 (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP v2)
 * ยอดใหญ่กดได้ · หัวข้อส่วน · แท่งเทียบ BU · แท่งตามวันที่สมัคร · ตัวแบ่งหน้า 10 แถว
 * ไม่ทราบ = "—" เสมอ (ห้ามโชว์ 0 แทน) · ตัวเลขเรียงตรงด้วย tabular-nums
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber } from '@/lib/trends/format';
import type { BuBarValue } from '@/lib/recruitAudience';
import type { TrendSense } from '@/lib/recruitScale';
import TrendDelta from '../stuck/TrendDelta';

export const fmt = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : formatTrendNumber(n));
export const fmtPct = (n: number | null | undefined): string => (n === null || n === undefined ? '—' : `${n.toFixed(1)}%`);

/** สีประจำ BU (คงที่ — ไม่ใช้สีที่มีความหมาย เขียว/เหลือง/แดง) */
const BU_TONE: Record<string, ToneKey> = { LBD: 'primary', LBA: 'violet', LM: 'teal', DS: 'info', SN: 'orange' };
export const buDot = (bu: string): string => TONE[BU_TONE[bu] ?? 'neutral'].dot;

export function SectionTitle({ title, right, id }: { title: string; right?: React.ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 id={id} className="text-lg font-medium text-foreground">
        {title}
      </h2>
      {right ? <div className={cn('text-xs', DASH.sub)}>{right}</div> : null}
    </div>
  );
}

/** ยอดใหญ่ — กดเปิดรายละเอียดด้านข้าง · `emphasis` = ยอดหลักของส่วน (ตัวใหญ่กว่า) */
export function Kpi({
  label,
  value,
  onClick,
  emphasis = false,
  tone,
  active = false,
  testId,
  prev,
  sense = 'good',
}: {
  label: string;
  value: number | null | undefined;
  onClick?: () => void;
  emphasis?: boolean;
  tone?: ToneKey;
  active?: boolean;
  testId?: string;
  /** ยอดช่วงก่อน (ช่วงวันเท่ากัน) — ไม่ส่ง = ไม่มีป้ายเทียบ · null = "เทียบไม่ได้" */
  prev?: number | null;
  sense?: TrendSense;
}) {
  const body = (
    <>
      <span className={cn('text-xs', tone ? TONE[tone].value : DASH.sub)}>{label}</span>
      <span className={cn('font-medium tabular-nums text-foreground', emphasis ? 'text-4xl' : 'text-2xl', tone && TONE[tone].value)}>{fmt(value)}</span>
      {prev !== undefined ? <TrendDelta cur={value} prev={prev} sense={sense} /> : null}
    </>
  );
  if (!onClick) return <div className="flex min-w-0 flex-col gap-1">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        'flex min-w-0 flex-col items-start gap-1 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-muted',
      )}
    >
      {body}
    </button>
  );
}

/** แท่งเทียบ BU — เรียงตามลำดับที่ส่งมา · กดแถว = รายละเอียดของ BU นั้น · `sample` = จำนวนรายการฐาน (โหมด %) */
export function BuBars({
  bars,
  unit,
  rate = false,
  onPick,
  showSample = false,
}: {
  bars: readonly BuBarValue[];
  unit: string;
  rate?: boolean;
  onPick?: (bu: string) => void;
  showSample?: boolean;
}) {
  const max = Math.max(rate ? 0 : 1, ...bars.map((b) => b.value ?? 0)) || 1;
  return (
    <ul className="space-y-1.5" data-testid="v2-bu-bars">
      {bars.map((b) => {
        const row = (
          <>
            <span className="w-20 shrink-0 text-left text-sm">
              {b.bu}
              {showSample ? <span className={cn('block text-xs', DASH.sub)}>จาก {fmt(b.sample)} รายการ</span> : null}
            </span>
            <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span className={cn('absolute inset-y-0 left-0 rounded-full', buDot(b.bu))} style={{ width: `${((b.value ?? 0) / max) * 100}%` }} />
            </span>
            <span className="w-16 shrink-0 text-right text-sm font-medium tabular-nums" aria-label={`${b.bu} ${rate ? fmtPct(b.value) : `${fmt(b.value)} ${unit}`}`}>
              {rate ? fmtPct(b.value) : fmt(b.value)}
            </span>
            {onPick ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </>
        );
        return (
          <li key={b.bu}>
            {onPick ? (
              <button type="button" onClick={() => onPick(b.bu)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {row}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-1 py-1">{row}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** แท่งตามวันที่สมัคร (จำนวนผล) — กดแท่ง = ส่งคีย์กลับ (เดือน → เจาะรายวัน · วัน → รายชื่อ) */
export function TrendBars({
  points,
  onPick,
  labelOf,
}: {
  points: ReadonlyArray<{ key: string; n: number | null }>;
  onPick?: (key: string) => void;
  labelOf: (key: string) => string;
}) {
  const max = Math.max(1, ...points.map((p) => p.n ?? 0));
  return (
    <div className="overflow-x-auto" data-testid="v2-trend">
      <div className="flex h-40 min-w-full items-end gap-1" style={{ width: points.length > 20 ? `${points.length * 1.5}rem` : undefined }}>
        {points.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(p.key)}
            aria-label={`${labelOf(p.key)} ${fmt(p.n)} รายการ`}
            className="group flex h-full min-w-5 flex-1 flex-col items-center justify-end gap-1 focus-visible:outline-none"
          >
            <span className="text-xs tabular-nums text-muted-foreground">{fmt(p.n)}</span>
            <span className="w-full rounded-t-md bg-primary/80 group-hover:bg-primary group-focus-visible:ring-2 group-focus-visible:ring-ring" style={{ height: `${((p.n ?? 0) / max) * 100}%`, minHeight: p.n ? 2 : 0 }} />
            <span className="truncate text-xs text-muted-foreground">{labelOf(p.key)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** ตัวแบ่งหน้า — "1–10 จาก 14" + ก่อนหน้า/ถัดไป · ไม่ถึง 1 หน้ายังโชว์ช่วง (ของบนจอไม่ขยับ) */
export function Pager({ page, pages, from, to, total, onPage, testId }: { page: number; pages: number; from: number; to: number; total: number; onPage: (p: number) => void; testId?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2" data-testid={testId}>
      <span className={cn('text-xs tabular-nums', DASH.sub)}>
        {total ? `${fmt(from)}–${fmt(to)} จาก ${fmt(total)}` : 'ไม่มีรายการ'}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" size="xs" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ก่อนหน้า
        </Button>
        <span className="px-2 text-xs tabular-nums text-muted-foreground">
          {page}/{pages}
        </span>
        <Button type="button" size="xs" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          ถัดไป
        </Button>
      </div>
    </div>
  );
}
