/**
 * ═══ ป๊อปตอนกดกล่อง AI โทร / คนโทร ของหัวข้อติดตาม (เจ้าของ 7 ต.ค. 2569 ค่ำ) ═══
 *
 * เจ้าของ: *"ถ้ากด Aiโทร มีการแสดงผลให้ดูว่า แต่ละเรื่องที่ Ai โทรให้อะเท่าไหร่ · เมื่อกดแต่ละเรื่อง โชว์ Ai โทรไปเท่าไหร่ ·
 * ไป ไม่ไป ไม่รับสาย สรุปไม่ได้ · ยกเลิก · รอโทร"* — *"ตอนนี้ Ai ทำงานเท่านี้แล้ว สำเร็จได้เท่านี้แล้ว คนโทรเท่านี้ สำเร็จเท่านี้"*
 * Choice: เรื่อง = 2 แท็บของติดตามก่อน (เรื่องอื่นทีหลัง) · คนโทรแบบเดียวกัน · **ป๊อปเดิม เปลี่ยนข้างใน** · แผงเส้นทางติดตามถอดแล้ว
 *
 * ชั้น: เรื่อง (2 แท็บ) → ผลของเรื่องนั้น → รายชื่อของช่องที่กด · ปุ่มกลับทุกชั้น
 * ช่อง/คำ = ของแผงหน้าติดตาม (`FOLLOW_MATRIX_COL_LABEL` · ขอเลื่อนอยู่ในสรุปไม่ได้) · ทุกช่องรวมกัน = ทั้งหมดของเรื่อง (ขึ้นบนจอ)
 * ข้อมูลจาก `/api/home-ai-share?journey=follow` (ชุดแถวเดียวกับการ์ด) · นับที่ `followCallerBreakdown`
 * 🔴 shadcn (Dialog · Button · Table · Skeleton · Pagination) · ไม่ซ้อน Dialog · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toneOfBu } from '@/components/team-online/teamOnlineTones';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import { toYmdBangkok } from '@/lib/dateTh';
import { FOLLOW_MATRIX_COL_LABEL, FOLLOW_MATRIX_COL_TONE } from '@/lib/followCallMatrix';
import {
  FOLLOW_CALLER_CALLED,
  followCallerBreakdown,
  journeyResultMatrixCol,
  type FollowCallerCol,
  type FollowJourneyResponse,
  type FollowJourneyRow,
  type FollowJourneyTeam,
} from '@/lib/followJourney';
import { AI_SHARE_LIST_PAGE, type AiShareWindow } from '@/lib/homeAiShare';
import { fetchFollowJourney } from '@/lib/homeAiShareApi';
import { periodLabel } from '@/lib/periodPick';
import { trendBuLabel } from '@/lib/trends/bu';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** ชื่อเรื่อง = ชื่อแท็บบนหน้าติดตาม */
const TOPIC_LABEL: Record<FollowJourneyTeam, string> = {
  main: 'ติดตามคนเริ่มงาน',
  replacement: 'ติดตามส่งคนแทน',
};

type NamesKey = FollowCallerCol | 'all' | 'called';
type Level = { kind: 'topics' } | { kind: 'topic'; team: FollowJourneyTeam } | { kind: 'names'; team: FollowJourneyTeam; key: NamesKey };

const namesLabel = (k: NamesKey) => (k === 'all' ? 'ทั้งหมด' : k === 'called' ? 'โทรแล้ว' : FOLLOW_MATRIX_COL_LABEL[k]);

const FollowCallerDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caller: 'ai' | 'manual';
  /** ชื่อหัวข้อ เช่น "ติดตาม" */
  blockTitle: string;
  unit: string;
  win: AiShareWindow;
  /** เลขในกล่องที่กด — ขึ้นบนหัวระหว่างรอ */
  count: number | null;
}> = ({ open, onOpenChange, caller, blockTitle, unit, win, count }) => {
  const [data, setData] = useState<FollowJourneyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>({ kind: 'topics' });
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchFollowJourney(win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดไม่ขึ้น ลองอีกครั้ง');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, win]);

  const current = data && data.from === win.from && data.to === win.to ? data : null;
  const topics = useMemo(() => followCallerBreakdown(current?.rows ?? [], caller), [current, caller]);
  const failed = error ?? current?.error ?? null;
  const callerLabel = caller === 'ai' ? 'AI โทร' : 'คนโทร';
  const total = current ? topics.reduce((n, t) => n + t.rows.length, 0) : (count ?? 0);
  const go = (l: Level) => {
    setLevel(l);
    setPage(0);
  };

  const tile = (label: string, n: number, onClick: () => void, tone?: keyof typeof TONE, testid?: string) => (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={n === 0}
      className="h-auto flex-col items-start gap-1 rounded-xl px-3 py-2 text-left"
      aria-label={`${label} ${n} ${unit}`}
      data-testid={testid}
    >
      <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
        {tone ? <span className={cn('h-2 w-2 rounded-full', TONE[tone].dot)} aria-hidden /> : null}
        {label}
      </span>
      <span className="text-xl font-light tabular-nums text-foreground">{NUM.format(n)}</span>
    </Button>
  );

  const back = (label: string, to: Level) => (
    <Button type="button" variant="ghost" size="sm" className="-ml-2 self-start" onClick={() => go(to)}>
      <ChevronLeft aria-hidden />
      {label}
    </Button>
  );

  const body = (() => {
    if (!current) {
      if (failed) return <p className={cn('py-6 text-center text-sm', TONE.danger.value)}>{failed}</p>;
      return (
        <div className="space-y-2" aria-label="กำลังโหลด">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (level.kind === 'topics') {
      return (
        <div className="space-y-2" data-testid="caller-topics">
          {topics.map((t) => (
            <Button
              key={t.team}
              type="button"
              variant="outline"
              onClick={() => go({ kind: 'topic', team: t.team })}
              className="h-auto w-full justify-between gap-4 rounded-xl px-4 py-3 text-left"
              aria-label={`${TOPIC_LABEL[t.team]} ${t.rows.length} ${unit}`}
              data-testid={`caller-topic-${t.team}`}
            >
              <span className="space-y-1">
                <span className="block text-base font-medium text-foreground">{TOPIC_LABEL[t.team]}</span>
                <span className="block text-xs font-normal tabular-nums text-muted-foreground">
                  โทรแล้ว {NUM.format(t.called.length)} · {FOLLOW_MATRIX_COL_LABEL.went} {NUM.format(t.cols.went.length)}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-xl font-light tabular-nums text-foreground">{NUM.format(t.rows.length)}</span>
                <ChevronRight aria-hidden />
              </span>
            </Button>
          ))}
        </div>
      );
    }

    const t = topics.find((x) => x.team === level.team) ?? topics[0];

    if (level.kind === 'topic') {
      return (
        <div className="space-y-4" data-testid="caller-topic">
          {back('ทุกเรื่อง', { kind: 'topics' })}
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-base font-medium text-foreground">{TOPIC_LABEL[t.team]}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {callerLabel} {NUM.format(t.rows.length)} {unit}
            </span>
          </div>
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">
              โทรแล้ว <span className="tabular-nums text-foreground">{NUM.format(t.called.length)}</span>
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOLLOW_CALLER_CALLED.map((c) =>
                tile(FOLLOW_MATRIX_COL_LABEL[c], t.cols[c].length, () => go({ kind: 'names', team: t.team, key: c }), FOLLOW_MATRIX_COL_TONE[c], `caller-col-${c}`),
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['cancelled', 'waiting'] as const).map((c) =>
              tile(FOLLOW_MATRIX_COL_LABEL[c], t.cols[c].length, () => go({ kind: 'names', team: t.team, key: c }), FOLLOW_MATRIX_COL_TONE[c], `caller-col-${c}`),
            )}
          </div>
          {/* ตัวเช็ค: ทุกช่องรวมกัน = ทั้งหมดของเรื่องนี้ */}
          <p className="text-sm tabular-nums text-muted-foreground" data-testid="caller-sum">
            โทรแล้ว {NUM.format(t.called.length)} + {FOLLOW_MATRIX_COL_LABEL.cancelled} {NUM.format(t.cols.cancelled.length)} +{' '}
            {FOLLOW_MATRIX_COL_LABEL.waiting} {NUM.format(t.cols.waiting.length)} = {NUM.format(t.rows.length)} {unit}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => go({ kind: 'names', team: t.team, key: 'all' })}>
            ดูรายชื่อทั้งหมด
          </Button>
        </div>
      );
    }

    const list: FollowJourneyRow[] = (level.key === 'all' ? t.rows : level.key === 'called' ? t.called : t.cols[level.key])
      .slice()
      .sort((a, b) => b.at.localeCompare(a.at));
    const pages = Math.max(1, Math.ceil(list.length / AI_SHARE_LIST_PAGE));
    const first = page * AI_SHARE_LIST_PAGE;
    const shown = list.slice(first, first + AI_SHARE_LIST_PAGE);
    return (
      <div className="space-y-3" data-testid="caller-names">
        {back(TOPIC_LABEL[t.team], { kind: 'topic', team: t.team })}
        <span className="block text-base font-medium text-foreground">
          {namesLabel(level.key)} <span className="tabular-nums">{NUM.format(list.length)}</span>{' '}
          <span className="text-sm font-normal text-muted-foreground">{unit}</span>
        </span>
        {shown.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ไม่มีรายชื่อ</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ชื่อ</TableHead>
                <TableHead className="text-xs">BU</TableHead>
                <TableHead className="text-xs">เวลาโทร</TableHead>
                <TableHead className="text-xs">ผล</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => {
                const col = journeyResultMatrixCol(r.result);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm text-foreground">
                      {r.name}
                      {r.unit ? <span className="block text-xs text-muted-foreground">{r.unit}</span> : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground" title={r.bu ? trendBuLabel(r.bu) : undefined}>
                        <span className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[r.bu ? toneOfBu(r.bu) : 'neutral'].value)} aria-hidden />
                        {r.bu || 'ไม่ระบุ'}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs tabular-nums text-foreground">{WHEN.format(new Date(r.at))}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      <span className="inline-flex items-center gap-1.5 text-foreground">
                        <span className={cn('inline-block h-2 w-2 rounded-full', TONE[FOLLOW_MATRIX_COL_TONE[col]].dot)} aria-hidden />
                        {r.result === 'reschedule' ? 'ขอเลื่อน' : FOLLOW_MATRIX_COL_LABEL[col]}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {list.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs tabular-nums text-muted-foreground">
              แสดง {NUM.format(first + 1)}–{NUM.format(first + shown.length)} จาก {NUM.format(list.length)} {unit}
            </p>
            {pages > 1 ? (
              <Pagination className="mx-0 w-auto justify-end">
                <PaginationContent>
                  <PaginationItem>
                    <Button type="button" size="xs" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      ก่อนหน้า
                    </Button>
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-2 text-xs tabular-nums text-muted-foreground">
                      หน้า {NUM.format(page + 1)} / {NUM.format(pages)}
                    </span>
                  </PaginationItem>
                  <PaginationItem>
                    <Button type="button" size="xs" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>
                      ถัดไป
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('flex max-h-[85vh] max-w-2xl flex-col overflow-hidden', EVEN_TYPE)} data-testid="caller-dialog">
        <DialogHeader className="pr-6">
          <DialogTitle className="space-y-1">
            <span className="block text-sm font-normal text-muted-foreground">
              {blockTitle} · {periodLabel(win, toYmdBangkok(new Date()))}
            </span>
            <span className="block text-xl font-light">
              {callerLabel} <span className="tabular-nums">{NUM.format(total)}</span>{' '}
              <span className="text-base text-muted-foreground">{unit}</span>
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {callerLabel}ของ{blockTitle} แยกตามเรื่อง
          </DialogDescription>
        </DialogHeader>
        <div className={cn('min-h-0 flex-1 overflow-y-auto', loading && current && 'opacity-60')}>{body}</div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowCallerDialog;
