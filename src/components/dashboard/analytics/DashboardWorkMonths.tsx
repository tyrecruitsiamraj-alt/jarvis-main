import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CHART, DASH, TONE } from '@/lib/designTokens';
import { TH_MONTH_SHORT } from '@/lib/periodPick';
import type { WorkMonthRow } from '@/lib/dashboard/throughput';

/**
 * กด "ใบขอทั้งหมด" ของสถานะทำงาน = เทียบรายเดือน เข้ามา · ปิดแล้ว · ยกเลิก (เจ้าของ 23 พ.ย. 2569
 * "กดทั้งหมดก็เทียบเดือนให้ดูว่าเดือนไหนเข้าเยอะ เดือนไหนปิดเยอะ ยกเลิกเยอะ") · ตัวคิด `buildWorkMonths`
 * กดแท่งหรือแถวเดือน = ทั้งหน้าเป็นเดือนนั้น (ตัวเดียวกับกดแท่งของกราฟบนสุด) · ต่อเดือน เข้ามา = ปิดแล้ว + ยกเลิก + เหลือหา
 */
const NUM = new Intl.NumberFormat('th-TH');
const monthText = (ym: string) => `${TH_MONTH_SHORT[Number(ym.slice(5, 7)) - 1]} ${Number(ym.slice(0, 4)) + 543}`;

export default function DashboardWorkMonths({
  label,
  rows,
  onMonthClick,
  onClear,
}: {
  label: string;
  rows: readonly WorkMonthRow[];
  onMonthClick?: (monthStartYmd: string, label: string) => void;
  onClear: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  const sum = rows.reduce(
    (t, r) => ({ requested: t.requested + r.requested, filled: t.filled + r.filled, cancelled: t.cancelled + r.cancelled, remaining: t.remaining + r.remaining }),
    { requested: 0, filled: 0, cancelled: 0, remaining: 0 },
  );
  const chart = rows.map((r) => ({ month: r.month, เดือน: monthText(r.month), เข้ามา: r.requested, ปิดแล้ว: r.filled, ยกเลิก: r.cancelled }));
  const pick = (ym: string) => onMonthClick?.(`${ym}-01`, monthText(ym));

  return (
    <div ref={rootRef} className={cn('scroll-mt-20 space-y-4 p-4 sm:p-6', DASH.panel)} data-testid="dashboard-work-months">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div>
          <p className={cn('text-lg font-medium', DASH.cellStrong)}>เทียบรายเดือน</p>
          <p className={cn('text-[11px]', DASH.muted)}>{label} · ตามเดือนที่ต้องการคน</p>
        </div>
        <Button type="button" variant="outline" size="xs" onClick={onClear} data-testid="dashboard-work-months-clear">
          <X aria-hidden />
          ปิด
        </Button>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART.gridStroke} strokeOpacity={CHART.gridOpacity} vertical={false} />
            <XAxis dataKey="เดือน" tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: CHART.axisFill }} tickLine={false} axisLine={false} width={48} />
            <Tooltip {...CHART.tooltip} cursor={CHART.cursorBar} formatter={(v: number, name: string) => [`${NUM.format(v)} อัตรา`, name]} />
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
            {(
              [
                ['เข้ามา', TONE.info.hex],
                ['ปิดแล้ว', TONE.success.hex],
                ['ยกเลิก', TONE.danger.hex],
              ] as const
            ).map(([key, fill]) => (
              <Bar
                key={key}
                dataKey={key}
                fill={fill}
                radius={[4, 4, 0, 0]}
                // พาสเทล: สีเดียวกับกล่อง (ฟ้า · เขียว · ชมพู) แต่จางลง
                fillOpacity={0.5}
                animationDuration={CHART.animationDuration}
                className={onMonthClick ? 'cursor-pointer' : undefined}
                onClick={(d: { payload?: { month?: string } }) => (d?.payload?.month ? pick(d.payload.month) : undefined)}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">เดือน</TableHead>
              <TableHead className="text-right text-xs">เข้ามา</TableHead>
              <TableHead className="text-right text-xs">ปิดแล้ว</TableHead>
              <TableHead className="text-right text-xs">ยกเลิก</TableHead>
              <TableHead className="text-right text-xs">เหลือหา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={r.month}
                className={onMonthClick ? 'cursor-pointer' : undefined}
                onClick={() => pick(r.month)}
                data-testid={`dashboard-work-month-${r.month}`}
              >
                <TableCell className={cn('text-sm', DASH.cellStrong)}>{monthText(r.month)}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', TONE.info.value)}>{NUM.format(r.requested)}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', TONE.success.value)}>{NUM.format(r.filled)}</TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', TONE.danger.value)}>{NUM.format(r.cancelled)}</TableCell>
                <TableCell className="text-right text-sm tabular-nums">{NUM.format(r.remaining)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="text-sm font-medium">รวมช่วงนี้</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(sum.requested)}</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(sum.filled)}</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(sum.cancelled)}</TableCell>
              <TableCell className="text-right text-sm font-medium tabular-nums">{NUM.format(sum.remaining)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  );
}
