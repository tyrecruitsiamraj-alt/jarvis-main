/**
 * ═══ ภาพรวมแบบ Mobix (เจ้าของ 18 พ.ย. 2569 "ทำแบบร่างหน้าภาพรวมแบบ Mobix" → "หน้าภาพรวม ที่ยังต้องบอกเรื่อง Autopost โพสต์เอง Scrap ด้วย") ═══
 * ต้องทำ (บนสุด · ณ ตอนนี้) · การสั่งงาน (Autopost / โพสต์เอง / Scrap ในช่วง) · แนวโน้มรายวัน · ความเคลื่อนไหวล่าสุด
 * ตัวเลขทุกตัวมาจากของที่หน้ามีอยู่แล้ว (backlog ของ recruit-overview · รายการโพสต์ · งานรายคน · รายชื่อในช่วง) — ไม่คิดนิยามใหม่
 */
import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarX, FileText, PhoneCall, UserRoundSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { pageOf } from '@/lib/recruitAudience';
import { aiBranchOf } from '@/lib/recruitPersonJourney';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import type { StaffActivityFeedItem } from '@/lib/staffActivity';
import { Pager, fmt } from './V2Parts';

/* ── ต้องทำ ── */
export type TodoItem = { key: string; n: number | null; title: string; sub: string; tone: ToneKey; icon: React.ElementType; onOpen?: () => void };

