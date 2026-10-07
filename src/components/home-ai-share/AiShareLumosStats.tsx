/**
 * ═══ ผลโทร — หน้าหลัก (เจ้าของ 7 ต.ค. 2569 · เลย์เอาต์ตามภาพอ้างอิง "Pipeline Stage Breakdown") ═══
 * ที่มา: *"ตัวเลขต้องได้ตามหัวข้อแบบที่บอททำ"* → *"ต้องรู้ทั้งคนและ Ai"* → *"มีผลการโทร … ไปไม่ไป"* (แตก 4 ช่อง) →
 * *"เนี่ยเอาออก แล้วไออันที่มีก็แค่เอาทั้งหมดกลับมา"* (ถอดรายการข้างโดนัท · คืนแถวรวม) → *"เอาแบบนี้"* (ภาพอ้างอิง)
 * - การ์ดผลโทร (ติดตาม): ก้อนละ BU — เรื่อง × ใครโทร × ผล 7 ช่อง (เจ้าของ 7 ต.ค. ดึก "Bu เอาไปรวมตรงผลเลย") · ผู้สมัคร = แท่ง + งานเก่า
 * - `useHomeLumosSummary` = ตัวโหลดของหน้า (หน้าเรียกครั้งเดียว ส่งข้อมูลเข้าการ์ด)
 * - `FOLLOW_RESULT_COLS` / `APPLICANT_RESULT_COLS` = ชื่อ + สีของแต่ละผล ที่เดียวทั้งหน้า
 * บรรทัดบวกใต้ตาราง (ไม่ลงตัว = แดง) · นิยาม `src/lib/homeLumosSummary.ts`
 * 🔴 สีจาก TONE ชุดเดียวกับหน้าติดตาม · กราฟใช้ `currentColor` + คลาส TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { segmentDotClass } from '@/components/home-ai-share/segmentStyle';
import { trendBuLabel } from '@/lib/trends/bu';
import { TONE } from '@/lib/designTokens';
import { FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import type { AiShareBlockKey, AiShareWindow } from '@/lib/homeAiShare';
import { fetchHomeLumosSummary } from '@/lib/homeAiShareApi';
import {
  followBucketAddsUp,
  followBuBlocks,
  lumosBucketAddsUp,
  type FollowBucket,
  type FollowBucketKey,
  type FollowBuCell,
  type FollowTeamKey,
  type HomeLumosSummaryResponse,
  type LumosBucket,
} from '@/lib/homeLumosSummary';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

export type ToneKey = keyof typeof TONE;
export type ResultSlice = { key: string; label: string; tone: ToneKey; value: number };

/** ผลของติดตาม — ชื่อ/สีชุดเดียวกับหน้าติดตาม (ขอเลื่อน = ส้ม แยกจากสรุปไม่ได้) */
export const FOLLOW_RESULT_COLS: ReadonlyArray<{ key: FollowBucketKey; label: string; tone: ToneKey }> = [
  { key: 'went', label: 'ไป', tone: FOLLOW_MATRIX_COL_TONE.went },
  { key: 'notWent', label: 'ไม่ไป', tone: FOLLOW_MATRIX_COL_TONE.notWent },
  { key: 'reschedule', label: 'ขอเลื่อน', tone: 'orange' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: FOLLOW_MATRIX_COL_TONE.unclear },
  { key: 'waiting', label: 'รอดำเนินการ', tone: FOLLOW_MATRIX_COL_TONE.waiting },
  { key: 'failed', label: 'ล้มเหลว', tone: FOLLOW_MATRIX_COL_TONE.noAnswer },
  { key: 'cancelled', label: 'ยกเลิก', tone: FOLLOW_MATRIX_COL_TONE.cancelled },
];

