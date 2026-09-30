/**
 * ═══ กราฟแท่งยอดใช้งานรายวัน/รายเดือน ของหัวข้อที่เลือก (รอบ 5 → รอบ 12 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"กราฟขอกราฟแท่ง default ย้อนหลัง 7 วัน เปลี่ยนตาม calendar · โชว์ว่ายอดใช้งานของแต่ละวัน แต่ละเดือนเท่าไหร่ ·
 * กดดูกราฟไหนก็โชว์แบบ Slide มาทางขวาว่ายอดใช้งาน 800 เกิดจาก BU ไหนบ้าง"* · รอบ 7: *"เพิ่ม Switch ที่กดแล้วเปลี่ยนในแท่ง
 * Default แบ่ง AI/คน/ยังไม่โทร · กด Switch เป็น BU ละเท่าไหร่"*
 * - ความสูงทั้งแท่ง = ยอดใช้งานของวัน/เดือนนั้น (เลขอยู่บนหัวแท่ง) · ชั้นในแท่ง = `stacks` ที่หน้าเรียกส่งมา
 *   (4 ก้อน AI/คน หรือ BU) ⇒ กราฟตัวเดียววาดได้ทั้งสองแบบ ยอดบนหัวแท่งเท่ากันเสมอ
 * - รอบ 9: เลข % อยู่ในแต่ละสีของแท่ง ปัดรวมกันได้ 100 ต่อแท่ง · ป้ายสีด้านบนบอกว่าสีไหนคืออะไร กี่ % ของทั้งช่วง
 *   (โหมดแยก BU = รหัส BU + % · รอบ 17 ขึ้นครบทุก BU รอไว้ แม้ BU นั้นยังไม่มีงาน)
 * - รอบ 17: เจ้าของ *"ในการ์ดมีแค่เลขกับ % พอ เพราะคำอธิบายบอกหมดแล้ว"* ⇒ ในสีของแท่งเหลือ **เลข + %** ไม่มีชื่อแล้ว
 *   (ชื่ออยู่ที่ป้ายสีด้านบนที่เดียว) · ที่พอ = สองบรรทัด · สูงไม่พอ = "เลข · %" · แคบ = % · เล็กเกิน = ไม่เขียน (`barLabelLines`)
 *   แกนล่างเหลือเลขวัน (เดือน/ช่วงวันอยู่หัวกราฟ — `AiShareDetail`)
 * - รอบ 12: เจ้าของ *"ให้หมุนก้อนพวกแท่งกราฟ แบบหมุนเหมือนหมุนไพ่"* → Choice **"กดสวิตช์แยก BU แท่งพลิกทุกแท่ง"**
 *   `flipKey` เปลี่ยน ⇒ แต่ละแท่ง (ทุกชั้น + เลขในแท่ง + ยอดบนหัว) หุบลงทีละแท่งจากซ้ายไปขวา แล้วกางออกเป็นอีกหน้า
 *   เหมือนแจกไพ่ · จังหวะอยู่ `useFlipSwap` · เลขอยู่ในรูปทรงของแท่งเอง (ไม่ใช่ LabelList) ⇒ พลิกไปพร้อมแท่ง
 * - วันที่มากสุดเข้ม วันอื่นจางลงนิด (80%) · มากสุด + เฉลี่ย (ปัดเป็นจำนวนเต็ม · รอบ 7) บอกบนหัวกราฟ
 *   (เส้นประเฉลี่ยของรอบ 4 ถอดแล้ว — เจ้าของถามว่าเส้นปะคืออะไร แล้วสั่ง *"เอาออก"*)
 * - กดตรงไหนของคอลัมน์ก็ได้ ⇒ `onPick(index)` ให้หน้าเปิดแผงเลื่อนข้าง · แท่งว่างกดแล้วไม่มีอะไรเกิดขึ้น
 * 🔴 สีแท่ง = `currentColor` + คลาส `TONE[...].value` (มีคู่ `dark:`) · จุดหน้าป้ายใช้สีเดียวกับแท่ง · ไม่มี hex ใหม่
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type RectangleProps,
  type TooltipProps,
} from 'recharts';
import { barLabelLines } from '@/components/home-ai-share/barLabel';
import { useFlipSwap } from '@/components/home-ai-share/useFlipSwap';
import { CHART } from '@/lib/designTokens';
import {
  AI_SHARE_GRAIN_LABEL,
  bucketText,
  detailAverage,
  detailPeak,
  roundToHundred,
  type AiShareBucket,
  type AiShareGrain,
} from '@/lib/homeAiShare';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** เกินนี้เลขบนหัวแท่งเบียดกันจนอ่านไม่ออก ⇒ เหลือให้จี้ดูแทน */
const LABEL_LIMIT = 16;
/** มุมโค้งเฉพาะหัวแท่ง (ชั้นบนสุดที่มีค่า) — ชั้นกลางแท่งเหลี่ยม ต่อกันเป็นแท่งเดียว */
const TOP_RADIUS: [number, number, number, number] = [6, 6, 0, 0];
/** แท่งกว้างสุดเท่านี้ (รอบ 18 · เจ้าของ: "กราฟแท่งหุบแท่งให้แคบลงหน่อย กว้างไป") — แท่งน้อยจอกว้างแท่งไม่บานเต็มช่อง */
const MAX_BAR = 44;
/** พลิกไพ่: ครึ่งจังหวะ (หุบหรือกาง) ต่อหนึ่งแท่ง · แท่งถัดไปเริ่มช้ากว่ากันนิด · ทั้งแถวเหลื่อมกันไม่เกิน `FLIP_SPREAD` */
const FLIP_HALF = 0.22;
const FLIP_STAGGER = 0.06;
const FLIP_SPREAD = 0.5;

