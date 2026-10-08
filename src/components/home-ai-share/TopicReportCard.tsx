/**
 * ═══ ผลโทรราย BU — งานสรรหา · จับคู่งาน · ดูแลหลังเริ่มงาน (หน้าหลัก · เจ้าของ 7 ต.ค. 2569) ═══
 * - `useTopicReport` = ตัวโหลดของหน้า (หน้าเรียกครั้งเดียว ส่งเข้าแท่ง/ขั้น/ตาราง) · อัปเดตสดเงียบ ๆ รอบเดียวกับหน้า
 * - การ์ดนี้ = ตาราง เทียบ AI / คน ก้อนละ BU (BU ไม่มีงานไม่ขึ้น · ในก้อนครบ 4 แถวแม้เป็น 0) · บรรทัดบวกทุก BU = ทั้งหมด
 *   เส้นทาง/ส่งต่อให้คน ย้ายไปอยู่ในการ์ดของหน้า (โฉมแบบ Codex 8 ต.ค. 2569)
 * นิยาม `src/lib/homeTopicReport.ts` · ข้อมูล `/api/home-ai-share?report=<ก้อน>` (ชุดแถวเดียวกับกล่องด้านบน)
 * 🔴 shadcn (Card · Table · Skeleton) · สีจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { segmentDotClass } from '@/components/home-ai-share/segmentStyle';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { TONE } from '@/lib/designTokens';
import type { AiShareWindow } from '@/lib/homeAiShare';
import { fetchTopicReport } from '@/lib/homeAiShareApi';
import { REPORT_SEGS, reportBuBlocks, type TopicReport, type TopicReportBlock, type TopicReportResponse } from '@/lib/homeTopicReport';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

export function useTopicReport(block: TopicReportBlock | null, win: AiShareWindow, tick: number) {
  const [data, setData] = useState<TopicReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef({ block, win });
  keyRef.current = { block, win };

  useEffect(() => {
    if (!block) return;
    let alive = true;
    setError(null);
    fetchTopicReport(block, win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดผลโทรไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      });
    return () => {
      alive = false;
    };
  }, [block, win]);

  // อัปเดตสดรอบเดียวกับหน้า — โหลดเงียบ เลขเดิมค้างจนเลขใหม่มา
  useEffect(() => {
    if (tick === 0) return;
    const { block: b, win: w } = keyRef.current;
    if (!b) return;
    let alive = true;
    fetchTopicReport(b, w)
      .then((d) => {
        const cur = keyRef.current;
        if (alive && d.block === cur.block && d.from === cur.win.from && d.to === cur.win.to) {
          setData(d);
          setError(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  const current = block && data && data.block === block && data.from === win.from && data.to === win.to ? data : null;
  return { report: current?.report ?? null, failed: error ?? current?.error ?? null };
}

const TopicReportCard: React.FC<{ report: TopicReport | null; failed: string | null; block: TopicReportBlock; unit: string }> = ({
  report,
  failed,
  block,
  unit,
}) => {
  const blocks = report ? reportBuBlocks(report) : [];
  const total = report?.funnel.find((f) => f.key === 'total')?.value ?? 0;
  const sumOfBlocks = blocks.reduce((n, b) => n + b.total, 0);
  const num = (n: number) => (
    <span className={cn('tabular-nums', n > 0 ? 'text-foreground' : 'text-muted-foreground')}>{NUM.format(n)}</span>
  );

  return (
    <Card variant="solid" className="space-y-6 p-6 sm:p-7" data-testid={`topic-report-${block}`}>
      <h2 className="text-lg font-medium text-foreground">ผลโทรราย BU</h2>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {!report ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          {/* 2. เทียบ AI / คน ก้อนละ BU */}
          {blocks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายชื่อ</p> : null}
          {blocks.map((b) => (
            <section
              key={b.bu ?? 'none'}
              className="space-y-4 rounded-2xl border border-foreground/10 p-4 sm:p-5"
              data-testid={`report-bu-${b.bu ?? 'none'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
                <h3 className="flex items-baseline gap-3 text-xl font-medium text-foreground" title={b.bu ? trendBuLabel(b.bu) : undefined}>
                  <span
                    className={cn('h-3 w-3 self-center rounded-full bg-current', TONE[b.bu ? toneOfBu(b.bu) : 'neutral'].value)}
                    aria-hidden
                  />
                  {b.bu ?? 'ไม่ระบุ BU'}
                  <span className="text-2xl tabular-nums">{NUM.format(b.total)}</span>
                  <span className="text-sm font-normal text-muted-foreground">{unit}</span>
                </h3>
                <p className="flex flex-wrap gap-2 text-sm tabular-nums">
                  {REPORT_SEGS.filter((s) => s.key !== 'notCalled').map((s) => (
                    <span key={s.key} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                      <span className={cn('h-2 w-2 rounded-full', segmentDotClass(s.key))} aria-hidden />
                      {s.label}
                      <span className="font-medium text-foreground">{NUM.format(b.bySeg[s.key].total)}</span>
                    </span>
                  ))}
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">ใครโทร</TableHead>
                      <TableHead className="whitespace-nowrap text-right text-xs">ทั้งหมด</TableHead>
                      {report.cols.map((c) => (
                        <TableHead key={c.key} className="whitespace-nowrap text-right text-xs">
                          <span className="inline-flex items-center gap-1.5">
                            <span className={cn('h-2 w-2 rounded-full', TONE[c.tone].dot)} aria-hidden />
                            {c.label}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {REPORT_SEGS.map((s) => (
                      <TableRow key={s.key} data-testid={`report-row-${b.bu ?? 'none'}-${s.key}`}>
                        <TableCell className="whitespace-nowrap text-sm text-foreground">{s.label}</TableCell>
                        <TableCell className="text-right font-medium">{num(b.bySeg[s.key].total)}</TableCell>
                        {report.cols.map((c) => (
                          <TableCell key={c.key} className="text-right">
                            {num(b.bySeg[s.key].cols[c.key] ?? 0)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow
                      data-testid={`report-row-${b.bu ?? 'none'}-total`}
                      className="border-0 bg-muted/60 font-medium hover:bg-muted/60"
                    >
                      <TableCell className="whitespace-nowrap text-sm text-foreground">รวม {b.bu ?? 'ไม่ระบุ BU'}</TableCell>
                      <TableCell className="text-right">{num(b.total)}</TableCell>
                      {report.cols.map((c) => (
                        <TableCell key={c.key} className="text-right">
                          {num(b.sum[c.key] ?? 0)}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </section>
          ))}
          <p
            className={cn('text-xs tabular-nums', sumOfBlocks === total ? 'text-muted-foreground' : TONE.danger.value)}
            data-testid="report-sum"
          >
            {blocks.map((b) => `${b.bu ?? 'ไม่ระบุ'} ${NUM.format(b.total)}`).join(' + ') || '0'} = {NUM.format(sumOfBlocks)} {unit}
            {sumOfBlocks === total ? '' : ` · ไม่ตรงกับ ${NUM.format(total)}`}
          </p>
        </>
      )}
    </Card>
  );
};

export default TopicReportCard;
