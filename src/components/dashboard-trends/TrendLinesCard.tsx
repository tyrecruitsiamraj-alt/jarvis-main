import React from 'react';
import { LineChart as LineIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { CHART, chartDayLabel, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { deltaOf, type CompareRow } from '@/lib/recruitCompare';
import { OverviewCard } from './RecruitOverviewParts';

export type ComparePeriod = 'cur' | 'prev';

/** สีเส้นตามลำดับแถว — จากโทเค็น (`TONE.*.hex`) ที่เดียว */
const LINE_TONES: ToneKey[] = ['info', 'success', 'warn', 'violet', 'danger', 'teal'];
/** ตัวชี้วัดที่ต่อท้ายแท็บกรอกเข้ามา (27 ต.ค. 2569) — สีไม่ซ้ำเส้นแรก · ไม่สนใจแดง */
const KEY_TONE: Record<string, ToneKey> = { aiSaidYes: 'teal', aiSaidNo: 'danger', aiQueued: 'violet' };
const toneOf = (key: string, i: number): ToneKey => KEY_TONE[key] ?? LINE_TONES[i % LINE_TONES.length];

/**
 * ═══ กราฟเส้นรายวัน + ▲▼ เทียบช่วงก่อน — บนสุดทุกแท็บของภาพรวม ═══
 * เจ้าของ 21 ต.ค. 2569: *"อยากให้มันวิ่งแบบอันนี้"* (ชี้กราฟเส้นแนวโน้มรายเดือนของ Dashboard) +
 * *"Default 7 วัน … ถ้าเป็นแบบเทียบเดือนก็ขึ้นเป็นเดือนเทียบกัน พอกดเดือนไหนก็เป็นวันของเดือนนั้นๆ"*
 * - เส้นละตัวชี้วัดของแท็บ · แกนนอน = วันของช่วงที่เลือก
 * - ป้ายบนหัว: ยอดช่วงนี้ + เพิ่ม/ลด % จากช่วงก่อน · กดชื่อช่วง = ดูวันของช่วงนั้น
 */
export default function TrendLinesCard({
  rows,
  prevLabel,
  title = 'แนวโน้มรายวัน',
  picked = null,
  onPick,
  pickable,
  children,
  note,
  seriesOf,
}: {
  rows: readonly CompareRow[];
  /** ป้ายช่วงที่เลือก — ไม่ได้ใช้บนการ์ดแล้ว (เลือกช่วงที่ตัวเลือกด้านบน) คงไว้ให้หน้าแม่ส่งเหมือนเดิม */
  curLabel?: string;
  prevLabel: string;
  /** แท็บใบขอ = "แนวโน้มใบขอ" (เจ้าของ 27 ต.ค. 2569) */
  title?: string;
  /** กล่องที่กดอยู่ (แท็บใบขอ — กดกล่องแล้วรายการใบขอขึ้นใต้กราฟ) · null = ไม่ได้กด */
  picked?: string | null;
  onPick?: (key: string | null) => void;
  /** กล่องที่กดได้ (ไม่ส่ง = กดไม่ได้) */
  pickable?: (key: string) => boolean;
  /** ของใต้กราฟ (รายการใบขอของกล่องที่กด) */
  children?: React.ReactNode;
  note?: string | null;
  seriesOf: (key: string, period: ComparePeriod) => Array<{ day: string; n: number }>;
}) {
  // ช่วงที่ดู = ตัวเลือกช่วงเวลาด้านบนของหน้า (เจ้าของ 27 ต.ค. 2569 ค่ำ "เอาออกให้ไป Filter ตรง เลือกช่วงเวลา")
  // ⇒ การ์ดนี้แสดงช่วงที่เลือกเสมอ · เลขช่วงก่อนอยู่บรรทัดล่างของกล่องไว้เทียบ
  const period: ComparePeriod = 'cur';
  const chart = React.useMemo(() => {
    const byDay = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      for (const p of seriesOf(r.key, period)) {
        const row = byDay.get(p.day) ?? { day: p.day, label: String(Number(p.day.slice(8, 10))) };
        row[r.key] = p.n;
        byDay.set(p.day, row);
      }
    }
    return [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  }, [rows, period, seriesOf]);
  const labelOf = new Map(rows.map((r) => [r.key, r.label]));

  /** กล่องยอด — แท็บใบขอกดได้ (shadcn Button) ที่เหลือเป็นกล่องเฉย ๆ */
  const boxCls = 'flex min-w-0 flex-col gap-0.5 rounded-xl border border-border px-3 py-2';
  const Box = ({ k, children: c }: { k: string; children: React.ReactNode }) =>
    onPick && pickable?.(k) ? (
      <Button
        type="button"
        variant={picked === k ? 'secondary' : 'outline'}
        aria-pressed={picked === k}
        onClick={() => onPick(picked === k ? null : k)}
        className={cn(boxCls, 'h-auto items-start justify-start whitespace-normal text-left font-normal')}
        data-testid={`trend-total-${k}`}
      >
        {c}
      </Button>
    ) : (
      <div className={boxCls} data-testid={`trend-total-${k}`}>
        {c}
      </div>
    );

  return (
    <OverviewCard icon={LineIcon} title={title} sub={note ?? undefined}>
      {/* ยอดช่วงนี้ + เทียบช่วงก่อน ต่อตัวชี้วัด */}
      <div className="flex flex-wrap gap-2" data-testid="trend-totals">
        {rows.map((r, i) => {
          const d = deltaOf(r.cur, r.prev);
          const shown = r.cur;
          return (
            <Box key={r.key} k={r.key}>
              {/* 27 ต.ค. 2569 เจ้าของ: ถอดขีดสีหน้าป้าย · ถอดลูกศร (บอกเป็นคำ เพิ่ม/ลด) · เลขช่วงก่อนไปไว้มุมขวาของกราฟที่เดียว */}
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-medium tabular-nums text-foreground">{shown === null ? '—' : fmt(shown)}</span>
                <span
                  className={cn(
                    'text-xs font-medium tabular-nums',
                    d.kind === 'up' || d.kind === 'new' ? TONE.success.value : d.kind === 'down' ? TONE.danger.value : 'text-muted-foreground',
                  )}
                >
                  {d.kind === 'up'
                    ? `เพิ่ม ${d.pct.toLocaleString('th-TH')}%`
                    : d.kind === 'down'
                      ? `ลด ${d.pct.toLocaleString('th-TH')}%`
                      : d.kind === 'new'
                        ? 'ใหม่'
                        : d.kind === 'same'
                          ? 'เท่าเดิม'
                          : 'เทียบไม่ได้'}
                </span>
              </span>
            </Box>
          );
        })}
      </div>
      <p className={cn('text-right text-xs tabular-nums', DASH.sub)} data-testid="trend-prev">
        เทียบ {prevLabel}
      </p>
      <div className={cn('h-56', DASH.sub)} data-testid="trend-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chart} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} />
            <Tooltip
              {...CHART.tooltip}
              cursor={CHART.cursorLine}
              labelFormatter={(_l, p) => chartDayLabel((p?.[0]?.payload as { day?: string } | undefined)?.day ?? '')}
              formatter={(value: number, name: string) => [fmt(Number(value)), labelOf.get(name) ?? name]}
            />
            {rows.map((r, i) => (
              <Line
                key={r.key}
                type="monotone"
                dataKey={r.key}
                name={r.key}
                stroke={TONE[toneOf(r.key, i)].hex}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={CHART.activeDot}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {children}
    </OverviewCard>
  );
}