/** หนึ่งชั้นในแท่ง — ก้อน AI/คน หรือ BU หนึ่งตัว */
export type UsageStack = {
  key: string;
  /** คำบนป้าย/ตอนจี้ */
  label: string;
  /** คำอธิบายตอนเอาเมาส์ชี้ป้าย เช่น ชื่อเต็มของ BU */
  title?: string;
  values: readonly number[];
  /** คลาสสีตัวหนังสือ (`TONE[...].value`) — แท่งวาดด้วย `currentColor` */
  fill: string;
  /** จุดหน้าป้ายแบบพิเศษ (ยังไม่โทร = วงกลวง) · ไม่ส่ง = จุดทึบสีเดียวกับแท่ง */
  dot?: string;
  /** ยังไม่โทร = จางลง (ส่วนที่ยังว่างของงาน) */
  muted?: boolean;
};

type Row = Record<string, number | string> & { key: string; label: string; total: number; index: number };

const dataKeyOf = (i: number) => `s${i}`;
const opacityOf = (muted: boolean | undefined, strong: boolean) => (muted ? (strong ? 0.4 : 0.3) : strong ? 1 : 0.8);
const dotOf = (st: UsageStack) => st.dot ?? cn('bg-current', st.fill);

function UsageTooltip({
  active,
  payload,
  stacks,
  buckets,
  grain,
  unit,
  hideZero,
  pickHint,
}: TooltipProps<number, string> & {
  stacks: readonly UsageStack[];
  buckets: ReadonlyArray<AiShareBucket>;
  grain: AiShareGrain;
  unit: string;
  hideZero: boolean;
  pickHint: string | null;
}) {
  const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
  const b = row ? buckets[row.index] : undefined;
  if (!row || !b) return null;
  const items = stacks.map((st, i) => ({ st, v: Number(row[dataKeyOf(i)] ?? 0) })).filter((x) => !hideZero || x.v > 0);
  return (
    <div className="min-w-44 space-y-1.5 rounded-xl border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <p className="text-muted-foreground">{bucketText(b, grain)}</p>
      <p className="text-sm font-medium tabular-nums">
        ยอดใช้งาน {NUM.format(row.total)} {unit}
      </p>
      {items.length > 0 ? (
        <ul className="space-y-0.5">
          {items.map(({ st, v }) => (
            <li key={st.key} className="flex items-center justify-between gap-4 tabular-nums">
              <span className="inline-flex items-center gap-1.5">
                <span className={cn('inline-block h-2 w-2 rounded-full', dotOf(st))} aria-hidden />
                {st.label}
              </span>
              <span>{NUM.format(v)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {row.total > 0 && pickHint ? <p className="text-muted-foreground">{pickHint}</p> : null}
    </div>
  );
}

const AiShareUsageChart: React.FC<{
  buckets: ReadonlyArray<AiShareBucket>;
  /** ชั้นในแท่ง เรียงจากล่างขึ้นบน */
  stacks: readonly UsageStack[];
  /** เปลี่ยนเมื่อไหร่ แท่งพลิกไพ่ไปเป็นชั้นชุดใหม่ (สวิตช์แยก BU) · ค่าเดิม = อัปเดตทันที */
  flipKey: string;
  grain: AiShareGrain;
  unit: string;
  today: string;
  ariaLabel: string;
  onPick: (index: number) => void;
  /** บรรทัดท้ายตอนจี้แท่ง — บอกว่ากดแล้วได้อะไร (รายวัน = แยก BU · หน่วยใหญ่ = ลงไปดูข้างใน) */
  pickHint?: string | null;
  /** ตอนจี้ซ่อนชั้นที่เป็น 0 ของวันนั้น (โหมด BU — BU ที่วันนั้นไม่มีงานไม่ต้องขึ้น) */
  hideZeroInTooltip?: boolean;
  height?: number;
}> = ({ buckets, stacks, flipKey, grain, unit, today, ariaLabel, onPick, pickHint = null, hideZeroInTooltip = false, height = 260 }) => {
  const reduced = !!useReducedMotion();
  const n = buckets.length;
  const stagger = n > 1 ? Math.min(FLIP_STAGGER, FLIP_SPREAD / (n - 1)) : 0;
  const halfMs = Math.round((FLIP_HALF + stagger * Math.max(0, n - 1)) * 1000);
  const incoming = useMemo(() => ({ stacks, hideZero: hideZeroInTooltip }), [stacks, hideZeroInTooltip]);
  const { shown, phase } = useFlipSwap(incoming, flipKey, halfMs, reduced);
  const view = shown.stacks;

  const totals = useMemo(() => buckets.map((_, i) => view.reduce((s, st) => s + (st.values[i] ?? 0), 0)), [buckets, view]);
  const peak = detailPeak(buckets, totals);
  const avg = detailAverage(buckets, totals, today);
  const per = AI_SHARE_GRAIN_LABEL[grain];
  /** % ของแต่ละสีในแต่ละแท่ง — ปัดรวมกันได้ 100 ต่อแท่ง */
  const barPct = useMemo(() => buckets.map((_, i) => roundToHundred(view.map((st) => st.values[i] ?? 0))), [buckets, view]);
  /** % ของแต่ละสีทั้งช่วง (ป้ายสีด้านบน) — ปัดรวมกันได้ 100 */
  const legendPct = useMemo(() => roundToHundred(view.map((st) => st.values.reduce((s, v) => s + v, 0))), [view]);
  const data = useMemo<Row[]>(
    () =>
      buckets.map((b, i) => {
        const row = { key: b.key, label: b.label, total: totals[i] ?? 0, index: i } as Row;
        view.forEach((st, si) => {
          row[dataKeyOf(si)] = st.values[i] ?? 0;
        });
        return row;
      }),
    [buckets, view, totals],
  );
  /** ชั้นบนสุดที่มีค่าของแท่งนั้น — ได้มุมโค้ง + เลขยอดบนหัว */
  const topOf = (row: Row | undefined) => {
    if (!row) return -1;
    for (let si = view.length - 1; si >= 0; si -= 1) if (Number(row[dataKeyOf(si)] ?? 0) > 0) return si;
    return -1;
  };
  const showTotals = n <= LABEL_LIMIT;

  /**
   * รูปทรงของชั้นหนึ่งในแท่ง = สี่เหลี่ยม + เลข % ในสี + (ชั้นบนสุด) ยอดบนหัว — ห่อด้วย `motion.g` ที่หุบ/กางแนวนอน
   * รอบแกนกลางของแท่ง ⇒ ทุกชั้นในคอลัมน์เดียวกันพลิกพร้อมกันเป็นไพ่ใบเดียว · แท่งถัดไปช้ากว่ากัน `stagger`
   */
  const shapeOf = (si: number) => {
    const st = view[si];
    const BarShape = (p: RectangleProps & { payload?: Row; index?: number }) => {
      const row = p.payload;
      const i = row?.index ?? Number(p.index ?? 0);
      const x = Number(p.x);
      const y = Number(p.y);
      const w = Number(p.width);
      const h = Number(p.height);
      const top = topOf(row) === si;
      const value = Number(row?.[dataKeyOf(si)] ?? 0);
      const lines = barLabelLines(value, barPct[i]?.[si] ?? 0, w, h, showTotals && !!row && value === row.total);
      const cx = x + w / 2;
      const cy = y + h / 2;
      return (
        <motion.g
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          initial={phase === 'in' ? { scaleX: 0 } : false}
          animate={{ scaleX: phase === 'out' ? 0 : 1 }}
          transition={{
            duration: reduced ? 0 : FLIP_HALF,
            delay: reduced ? 0 : i * stagger,
            ease: phase === 'out' ? 'easeIn' : 'easeOut',
          }}
        >
          <Rectangle {...p} radius={top ? TOP_RADIUS : 0} />
          {lines.map((t, li) => (
            <text
              key={li}
              x={cx}
              y={lines.length === 2 ? cy + (li === 0 ? -6 : 7) : cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={lines.length === 2 && li === 1 ? 10 : 11}
              className={cn('pointer-events-none', st.muted ? 'fill-foreground' : 'fill-background')}
            >
              {t}
            </text>
          ))}
          {top && showTotals && row && row.total > 0 ? (
            <text x={cx} y={y - 6} textAnchor="middle" fontSize={11} className="pointer-events-none fill-foreground">
              {NUM.format(row.total)}
            </text>
          ) : null}
        </motion.g>
      );
    };
    return BarShape;
  };

  if (!peak) return <p className="py-16 text-center text-sm text-muted-foreground">ช่วงนี้ยังไม่มีงาน</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
        {/* ป้ายสี = สีไหนคืออะไร กี่ % ของทั้งช่วง (รอบ 9 · เจ้าของ: "แยก BU ไม่มีบอกว่า BU ไหนสีอะไร")
            รอบ 17: โหมด BU ขึ้นครบทุก BU รอไว้ ("ทำสีของทุก BU อธิบายรอไว้เลย") · ชื่อสีอยู่ที่นี่ที่เดียว ในแท่งเหลือเลข + % */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm" aria-label="สีในแท่ง">
          {view.map((st, si) => (
            <span key={st.key} className="inline-flex items-center gap-2 text-foreground" title={st.title}>
              <span className={cn('inline-block h-3 w-3 rounded-sm', dotOf(st))} aria-hidden />
              {st.label}
              <span className="tabular-nums text-muted-foreground">{NUM.format(legendPct[si] ?? 0)}%</span>
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground tabular-nums">
          <span>
            มากสุด <span className="text-foreground">{bucketText(peak.bucket, grain)}</span> {NUM.format(peak.value)} {unit}
          </span>
          {avg !== null ? (
            <span>
              เฉลี่ย {NUM.format(Math.round(avg))} {unit}/{per}
            </span>
          ) : null}
        </div>
      </div>
      <div className="w-full cursor-pointer text-muted-foreground" style={{ height }} role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 8, left: -8, bottom: 0 }}
            barCategoryGap="30%"
            maxBarSize={MAX_BAR}
            onClick={(state) => {
              const i = state?.activeTooltipIndex;
              if (typeof i === 'number' && (totals[i] ?? 0) > 0) onPick(i);
            }}
          >
            <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} minTickGap={8} />
            <YAxis
              tick={{ fontSize: 11, fill: CHART.axisFill }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              tickFormatter={(v: number) => NUM.format(v)}
            />
            <Tooltip
              cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
              content={(p: TooltipProps<number, string>) => (
                <UsageTooltip
                  {...p}
                  stacks={view}
                  buckets={buckets}
                  grain={grain}
                  unit={unit}
                  hideZero={shown.hideZero}
                  pickHint={pickHint}
                />
              )}
            />
            {view.map((st, si) => (
              <Bar
                key={st.key}
                dataKey={dataKeyOf(si)}
                stackId="use"
                fill="currentColor"
                className={st.fill}
                shape={shapeOf(si)}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.key} fillOpacity={opacityOf(st.muted, d.key === peak.bucket.key)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AiShareUsageChart;
