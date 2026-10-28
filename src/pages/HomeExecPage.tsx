/**
 * ═══ หน้าหลักผู้บริหาร — หน้าเดียวเลื่อนลง (เจ้าของ 24 ต.ค. 2569 · Choice "หน้าเดียวเลื่อนลง") ═══
 *
 * เจ้าของ: *"หน้าหลักต้องบอกได้ประมาณนี้"* — ใบขอเข้า/ปิด/เหลือ · ค้างนาน 5 ช่วง + ปิดกี่วัน · ค่าปรับ/ลดมูลค่า รายใบ ·
 * ประกาศ/ไม่ประกาศ · มีคนกรอก/ไม่มี · AI สนใจแต่คนยังไม่โทรต่อ · ช่องทาง · ติดตาม · ดูแลหลังเริ่มงาน · AI กับคนเท่าไหร่
 * *"ต้องมี visual control · Interactive graph เวลาเปลี่ยนกราฟวิ่งตาม"*
 *
 * ลำดับ (24 ต.ค. 2569 รอบ 2 "ผู้บริหารมีเวลา 30 วิ" — เจ้าของ "ทำเลย · คำอย่าเป็นภาษา AI"):
 *   4 กล่องบน → ต้องรีบ → งานของเจ้าหน้าที่ → ช่องทาง → ใบขอ → (พับไว้) เงินรายวัน/รายใบ → ติดตาม
 *   ค่าตั้งต้น = เดือนนี้ · กล่องเงินโชว์ "ลูกค้าหักจริง" กับ "ตามสัญญา (สูงสุด)" ขนาดเท่ากัน
 * ข้อมูล: `/api/home-money` (เงิน · นาฬิกา · สมการใบขอ) · `/api/request-pipeline` (ใบขอเปิด) · `/api/home-ai-share` (AI/คน)
 * 25 ต.ค. 2569 เจ้าของ "ยาวลงมา แยกแท็บแบบเดิมได้ไหม กันฉันงง" → Choice "แท็บเหมือนหน้าเก่า + แท็บภาพรวม":
 *   ภาพรวม (ของผู้บริหาร) · ใบขอ · ทีม Online · ติดตาม · ดูแลหลังเริ่มงาน · งานสรรหา · จับคู่งาน (ของหน้าแท็บเดิม ฝังด้วย `embedded`)
 *   ถอดส่วนคิดคน/AI เมื่องานเพิ่มออกจากหน้าหลัก · ใบค้างเกิน 90 วันขึ้นไปอยู่ในกล่องเสียเงิน
 * 🔴 ชั้นคู่ขนาน: หน้านี้คือค่าตั้งต้นของ `/` · `?home=new` ยังเปิดได้ถ้าพิมพ์เอง = ทางถอย
 */
import BuChoiceSelect from '@/components/shared/BuChoiceSelect';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlarmClock, Bot, Clock3, HandCoins, Layers, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PeriodPicker from '@/components/shared/PeriodPicker';
import { KpiTile } from '@/components/home-ai-share/HomeKpis';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import HomeRequestsTab from '@/components/home-ai-share/HomeRequestsTab';
import HomeOnlineTab from '@/components/home-ai-share/HomeOnlineTab';
import HomeMoneySection from '@/components/home-exec/HomeMoneySection';
import ExecDrill, { useDrill } from '@/components/home-exec/ExecDrill';
import Num from '@/components/home-exec/Num';
import ExecChannelChart, { type ChannelItem, type ChannelStage } from '@/components/home-exec/ExecChannelChart';
import type { MoneyRequest } from '@/lib/homeMoney';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import { usePageTitle } from '@/hooks/usePageTitle';
import { fetchHomeMoney, previousWindow, type HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { fetchHomeAiShare } from '@/lib/homeAiShareApi';
import { sharesOfCalled, type AiShareBlockKey, type AiShareResponse, type AiShareWindow } from '@/lib/homeAiShare';
import HomeAiSharePage from '@/pages/HomeAiSharePage';
import { byOwner, costliest, dueSoon, NO_OWNER, perDayOf, reasonsOf, thisMonthWindow, type OwnerRow, type UrgentRow } from '@/lib/homeExec';
import { fetchRequestPipeline } from '@/lib/requestPipelineApi';
import type { RequestPipelineResponse } from '@/lib/requestPipelineTypes';
import { channelInterestOf } from '@/lib/channelPlatforms';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CONVEYOR_VAULT, conveyorLabel } from '@/lib/soRecruitNav';
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

