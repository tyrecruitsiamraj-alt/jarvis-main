/**
 * ═══ หน้าหลักผู้บริหาร — หน้าเดียวเลื่อนลง (เจ้าของ 24 ต.ค. 2569 · Choice "หน้าเดียวเลื่อนลง") ═══
 *
 * เจ้าของ: *"หน้าหลักต้องบอกได้ประมาณนี้"* — ใบขอเข้า/ปิด/เหลือ · ค้างนาน 5 ช่วง + ปิดกี่วัน · ค่าปรับ/ลดมูลค่า รายใบ ·
 * ประกาศ/ไม่ประกาศ · มีคนกรอก/ไม่มี · AI สนใจแต่คนยังไม่โทรต่อ · ช่องทาง · ติดตาม · ดูแลหลังเริ่มงาน · AI กับคนเท่าไหร่
 * *"ต้องมี visual control · Interactive graph เวลาเปลี่ยนกราฟวิ่งตาม"*
 *
 * ลำดับ (24 ต.ค. 2569 รอบ 2 "ผู้บริหารมีเวลา 30 วิ" — เจ้าของ "ทำเลย · คำอย่าเป็นภาษา AI"):
 *   4 กล่องบน → ต้องรีบ → ใครค้างเท่าไหร่ → ใบขอในช่วงนี้ → (พับไว้) ใบขอค้าง/ช่องทาง · เงินรายวัน/รายใบ → ติดตาม
 *   ค่าตั้งต้น = เดือนนี้ · กล่องเงินโชว์ "ลูกค้าหักจริง" กับ "ตามสัญญา (สูงสุด)" ขนาดเท่ากัน
 * ข้อมูล: `/api/home-money` (เงิน · นาฬิกา · สมการใบขอ) · `/api/request-pipeline` (ใบขอเปิด) · `/api/home-ai-share` (AI/คน)
 * 🔴 ชั้นคู่ขนาน: หน้านี้คือค่าตั้งต้นของ `/` · หน้าแท็บเดิมรวมเข้ามาเป็นส่วน "รายชื่อ" ท้ายหน้าแล้ว (25 ต.ค. 2569 · ไม่มีปุ่มพาออก) · `?home=new` ยังเปิดได้ถ้าพิมพ์เอง = ทางถอย
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlarmClock, Bot, Clock3, HandCoins, Layers, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { KpiTile } from '@/components/home-ai-share/HomeKpis';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import HomeRequestsTab from '@/components/home-ai-share/HomeRequestsTab';
import HomeMoneySection from '@/components/home-exec/HomeMoneySection';
import ExecDrill, { useDrill } from '@/components/home-exec/ExecDrill';
import Num from '@/components/home-exec/Num';
import type { MoneyRequest } from '@/lib/homeMoney';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fetchHomeMoney, previousWindow, type HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { fetchHomeAiShare } from '@/lib/homeAiShareApi';
import { sharesOfCalled, type AiShareBlockKey, type AiShareResponse, type AiShareWindow } from '@/lib/homeAiShare';
import HomeAiSharePage from '@/pages/HomeAiSharePage';
import { byOwner, costliest, dueSoon, NO_OWNER, peopleNeeded, perDayOf, scaleOf, staleOf, STALE_DAYS, thisMonthWindow, type UrgentRow } from '@/lib/homeExec';
import { fetchRequestPipeline } from '@/lib/requestPipelineApi';
import type { RequestPipelineResponse } from '@/lib/requestPipelineTypes';
import { channelInterestOf } from '@/lib/channelPlatforms';
import { Slider } from '@/components/ui/slider';
import { thaiDate } from '@/lib/periodPick';
import { SITE_BU_TO_DEPT, trendBuLabel } from '@/lib/trends/bu';
import { toYmdBangkok } from '@/lib/dateTh';
import { countPill } from '@/lib/teamOnline';
import { TONE } from '@/lib/designTokens';
import { friendlyErrorText } from '@/lib/friendlyError';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const BU_OPTIONS = [...new Set(Object.values(SITE_BU_TO_DEPT))];
const LIVE_MS = 60_000;
/** ช่วง "ทั้งหมด" ของปฏิทิน (start null) = นับตั้งแต่ข้อมูลเก่าสุดของสมุด */
const ALL_FROM = '2024-01-01';

type AiPick = AiShareBlockKey | 'online';
/** กดแถวในกล่อง AI = เปิดแท็บของเรื่องนั้นในส่วนรายชื่อ (ส่งคนแทนอยู่ในแท็บติดตาม แยกทีมในนั้น) */
const AI_ROW_PICK: Record<string, AiPick> = { start: 'follow', replace: 'follow', applicants: 'applicants', matching: 'matching' };

