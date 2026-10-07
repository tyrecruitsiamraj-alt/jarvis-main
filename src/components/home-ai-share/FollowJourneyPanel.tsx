/**
 * ═══ เส้นทางติดตาม — หน้าหลัก หัวข้อติดตาม (เจ้าของ 7 ต.ค. 2569) ═══
 *
 * เจ้าของ: *"หน้าหลักตอบพวกนี้ได้ไหม … เก็บแบบไมโครเลยได้ไหม และ มี interactive"* · *"หน้าหลักคือรวม 2 อันนี้ แต่พอแยกต้องตอบพวกนี้ได้"*
 * Choice: เพิ่มคน = โชว์ทั้งคนและสาย · ช่วง = วันที่โทร (ปฏิทินเดียวกับการ์ด) · กดเลข = รายชื่อ + กราฟรายวัน ·
 * iRecruit แก้/ยกเลิก = ต้องมี (เริ่มเก็บ 7 ต.ค. 2569)
 * ความเชื่อใจ (เจ้าของ: *"เช็คเองมันดันเคยไม่ตรง"*): ผลทุกช่องรวมกัน = สายทั้งหมด (ขึ้นบนจอ) · ทุกเลขกดดูชื่อได้ ·
 * หมวดเดียวกับแผงหน้าติดตาม (เทสต์ `tests/api/followJourney.test.ts`)
 * นับที่หน้าจาก `/api/home-ai-share?journey=follow` (แถวเบา ไม่มีเบอร์) · นิยาม `src/lib/followJourney.ts`
 * 🔴 shadcn (Card · Tabs · Button · Dialog · Table) + Tailwind · สีจาก TONE · ไม่มีประโยคอธิบายบนจอ
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EVEN_TYPE, TONE } from '@/lib/designTokens';
import {
  FOLLOW_JOURNEY_RESULTS,
  FOLLOW_JOURNEY_RESULT_TONE,
  FOLLOW_JOURNEY_STAGE_LABEL,
  journeyCount,
  journeyDaily,
  journeyEventsOf,
  journeyPerDay,
  journeyRowsOf,
  journeyScope,
  type FollowJourneyResponse,
  type FollowJourneyStage,
  type FollowJourneyView,
} from '@/lib/followJourney';
import type { AiShareWindow } from '@/lib/homeAiShare';
import { fetchFollowJourney } from '@/lib/homeAiShareApi';
import { rangeText } from '@/lib/periodPick';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const WHEN = new Intl.DateTimeFormat('th-TH', {
  timeZone: 'Asia/Bangkok',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const CLOCK = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'UTC' });

const VIEWS: ReadonlyArray<[FollowJourneyView, string]> = [
  ['all', 'รวม'],
  ['main', 'ติดตามคนเริ่มงาน'],
  ['replacement', 'ติดตามส่งคนแทน'],
];

const PAGE = 50;

type ToneKey = keyof typeof TONE;
const STAGE_TONE: Partial<Record<FollowJourneyStage, ToneKey>> = { ...FOLLOW_JOURNEY_RESULT_TONE, ai: 'primary', manual: 'warn' };

const isEventStage = (s: FollowJourneyStage) => s === 'irecruitEdit' || s === 'irecruitCancel';

/** หน่วยของเลขตัวแรก — ใบงาน iRecruit / เหตุการณ์ นับเป็นใบ ที่เหลือนับคน */
const firstUnit = (s: FollowJourneyStage) => (s === 'irecruit' || isEventStage(s) ? 'ใบ' : 'คน');
const secondUnit = (s: FollowJourneyStage) => (isEventStage(s) ? 'ครั้ง' : 'สาย');