/** กดแถวในกล่อง AI = เปิดแท็บของเรื่องนั้นในส่วนรายชื่อ (ส่งคนแทนอยู่ในแท็บติดตาม แยกทีมในนั้น) */
const AI_ROW_PICK: Record<string, AiShareBlockKey> = { start: 'follow', replace: 'follow', applicants: 'applicants', matching: 'matching' };

/**
 * แท็บของหน้าหลัก — ภาพรวม (ผู้บริหาร) + แท็บชุดเดียวกับหน้าแท็บเดิม · ชื่อตามเมนู (`conveyorLabel`)
 * "ใบขอ" กับ "ทีม Online" เป็นเรื่องเดียวกัน ⇒ แท็บเดียวชื่อ "ใบขอ" มีของครบทั้งสองฝั่ง (เจ้าของ 25 ต.ค. 2569)
 */
type HomeTab = 'overview' | 'requests' | AiShareBlockKey;
const HOME_TABS: ReadonlyArray<{ key: HomeTab; label: string }> = [
  { key: 'overview', label: 'ภาพรวม' },
  { key: 'requests', label: 'ใบขอ' },
  { key: 'follow', label: conveyorLabel('follow') },
  { key: 'aftercare', label: conveyorLabel('aftercare') },
  { key: 'applicants', label: CONVEYOR_VAULT.find((v) => v.key === 'job-boxes')?.label ?? 'งานสรรหา' },
  { key: 'matching', label: conveyorLabel('matching') },
];
const isHomeTab = (v: string): v is HomeTab => HOME_TABS.some((t) => t.key === v);

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

/**
 * ยอดต่อช่องทาง ต่อขั้น (กรอก · นัดได้ · มาตามนัด · ลงงาน · เจ้าของ 25 ต.ค. 2569) — ชื่อช่องทางชุดเดียวกับตารางช่องทาง
 * 28 ต.ค. 2569 การ์ดเป็นกราฟเทียบ 4 ช่องทางหลัก (`ExecChannelChart`) ⇒ ส่งทุกช่องทาง ไม่ตัด 3 อันดับแล้ว
 */
