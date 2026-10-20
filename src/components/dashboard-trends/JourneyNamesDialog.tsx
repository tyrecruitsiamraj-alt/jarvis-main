/**
 * รายชื่อของเลขที่กดในเส้นทางงานสรรหา (QA 18 ต.ค. 2569 — "เลขที่กดดูชื่อไม่ได้ พิสูจน์ไม่ได้ว่าจริง")
 * ภาพรวมส่งมาแค่ id ใบ (ไม่มีชื่อ/เบอร์) ⇒ ป๊อปดึงรายชื่อจากเส้นรายชื่อผู้สมัครที่ผู้ใช้มีสิทธิ์อยู่แล้ว แล้วกรองด้วย id
 * shadcn Dialog · ไม่ซ้อนป๊อป · ล้มแล้วมีปุ่มลองใหม่
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import { fetchAllJobApplications, type PublicApplication } from '@/lib/publicApplicationsApi';
import { applicationUnitLabel } from '@/lib/recruitRm';
import { localThaiPhone } from '@/lib/followDayReport';
import { formatYmdTh, toYmdBangkok } from '@/lib/dateTh';
import { friendlyErrorText } from '@/lib/friendlyError';

const NUM = new Intl.NumberFormat('th-TH');

export default function JourneyNamesDialog({
  open,
  onOpenChange,
  title,
  ids,
  notes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  ids: readonly string[];
  /** คอลัมน์ "ค้างที่" ต่อราย (หน้าความคุ้มค่า · ค้างอยู่ที่ใคร) */
  notes?: ReadonlyMap<string, string>;
}) {
  const cols = notes ? 5 : 4;
  const [all, setAll] = useState<PublicApplication[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!open || all) return;
    let alive = true;
    setError(null);
    fetchAllJobApplications()
      .then((rows) => alive && setAll(rows))
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดรายชื่อไม่สำเร็จ')));
    return () => {
      alive = false;
    };
  }, [open, all, rev]);

  const rows = useMemo(() => {
    if (!all) return [];
    const want = new Set(ids);
    return all.filter((a) => want.has(a.id)).sort((x, y) => (y.created_at ?? '').localeCompare(x.created_at ?? ''));
  }, [all, ids]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {title} · {NUM.format(ids.length)} คน
          </DialogTitle>
          <DialogDescription className="sr-only">รายชื่อของช่องที่กดในเส้นทางของรายชื่อ</DialogDescription>
        </DialogHeader>
        {error ? (
          <LoadErrorNotice message={error} onRetry={() => setRev((n) => n + 1)} />
        ) : !all ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อ</TableHead>
                  <TableHead>เบอร์</TableHead>
                  <TableHead>หน่วยงาน</TableHead>
                  {notes ? <TableHead>ค้างที่</TableHead> : null}
                  <TableHead className="text-right">วันที่กรอก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={cols} className="text-center text-muted-foreground">
                      ไม่มีรายชื่อ
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="min-w-32 font-medium">{a.full_name || '—'}</TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">{a.phone ? localThaiPhone(a.phone) : '—'}</TableCell>
                      <TableCell className="max-w-56 truncate">{applicationUnitLabel(a) || '—'}</TableCell>
                      {notes ? <TableCell className="min-w-32">{notes.get(a.id) ?? '—'}</TableCell> : null}
                      <TableCell className="whitespace-nowrap text-right tabular-nums">
                        {a.created_at ? formatYmdTh(toYmdBangkok(new Date(a.created_at))) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            {rows.length < ids.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                เปิดชื่อไม่ได้ {NUM.format(ids.length - rows.length)} คน
              </p>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
