/**
 * ชิ้นส่วนของหน้าหลักสรุปหน้าเดียว (เจ้าของ 28 ต.ค. 2569) — กล่องกดได้ · แถบช่องทาง · แผงข้าง
 * สีบอกความสำคัญแบบเฉดเรียบ (Choice "แดง·เหลือง·เขียว ขอเฉดสีแบบ minimal") — ทุกสีมีคำกำกับ ไม่บอกด้วยสีอย่างเดียว
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import Num from '@/components/home-exec/Num';
import { FUNNEL_CHANNELS, type FunnelChannel } from '@/lib/homeOverviewFunnel';
import { FOUR_MAIN_OTHER } from '@/lib/channelFourMain';

/** ช่องทางที่โชว์ในป้าย/ตาราง — "อื่น ๆ" ขึ้นเฉพาะเมื่อมีคน */
const shownChannels = (channels?: Record<FunnelChannel, number>) =>
  FUNNEL_CHANNELS.filter((c) => c !== FOUR_MAIN_OTHER || (channels?.[c] ?? 0) > 0);
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

export const NUM = new Intl.NumberFormat('th-TH');

export type Emphasis = 'danger' | 'warn' | 'success' | null;

/** หัวส่วน — ชื่อ + บรรทัดหน่วย + มุมขวา */
export function OverviewSection({
  title,
  sub,
  right,
  children,
  testId,
  className,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <Card variant="solid" className={cn('min-w-0 space-y-4 p-5 sm:p-6', className)} data-testid={testId}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

/** กล่องตัวเลขที่กดได้ — สีพื้นเฉดเรียบตามความสำคัญ · ป้ายคำบอกสถานะ */
export function OverviewNode({
  label,
  value,
  unit,
  sub,
  emphasis = null,
  tag,
  big = false,
  variant = 'fill',
  onClick,
  testId,
  className,
  children,
}: {
  label: string;
  value: number | null | undefined;
  unit?: string;
  sub?: React.ReactNode;
  emphasis?: Emphasis;
  tag?: string;
  big?: boolean;
  /**
   * fill = พื้นเทา · outline = กล่องขาวมีเส้นขอบ ·
   * hero = ตัวเลขบนแถบกรมท่าด้านบน (แบบร่าง A "หัวกรมท่า" เจ้าของเลือก 9 พ.ย. 2569 · big = เลขเหลือหาตัวใหญ่) ·
   * solid = พื้นเบอร์กันดี ใช้กับผลลัพธ์ของสมการ
   */
  variant?: 'fill' | 'outline' | 'hero' | 'solid';
  onClick?: () => void;
  testId?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  /** ตัวหนังสือรองบนพื้นเข้ม (hero/solid) จางลง · พื้นอ่อนใช้เทา · ธีมมืดแถบ hero เป็นการ์ดเข้ม ตัวหนังสือสว่าง */
  const dim = variant === 'hero' ? 'text-background/70 dark:text-foreground/70' : variant === 'solid' ? 'text-primary-foreground/80' : 'text-muted-foreground';
  return (
    // ปุ่มของ shadcn (CLAUDE.md "ห้ามสร้าง Button ใหม่เอง") — ghost + จัดเป็นการ์ดแนวตั้ง
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      className={cn(
        'h-auto min-w-0 flex-col items-stretch justify-start gap-1 whitespace-normal rounded-xl p-3 text-left font-normal transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-100 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        variant === 'fill' && (emphasis ? TONE[emphasis].wash : 'bg-muted/50 hover:bg-muted'),
        variant === 'outline' && 'border border-border bg-card hover:bg-muted/50',
        variant === 'hero' && 'gap-2 rounded-2xl p-4 text-background hover:bg-background/10 hover:text-background dark:text-foreground dark:hover:bg-foreground/10 dark:hover:text-foreground',
        variant === 'solid' && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
        big && 'p-4',
        className,
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className={cn(variant === 'hero' ? 'text-sm' : 'text-xs', dim)}>{label}</span>
        {tag && emphasis ? (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', variant === 'hero' ? 'bg-background/15 text-background dark:bg-foreground/15 dark:text-foreground' : [TONE[emphasis].soft, TONE[emphasis].value])}>
            {tag}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          'font-medium tabular-nums',
          variant === 'hero' ? (big ? 'text-6xl leading-none sm:text-7xl' : 'text-4xl') : big ? 'text-4xl' : 'text-2xl',
          variant === 'solid' ? 'text-primary-foreground' : variant === 'hero' ? 'text-background dark:text-foreground' : !emphasis ? 'text-foreground' : TONE[emphasis].num,
        )}
      >
        <Num value={value} />
        {unit ? <span className={cn('ml-1 font-normal', big && variant === 'hero' ? 'text-2xl' : 'text-sm', dim)}>{unit}</span> : null}
      </span>
      {sub ? <span className={cn('tabular-nums', variant === 'hero' ? 'text-sm' : 'text-xs', dim)}>{sub}</span> : null}
      {children}
    </Button>
  );
}

/**
 * แถวของเส้นผู้สมัคร แบบร่าง B (2 พ.ย. 2569): ชื่อขั้น · แท่งยาวตามจำนวน (เลขในแท่ง) + แถบช่องทางใต้แท่ง · ตัวเลขย่อยขวามือ
 * ทั้งแถวกดได้ (ปุ่ม shadcn)
 */
export function OverviewBarRow({
  label,
  value,
  max,
  onClick,
  testId,
  strip,
  children,
}: {
  label: string;
  value: number | null;
  max: number;
  onClick?: () => void;
  testId?: string;
  strip?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  const pct = value && max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      aria-label={`${label} ${value === null ? '' : NUM.format(value)}`}
      className="grid h-auto w-full grid-cols-1 items-center gap-2 whitespace-normal rounded-xl px-3 py-2 text-left font-normal disabled:opacity-100 sm:grid-cols-5 sm:gap-4"
    >
      <span className="text-sm text-foreground">{label}</span>
      <span className="min-w-0 space-y-1 sm:col-span-2">
        <span className="block h-8 overflow-hidden rounded-lg bg-muted" aria-hidden>
          <span
            className="flex h-full min-w-10 items-center rounded-lg bg-foreground px-3 text-sm font-medium tabular-nums text-background transition-all duration-700 motion-reduce:transition-none"
            style={{ width: shown ? `${pct}%` : '0%' }}
          >
            {value === null ? '—' : NUM.format(value)}
          </span>
        </span>
        {strip ? (
          <span className="block transition-all duration-700 motion-reduce:transition-none" style={{ width: shown ? `${pct}%` : '0%' }}>
            {strip}
          </span>
        ) : null}
      </span>
      <span className="min-w-0 text-xs tabular-nums sm:col-span-2">{children}</span>
    </Button>
  );
}

/** สีของช่องทาง — สีประจำกลุ่ม ไม่ใช้สีที่มีความหมาย (เขียว/เหลือง/แดง) */
export const CHANNEL_TONE: Record<FunnelChannel, ToneKey> = {
  Facebook: 'info',
  Tiktok: 'primary',
  Webjob: 'teal',
  Offline: 'orange',
  iRecruit: 'violet',
  'อื่น ๆ': 'neutral',
};

/** แถบช่องทางบาง ๆ ใต้ขั้น — กว้างวิ่งเข้าตอนเปิดหน้า · ชิ้นรวมกัน = เลขของขั้น */
export function ChannelStrip({ channels, total }: { channels: Record<FunnelChannel, number>; total: number }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setShown(true), 60);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <span className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      {FUNNEL_CHANNELS.map((c) => (
        <span
          key={c}
          className={cn('block h-full transition-all duration-700 motion-reduce:transition-none', TONE[CHANNEL_TONE[c]].dot)}
          style={{ width: shown && total > 0 ? `${(channels[c] / total) * 100}%` : '0%' }}
          title={`${c} ${NUM.format(channels[c])}`}
        />
      ))}
    </span>
  );
}

export function ChannelLegend({ channels }: { channels?: Record<FunnelChannel, number> }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {shownChannels(channels).map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', TONE[CHANNEL_TONE[c]].dot)} aria-hidden />
          {c}
        </span>
      ))}
    </div>
  );
}

