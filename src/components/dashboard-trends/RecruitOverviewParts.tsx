import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  CalendarClock,
  CheckCircle2,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import {
  DAILY_METRIC_LABEL,
  dailySummary,
  staffTableRows,
  type ChannelRow,
  type DailyMetric,
  type DailyRow,
  type DelayRow,
  type FunnelStep,
  type PositionRow,
  type ReasonGroup,
  type StaffSortKey,
} from '@/lib/recruitOverview';
import type { RecruitAiRow, RecruitBacklog, RecruitStaffRow } from '@/lib/recruitOverviewTypes';
import { DeltaChip } from './TrendParts';

/**
 * ═══ ชิ้นส่วนหน้า "ภาพรวมงานสรรหา" แบบ iRecruit (30 ก.ย. 2569) ═══
 * วาดอย่างเดียว — ตัวเลขทุกตัวมาจาก `src/lib/recruitOverview.ts` (มีเทสต์) ห้ามนับเองในไฟล์นี้
 * 🔴 shadcn (Card · Button) + recharts · สีจาก `TONE` / `CHART` · หน่วย = รายชื่อ · อ่านไม่ได้ = "—"
 */

/** 🔴 `Intl` ระดับโมดูลเสมอ (เคยทำเส้นช้า 4.7 วิ ตอนสร้างใหม่ทุกครั้ง) */
const PCT_FORMAT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 });
const pctText = (p: number | null) => (p === null ? '—' : `${PCT_FORMAT.format(p)}%`);
const num = (n: number | null) => (n === null ? '—' : fmt(n));

/** แถบสัดส่วน — ไม่มีตัวหาร/อ่านไม่ได้ = แถบว่าง (ห้ามวาดเป็น 0% ที่แปลว่ารู้แล้วว่าไม่มี) */
export function RatioBar({ pct, tone = 'primary' }: { pct: number | null; tone?: ToneKey }) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      {pct !== null && pct > 0 ? (
        <span className={cn('block h-full rounded-full', TONE[tone].dot)} style={{ width: `${Math.min(100, pct)}%` }} />
      ) : null}
    </span>
  );
}

/** กล่องหนึ่งส่วนของหน้า — ไอคอน · หัวเรื่อง · บรรทัดรอง · ปุ่มฝั่งขวา */
export function OverviewCard({
  icon: Icon,
  title,
  sub,
  badge,
  actions,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  sub?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn('flex min-w-0 flex-col gap-4 rounded-2xl p-4', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
              {title}
              {badge}
            </h3>
            {sub ? <p className={cn('text-xs', DASH.sub)}>{sub}</p> : null}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </Card>
  );
}

/** อ่านก้อนนี้ไม่ได้ — บอกตรง ๆ ไม่โชว์ 0 */
export function SectionError({ message }: { message: string }) {
  return <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.danger.soft, TONE.danger.value)}>{message}</p>;
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className={cn('py-6 text-center text-xs', DASH.sub)}>{children}</p>;
}

/** การ์ดตัวเลขแถวบน (แบบ iRecruit) — ไอคอน + ชื่อ · เลขใหญ่ + เทียบเดือนก่อน · บรรทัดล่าง */
export function OverviewKpi({
  icon: Icon,
  label,
  value,
  previous,
  foot,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  /** null = ไม่เทียบ (เดือนก่อนยังไม่มีข้อมูล / อ่านไม่ได้) */
  previous: number | null;
  foot?: React.ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 rounded-2xl p-4">
      <p className={cn('flex items-center gap-2 text-xs', DASH.sub)}>
        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="truncate">{label}</span>
      </p>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-medium tabular-nums text-foreground">{num(value)}</span>
        {value !== null && previous !== null ? <DeltaChip current={value} previous={previous} polarity="up-good" /> : null}
      </div>
      {foot ? <p className={cn('text-xs tabular-nums', DASH.sub)}>{foot}</p> : null}
    </Card>
  );
}

/* ─────────── เส้นทางของรายชื่อ ─────────── */

