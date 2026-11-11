import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { CALLER_GROUPS, CALLER_TODO_KEYS, buildCallerResults, type CallerResultRow } from '@/lib/callerResults';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';

/**
 * ข้อ 2 "ทำแล้วเป็นไง" (เจ้าของ 11 พ.ย. 2569) — คนที่เก็บรายชื่อไปโทร · ทุกขั้นบอกทำแล้ว/ยังไม่ทำ · ยังไม่ทำ = ตัวแดง กดดูชื่อไปทำต่อ
 * ตัวคิด `buildCallerResults` ที่เดียว · ว่างแล้วตารางยังอยู่ (แถวรวม 0)
 */
export default function CallerResultsTable({
  cohort,
  onOpen,
}: {
  cohort: readonly RecruitAppFact[];
  onOpen: (title: string, ids: readonly string[]) => void;
}) {
  const r = React.useMemo(() => buildCallerResults(cohort), [cohort]);

  const num = (title: string, ids: readonly string[], opts: { todo?: boolean; strong?: boolean; className?: string } = {}) => (
    <TableCell className={cn('text-right text-sm tabular-nums', opts.strong && 'font-medium', opts.className)}>
      {ids.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className={cn('-mr-2 px-2 text-sm tabular-nums', opts.strong ? 'font-medium' : 'font-normal', opts.todo && TONE.danger.value)}
          onClick={() => onOpen(title, ids)}
        >
          {fmt(ids.length)}
        </Button>
      ) : (
        <span className="inline-flex h-7 items-center text-muted-foreground">0</span>
      )}
    </TableCell>
  );

  const line = (row: CallerResultRow, strong: boolean) => (
    <TableRow key={row.who}>
      <TableCell className={cn('text-sm', strong && 'font-medium')}>{row.who}</TableCell>
      {num(`${row.who} · เก็บไป`, row.kept, { strong })}
      {CALLER_GROUPS.flatMap((g) =>
        g.cells.map((c, ci) =>
          React.cloneElement(num(`${row.who} · ${c.label}`, row[c.key], { strong, todo: CALLER_TODO_KEYS.has(c.key), className: ci === 0 ? 'border-l border-border' : undefined }), {
            key: c.key,
          }),
        ),
      )}
    </TableRow>
  );

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto" data-testid="caller-results">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2} className="align-bottom text-xs">
                คนโทร
              </TableHead>
              <TableHead rowSpan={2} className="align-bottom text-right text-xs">
                เก็บไป
              </TableHead>
              {CALLER_GROUPS.map((g) => (
                <TableHead key={g.label} colSpan={g.cells.length} className="border-l border-border text-center text-xs font-medium text-foreground">
                  {g.label}
                </TableHead>
              ))}
            </TableRow>
            <TableRow>
              {CALLER_GROUPS.flatMap((g) =>
                g.cells.map((c, ci) => (
                  <TableHead key={c.key} className={cn('whitespace-nowrap text-right text-xs', ci === 0 && 'border-l border-border')}>
                    {c.label}
                  </TableHead>
                )),
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {r.rows.map((row) => line(row, false))}
            {line(r.total, true)}
            <TableRow>
              <TableCell className="text-sm">AI (ยังไม่มีคนเก็บ)</TableCell>
              {num('AI · ส่งให้ AI', r.ai.sent)}
              {num('AI · ยังไม่โทร', r.ai.notCalled, { todo: true, className: 'border-l border-border' })}
              {num('AI · ติดต่อไม่ได้', r.ai.unreachable)}
              {num('AI · ติดต่อได้', r.ai.reached)}
              <TableCell colSpan={2} className="border-l border-border text-sm">
                {r.ai.interested.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className={cn('-ml-2 px-2 text-sm font-normal', TONE.danger.value)}
                    onClick={() => onOpen('AI · สนใจ ยังไม่มีคนเก็บไปนัด', r.ai.interested)}
                  >
                    สนใจ ยังไม่มีคนเก็บไปนัด {fmt(r.ai.interested.length)}
                  </Button>
                ) : (
                  <span className="text-muted-foreground">สนใจ ยังไม่มีคนเก็บไปนัด 0</span>
                )}
              </TableCell>
              <TableCell colSpan={5} className="border-l border-border" />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
