import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { NO_RECRUITER_LABEL, STUCK_TODO_COLUMNS, stuckTodoByOwner, stuckTodoPeople, type StuckRequest } from '@/lib/recruitStuck';

/**
 * ข้อ 1 "ใครต้องทำอะไร" (เจ้าของ 11 พ.ย. 2569) — แถวละเจ้าหน้าที่สรรหาของใบ · ช่อง = ใบที่ค้างแต่ละขั้น (+ คนในช่องที่มีคน)
 * กดเลข = รายการใบในการ์ดขั้นที่ติดข้างบน (`onPick` ตัวเดียวกับตารางพื้นที่) · ว่างแล้วตารางยังอยู่ (แถวรวม 0)
 */
export default function StuckTodoTable({ rows, onPick }: { rows: readonly StuckRequest[]; onPick: (title: string, list: StuckRequest[]) => void }) {
  const owners = React.useMemo(() => stuckTodoByOwner(rows), [rows]);
  const totals = React.useMemo(
    () =>
      Object.fromEntries(
        STUCK_TODO_COLUMNS.map((c) => {
          const list = rows.filter((r) => c.reasons.includes(r.reason));
          return [c.key, list];
        }),
      ) as Record<(typeof STUCK_TODO_COLUMNS)[number]['key'], StuckRequest[]>,
    [rows],
  );

  const cell = (owner: string, label: string, peopleLabel: string | null, list: StuckRequest[], strong: boolean) => {
    if (list.length === 0) return <span className="text-muted-foreground">0</span>;
    const people = list.reduce((n, r) => n + stuckTodoPeople(r), 0);
    return (
      <>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn('-mr-2 px-2 text-sm tabular-nums', strong ? 'font-medium' : 'font-normal', owner === NO_RECRUITER_LABEL && TONE.danger.value)}
          onClick={() => onPick(`${owner} · ${label}`, list)}
        >
          {fmt(list.length)} ใบ
        </Button>
        {peopleLabel ? <span className="block text-xs font-normal text-muted-foreground">{`${peopleLabel} ${fmt(people)} คน`}</span> : null}
      </>
    );
  };

  return (
    <div className="overflow-x-auto" data-testid="stuck-todo">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">เจ้าหน้าที่</TableHead>
            {STUCK_TODO_COLUMNS.map((c) => (
              <TableHead key={c.key} className="whitespace-nowrap text-right text-xs">
                {c.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs">รวม</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {owners.map((o) => (
            <TableRow key={o.owner}>
              <TableCell className="text-sm">{o.owner}</TableCell>
              {STUCK_TODO_COLUMNS.map((c) => (
                <TableCell key={c.key} className="text-right text-sm tabular-nums">
                  {cell(o.owner, c.label, c.peopleLabel, o.cells[c.key], false)}
                </TableCell>
              ))}
              <TableCell className="text-right text-sm tabular-nums">{fmt(o.total)} ใบ</TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="text-sm font-medium">รวม</TableCell>
            {STUCK_TODO_COLUMNS.map((c) => (
              <TableCell key={c.key} className="text-right text-sm font-medium tabular-nums">
                {cell('ทุกคน', c.label, c.peopleLabel, totals[c.key], true)}
              </TableCell>
            ))}
            <TableCell className="text-right text-sm font-medium tabular-nums">{fmt(rows.length)} ใบ</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