const FUNNEL_TONE: Record<FunnelStep['key'], ToneKey> = {
  names: 'primary',
  calledByAi: 'info',
  aiSaidYes: 'success',
  staffFollowed: 'violet',
  appointed: 'teal',
  showed: 'teal',
  onBoard: 'success',
};

export function FunnelList({ steps }: { steps: readonly FunnelStep[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((s) => (
        <li key={s.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-foreground">{s.label}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="font-medium text-foreground">{num(s.value)}</span>
              <span className={cn('w-14 text-right text-xs', DASH.sub)}>{s.note ? '' : pctText(s.pct)}</span>
            </span>
          </div>
          <RatioBar pct={s.pct} tone={FUNNEL_TONE[s.key]} />
          {s.note ? <p className={cn('text-xs', DASH.sub)}>{s.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

/* ─────────── งานค้างตอนนี้ ─────────── */

function BacklogGroup({
  title,
  total,
  unit,
  rows,
  foot,
}: {
  title: string;
  total: number;
  unit: string;
  rows: { label: string; value: number; tone: ToneKey; icon: LucideIcon }[];
  foot?: string | null;
}) {
  return (
    <div className="space-y-2">
      <p className={cn('flex items-center justify-between gap-2 text-xs', DASH.sub)}>
        <span>{title}</span>
        <span className="tabular-nums">
          {fmt(total)} {unit}
        </span>
      </p>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm">
            <span className="flex items-center gap-2 text-foreground">
              <r.icon className={cn('size-4', TONE[r.tone].value)} aria-hidden />
              {r.label}
            </span>
            <span className={cn('font-medium tabular-nums', r.value > 0 ? TONE[r.tone].value : DASH.sub)}>{fmt(r.value)}</span>
          </li>
        ))}
      </ul>
      {foot ? <p className={cn('text-xs', DASH.sub)}>{foot}</p> : null}
    </div>
  );
}

export function BacklogBody({ backlog }: { backlog: RecruitBacklog }) {
  const { uncalled, waitingStaff, appointments } = backlog;
  const extra = [
    uncalled.inQueue > 0 ? `รอ AI โทรอยู่ ${fmt(uncalled.inQueue)}` : null,
    uncalled.badPhone > 0 ? `เบอร์ใช้โทรไม่ได้ ${fmt(uncalled.badPhone)}` : null,
  ].filter(Boolean);
  return (
    <div className="space-y-4">
      <BacklogGroup
        title="ยังไม่มีใครโทร"
        total={uncalled.total}
        unit="รายชื่อ"
        rows={[
          { label: 'กรอกมาไม่เกิน 3 วัน', value: uncalled.d0_3, tone: 'success', icon: CheckCircle2 },
          { label: 'ค้าง 4–7 วัน', value: uncalled.d4_7, tone: 'warn', icon: Clock },
          { label: 'ค้างเกิน 7 วัน', value: uncalled.over7, tone: 'danger', icon: AlertCircle },
        ]}
        foot={extra.length > 0 ? `ในนั้น${extra.join(' · ')}` : null}
      />
      <div className={cn('border-t', DASH.divider)} />
      <BacklogGroup
        title="ตอบ AI ว่าสนใจ รอคนโทรต่อ"
        total={waitingStaff.total}
        unit="รายชื่อ"
        rows={[
          { label: 'ไม่ถึง 1 วัน', value: waitingStaff.d0, tone: 'success', icon: CheckCircle2 },
          { label: 'รอ 1–3 วัน', value: waitingStaff.d1_3, tone: 'warn', icon: Clock },
          { label: 'รอเกิน 3 วัน', value: waitingStaff.over3, tone: 'danger', icon: AlertCircle },
        ]}
      />
      <div className={cn('border-t', DASH.divider)} />
      {appointments ? (
        <BacklogGroup
          title="นัดที่รอบันทึกผล"
          total={appointments.overdue + appointments.next7}
          unit="นัด"
          rows={[
            { label: 'เลยวันนัดแล้ว ยังไม่บันทึกผล', value: appointments.overdue, tone: 'danger', icon: CalendarClock },
            { label: 'นัดใน 7 วันข้างหน้า', value: appointments.next7, tone: 'info', icon: CalendarClock },
          ]}
        />
      ) : (
        <p className={cn('text-xs', DASH.sub)}>นัดที่รอบันทึกผล — ยังอ่านผลนัดไม่ได้</p>
      )}
    </div>
  );
}

/* ─────────── กรอกแล้วโทรวันไหน ─────────── */

const DELAY_TONE: Record<DelayRow['key'], ToneKey> = {
  d0: 'success',
  d1: 'teal',
  d2: 'warn',
  d3: 'warn',
  d4_7: 'orange',
  over7: 'danger',
  none: 'neutral',
};

export function DelayList({ rows }: { rows: readonly DelayRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-foreground">{r.label}</span>
            <span className="flex items-baseline gap-2 tabular-nums">
              <span className="font-medium text-foreground">{fmt(r.count)}</span>
              <span className={cn('w-14 text-right text-xs', DASH.sub)}>{pctText(r.pct)}</span>
            </span>
          </div>
          <RatioBar pct={r.pct} tone={DELAY_TONE[r.key]} />
        </li>
      ))}
    </ul>
  );
}

/* ─────────── รายวัน ─────────── */

const DAILY_METRICS: readonly DailyMetric[] = ['names', 'called', 'aiSaidYes', 'staffFollowed'];

const dayMonthText = (ymd: string) => {
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${Number(ymd.slice(8, 10))} ${months[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(0, 4)) + 543}`;
};

export function DailyCard({ rows, icon }: { rows: readonly DailyRow[]; icon: LucideIcon }) {
  const [metric, setMetric] = useState<DailyMetric>('names');
  const [asTable, setAsTable] = useState(false);
  const s = useMemo(() => dailySummary(rows, metric), [rows, metric]);
  const withNames = useMemo(() => rows.filter((r) => r.names > 0).slice().reverse(), [rows]);
  const label = DAILY_METRIC_LABEL[metric];
  return (
    <OverviewCard
      icon={icon}
      title="รายวัน"
      sub={
        asTable
          ? 'กรอกมาวันไหน โทรหลังกรอกกี่วัน (ครบ 24 ชม. = 1 วัน)'
          : `${metric === 'names' ? 'รายชื่อที่กรอกแต่ละวัน' : `${label} แยกตามวันที่กรอก`} · รวม ${fmt(s.total)}${s.peak ? ` · สูงสุด ${fmt(s.peak.value)} (${dayMonthText(s.peak.ymd)})` : ''}`
      }
      actions={
        <div className="flex flex-wrap items-center gap-1">
          {!asTable ? (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="ดูตัวเลขไหน">
              {DAILY_METRICS.map((m) => (
                <Button
                  key={m}
                  type="button"
                  size="xs"
                  variant={metric === m ? 'default' : 'outline'}
                  aria-pressed={metric === m}
                  onClick={() => setMetric(m)}
                >
                  {DAILY_METRIC_LABEL[m]}
                </Button>
              ))}
            </div>
          ) : null}
          <Button type="button" size="xs" variant="ghost" onClick={() => setAsTable((v) => !v)}>
            {asTable ? 'ดูเป็นกราฟ' : 'ดูเป็นตาราง'}
          </Button>
        </div>
      }
    >
      {asTable ? (
        withNames.length === 0 ? (
          <EmptyNote>ยังไม่มีรายชื่อในเดือนนี้</EmptyNote>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={cn('text-xs', DASH.tableHead)}>
                <tr>
                  {['วันที่กรอก', 'รายชื่อ', 'โทรภายใน 24 ชม.', '1 วัน', '2 วันขึ้นไป', 'ยังไม่ได้โทร', 'ตอบ AI ว่าสนใจ', 'คนโทรต่อแล้ว'].map((h, i) => (
                    <th key={h} className={cn('px-2 py-2 font-medium', i === 0 ? 'text-left' : 'text-right')}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withNames.map((r) => (
                  <tr key={r.ymd} className={cn('border-t', DASH.tableRow)}>
                    <td className={cn('px-2 py-2', DASH.cellStrong)}>{dayMonthText(r.ymd)}</td>
                    {[r.names, r.d0, r.d1, r.d2plus, r.none, r.aiSaidYes, r.staffFollowed].map((v, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-2 py-2 text-right tabular-nums',
                          i === 4 && v > 0 ? TONE.warn.value : DASH.cell,
                        )}
                      >
                        {fmt(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className={cn('h-60 w-full', DASH.sub)} role="img" aria-label={`${label}รายวัน`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows.map((r) => ({ label: String(r.day), ymd: r.ymd, value: r[metric] }))} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
              <Tooltip
                contentStyle={CHART.tooltip.contentStyle}
                labelStyle={CHART.tooltip.labelStyle}
                itemStyle={CHART.tooltip.itemStyle}
                labelFormatter={(_, p) => {
                  const ymd = (p?.[0]?.payload as { ymd?: string } | undefined)?.ymd;
                  return ymd ? dayMonthText(ymd) : '';
                }}
                formatter={(v: number) => [fmt(Number(v)), label]}
              />
              {s.avg > 0 ? (
                <ReferenceLine
                  y={s.avg}
                  stroke={CHART.gridStroke}
                  strokeDasharray="4 4"
                  label={{ value: `เฉลี่ย ${fmt(s.avg)}/วัน`, position: 'insideTopRight', fontSize: 11, fill: CHART.axisFill }}
                />
              ) : null}
              <Bar dataKey="value" name={label} maxBarSize={24} isAnimationActive={false}>
                {rows.map((r) => (
                  <Cell key={r.ymd} fill={s.peak && r.ymd === s.peak.ymd ? TONE.primary.hex : TONE.info.hex} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </OverviewCard>
  );
}

/* ─────────── ช่องทาง · ตำแหน่ง ─────────── */

export function ChannelTable({ rows, total }: { rows: readonly ChannelRow[]; total: ChannelRow }) {
  if (rows.length === 0) return <EmptyNote>ยังไม่มีรายชื่อในเดือนนี้</EmptyNote>;
  const max = Math.max(...rows.map((r) => r.names), 1);
  const head = ['ช่องทาง', 'รายชื่อ', 'โทรแล้ว', 'ตอบ AI ว่าสนใจ', 'ได้ใบสมัคร', 'อัตราสนใจ'];
  const cells = (r: ChannelRow) => [num(r.called), num(r.aiSaidYes), num(r.onBoard), pctText(r.interestRate)];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn('text-xs', DASH.tableHead)}>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={cn('px-2 py-2 font-medium', i === 0 ? 'text-left' : 'text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.channel} className={cn('border-t', DASH.tableRow)}>
              <td className={cn('px-2 py-2', DASH.cellStrong)}>{r.channel}</td>
              <td className="px-2 py-2">
                <span className="flex items-center justify-end gap-2">
                  <span className="hidden w-24 sm:block">
                    <RatioBar pct={(r.names / max) * 100} />
                  </span>
                  <span className={cn('tabular-nums', DASH.cell)}>{fmt(r.names)}</span>
                </span>
              </td>
              {cells(r).map((v, i) => (
                <td key={i} className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
          <tr className={cn('border-t', DASH.tableRow)}>
            <td className={cn('px-2 py-2', DASH.cellStrong)}>รวม</td>
            <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cellStrong)}>{fmt(total.names)}</td>
            {cells(total).map((v, i) => (
              <td key={i} className={cn('px-2 py-2 text-right tabular-nums', DASH.cellStrong)}>
                {v}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function PositionList({ rows }: { rows: readonly PositionRow[] }) {
  if (rows.length === 0) return <EmptyNote>ยังไม่มีรายชื่อในเดือนนี้</EmptyNote>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.position} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 break-words text-foreground">{r.position}</span>
            <span className={cn('shrink-0 text-xs tabular-nums', DASH.sub)}>
              <span className="font-medium text-foreground">{fmt(r.names)}</span> รายชื่อ · {pctText(r.pct)}
            </span>
          </div>
          <RatioBar pct={r.pct} tone={r.other ? 'neutral' : 'primary'} />
        </li>
      ))}
    </ul>
  );
}

/* ─────────── เหตุผลที่ไม่สำเร็จ ─────────── */

export function ReasonColumns({ groups }: { groups: readonly ReasonGroup[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {groups.map((g) => (
        <div key={g.key} className="space-y-2">
          <p className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-foreground">{g.label}</span>
            <span className={cn('text-xs tabular-nums', DASH.sub)}>{fmt(g.total)} รายชื่อ</span>
          </p>
          {g.reasons.length === 0 ? (
            <EmptyNote>ไม่มีข้อมูล</EmptyNote>
          ) : (
            <ul className="space-y-2">
              {g.reasons.map((r) => (
                <li key={r.label} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 break-words text-foreground">{r.label}</span>
                    <span className={cn('shrink-0 tabular-nums', DASH.cell)}>{fmt(r.count)}</span>
                  </div>
                  <RatioBar pct={g.total > 0 ? (r.count / g.total) * 100 : null} tone="danger" />
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────── ผลงานรายคน ─────────── */

const STAFF_COLS: { key: StaffSortKey; label: string }[] = [
  { key: 'claimed', label: 'เก็บไปโทร' },
  { key: 'called', label: 'โทรแล้ว' },
  { key: 'reached', label: 'ติดต่อสำเร็จ' },
  { key: 'appointed', label: 'นัดได้' },
  { key: 'showed', label: 'มาตามนัด' },
];

export function StaffTable({ staff, ai }: { staff: readonly RecruitStaffRow[]; ai: RecruitAiRow | null }) {
  const [sort, setSort] = useState<StaffSortKey>('appointed');
  const { rows, ai: aiRow } = useMemo(() => staffTableRows(staff, ai, sort), [staff, ai, sort]);
  const maxAppointed = Math.max(...rows.map((r) => r.appointed), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={cn('text-xs', DASH.tableHead)}>
          <tr>
            <th className="px-2 py-2 text-left font-medium">เจ้าหน้าที่</th>
            {STAFF_COLS.map((c) => (
              <th key={c.key} className="px-1 py-1 text-right font-medium">
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  aria-pressed={sort === c.key}
                  onClick={() => setSort(c.key)}
                  className={cn('font-medium', sort === c.key ? 'text-foreground' : DASH.sub)}
                >
                  {c.label}
                  {sort === c.key ? <ArrowDown aria-hidden /> : null}
                </Button>
              </th>
            ))}
            <th className="px-2 py-2 text-right font-medium">อัตรามาตามนัด</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className={cn('border-t', DASH.tableRow)}>
              <td colSpan={7} className={cn('px-2 py-4 text-center text-xs', DASH.sub)}>
                เดือนนี้ยังไม่มีเจ้าหน้าที่ลงผล
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} className={cn('border-t', DASH.tableRow)}>
                <td className={cn('px-2 py-2', DASH.cellStrong)}>{r.name}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(r.claimed)}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(r.called)}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(r.reached)}</td>
                <td className="px-2 py-2">
                  <span className="flex items-center justify-end gap-2">
                    <span className="hidden w-20 sm:block">
                      <RatioBar pct={(r.appointed / maxAppointed) * 100} tone="teal" />
                    </span>
                    <span className={cn('tabular-nums', DASH.cell)}>{fmt(r.appointed)}</span>
                  </span>
                </td>
                <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(r.showed)}</td>
                <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{pctText(r.showRate)}</td>
              </tr>
            ))
          )}
          {aiRow ? (
            <tr className={cn('border-t', DASH.tableRow)}>
              <td className="px-2 py-2">
                <span className={DASH.cellStrong}>AI (Lumos)</span>
                <span className={cn('block text-xs', DASH.sub)}>ตอบว่าสนใจ {fmt(aiRow.saidYes)}</span>
              </td>
              <td className={cn('px-2 py-2 text-right', DASH.sub)}>—</td>
              <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(aiRow.called)}</td>
              <td className={cn('px-2 py-2 text-right tabular-nums', DASH.cell)}>{fmt(aiRow.reached)}</td>
              <td className={cn('px-2 py-2 text-right', DASH.sub)}>—</td>
              <td className={cn('px-2 py-2 text-right', DASH.sub)}>—</td>
              <td className={cn('px-2 py-2 text-right', DASH.sub)}>—</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