export function TodoList({ items }: { items: readonly TodoItem[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="v2-todo">
      {items.map((it) => {
        const Icon = it.icon;
        const body = (
          <>
            <Icon className={cn('h-5 w-5 shrink-0', TONE[it.tone].value)} aria-hidden />
            <span className={cn('w-16 shrink-0 text-right text-2xl font-medium tabular-nums', TONE[it.tone].value)}>{fmt(it.n)}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{it.title}</span>
              <span className={cn('block text-xs', DASH.sub)}>{it.sub}</span>
            </span>
          </>
        );
        return it.onOpen ? (
          <button key={it.key} type="button" onClick={it.onOpen} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/70" data-testid={`v2-todo-${it.key}`}>
            {body}
          </button>
        ) : (
          <div key={it.key} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5" data-testid={`v2-todo-${it.key}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ── การสั่งงาน: Autopost / โพสต์เอง / Scrap — ไม่มีไอคอน ไม่มีบรรทัดรอง (เจ้าของ 19 พ.ย. 2569) ── */
export type OutreachTile = { key: 'autopost' | 'self' | 'scrap'; n: number | null; unit: string; onOpen?: () => void };
const OUTREACH_LABEL: Record<OutreachTile['key'], string> = { autopost: 'Autopost', self: 'โพสต์เอง', scrap: 'Scrap' };

export function OutreachTiles({ tiles }: { tiles: readonly OutreachTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="v2-outreach">
      {tiles.map((t) => {
        const body = (
          <>
            <span className={cn('text-xs', DASH.sub)}>{OUTREACH_LABEL[t.key]}</span>
            <span className="text-3xl font-medium tabular-nums text-foreground">
              {fmt(t.n)} <span className={cn('text-sm font-normal', DASH.sub)}>{t.unit}</span>
            </span>
          </>
        );
        return t.onOpen ? (
          <button key={t.key} type="button" onClick={t.onOpen} className="flex min-w-0 flex-col items-start gap-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-left transition-colors hover:bg-muted/70" data-testid={`v2-outreach-${t.key}`}>
            {body}
          </button>
        ) : (
          <div key={t.key} className="flex min-w-0 flex-col items-start gap-1 rounded-xl border border-border bg-muted/30 px-3 py-2.5" data-testid={`v2-outreach-${t.key}`}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

/* ── แนวโน้มรายวัน ── */
const bkkDay = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10) : null);
const dayLabel = (ymd: string) => `${Number(ymd.slice(8, 10))}/${Number(ymd.slice(5, 7))}`;

export type DailyPoint = { day: string; apps: number; yes: number; no: number; noPickup: number; other: number };

/** รายชื่อในช่วง → ต่อวัน: ใบสมัครเข้า (วันที่สมัคร) · ผล AI (วันที่ได้ผล) แยก สนใจ / ไม่สนใจ·คนละพื้นที่ / ไม่รับสาย / สรุปไม่ได้ */
export function dailyPulse(cohort: readonly RecruitAppFact[], from: string, to: string): DailyPoint[] {
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && days.length < 92; d = new Date(d.getTime() + 86_400_000)) days.push(d.toISOString().slice(0, 10));
  const m = new Map(days.map((d) => [d, { day: d, apps: 0, yes: 0, no: 0, noPickup: 0, other: 0 }]));
  for (const f of cohort) {
    const a = m.get(bkkDay(f.createdAt) ?? '');
    if (a) a.apps += 1;
    if (!f.calledByAi) continue;
    const r = m.get(bkkDay(f.aiAnswerAt ?? f.firstCalledAt) ?? '');
    if (!r) continue;
    const b = aiBranchOf(f);
    if (b === 'yes') r.yes += 1;
    else if (b === 'no' || b === 'outOfArea') r.no += 1;
    else if (b === 'noPickup') r.noPickup += 1;
    else r.other += 1;
  }
  return [...m.values()];
}

const AI_SERIES: Array<{ key: keyof Omit<DailyPoint, 'day' | 'apps'>; label: string; tone: ToneKey }> = [
  { key: 'yes', label: 'สนใจ', tone: 'success' },
  { key: 'no', label: 'ไม่สนใจ / คนละพื้นที่', tone: 'warn' },
  { key: 'noPickup', label: 'ไม่รับสาย', tone: 'neutral' },
  { key: 'other', label: 'สรุปไม่ได้', tone: 'violet' },
];

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function DailyCharts({ points }: { points: readonly DailyPoint[] }) {
  const data = points.map((p) => ({ ...p, label: dayLabel(p.day) }));
  const peak = points.reduce<DailyPoint | null>((m, p) => (!m || p.apps > m.apps ? p : m), null);
  const aiTotal = (p: DailyPoint) => p.yes + p.no + p.noPickup + p.other;
  const axis = { tick: { fontSize: 11, fill: CHART.axisFill }, tickLine: false } as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-testid="v2-daily">
      <section className="min-w-0 space-y-1">
        <h3 className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
          ใบสมัครเข้าต่อวัน
          <span className={cn('text-xs font-normal tabular-nums', DASH.sub)}>ค่ากลาง {fmt(median(points.map((p) => p.apps)))} ใบต่อวัน</span>
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} {...axis} axisLine={false} />
              <Tooltip {...CHART.tooltipLight} cursor={CHART.cursorBar} formatter={(v: number) => [`${v.toLocaleString('th-TH')} ใบ`, 'ใบสมัคร']} />
              <Bar dataKey="apps" fill={TONE.primary.hex} radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={CHART.animationDuration} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className={cn('text-xs tabular-nums', DASH.sub)}>{peak && peak.apps > 0 ? `สูงสุด ${dayLabel(peak.day)} ${fmt(peak.apps)} ใบ` : 'ไม่มีใบสมัครในช่วงนี้'}</p>
      </section>
      <section className="min-w-0 space-y-1">
        <h3 className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
          ผลโทร AI ต่อวัน · รายการสมัครในช่วงนี้
          <span className={cn('text-xs font-normal tabular-nums', DASH.sub)}>รวม {fmt(points.reduce((n, p) => n + aiTotal(p), 0))} คน</span>
        </h3>
        <div className="flex flex-wrap gap-3 text-xs">
          {AI_SERIES.map((s) => (
            <span key={s.key} className={cn('flex items-center gap-1', DASH.sub)}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TONE[s.tone].hex }} aria-hidden />
              {s.label}
            </span>
          ))}
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" {...axis} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} {...axis} axisLine={false} />
              <Tooltip {...CHART.tooltipLight} cursor={CHART.cursorBar} formatter={(v: number, name: string) => [`${v.toLocaleString('th-TH')} คน`, AI_SERIES.find((s) => s.key === name)?.label ?? name]} />
              {AI_SERIES.map((s) => (
                <Bar key={s.key} dataKey={s.key} stackId="ai" fill={TONE[s.tone].hex} maxBarSize={24} animationDuration={CHART.animationDuration} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

/* ── ความเคลื่อนไหวล่าสุด ── */
const KIND_TONE: Record<string, ToneKey> = {
  'สั่ง Autopost': 'info',
  'สั่ง Scrap': 'violet',
  'สร้างลิงก์โพสต์เอง': 'teal',
  'ติดต่อได้': 'success',
  'นัดได้': 'success',
  'นัดหมายไม่สำเร็จ': 'warn',
  'ติดต่อไม่ได้': 'danger',
};
const timeText = (iso: string, today: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString();
  return d.slice(0, 10) === today ? d.slice(11, 16) : `${dayLabel(d.slice(0, 10))} ${d.slice(11, 16)}`;
};

export function ActivityFeed({ items, today, onPerson }: { items: readonly StaffActivityFeedItem[] | null; today: string; onPerson?: (applicationId: string, name: string) => void }) {
  const [page, setPage] = React.useState(1);
  React.useEffect(() => setPage(1), [items]);
  const pg = pageOf(items ?? [], page, 10);
  return (
    <div className="space-y-2" data-testid="v2-feed">
      <div className="overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead>เรื่อง</TableHead>
              <TableHead>ใคร</TableHead>
              <TableHead>กับ</TableHead>
              <TableHead>รายละเอียด</TableHead>
              <TableHead className="text-right">เวลา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pg.slice.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className={DASH.muted}>
                  {items ? 'ไม่มีความเคลื่อนไหวในช่วงนี้' : 'กำลังโหลด…'}
                </TableCell>
              </TableRow>
            ) : (
              pg.slice.map((it, i) => (
                <TableRow key={`${it.at}:${i}`}>
                  <TableCell>
                    <Badge variant="outline" className={cn('whitespace-nowrap font-normal', TONE[KIND_TONE[it.kind] ?? 'neutral'].value)}>
                      {it.kind}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{it.who}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {it.applicationId && onPerson ? (
                      <button type="button" className="text-primary hover:underline" onClick={() => onPerson(it.applicationId as string, it.subject ?? '')}>
                        {it.subject}
                      </button>
                    ) : (
                      (it.subject ?? '—')
                    )}
                  </TableCell>
                  <TableCell className={cn('max-w-72 truncate text-xs', DASH.sub)} title={it.detail ?? undefined}>
                    {it.detail ?? '—'}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{timeText(it.at, today)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {pg.pages > 1 ? <Pager {...pg} onPage={setPage} /> : null}
    </div>
  );
}

export const TODO_ICONS = { PhoneCall, UserRoundSearch, CalendarX, FileText } as const;
