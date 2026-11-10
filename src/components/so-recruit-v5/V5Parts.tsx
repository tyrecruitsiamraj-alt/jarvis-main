/**
 * ═══ ชิ้นส่วนโฉมต้นแบบ SO Recruit (เจ้าของ 10 พ.ย. 2569 ชุดส่งต่อ · Choice "สีตามต้นแบบ เฉพาะสองหน้านี้") ═══
 * ใช้กับหน้าหลัก `?home=v5` และภาพรวมงานสรรหา `&dash=v5` เท่านั้น — การ์ดขาว เส้นบาง มุม 2xl ไม่เงาหนัก ตัวเลข tabular
 * ตัวเลขที่ยังโหลดไม่เสร็จ/อ่านไม่ได้ = "—" (ห้ามค้างเลขช่วงเก่าใต้ป้ายช่วงใหม่ · ห้ามแทนด้วย 0)
 */
import React, { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SO_RECRUIT_V5_THEME } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUMBER = new Intl.NumberFormat('th-TH');
const MONEY = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** เลขไทยคั่นหลัก · null = "—" (ยังไม่มี/อ่านไม่ได้) */
export const v5Num = (n: number | null | undefined, money = false) => (n == null || !Number.isFinite(n) ? '—' : (money ? MONEY : NUMBER).format(n));

/** ธีมต้นแบบเฉพาะในกล่องของหน้า — ธีมมืดไม่ทับ (ใช้ธีมมืดเดิม) */
export function useV5ThemeStyle(): React.CSSProperties | undefined {
  const isDark = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const el = document.documentElement;
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark ? undefined : (SO_RECRUIT_V5_THEME as React.CSSProperties);
}

/** การ์ดของส่วน — หัวเรื่อง + บรรทัดรอง + มุมขวา */
export function V5Card({
  title,
  sub,
  right,
  children,
  className,
  testId,
}: {
  title?: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <section className={cn('min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5 sm:p-6', className)} data-testid={testId}>
      {title || right ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            {title ? <h2 className="text-lg font-medium text-foreground">{title}</h2> : null}
            {sub ? <p className="text-sm text-muted-foreground">{sub}</p> : null}
          </div>
          {right}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** KPI บนสุด — ป้าย + ไอคอน · เลขใหญ่ + หน่วย · บรรทัดล่างสองฝั่ง · `wine` = กล่องเน้น (เงิน) */
export function V5Kpi({
  label,
  icon: Icon,
  value,
  unit,
  money = false,
  left,
  right,
  wine = false,
  onClick,
  testId,
}: {
  label: string;
  icon: LucideIcon;
  value: number | null | undefined;
  unit: string;
  money?: boolean;
  left?: React.ReactNode;
  right?: React.ReactNode;
  wine?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      className={cn(
        'h-auto min-w-0 flex-col items-stretch justify-start gap-3 whitespace-normal rounded-2xl border p-5 text-left font-normal transition-colors disabled:opacity-100 motion-reduce:transition-none',
        wine ? 'border-primary/20 bg-primary/5 hover:bg-primary/10' : 'border-border bg-card hover:bg-muted/60',
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="text-muted-foreground" aria-hidden />
      </span>
      <span className={cn('text-4xl font-medium tabular-nums leading-none', wine ? 'text-primary' : 'text-foreground')}>
        {v5Num(value, money)}
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">{unit}</span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs tabular-nums text-muted-foreground">
        <span>{left}</span>
        <span>{right}</span>
      </span>
    </Button>
  );
}

/** ช่องของสมการ — ป้าย (มีเครื่องหมายนำ) · เลข · หน่วย · `result` = ช่องผลลัพธ์พื้นเทา */
export function V5EqCell({
  label,
  value,
  unit = 'ใบ',
  sub,
  result = false,
  onClick,
  testId,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  sub?: React.ReactNode;
  result?: boolean;
  onClick?: () => void;
  testId?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      className={cn(
        'h-auto min-w-0 flex-col items-start justify-start gap-1 whitespace-normal rounded-xl p-3 text-left font-normal disabled:opacity-100',
        result ? 'bg-muted hover:bg-muted/70' : 'hover:bg-muted/60',
      )}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-3xl font-medium tabular-nums leading-tight', result ? 'text-primary' : 'text-foreground')}>{v5Num(value)}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{sub ?? unit}</span>
    </Button>
  );
}

/** แถบสัดส่วนบาง · `pct` 0–100 */
export function V5Bar({ pct, muted = false }: { pct: number; muted?: boolean }) {
  const w = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <span className={cn('block h-full rounded-full transition-all duration-500 motion-reduce:transition-none', muted ? 'bg-foreground/50' : 'bg-primary')} style={{ width: `${w}%` }} />
    </span>
  );
}

/** หัวคั่นส่วน "หลังได้คน" — ป้ายเล็ก + เส้น */
export function V5Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

/** ปุ่มตัวเลขในตาราง — "14 ›" กดได้ · 0 ก็กดได้ (ได้รายการว่าง ไม่ใช่รายการครั้งก่อน) */
export function V5NumLink({ value, onClick, label, testId }: { value: number | null | undefined; onClick?: () => void; label: string; testId?: string }) {
  return (
    <Button
      type="button"
      variant="link"
      onClick={onClick}
      disabled={!onClick || value == null}
      aria-label={`${label} ${v5Num(value)}`}
      data-testid={testId}
      className="h-auto gap-1 p-0 font-medium tabular-nums text-foreground"
    >
      {v5Num(value)}
      <span className="text-muted-foreground" aria-hidden>
        ›
      </span>
    </Button>
  );
}
