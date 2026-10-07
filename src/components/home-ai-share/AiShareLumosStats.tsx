/**
 * ═══ เลขตามหัวข้อบอท Lumos ในการ์ดเดิมของหน้าหลัก (เจ้าของ 7 ต.ค. 2569) ═══
 * เจ้าของ: *"ฉันไม่ได้ต้องการให้เป็นแบบบอท แต่ฉันหมายถึงตัวเลขต้องได้ตามหัวข้อแบบที่บอททำ"* → Choice "ในการ์ดเดิมตาม Dropdown"
 * - หัวข้อติดตาม = งานติดตาม: ตาราง AI โทร / คนโทร / รวม × งานที่ต้องติดตาม · มีผลการโทร · รอดำเนินการ · ล้มเหลว · ยกเลิก
 *   (เจ้าของ *"แล้วคนอะ บอกแล้วไงต้องรู้ทั้งคนและ Ai"*) · แถวรวม = กล่อง "ทั้งหมด" ของการ์ด
 *   มีผลการโทร แตกเป็น ไป · ไม่ไป · ขอเลื่อน · สรุปไม่ได้ (เจ้าของ "แตกเลย") · สีตามตารางผลโทร (`FOLLOW_MATRIX_COL_TONE`)
 * - หัวข้อผู้สมัคร = งานรับสมัคร: ใบสมัคร · มีผลแล้ว · ยังรอ · ล้มเหลว · ยกเลิก + งานเก่าที่ต้องติดตาม
 * - หัวข้ออื่น (บอทไม่มี) = ไม่มีแถวนี้
 * งานรับสมัครนับงานที่ส่งให้ AI (คิว Lumos ของเรา) · ช่วงเดียวกับปฏิทิน · บรรทัดบวกให้เห็น (ไม่ลงตัว = แดง) · นิยาม `src/lib/homeLumosSummary.ts`
 * 🔴 หน้าตาของหน้าหลักเดิม (ไม่ทำหน้าตาแบบบอท) · สีเลขจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useRef, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TONE } from '@/lib/designTokens';
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
import { FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');

type Tone = keyof typeof TONE | null;
type Cell = { key: keyof LumosBucket | 'backlog'; label: string; tone: Tone };

const APPLICANTS: Cell[] = [
  { key: 'total', label: 'ใบสมัคร', tone: null },
  { key: 'done', label: 'มีผลแล้ว', tone: 'success' },
  { key: 'waiting', label: 'ยังรอ', tone: 'warn' },
  { key: 'failed', label: 'ล้มเหลว', tone: 'danger' },
  { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral' },
];

const AiShareLumosStats: React.FC<{ block: AiShareBlockKey; win: AiShareWindow; tick: number }> = ({ block, win, tick }) => {
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
  return block === 'follow' ? (
    <FollowTable split={current?.follow ?? null} failed={failed} />
  ) : (
    <ApplicantCells b={current?.applicants ?? null} backlog={current?.backlog ?? null} failed={failed} />
  );
};

const numClass = (n: number, tone: Tone) =>
  n > 0 && tone && tone !== 'neutral' ? TONE[tone].value : n === 0 ? 'text-muted-foreground' : 'text-foreground';

const sumText = (b: LumosBucket) =>
  `${NUM.format(b.done)} + ${NUM.format(b.waiting)} + ${NUM.format(b.failed)} + ${NUM.format(b.cancelled)} = ${NUM.format(
    b.done + b.waiting + b.failed + b.cancelled,
  )}`;

/** คอลัมน์ของงานติดตาม — สีชุดเดียวกับตารางผลโทร */
const FOLLOW_COLS: ReadonlyArray<{ key: FollowBucketKey; label: string; tone: keyof typeof TONE }> = [
  { key: 'went', label: 'ไป', tone: FOLLOW_MATRIX_COL_TONE.went },
  { key: 'notWent', label: 'ไม่ไป', tone: FOLLOW_MATRIX_COL_TONE.notWent },
  { key: 'reschedule', label: 'ขอเลื่อน', tone: FOLLOW_MATRIX_COL_TONE.unclear },
  { key: 'unclear', label: 'สรุปไม่ได้', tone: FOLLOW_MATRIX_COL_TONE.unclear },
  { key: 'waiting', label: 'รอดำเนินการ', tone: FOLLOW_MATRIX_COL_TONE.waiting },
  { key: 'failed', label: 'ล้มเหลว', tone: FOLLOW_MATRIX_COL_TONE.noAnswer },
  { key: 'cancelled', label: 'ยกเลิก', tone: FOLLOW_MATRIX_COL_TONE.cancelled },
];
const DONE_KEYS: readonly FollowBucketKey[] = ['went', 'notWent', 'reschedule', 'unclear'];

