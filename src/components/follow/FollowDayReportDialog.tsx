import React from 'react';
import { ChevronLeft, ChevronRight, Copy, ImageDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
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
import {
  DAY_REPORT_PAGE_SIZES,
  downloadFollowDayReportPng,
  followDayReportRangeText,
  followDayReportSummaryText,
  paginateDayReportRows,
  type DayReportPageSize,
} from '@/lib/followDayReportImage';
import { FOLLOW_MATRIX_ROW_LABEL } from '@/lib/followCallMatrix';
import { followDayNoText } from '@/lib/followDayNo';

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
  /** ช่วงวัน — เลือกบนปฏิทินอย่างเดียว (เจ้าของ Choice 5 ต.ค. 2569) · วันเดียว = เริ่ม/จบวันเดียวกัน */
  const [range, setRange] = React.useState<DateRangeYmd>({ from: ymd, to: ymd });
  const selYmd = range.from;
  const [caller, setCaller] = React.useState<FollowDayReportFilter['caller']>('all');
  const [call, setCall] = React.useState<string>('all');
  /** วันที่ของแผน = ครั้งที่ติดตาม (เจ้าของ Choice 5 ต.ค. 2569) */
  const [planDay, setPlanDay] = React.useState<string>('all');
  const [copied, setCopied] = React.useState<'ok' | 'fail' | null>(null);
  const [saved, setSaved] = React.useState<'ok' | 'fail' | null>(null);
  const [savedCount, setSavedCount] = React.useState(0);
  React.useEffect(() => {
    // เปิดใหม่ = เริ่มที่วันที่หน้าดูอยู่ + ไม่กรอง (ค่าที่ค้างจากรอบก่อนทำให้ตัวเลขดูผิดวัน)
    setRange({ from: ymd, to: ymd });
    setCaller('all');
    setCall('all');
    setPlanDay('all');
    setCopied(null);
    setSaved(null);
  }, [open, ymd]);

  const filter = React.useMemo<FollowDayReportFilter>(
    () => ({ caller, call: call === 'all' ? 'all' : Number(call), planDay: planDay === 'all' ? 'all' : Number(planDay) }),
    [caller, call, planDay],
  );
  const report = React.useMemo(
    () => (open && selYmd ? buildFollowDayReport(entries, range, new Date(), filter) : null),
    [open, entries, selYmd, range, filter],
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
    const n = await downloadFollowDayReportPng(report, pageSize);
    setSavedCount(n);
    setSaved(n > 0 ? 'ok' : 'fail');
  };
  /**
   * 🔴 ตารางบนจอแบ่งหน้า (เจ้าของสั่ง 5 ต.ค. 2569: *"ทำเป็น Pagination ตอนนี้มันยาวไป เอาหน้าละ 10-20"*)
   * ใช้ตัวแบ่งเดียวกับรูป (หน้าละราว 20 · ชื่อเดียวกันไม่ขาดข้ามหน้า) ⇒ หน้า N บนจอ = รูปที่ N ที่โหลด
   * คัดลอกตาราง/บันทึกรูป ยังได้ทุกแถวเหมือนเดิม
   */
  /** หน้าละกี่แถว 10–50 (เจ้าของสั่ง 5 ต.ค. 2569) — ค่าเริ่ม 20 · รูปที่โหลดใช้ค่าเดียวกัน */
  const [pageSize, setPageSize] = React.useState<DayReportPageSize>(20);
  const pages = React.useMemo(() => (report ? paginateDayReportRows(report.rows, pageSize) : [[]]), [report, pageSize]);
  const imagePages = report && report.rows.length > 0 ? pages.length : 0;
  const [page, setPage] = React.useState(0);
  // เปลี่ยนวัน/สาย/ใครโทร/หน้าละกี่แถว = กลับหน้าแรก (หน้าเดิมอาจไม่มีในชุดใหม่)
  React.useEffect(() => setPage(0), [open, range, caller, call, planDay, pageSize]);
  const pageIdx = Math.min(page, pages.length - 1);
  const pageRows = pages[pageIdx] ?? [];
  const rowFrom = pages.slice(0, pageIdx).reduce((n, p) => n + p.length, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto !bg-background">
        <DialogHeader className="text-left">
          <DialogTitle>แผนติดตามวันที่ {report ? followDayReportRangeText(report) : selYmd ? formatYmdDmyBe(selYmd) : '—'}</DialogTitle>
          <DialogDescription className="tabular-nums text-foreground">
            {report ? followDayReportSummaryText(report) : ''}
          </DialogDescription>
        </DialogHeader>

        {/* เลือกวัน · สายที่ · ใครโทร — มีผลทั้งตาราง ตัวเลข ปุ่มคัดลอก และรูปที่โหลด */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="day-report-filters">
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">วัน</span>
            <DateRangeCalendarPicker
              value={range}
              onChange={(v) => {
                if (!v?.from) return;
                setRange({ from: v.from, to: v.to || v.from });
                // เลขสาย/วันที่ของแผนแต่ละช่วงไม่เท่ากัน — เปลี่ยนช่วงแล้วล้างตัวกรอง กันค้างเลขที่ช่วงใหม่ไม่มี
                setCall('all');
                setPlanDay('all');
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
                ...(report?.callNos ?? []).map((n) => ({ value: String(n), label: FOLLOW_MATRIX_ROW_LABEL[n as 1 | 2 | 3] ?? `สายที่ ${n}` })),
              ]}
              onChange={setCall}
              ariaLabel="ดูเฉพาะสายที่"
              active={call !== 'all'}
            />
          </span>
          <span className="flex items-center gap-1.5">
            {/* "ติดตามครั้งที่" แทน "วันที่ของแผน" (เจ้าของ 9 ต.ค. 2569) */}
            <span className="text-xs text-muted-foreground">ติดตามครั้งที่</span>
            <ChoiceDropdown
              value={planDay}
              options={[
                { value: 'all', label: 'ทุกครั้ง' },
                ...(report?.planDays ?? []).map((n) => ({ value: String(n), label: followDayNoText(n) })),
              ]}
              onChange={setPlanDay}
              ariaLabel="ดูเฉพาะติดตามครั้งที่"
              active={planDay !== 'all'}
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
              {pageRows.length > 0 ? (
                pageRows.map((r) => (
                  <TableRow key={r.id} className={cn(r.cancelled && 'text-muted-foreground')}>
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

        {/* ตัวเปลี่ยนหน้า — อยู่เสมอ (1 หน้าก็โชว์ 1 / 1 · ว่างแล้วห้ามหาย) */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" data-testid="day-report-pager">
          <span className="tabular-nums">
            {report && report.rows.length > 0
              ? `แถว ${NUM.format(rowFrom + 1)}–${NUM.format(rowFrom + pageRows.length)} จาก ${NUM.format(report.rows.length)}`
              : 'แถว 0 จาก 0'}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">หน้าละ</span>
            <ChoiceDropdown<string>
              value={String(pageSize)}
              options={DAY_REPORT_PAGE_SIZES.map((n) => ({ value: String(n), label: `${n} แถว` }))}
              onChange={(v) => setPageSize(Number(v) as DayReportPageSize)}
              ariaLabel="หน้าละกี่แถว"
            />
            <Button
              type="button"
              size="iconXs"
              variant="outline"
              aria-label="หน้าก่อน"
              disabled={pageIdx === 0}
              onClick={() => setPage(pageIdx - 1)}
            >
              <ChevronLeft aria-hidden />
            </Button>
            {/* เลือกหน้าได้เลย (เจ้าของ 6 ต.ค. 2569 "เอาเป็น Dropdown") — รูป "1/13" ชุดเดียวกับตารางรายวัน */}
            <ChoiceDropdown<string>
              value={String(pageIdx)}
              options={pages.map((_, i) => ({ value: String(i), label: `${i + 1}/${pages.length}` }))}
              onChange={(v) => setPage(Number(v))}
              ariaLabel="เลือกหน้า"
            />
            <Button
              type="button"
              size="iconXs"
              variant="outline"
              aria-label="หน้าถัดไป"
              disabled={pageIdx >= pages.length - 1}
              onClick={() => setPage(pageIdx + 1)}
            >
              <ChevronRight aria-hidden />
            </Button>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {copied === 'ok' ? <span className={cn('text-xs', TONE.success.value)}>คัดลอกแล้ว วางลง Excel ได้เลย</span> : null}
          {copied === 'fail' ? <span className={cn('text-xs', TONE.danger.value)}>คัดลอกไม่ได้ ลากคลุมตารางแล้วคัดลอกเอง</span> : null}
          {saved === 'ok' ? (
            <span className={cn('text-xs', TONE.success.value)}>
              บันทึกรูปแล้ว{savedCount > 1 ? ` ${savedCount} รูป` : ''} ดูในโฟลเดอร์ดาวน์โหลด
            </span>
          ) : null}
          {saved === 'fail' ? <span className={cn('text-xs', TONE.danger.value)}>บันทึกรูปไม่ได้ ใช้ปุ่มคัดลอกตารางแทน</span> : null}
          <Button type="button" size="sm" variant="outline" onClick={() => void savePng()} disabled={!report || report.rows.length === 0}>
            <ImageDown aria-hidden /> บันทึกเป็นรูป{imagePages > 1 ? ` (${imagePages} หน้า)` : ''}
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