/** AI ทำแทนกี่ % (ของที่โทรแล้ว) — หัวข้อที่เจ้าของระบุ 24 ต.ค. 2569 */
function aiRows(d: AiShareResponse | null): Array<{ key: string; label: string; pct: number | null; called: number }> {
  if (!d) return [];
  const f = d.follow;
  const out: Array<{ key: string; label: string; pct: number | null; called: number }> = [];
  if (f) {
    const repTotal = f.teamReplacement ?? 0;
    const repAi = f.teamReplacementAi ?? 0;
    const mainTotal = f.total - repTotal;
    const mainAi = f.ai - repAi;
    out.push({ key: 'start', label: 'ติดตามคนเริ่มงาน', pct: mainTotal > 0 ? Math.round((mainAi / mainTotal) * 100) : null, called: mainTotal });
    out.push({ key: 'replace', label: 'ติดตามส่งคนแทน', pct: repTotal > 0 ? Math.round((repAi / repTotal) * 100) : null, called: repTotal });
  }
  for (const [key, label, c] of [
    ['applicants', 'งานสรรหา', d.applicants],
    ['matching', 'จับคู่งาน', d.matching],
  ] as const) {
    const s = c ? sharesOfCalled(c) : null;
    out.push({ key, label, pct: s ? s.ai : null, called: c ? c.ai + c.staff + c.both : 0 });
  }
  return out;
}

type FlowRole = NonNullable<MoneyRequest['flow']>;

