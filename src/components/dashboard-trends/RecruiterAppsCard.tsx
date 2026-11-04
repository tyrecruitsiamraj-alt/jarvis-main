import React, { useMemo, useState } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';
import { NO_REQUEST, appsByRecruiter } from '@/lib/recruitByRecruiter';
import { OverviewCard, SectionError } from './RecruitOverviewParts';

/**
 * ═══ รายชื่อที่กรอกมา แยกตามเจ้าหน้าที่สรรหา → ใบขอ (เจ้าของ 4 พ.ย. 2569) ═══
 * > *"เป็นงานใครเท่าไหร่ แล้วเป็นงานไหนบ้าง เช่น แบงค์ เข้ามา 50 คน แบ่งเป็น งาน ก 5 ข 5 ค 40"*
 * แถวคน กดชื่อกางเป็นรายใบขอ · กดเลขเปิดรายชื่อ · แถวรวมอยู่ล่าง · ตัวคิดอยู่ `recruitByRecruiter.ts`
 * 🔴 ไม่มีรายชื่อ = ตารางยังอยู่ (แถวรวม 0)
 */
export default function RecruiterAppsCard({
  apps,
  jobs,
  jobsError,
  onOpenNames,
}: {
  apps: readonly RecruitAppFact[];
  jobs: Readonly<Record<string, RecruitAppJob>> | null | undefined;
  jobsError?: string | null;
  onOpenNames: (title: string, ids: readonly string[]) => void;
}) {
  const rows = useMemo(() => appsByRecruiter(apps, jobs), [apps, jobs]);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (k: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  const total = apps.length;
  const pct = (n: number) => (total ? `${Math.round((n / total) * 100)}%` : '');
  const count = (n: number, title: string, ids: readonly string[]) =>
    n > 0 && ids.length > 0 ? (
      <Button type="button" variant="ghost" size="xs" className="-mr-2 h-7 px-2 tabular-nums" onClick={() => onOpenNames(title, ids)}>
        {fmt(n)}
      </Button>
    ) : (
      <span className={cn('px-2 tabular-nums', DASH.sub)}>{fmt(n)}</span>
    );

  return (
    <OverviewCard icon={Users} title="รายชื่อที่กรอกมา แยกตามเจ้าหน้าที่สรรหา">
      {jobsError ? <SectionError message={jobsError} /> : null}
      <div className="overflow-x-auto" data-testid="recruiter-apps">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">เจ้าหน้าที่สรรหา / ใบขอ</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">รายชื่อ</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <React.Fragment key={r.key}>
                <TableRow data-testid="recruiter-apps-person">
                  <TableCell className="text-sm font-medium">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="-ml-2 h-7 gap-1 whitespace-normal px-2 text-left font-medium"
                      aria-expanded={open.has(r.key)}
                      onClick={() => toggle(r.key)}
                    >
                      <ChevronDown className={cn('size-4 shrink-0 transition-transform', !open.has(r.key) && '-rotate-90')} aria-hidden />
                      {r.name}
                      {r.name === NO_REQUEST ? null : <span className={cn('font-normal', DASH.sub)}>· {fmt(r.jobs.length)} ใบ</span>}
                    </Button>
                  </TableCell>
                  <TableCell className="p-1 text-right font-medium">{count(r.count, r.name, r.ids)}</TableCell>
                  <TableCell className={cn('text-right text-xs tabular-nums', DASH.sub)}>{pct(r.count)}</TableCell>
                </TableRow>
                {open.has(r.key)
                  ? r.jobs.map((j) => (
                      <TableRow key={`${r.key}:${j.key}`} data-testid="recruiter-apps-job">
                        <TableCell className="pl-9 text-sm">{j.label}</TableCell>
                        <TableCell className="p-1 text-right">{count(j.count, `${r.name} · ${j.requestNo ?? j.label}`, j.ids)}</TableCell>
                        <TableCell className={cn('text-right text-xs tabular-nums', DASH.sub)}>{pct(j.count)}</TableCell>
                      </TableRow>
                    ))
                  : null}
              </React.Fragment>
            ))}
            <TableRow className="bg-muted/40 font-medium hover:bg-muted/40">
              <TableCell className="text-sm">รวม</TableCell>
              <TableCell className="p-1 text-right font-medium">
                {count(
                  total,
                  'รายชื่อที่กรอกมา',
                  apps.map((a) => a.id).filter((x): x is string => !!x),
                )}
              </TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </OverviewCard>
  );
}
