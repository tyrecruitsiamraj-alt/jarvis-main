/**
 * ═══ กราฟแท่งเปรียบเทียบในแผงเลื่อน (รอบ 13 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"แท่งเวลากดเข้าไปที่เด้งมาดีแล้ว แต่ขอเป็นแบบกราฟแท่งเปรียบเทียบเลยว่า AI คน ไม่โทร แท่งไหนสูงสุด
 * พอเป็นฝั่ง BU ก็บอกว่า BU ไหนเยอะสุด"*
 * - ฝั่ง AI/คน (สวิตช์ปิด): หนึ่งแท่งต่อก้อน สีของก้อนนั้น
 * - ฝั่ง BU (สวิตช์เปิด): หนึ่งแท่งต่อ BU (มากไปน้อย) ในแท่งซ้อนสี AI/คน/ยังไม่โทร ⇒ เห็นทั้ง BU ไหนเยอะสุด
 *   และ BU นั้นใช้ AI หรือคนเท่าไหร่ (โจทย์เดิมรอบ 5)
 * - แท่งสูงสุด (`topKeys` · เท่ากันติดทุกแท่ง) เข้มเต็ม + ป้ายเหนือยอด · แท่งอื่นจางลง
 * - รอบ 14 (รายการ "มาจาก BU ไหนบ้าง" ใต้กราฟถอดแล้ว): ฝั่ง BU เขียนเลขในแต่ละสีของแท่ง (AI/คน/ยังไม่โทรกี่สาย) +
 *   จี้แท่งเห็นรายละเอียดครบ (`note` เช่น AI %) ⇒ โจทย์รอบ 5 "แต่ละ BU ใช้คนหรือ AI อย่างละเท่าไหร่" ยังตอบได้ในกราฟ
 * 🔴 สีแท่ง = `currentColor` + คลาส `TONE[...].value` (มีคู่ `dark:`) · ไม่มี hex
 */
import React, { useMemo } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, type TooltipProps } from 'recharts';
import { CHART, TONE } from '@/lib/designTokens';
import { topKeys } from '@/lib/homeAiShare';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** ชั้นในแท่ง (ฝั่ง BU = ก้อน AI/คน/ยังไม่โทร) */
export type ComparePart = { key: string; label: string; value: number; fill: string; dot: string; muted?: boolean };

export type CompareBar = {
  key: string;
  /** คำใต้แท่ง */
  label: string;
  /** ชื่อเต็มตอนจี้ */
  title?: string;
  /** ความสูงของแท่ง */
  value: number;
  /** สีของแท่งแบบสีเดียว (ฝั่ง AI/คน) */
  fill: string;
  /** แท่งซ้อน (ฝั่ง BU) — ทุกแท่งต้องมีก้อนชุดเดียวกัน เรียงเหมือนกัน */
  parts?: ComparePart[];
  /** บรรทัดท้ายตอนจี้ เช่น "AI 100% ของที่โทรแล้ว" */
  note?: string;
};

/** เลขในสีต้องสูงอย่างน้อยเท่านี้ถึงจะเขียน */
const MIN_PART_LABEL = 16;

type Row = Record<string, number | string> & { key: string; label: string; total: number; top: number };

const partKey = (i: number) => `p${i}`;

/** ตอนจี้แท่งฝั่ง BU — ยอดของ BU นั้น + เลขแต่ละสี + บรรทัดท้าย */
function PartsTooltip({
  active,
  payload,
  bars,
  unit,
}: TooltipProps<number, string> & { bars: ReadonlyArray<CompareBar>; unit: string }) {
  const key = active ? (payload?.[0]?.payload as Row | undefined)?.key : undefined;
  const bar = key ? bars.find((b) => b.key === key) : undefined;
  if (!bar) return null;
  return (
    <div className="min-w-44 space-y-1.5 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="text-muted-foreground">{bar.title ?? bar.label}</p>
      <p className="text-sm font-medium tabular-nums">
        ยอดใช้งาน {NUM.format(bar.value)} {unit}
      </p>
      <ul className="space-y-0.5">
        {(bar.parts ?? []).map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-4 tabular-nums">
            <span className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block h-2 w-2 rounded-full', p.dot)} aria-hidden />
              {p.label}
            </span>
            <span>{NUM.format(p.value)}</span>
          </li>
        ))}
      </ul>
      {bar.note ? <p className={TONE.primary.value}>{bar.note}</p> : null}
    </div>
  );
}