function channelStages(d: RequestPipelineResponse | null): Record<ChannelStage, ChannelItem[]> | null {
  if (!d?.channels) return null;
  const interest = d.facts ? channelInterestOf(d.facts, d.window.from, d.window.to).byType : new Map();
  const rows = d.channels.rows.filter((r) => r.channel !== 'ไม่รู้ช่องทาง' && r.channel !== 'ไม่ระบุ');
  const all = (pick: (r: (typeof rows)[number]) => number): ChannelItem[] => rows.map((r) => ({ name: r.channel, value: pick(r) }));
  return {
    registered: all((r) => r.registered),
    appointed: all((r) => interest.get(r.channel)?.appointed ?? 0),
    showed: all((r) => interest.get(r.channel)?.showed ?? 0),
    placed: all((r) => r.placed),
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
                  <span className="line-clamp-2 text-sm text-foreground">{[r.unit, r.position].filter(Boolean).join(' · ')}</span>
                  {r.place ? (
                    <span className="flex items-start gap-1 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                      <span className="line-clamp-2">{r.place}</span>
                    </span>
                  ) : null}
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    {r.requestNo} · ขาด {NUM.format(r.missing)} คน · {r.owner}
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
        <Button type="button" variant="outline" className="h-auto w-full justify-between whitespace-normal rounded-xl py-2 text-left" aria-expanded={open}>
          {title}
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
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
  const moneyNow = money && money.window.from === range.from && money.window.to === range.to && (money.forcedBu || money.bu === bu || (bu === null && Boolean(money.buChoices))) ? money : null;
  const prevNow = moneyNow ? prevMoney : null;
  const flow = moneyNow?.flow ?? null;
  const total = moneyNow ? moneyNow.totals.need.fine + moneyNow.totals.need.deduct : 0;
  const prevTotal = prevNow ? prevNow.totals.need.fine + prevNow.totals.need.deduct : undefined;
  const speed = moneyNow?.clocks.speed ?? null;
  const upcoming = money?.aftercareUpcoming ?? null;
  const late = moneyNow?.clocks.late ?? null;
  /** คีย์คงที่ = เลขในกล่องวิ่งจากค่าเดิมไปค่าใหม่ทุกครั้ง รวมตอนเปลี่ยนช่วง/BU (เจ้าของ "Interactive ที่เวลาเปลี่ยนข้อมูล") */
  /**
   * เลขกล่องบน: ระหว่างโหลดช่วงใหม่ค้างเลขเดิม แล้ววิ่งไปเลขใหม่ · โหลดครั้งแรกขึ้นเลขจริงทันที ไม่วิ่งจาก 0
   * (25 ต.ค. 2569 — เปิดแท็บไว้เบื้องหลัง เลขค้าง 0 เพราะเบราว์เซอร์หยุดวาดภาพเคลื่อนไหว)
   */
  const lastKpi = useRef<HomeMoneyPayload | null>(null);
  if (moneyNow) lastKpi.current = moneyNow;
  const kpi = moneyNow ?? lastKpi.current;
  const liveKey = kpi ? 'exec' : 'exec-wait';
  const rows = aiRows(ai);
  const openReqs = useMemo(() => moneyNow?.requests ?? [], [moneyNow]);
  const costly = useMemo(() => costliest(openReqs, today), [openReqs, today]);
  const soon = useMemo(() => dueSoon(openReqs, today), [openReqs, today]);
  const owners = useMemo(() => byOwner(openReqs, today), [openReqs, today]);
  const drill = useDrill();
  /** แท็บที่เปิดอยู่ · `seq` = กดแท็บ AI เดิมซ้ำก็สั่งหน้าแท็บเดิมใหม่ได้ */
  const [tab, setTab] = useState<{ key: HomeTab; seq: number }>({ key: 'overview', seq: 0 });
  /** เปิดแท็บ แล้วเลื่อนไปจุดที่ต้องดู (ไม่ส่ง = ขึ้นบนสุดของแท็บ) */
  const goTab = (key: HomeTab, target?: string) => {
    setTab((t) => ({ key, seq: t.seq + 1 }));
    window.setTimeout(() => {
      const el = target ? document.querySelector(`[data-testid="${target}"]`) : document.querySelector('[data-testid="exec-tabs"]');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, target ? 600 : 50);
  };
  const openAi = (pick: AiShareBlockKey) => goTab(pick);
  /** "ลองใหม่" ของส่วนใบขอ (ของแท็บทีม Online เดิม) */
  const [retry, setRetry] = useState(0);
  const winQ = useMemo(() => ({ ...win, bu }), [win, bu]);
  const byNo = useMemo(() => new Map(openReqs.map((r) => [r.requestNo, r])), [openReqs]);
  const rowsOf = (list: ReadonlyArray<{ requestNo: string }>): MoneyRequest[] =>
    list.map((x) => byNo.get(x.requestNo)).filter((r): r is MoneyRequest => Boolean(r));
  const openList = (title: string, rows: MoneyRequest[], expand: string | null = null, sub?: string) => drill.open({ title, rows, expand, sub });
  const moneyRows = () =>
    openReqs
      .filter((r) => r.amount.need.fine + r.amount.need.deduct > 0)
      .sort((a, b) => b.amount.need.fine + b.amount.need.deduct - (a.amount.need.fine + a.amount.need.deduct));
  const openOwner = (o: OwnerRow) =>
    openList(
      `ใบของ ${o.name}`,
      openReqs
        .filter((r) => (r.owner?.trim() || NO_OWNER) === o.name && (r.open || r.closedInWindow || r.filledInWindow > 0))
        .sort((a, b) => Number(b.open) - Number(a.open) || perDayOf(b) - perDayOf(a)),
      null,
      `ถือ ${NUM.format(o.requests)} ใบ · ปิดได้ ${NUM.format(o.closed)} ใบ`,
    );
  const flowRows = (pick: (f: NonNullable<MoneyRequest['flow']>) => boolean) => openReqs.filter((r) => r.flow && pick(r.flow));
  /** แถวรวมของตารางเจ้าหน้าที่ — เสียวันละรวม = กล่องเสียเงิน */
  const ownerSum = useMemo(
    () =>
      owners.reduce(
        (a, o) => ({ requests: a.requests + o.requests, overdue: a.overdue + o.overdue, missing: a.missing + o.missing, perDay: a.perDay + o.perDay, closed: a.closed + o.closed, filled: a.filled + o.filled }),
        { requests: 0, overdue: 0, missing: 0, perDay: 0, closed: 0, filled: 0 },
      ),
    [owners],
  );
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
  const stages = useMemo(() => channelStages(pipe), [pipe]);

  return (
    <div className="space-y-6" data-testid="home-exec">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={win} onChange={setWin} />
          {kpi?.buChoices?.length ? (
            /* ดูได้หลาย BU — เลือกทีละ BU ในสิทธิ์ (26 ต.ค. 2569) */
            <BuChoiceSelect value={bu ?? kpi.bu} choices={kpi.buChoices} onChange={setBu} triggerClassName="h-10 w-44 bg-card" />
          ) : moneyNow?.forcedBu && moneyNow.bu ? (
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

      {/* ── แท็บ (เจ้าของ 25 ต.ค. 2569 "แยกแท็บแบบเดิม กันฉันงง") — ภาพรวม + แท็บชุดเดียวกับหน้าแท็บเดิม ── */}
      <Tabs value={tab.key} onValueChange={(v) => isHomeTab(v) && goTab(v)}>
        <TabsList variant="glass" aria-label="เลือกแท็บ" className="h-auto flex-wrap justify-start gap-1 rounded-2xl" data-testid="exec-tabs">
          {HOME_TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="h-10 px-5 text-sm" data-testid={`exec-tab-${t.key}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* แถบต้องทำเหนือแท็บงาน ถอดแล้ว 28 ต.ค. 2569 (เจ้าของ "เอาออก") */}

      {tab.key === 'overview' ? (
      <>
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
          {/* 28 ต.ค. 2569 เจ้าของ "เอาออก" — บรรทัดใบที่เลยวัน · ค้างเกิน 90 วัน · เทียบช่วงก่อน ถอดจากการ์ดเสียเงิน */}
        </Card>
        <KpiTile
          tone="warn"
          icon={Layers}
          label="เหลือหา (ใบขอจริง)"
          unit="ใบ"
          value={kpi?.flow.remainingRequests ?? 0}
          loading={!kpi}
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
          value={kpi?.clocks.speed.avg ?? 0}
          loading={!kpi}
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
            title="ใบที่โดนค่าปรับ"
            total={costly.total}
            rows={costly.rows}
            loading={!moneyNow}
            right={(r) => `${BAHT.format(r.perDay)} บาท/วัน`}
            testId="exec-urgent-costly"
            onOpen={(x) => openList('ใบที่โดนค่าปรับ', rowsOf(costliest(openReqs, today, Infinity).rows), x)}
          />
          <UrgentCard
            icon={AlarmClock}
            title="ใกล้ถึงวันที่ต้องการ"
            total={soon.total}
            rows={soon.rows}
            loading={!moneyNow}
            right={(r) => (r.needYmd ? thaiDate(r.needYmd) : '—')}
            testId="exec-urgent-soon"
            onOpen={(x) => openList('ใกล้ถึงวันที่ต้องการ', rowsOf(dueSoon(openReqs, today, 3, Infinity).rows), x)}
          />
        </div>
      </HomeSection>

      {/* ── ใครค้างเท่าไหร่ (เจ้าหน้าที่สรรหาของใบขอ) ── */}
      {/* เจ้าของ 25 ต.ค. 2569 ชื่อเดิมอ่านแล้วงง → "งานของเจ้าหน้าที่" + หัวตารางเป็นคำเต็ม */}
      <HomeSection title="งานของเจ้าหน้าที่" testId="exec-owners">
        {/* มือถือ: ตาราง 7 ช่องล้นจอ (เห็นแค่ 2 ช่องแรก · ตรวจ 25 ต.ค. 2569) ⇒ คนละแถว เลขครบทุกช่อง */}
        <ul className="divide-y divide-border sm:hidden" data-testid="exec-owners-phone">
          {owners.length === 0 ? (
            <li className="py-4 text-center text-sm text-muted-foreground">{moneyNow ? 'ไม่มีใบค้าง' : '—'}</li>
          ) : (
            (showAllOwners ? owners : owners.slice(0, 8)).map((o) => (
              <li key={o.name}>
                <button type="button" className="w-full space-y-1 rounded-lg py-2 text-left hover:bg-muted/50" onClick={() => openOwner(o)}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{o.name}</span>
                    <span className="text-sm font-medium tabular-nums text-foreground">{BAHT.format(o.perDay)} บาท/วัน</span>
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">
                    ถือ {NUM.format(o.requests)} ใบ · <span className={o.overdue > 0 ? TONE.danger.value : undefined}>เลยวัน {NUM.format(o.overdue)} ใบ</span> · ยังขาด{' '}
                    {NUM.format(o.missing)} คน · <span className={o.closed > 0 ? TONE.success.value : undefined}>ปิดได้ {NUM.format(o.closed)} ใบ</span> · หาได้{' '}
                    {NUM.format(o.filled)} คน
                  </span>
                </button>
              </li>
            ))
          )}
          {owners.length > 0 ? (
            <li className="flex items-baseline justify-between gap-3 py-2 text-sm font-medium tabular-nums text-foreground" data-testid="exec-owner-sum-phone">
              <span>รวม · เลยวัน {NUM.format(ownerSum.overdue)} ใบ</span>
              <span>{BAHT.format(ownerSum.perDay)} บาท/วัน</span>
            </li>
          ) : null}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" aria-hidden />
                    เจ้าหน้าที่
                  </span>
                </TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ใบที่ถือ</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ใบที่เลยวัน</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">คนที่ยังขาด</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">เสียเงินวันละ (บาท)</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">ใบที่ปิดได้</TableHead>
                <TableHead className="whitespace-nowrap text-right text-xs">คนที่หาได้</TableHead>
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
                    onClick={() => openOwner(o)}
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
              {owners.length > 0 ? (
                <TableRow className="border-t-2 font-medium hover:bg-transparent" data-testid="exec-owner-sum">
                  <TableCell className="text-sm text-foreground">รวม</TableCell>
                  <TableCell className="text-right tabular-nums">{NUM.format(ownerSum.requests)}</TableCell>
                  <TableCell className="text-right tabular-nums">{NUM.format(ownerSum.overdue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{NUM.format(ownerSum.missing)}</TableCell>
                  <TableCell className="text-right tabular-nums">{BAHT.format(ownerSum.perDay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{NUM.format(ownerSum.closed)}</TableCell>
                  <TableCell className="text-right tabular-nums">{NUM.format(ownerSum.filled)}</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        {owners.length > 8 ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAllOwners((v) => !v)} data-testid="exec-owners-more">
            {showAllOwners ? 'ซ่อน' : `ดูทั้งหมด ${NUM.format(owners.length)} คน`}
          </Button>
        ) : null}
      </HomeSection>


      {/* ── ช่องทางไหนได้ผล — กราฟเทียบ 4 ช่องทางหลัก · เลือกขั้นจาก Dropdown · กดแท่งดูช่องทางรอง (28 ต.ค. 2569) ── */}
      <ExecChannelChart stages={stages} onSeeAll={() => goTab('requests', 'req-channels')} />

      {/* ── ใบขอ: ยกมา · ขอใหม่ · ปิดครบ · ยกเลิก · เหลือหา — ใบกับคนอยู่กล่องเดียวกัน (เจ้าของ 25 ต.ค. 2569) ──
           สมการลงตัวทั้งหน่วยใบและหน่วยคน (เจ้าของ "บวกลบกันแล้วต้องเท่ากัน") · กดกล่อง = รายใบชุดเดียวกับเลขใบ */}
      <HomeSection title="ใบขอ" sub="ใบขอจริงใน ERP" testId="exec-flow">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" data-testid="exec-flow-req">
          {(
            [
              ['ยกมา', flow?.carryInRequests, flow?.carryIn, '', null, (f: FlowRole) => f.carry],
              ['ขอใหม่', flow?.newRequests, flow?.newPositions, '', 'info', (f: FlowRole) => f.isNew],
              ['ปิดครบ', flow?.closedRequests, flow?.filled, 'หาได้ ', 'success', (f: FlowRole) => f.closed],
              ['ยกเลิก', flow?.cancelledRequests, flow?.cancelled, '', 'neutral', (f: FlowRole) => f.cancelledReq],
              ['เหลือหา', flow?.remainingRequests, flow?.remaining, '', 'warn', (f: FlowRole) => f.open],
            ] as const
          ).map(([label, reqs, people, peoplePrefix, tone, pick]) => (
            <button
              key={label}
              type="button"
              disabled={!flow}
              onClick={() => {
                const list = flowRows(pick);
                // ยกเลิก = แยกเหตุผลก่อน กดเหตุผลแล้วค่อยลงไปดูรายใบ (เจ้าของ 25 ต.ค. 2569)
                if (label === 'ยกเลิก') {
                  drill.open({ title: 'ยกเลิก', rows: list, expand: null, reasons: { unit: 'ใบ', items: reasonsOf(list, () => 1) } });
                } else openList(label, list);
              }}
              className="rounded-xl text-left"
              data-testid={`exec-flow-req-${label}`}
            >
              <Card variant="solid" className="h-full space-y-1 rounded-xl p-3 transition-colors hover:bg-muted/50">
                <span className="block text-xs text-muted-foreground">{label}</span>
                <span className={cn('block text-2xl font-medium tabular-nums', tone ? TONE[tone].value : 'text-foreground')}>
                  <Num value={reqs} /> <span className="text-sm font-normal text-muted-foreground">ใบ</span>
                </span>
                <span className="block text-xs tabular-nums text-muted-foreground">
                  {peoplePrefix}
                  <Num value={people} /> คน
                </span>
              </Card>
            </button>
          ))}
        </div>
        <div className="space-y-1 text-xs tabular-nums text-muted-foreground">
          <p data-testid="exec-flow-req-sum">
            {flow
              ? `ยกมา ${NUM.format(flow.carryInRequests)} + ขอใหม่ ${NUM.format(flow.newRequests)} − ปิดครบ ${NUM.format(flow.closedRequests)} − ยกเลิก ${NUM.format(flow.cancelledRequests)} = เหลือหา ${NUM.format(flow.remainingRequests)} ใบ`
              : '—'}
          </p>
          <p data-testid="exec-flow-pos-sum">
            {flow
              ? `ยกมา ${NUM.format(flow.carryIn)} + ขอใหม่ ${NUM.format(flow.newPositions)} − หาได้ ${NUM.format(flow.filled)} − ยกเลิก ${NUM.format(flow.cancelled)} = เหลือหา ${NUM.format(flow.remaining)} คน`
              : '—'}
          </p>
          {/* เทียบกล่องงานได้เฉพาะช่วงที่จบวันนี้ (กล่องงานคือ ณ วันนี้) */}
          {range.to >= today ? (
            <p data-testid="exec-flow-board">
              {flow && feedReady
                ? `เหลือหา ${NUM.format(flow.remainingRequests)} + ใบขอล่วงหน้า ${NUM.format(preCount)} = ${NUM.format(flow.remainingRequests + preCount)} ใบ (เท่ากล่องงาน)`
                : '—'}
            </p>
          ) : null}
        </div>
      </HomeSection>

      {/* ── พับไว้ (ผู้บริหารไม่ต้องเลื่อนผ่าน) — กดแล้วกาง ── */}
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
              {/* ดูแลหลังเริ่มงาน: 0 ในช่วงแต่มีสายนัดไว้ = ยังไม่ถึงคิว ไม่ใช่ระบบพัง (เจ้าของ 25 ต.ค. 2569) */}
              {pick === 'aftercare' ? (
                <span className="block text-xs tabular-nums text-muted-foreground" data-testid="exec-aftercare-upcoming">
                  {upcoming == null
                    ? 'รอโทร —'
                    : upcoming.calls > 0 && upcoming.firstAt
                      ? `รอโทร ${NUM.format(upcoming.calls)} สาย · เริ่ม ${thaiDate(toYmdBangkok(new Date(upcoming.firstAt)))}`
                      : 'รอโทร 0 สาย'}
                </span>
              ) : null}
            </Card>
          ))}
        </div>
      </HomeSection>
      </>
      ) : null}

      {/* ── แท็บชุดเดียวกับหน้าแท็บเดิม (ของเดิมครบ ไม่เขียนซ้ำ) ── */}
      {tab.key === 'requests' ? (
        <div className="space-y-5" data-testid="exec-requests-body">
          <HomeOnlineTab q={winQ} tick={tick + retry} onRetry={() => setRetry((n) => n + 1)} />
          <HomeRequestsTab win={win} tick={tick} />
        </div>
      ) : null}
      {tab.key !== 'overview' && tab.key !== 'requests' ? (
        <div data-testid="exec-tab-body">
          <HomeAiSharePage embedded={{ win, bu, pick: tab.key, seq: tab.seq }} />
        </div>
      ) : null}
      <ExecDrill drill={drill} all={openReqs} today={today} />
    </div>
  );
};

export default HomeExecPage;