/** ตารางช่องทางในแผง — คน + สัดส่วน · แถวรวมท้าย */
export function ChannelTable({ channels }: { channels: Record<FunnelChannel, number> }) {
  const total = FUNNEL_CHANNELS.reduce((n, c) => n + channels[c], 0);
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">มาจากช่องทางไหน</p>
      <ul className="space-y-1.5">
        {shownChannels(channels).map((c) => (
          <li key={c} className="flex items-center gap-2 text-sm">
            <span className="flex w-32 shrink-0 items-center gap-1.5 truncate">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', TONE[CHANNEL_TONE[c]].dot)} aria-hidden />
              {c}
            </span>
            <span className="block h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className={cn('block h-full', TONE[CHANNEL_TONE[c]].dot)} style={{ width: total ? `${(channels[c] / total) * 100}%` : '0%' }} />
            </span>
            <span className="w-12 shrink-0 text-right tabular-nums">{NUM.format(channels[c])}</span>
            <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{total ? Math.round((channels[c] / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
      <p className="text-xs tabular-nums text-muted-foreground">รวม {NUM.format(total)} คน</p>
    </div>
  );
}

/** ตารางสองช่อง (ชื่อ · เลข) ในแผง */
export function PanelRows({
  rows,
  unit,
}: {
  /** `onOpen` = แถวกดได้ (เปิดรายชื่อ/รายใบของแถวนั้น · เจ้าของ 9 พ.ย. 2569 "บอกชื่อกดไปต้องเห็นชื่อ") */
  rows: ReadonlyArray<{ label: string; value: number; emphasis?: Emphasis; onOpen?: () => void }>;
  unit?: string;
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {rows.map((r) => {
        const inner = (
          <>
            <span className={cn(r.emphasis ? TONE[r.emphasis].value : 'text-foreground')}>{r.label}</span>
            <span className="tabular-nums font-medium">
              {NUM.format(r.value)}
              {unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span> : null}
            </span>
          </>
        );
        return (
          <li key={r.label} className="text-sm">
            {r.onOpen && r.value > 0 ? (
              <Button
                type="button"
                variant="ghost"
                onClick={r.onOpen}
                className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-3 py-2 text-left font-normal"
                data-testid="panel-row-open"
              >
                {inner}
              </Button>
            ) : (
              <span className="flex items-center justify-between gap-3 px-3 py-2">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type OverviewPanel = {
  title: string;
  sub?: string;
  body: React.ReactNode;
  /** ปุ่มไปหน้าเต็มของเรื่องนั้น */
  go?: { label: string; to: string };
  /** แผงกว้าง — มีตารางเทียบหลายคอลัมน์ (เทียบ BU รายเดือน) */
  wide?: boolean;
};

/** แผงข้างตัวเดียวของหน้า — กดกล่องไหนก็เปิดแผงนี้ (ไม่ซ้อนแผง) */
export function OverviewSheet({ panel, onClose, contentStyle }: { panel: OverviewPanel | null; onClose: () => void; contentStyle?: React.CSSProperties }) {
  const navigate = useNavigate();
  return (
    <Sheet open={panel !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className={cn('w-full space-y-4 overflow-y-auto', panel?.wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} style={contentStyle} data-testid="overview-sheet">
        {panel ? (
          <>
            <SheetHeader>
              <SheetTitle>{panel.title}</SheetTitle>
              <SheetDescription className={panel.sub ? 'tabular-nums' : 'sr-only'}>{panel.sub ?? panel.title}</SheetDescription>
            </SheetHeader>
            {panel.body}
            {panel.go ? (
              <Button type="button" className="w-full" onClick={() => navigate(panel.go!.to)} data-testid="overview-go">
                ไปหน้าเต็ม · {panel.go.label}
              </Button>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
