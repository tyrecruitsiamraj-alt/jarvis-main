import React from 'react';
import { Copy, ImageDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import DayCalendarPicker from '@/components/shared/DayCalendarPicker';
import { cn } from '@/lib/utils';
import { TONE } from '@/lib/designTokens';
import { formatYmdDmyBe } from '@/lib/dateTh';
import type { FollowEntry } from '@/lib/followApi';
import {
  buildFollowDayReport,
  followDayReportTsv,
  FOLLOW_DAY_REPORT_HEADERS,
  FOLLOW_DAY_REPORT_NO_FILTER,
  type FollowDayReportFilter,
} from '@/lib/followDayReport';
import { downloadFollowDayReportPng, followDayReportSummaryText } from '@/lib/followDayReportImage';

/**
 * ═══ สรุปแผนติดตามทั้งวัน (เจ้าของสั่ง 2 ต.ค. 2569 · Choice "หน้าสรุปบนจอ") ═══
 * ตัวเลขบรรทัดเดียว + ตารางทุกสายของวันนั้น · ปุ่มคัดลอก = วางลง Excel/LINE ได้ · ว่าง = แถว "ไม่มี…" (ตารางไม่หาย)
 *
 * 🔴 เลือกก่อนโหลดได้ (เจ้าของสั่ง 3 ต.ค. 2569: *"ทำให้เลือกวัน เลือกสายได้ เลือกว่าจะดู
 * แค่คนหรือ AI หรือหมดเลย ก่อนโหลดรูป"*) — วัน · สายที่ · ใครโทร · ตาราง/ตัวเลข/รูป
 * มาจากชุดที่กรองแล้วชุดเดียวกันเสมอ และรูป+ชื่อไฟล์บอกขอบเขตที่กรอง
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
  const [selYmd, setSelYmd] = React.useState(ymd);
  const [caller, setCaller] = React.useState<FollowDayReportFilter['caller']>('all');
  const [call, setCall] = React.useState<string>('all');
  const [copied, setCopied] = React.useState<'ok' | 'fail' | null>(null);
  const [saved, setSaved] = React.useState<'ok' | 'fail' | null>(null);
  React.useEffect(() => {
    // เปิดใหม่ = เริ่มที่วันที่หน้าดูอยู่ + ไม่กรอง (ค่าที่ค้างจากรอบก่อนทำให้ตัวเลขดูผิดวัน)
    setSelYmd(ymd);
    setCaller('all');
    setCall('all');
    setCopied(null);
    setSaved(null);
  }, [open, ymd]);

  const filter = React.useMemo<FollowDayReportFilter>(
    () => ({ caller, call: call === 'all' ? 'all' : Number(call) }),
    [caller, call],
  );
  const report = React.useMemo(
    () => (open && selYmd ? buildFollowDayReport(entries, selYmd, new Date(), filter) : null),
    [open, entries, selYmd, filter],
  );

  const copy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(followDayReportTsv(report));
      setCopied('ok');
    } catch {
      setCopied('fail');
    }
  };

  /* "สรุปแผนทั้งวันอะ ทำให้โหลดเป็นรูปได้หน่อย" (เจ้าของสั่ง 3 ต.ค. 2569) — PNG พื้นขาว ส่งต่อใน LINE ได้ */
  const savePng = async () => {
    if (!report) return;
    setSaved((await downloadFollowDayReportPng(report)) ? 'ok' : 'fail');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto !bg-background">
        <DialogHeader className="text-left">
          <DialogTitle>แผนติดตามวันที่ {selYmd ? formatYmdDmyBe(selYmd) : '—'}</DialogTitle>
          <DialogDescription className="tabular-nums text-foreground">
            {report ? followDayReportSummaryText(report) : ''}
          </DialogDescription>
        </DialogHeader>

        {/* เลือกวัน · สายที่ · ใครโทร — มีผลทั้งตาราง ตัวเลข ปุ่มคัดลอก และรูปที่โหลด */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="day-report-filters">
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">วัน</span>
            <DayCalendarPicker
              value={selYmd}
              onChange={(v) => {
                if (!v) return;
                setSelYmd(v);
                // เลขสายของแต่ละวันไม่เท่ากัน — เปลี่ยนวันแล้วล้างตัวกรองสาย กันค้างเลขที่วันใหม่ไม่มี
                setCall('all');
              }}
              emptyLabel="เลือกวัน"
            />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">สายที่</span>
            <ChoiceDropdown
              value={call}
              options={[
                { value: 'all', label: 'ทุกสาย' },
                ...(report?.callNos ?? []).map((n) => ({ value: String(n), label: `สายที่ ${n}` })),
              ]}
              onChange={setCall}
              ariaLabel="ดูเฉพาะสายที่"
              active={call !== 'all'}
            />
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">ใครโทร</span>
            <ChoiceDropdown<FollowDayReportFilter['caller']>
              value={caller}
              options={[
                { value: 'all', label: 'ทั้งหมด' },
                { value: 'ai', label: 'AI โทร' },
                { value: 'manual', label: 'คนโทร' },
              ]}
              onChange={setCaller}
              ariaLabel="ดูเฉพาะใครโทร"
              active={caller !== 'all'}
            />
          </span>
        </div>

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
          {saved === 'ok' ? <span className={cn('text-xs', TONE.success.value)}>บันทึกรูปแล้ว ดูในโฟลเดอร์ดาวน์โหลด</span> : null}
          {saved === 'fail' ? <span className={cn('text-xs', TONE.danger.value)}>บันทึกรูปไม่ได้ ใช้ปุ่มคัดลอกตารางแทน</span> : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void savePng()} disabled={!report || report.rows.length === 0}>
            <ImageDown aria-hidden /> บันทึกเป็นรูป
          </Button>
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
