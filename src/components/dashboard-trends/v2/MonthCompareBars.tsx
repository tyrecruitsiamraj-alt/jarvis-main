/**
 * ═══ กราฟแท่งตั้งเทียบรายเดือน (เจ้าของ 17 พ.ย. 2569) ═══
 * "ใช้กราฟแท่งแนวตั้งแบบเปรียบเทียบ โดยยึดตามช่วงเดือน ถ้าเลือกหลายเดือนก็เทียบเป็นเดือนให้ดู ไม่ใช่เป็นกราฟแนวนอนหมด"
 * แกนนอน = กลุ่ม (BU / ช่องทาง / คน / วิธี / จังหวัด / อายุ / เพศ) · แต่ละกลุ่มมีแท่งของแต่ละเดือนวางคู่กัน · เดือนเดียว = แท่งเดียว
 * กดแท่งหรือชื่อกลุ่ม = เลือกกลุ่มนั้น · สีเดือนเรียงตายตัว (ไม่ใช้สีที่มีความหมาย เขียว/เหลือง/แดง)
 */
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';

const MONTH_TONES: readonly ToneKey[] = ['primary', 'violet', 'teal', 'orange', 'info', 'neutral'];
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const monthLabel = (ym: string) => `${TH_MONTH[Number(ym.slice(5, 7)) - 1]} ${String(Number(ym.slice(0, 4)) + 543).slice(2)}`;
/** ชื่อกลุ่มใต้แท่ง — ยาวเกินตัดท้าย (ชื่อเต็มอยู่ในกล่องตัวเลข) */
const short = (s: string) => (s.length > 14 ? `${s.slice(0, 13)}…` : s);

export type MonthGroup = { key: string; byMonth: Record<string, number> };

export function MonthCompareBars({
  groups,
  months,
  onPick,
  height = 260,
  testId,
  unit = 'รายการ',
  seriesName = monthLabel,
}: {
  groups: readonly MonthGroup[];
  /** เดือนในช่วงที่เลือก (YYYY-MM) เรียงเก่า → ใหม่ */
  months: readonly string[];
  onPick?: (key: string) => void;
  height?: number;
  testId?: string;
  /** หน่วยในกล่องตัวเลข (รายการ / ใบ) */
  unit?: string;
  /** ชื่อชุดแท่งในกล่องตัวเลข/คำอธิบายสี — ค่าเริ่ม = ชื่อเดือน */
  seriesName?: (key: string) => string;
}) {
  const data = groups.map((g) => ({ key: g.key, ...Object.fromEntries(months.map((m) => [m, g.byMonth[m] ?? 0])) }));
  if (groups.length === 0) return <p className={cn('py-8 text-center text-sm', DASH.muted)}>ไม่มีรายการ</p>;
  return (
    <div className={cn('w-full', DASH.sub)} style={{ height }} data-testid={testId}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -16 }} barCategoryGap="18%" barGap={2}>
          <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
          <XAxis
            dataKey="key"
            interval={0}
            tickLine={false}
            tick={{ fontSize: 11, fill: CHART.axisFill }}
            tickFormatter={short}
            className={onPick ? 'cursor-pointer' : undefined}
            onClick={(e: { value?: string }) => e?.value && onPick?.(String(e.value))}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} />
          <Tooltip
            {...CHART.tooltipLight}
            cursor={CHART.cursorBar}
            formatter={(v: number, name: string) => [`${v.toLocaleString('th-TH')} ${unit}`, seriesName(name)]}
          />
          {months.length > 1 ? <Legend formatter={(v: string) => seriesName(v)} wrapperStyle={{ fontSize: 12 }} /> : null}
          {months.map((m, i) => (
            <Bar
              key={m}
              dataKey={m}
              name={m}
              fill={TONE[MONTH_TONES[i % MONTH_TONES.length]].hex}
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
              animationDuration={CHART.animationDuration}
              className={onPick ? 'cursor-pointer' : undefined}
              onClick={(d: { key?: string }) => d?.key && onPick?.(d.key)}
            >
              <LabelList dataKey={m} position="top" fontSize={11} fill="currentColor" formatter={(v: number) => (v ?? 0).toLocaleString('th-TH')} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