const followSumText = (b: FollowBucket) => `${FOLLOW_BUCKET_KEYS.map((k) => NUM.format(b[k])).join(' + ')} = ${NUM.format(followBucketSum(b))}`;

/** งานติดตาม — AI โทร / คนโทร / รวม (แถวรวม = กล่องทั้งหมดของการ์ด) · มีผลการโทรแตก 4 ช่อง */
function FollowTable({ split, failed }: { split: { ai: FollowBucket; staff: FollowBucket } | null; failed: string | null }) {
  const rows: Array<[string, FollowBucket | null]> = [
    ['AI โทร', split?.ai ?? null],
    ['คนโทร', split?.staff ?? null],
    ['รวม', split ? sumFollowBuckets(split.ai, split.staff) : null],
  ];
  const ok = rows.every(([, b]) => !b || followBucketAddsUp(b));
  const cell = (n: number | null, strong: boolean, tone: keyof typeof TONE | null) =>
    n === null ? (
      <Skeleton className="ml-auto h-6 w-10" />
    ) : (
      <span className={cn('text-lg tabular-nums', strong ? 'font-medium' : 'font-light', tone ? numClass(n, tone) : 'text-foreground')}>
        {NUM.format(n)}
      </span>
    );
  return (
    <div className="space-y-3" data-testid="lumos-stats-follow">
      <h3 className="text-sm font-medium text-foreground">งานติดตาม</h3>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs" />
              <TableHead className="text-xs" />
              <TableHead colSpan={DONE_KEYS.length} className="border-b border-border/70 text-center text-xs">
                มีผลการโทร
              </TableHead>
              <TableHead colSpan={FOLLOW_COLS.length - DONE_KEYS.length} className="text-xs" />
            </TableRow>
            <TableRow>
              <TableHead className="text-xs" />
              <TableHead className="whitespace-nowrap text-right text-xs">งานที่ต้องติดตาม</TableHead>
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
            {rows.map(([label, b]) => {
              const strong = label === 'รวม';
              return (
                <TableRow key={label} data-testid={`lumos-follow-${label}`}>
                  <TableCell className={cn('whitespace-nowrap text-sm text-foreground', strong && 'font-medium')}>{label}</TableCell>
                  <TableCell className="text-right">{cell(b ? b.total : null, strong, null)}</TableCell>
                  {FOLLOW_COLS.map((c) => (
                    <TableCell key={c.key} className="text-right">
                      {cell(b ? b[c.key] : null, strong, c.tone)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
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

/** งานรับสมัคร — งานที่ส่งให้ AI + งานเก่า */
function ApplicantCells({ b, backlog, failed }: { b: LumosBucket | null; backlog: number | null; failed: string | null }) {
  const cells: Cell[] = [...APPLICANTS, { key: 'backlog', label: 'งานเก่าที่ต้องติดตาม', tone: 'warn' }];
  const valueOf = (k: Cell['key']) => (k === 'backlog' ? backlog : b ? b[k] : null);
  return (
    <div className="space-y-3" data-testid="lumos-stats-applicants">
      <h3 className="text-sm font-medium text-foreground">งานรับสมัคร · ส่งให้ AI</h3>
      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cells.map((c) => {
          const n = valueOf(c.key);
          return (
            <div key={c.key} className="space-y-1 rounded-xl border border-border/70 px-3 py-2" data-testid={`lumos-applicants-${c.key}`}>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {c.tone ? <span className={cn('h-2 w-2 rounded-full', TONE[c.tone].dot)} aria-hidden /> : null}
                {c.label}
              </span>
              {n === null ? (
                <Skeleton className="h-7 w-14" />
              ) : (
                <span className={cn('block text-xl font-light tabular-nums', c.key === 'total' ? 'text-foreground' : numClass(n, c.tone))}>
                  {NUM.format(n)}
                </span>
              )}
            </div>
          );
        })}
      </div>
      {b ? (
        <p className={cn('text-xs tabular-nums', lumosBucketAddsUp(b) ? 'text-muted-foreground' : TONE.danger.value)} data-testid="lumos-applicants-sum">
          {sumText(b)}
          {lumosBucketAddsUp(b) ? '' : ` · ไม่ตรงกับ ${NUM.format(b.total)}`}
        </p>
      ) : null}
    </div>
  );
}

export default AiShareLumosStats;
