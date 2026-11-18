/**
 * สถานะทำงาน แบบหน้า Dashboard (ภาพรวมงานสรรหา · เจ้าของ 18 พ.ย. 2569 "ยกมาแบบหน้า dashboard ตรงเนี้ย")
 * ตัวนับเดียวกับ Dashboard (`workStatusBoardOf`) · ช่วง = วันที่ต้องการคน ตามวันที่ที่เลือกบนหน้า ("เลือกของเมื่อวานก็เป็นเมื่อวาน")
 * ไม่มีบรรทัดอธิบายใต้เลข (เจ้าของ "ไม่ต้องมีคำอธิบายถูกแล้ว") · กดกล่อง = ใบขอของสถานะนั้นข้างล่าง กดแถว = เปิดใบขอ
 */
import React from 'react';
import DashboardKpiCard from '@/components/dashboard/analytics/DashboardKpiCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { jobToWorkItem, workStatusBoardOf } from '@/lib/dashboard/buildDashboardData';
import { resolveUnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';
import { pageOf } from '@/lib/recruitAudience';
import type { JobRequest } from '@/types';
import { Pager, SectionTitle, fmt } from './V2Parts';

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayText = (ymd: string) => (ymd ? `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]} ${String(Number(ymd.slice(0, 4)) + 543).slice(2)}` : '—');

export default function WorkStatusBoard({
  jobs,
  range,
  error,
  onOpenRequest,
  resetKey,
}: {
  /** ใบขอจากเส้นเดียวกับ Dashboard (กรอง BU/ตัวกรองบนสุดแล้ว) · null = ยังโหลด */
  jobs: readonly JobRequest[] | null;
  /** null = ทั้งหมด */
  range: { from: string; to: string } | null;
  error: string | null;
  onOpenRequest: (jobId: string) => void;
  resetKey: string;
}) {
  const [sel, setSel] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  React.useEffect(() => {
    setSel(null);
    setPage(1);
  }, [resetKey]);
  const board = React.useMemo(() => (jobs ? workStatusBoardOf(jobs, range) : null), [jobs, range]);
  const total = board?.kpis.find((k) => k.id === 'work_status_total')?.value ?? 0;
  const picked = React.useMemo(() => {
    if (!board || !sel) return null;
    const status = sel.replace('work_status_', '');
    const list = sel === 'work_status_total' ? board.jobs : board.jobs.filter((j) => resolveUnitRequestWorkStatus(j.work_status) === status);
    return list.map((j) => jobToWorkItem(j)).sort((a, b) => (a.requiredDate || '9').localeCompare(b.requiredDate || '9'));
  }, [board, sel]);
  const pg = picked ? pageOf(picked, page) : null;
  const label = board?.kpis.find((k) => k.id === sel)?.label;

  return (
    <section className="min-w-0 space-y-3" data-testid="v2-work-status">
      <SectionTitle title="สถานะทำงาน" right="นับอัตรา" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {board ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {board.kpis.map((k) => (
            <DashboardKpiCard
              key={k.id}
              kpi={{ ...k, description: '' }}
              surface="tile"
              selected={sel === k.id}
              progressPercent={total ? (k.value / total) * 100 : 0}
              onClick={() => {
                setSel((cur) => (cur === k.id ? null : k.id));
                setPage(1);
              }}
            />
          ))}
        </div>
      ) : error ? null : (
        <Skeleton className="h-40 rounded-xl" />
      )}
      {picked && pg ? (
        <div className="space-y-2 rounded-xl border p-3" data-testid="v2-work-status-list">
          <p className="text-sm font-medium">
            {label} · {fmt(picked.length)} ใบ · {fmt(picked.reduce((n, w) => n + w.remainingPositions, 0))} อัตรา
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ใบขอ</TableHead>
                {sel === 'work_status_total' ? <TableHead>สถานะ</TableHead> : null}
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-right">อัตรา</TableHead>
                <TableHead>คนสรรหา</TableHead>
                <TableHead>ต้องการคน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((w) => (
                <TableRow key={w.id} className="cursor-pointer" onClick={() => onOpenRequest(w.id)}>
                  <TableCell className="tabular-nums">{w.requestNo}</TableCell>
                  {sel === 'work_status_total' ? <TableCell>{w.workStatus === 'in_progress' ? 'กำลังดำเนินการสรรหา' : w.workStatusLabel}</TableCell> : null}
                  <TableCell className="max-w-72 break-words">{w.unitName}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(w.remainingPositions)}</TableCell>
                  <TableCell>{w.ownerName}</TableCell>
                  <TableCell className={cn('tabular-nums', DASH.sub)}>{dayText(w.requiredDate)}</TableCell>
                </TableRow>
              ))}
              {pg.slice.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className={DASH.muted}>
                    ไม่มีใบขอ
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <Pager {...pg} onPage={setPage} />
        </div>
      ) : null}
    </section>
  );
}
