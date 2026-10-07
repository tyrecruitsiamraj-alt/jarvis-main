/**
 * ═══ ผลโทร — การ์ดของหน้าหลัก ตามหัวข้อใน Dropdown (เจ้าของ 7 ต.ค. 2569) ═══
 * ที่มา: *"ตัวเลขต้องได้ตามหัวข้อแบบที่บอททำ"* → *"แล้วคนอะ ต้องรู้ทั้งคนและ Ai"* → *"มีผลการโทร … ไปไม่ไป"* (แตก 4 ช่อง) →
 * *"งานติดตาม เปลี่ยนเป็น ผลโทร · Dashboard ระดับที่ผู้บริหารเปิดดูแล้วแบบว้าว กราฟสวย ตัวเลขถูก"*
 * - หัวข้อติดตาม: โดนัทของทั้งหมด + รายการช่องพร้อมเลขและ % (= ยอดรวม) · ตาราง AI โทร / คนโทร (ไม่มีแถวรวมซ้ำ)
 *   ช่อง: ไป · ไม่ไป · ขอเลื่อน · สรุปไม่ได้ (= มีผลการโทร) · รอดำเนินการ · ล้มเหลว · ยกเลิก · แถวรวม = กล่องทั้งหมด
 * - หัวข้อผู้สมัคร: งานที่ส่งให้ AI — มีผลแล้ว · ยังรอ · ล้มเหลว · ยกเลิก + งานเก่าที่ต้องติดตาม
 * - หัวข้ออื่น = ไม่มีการ์ดนี้
 * % ปัดรวมกันได้ 100 พอดี (`roundToHundred`) · บรรทัดบวกใต้ตาราง (ไม่ลงตัว = แดง) · นิยาม `src/lib/homeLumosSummary.ts`
 * 🔴 สีจาก TONE ชุดเดียวกับหน้าติดตาม (`FOLLOW_MATRIX_COL_TONE`) · กราฟใช้ `currentColor` + คลาส TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TONE } from '@/lib/designTokens';
import { FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import { roundToHundred, type AiShareBlockKey, type AiShareWindow } from '@/lib/homeAiShare';
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

type ToneKey = keyof typeof TONE;
type Slice = { key: string; label: string; tone: ToneKey; value: number };

/** คอลัมน์ของงานติดตาม — สีชุดเดียวกับหน้าติดตาม (ขอเลื่อน = ส้ม แยกจากสรุปไม่ได้ให้เห็นบนโดนัท) */
const FOLLOW_COLS: ReadonlyArray<{
  key: FollowBucketKey;
  label: string;
  tone: ToneKey;
}> = [
  { key: 'went', label: 'ไป', tone: FOLLOW_MATRIX_COL_TONE.went },
  { key: 'notWent', label: 'ไม่ไป', tone: FOLLOW_MATRIX_COL_TONE.notWent },
  { key: 'reschedule', label: 'ขอเลื่อน', tone: 'orange' },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: FOLLOW_MATRIX_COL_TONE.unclear },
  {
    key: 'waiting',
    label: 'รอดำเนินการ',
    tone: FOLLOW_MATRIX_COL_TONE.waiting,
  },
  { key: 'failed', label: 'ล้มเหลว', tone: FOLLOW_MATRIX_COL_TONE.noAnswer },
  { key: 'cancelled', label: 'ยกเลิก', tone: FOLLOW_MATRIX_COL_TONE.cancelled },
];
const DONE_KEYS: readonly FollowBucketKey[] = ['went', 'notWent', 'reschedule', 'unclear'];

const APPLICANT_COLS: ReadonlyArray<{
  key: Exclude<keyof LumosBucket, 'total'>;
  label: string;
  tone: ToneKey;
}> = [
  { key: 'done', label: 'มีผลแล้ว', tone: 'success' },
  { key: 'waiting', label: 'ยังรอ', tone: 'info' },
  { key: 'failed', label: 'ล้มเหลว', tone: 'warn' },
  { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral' },
];

/** โดนัท + เลขกลางวง · ว่าง = วงเทาเต็มวง (ไม่หาย) */
function Donut({ slices, total, unit, label }: { slices: Slice[]; total: number | null; unit: string; label: string }) {
  const data = slices.filter((s) => s.value > 0);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-56" role="img" aria-label={label}>
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
            <span className="text-3xl font-light tabular-nums text-foreground">{NUM.format(total)}</span>
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** รายการช่อง: จุดสี · ชื่อ · เลข · % (ปัดรวม 100) · กลุ่มมีหัวพร้อมยอดของกลุ่ม */
function Legend({ slices, groups }: { slices: Slice[]; groups?: Array<{ label: string; keys: readonly string[] }> }) {
  const pct = roundToHundred(slices.map((s) => s.value));
  const pctOf = new Map(slices.map((s, i) => [s.key, pct[i]]));
  const row = (s: Slice) => (
    <li key={s.key} className="flex items-center gap-3 text-sm" data-testid={`result-legend-${s.key}`}>
      <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', TONE[s.tone].dot)} aria-hidden />
      <span className="flex-1 text-foreground">{s.label}</span>
      <span className="text-base font-medium tabular-nums text-foreground">{NUM.format(s.value)}</span>
      <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{NUM.format(pctOf.get(s.key) ?? 0)}%</span>
    </li>
  );
  if (!groups) return <ul className="space-y-2.5">{slices.map(row)}</ul>;
  const grouped = new Set(groups.flatMap((g) => g.keys));
  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const inGroup = slices.filter((s) => g.keys.includes(s.key));
        const sum = inGroup.reduce((n, s) => n + s.value, 0);
        return (
          <div key={g.label} className="space-y-2.5">
            <p className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>{g.label}</span>
              <span className="tabular-nums">{NUM.format(sum)}</span>
            </p>
            <ul className="space-y-2.5">{inGroup.map(row)}</ul>
          </div>
        );
      })}
      <ul className="space-y-2.5 border-t border-foreground/10 pt-4">{slices.filter((s) => !grouped.has(s.key)).map(row)}</ul>
    </div>
  );
}

