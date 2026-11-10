import React from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { STUCK_PHASES, stuckByOwner, type StuckRequest } from '@/lib/recruitStuck';
import { OverviewCard } from '../RecruitOverviewParts';

/**
 * ═══ ส่วนที่ 2: ติดที่ใคร (เจ้าของ 4 พ.ย. 2569 "อ้อใบนี้ของใครรับผิดชอบบ้าง ช้าที่ใครเท่าไหร่") ═══
 * แถว = เจ้าหน้าที่สรรหาของใบ · คอลัมน์ = ใบที่ต้องหา · 4 ช่วง · ค้างนานสุด · กดเลขเปิดรายการใบ
 */
export default function StuckOwnerTable({
  rows,
  onPick,
  countLabel = 'ใบที่ต้องหา',
  bars = false,
}: {
  rows: readonly StuckRequest[];
  onPick: (title: string, list: StuckRequest[]) => void;
  /** หัวคอลัมน์จำนวนใบ — ตามใบชุดที่เลือกบนสุด */
  countLabel?: string;
  /** แท่งต่อช่อง (ต้นแบบ SO Recruit 10 พ.ย. 2569 "งานอยู่ที่ใคร" — แต่ละคนมีงานกี่ใบในแต่ละช่วง อ่านจากแท่ง+เลข) · ยาวเทียบช่องที่มากสุดของช่วงเดียวกัน · สีเทาสีเดียว (เจ้าของ 10 พ.ย. 2569 "ใช้หลอดสีเทาสีเดียวแบบต้นแบบ") หัวคอลัมน์บอกช่วง */
  bars?: boolean;
}) {
  const owners = React.useMemo(() => stuckByOwner(rows), [rows]);
  const phaseMax = React.useMemo(
    () => Object.fromEntries(STUCK_PHASES.map((p) => [p.key, Math.max(1, ...owners.map((o) => o.byPhase[p.key].length))])) as Record<string, number>,
    [owners],
  );
  const cell = (list: StuckRequest[], title: string) =>
    list.length ? (
      <Button type="button" variant="ghost" size="xs" className="-mr-2 h-7 px-2 tabular-nums" onClick={() => onPick(title, list)}>
        {fmt(list.length)}
      </Button>
    ) : (
      <span className={cn('px-2 tabular-nums', DASH.sub)}>0</span>
    );
  return (
    <OverviewCard icon={Users} title="ติดที่ใคร" sub="เจ้าหน้าที่สรรหาของใบ · กดเลขดูใบ">
      <div className="overflow-x-auto" data-testid="stuck-owners">
        <Table>
          <TableHeader>
            <TableRow className={DASH.tableHead}>
              <TableHead className="text-xs">เจ้าหน้าที่สรรหา</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">{countLabel}</TableHead>
              {STUCK_PHASES.map((p) => (
                <TableHead key={p.key} className={cn('whitespace-nowrap text-right text-xs', TONE[p.tone].value)}>
                  {p.label}
                </TableHead>
              ))}
              <TableHead className="whitespace-nowrap text-right text-xs">ค้างนานสุด</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {owners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  ไม่มี{countLabel}
                </TableCell>
              </TableRow>
            ) : null}
            {owners.map((o) => (
              <TableRow key={o.name} data-testid="stuck-owner-row">
                <TableCell className="text-sm font-medium">{o.name}</TableCell>
                <TableCell className="p-1 text-right">{cell(o.rows, `${o.name} · ${countLabel}`)}</TableCell>
                {STUCK_PHASES.map((p) => (
                  <TableCell key={p.key} className="p-1 text-right">
                    {bars ? (
                      <span className="flex items-center justify-end gap-2">
                        <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-24" aria-hidden>
                          <span className="block h-full rounded-full bg-foreground/40" style={{ width: `${(o.byPhase[p.key].length / phaseMax[p.key]) * 100}%` }} />
                        </span>
                        {cell(o.byPhase[p.key], `${o.name} · ${p.label}`)}
                      </span>
                    ) : (
                      cell(o.byPhase[p.key], `${o.name} · ${p.label}`)
                    )}
                  </TableCell>
                ))}
                <TableCell className="text-right text-sm tabular-nums">{o.rows.some((r) => r.ageDays !== null) ? `${fmt(o.oldest)} วัน` : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </OverviewCard>
  );
}
