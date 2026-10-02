import React from 'react';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { FollowEntry } from '@/lib/followApi';
import { buildFollowDayReport, followDayReportTsv, FOLLOW_DAY_REPORT_HEADERS } from '@/lib/followDayReport';

/**
 * ═══ สรุปแผนติดตามทั้งวัน (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ") ═══
 * ตัวเลขบรรทัดเดียว + ตารางทุกสายของวันนั้น · ปุ่มคัดลอก = วางลง Excel/LINE ได้ · ว่าง = แถว "ไม่มี…" (ตารางไม่หาย)
 */
const NUM = new Intl.NumberFormat('th-TH');

export default function FollowDayReportDialog({
  open,
  onClose,
  ymd,
  entries,
}: {
  open: boolean;
  onClose: () => void;
  ymd: string;
  entries: FollowEntry[];
}) {
  const report = React.useMemo(() => (open ? buildFollowDayReport(entries, ymd) : null), [open, entries, ymd]);
  const [copied, setCopied] = React.useState<'ok' | 'fail' | null>(null);
  React.useEffect(() => setCopied(null), [open, ymd]);

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(followDayReportTsv(report));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto !bg-background">
        <DialogHeader className="text-left">
          <DialogTitle>แผนติดตามวันที่ {formatYmdDmyBe(ymd)}</DialogTitle>
          <DialogDescription className="tabular-nums text-foreground">
            {report
              ? `${NUM.format(report.people)} คน · ${NUM.format(report.calls)} สาย · AI โทร ${NUM.format(report.ai)} · คนโทร ${NUM.format(report.manual)} · ยกเลิก ${NUM.format(report.cancelled)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto rounded-xl border border-border" data-testid="follow-day-report">
          <Table>
            <TableHeader>
              <TableRow>
                {FOLLOW_DAY_REPORT_HEADERS.map((h) => (
                  <TableHead key={h} className="whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {report && report.rows.length > 0 ? (
                report.rows.map((r) => (
                  <TableRow key={r.id} className={cn(r.cancelled && 'text-muted-foreground line-through')}>
                    <TableCell className="whitespace-nowrap tabular-nums">{r.time}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.name}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{r.phone}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.call}</TableCell>
                    <TableCell className={cn('whitespace-nowrap', r.caller === 'คนโทร' && !r.cancelled && TONE.warn.value)}>{r.caller}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.result}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={FOLLOW_DAY_REPORT_HEADERS.length} className="text-center text-muted-foreground">
                    ไม่มีแผนติดตาม
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {copied === 'ok' ? <span className={cn('text-xs', TONE.success.value)}>คัดลอกแล้ว วางลง Excel ได้เลย</span> : null}
          {copied === 'fail' ? <span className={cn('text-xs', TONE.danger.value)}>คัดลอกไม่ได้ ลากคลุมตารางแล้วคัดลอกเอง</span> : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()} disabled={!report || report.rows.length === 0}>
            <Copy aria-hidden /> คัดลอกตาราง
          </Button>
          <Button type="button" size="sm" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
