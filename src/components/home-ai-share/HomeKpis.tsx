/**
 * ═══ กล่องตัวเลขของหน้าหลัก โฉมผู้บริหาร (เจ้าของ 7 ต.ค. 2569 ส่งภาพอ้างอิง 2 ภาพ "อยากไปประมาณนี้ แต่ขอโทนสีแบบของระบบฉัน") ═══
 * - กล่อง = แถบหัวสี (ป้าย) + แผ่นขาวด้านใน (เลขใหญ่ · ชิปเทียบช่วงก่อน · แถบสัดส่วน/บรรทัดท้าย) แบบภาพ "Total Revenue"
 * - ทั้งหมด = แถบหัวกรมท่า (`foreground` · โหมดมืด `accent`) · กล่องอื่น = แถบหัวเทา (`muted`)
 * - ทุกกล่องเป็นปุ่ม (กดแล้วหน้าเปิดป๊อป) · ชื่อปุ่ม = ป้าย + เลข (+ หน่วย) แบบเดิม · เลข 0 = กดไม่ได้ หน้าตาเท่าเดิม
 * - `RangeSummary` = "รวมทั้งช่วง" คอลัมน์ขวา (แบบรายการ "Win Rate by Region") · ติดตาม = แยก 2 แท็บ · หัวข้ออื่น = แยกก้อน
 * ชิปเทียบช่วงก่อน = `countPill` (ไม่ลงสีดี/เสีย) · % แถบ = `segmentsOfTotal` (ปัดรวม 100)
 * 🔴 shadcn Button/Card + Tailwind · สีจากตัวแปรธีม/TONE · ไอคอนเส้นตามแบบ Codex (8 ต.ค. 2569 · ห้ามอิโมจิ) · ไม่มีประโยคอธิบายบนจอ
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/hooks/useCountUp';
import { Pill } from '@/components/team-online/TeamKpiCard';
import { TONE, type ToneKey } from '@/lib/designTokens';
import type { DeltaPill } from '@/lib/teamOnline';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/**
 * โฉมแบบ Codex (เจ้าของ 8 ต.ค. 2569 "ลองให้ Codex ออกแบบความสวยงามมาให้") — แทนแถบหัวสีเข้มของ 7 ต.ค.
 * กล่อง = พื้นอ่อนตามสีของก้อน (ทั้งหมด = การ์ดขาว) · ไอคอนเส้นในกรอบสี่เหลี่ยม · ป้าย · เลขใหญ่ + หน่วย · ชิปเทียบช่วงก่อน · แถบ %
 */
const OUTER = cn(
  'h-full w-full flex-col items-stretch justify-start gap-3 whitespace-normal rounded-xl border border-foreground/10 p-4 text-left font-normal',
  'shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-100',
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
  tone,
  icon: Icon,
  breakdown,
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
  /** สีของก้อน (AI โทร = กรมท่า · คนโทร = ม่วง …) — ไม่ส่ง = การ์ดขาว */
  tone?: ToneKey;
  icon?: LucideIcon;
  /**
   * เลขนี้แบ่งเป็นอะไรบ้าง (เจ้าของ 8 ต.ค. 2569 "AI โทร 162 โทรหมดเลยใช่ไหม หรือแค่บอกว่าสายที่จะต้องโทร · คน 302 คือต้องโทร
   * หรือโทรไปแล้ว มันต้องตอบได้แบบนี้เลย") — ติดตาม: โทรแล้ว · รอโทร · ยกเลิก · รวมกัน = เลขใหญ่ · มีแล้วแทนแถบ %
   */
  breakdown?: ReadonlyArray<{ key: string; label: string; value: number; tone?: ToneKey }> | null;
  hint?: string;
  onClick?: () => void;
  liveKey?: string;
  /** กล่องหลัก (ทั้งหมด) — ตัวเลขเบอร์กันดี */
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
      className={cn(OUTER, 'text-foreground hover:text-foreground', tone ? TONE[tone].wash : 'bg-card hover:bg-card')}
    >
      <span className="flex items-center gap-3">
        {Icon ? (
          <span
            className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-card', tone ? TONE[tone].value : 'text-primary')}
            aria-hidden
          >
            <Icon />
          </span>
        ) : null}
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2">
        {loading ? (
          // ในปุ่มห้ามมีกล่องที่ตั้งขนาดเอง (เทสต์ typographyRules) — ระหว่างโหลดขึ้นขีดจาง ๆ ขนาดเท่าตัวเลข
          <span className="block text-3xl font-medium text-muted-foreground">—</span>
        ) : (
          <span className={cn('block text-3xl font-medium tabular-nums', emphasis ? 'text-primary' : 'text-foreground')}>
            {NUM.format(shown)}
            {unit ? (
              <>
                {' '}
                <span className="text-sm font-normal text-muted-foreground">{unit}</span>
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
      {breakdown?.length ? (
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums" data-testid={`tile-breakdown-${label}`}>
          {breakdown.map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
              <span className={cn('h-2 w-2 rounded-full', TONE[b.tone ?? 'neutral'].dot)} aria-hidden />
              {b.label} <span className="font-medium text-foreground">{NUM.format(b.value)}</span>
            </span>
          ))}
        </span>
      ) : share !== null && share !== undefined ? (
        <span className="flex items-center gap-2">
          <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-card" aria-hidden>
            <span className={cn('block h-full rounded-full bg-current', shareClass)} style={{ width: `${share}%` }} />
          </span>
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{NUM.format(share)}%</span>
        </span>
      ) : null}
      {foot ? (
        <span className="block text-xs tabular-nums text-muted-foreground" title={pillTitle}>
          {foot}
        </span>
      ) : null}
    </Button>
  );
}
