/**
 * ═══ ผลโทร — งานสรรหา · จับคู่งาน · ดูแลหลังเริ่มงาน (หน้าหลัก · เจ้าของ 7 ต.ค. 2569) ═══
 * Choice "เอาตามนี้ครบ 3 ส่วน" · "ทำพร้อมกันทั้ง 3" — หน้าตาชุดเดียวกับผลโทรของติดตาม
 * 1. เส้นทางซ้ายไปขวา (เลขใหญ่ · % ของรายชื่อทั้งหมด · ใต้เลขแยก AI/คน ของขั้นนั้น รวมกัน = เลขใหญ่)
 * 2. เทียบ AI / คน ก้อนละ BU (BU ไม่มีงานไม่ขึ้น · ในก้อนครบ 4 แถวแม้เป็น 0) · บรรทัดบวกทุก BU = ทั้งหมด
 * 3. ส่งต่อให้คน (+ จับคู่งาน: ต้องสั่งงาน)
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
import { REPORT_SEGS, reportBuBlocks, type TopicReportBlock, type TopicReportResponse } from '@/lib/homeTopicReport';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

const TopicReportCard: React.FC<{ block: TopicReportBlock; win: AiShareWindow; tick: number; unit: string }> = ({
  block,
  win,
  tick,
  unit,
}) => {
  const [data, setData] = useState<TopicReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef({ block, win });
  keyRef.current = { block, win };

  useEffect(() => {
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
    let alive = true;
    const { block: b, win: w } = keyRef.current;
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

  const current = data && data.block === block && data.from === win.from && data.to === win.to ? data : null;
  const report = current?.report ?? null;
  const failed = error ?? current?.error ?? null;
  const blocks = report ? reportBuBlocks(report) : [];
  const total = report?.funnel.find((f) => f.key === 'total')?.value ?? 0;
  const sumOfBlocks = blocks.reduce((n, b) => n + b.total, 0);
  const num = (n: number) => (
    <span className={cn('tabular-nums', n > 0 ? 'text-foreground' : 'text-muted-foreground')}>{NUM.format(n)}</span>
  );

  return (
    <Card variant="solid" className="space-y-6 p-6 sm:p-7" data-testid={`topic-report-${block}`}>
      <h2 className="text-xl font-medium text-foreground">ผลโทร</h2>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {!report ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : (
        <>
          {/* 1. เส้นทาง อ่านซ้ายไปขวา บนลงล่าง — % เทียบรายชื่อทั้งหมด (ขั้นก่อนรายชื่อไม่มี %) · คอลัมน์ลงตัวกับจำนวนขั้น ไม่มีกล่องค้างเดี่ยว */}
          <ol
            className={cn('grid grid-cols-1 gap-3', report.funnel.length % 4 === 0 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}
            data-testid="report-funnel"
          >
            {report.funnel.map((f, i) => {
              const afterTotal = report.funnel.findIndex((x) => x.key === 'total') < i;
              return (
                <li key={f.key} className="flex min-w-0 flex-col gap-1 rounded-xl bg-muted px-4 py-3" data-testid={`report-step-${f.key}`}>
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-2xl font-medium tabular-nums text-foreground">{NUM.format(f.value)}</span>
                    {afterTotal ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {total > 0 ? `${NUM.format(Math.round((f.value / total) * 100))}%` : '0%'}
                      </span>
                    ) : null}
                  </span>
                  {f.parts?.length ? (
                    <ul className="space-y-0.5 border-t border-foreground/10 pt-1.5">
                      {f.parts.map((p) => (
                        <li
                          key={p.key}
                          className="flex items-center justify-between gap-3 text-xs"
                          data-testid={`report-part-${f.key}-${p.key}`}
                        >
                          <span className="flex items-center gap-1.5 whitespace-nowrap text-muted-foreground">
                            <span
                              className={cn('h-2 w-2 rounded-full', p.seg ? segmentDotClass(p.seg) : TONE[p.tone ?? 'neutral'].dot)}
                              aria-hidden
                            />
                            {p.label}
                          </span>
                          <span className="font-medium tabular-nums text-foreground">{NUM.format(p.value)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>

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

          {/* 3. ส่งต่อให้คน (+ ต้องสั่งงาน) */}
          <div className={cn('grid gap-4', report.extra.length > 1 ? 'md:grid-cols-2' : '')}>
            {report.extra.map((x) => (
              <section key={x.title} className="space-y-2 rounded-2xl bg-muted/50 p-4 sm:p-5" data-testid={`report-extra-${x.title}`}>
                <h3 className="text-base font-medium text-foreground">{x.title}</h3>
                <ul className="divide-y divide-foreground/10">
                  {x.items.map((it) => (
                    <li key={it.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="flex items-center gap-2 text-foreground">
                        {it.tone ? <span className={cn('h-2.5 w-2.5 rounded-full', TONE[it.tone].dot)} aria-hidden /> : null}
                        {it.label}
                      </span>
                      <span className="text-base font-medium tabular-nums text-foreground">{NUM.format(it.value)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

export default TopicReportCard;
