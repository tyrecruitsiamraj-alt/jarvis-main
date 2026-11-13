import React from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { CALLER_GROUPS, CALLER_TODO_KEYS, buildCallerResults, type CallerResultRow } from '@/lib/callerResults';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import TrendDelta from './TrendDelta';

/**
 * ข้อ 2 "ทำแล้วเป็นไง" (เจ้าของ 11 พ.ย. 2569) — คนที่เก็บรายชื่อไปโทร · ทุกขั้นบอกทำแล้ว/ยังไม่ทำ · ยังไม่ทำ = ตัวแดง กดดูชื่อไปทำต่อ
 * ตัวคิด `buildCallerResults` ที่เดียว · ว่างแล้วตารางยังอยู่ (แถวรวม 0)
 * `prev` (13 พ.ย. 2569 "ต้องดูแนวโน้มได้ เพิ่มหรือลด") = รายชื่อช่วงก่อน → ช่องเทียบช่วงก่อนต่อคน + แถวช่วงก่อน/เทียบช่วงก่อนใต้รวม
 */
/** ช่องที่เพิ่มแล้วแย่ — ยังไม่ทำ + ติดต่อไม่ได้ + ไม่มา */
const UP_BAD = new Set<string>([...CALLER_TODO_KEYS, 'notOk', 'noShow']);
const AI_UP_BAD = new Set(['notCalled', 'unreachable', 'interested']);

export default function CallerResultsTable({
  cohort,
  onOpen,
  prev,
  prevLabel = 'ช่วงก่อน',
}: {
  cohort: readonly RecruitAppFact[];
  onOpen: (title: string, ids: readonly string[]) => void;
  /** รายชื่อช่วงก่อน (ช่วงวันเท่ากัน) — ไม่ส่ง = ไม่มีช่องเทียบ (โฉมเดิม) */
  prev?: readonly RecruitAppFact[] | null;
  prevLabel?: string;
}) {
  const r = React.useMemo(() => buildCallerResults(cohort), [cohort]);
  const pr = React.useMemo(() => (prev ? buildCallerResults(prev) : null), [prev]);
  const prevOf = React.useMemo(() => new Map((pr?.rows ?? []).map((x) => [x.who, x])), [pr]);
  const plain = (n: number, className?: string) => (
    <TableCell className={cn('text-right text-sm tabular-nums text-muted-foreground', className)}>{fmt(n)}</TableCell>
  );
  const delta = (cur: number, before: number, bad: boolean, className?: string) => (
    <TableCell className={cn('text-right', className)}>
      <TrendDelta cur={cur} prev={before} sense={bad ? 'bad' : 'good'} />
    </TableCell>
  );

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
      <TableCell className={cn('whitespace-nowrap text-sm', strong && 'font-medium')}>{row.who}</TableCell>
      {num(`${row.who} · เก็บไป`, row.kept, { strong })}
      {pr ? delta(row.kept.length, (strong ? pr.total : prevOf.get(row.who))?.kept.length ?? 0, false) : null}
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
              {pr ? (
                <TableHead rowSpan={2} className="whitespace-nowrap align-bottom text-right text-xs">
                  เทียบช่วงก่อน
                </TableHead>
              ) : null}
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
            {pr ? (
              <>
                <TableRow data-testid="caller-results-prev">
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{prevLabel}</TableCell>
                  {plain(pr.total.kept.length)}
                  <TableCell />
                  {CALLER_GROUPS.flatMap((g) => g.cells.map((c, ci) => React.cloneElement(plain(pr.total[c.key].length, ci === 0 ? 'border-l border-border' : undefined), { key: c.key })))}
                </TableRow>
                <TableRow data-testid="caller-results-delta">
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">เทียบช่วงก่อน</TableCell>
                  <TableCell />
                  <TableCell />
                  {CALLER_GROUPS.flatMap((g) =>
                    g.cells.map((c, ci) =>
                      React.cloneElement(delta(r.total[c.key].length, pr.total[c.key].length, UP_BAD.has(c.key), ci === 0 ? 'border-l border-border' : undefined), { key: c.key }),
                    ),
                  )}
                </TableRow>
              </>
            ) : null}
            <TableRow>
              <TableCell className="text-sm">AI (ยังไม่มีคนเก็บ)</TableCell>
              {num('AI · ส่งให้ AI', r.ai.sent)}
              {pr ? delta(r.ai.sent.length, pr.ai.sent.length, false) : null}
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
            {pr ? (
              <>
                <TableRow data-testid="caller-results-ai-prev">
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">AI {prevLabel}</TableCell>
                  {plain(pr.ai.sent.length)}
                  <TableCell />
                  {plain(pr.ai.notCalled.length, 'border-l border-border')}
                  {plain(pr.ai.unreachable.length)}
                  {plain(pr.ai.reached.length)}
                  <TableCell colSpan={2} className="border-l border-border text-sm text-muted-foreground">
                    สนใจ ยังไม่มีคนเก็บไปนัด {fmt(pr.ai.interested.length)}
                  </TableCell>
                  <TableCell colSpan={5} className="border-l border-border" />
                </TableRow>
                <TableRow data-testid="caller-results-ai-delta">
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">AI เทียบช่วงก่อน</TableCell>
                  <TableCell />
                  <TableCell />
                  {(['notCalled', 'unreachable', 'reached'] as const).map((k, i) => React.cloneElement(delta(r.ai[k].length, pr.ai[k].length, AI_UP_BAD.has(k), i === 0 ? 'border-l border-border' : undefined), { key: k }))}
                  <TableCell colSpan={2} className="border-l border-border">
                    <TrendDelta cur={r.ai.interested.length} prev={pr.ai.interested.length} sense="bad" />
                  </TableCell>
                  <TableCell colSpan={5} className="border-l border-border" />
                </TableRow>
              </>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
