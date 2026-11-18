/**
 * รายชื่อเข้ามาไปถึงไหน + แยกช่องทาง (ภาพรวมงานสรรหา · เจ้าของ 18 พ.ย. 2569)
 * 5 กล่อง: ขั้นที่ไปต่อ + ขั้นที่หลุด (ป้าย "หลุด") · กดแถว = รายชื่อ (แผงข้าง)
 * แยกช่องทาง: ช่องทางหลัก → ช่องทางรอง → (Facebook Group: กลุ่ม) → คนหามา · กดแถว = กาง/หุบ + 5 กล่องเหลือเฉพาะแถวนั้น
 * นิยามทั้งหมดอยู่ `recruitIntakeFlow.ts`
 */
import React from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { INTAKE_COLUMNS, buildIntakeFlow, intakeChildren, intakeCounts, isIntakeLeaf, onIntakePath } from '@/lib/recruitIntakeFlow';
import { fmt } from './V2Parts';

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const PAD = ['pl-2', 'pl-7', 'pl-12', 'pl-16'];

export default function IntakeFlowPanel({
  cohort,
  onNames,
  resetKey,
}: {
  cohort: readonly RecruitAppFact[];
  onNames: (title: string, ids: readonly string[]) => void;
  resetKey: string;
}) {
  const [path, setPath] = React.useState<string[]>([]);
  React.useEffect(() => setPath([]), [resetKey]);
  const scoped = React.useMemo(() => (path.length ? cohort.filter((f) => onIntakePath(f, path)) : cohort), [cohort, path]);
  const boxes = React.useMemo(() => buildIntakeFlow(scoped), [scoped]);
  const where = path.length ? ` · ${path.join(' › ')}` : '';

  /** กดแถวเดิมที่เลือกอยู่ = หุบขึ้นหนึ่งชั้น */
  const pick = (p: string[]) => setPath((cur) => (same(cur, p) ? p.slice(0, -1) : p));
  const rows = (p: string[]): React.ReactNode[] =>
    intakeChildren(cohort, p).flatMap(({ label, list }) => {
      const np = [...p, label];
      const leaf = isIntakeLeaf(np);
      const open = !leaf && path.length >= np.length && same(path.slice(0, np.length), np);
      const on = same(path, np);
      const counts = intakeCounts(list);
      return [
        <TableRow
          key={np.join('|')}
          className={cn('cursor-pointer', np.length > 1 && 'bg-muted/30', on && 'ring-2 ring-inset ring-primary')}
          onClick={() => pick(np)}
          data-testid={`v2-intake-row-${np.length}`}
        >
          <TableCell className={cn(PAD[np.length - 1], np.length === 1 && 'font-medium')}>
            <span className="inline-flex items-center gap-1">
              {leaf ? null : open ? <ChevronDown className="h-4 w-4 shrink-0" aria-hidden /> : <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="break-words">{label}</span>
            </span>
          </TableCell>
          {counts.map((n, i) => (
            <TableCell key={INTAKE_COLUMNS[i]} className={cn('text-right tabular-nums', np.length === 1 && 'font-medium')}>
              {fmt(n)}
            </TableCell>
          ))}
        </TableRow>,
        ...(open ? rows(np) : []),
      ];
    });

  return (
    <div className="space-y-4" data-testid="v2-intake">
      {/* ปุ่มบอกว่ากดลงมาถึงไหน — จองที่ไว้ ของข้างล่างไม่ขยับ */}
      <div className="flex min-h-9 flex-wrap items-center gap-2">
        {path.length ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setPath([])} data-testid="v2-intake-clear">
            {path.join(' › ')}
            <X aria-hidden />
          </Button>
        ) : (
          <span className={cn('text-sm', DASH.sub)}>ทุกช่องทาง</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {boxes.map((b) => (
          <div key={b.key} className="min-w-0 space-y-2 rounded-xl border border-border bg-muted/30 p-4" data-testid={`v2-intake-box-${b.key}`}>
            <button type="button" className="flex w-full items-baseline justify-between gap-2 text-left" onClick={() => onNames(`${b.title}${where}`, b.ids)}>
              <span className="font-medium">{b.title}</span>
              <span className="text-2xl font-medium tabular-nums">{fmt(b.ids.length)}</span>
            </button>
            <ul className="space-y-2">
              {b.rows.map((r) => {
                const pct = b.ids.length ? Math.round((r.ids.length / b.ids.length) * 100) : 0;
                return (
                  <li key={r.key}>
                    <button type="button" className="w-full space-y-1 rounded-lg px-2 py-1 text-left hover:bg-muted/70" onClick={() => onNames(`${b.title} · ${r.label}${where}`, r.ids)}>
                      <span className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex flex-wrap items-center gap-1">
                          {r.label}
                          {r.drop && r.ids.length ? (
                            <Badge variant="outline" className={cn('px-2 py-0 font-normal', TONE.danger.value)}>
                              หลุด
                            </Badge>
                          ) : null}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {fmt(r.ids.length)} <span className={cn('text-xs', DASH.sub)}>{pct}%</span>
                        </span>
                      </span>
                      <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
                        <span className={cn('block h-full rounded-full', r.drop ? TONE.neutral.dot : TONE.primary.dot)} style={{ width: `${pct}%` }} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <section className="min-w-0 space-y-2" data-testid="v2-intake-channels">
        <h3 className="text-sm font-medium">แยกช่องทาง</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ช่องทาง</TableHead>
              {INTAKE_COLUMNS.map((c) => (
                <TableHead key={c} className="text-right">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows([])}
            <TableRow>
              <TableCell className="font-medium">รวม</TableCell>
              {intakeCounts(cohort).map((n, i) => (
                <TableCell key={INTAKE_COLUMNS[i]} className="text-right font-medium tabular-nums">
                  {fmt(n)}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