const AiShareCompareChart: React.FC<{
  bars: ReadonlyArray<CompareBar>;
  /** ป้ายเหนือแท่งสูงสุด เช่น "สูงสุด" · "เยอะสุด" */
  topLabel: string;
  ariaLabel: string;
  unit: string;
  height?: number;
}> = ({ bars, topLabel, ariaLabel, unit, height = 220 }) => {
  const tops = useMemo(() => new Set(topKeys(bars)), [bars]);
  const parts = bars[0]?.parts ?? null;
  const data = useMemo<Row[]>(
    () =>
      bars.map((b) => {
        const row = { key: b.key, label: b.label, total: b.value, top: tops.has(b.key) ? 1 : 0 } as Row;
        (b.parts ?? []).forEach((p, i) => {
          row[partKey(i)] = p.value;
        });
        return row;
      }),
    [bars, tops],
  );

  /** เลขยอดเหนือแท่ง + ป้ายสูงสุด (แท่งที่สูงสุดเท่านั้น) */
  const TopLabel = (p: { x?: number | string; y?: number | string; width?: number | string; index?: number }) => {
    const row = data[Number(p.index)];
    if (!row || row.total <= 0) return null;
    const cx = Number(p.x) + Number(p.width) / 2;
    const y = Number(p.y);
    return (
      <g className="pointer-events-none">
        <text x={cx} y={y - 6} textAnchor="middle" fontSize={12} className="fill-foreground">
          {NUM.format(row.total)}
        </text>
        {row.top ? (
          <text x={cx} y={y - 22} textAnchor="middle" fontSize={11} className={cn('fill-current', TONE.primary.value)}>
            {topLabel}
          </text>
        ) : null}
      </g>
    );
  };

  /** เลขในแต่ละสีของแท่งซ้อน (ฝั่ง BU) — สีบางเกินไม่เขียน */
  const partLabel = (muted: boolean | undefined) => {
    const PartLabel = (p: { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string }) => {
      const v = Number(p.value ?? 0);
      const h = Number(p.height);
      if (!v || !Number.isFinite(h) || h < MIN_PART_LABEL) return null;
      return (
        <text
          x={Number(p.x) + Number(p.width) / 2}
          y={Number(p.y) + h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          className={cn('pointer-events-none', muted ? 'fill-foreground' : 'fill-background')}
        >
          {NUM.format(v)}
        </text>
      );
    };
    return PartLabel;
  };

  if (tops.size === 0) return <p className="py-10 text-center text-sm text-muted-foreground">ช่วงนี้ยังไม่มีงาน</p>;

  return (
    <div className="space-y-2">
      {parts ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="สีในแท่ง">
          {parts.map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5">
              <span className={cn('inline-block h-2.5 w-2.5 rounded-sm', p.dot)} aria-hidden />
              {p.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="w-full text-muted-foreground" style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 36, right: 8, left: 8, bottom: 0 }} barCategoryGap="28%">
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: CHART.axisFill }} tickLine={false} axisLine={false} interval={0} />
            {parts ? (
              <Tooltip
                cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                content={(tp: TooltipProps<number, string>) => <PartsTooltip {...tp} bars={bars} unit={unit} />}
              />
            ) : null}
            {parts ? (
              parts.map((p, i) => (
                <Bar key={p.key} dataKey={partKey(i)} stackId="cmp" fill="currentColor" className={p.fill} maxBarSize={56} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.key} fillOpacity={(p.muted ? 0.35 : 1) * (d.top ? 1 : 0.55)} />
                  ))}
                  <LabelList dataKey={partKey(i)} content={partLabel(p.muted)} />
                  {i === parts.length - 1 ? <LabelList dataKey="total" content={TopLabel} /> : null}
                </Bar>
              ))
            ) : (
              <Bar dataKey="total" fill="currentColor" maxBarSize={56} radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {bars.map((b, i) => (
                  <Cell key={b.key} fill="currentColor" className={b.fill} fillOpacity={data[i]?.top ? 1 : 0.55} />
                ))}
                <LabelList dataKey="total" content={TopLabel} />
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AiShareCompareChart;
