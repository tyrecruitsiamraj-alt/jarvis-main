/**
 * สถานะทำงาน หน้าตาแบบหน้า Dashboard (ภาพรวมงานสรรหา · เจ้าของ 18 พ.ย. 2569 "ยกมาแบบหน้า dashboard ตรงเนี้ย")
 * ใบชุดเดียวกับการ์ด "เหลือหา" ของช่วงที่เลือก (เจ้าของ 19 พ.ย. 2569 "ถ้าเอาตามช่วง 2 อันก็ต้องเท่ากัน แล้วใส่สีให้รู้ด้วยว่าอันไหนเรื่องเดียวกัน")
 * ⇒ "ทั้งหมด" = การ์ดเหลือหาเสมอ · 19 พ.ย. 2569 รวมเข้าก้อนใบขอ กล่องทั้งหมดไม่ขึ้นแล้ว (ซ้ำกับการ์ดเหลือหา) · ตัวนับ `workStatusOfRemaining`
 * ไม่มีบรรทัดอธิบายใต้เลข · กดกล่อง = ใบขอของสถานะนั้นข้างล่าง กดแถว = เปิดใบขอ
 */
import React from 'react';
import DashboardKpiCard from '@/components/dashboard/analytics/DashboardKpiCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { pageOf } from '@/lib/recruitAudience';
import type { StuckRequest } from '@/lib/recruitStuck';
import { STATUS_TOTAL_ID, workStatusOfRemaining } from '@/lib/workStatusOfRemaining';
import type { JobRequest } from '@/types';
import { Pager, SectionTitle, fmt } from './V2Parts';

const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayText = (ymd: string | null | undefined) =>
  ymd ? `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]} ${String(Number(ymd.slice(0, 4)) + 543).slice(2)}` : '—';

export default function WorkStatusBoard({
  remaining,
  jobs,
  error,
  onOpenRequest,
  resetKey,
}: {
  /** ใบชุดเดียวกับการ์ดเหลือหา (`eq.remaining`) · null = ยังโหลด */
  remaining: readonly StuckRequest[] | null;
  /** ใบขอจากเส้นเดียวกับ Dashboard — อ่านสถานะทำงาน + วันที่ต้องการคน · null = ยังโหลด */
  jobs: readonly JobRequest[] | null;
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
  const boxes = React.useMemo(() => (remaining && jobs ? workStatusOfRemaining(remaining, jobs) : null), [remaining, jobs]);
  const jobOf = React.useMemo(() => new Map((jobs ?? []).map((j) => [j.id, j])), [jobs]);
  const total = boxes?.[0]?.positions ?? 0;
  const picked = boxes?.find((b) => b.id === sel) ?? null;
  const sorted = React.useMemo(
    () => (picked ? [...picked.rows].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo)) : null),
    [picked],
  );
  const pg = sorted ? pageOf(sorted, page) : null;

  return (
    <section className="min-w-0 space-y-3" data-testid="v2-work-status">
      <SectionTitle title="เหลือหา แยกตามสถานะทำงาน" right="นับอัตรา" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {boxes ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {/* กล่อง "ทั้งหมด" ไม่ขึ้น — เท่ากับการ์ดเหลือหาข้างบนเสมอ (เจ้าของ 19 พ.ย. 2569) · ยังใช้เป็นฐานของแถบเปอร์เซ็นต์ */}
          {boxes.filter((b) => b.id !== STATUS_TOTAL_ID).map((b) => (
            <DashboardKpiCard
              key={b.id}
              kpi={{ id: b.id, label: b.label, value: b.positions, secondaryCount: b.requests, secondaryLabel: 'ใบขอ', description: '', trendPercent: null }}
              surface="tile"
              selected={sel === b.id}
              progressPercent={total ? (b.positions / total) * 100 : 0}
              onClick={() => {
                setSel((cur) => (cur === b.id ? null : b.id));
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
            {picked.label} · {fmt(picked.requests)} ใบ · {fmt(picked.positions)} อัตรา
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ใบขอ</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className="text-right">อัตรา</TableHead>
                <TableHead>คนสรรหา</TableHead>
                <TableHead>ต้องการคน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((r) => (
                <TableRow key={`${r.jobId ?? ''}:${r.requestNo}`} className={r.jobId ? 'cursor-pointer' : undefined} onClick={() => r.jobId && onOpenRequest(r.jobId)}>
                  <TableCell className="tabular-nums">{r.requestNo}</TableCell>
                  <TableCell className="max-w-72 break-words">{r.unitName || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.remaining)}</TableCell>
                  <TableCell>{r.recruiter?.trim() || '—'}</TableCell>
                  <TableCell className={cn('tabular-nums', DASH.sub)}>{dayText(r.jobId ? jobOf.get(r.jobId)?.required_date : null)}</TableCell>
                </TableRow>
              ))}
              {pg.slice.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={DASH.muted}>
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
