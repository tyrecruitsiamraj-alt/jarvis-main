import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { ChoiceDropdown } from '@/components/jobs/BoardFilterPanel';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { seriesByBucket, type TrendGrain } from '@/lib/trends/timeBuckets';
import { APPLICANT_DIM_LABEL, applicantDimGetter, appliedYmd, type ApplicantDim } from '@/lib/trends/applicantTrends';
import {
  applyHeatmap,
  DOW_LABEL,
  INTEREST_MICRO_HINT,
  INTEREST_MICRO_LABEL,
  INTEREST_MICRO_ORDER,
  INTEREST_MICRO_TONE,
  pipelineByDim,
  pipelineRates,
  reachByCallHour,
  type LumosPipeline,
  type PipelineStep,
} from '@/lib/trends/lumosPipeline';
import { formatTrendNumber as fmt, formatTrendPct as pct } from '@/lib/trends/format';
import type { ApplicantTrendRow, TrendCallMicro } from '@/lib/trends/types';
import { DeltaChip, TrendBadge, TrendChart, TrendSection, TrendState, TrendTable, type Polarity } from './TrendParts';

/**
 * ═══ ส่วน "ใบสมัคร → Lumos → ผลโทร" ของแท็บ Dashboard กล่องงาน (28 ก.ย. 2569) ═══
 *
 * 🔴 เจ้าของ (รอบ 3): *"ในกล่องงานดูแล้วงง"* → Choice "คงไว้ บอกชัดว่าเฉพาะใบสมัคร" — ส่วนนี้นับ **คน** (ใบสมัคร)
 * ส่วนยอดส่ง Lumos **ทั้งระบบ** (นับสาย · ทุกเส้นทาง) อยู่หัวคอลัมน์ Lumos บนหน้าแรก (`LumosSentBlock`)
 *
 * เจ้าของสั่ง: *"มีรายชื่อเข้ามาเท่าไหร่ ส่งไปหา lumos เท่าไหร่ Lumos โทรหมดไหม โทรแล้วผลเป็นไง หรือ แค่รับสายแล้ววาง
 * ไม่รับเยอะไหม ถ้าบอกช่วงเวลาที่คนกรอกเข้ามาเยอะด้วยยิ่งดีเลย … อยากเห็นหลายๆมิติมากๆ"*
 *
 * 🔴 ตัวเลขทั้งหมดจาก `lib/trends/lumosPipeline` (นิยามกลาง + เทสต์) — จอนี้วาดอย่างเดียว
 * 🔴 ทุกขั้นนับ **คนกลุ่มเดียวกัน** (กรอกในช่วงที่เลือก) — กราฟรายงวดก็นับตามงวดที่กรอก ไม่เอาคนละกลุ่มมาหาร
 */

const STEP_TONE: Record<PipelineStep['key'], ToneKey> = {
  names: 'violet',
  sent: 'primary',
  called: 'info',
  pickedUp: 'teal',
  talked: 'teal',
  interested: 'success',
};

const MICRO_POLARITY: Record<TrendCallMicro, Polarity> = {
  no_pickup: 'down-good',
  picked_silent: 'down-good',
  wrong_person: 'down-good',
  said_yes: 'up-good',
  said_no: 'down-good',
  not_yet: 'neutral',
  talked_unclear: 'down-good',
};

/** เหตุที่ยังไม่ส่ง — โชว์เฉพาะเหตุที่มีจริง (ลำดับเดียวกับตัวนับ) */
const NOT_SENT_PARTS: ReadonlyArray<[keyof Omit<LumosPipeline['notSent'], 'total'>, string]> = [
  ['claimed', 'เก็บไปโทรเอง'],
  ['badPhone', 'เบอร์ใช้โทรไม่ได้'],
  ['noJob', 'ไม่ได้เลือกงาน'],
  ['lead', 'ย้ายไป Lead'],
  ['other', 'อื่น ๆ'],
];

