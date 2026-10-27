import React, { useMemo, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { publicJobTitle } from '@/lib/publicJobTitle';
import { jobPositionUnits } from '@/lib/jobPositionUnits';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { jobBuOf, openJobBuCounts, openJobsByProvince } from '@/lib/openJobsByProvince';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { JobRequest } from '@/types';
import { OverviewCard } from './RecruitOverviewParts';

const SHOWN = 10;

/**
 * งานตามจังหวัด (เจ้าของ 27 ต.ค. 2569 "งานจังหวัดไหนเยอะ และเป็นลักษณะอะไร") — ตรรกะอยู่ `openJobsByProvince` ที่เดียว
 * `jobs` = ใบขอที่เปิดจากหน้าแม่ (ชุดเดียวกับกล่องงาน) · null = ยังโหลดไม่เสร็จ
 */
export default function ProvinceJobsCard({ jobs }: { jobs: readonly JobRequest[] | null }) {
  const [all, setAll] = useState(false);
  /** จังหวัดที่กางดูใบขออยู่ · null = ไม่ได้กาง */
  const [open, setOpen] = useState<string | null>(null);
  /** แยก BU (เจ้าของ 27 ต.ค. 2569 "แยก Bu ดูได้ไหม") — '' = ทุก BU */
  const [bu, setBu] = useState('');
  const buCounts = useMemo(() => (jobs ? openJobBuCounts(jobs) : []), [jobs]);
  const picked = useMemo(() => (jobs ? (bu ? jobs.filter((j) => jobBuOf(j) === bu) : jobs) : null), [jobs, bu]);
  const rows = useMemo(() => (picked ? openJobsByProvince(picked) : []), [picked]);
  const total = useMemo(
    () => rows.reduce((a, r) => ({ requests: a.requests + r.requests, positions: a.positions + r.positions }), { requests: 0, positions: 0 }),
    [rows],
  );
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <OverviewCard icon={MapPin} title="งานตามจังหวัด" sub="ใบขอที่ยังเปิด ณ วันนี้">
      {/* BU เป็นดรอปดาวน์ (เจ้าของ 27 ต.ค. 2569 "ทำเป็น Dropdown") */}
      {buCounts.length > 1 ? (
        <Select
          value={bu || 'all'}
          onValueChange={(v) => {
            setBu(v === 'all' ? '' : v);
            setAll(false);
          }}
        >
          <SelectTrigger className="h-9 w-48 text-sm tabular-nums" aria-label="BU" data-testid="province-jobs-bu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุก BU · {fmt(jobs?.length ?? 0)} ใบ</SelectItem>
            {buCounts.map((b) => (
              <SelectItem key={b.bu} value={b.bu}>
                {b.bu} · {fmt(b.requests)} ใบ
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <div className="overflow-x-auto" data-testid="province-jobs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">จังหวัด</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">ใบขอ</TableHead>
              <TableHead className="whitespace-nowrap text-right text-xs">อัตรา</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs === null ? (
              <TableRow>
                <TableCell colSpan={3} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  —
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  ไม่มีใบขอที่เปิด
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <React.Fragment key={r.province}>
                  {/* กดจังหวัด = กางดูใบขอ (เจ้าของ 27 ต.ค. 2569 "ถ้ากดจังหวัด กรุงเทพ ก็กางออกมาให้ดูว่ามีใบขออะไรบ้าง") */}
                  <TableRow
                    data-testid="province-jobs-row"
                    className="cursor-pointer"
                    aria-expanded={open === r.province}
                    onClick={() => setOpen(open === r.province ? null : r.province)}
                  >
                    <TableCell className="whitespace-nowrap text-sm text-foreground">
                      <span className="flex items-center gap-1.5">
                        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open !== r.province && '-rotate-90')} aria-hidden />
                        {r.province}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.requests)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(r.positions)}</TableCell>
                  </TableRow>
                  {open === r.province ? (
                    <TableRow className="hover:bg-transparent" data-testid="province-jobs-detail">
                      <TableCell colSpan={3} className="bg-muted/30 py-2">
                        <ul className="divide-y divide-border">
                          {r.jobs.map((j) => (
                            <li key={j.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                              <span className="min-w-0">
                                <span className="block text-foreground">{[j.unit_name?.trim(), publicJobTitle(j)].filter(Boolean).join(' · ')}</span>
                                <span className={cn('block text-xs tabular-nums', DASH.sub)}>{j.request_no ?? j.id}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-foreground">{fmt(jobPositionUnits(j))} อัตรา</span>
                            </li>
                          ))}
                        </ul>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </React.Fragment>
              ))
            )}
            {rows.length > 0 ? (
              <TableRow className="border-t-2 font-medium hover:bg-transparent" data-testid="province-jobs-sum">
                <TableCell className="text-sm text-foreground">รวม {fmt(rows.length)} จังหวัด</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(total.requests)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(total.positions)}</TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      {rows.length > SHOWN ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setAll((v) => !v)} data-testid="province-jobs-more">
          {all ? 'ซ่อน' : `ดูทั้งหมด ${fmt(rows.length)} จังหวัด`}
        </Button>
      ) : null}
    </OverviewCard>
  );
}