const AiShareLumosStats: React.FC<{
  block: AiShareBlockKey;
  win: AiShareWindow;
  tick: number;
  unit: string;
}> = ({ block, win, tick, unit }) => {
  const shown = block === 'follow' || block === 'applicants';
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

  // อัปเดตสดรอบเดียวกับหน้า — โหลดเงียบ เลขเดิมค้างจนเลขใหม่มา
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

  if (!shown) return null;
  const current = data && data.from === win.from && data.to === win.to ? data : null;
  const failed = error ?? current?.error ?? null;
  return (
    <Card variant="glass" className="space-y-5 p-5 sm:p-6" data-testid={`lumos-stats-${block}`}>
      <h2 className="text-base font-medium text-foreground">ผลโทร</h2>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      {block === 'follow' ? (
        <FollowResults split={current?.follow ?? null} unit={unit} />
      ) : (
        <ApplicantResults b={current?.applicants ?? null} backlog={current?.backlog ?? null} unit={unit} />
      )}
    </Card>
  );
};

const followSumText = (b: FollowBucket) =>
  `${FOLLOW_BUCKET_KEYS.map((k) => NUM.format(b[k])).join(' + ')} = ${NUM.format(followBucketSum(b))}`;

/** ติดตาม — โดนัทของรวม + รายการ · ตาราง AI โทร / คนโทร / รวม */
function FollowResults({ split, unit }: { split: { ai: FollowBucket; staff: FollowBucket } | null; unit: string }) {
  const all = split ? sumFollowBuckets(split.ai, split.staff) : null;
  const slices: Slice[] = FOLLOW_COLS.map((c) => ({
    key: c.key,
    label: c.label,
    tone: c.tone,
    value: all ? all[c.key] : 0,
  }));
  // ตารางเหลือ AI โทร / คนโทร — ยอดรวมอยู่ที่โดนัท + รายการแล้ว (เจ้าของ 7 ต.ค. 2569 "กล่อง ผลโทร มันซ้ำกันปะ")
  const rows: Array<[string, FollowBucket | null]> = [
    ['AI โทร', split?.ai ?? null],
    ['คนโทร', split?.staff ?? null],
  ];
  const ok = [...rows.map(([, b]) => b), all].every((b) => !b || followBucketAddsUp(b));
  return (
    <div className="space-y-6">
      <div className="grid items-center gap-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <Donut slices={slices} total={all ? all.total : null} unit={unit} label={`ผลโทร ${all ? NUM.format(all.total) : ''} ${unit}`} />
        </div>
        <div className="md:col-span-3">
          {all ? (
            <Legend slices={slices} groups={[{ label: 'มีผลการโทร', keys: DONE_KEYS }]} />
          ) : (
            <Skeleton className="h-56 w-full rounded-xl" />
          )}
        </div>
      </div>

      <div className="overflow-x-auto" data-testid="lumos-stats-follow-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs" />
              <TableHead className="whitespace-nowrap text-right text-xs">ทั้งหมด</TableHead>
              {FOLLOW_COLS.map((c) => (
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
              <TableRow key={label} data-testid={`lumos-follow-${label}`}>
                <TableCell className="whitespace-nowrap text-sm text-foreground">{label}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground">{b ? NUM.format(b.total) : '—'}</TableCell>
                {FOLLOW_COLS.map((c) => (
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

/** ผู้สมัคร — งานที่ส่งให้ AI · โดนัท + รายการ + งานเก่า */
function ApplicantResults({ b, backlog, unit }: { b: LumosBucket | null; backlog: number | null; unit: string }) {
  const slices: Slice[] = APPLICANT_COLS.map((c) => ({
    key: c.key,
    label: c.label,
    tone: c.tone,
    value: b ? b[c.key] : 0,
  }));
  return (
    <div className="space-y-6">
      <div className="grid items-center gap-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <Donut slices={slices} total={b ? b.total : null} unit={unit} label={`ผลโทร ${b ? NUM.format(b.total) : ''} ${unit}`} />
        </div>
        <div className="space-y-4 md:col-span-3">
          {b ? <Legend slices={slices} /> : <Skeleton className="h-40 w-full rounded-xl" />}
          <div className="flex items-center gap-3 border-t border-foreground/10 pt-4 text-sm" data-testid="lumos-applicants-backlog">
            <span className="flex-1 text-foreground">งานเก่าที่ต้องติดตาม</span>
            <span className="text-base font-medium tabular-nums text-foreground">{backlog === null ? '—' : NUM.format(backlog)}</span>
          </div>
        </div>
      </div>
      {b ? (
        <p
          className={cn('text-xs tabular-nums', lumosBucketAddsUp(b) ? 'text-muted-foreground' : TONE.danger.value)}
          data-testid="lumos-applicants-sum"
        >
          {APPLICANT_COLS.map((c) => NUM.format(b[c.key])).join(' + ')} = {NUM.format(b.done + b.waiting + b.failed + b.cancelled)}
          {lumosBucketAddsUp(b) ? '' : ` · ไม่ตรงกับ ${NUM.format(b.total)}`}
        </p>
      ) : null}
    </div>
  );
}

export default AiShareLumosStats;
