/**
 * ═══ ผลโทร — หน้าหลัก (เจ้าของ 7 ต.ค. 2569 · เลย์เอาต์ตามภาพอ้างอิง "Pipeline Stage Breakdown") ═══
 * ที่มา: *"ตัวเลขต้องได้ตามหัวข้อแบบที่บอททำ"* → *"ต้องรู้ทั้งคนและ Ai"* → *"มีผลการโทร … ไปไม่ไป"* (แตก 4 ช่อง) →
 * *"เนี่ยเอาออก แล้วไออันที่มีก็แค่เอาทั้งหมดกลับมา"* (ถอดรายการข้างโดนัท · คืนแถวรวม) → *"เอาแบบนี้"* (ภาพอ้างอิง)
 * - การ์ดผลโทร: กราฟแท่งทีละผล (สีตามความหมาย) + ตาราง AI โทร / คนโทร / รวม (ติดตาม) · ผู้สมัคร = แท่ง + งานเก่า
 * - `useHomeLumosSummary` = ตัวโหลดตัวเดียวของหน้า (การ์ดนี้ + กล่องเลือกผลใน 2×2 ใช้ชุดเดียวกัน ไม่โหลดซ้ำ)
 * - `FOLLOW_RESULT_COLS` / `APPLICANT_RESULT_COLS` = ชื่อ + สีของแต่ละผล ที่เดียวทั้งหน้า
 * บรรทัดบวกใต้ตาราง (ไม่ลงตัว = แดง) · นิยาม `src/lib/homeLumosSummary.ts`
 * 🔴 สีจาก TONE ชุดเดียวกับหน้าติดตาม · กราฟใช้ `currentColor` + คลาส TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TONE } from '@/lib/designTokens';
import { FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import type { AiShareBlockKey, AiShareWindow } from '@/lib/homeAiShare';
import { fetchHomeLumosSummary } from '@/lib/homeAiShareApi';
import {
  FOLLOW_BUCKET_KEYS,
  followBucketAddsUp,
  followBucketSum,
  lumosBucketAddsUp,
  sumFollowBuckets,
  type FollowBucket,
  type FollowBucketKey,
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

/** โดนัท + เลขกลางวง · ว่าง = วงเทาเต็มวง (ไม่หาย) · ใช้ที่การ์ดรวมทั้งช่วง */
export function Donut({ slices, total, unit, label }: { slices: ResultSlice[]; total: number | null; unit: string; label: string }) {
  const data = slices.filter((s) => s.value > 0);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-48" role="img" aria-label={label}>
      {total === null ? (
        <Skeleton className="h-full w-full rounded-full" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.length ? data : [{ key: 'empty', value: 1 }]}
                dataKey="value"
                nameKey="key"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={data.length > 1 ? 1.5 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {data.length ? (
                  data.map((s) => <Cell key={s.key} fill="currentColor" className={TONE[s.tone].value} />)
                ) : (
                  <Cell fill="currentColor" className="text-muted" />
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-light tabular-nums text-foreground">{NUM.format(total)}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        </>
      )}
    </div>
  );
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
    <Card variant="glass" className={cn('space-y-5 p-5 sm:p-6', className)} data-testid={`lumos-stats-${block}`}>
      <h2 className="text-base font-medium text-foreground">ผลโทร</h2>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {block === 'follow' ? (
        <FollowResults split={data?.follow ?? null} unit={unit} />
      ) : (
        <ApplicantResults b={data?.applicants ?? null} backlog={data?.backlog ?? null} unit={unit} />
      )}
    </Card>
  );
};

const followSumText = (b: FollowBucket) =>
  `${FOLLOW_BUCKET_KEYS.map((k) => NUM.format(b[k])).join(' + ')} = ${NUM.format(followBucketSum(b))}`;

/** ติดตาม — แท่งของรวม + ตาราง AI โทร / คนโทร / รวม */
function FollowResults({ split, unit }: { split: { ai: FollowBucket; staff: FollowBucket } | null; unit: string }) {
  const all = split ? sumFollowBuckets(split.ai, split.staff) : null;
  const slices: ResultSlice[] = FOLLOW_RESULT_COLS.map((c) => ({ key: c.key, label: c.label, tone: c.tone, value: all ? all[c.key] : 0 }));
  const rows: Array<[string, FollowBucket | null]> = [
    ['AI โทร', split?.ai ?? null],
    ['คนโทร', split?.staff ?? null],
    ['รวม', all],
  ];
  const ok = rows.every(([, b]) => !b || followBucketAddsUp(b));
  return (
    <div className="space-y-5">
      {all ? (
        <ResultBars slices={slices} label={`ผลโทร ${NUM.format(all.total)} ${unit}`} />
      ) : (
        <Skeleton className="h-64 w-full rounded-xl" />
      )}

      <div className="overflow-x-auto" data-testid="lumos-stats-follow-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs" />
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
            {rows.map(([label, b]) => (
              <TableRow key={label} data-testid={`lumos-follow-${label}`} className={cn(label === 'รวม' && 'font-medium')}>
                <TableCell className="whitespace-nowrap text-sm text-foreground">{label}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{b ? NUM.format(b.total) : '—'}</TableCell>
                {FOLLOW_RESULT_COLS.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn('text-right tabular-nums', b && b[c.key] > 0 ? 'text-foreground' : 'text-muted-foreground')}
                  >
                    {b ? NUM.format(b[c.key]) : '—'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {split ? (
        <p className={cn('text-xs tabular-nums', ok ? 'text-muted-foreground' : TONE.danger.value)} data-testid="lumos-follow-sum">
          AI {followSumText(split.ai)} · คน {followSumText(split.staff)}
          {ok ? '' : ' · ไม่ลงตัว'}
        </p>
      ) : null}
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
