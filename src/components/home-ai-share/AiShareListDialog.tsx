/**
 * ═══ Popup รายชื่อหลังเลขในกล่อง (รอบ 17 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"Visual พอกดแล้วเด้ง Popup แสดงรายชื่อมา"*
 * - กดกล่องไหน = รายชื่อของก้อนนั้น ช่วง/BU เดียวกับตัวเลขบนหน้า · กล่อง "ทั้งหมด" = ทุกก้อน + คอลัมน์ว่าอยู่ก้อนไหน
 * - ชื่อ · BU · วันที่ (วันถึงคิวโทร / วันสมัคร / วันส่งเข้าคิวแรก ตามหัวข้อ) · ใหม่สุดก่อน · หน้าละ 20
 * - ไม่มีเบอร์ (ดูต่อที่หน้าต้นทาง) · สิทธิ์เท่าหน้าต้นทาง — เส้นตอบ 403 = บอกเหตุบนจอ
 * - หน้าเป็นคนเปิด และให้ `key` ใหม่ทุกครั้งที่เปิด ⇒ เปิดรอบใหม่เริ่มหน้าแรกเสมอ ไม่ค้างชื่อชุดเก่า
 * 🔴 Dialog ของ shadcn · เปิดจากหน้า ไม่ซ้อนใน Dialog/Sheet อื่น · คำบนจอแบบคนพูด ไม่มีประโยคอธิบาย
 */
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { segmentDotClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { toYmdBangkok } from '@/lib/dateTh';
import {
  AI_SHARE_LIST_PAGE,
  AI_SHARE_SEGMENT_LABEL,
  type AiShareBlockKey,
  type AiShareListKey,
  type AiShareListResponse,
  type AiShareWindow,
} from '@/lib/homeAiShare';
import { fetchHomeAiShareList } from '@/lib/homeAiShareApi';
import { periodLabel, thaiDate } from '@/lib/periodPick';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

/** ชื่อกล่องบนหัว Popup — ชุดเดียวกับป้ายของกล่อง */
const listKeyLabel = (k: AiShareListKey) => (k === 'total' ? 'ทั้งหมด' : AI_SHARE_SEGMENT_LABEL[k]);

const AiShareListDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  block: AiShareBlockKey;
  /** ชื่อหัวข้อ เช่น "ติดตาม" */
  blockTitle: string;
  listKey: AiShareListKey;
  unit: string;
  win: AiShareWindow;
  /** เลขในกล่องที่กด — ขึ้นบนหัวระหว่างรอรายชื่อ */
  count: number | null;
}> = ({ open, onOpenChange, block, blockTitle, listKey, unit, win, count }) => {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AiShareListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchHomeAiShareList(block, listKey, page, win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดรายชื่อไม่ขึ้น ลองอีกครั้ง');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, block, listKey, page, win]);

  // ใช้เฉพาะคำตอบของหน้าที่ขออยู่ — กดหน้าถัดไปแล้วชื่อหน้าเก่าไม่ค้างให้อ่านผิดหน้า
  const current = data && data.block === block && data.segment === listKey && data.page === page ? data : null;
  const rows = current?.rows ?? null;
  const failed = error ?? current?.error ?? null;
  const total = current && !current.error ? current.total : (count ?? 0);
  const pages = Math.max(1, Math.ceil(total / AI_SHARE_LIST_PAGE));
  const label = listKeyLabel(listKey);
  const showSegment = listKey === 'total';
  const first = page * AI_SHARE_LIST_PAGE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[85vh] max-w-2xl flex-col overflow-hidden', EVEN_TYPE)}>
        <DialogHeader className="pr-6">
          <DialogTitle className="space-y-1">
            <span className="block text-sm font-normal text-muted-foreground">
              {blockTitle} · {periodLabel(win, toYmdBangkok(new Date()))}
            </span>
            <span className="block text-xl font-light">
              {label} <span className="tabular-nums">{NUM.format(total)}</span>{' '}
              <span className="text-base text-muted-foreground">{unit}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            รายชื่อ{label}ของ{blockTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && !rows ? (
            <div className="space-y-2" aria-label="กำลังโหลดรายชื่อ">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-lg" />
              ))}
            </div>
          ) : failed && !rows ? (
            <p className={cn('py-6 text-center text-sm', TONE.danger.value)}>{failed}</p>
          ) : rows && rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายชื่อ</p>
          ) : rows ? (
            <Table className={cn(loading && 'opacity-60')}>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ชื่อ</TableHead>
                  <TableHead className="text-xs">BU</TableHead>
                  <TableHead className="text-xs">วันที่</TableHead>
                  {showSegment ? <TableHead className="text-xs">สถานะ</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className={cn('text-sm', r.name ? 'text-foreground' : 'text-muted-foreground')}>
                      {r.name ?? 'ไม่มีชื่อ'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {/* รหัสสั้นพอให้แถวไม่แตก · ชื่อเต็มของ BU ขึ้นตอนจี้ (แบบเดียวกับตาราง "ใครอยู่ในระบบ") */}
                      <span
                        className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground"
                        title={r.bu ? trendBuLabel(r.bu) : undefined}
                      >
                        <span
                          className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[r.bu ? toneOfBu(r.bu) : 'neutral'].value)}
                          aria-hidden
                        />
                        {r.bu || 'ไม่ระบุ'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-foreground">
                      {r.day ? thaiDate(r.day) : '—'}
                    </TableCell>
                    {showSegment ? (
                      <TableCell className="whitespace-nowrap text-xs">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          <span className={cn('inline-block h-2 w-2 rounded-full', segmentDotClass(r.segment))} aria-hidden />
                          {AI_SHARE_SEGMENT_LABEL[r.segment]}
                        </span>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </div>

        {rows && rows.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              แสดง {NUM.format(first + 1)}–{NUM.format(first + rows.length)} จาก {NUM.format(total)} {unit}
            </p>
            {pages > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <Button type="button" size="xs" variant="outline" disabled={page === 0 || loading} onClick={() => setPage(page - 1)}>
                      ก่อนหน้า
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-xs tabular-nums text-muted-foreground">
                      หน้า {NUM.format(page + 1)} / {NUM.format(pages)}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      disabled={page >= pages - 1 || loading}
                      onClick={() => setPage(page + 1)}
                    >
                      ถัดไป
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default AiShareListDialog;