/** ส่งแล้วยังไม่มีผล — ป้ายตามนิยามกลาง `lumosQueueDefs` */
const NOT_CALLED_PARTS: ReadonlyArray<['pending' | 'waiting' | 'cancelled', string]> = [
  ['pending', 'ยังไม่ถึงมือ Lumos'],
  ['waiting', 'Lumos รับแล้วรอผล'],
  ['cancelled', 'ยกเลิก'],
];

const DIMS = (Object.keys(APPLICANT_DIM_LABEL) as ApplicantDim[]).map((value) => ({ value, label: APPLICANT_DIM_LABEL[value] }));

/** อายุงานค้าง — เกิน 2 วันบอกเป็นวัน อ่านง่ายกว่า "98.4 ชม." */
const ageText = (hours: number) => (hours >= 48 ? `${fmt(Math.floor(hours / 24))} วัน` : `${fmt(Math.round(hours))} ชม.`);
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;
const ofBase = (rate: number | null, top: number, base: number, unit: string) =>
  `${rate === null ? '—' : pct(rate)} (${fmt(top)}/${fmt(base)} ${unit})`;

function HourBars({
  data,
  dataKey,
  tone,
  unit,
  ariaLabel,
  format,
}: {
  /** ค่า null = ชั่วโมงนั้นไม่มีข้อมูล (ไม่วาดแท่ง · ห้ามโชว์เป็น 0%) */
  data: Array<Record<string, number | string | null>>;
  dataKey: string;
  tone: ToneKey;
  unit?: string;
  ariaLabel: string;
  format: (v: number, row: Record<string, number | string | null>) => [string, string];
}) {
  return (
    <div className="h-44 w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} interval={2} />
          <YAxis
            tick={{ fontSize: 11, fill: CHART.axisFill }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={40}
            unit={unit}
            domain={unit === '%' ? [0, 100] : undefined}
          />
          <Tooltip
            contentStyle={CHART.tooltip.contentStyle}
            labelStyle={CHART.tooltip.labelStyle}
            itemStyle={CHART.tooltip.itemStyle}
            labelFormatter={(l) => `${hh(Number(l))} น.`}
            formatter={(v: number, _n: string, item: { payload?: Record<string, number | string | null> }) => format(Number(v), item.payload ?? {})}
          />
          <Bar dataKey={dataKey} fill={TONE[tone].hex} maxBarSize={18} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function LumosPipelineSection({
  rows,
  loading,
  error,
  onRetry,
  range,
  previous,
  grain,
  now,
  prev,
}: {
  rows: ApplicantTrendRow[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  range: { from: string; to: string };
  previous: { from: string; to: string };
  grain: TrendGrain;
  /** เส้นทางช่วงนี้ / ช่วงก่อน — คิดครั้งเดียวที่หน้า Dashboard (การ์ดภาพรวมใช้ตัวเดียวกัน) */
  now: LumosPipeline;
  prev: LumosPipeline;
}) {
  const data = useMemo(() => rows ?? [], [rows]);
  const rates = pipelineRates(now);
  const [dim, setDim] = useState<ApplicantDim>('channel');

  /* กราฟรายงวด — ทุกเส้นนับตามงวดที่ "กรอก" (คนกลุ่มเดียวกับแท่ง) */
  const trend = useMemo(() => {
    const names = seriesByBucket(data, appliedYmd, range, grain);
    const sent = seriesByBucket(data, appliedYmd, range, grain, (r) => (r.lumos ? 1 : 0));
    const called = seriesByBucket(data, appliedYmd, range, grain, (r) => (r.lumos?.state === 'called' ? 1 : 0));
    const yes = seriesByBucket(data, appliedYmd, range, grain, (r) => (r.lumos?.micro === 'said_yes' ? 1 : 0));
    return names.map((p, i) => ({ label: p.label, names: p.value, sent: sent[i].value, called: called[i].value, yes: yes[i].value }));
  }, [data, range, grain]);

  const heat = useMemo(() => applyHeatmap(data, range), [data, range]);
  const heatMax = Math.max(1, ...heat.flat());
  const byHour = heat.reduce((acc, row) => acc.map((v, h) => v + row[h]), Array.from({ length: 24 }, () => 0));
  const byDow = heat.map((row) => row.reduce((s, v) => s + v, 0));
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakDow = byDow.indexOf(Math.max(...byDow));
  const reach = useMemo(() => reachByCallHour(data, range), [data, range]);
  const reachCalls = reach.reduce((s, h) => s + h.called, 0);
  const dimRows = useMemo(
    () => pipelineByDim(data, range, applicantDimGetter(dim), { previous }),
    [data, range, dim, previous],
  );

  const step = (key: PipelineStep['key']) => now.steps.find((s) => s.key === key)?.count ?? 0;
  const withResult = now.micro.withResult;

  return (
    <TrendSection
      title="ใบสมัคร → Lumos → ผลโทร"
      badge={<TrendBadge>เฉพาะคนที่กรอกใบสมัคร · นับเป็นคน · ยอดส่ง Lumos ทั้งระบบอยู่หน้าแรก</TrendBadge>}
    >
      <TrendState loading={loading && !rows} error={error} onRetry={onRetry} />
      {rows ? (
        <div className="space-y-4">
          {/* ── เส้นทาง: เข้ามา → ส่ง → โทร → รับ → คุย → สนใจ ── */}
          <Card className="space-y-3 rounded-2xl p-4">
            {now.steps.map((s, i) => (
              <div key={s.key} className="space-y-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm text-foreground">{s.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className={cn('text-lg font-medium tabular-nums', TONE[STEP_TONE[s.key]].num)}>{fmt(s.count)}</span>
                    {i > 0 ? (
                      <span className={cn('text-xs tabular-nums', DASH.muted)}>
                        {s.ofPrevious === null ? '—' : pct(s.ofPrevious)} ของขั้นก่อน
                      </span>
                    ) : null}
                    <DeltaChip current={s.count} previous={prev.steps[i]?.count ?? 0} polarity="up-good" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${now.names ? (s.count / now.names) * 100 : 0}%`, backgroundColor: TONE[STEP_TONE[s.key]].hex }}
                  />
                </div>
                {s.key === 'sent' && now.notSent.total > 0 ? (
                  <p className={DASH.sub}>
                    ยังไม่ส่ง {fmt(now.notSent.total)} —{' '}
                    {NOT_SENT_PARTS.filter(([k]) => now.notSent[k] > 0)
                      .map(([k, label]) => `${label} ${fmt(now.notSent[k])}`)
                      .join(' · ')}
                  </p>
                ) : null}
                {s.key === 'called' && now.notCalled.total > 0 ? (
                  <p className={cn('text-xs', now.notCalled.pending + now.notCalled.waiting > 0 ? TONE.warn.value : DASH.muted)}>
                    ยังไม่มีผล {fmt(now.notCalled.total)} —{' '}
                    {NOT_CALLED_PARTS.filter(([k]) => now.notCalled[k] > 0)
                      .map(([k, label]) => `${label} ${fmt(now.notCalled[k])}`)
                      .join(' · ')}
                    {/* นัดโทรไว้ข้างหน้า (เช่น ส่งซ้ำตอนเช้า) อายุค้าง = 0 — ไม่ใช่งานค้าง ไม่ต้องบอก */}
                    {now.notCalled.oldestHours !== null && now.notCalled.oldestHours >= 1
                      ? ` · ค้างนานสุด ${ageText(now.notCalled.oldestHours)}`
                      : ''}
                  </p>
                ) : null}
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t border-border/70 pt-3">
              <TrendBadge tone="info">Lumos โทรแล้ว {ofBase(rates.coverage, step('called'), step('sent'), 'คนที่ส่ง')}</TrendBadge>
              <TrendBadge tone="teal">มีคนรับสาย {ofBase(rates.reach, now.micro.pickedUp, withResult, 'สายที่มีผล')}</TrendBadge>
              <TrendBadge tone="teal">ได้คุยเรื่องของเรา {ofBase(rates.talk, now.micro.talked, withResult, 'สายที่มีผล')}</TrendBadge>
              <TrendBadge tone="success">
                {INTEREST_MICRO_LABEL.said_yes} {ofBase(rates.interest, now.micro.said_yes, now.micro.talked, 'สายที่ได้คุย')}
              </TrendBadge>
              <TrendBadge>
                ได้นัด {fmt(now.appointment)} · มาตามนัด {fmt(now.showed)}
              </TrendBadge>
            </div>
          </Card>

          {/* ── ผลโทรแยกถัง ── */}
          <Card className="space-y-3 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">ผลโทรของ Lumos · {fmt(withResult)} สายที่มีผล</h3>
              <TrendBadge tone="warn">จัดถังจากรหัสผล Lumos + คำพูดในสาย</TrendBadge>
            </div>
            {withResult > 0 ? (
              <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                {INTEREST_MICRO_ORDER.filter((k) => now.micro[k] > 0).map((k) => (
                  <div
                    key={k}
                    title={`${INTEREST_MICRO_LABEL[k]} ${fmt(now.micro[k])}`}
                    style={{ width: `${(now.micro[k] / withResult) * 100}%`, backgroundColor: TONE[INTEREST_MICRO_TONE[k]].hex }}
                  />
                ))}
              </div>
            ) : (
              <p className={cn('text-xs', DASH.muted)}>ช่วงนี้ยังไม่มีสายที่มีผล</p>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {INTEREST_MICRO_ORDER.map((k) => (
                <div key={k} className={cn('min-w-0 p-2', DASH.card)} title={INTEREST_MICRO_HINT[k]}>
                  <p className={cn('flex items-baseline gap-1.5', DASH.sub)}>
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: TONE[INTEREST_MICRO_TONE[k]].hex }} aria-hidden />
                    {INTEREST_MICRO_LABEL[k]}
                  </p>
                  <p className={cn('text-lg font-medium tabular-nums', TONE[INTEREST_MICRO_TONE[k]].num)}>{fmt(now.micro[k])}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className={cn('text-xs tabular-nums', DASH.muted)}>{withResult ? pct(now.micro[k] / withResult) : '—'}</span>
                    <DeltaChip current={now.micro[k]} previous={prev.micro[k]} polarity={MICRO_POLARITY[k]} />
                  </div>
                </div>
              ))}
            </div>
            <p className={DASH.sub}>
              โทรจนได้ผลในรอบแรก {fmt(now.attempts[0].called)} · รอบสอง {fmt(now.attempts[1].called)} · สามรอบขึ้นไป{' '}
              {fmt(now.attempts[2].called)} คน
            </p>
          </Card>

          {/* ── รายงวด ── */}
          <Card className="rounded-2xl p-4">
            <TrendChart
              ariaLabel="รายชื่อเข้ามา ส่งให้ Lumos Lumos โทรแล้ว และตอบว่าสนใจ ต่องวดที่กรอก"
              data={trend}
              series={[
                { key: 'names', label: 'รายชื่อเข้ามา', kind: 'bar', tone: 'violet' },
                { key: 'sent', label: 'ส่งให้ Lumos', kind: 'line', tone: 'primary' },
                { key: 'called', label: 'Lumos โทรแล้ว', kind: 'line', tone: 'info', dashed: true },
                { key: 'yes', label: INTEREST_MICRO_LABEL.said_yes, kind: 'line', tone: 'success' },
              ]}
            />
          </Card>

          {/* ── ช่วงเวลา ── */}
          <Card className="space-y-4 rounded-2xl p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">คนกรอกใบสมัครช่วงไหน (เวลาไทย)</h3>
              {now.names > 0 ? (
                <span className={DASH.sub}>
                  เยอะสุด {hh(peakHour)}–{hh((peakHour + 1) % 24)} น. ({fmt(byHour[peakHour])} ใบ) · วัน{DOW_LABEL[peakDow]} (
                  {fmt(byDow[peakDow])} ใบ)
                </span>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-max space-y-1">
                <div className="flex items-center gap-1">
                  <span className="w-8 shrink-0" />
                  {Array.from({ length: 24 }, (_, h) => (
                    <span key={h} className={cn('min-w-3 flex-1 text-center text-xs tabular-nums', DASH.muted)}>
                      {h % 3 === 0 ? h : ''}
                    </span>
                  ))}
                  <span className="w-10 shrink-0" />
                </div>
                {heat.map((row, d) => (
                  <div key={d} className="flex items-center gap-1">
                    <span className={cn('w-8 shrink-0', DASH.sub)}>{DOW_LABEL[d]}</span>
                    {row.map((v, h) => (
                      <span
                        key={h}
                        title={`${DOW_LABEL[d]} ${hh(h)} น. — ${fmt(v)} ใบ`}
                        className={cn('h-6 min-w-3 flex-1 rounded-sm', v === 0 && 'bg-muted')}
                        style={v > 0 ? { backgroundColor: TONE.violet.hex, opacity: 0.2 + 0.8 * (v / heatMax) } : undefined}
                      />
                    ))}
                    <span className={cn('w-10 shrink-0 text-right text-xs tabular-nums', DASH.muted)}>{fmt(byDow[d])}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-1">
                <p className={DASH.sub}>ใบสมัครตามชั่วโมงที่กรอก</p>
                <HourBars
                  ariaLabel="จำนวนใบสมัครตามชั่วโมงที่กรอก"
                  data={byHour.map((v, h) => ({ label: h, v }))}
                  dataKey="v"
                  tone="violet"
                  format={(v) => [`${fmt(v)} ใบ`, 'กรอก']}
                />
              </div>
              <div className="space-y-1">
                <p className={DASH.sub}>Lumos โทรชั่วโมงไหนแล้วมีคนรับ · {fmt(reachCalls)} สายที่มีผล</p>
                {reachCalls === 0 ? (
                  <p className={cn('text-xs', DASH.muted)}>ช่วงนี้ยังไม่มีสายที่มีผล</p>
                ) : (
                  <HourBars
                    ariaLabel="สัดส่วนสายที่มีคนรับ ตามชั่วโมงที่โทร"
                    data={reach.map((x) => ({ label: x.hour, rate: x.rate === null ? null : Math.round(x.rate * 100), called: x.called, picked: x.pickedUp }))}
                    dataKey="rate"
                    tone="teal"
                    unit="%"
                    format={(v, row) => [`${v}% (${fmt(Number(row.picked ?? 0))}/${fmt(Number(row.called ?? 0))} สาย)`, 'มีคนรับ']}
                  />
                )}
              </div>
            </div>
          </Card>

          {/* ── แยกตามมิติ ── */}
          <Card className="space-y-2 rounded-2xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={DASH.sub}>แยกตาม</span>
              <ChoiceDropdown<ApplicantDim> value={dim} options={DIMS} onChange={setDim} ariaLabel="แยกเส้นทางตามมิติ" />
            </div>
            <TrendTable
              columns={[
                { key: 'dim', label: APPLICANT_DIM_LABEL[dim] },
                { key: 'names', label: 'รายชื่อเข้ามา', align: 'right' },
                { key: 'delta', label: 'เทียบช่วงก่อน', align: 'right' },
                { key: 'sent', label: 'ส่ง Lumos', align: 'right' },
                { key: 'called', label: 'โทรแล้ว', align: 'right' },
                { key: 'picked', label: 'มีคนรับ', align: 'right' },
                { key: 'yes', label: INTEREST_MICRO_LABEL.said_yes, align: 'right' },
                { key: 'rate', label: 'สนใจ ÷ โทรแล้ว', align: 'right' },
              ]}
              rows={dimRows.map((r) => ({
                key: r.dim,
                cells: {
                  dim: r.dim,
                  names: fmt(r.names),
                  delta: <DeltaChip current={r.names} previous={r.namesPrev} polarity="up-good" />,
                  sent: fmt(r.sent),
                  called: fmt(r.called),
                  picked: fmt(r.pickedUp),
                  yes: fmt(r.interested),
                  rate: r.interestOfCalled === null ? '—' : pct(r.interestOfCalled),
                },
              }))}
            />
          </Card>
        </div>
      ) : null}
    </TrendSection>
  );
}
