/**
 * ═══ โดนัทสัดส่วน + เอาเม้าจี้แล้วบอกรายละเอียด (หน้าทีม Online รอบ 5 · 29 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"มีกราฟแบบ Donut ข้างๆที่บอกสัดส่วนว่า Bu ไหนอย่างละ กี่ % แล้วพอเอาเม้าไปจี้ไว้ขึ้นบอกว่า …"*
 * - ชิ้นโดนัท = ค่าของแต่ละกลุ่ม (BU / ที่มาของสาย) · กลางวง = ยอดรวม
 * - จี้ชิ้นไหน = กล่องบอก ค่า · % ของทั้งหมด · บรรทัดรายละเอียดที่ผู้เรียกส่งมา (`lines`)
 * - รายการใต้วงโชว์ **ทุกกลุ่ม รวมกลุ่มที่เป็น 0** (ทีมที่ยังไม่ใช้ต้องเห็น ห้ามหายเงียบ) · จี้รายการก็เห็นรายละเอียดเหมือนกัน
 * 🔴 สีชิ้น = `currentColor` + คลาส `TONE[...].value` (มีคู่ `dark:`) — แบบเดียวกับแท่งของ `BuTrendChart` (hex ของ TONE จมพื้นโหมดมืด)
 */
import React, { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART, DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const PCT0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

export type DonutLine = { label: string; value: string };

export type DonutSlice = {
  key: string;
  label: string;
  value: number;
  tone: ToneKey;
  /** บรรทัดรองใต้ชื่อในรายการ (เช่น "27/37 บัญชี · 73%") */
  sub?: string;
  /** รายละเอียดตอนจี้ */
  lines?: ReadonlyArray<DonutLine>;
};

const share = (v: number, total: number) => (total > 0 ? `${PCT0.format((v / total) * 100)}%` : '—');

function Tip({ active, payload, unit, total }: { active?: boolean; payload?: Array<{ payload: DonutSlice }>; unit: string; total: number }) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  // 🔴 ป้ายดำของกราฟ (`CHART.tooltip`) ใช้สีของป้ายเอง — คลาสสีตัวอักษรของหน้า (กรมท่า) จมหายบนพื้นดำ (เห็นบนเว็บจริง)
  return (
    <div style={CHART.tooltip.contentStyle} className="space-y-1 px-3 py-2">
      <p style={CHART.tooltip.itemStyle} className="font-medium">
        {s.label}
      </p>
      <p style={CHART.tooltip.labelStyle} className="tabular-nums">
        {NUM.format(s.value)} {unit} · {share(s.value, total)} ของทั้งหมด
      </p>
      {(s.lines ?? []).map((l) => (
        <p key={l.label} className="flex justify-between gap-4 tabular-nums">
          <span style={CHART.tooltip.labelStyle}>{l.label}</span>
          <span style={CHART.tooltip.itemStyle}>{l.value}</span>
        </p>
      ))}
    </div>
  );
}

const BuDonut: React.FC<{
  title: string;
  slices: ReadonlyArray<DonutSlice>;
  unit: string;
  /** กลุ่มที่กำลังเลือก (ตัวกรอง BU) — กลุ่มอื่นจางลง */
  selected?: string | null;
  empty?: string;
  ariaLabel: string;
}> = ({ title, slices, unit, selected = null, empty = 'ยังไม่มีข้อมูลในช่วงนี้', ariaLabel }) => {
  const total = useMemo(() => slices.reduce((s, x) => s + Math.max(0, x.value), 0), [slices]);
  const drawn = slices.filter((s) => s.value > 0);
  const faded = (key: string) => !!selected && key !== selected;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {total <= 0 ? (
        <p className={cn('py-10 text-center text-sm', DASH.muted)}>{empty}</p>
      ) : (
        <div className="relative h-48 w-full" role="img" aria-label={ariaLabel}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn as DonutSlice[]}
                dataKey="value"
                nameKey="label"
                innerRadius="58%"
                outerRadius="92%"
                paddingAngle={drawn.length > 1 ? 1 : 0}
                stroke="none"
                isAnimationActive={false}
              >
                {drawn.map((s) => (
                  <Cell key={s.key} fill="currentColor" className={TONE[s.tone].value} fillOpacity={faded(s.key) ? 0.25 : 1} />
                ))}
              </Pie>
              <Tooltip content={<Tip unit={unit} total={total} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-medium tabular-nums text-foreground">{NUM.format(total)}</span>
            <span className={cn('text-xs', DASH.muted)}>{unit}</span>
          </div>
        </div>
      )}
      <ul className="space-y-1.5">
        {slices.map((s) => (
          <li
            key={s.key}
            className={cn('flex items-start justify-between gap-3 text-xs', faded(s.key) && 'opacity-60')}
            title={(s.lines ?? []).map((l) => `${l.label} ${l.value}`).join('\n') || undefined}
          >
            <span className="inline-flex min-w-0 items-start gap-2">
              <span className={cn('mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-current', TONE[s.tone].value)} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-foreground">{s.label}</span>
                {s.sub ? <span className={cn('block', DASH.muted)}>{s.sub}</span> : null}
              </span>
            </span>
            <span className="shrink-0 text-right tabular-nums text-foreground">
              {NUM.format(s.value)} {unit}
              <span className={cn('ml-1', DASH.muted)}>{share(s.value, total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default BuDonut;
