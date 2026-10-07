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
import { Skeleton } from '@/components/ui/skeleton';
import { useCountUp } from '@/hooks/useCountUp';
import { Pill } from '@/components/team-online/TeamKpiCard';
import { TONE } from '@/lib/designTokens';
import type { DeltaPill } from '@/lib/teamOnline';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/**
 * โฉมตามภาพอ้างอิง (เจ้าของ 7 ต.ค. 2569 "ทำให้สวยแบบรูป ห้ามเพิ่ม หรือ เอาข้อมูลอะไรฉันออก")
 * กล่อง = แถบหัวสีเข้ม (ป้าย) + แผ่นขาวด้านใน (เลข · ชิป · บรรทัดท้าย/แถบ) · ทั้งหมด = เบอร์กันดี · ที่เหลือ = กรมท่า
 */
const OUTER = cn(
  'h-full w-full flex-col items-stretch justify-start gap-0 whitespace-normal rounded-2xl p-2 text-left font-normal',
  'shadow-xl shadow-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-2xl disabled:opacity-100',
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
  /** กล่องหลัก (ทั้งหมด) — แถบหัวเบอร์กันดี */
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
          ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
          : 'bg-foreground text-background hover:bg-foreground hover:text-background dark:bg-accent dark:text-foreground dark:hover:bg-accent dark:hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-3 px-3 py-3">
        {/* วงกลมหน้าป้ายแบบภาพอ้างอิง (ไม่มีไอคอน — เจ้าของไม่เอาอิโมจิ) · จุดสีของก้อน */}
        {dotClass ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/15" aria-hidden>
            <span className={cn('h-3 w-3 rounded-full ring-2 ring-background/40', dotClass)} />
          </span>
        ) : null}
        <span className="truncate text-base font-medium">{label}</span>
      </span>
      <span className="block flex-1 space-y-3 rounded-xl bg-card p-5 text-foreground">
        <span className="flex flex-wrap items-start justify-between gap-2">
          {loading ? (
            // ในปุ่มห้ามมีกล่องที่ตั้งขนาดเอง (เทสต์ typographyRules) — ระหว่างโหลดขึ้นขีดจาง ๆ ขนาดเท่าตัวเลข
            <span className="block text-4xl font-medium text-muted-foreground">—</span>
          ) : (
            <span className="block text-4xl font-medium tabular-nums">
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