const FollowJourneyPanel: React.FC<{ win: AiShareWindow; tick: number }> = ({ win, tick }) => {
  const [data, setData] = useState<FollowJourneyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<FollowJourneyView>('all');
  const [open, setOpen] = useState<FollowJourneyStage | null>(null);
  const winRef = useRef(win);
  winRef.current = win;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchFollowJourney(win)
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error && e.message ? e.message : 'โหลดเส้นทางติดตามไม่ขึ้น ลองรีเฟรชอีกครั้ง');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [win]);

  // อัปเดตสดรอบเดียวกับหน้า — โหลดเงียบ เลขเดิมค้างจนเลขใหม่มา
  useEffect(() => {
    if (tick === 0) return;
    let alive = true;
    fetchFollowJourney(winRef.current)
      .then((d) => {
        if (alive && d.from === winRef.current.from && d.to === winRef.current.to) {
          setData(d);
          // รอบก่อนล้ม รอบนี้ได้แล้ว = ล้างข้อความล้มทิ้ง ไม่ค้างบนจอ
          setError(null);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  const current = data && data.from === win.from && data.to === win.to ? data : null;
  const rows = useMemo(() => journeyScope(current?.rows ?? [], view), [current, view]);
  const events = useMemo(() => (view === 'main' ? [] : (current?.events ?? [])), [current, view]);
  const failed = error ?? current?.error ?? null;
  const count = (s: FollowJourneyStage) => journeyCount(rows, events, s);
  const added = count('added');
  const resultSum = FOLLOW_JOURNEY_RESULTS.reduce((n, r) => n + count(r).calls, 0);
  const callerSum = count('ai').calls + count('manual').calls;
  const days = new Set(rows.map((r) => r.ymd)).size;
  const perDayCalls = days > 0 ? Math.round(rows.length / days) : 0;
  /** รวมท้ายแถว — ต้องเท่าสายทั้งหมด (ไม่เท่า = ขึ้นแดงให้เห็นทันที ไม่ซ่อน) */
  const sumText = (sum: number, testid: string) => (
    <span
      className={cn('text-sm tabular-nums', sum === added.calls ? 'text-muted-foreground' : TONE.danger.value)}
      data-testid={testid}
    >
      รวม {NUM.format(sum)} สาย{sum === added.calls ? '' : ` · ไม่ตรงกับ ${NUM.format(added.calls)}`}
    </span>
  );

  const stat = (s: FollowJourneyStage) => {
    const c = count(s);
    const tone = STAGE_TONE[s];
    return (
      <Button
        key={s}
        type="button"
        variant="outline"
        onClick={() => setOpen(s)}
        className="h-auto min-w-28 flex-col items-start gap-1 rounded-xl px-3 py-2 text-left"
        data-testid={`journey-${s}`}
        aria-label={`${FOLLOW_JOURNEY_STAGE_LABEL[s]} ${c.calls} ${secondUnit(s)} ${c.people} ${firstUnit(s)}`}
      >
        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          {tone ? <span className={cn('h-2 w-2 rounded-full', TONE[tone].dot)} aria-hidden /> : null}
          {FOLLOW_JOURNEY_STAGE_LABEL[s]}
        </span>
        {/* เลขใหญ่ = สาย (บวกกันได้พอดีเสมอ) · คนเดียวมีได้ทั้งสาย AI และคนโทร เลยเป็นเลขเล็ก ไม่ใช่ตัวที่บวกกัน */}
        <span className="text-lg font-medium tabular-nums text-foreground">
          {loading && !current ? '—' : `${NUM.format(c.calls)} ${secondUnit(s)}`}
        </span>
        <span className="text-xs font-normal tabular-nums text-muted-foreground">
          {NUM.format(c.people)} {firstUnit(s)}
        </span>
      </Button>
    );
  };

  const line = (label: string, children: React.ReactNode, testid?: string) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4" data-testid={testid}>
      <span className="w-28 shrink-0 pt-2 text-sm text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );

  return (
    <Card variant="glass" className="space-y-5 p-5 sm:p-6" data-testid="follow-journey">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <h2 className="text-lg font-medium text-foreground">เส้นทางติดตาม</h2>
        <Tabs value={view} onValueChange={(v) => setView(v as FollowJourneyView)}>
          <TabsList>
            {VIEWS.map(([k, label]) => (
              <TabsTrigger key={k} value={k}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {current ? (
          <span className="text-xs tabular-nums text-muted-foreground">อัปเดต {CLOCK.format(new Date(current.generated_at))}</span>
        ) : null}
      </div>

      {failed ? <p className={cn('text-sm', TONE.danger.value)}>{failed}</p> : null}

      {line(
        'เพิ่มคน',
        <>
          {stat('added')}
          <span className="text-sm tabular-nums text-muted-foreground">
            วันละ {NUM.format(perDayCalls)} สาย · {NUM.format(journeyPerDay(rows))} คน
          </span>
        </>,
        'journey-line-added',
      )}
      {line(
        'ใครโทร',
        <>
          {(['ai', 'manual'] as const).map(stat)}
          {sumText(callerSum, 'journey-caller-sum')}
        </>,
        'journey-line-caller',
      )}
      {line(
        'ผลโทร',
        <>
          {FOLLOW_JOURNEY_RESULTS.map(stat)}
          {sumText(resultSum, 'journey-sum')}
        </>,
        'journey-line-results',
      )}
      {view !== 'main'
        ? line('iRecruit', (['irecruit', 'inside', 'outside', 'irecruitEdit', 'irecruitCancel'] as const).map(stat), 'journey-line-irecruit')
        : null}

      <JourneyDialog
        stage={open}
        onClose={() => setOpen(null)}
        data={current}
        view={view}
        win={win}
      />
    </Card>
  );
};

/** ป๊อปตอนกดเลข — กราฟรายวัน + รายชื่อ (ชุดเดียวกับเลขที่กด) */
const JourneyDialog: React.FC<{
  stage: FollowJourneyStage | null;
  onClose: () => void;
  data: FollowJourneyResponse | null;
  view: FollowJourneyView;
  win: AiShareWindow;
}> = ({ stage, onClose, data, view, win }) => {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [stage, view]);
  const rows = useMemo(() => journeyScope(data?.rows ?? [], view), [data, view]);
  const events = useMemo(() => (view === 'main' ? [] : (data?.events ?? [])), [data, view]);
  const s = stage ?? 'added';
  const daily = useMemo(() => journeyDaily(rows, events, s), [rows, events, s]);
  const list = useMemo(() => {
    if (isEventStage(s)) {
      return journeyEventsOf(events, s)
        .slice()
        .reverse()
        .map((e, i) => ({ key: `${e.at}-${i}`, name: e.name, unit: e.unit, at: e.at, extra: e.job, result: null as string | null }));
    }
    return journeyRowsOf(rows, s)
      .slice()
      .reverse()
      .map((r) => ({
        key: r.id,
        name: r.name,
        unit: r.unit,
        at: r.at,
        extra: r.caller === 'ai' ? 'AI โทร' : 'คนโทร',
        result: FOLLOW_JOURNEY_STAGE_LABEL[r.result],
      }));
  }, [rows, events, s]);
  const c = journeyCount(rows, events, s);
  const max = Math.max(1, ...daily.map((d) => d.calls));
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const shown = list.slice(page * PAGE, page * PAGE + PAGE);
  const viewLabel = VIEWS.find(([k]) => k === view)?.[1] ?? '';

  return (
    <Dialog open={stage !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className={cn('max-h-[90vh] max-w-3xl overflow-y-auto', EVEN_TYPE)}>
        <DialogHeader>
          <DialogTitle>
            {FOLLOW_JOURNEY_STAGE_LABEL[s]} · {NUM.format(c.calls)} {secondUnit(s)} · {NUM.format(c.people)} {firstUnit(s)}
          </DialogTitle>
          <DialogDescription>
            {viewLabel} · {rangeText(win.from, win.to)}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-x-auto" data-testid="journey-daily">
          <div className="flex h-36 min-w-full items-end gap-1">
            {daily.map((d) => (
              <div
                key={d.ymd}
                className="flex min-w-6 flex-1 flex-col items-center justify-end gap-1 self-stretch"
                title={`${DAY.format(new Date(`${d.ymd}T00:00:00Z`))} · ${d.calls} ${secondUnit(s)} · ${d.people} ${firstUnit(s)}`}
              >
                <span className="text-xs tabular-nums text-muted-foreground">{d.calls > 0 ? NUM.format(d.calls) : ''}</span>
                <div className="w-full rounded-t-lg bg-primary/70" style={{ height: `${(d.calls / max) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex min-w-full gap-1 border-t border-border pt-1">
            {daily.map((d) => (
              <span key={d.ymd} className="min-w-6 flex-1 text-center text-xs tabular-nums text-muted-foreground">
                {Number(d.ymd.slice(8))}
              </span>
            ))}
          </div>
          {daily.length === 0 ? <p className="py-2 text-center text-sm text-muted-foreground">0</p> : null}
        </div>

        <Table data-testid="journey-list">
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ</TableHead>
              <TableHead>หน่วยงาน</TableHead>
              <TableHead>{isEventStage(s) ? 'เวลาที่แก้' : 'เวลาโทร'}</TableHead>
              <TableHead>{isEventStage(s) ? 'ใบงาน' : 'ใครโทร'}</TableHead>
              {isEventStage(s) ? null : <TableHead>ผล</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  ไม่มีรายชื่อ
                </TableCell>
              </TableRow>
            ) : (
              shown.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.unit ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{WHEN.format(new Date(r.at))}</TableCell>
                  <TableCell>{r.extra}</TableCell>
                  {isEventStage(s) ? null : <TableCell>{r.result}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {pages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-sm tabular-nums">
            <Button type="button" variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              ก่อนหน้า
            </Button>
            <span className="text-muted-foreground">
              {page + 1} / {pages}
            </span>
            <Button type="button" variant="outline" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
              ถัดไป
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default FollowJourneyPanel;
