import React, { useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
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
const TYPES_SHOWN = 3;

/**
 * งานตามจังหวัด (เจ้าของ 27 ต.ค. 2569 "งานจังหวัดไหนเยอะ และเป็นลักษณะอะไร") — ตรรกะอยู่ `openJobsByProvince` ที่เดียว
 * `jobs` = ใบขอที่เปิดจากหน้าแม่ (ชุดเดียวกับกล่องงาน) · null = ยังโหลดไม่เสร็จ
 */
export default function ProvinceJobsCard({ jobs }: { jobs: readonly JobRequest[] | null }) {
  const [all, setAll] = useState(false);
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
              <TableHead className="text-xs">ลักษณะงาน (อัตรา)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs === null ? (
              <TableRow>
                <TableCell colSpan={4} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  —
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className={cn('py-4 text-center text-sm', DASH.sub)}>
                  ไม่มีใบขอที่เปิด
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.province} data-testid="province-jobs-row">
                  <TableCell className="whitespace-nowrap text-sm text-foreground">{r.province}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(r.requests)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmt(r.positions)}</TableCell>
                  <TableCell className={cn('text-xs tabular-nums', DASH.sub)}>
                    {r.types
                      .slice(0, TYPES_SHOWN)
                      .map((t) => `${t.title} ${fmt(t.positions)}`)
                      .join(' · ')}
                    {r.types.length > TYPES_SHOWN ? ` · อื่น ๆ ${fmt(r.types.slice(TYPES_SHOWN).reduce((a, t) => a + t.positions, 0))}` : ''}
                  </TableCell>
                </TableRow>
              ))
            )}
            {rows.length > 0 ? (
              <TableRow className="border-t-2 font-medium hover:bg-transparent" data-testid="province-jobs-sum">
                <TableCell className="text-sm text-foreground">รวม {fmt(rows.length)} จังหวัด</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(total.requests)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(total.positions)}</TableCell>
                <TableCell />
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