/** ช่องทางที่ได้เยอะสุด 3 อันดับ ต่อขั้น (กรอก · นัดได้ · ลงงาน) — ชื่อช่องทางชุดเดียวกับตารางช่องทาง */
type Leader = { name: string; value: number };
function channelLeaders(d: RequestPipelineResponse | null): { registered: Leader[]; appointed: Leader[]; placed: Leader[] } | null {
  if (!d?.channels) return null;
  const interest = d.facts ? channelInterestOf(d.facts, d.window.from, d.window.to).byType : new Map();
  const rows = d.channels.rows.filter((r) => r.channel !== 'ไม่รู้ช่องทาง' && r.channel !== 'ไม่ระบุ');
  const top = (pick: (r: (typeof rows)[number]) => number): Leader[] =>
    rows
      .map((r) => ({ name: r.channel, value: pick(r) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 3);
  return {
    registered: top((r) => r.registered),
    appointed: top((r) => interest.get(r.channel)?.appointed ?? 0),
    placed: top((r) => r.placed),
  };
}

/** การ์ด "ต้องรีบ" — 5 ใบแรก + บอกว่ามีทั้งหมดกี่ใบ */
function UrgentCard({
  icon: Icon,
  title,
  total,
  rows,
  loading,
  right,
  testId,
  onOpen,
}: {
  icon: typeof HandCoins;
  title: string;
  total: number;
  rows: UrgentRow[];
  loading: boolean;
  right: (r: UrgentRow) => string;
  testId: string;
  /** กดหัวการ์ด = ดูทั้งหมด · กดแถว = ดูทั้งหมดโดยกางใบนั้น */
  onOpen: (expand: string | null) => void;
}) {
  return (
    <Card variant="solid" className="space-y-3 p-4" data-testid={testId}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
          {title}
        </span>
        <Button type="button" variant="link" size="sm" className="h-auto p-0 tabular-nums" onClick={() => onOpen(null)} disabled={loading}>
          {loading ? '—' : `ดูทั้งหมด ${NUM.format(total)} ใบ`}
        </Button>
      </span>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{loading ? '—' : 'ไม่มี'}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.requestNo}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-lg py-2 text-left hover:bg-muted/50"
                onClick={() => onOpen(r.requestNo)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-foreground">{[r.unit, r.position].filter(Boolean).join(' · ')}</span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {r.requestNo} · ขาด {NUM.format(r.missing)} คน
                  </span>
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">{right(r)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** ส่วนที่พับไว้ — กดหัวแล้วกาง (ของข้างในโหลดตอนกาง) */
function Folded({
  title,
  testId,
  children,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  testId: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [own, setOwn] = useState(false);
  const open = openProp ?? own;
  const setOpen = onOpenChange ?? setOwn;
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={testId}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between rounded-xl" aria-expanded={open}>
          {title}
          <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">{open ? children : null}</CollapsibleContent>
    </Collapsible>
  );
}

const HomeExecPage: React.FC = () => {
  usePageTitle('หน้าหลัก');
  const [win, setWin] = useState<AiShareWindow>(() => thisMonthWindow(toYmdBangkok(new Date())));
  const [showAllOwners, setShowAllOwners] = useState(false);
  const [bu, setBu] = useState<string | null>(null);
  const [money, setMoney] = useState<HomeMoneyPayload | null>(null);
  const [prevMoney, setPrevMoney] = useState<HomeMoneyPayload | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiShareResponse | null>(null);
  const tick = useLiveTick(true, LIVE_MS);
  /** ใบขอล่วงหน้าที่กล่องงานนับรวม — อยู่นอกสมการ (ใบล่วงหน้ากลายเป็นใบจริงจะถูกนับว่ายกเลิกผิด) แสดงต่อท้ายให้ยอดเท่ากล่องงาน */
  const feed = useUnitRequestsFeed();
  const preCount = feed.jobs.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX)).length;
  const feedReady = feed.feedState !== 'loading' && feed.feedState !== 'failed' && feed.feedState !== 'forbidden';

  const today = toYmdBangkok(new Date());
  const range = useMemo(() => ({ from: win.from ?? ALL_FROM, to: win.to ?? today }), [win, today]);

  useEffect(() => {
    let alive = true;
    setMoneyError(null);
    fetchHomeMoney({ ...range, bu })
      .then((m) => alive && setMoney(m))
      .catch((e: unknown) => alive && setMoneyError(friendlyErrorText(e, 'โหลดยอดเงินไม่ขึ้น')));
    fetchHomeMoney({ ...previousWindow(range), bu })
      .then((m) => alive && setPrevMoney(m))
      .catch(() => alive && setPrevMoney(null));
    fetchHomeAiShare({ ...win, bu })
      .then((d) => alive && setAi(d))
      .catch(() => alive && setAi(null));
    return () => {
      alive = false;
    };
  }, [range, win, bu, tick]);

  // เปลี่ยนช่วง/BU แล้วเลขเก่าห้ามค้าง
  const moneyNow = money && money.window.from === range.from && money.window.to === range.to && (money.forcedBu || money.bu === bu) ? money : null;
  const prevNow = moneyNow ? prevMoney : null;
  const flow = moneyNow?.flow ?? null;
  const total = moneyNow ? moneyNow.totals.need.fine + moneyNow.totals.need.deduct : 0;
  const prevTotal = prevNow ? prevNow.totals.need.fine + prevNow.totals.need.deduct : undefined;
  const speed = moneyNow?.clocks.speed ?? null;
  const late = moneyNow?.clocks.late ?? null;
  /** คีย์คงที่ = เลขในกล่องวิ่งจากค่าเดิมไปค่าใหม่ทุกครั้ง รวมตอนเปลี่ยนช่วง/BU (เจ้าของ "Interactive ที่เวลาเปลี่ยนข้อมูล") */
  const liveKey = 'exec';
  const rows = aiRows(ai);
  const openReqs = useMemo(() => moneyNow?.requests ?? [], [moneyNow]);
  const costly = useMemo(() => costliest(openReqs, today), [openReqs, today]);
  const soon = useMemo(() => dueSoon(openReqs, today), [openReqs, today]);
  const owners = useMemo(() => byOwner(openReqs, today), [openReqs, today]);
  const drill = useDrill();
  const [foldRequests, setFoldRequests] = useState(false);
  /** ส่วนติดตาม · ดูแล · ผู้สมัคร · จับคู่งาน · ทีม Online (ของหน้าแท็บเดิม รวมมาไว้หน้าเดียว 25 ต.ค. 2569) */
  const [foldAi, setFoldAi] = useState(false);
  const [aiPick, setAiPick] = useState<{ pick: AiPick | null; seq: number }>({ pick: null, seq: 0 });
  const openAi = (pick: AiPick) => {
    setAiPick((p) => ({ pick, seq: p.seq + 1 }));
    setFoldAi(true);
    window.setTimeout(() => document.querySelector('[data-testid="exec-fold-ai"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
  };
  const byNo = useMemo(() => new Map(openReqs.map((r) => [r.requestNo, r])), [openReqs]);
  const rowsOf = (list: ReadonlyArray<{ requestNo: string }>): MoneyRequest[] =>
    list.map((x) => byNo.get(x.requestNo)).filter((r): r is MoneyRequest => Boolean(r));
  const openList = (title: string, rows: MoneyRequest[], expand: string | null = null, sub?: string) => drill.open({ title, rows, expand, sub });
  const moneyRows = () =>
    openReqs
      .filter((r) => r.amount.need.fine + r.amount.need.deduct > 0)
      .sort((a, b) => b.amount.need.fine + b.amount.need.deduct - (a.amount.need.fine + a.amount.need.deduct));
  const flowRows = (pick: (f: NonNullable<MoneyRequest['flow']>) => boolean) => openReqs.filter((r) => r.flow && pick(r.flow));
  const stale = useMemo(() => staleOf(openReqs, today), [openReqs, today]);
  const [staleOpen, setStaleOpen] = useState(false);
  const scale = scaleOf(moneyNow?.workload, range.from, range.to > today ? today : range.to);
  const [extra, setExtra] = useState(50);
  /** ช่องทาง (ชุดเดียวกับตารางช่องทาง) — ดึงเส้นใบขอเฉพาะก้อนช่องทาง */
  const [pipe, setPipe] = useState<RequestPipelineResponse | null>(null);
  useEffect(() => {
    let alive = true;
    fetchRequestPipeline(range)
      .then((d) => alive && setPipe(d))
      .catch(() => alive && setPipe(null));
    return () => {
      alive = false;
    };
  }, [range, tick]);
  const leaders = useMemo(() => channelLeaders(pipe), [pipe]);

  return (
    <div className="space-y-6" data-testid="home-exec">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={win} onChange={setWin} />
          {moneyNow?.forcedBu && moneyNow.bu ? (
            <span className="text-sm text-muted-foreground">{trendBuLabel(moneyNow.bu)}</span>
          ) : (
            <Select value={bu ?? 'all'} onValueChange={(v) => setBu(v === 'all' ? null : v)}>
              <SelectTrigger className="h-10 w-44 bg-card" aria-label="เลือก BU">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก BU</SelectItem>
                {BU_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {trendBuLabel(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* ── 4 กล่องบนสุด (Visual control · เทียบช่วงก่อนหน้าเท่ากัน) ── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="exec-kpis">
        {/* เสียเงิน: ลูกค้าหักจริง กับ ตามสัญญา (สูงสุด) ตัวเท่ากัน — ไม่ให้ผู้บริหารจำแต่เลขเพดาน */}
        <Card variant="solid" className="space-y-3 p-4" data-testid="exec-money-tile">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <HandCoins className="h-4 w-4" aria-hidden />
            เสียเงิน
          </span>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ['ลูกค้าหักจริง', moneyNow ? moneyNow.customerFines.total : null, prevNow ? prevNow.customerFines.total : undefined, 'exec-money-actual'],
                ['ตามสัญญา (สูงสุด)', moneyNow ? total : null, prevTotal, 'exec-money-contract'],
              ] as const
            ).map(([label, v, before, id]) => {
              const pill = v != null && before !== undefined ? countPill(v, before, false) : null;
              return (
                <button
                  key={id}
                  type="button"
                  className="space-y-1 rounded-lg text-left hover:bg-muted/50"
                  data-testid={id}
                  disabled={!moneyNow}
                  onClick={() =>
                    id === 'exec-money-actual'
                      ? drill.open({ title: 'ลูกค้าหักจริง (ใบรับเงิน)', months: moneyNow?.customerFines.months ?? [] })
                      : openList('เสียเงินตามสัญญา', moneyRows())
                  }
                >
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="block text-2xl font-medium tabular-nums text-foreground">
                    <Num value={v} />
                  </span>
                  <span
                    className={cn(
                      'block text-xs tabular-nums',
                      pill?.tone === 'bad' ? TONE.danger.value : pill?.tone === 'good' ? TONE.success.value : 'text-muted-foreground',
                    )}
                  >
                    {pill ? `${pill.dir === 'up' ? '▲' : pill.dir === 'down' ? '▼' : ''} ${pill.text}` : 'บาท'}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="block text-xs text-muted-foreground">เทียบช่วงก่อนหน้าที่ยาวเท่ากัน</span>
        </Card>
        <KpiTile
          tone="warn"
          icon={Layers}
          label="เหลือหา (ใบขอจริง)"
          unit="ใบ"
          value={flow?.remainingRequests ?? 0}
          loading={!flow}
          liveKey={liveKey}
          pill={flow && prevNow ? countPill(flow.remainingRequests, prevNow.flow.remainingRequests, false) : null}
          foot={flow ? `${NUM.format(flow.remaining)} คน · ล่วงหน้าอีก ${feedReady ? NUM.format(preCount) : '—'} ใบ` : null}
          onClick={flow ? () => openList('เหลือหา', flowRows((f) => f.open)) : undefined}
        />
        <KpiTile
          tone="info"
          icon={Clock3}
          label="หาคนครบเฉลี่ย (นับจากวันคีย์)"
          unit="วัน"
          value={speed?.avg ?? 0}
          loading={!moneyNow}
          liveKey={liveKey}
          pill={speed?.avg != null && prevNow?.clocks.speed.avg != null ? countPill(speed.avg, prevNow.clocks.speed.avg, false) : null}
          foot={
            moneyNow
              ? `คิดจาก ${NUM.format(speed?.n ?? 0)} ใบที่หาครบในช่วงนี้ · ช้ากว่าที่ลูกค้าต้องการ ${late?.avg == null ? '—' : NUM.format(late.avg)} วัน`
              : null
          }
          onClick={
            moneyNow
              ? () =>
                  openList(
                    'ใบที่หาครบในช่วงนี้',
                    openReqs.filter((r) => r.clocked).sort((a, b) => (b.speedDays ?? 0) - (a.speedDays ?? 0)),
                    null,
                    'เรียงใช้เวลานานสุดก่อน',
                  )
              : undefined
          }
        />
        <Card variant="solid" className="space-y-3 p-4" data-testid="exec-ai-share">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Bot className="h-4 w-4" aria-hidden />
            AI ทำแทน (ของที่โทรแล้ว)
          </span>
          {rows.length === 0
            ? ['ติดตามคนเริ่มงาน', 'ติดตามส่งคนแทน', 'งานสรรหา', 'จับคู่งาน'].map((l) => (
                <div key={l} className="space-y-1">
                  <span className="flex justify-between text-xs text-muted-foreground">
                    {l}
                    <span>—</span>
                  </span>
                  <Progress value={0} className="h-1.5" />
                </div>
              ))
            : rows.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => openAi(AI_ROW_PICK[r.key] ?? 'follow')}
                  className="block w-full space-y-1 rounded-lg text-left hover:bg-muted/50"
                  data-testid={`exec-ai-${r.key}`}
                >
                  <span className="flex justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className={cn('font-medium tabular-nums', r.pct == null ? 'text-muted-foreground' : r.pct >= 100 ? TONE.success.value : 'text-foreground')}>
                      {r.pct == null ? '—' : `${r.pct}%`}
                    </span>
                  </span>
                  <Progress value={r.pct ?? 0} className="h-1.5" aria-label={`${r.label} AI ${r.pct ?? 0}%`} />
                </button>
              ))}
          <span className="block text-xs text-muted-foreground">เป้า 100%</span>
        </Card>
      </div>


      {/* ── ต้องรีบ ── */}
      <HomeSection title="ต้องรีบ" testId="exec-urgent">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <UrgentCard
            icon={HandCoins}
            title="เสียวันละมากสุด"
            total={costly.total}
            rows={costly.rows}
            loading={!moneyNow}
            right={(r) => `${BAHT.format(r.perDay)} บาท/วัน`}
            testId="exec-urgent-costly"
            onOpen={(x) => openList('เสียวันละมากสุด', rowsOf(costliest(openReqs, today, Infinity).rows), x)}
          />
          <UrgentCard
            icon={AlarmClock}
            title="ถึงวันที่ต้องการใน 3 วัน ยังขาดคน"
            total={soon.total}
            rows={soon.rows}
            loading={!moneyNow}
            right={(r) => (r.needYmd ? thaiDate(r.needYmd) : '—')}
            testId="exec-urgent-soon"
            onOpen={(x) => openList('ถึงวันที่ต้องการใน 3 วัน ยังขาดคน', rowsOf(dueSoon(openReqs, today, 3, Infinity).rows), x)}
          />
        </div>
        {/* ใบค้างนานผิดปกติ แยกไว้ ไม่เบียดใบที่ยังแก้ได้ (เงินยังนับ) */}
        <Collapsible open={staleOpen} onOpenChange={setStaleOpen} data-testid="exec-stale">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-auto justify-start gap-2 whitespace-normal px-0 text-left font-normal">
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', staleOpen && 'rotate-180')} aria-hidden />
              <span className="text-sm text-muted-foreground">
                ค้างเกิน {STALE_DAYS} วันไม่เคยได้คน {moneyNow ? NUM.format(stale.rows.length) : '—'} ใบ · เสียวันละ{' '}
                {moneyNow ? BAHT.format(stale.perDay) : '—'} บาท
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="divide-y divide-border">
              {stale.rows.map((r) => (
                <li
                  key={r.requestNo}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-lg py-2 text-sm hover:bg-muted/50"
                  onClick={() => openList(`ค้างเกิน ${STALE_DAYS} วันไม่เคยได้คน`, rowsOf(stale.rows), r.requestNo)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{[r.unit, r.position].filter(Boolean).join(' · ')}</span>
                    <span className="block text-xs tabular-nums text-muted-foreground">
                      {r.requestNo} · ต้องการ {r.needYmd ? thaiDate(r.needYmd) : '—'} · ขาด {NUM.format(r.missing)} คน
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-foreground">{BAHT.format(r.perDay)} บาท/วัน</span>
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </HomeSection>

      {/* ── ใครค้างเท่าไหร่ (เจ้าหน้าที่สรรหาของใบขอ) ── */}
      <HomeSection title="ใครค้างเท่าไหร่ · ใครปิดได้" sub="ค้าง = ณ วันนี้ · ปิดครบ/หาได้ = ในช่วงที่เลือก" testId="exec-owners">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    เจ้าหน้าที่
                  </span>
                </TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ค้าง (ใบ)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">เลยวันที่ต้องการ (ใบ)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ยังขาด (คน)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">เสียวันละ (บาท)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ปิดครบ (ใบ)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">หาได้ (คน)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {owners.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-4 text-center text-sm text-muted-foreground">
                    {moneyNow ? 'ไม่มีใบค้าง' : '—'}
                  </TableCell>
                </TableRow>
              ) : (
                (showAllOwners ? owners : owners.slice(0, 8)).map((o) => (
                  <TableRow
                    key={o.name}
                    data-testid="exec-owner-row"
                    className="cursor-pointer"
                    onClick={() =>
                      openList(
                        `ใบของ ${o.name}`,
                        openReqs
                          .filter((r) => (r.owner?.trim() || NO_OWNER) === o.name && (r.open || r.closedInWindow || r.filledInWindow > 0))
                          .sort((a, b) => Number(b.open) - Number(a.open) || perDayOf(b) - perDayOf(a)),
                        null,
                        `ค้าง ${NUM.format(o.requests)} · ปิดครบ ${NUM.format(o.closed)}`,
                      )
                    }
                  >
                    <TableCell className="text-sm text-foreground">{o.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(o.requests)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', o.overdue > 0 ? TONE.danger.value : 'text-muted-foreground')}>
                      {NUM.format(o.overdue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(o.missing)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{BAHT.format(o.perDay)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', o.closed > 0 ? TONE.success.value : 'text-muted-foreground')}>
                      {NUM.format(o.closed)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{NUM.format(o.filled)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {owners.length > 8 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAllOwners((v) => !v)} data-testid="exec-owners-more">
            {showAllOwners ? 'ซ่อน' : `ดูทั้งหมด ${NUM.format(owners.length)} คน`}
          </Button>
        ) : null}
      </HomeSection>


      {/* ── ช่องทางไหนได้ผล (3 อันดับต่อขั้น) ── */}
      <HomeSection title="ช่องทางไหนได้ผล" sub="ในช่วงที่เลือก · หน่วย: คน" testId="exec-channels">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {(
            [
              ['กรอกเยอะสุด', leaders?.registered],
              ['นัดได้เยอะสุด', leaders?.appointed],
              ['ลงงานได้เยอะสุด', leaders?.placed],
            ] as const
          ).map(([title, list]) => (
            <Card key={title} variant="solid" className="space-y-2 p-4">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{title}</span>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  onClick={() => {
                    setFoldRequests(true);
                    window.setTimeout(() => document.querySelector('[data-testid="req-channels"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 600);
                  }}
                >
                  ดูทุกช่องทาง
                </Button>
              </span>
              {!list ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : list.length === 0 ? (
                <p className="text-sm text-muted-foreground">0</p>
              ) : (
                <ol className="space-y-1">
                  {list.map((x, i) => (
                    <li key={x.name} className="flex justify-between gap-2 text-sm">
                      <span className="text-muted-foreground">
                        {i + 1}. <span className="text-foreground">{x.name}</span>
                      </span>
                      <span className="font-medium tabular-nums text-foreground">{NUM.format(x.value)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      </HomeSection>

      {/* ── AI กับคน: ถ้างานเพิ่ม ต้องใช้อย่างละเท่าไหร่ ── */}
      <HomeSection title="AI กับคน ถ้างานเพิ่ม" sub="คิดจากงานจริงในช่วงที่เลือก" testId="exec-scale">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ['คนลงผลวันละ', scale?.staffPerDay, 'รายการ'],
              ['เจ้าหน้าที่ที่ลงผล', scale?.staffPeople, 'คน'],
              ['คน 1 คนทำได้วันละ', scale?.perPersonDay, 'รายการ'],
              ['AI โทรได้ผลวันละ', scale?.aiPerDay, 'สาย'],
            ] as const
          ).map(([label, v, unit]) => (
            <Card key={label} variant="solid" className="space-y-1 rounded-xl p-3">
              <span className="block text-xs text-muted-foreground">{label}</span>
              <span className="block text-2xl font-medium tabular-nums text-foreground">
                <Num value={v} decimals={1} />
              </span>
              <span className="block text-xs text-muted-foreground">{unit}</span>
            </Card>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4" data-testid="exec-scale-calc">
          <span className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">งานเพิ่มวันละ</span>
            <span className="font-medium tabular-nums text-foreground">{NUM.format(extra)} รายการ</span>
          </span>
          <Slider value={[extra]} min={0} max={500} step={10} onValueChange={(v) => setExtra(v[0] ?? 0)} aria-label="งานเพิ่มวันละ" />
          <div className="grid grid-cols-2 gap-3">
            <Card variant="solid" className="space-y-1 rounded-xl p-3">
              <span className="block text-xs text-muted-foreground">ถ้าให้คนทำ ต้องเพิ่ม</span>
              <span className="block text-2xl font-medium tabular-nums text-foreground">
                {scale ? (peopleNeeded(extra, scale.perPersonDay) == null ? '—' : NUM.format(peopleNeeded(extra, scale.perPersonDay)!)) : '—'}
              </span>
              <span className="block text-xs text-muted-foreground">คน</span>
            </Card>
            <Card variant="solid" className="space-y-1 rounded-xl p-3">
              <span className="block text-xs text-muted-foreground">ถ้าให้ AI ทำ ต้องโทรเพิ่ม</span>
              <span className={cn('block text-2xl font-medium tabular-nums', TONE.success.value)}>{NUM.format(extra)}</span>
              <span className="block text-xs text-muted-foreground">สาย/วัน · ไม่ต้องเพิ่มคน</span>
            </Card>
          </div>
        </div>
      </HomeSection>

      {/* ── ใบขอเข้ามา · ปิด · เหลือ — สมการลงตัวทั้งหน่วยใบและหน่วยคน (เจ้าของ "บวกลบกันแล้วต้องเท่ากัน") ── */}
      <HomeSection title="ใบขอในช่วงนี้" sub="ใบขอจริงใน ERP" testId="exec-flow">
        {(
          [
            {
              unit: 'ใบ',
              id: 'req',
              cells: [
                ['ยกมา', flow?.carryInRequests, null, (f: FlowRole) => f.carry],
                ['ขอใหม่', flow?.newRequests, 'info', (f: FlowRole) => f.isNew],
                ['ปิดครบ', flow?.closedRequests, 'success', (f: FlowRole) => f.closed],
                ['ยกเลิก', flow?.cancelledRequests, 'neutral', (f: FlowRole) => f.cancelledReq],
                ['เหลือหา', flow?.remainingRequests, 'warn', (f: FlowRole) => f.open],
              ],
              sum: flow
                ? `ยกมา ${NUM.format(flow.carryInRequests)} + ขอใหม่ ${NUM.format(flow.newRequests)} − ปิดครบ ${NUM.format(flow.closedRequests)} − ยกเลิก ${NUM.format(flow.cancelledRequests)} = เหลือหา ${NUM.format(flow.remainingRequests)} ใบ`
                : '—',
            },
            {
              unit: 'คน',
              id: 'pos',
              cells: [
                ['ยกมา', flow?.carryIn, null, (f: FlowRole) => f.carryIn > 0],
                ['ขอใหม่', flow?.newPositions, 'info', (f: FlowRole) => f.newPositions > 0],
                ['หาได้', flow?.filled, 'success', (f: FlowRole) => f.filled > 0],
                ['ยกเลิก', flow?.cancelled, 'neutral', (f: FlowRole) => f.cancelled > 0],
                ['เหลือหา', flow?.remaining, 'warn', (f: FlowRole) => f.remaining > 0],
              ],
              sum: flow
                ? `ยกมา ${NUM.format(flow.carryIn)} + ขอใหม่ ${NUM.format(flow.newPositions)} − หาได้ ${NUM.format(flow.filled)} − ยกเลิก ${NUM.format(flow.cancelled)} = เหลือหา ${NUM.format(flow.remaining)} คน`
                : '—',
            },
          ] as const
        ).map((g) => (
          <div key={g.id} className="space-y-2" data-testid={`exec-flow-${g.id}`}>
            <p className="text-xs font-medium text-muted-foreground">จำนวน{g.unit}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {g.cells.map(([label, v, tone, pick]) => (
                <button
                  key={label}
                  type="button"
                  disabled={!flow}
                  onClick={() => openList(`${label} (${g.unit})`, flowRows(pick))}
                  className="rounded-xl text-left"
                  data-testid={`exec-flow-${g.id}-${label}`}
                >
                  <Card variant="solid" className="h-full space-y-1 rounded-xl p-3 transition-colors hover:bg-muted/50">
                    <span className="block text-xs text-muted-foreground">{label}</span>
                    <span className={cn('block text-2xl font-medium tabular-nums', tone ? TONE[tone].value : 'text-foreground')}>
                      <Num value={v} />
                    </span>
                  </Card>
                </button>
              ))}
            </div>
            <p className="text-xs tabular-nums text-muted-foreground" data-testid={`exec-flow-${g.id}-sum`}>
              {g.sum}
            </p>
          </div>
        ))}
        {/* เทียบกล่องงานได้เฉพาะช่วงที่จบวันนี้ (กล่องงานคือ ณ วันนี้) */}
        {range.to >= today ? (
          <p className="text-xs tabular-nums text-muted-foreground" data-testid="exec-flow-board">
            {flow && feedReady
              ? `เหลือหา ${NUM.format(flow.remainingRequests)} + ใบขอล่วงหน้า ${NUM.format(preCount)} = ${NUM.format(flow.remainingRequests + preCount)} ใบ (เท่ากล่องงาน)`
              : '—'}
          </p>
        ) : null}
      </HomeSection>

      {/* ── พับไว้ (ผู้บริหารไม่ต้องเลื่อนผ่าน) — กดแล้วกาง ── */}
      <Folded title="ใบขอค้าง · ประกาศ · ช่องทาง" testId="exec-fold-requests" open={foldRequests} onOpenChange={setFoldRequests}>
        <HomeRequestsTab win={win} tick={tick} />
      </Folded>
      <Folded title="เงินรายวัน · รายใบ" testId="exec-fold-money">
        <HomeMoneySection money={moneyNow} prev={prevNow} error={moneyError} />
      </Folded>

      {/* ── ติดตาม · ดูแลหลังเริ่มงาน (AI / คน / ยังไม่โทร) ── */}
      <HomeSection
        title="ติดตาม · ดูแลหลังเริ่มงาน"
        sub="หน่วย: รายชื่อ"
        testId="exec-follow"
        right={
          <Button type="button" variant="outline" size="sm" onClick={() => openAi('follow')}>
            ดูรายชื่อ
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(
            [
              ['ติดตามคนเริ่มงาน · ส่งคนแทน', ai?.follow ?? null, 'follow'],
              ['ดูแลหลังเริ่มงาน', ai?.aftercare ?? null, 'aftercare'],
            ] as const
          ).map(([title, c, pick]) => (
            <Card
              key={title}
              variant="solid"
              role="button"
              tabIndex={0}
              onClick={() => openAi(pick)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openAi(pick)}
              className="cursor-pointer space-y-3 p-4 transition-colors hover:bg-muted/50"
              data-testid={`exec-follow-${pick}`}
            >
              <span className="block text-sm font-medium text-foreground">{title}</span>
              <div className="grid grid-cols-4 gap-2">
                {(
                  [
                    ['ทั้งหมด', c?.total, null],
                    ['AI โทร', c?.ai, 'primary'],
                    ['คนโทร', c?.staff, 'violet'],
                    ['ยังไม่โทร', c?.notCalled, 'neutral'],
                  ] as const
                ).map(([label, v, tone]) => (
                  <div key={label} className="space-y-0.5">
                    <span className="block text-xs text-muted-foreground">{label}</span>
                    <span className={cn('block text-xl font-medium tabular-nums', tone ? TONE[tone].value : 'text-foreground')}>
                      {v == null ? '—' : NUM.format(v)}
                    </span>
                  </div>
                ))}
              </div>
              {c && c.total > 0 ? (
                <Progress value={Math.round((c.ai / c.total) * 100)} className="h-1.5" aria-label={`${title} AI ${Math.round((c.ai / c.total) * 100)}%`} />
              ) : (
                <Progress value={0} className="h-1.5" />
              )}
            </Card>
          ))}
        </div>
      </HomeSection>
      <Folded title="รายชื่อ · ติดตาม · ดูแล · ผู้สมัคร · จับคู่งาน · ทีม Online" testId="exec-fold-ai" open={foldAi} onOpenChange={setFoldAi}>
        <HomeAiSharePage embedded={{ win, bu, ...aiPick }} />
      </Folded>
      <ExecDrill drill={drill} all={openReqs} today={today} />
    </div>
  );
};

export default HomeExecPage;