/** ผลของงานรับสมัคร (งานที่ส่งให้ AI) */
export const APPLICANT_RESULT_COLS: ReadonlyArray<{ key: Exclude<keyof LumosBucket, 'total'>; label: string; tone: ToneKey }> = [
  { key: 'done', label: 'มีผลแล้ว', tone: 'success' },
  { key: 'waiting', label: 'ยังรอ', tone: 'info' },
  { key: 'failed', label: 'ล้มเหลว', tone: 'warn' },
  { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral' },
];

export const hasLumosResults = (block: AiShareBlockKey) => block === 'follow' || block === 'applicants';

/** ตัวโหลดตัวเดียวของหน้า — ช่วงตามแท่งที่กด · อัปเดตสดเงียบ ๆ รอบเดียวกับหน้า */
export function useHomeLumosSummary(block: AiShareBlockKey, win: AiShareWindow, tick: number) {
  const shown = hasLumosResults(block);
  const [data, setData] = useState<HomeLumosSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const winRef = useRef(win);
  winRef.current = win;

  useEffect(() => {
    if (!shown) return;
    let alive = true;
    setError(null);
    fetchHomeLumosSummary(win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      });
    return () => {
      alive = false;
    };
  }, [win, shown]);

  useEffect(() => {
    if (tick === 0 || !shown) return;
    let alive = true;
    fetchHomeLumosSummary(winRef.current)
      .then((d) => {
        if (alive && d.from === winRef.current.from && d.to === winRef.current.to) {
          setData(d);
          setError(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick, shown]);

  const current = data && data.from === win.from && data.to === win.to ? data : null;
  return { current, failed: error ?? current?.error ?? null };
}

/** กราฟแท่งทีละผล — แท่งมนสีตามความหมาย · เลขบนหัวแท่ง · ชื่อผลใต้แท่ง (แบบ "Pipeline Stage Breakdown") */
function ResultBars({ slices, label }: { slices: ResultSlice[]; label: string }) {
  return (
    <div className="h-64 w-full text-muted-foreground" role="img" aria-label={label} data-testid="result-bars">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={slices} margin={{ top: 24, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tick={{ fill: 'currentColor', fontSize: 12 }} />
          <YAxis hide />
          <Bar dataKey="value" radius={[12, 12, 12, 12]} maxBarSize={56} isAnimationActive={false} minPointSize={4}>
            {slices.map((s) => (
              <Cell key={s.key} fill="currentColor" className={TONE[s.tone].value} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              className="fill-foreground"
              formatter={(v: number) => NUM.format(v)}
              style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const AiShareLumosStats: React.FC<{
  block: AiShareBlockKey;
  unit: string;
  data: HomeLumosSummaryResponse | null;
  failed: string | null;
  className?: string;
}> = ({ block, unit, data, failed, className }) => {
  if (!hasLumosResults(block)) return null;
  return (
    <Card variant="solid" className={cn('space-y-6 p-6 sm:p-7', className)} data-testid={`lumos-stats-${block}`}>
      <h2 className="text-xl font-medium text-foreground">ผลโทร</h2>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {block === 'follow' ? (
        <FollowResults split={data?.follow ?? null} cells={data?.followByBu ?? null} unit={unit} />
      ) : (
        <ApplicantResults b={data?.applicants ?? null} backlog={data?.backlog ?? null} unit={unit} />
      )}
    </Card>
  );
};

const TEAM_LABEL: Record<FollowTeamKey, string> = { main: 'ติดตามคนเริ่มงาน', replacement: 'ติดตามส่งคนแทน' };
const CALLER_LABEL = { ai: 'AI โทร', manual: 'คนโทร' } as const;

/**
 * ติดตาม — ก้อนละ BU (เจ้าของ "Bu เอาไปรวมตรงผลเลย") · หัวก้อน = BU · ทั้งหมด · AI โทร · คนโทร
 * ตาราง = เรื่อง × ใครโทร (เฉพาะที่มีรายชื่อ) × ผล 7 ช่อง · แถวรวมของ BU · BU ไม่มีงานไม่ขึ้น
 * บรรทัดล่าง = ทุก BU บวกกัน = กล่องทั้งหมดด้านบน
 */
function FollowResults({
  split,
  cells,
  unit,
}: {
  split: { ai: FollowBucket; staff: FollowBucket } | null;
  cells: FollowBuCell[] | null;
  unit: string;
}) {
  if (!split || !cells) return <Skeleton className="h-48 w-full rounded-xl" />;
  const blocks = followBuBlocks(cells);
  const all = split.ai.total + split.staff.total;
  const sumOfBlocks = blocks.reduce((n, b) => n + b.sum.total, 0);
  const ok = sumOfBlocks === all && followBucketAddsUp(split.ai) && followBucketAddsUp(split.staff);
  const num = (n: number) => (
    <span className={cn('tabular-nums', n > 0 ? 'text-foreground' : 'text-muted-foreground')}>{NUM.format(n)}</span>
  );
  return (
    <div className="space-y-6">
      {blocks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายชื่อ</p> : null}
      {blocks.map((b) => (
        <section
          key={b.bu ?? 'none'}
          className="space-y-4 rounded-2xl border border-foreground/10 p-4 sm:p-5"
          data-testid={`bu-block-${b.bu ?? 'none'}`}
        >
          {/* หัวก้อน BU — ชื่อ · ยอด · ชิป AI โทร / คนโทร (แบบรายการในภาพอ้างอิง) */}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
            <h3 className="flex items-baseline gap-3 text-xl font-medium text-foreground" title={b.bu ? trendBuLabel(b.bu) : undefined}>
              <span
                className={cn('h-3 w-3 self-center rounded-full bg-current', TONE[b.bu ? toneOfBu(b.bu) : 'neutral'].value)}
                aria-hidden
              />
              {b.bu ?? 'ไม่ระบุ BU'}
              <span className="text-2xl tabular-nums">{NUM.format(b.sum.total)}</span>
              <span className="text-sm font-normal text-muted-foreground">{unit}</span>
            </h3>
            <p className="flex flex-wrap gap-2 text-sm tabular-nums">
              {(
                [
                  ['ai', 'AI โทร', b.sum.ai],
                  ['staff', 'คนโทร', b.sum.staff],
                ] as const
              ).map(([k, label, n]) => (
                <span key={k} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', segmentDotClass(k))} aria-hidden />
                  {label}
                  <span className="font-medium text-foreground">{NUM.format(n)}</span>
                </span>
              ))}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">เรื่อง</TableHead>
                  <TableHead className="text-xs">ใครโทร</TableHead>
                  <TableHead className="whitespace-nowrap text-right text-xs">ทั้งหมด</TableHead>
                  {FOLLOW_RESULT_COLS.map((c) => (
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
                {b.rows.map((r, i) => (
                  <TableRow key={`${r.team}:${r.caller}`} data-testid={`bu-row-${b.bu ?? 'none'}-${r.team}-${r.caller}`}>
                    <TableCell className="whitespace-nowrap text-sm text-foreground">
                      {i === 0 || b.rows[i - 1].team !== r.team ? TEAM_LABEL[r.team] : ''}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-foreground">{CALLER_LABEL[r.caller]}</TableCell>
                    <TableCell className="text-right font-medium">{num(r.total)}</TableCell>
                    {FOLLOW_RESULT_COLS.map((c) => (
                      <TableCell key={c.key} className="text-right">
                        {num(r.buckets[c.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow data-testid={`bu-row-${b.bu ?? 'none'}-total`} className="border-0 bg-muted/60 font-medium hover:bg-muted/60">
                  <TableCell className="whitespace-nowrap text-sm text-foreground" colSpan={2}>
                    รวม {b.bu ?? 'ไม่ระบุ BU'}
                  </TableCell>
                  <TableCell className="text-right">{num(b.sum.total)}</TableCell>
                  {FOLLOW_RESULT_COLS.map((c) => (
                    <TableCell key={c.key} className="text-right">
                      {num(b.sum.buckets[c.key])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </section>
      ))}
      <p className={cn('text-xs tabular-nums', ok ? 'text-muted-foreground' : TONE.danger.value)} data-testid="lumos-follow-sum">
        {blocks.map((b) => `${b.bu ?? 'ไม่ระบุ'} ${NUM.format(b.sum.total)}`).join(' + ')} = {NUM.format(sumOfBlocks)} {unit}
        {ok ? '' : ` · ไม่ตรงกับ ${NUM.format(all)}`}
      </p>
    </div>
  );
}

/** ผู้สมัคร — งานที่ส่งให้ AI · แท่ง + งานเก่า */
function ApplicantResults({ b, backlog, unit }: { b: LumosBucket | null; backlog: number | null; unit: string }) {
  const slices: ResultSlice[] = APPLICANT_RESULT_COLS.map((c) => ({ key: c.key, label: c.label, tone: c.tone, value: b ? b[c.key] : 0 }));
  return (
    <div className="space-y-5">
      {b ? <ResultBars slices={slices} label={`ผลโทร ${NUM.format(b.total)} ${unit}`} /> : <Skeleton className="h-64 w-full rounded-xl" />}
      <div className="flex items-center gap-3 border-t border-foreground/10 pt-4 text-sm" data-testid="lumos-applicants-backlog">
        <span className="flex-1 text-foreground">งานเก่าที่ต้องติดตาม</span>
        <span className="text-base font-medium tabular-nums text-foreground">{backlog === null ? '—' : NUM.format(backlog)}</span>
      </div>
      {b ? (
        <p
          className={cn('text-xs tabular-nums', lumosBucketAddsUp(b) ? 'text-muted-foreground' : TONE.danger.value)}
          data-testid="lumos-applicants-sum"
        >
          {APPLICANT_RESULT_COLS.map((c) => NUM.format(b[c.key])).join(' + ')} = {NUM.format(b.done + b.waiting + b.failed + b.cancelled)}
          {lumosBucketAddsUp(b) ? '' : ` · ไม่ตรงกับ ${NUM.format(b.total)}`}
        </p>
      ) : null}
    </div>
  );
}

export default AiShareLumosStats;
