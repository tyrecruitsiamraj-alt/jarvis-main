import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART, chartDayLabel } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { dailySeriesOf } from '@/lib/recruitCompare';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

/** สีเส้น: ช่วงนี้ = สีหลักของแบรนด์ · ช่วงก่อน = สีจาง (ตัวแปรธีม ไม่ใช่ hex) */
const CUR_STROKE = 'hsl(var(--primary))';
const PREV_STROKE = 'hsl(var(--muted-foreground))';

/**
 * รายชื่อที่กรอกมา รายวัน ช่วงนี้ทับช่วงก่อน (ข้อ 3 · เจ้าของ 13 พ.ย. 2569 "ต้องดูแนวโน้มได้ เพิ่มหรือลด")
 * แกนนอน = วันที่ลำดับในช่วง (ช่วงก่อนยาวเท่ากัน) · นับด้วย `dailySeriesOf('names')` ตัวเดียวกับกราฟเทียบช่วงเดิม · วันไม่มี = 0
 */
export default function DailyCompareChart({
  list,
  prevList,
  from,
  to,
  prevFrom,
  prevTo,
  curLabel,
  prevLabel,
}: {
  list: readonly RecruitAppFact[];
  prevList: readonly RecruitAppFact[];
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  curLabel: string;
  prevLabel: string;
}) {
  const data = React.useMemo(() => {
    const cur = dailySeriesOf('names', from, to, list, null);
    const prev = dailySeriesOf('names', prevFrom, prevTo, prevList, null);
    return cur.map((c, i) => ({ i: i + 1, day: c.day, cur: c.n, prevDay: prev[i]?.day ?? null, prev: prev[i]?.n ?? null }));
  }, [list, prevList, from, to, prevFrom, prevTo]);
  return (
    <div className="space-y-2" data-testid="daily-compare">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">รายชื่อที่กรอกมา รายวัน</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-primary" aria-hidden />
          {curLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-muted-foreground" aria-hidden />
          {prevLabel}
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} />
            <XAxis dataKey="i" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} />
            <Tooltip
              {...CHART.tooltipLight}
              cursor={CHART.cursorLine}
              labelFormatter={() => ''}
              formatter={(value: number, name: string, item) => {
                const p = item?.payload as { day: string; prevDay: string | null } | undefined;
                const day = name === 'cur' ? p?.day : p?.prevDay;
                return [fmt(Number(value)), day ? chartDayLabel(day) : name === 'cur' ? curLabel : prevLabel];
              }}
            />
            <Line type="linear" dataKey="prev" name="prev" stroke={PREV_STROKE} strokeWidth={2} dot={{ r: 3 }} activeDot={CHART.activeDot} />
            <Line type="linear" dataKey="cur" name="cur" stroke={CUR_STROKE} strokeWidth={2} dot={{ r: 3 }} activeDot={CHART.activeDot} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
