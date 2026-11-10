/**
 * ═══ หน้าหลักสรุปหน้าเดียว (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"หน้าหลักคือต้องบอกภาพรวมของการทำงานทั้งระบบ แล้วอยากรู้ลึก ๆ ก็กดเพิ่มเพื่อไปดูของหน้านั้น ๆ ได้เลย"*
 * Choice ที่เคาะ: บนลงล่าง ซ้ายไปขวา · มี Visual Control + Interactive · สีแดง/เหลือง/เขียวเฉดเรียบ · ถอดแท็บ ·
 * กดตัวเลข = แผงข้าง + ปุ่มไปหน้าเต็ม · ค่าเริ่ม = เดือนนี้ · แถบช่องทางใต้ทุกขั้น (iRecruit แท่งแยก) ·
 * "ลงงาน" อยู่ก้อนใบขอ (ใบแจ้งเข้า ERP ต่อท้ายเส้นผู้สมัครไม่ได้) · ประเภทใบขอดูในแผงตอนกด "ขอใหม่"
 * ภาพตัวอย่างที่เจ้าของดูก่อนสร้าง: https://claude.ai/artifact/PsMLRYXb9T3rKxruRnSxZf
 * ลำดับ: ตอนนี้ (4 กล่อง) → ใบขอ → ใบขอใหม่ประกาศแค่ไหน → ผู้สมัคร 6 ขั้น → ติดตาม · ดูแลหลังเริ่มงาน
 * ข้อมูล: `/api/home-money` (เงิน · สมการใบขอ) · `/api/recruit-overview` (ประกาศ · ผู้สมัคร · งานค้าง) ·
 *        `/api/home-ai-share?summary=lumos` (ติดตาม) — ทุกเลขชุดเดียวกับหน้าที่ปุ่ม "ไปหน้าเต็ม" พาไป
 *        (10 พ.ย. 2569 เลิกดึง `/api/home-ai-share` ก้อนหลัก — ไม่มีการ์ดไหนใช้แล้ว แต่กินเวลา ~3 วิทุกครั้งที่เปิดหน้า)
 * 🔴 ชั้นคู่ขนาน: หน้าหลักผู้บริหารแบบแท็บเดิมยังเปิดได้ที่ `?home=exec` (ทางถอย · `HomeExecPage.tsx`)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProportionTab from '@/components/home-overview/ProportionTab';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PeriodPicker from '@/components/shared/PeriodPicker';
import BuChoiceSelect from '@/components/shared/BuChoiceSelect';
import ExecDrill, { useDrill } from '@/components/home-exec/ExecDrill';
import JourneyNamesDialog from '@/components/dashboard-trends/JourneyNamesDialog';
import FollowNamesDialog from '@/components/home-overview/FollowNamesDialog';
import type { FollowBucketKey } from '@/lib/homeLumosSummary';
import {
  ChannelLegend,
  ChannelStrip,
  ChannelTable,
  NUM,
  OverviewBarRow,
  OverviewNode,
  OverviewSection,
  OverviewSheet,
  PanelRows,
  type OverviewPanel,
} from '@/components/home-overview/OverviewParts';
import { useHomeLumosSummary, FOLLOW_RESULT_COLS } from '@/components/home-ai-share/AiShareLumosStats';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import { fetchHomeMoney, type HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { fetchHomeAiShare } from '@/lib/homeAiShareApi';
import AiShareListDialog from '@/components/home-ai-share/AiShareListDialog';
import RequestListPanel from '@/components/home-overview/RequestListPanel';
import { AI_SHARE_UNIT, type AiShareResponse, type AiShareWindow } from '@/lib/homeAiShare';
import { costliest, perDayOf, reasonsOf, thisMonthWindow } from '@/lib/homeExec';
import type { MoneyRequest } from '@/lib/homeMoney';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { appsInWindow, buildApplicantFunnel, type FunnelStep } from '@/lib/homeOverviewFunnel';
import { followBuSplit, followCallsMade, followPersonResults, followResultSplit, followTeamTotals } from '@/lib/homeSplit';
import { REQUEST_LEAD_KIND_LABEL, requestLeadKindFromYmd, type RequestLeadKind } from '@/lib/requestLeadKind';
import { SITE_BU_TO_DEPT, normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from '@/lib/trends/bu';
import { toYmdBangkok } from '@/lib/dateTh';
import { thaiDate } from '@/lib/periodPick';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Banknote, FileText, Phone, Users } from 'lucide-react';
import { V5Bar, V5Card, V5Divider, V5EqCell, V5Kpi, V5NumLink, useV5ThemeStyle, v5Num } from '@/components/so-recruit-v5/V5Parts';
import { homeWindowFromParams, homeWindowToParams, requestPathOfJobId, withRange } from '@/lib/jobNavigation';
import BuTrendTable from '@/components/so-recruit-v5/BuTrendTable';
import { fetchRecruitStuck } from '@/lib/recruitStuckApi';
import { STUCK_REASON_LABEL } from '@/lib/recruitStuck';
import { PREQUEST_LEDGER_PREFIX, ledgerJobIdOf } from '@/lib/requestPenaltyLedger';
import type { RecruitRequestItem } from '@/lib/recruitOverviewTypes';

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const BU_OPTIONS = [...new Set(Object.values(SITE_BU_TO_DEPT))];
// โหลดใหม่เองทุก 5 นาที (เจ้าของ 9 พ.ย. 2569 "ตามร่างทั้งหมด" · หน้าโหลดช้า — เดิมทุก 1 นาที)
const LIVE_MS = 5 * 60_000;
const ALL_FROM = '2024-01-01';

/** หน้าเต็มของแต่ละเรื่อง — ปุ่ม "ไปหน้าเต็ม" ในแผง */
const PAGE = {
  requests: { label: 'ใบขอ', to: '/jobs/list' },
  board: { label: 'งานสรรหา › โพสต์ประกาศ', to: '/jobs/board' },
  applicants: { label: 'งานสรรหา › ผู้สมัคร', to: '/jobs/board?view=list' },
  contact: { label: 'งานสรรหา › การติดต่อ', to: '/jobs/board?view=contact' },
  appointments: { label: 'งานสรรหา › ติดตามนัดหมาย', to: '/jobs/board?view=appointments' },
  follow: { label: 'ติดตาม', to: '/follow' },
  aftercare: { label: 'ดูแลหลังเริ่มงาน', to: '/aftercare' },
} as const;

/** ขั้นของเส้นผู้สมัคร → หน้าเต็ม */
const STEP_PAGE: Record<FunnelStep['key'], (typeof PAGE)[keyof typeof PAGE]> = {
  applied: PAGE.applicants,
  ai: PAGE.applicants,
  interested: PAGE.applicants,
  staff: PAGE.contact,
  reached: PAGE.contact,
  booked: PAGE.appointments,
};

const toneOfRow = (t: 'success' | 'warn' | 'danger' | 'neutral') => (t === 'neutral' ? null : t);
/** สีของผลติดตาม — ไป เขียว · ไม่ไป แดง · โทรไม่ติด/ขอเลื่อน เหลือง · ที่เหลือเทา */


/** เวลาไทย HH:MM ของคำตอบ */
const TIME_TH = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const shortTimeOf = (iso: string) => TIME_TH.format(new Date(iso));

const HomeOverviewPage: React.FC<{
  /** `v5` = โฉมต้นแบบ SO Recruit (เจ้าของ 10 พ.ย. 2569 ชุดส่งต่อ · `?home=v5`) — ข้อมูล/การกดชุดเดียวกัน ต่างแค่หน้าตา */
  layout?: 'overview' | 'v5';
}> = ({ layout = 'overview' }) => {
  usePageTitle('หน้าหลัก');
  const v5 = layout === 'v5';
  const v5Style = useV5ThemeStyle();
  const navigate = useNavigate();
  const today = toYmdBangkok(new Date());
  /**
   * ช่วง/BU อยู่ในลิงก์ (ชุดส่งต่อ G01 · เฉพาะโฉมต้นแบบ) — ส่งลิงก์ให้คนอื่น/กดย้อนกลับ ได้ช่วงเดิม
   * `from=all` = ทั้งหมด · ไม่ครบ/ผิดรูป = เดือนนี้ (ไม่เดา) · BU จากลิงก์ฝั่ง server ยังบังคับสิทธิ์ตามเดิม
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const [win, setWin] = useState<AiShareWindow>(() => (v5 ? homeWindowFromParams(searchParams, today) : null) ?? thisMonthWindow(today));
  const [tab, setTab] = useState<'overview' | 'proportion'>('overview');
  const [bu, setBu] = useState<string | null>(() => (v5 ? searchParams.get('bu')?.trim() || null : null));
  useEffect(() => {
    if (!v5) return;
    setSearchParams((prev) => homeWindowToParams(prev, win, bu), { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- เขียนตามช่วง/BU ที่เลือกเท่านั้น
  }, [v5, win, bu]);
  const tick = useLiveTick(true, LIVE_MS);
  const range = useMemo(() => ({ from: win.from ?? ALL_FROM, to: win.to ?? today }), [win, today]);
  const winQ = useMemo(() => ({ ...win, bu }), [win, bu]);

  // ── เงิน · สมการใบขอ ──
  const [money, setMoney] = useState<HomeMoneyPayload | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [ro, setRo] = useState<RecruitOverviewResponse | null>(null);
  const [roError, setRoError] = useState<string | null>(null);
  const [aiV5, setAiV5] = useState<AiShareResponse | null>(null);
  const [aiV5Error, setAiV5Error] = useState<string | null>(null);
  /** เลขชุดล่าสุดของช่วง/BU ที่เลือกอยู่ — กันจอกระพริบตอนรอบสด (ล้างทันทีเมื่อเปลี่ยนช่วง/BU) */
  const lastMoney = useRef<{ key: string; m: HomeMoneyPayload } | null>(null);
  /** เปลี่ยนช่วง/BU = ล้างเลขของชุดก่อนทันที (QA 30 ต.ค. 2569: สลับ BU แล้วเลข BU เก่าค้าง 1–8 วิ) · รอบสดชุดเดิมไม่ล้าง */
  const dataKey = `${range.from}|${range.to}|${bu ?? ''}`;
  const shownKey = useRef(dataKey);
  useEffect(() => {
    let alive = true;
    if (shownKey.current !== dataKey) {
      shownKey.current = dataKey;
      setMoney(null);
      setRo(null);
      setAiV5(null);
    }
    setMoneyError(null);
    fetchHomeMoney({ ...range, bu })
      .then((m) => alive && setMoney(m))
      .catch((e: unknown) => alive && setMoneyError(friendlyErrorText(e, 'โหลดยอดเงินไม่ขึ้น')));
    // โฉมต้นแบบ: ดูแลหลังเริ่มงาน · จับคู่งาน (ก้อนหลัก home-ai-share) — หน้าหลักเดิมไม่ใช้ จึงยิงเฉพาะ v5
    // รอบสดชุดเดิมไม่ล้างเลข (กันกระพริบ "—" ทุกรอบ) · ล้ม = บอกว่าอ่านไม่ได้ ไม่ใช้ 0 · รอบสดถัดไปลองใหม่เอง
    if (v5) {
      fetchHomeAiShare({ ...win, bu })
        .then((d) => {
          if (!alive) return;
          setAiV5(d);
          setAiV5Error(null);
        })
        .catch((e: unknown) => alive && setAiV5Error(friendlyErrorText(e, 'โหลดยอดดูแลหลังเริ่มงาน/จับคู่งานไม่ขึ้น')));
    }
    fetchRecruitOverview(null, range, bu)
      .then((d) => {
        if (!alive) return;
        setRo(d);
        setRoError(null);
      })
      .catch((e: unknown) => alive && setRoError(friendlyErrorText(e, 'โหลดข้อมูลผู้สมัครไม่ขึ้น')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey มาจาก range/bu ชุดเดียวกัน
  }, [range, win, bu, tick]);
  const lumos = useHomeLumosSummary('follow', winQ, tick);
  const feed = useUnitRequestsFeed();
  /** ใบขอชั่วคราว (ทีมคีย์เอง) ของ BU ที่เลือก — QA 30 ต.ค. 2569: เดิมขึ้น 17 ทุก BU */
  const preCount = feed.jobs.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX) && (!bu || (trendBuFromSiteCode(j.site_code) ?? normalizeTrendBu(j.department_code)) === bu)).length;
  /** ใบขอที่เปิดอยู่ — แท็บสัดส่วนใช้บอกเหตุ "ใบขอปิดแล้ว" · เส้นใบขอยังไม่พร้อม = null (ไม่เดาว่าปิด) */
  const openJobIds = useMemo(
    () => (feed.feedState === 'ready' ? new Set(feed.jobs.map((j) => String(j.id))) : null),
    [feed.feedState, feed.jobs],
  );

  // เปลี่ยนช่วง/BU แล้วเลขเก่าห้ามค้าง
  const moneyNow =
    money && money.window.from === range.from && money.window.to === range.to && (money.forcedBu || money.bu === bu || (bu === null && Boolean(money.buChoices)))
      ? money
      : null;
  if (moneyNow) lastMoney.current = { key: dataKey, m: moneyNow };
  // ชุดล่าสุดใช้ได้เฉพาะช่วง/BU เดียวกัน — เปลี่ยน BU แล้วเลขเก่าห้ามโผล่แม้แต่เฟรมเดียว
  const kpi = moneyNow ?? (lastMoney.current?.key === dataKey ? lastMoney.current.m : null);
  /** ตัวเลือก BU ไม่ขึ้นกับ BU ที่เลือก — คงไว้ระหว่างโหลด ไม่ให้ช่องเลือกกระพริบ */
  const buChoicesRef = useRef<string[] | null>(null);
  if (kpi?.buChoices?.length) buChoicesRef.current = kpi.buChoices;
  const buChoices = buChoicesRef.current;
  const flow = moneyNow?.flow ?? null;
  const contract = moneyNow ? moneyNow.totals.need.fine + moneyNow.totals.need.deduct : null;
  const openReqs = useMemo(() => moneyNow?.requests ?? [], [moneyNow]);
  const costlyAll = useMemo(() => costliest(openReqs, today, Infinity), [openReqs, today]);
  const perDayTotal = useMemo(() => costlyAll.rows.reduce((n, r) => n + r.perDay, 0), [costlyAll]);
  const byNo = useMemo(() => new Map(openReqs.map((r) => [r.requestNo, r])), [openReqs]);
  const rowsOf = (list: ReadonlyArray<{ requestNo: string }>): MoneyRequest[] =>
    list.map((x) => byNo.get(x.requestNo)).filter((r): r is MoneyRequest => Boolean(r));
  const flowRows = (pick: (f: NonNullable<MoneyRequest['flow']>) => boolean) => openReqs.filter((r) => r.flow && pick(r.flow));

  // ── ผู้สมัคร ──
  const roNow = ro && ro.window.from === range.from && ro.window.to === range.to && ro.bu === bu ? ro : null;
  const apps = useMemo(() => (roNow?.apps ? appsInWindow(roNow.apps, range.from, range.to) : null), [roNow, range]);
  const funnel = useMemo(() => (apps ? buildApplicantFunnel(apps) : null), [apps]);
  const backlog = roNow?.backlog ?? null;

  // ── ติดตาม ──
  const cells = lumos.current?.followByBu ?? null;
  const liveCells = useMemo(() => (cells ? cells.filter((c) => c.bucket !== 'cancelled') : null), [cells]);
  const followResults = useMemo(
    () => (liveCells ? followResultSplit(liveCells, FOLLOW_RESULT_COLS.filter((c) => c.key !== 'cancelled')) : []),
    [liveCells],
  );
  const followBus = useMemo(() => (liveCells ? followBuSplit(liveCells) : []), [liveCells]);
  const teams = useMemo(() => (liveCells ? followTeamTotals(liveCells) : null), [liveCells]);
  const followLive = followResults.reduce((n, r) => n + r.total, 0);
  const followCancelled = cells ? cells.reduce((n, c) => n + (c.bucket === 'cancelled' ? c.n : 0), 0) : 0;
  // คน + สาย (เจ้าของ 29 ต.ค. 2569 "264 คือคนหรือสาย … กี่คน กี่สาย ไปกี่คน ไม่ไปกี่คน")
  const people = lumos.current?.followPeople ?? null;
  const personRows = useMemo(
    () => (people && liveCells ? followPersonResults(people, liveCells, FOLLOW_RESULT_COLS.filter((c) => c.key !== 'cancelled')) : []),
    [people, liveCells],
  );
  const peopleTotal = personRows.reduce((n, r) => n + r.people, 0);
  const wentPeople = personRows.find((r) => r.key === 'went')?.people ?? 0;

  // ── แผง ──
  const drill = useDrill();
  /**
   * ใบนี้ถึงขั้นไหน (เจ้าของ 10 พ.ย. 2569 "กดที่ใบนั้นๆก็พาไปดูว่าตอนนี้ถึงขั้นตอนไหน เช่น มีคนแล้วรอคนโทรนะ")
   * ตัวตัดสินเดียวกับภาพรวม "ติดตรงไหน" (`/api/recruit-stuck` · `stuckReasonOf`) · โหลดตอนเปิดรายใบครั้งแรกของช่วง/BU
   * จับคู่ด้วย jobId เต็ม (siamraj-sql / siamraj-pre) ไม่ใช้เลขใบอย่างเดียว · ใบที่จบแล้ว = ไม่มีขั้น
   */
  const [stages, setStages] = useState<{ key: string; map: Map<string, string> } | null>(null);
  useEffect(() => {
    if (drill.stack.length === 0 || stages?.key === dataKey) return;
    let alive = true;
    fetchRecruitStuck(bu, range)
      .then((d) => {
        if (!alive) return;
        const map = new Map<string, string>();
        for (const x of d.requests ?? []) if (x.jobId && x.state !== 'filled' && x.state !== 'cancelled') map.set(x.jobId.toUpperCase(), STUCK_REASON_LABEL[x.reason]);
        setStages({ key: dataKey, map });
      })
      .catch(() => {
        /* อ่านขั้นไม่ได้ = ไม่โชว์บรรทัดขั้น (รายใบยังใช้ได้) */
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataKey มาจาก range/bu ชุดเดียวกัน
  }, [drill.stack.length, dataKey]);
  const stageOf = (r: MoneyRequest): string | null | undefined =>
    stages?.key === dataKey
      ? (stages.map.get(ledgerJobIdOf({ requestNo: r.requestNo, prequest: r.requestNo.startsWith(PREQUEST_LEDGER_PREFIX) }).toUpperCase()) ?? null)
      : undefined;
  const [panel, setPanel] = useState<OverviewPanel | null>(null);
  const openList = (title: string, rows: MoneyRequest[], sub?: string) => {
    setPanel(null);
    drill.open({ title, rows, expand: null, sub });
  };

  const openMoney = () => {
    const rows = rowsOf(costlyAll.rows);
    const bus = new Map<string, { n: number; missing: number; perDay: number }>();
    for (const r of costlyAll.rows) {
      const k = byNo.get(r.requestNo)?.bu ?? 'ไม่ระบุ BU';
      const cur = bus.get(k) ?? { n: 0, missing: 0, perDay: 0 };
      cur.n += 1;
      cur.missing += r.missing;
      cur.perDay += r.perDay;
      bus.set(k, cur);
    }
    /**
     * ยอดตามสัญญาในช่วงแยก BU (เจ้าของ 10 พ.ย. 2569 "กดไปก็เห็นว่าเป็นของ Bu ไหนเท่าไหร่ เช่น Lbd 20000") — ทุกใบในสมุดของช่วง
     * (รวมใบที่ปิดไปแล้ว) ⇒ ทุก BU รวมกัน = ตัวเลขบนการ์ดพอดี · เงินต่อวันยังคิดจากใบที่ยังโดนอยู่วันนี้ (ชุดเดิม)
     */
    const amountOf = (r: MoneyRequest) => r.amount.need.fine + r.amount.need.deduct;
    const busAmt = new Map<string, { amount: number; rows: MoneyRequest[] }>();
    for (const r of openReqs) {
      const a = amountOf(r);
      if (a <= 0) continue;
      const k = r.bu ?? 'ไม่ระบุ BU';
      const cur = busAmt.get(k) ?? { amount: 0, rows: [] };
      cur.amount += a;
      cur.rows.push(r);
      busAmt.set(k, cur);
    }
    setPanel({
      wide: true,
      title: 'เสียเงิน',
      sub: `${NUM.format(costlyAll.total)} ใบ · วันละ ${BAHT.format(perDayTotal)} บาท · ตามสัญญา ${BAHT.format(contract ?? 0)} บาท`,
      go: PAGE.requests,
      body: (
        <div className="space-y-4">
          {/* แยกประเภทเงิน + เทียบจุดเริ่มนับ (ชุดส่งต่อต้นแบบ 10 พ.ย. 2569 H02) — ยอดจากสมุดเดียวกับการ์ด · หักจริงคิดตามวันรับเงิน ผูกใบขอไม่ได้ */}
          {moneyNow ? (
            <table className="w-full text-sm" data-testid="overview-money-types">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="py-2 text-left font-normal">รายการ</th>
                  <th className="py-2 text-right font-normal">นับจากวันที่ต้องการ</th>
                  <th className="py-2 text-right font-normal">นับจากวันที่คีย์</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                <tr className="border-b border-border">
                  <td className="py-2">ค่าปรับ</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.need.fine)}</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.key.fine)}</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2">ลดมูลค่างาน</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.need.deduct)}</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.key.deduct)}</td>
                </tr>
                <tr className="border-b border-border font-medium">
                  <td className="py-2">รวมตามสัญญา</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.need.fine + moneyNow.totals.need.deduct)}</td>
                  <td className="py-2 text-right">{BAHT.format(moneyNow.totals.key.fine + moneyNow.totals.key.deduct)}</td>
                </tr>
                <tr>
                  <td className="py-2">คน-วันที่ขาด</td>
                  <td className="py-2 text-right">{NUM.format(moneyNow.totals.need.personDays)}</td>
                  <td className="py-2 text-right">{NUM.format(moneyNow.totals.key.personDays)}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          {moneyNow ? (
            <p className="text-xs tabular-nums text-muted-foreground">
              ลูกค้าหักจริง {BAHT.format(moneyNow.customerFines.total)} บาท · {NUM.format(moneyNow.customerFines.receipts)} ใบเสร็จ · ตามวันรับเงิน ผูกกับใบขอรายใบไม่ได้
            </p>
          ) : null}
          <BuTrendTable metric="money" bu={bu} />
          <p className="text-sm font-medium text-foreground">แยก BU · {thaiDate(range.from)} – {thaiDate(range.to)}</p>
          <ul className="divide-y divide-border rounded-xl border border-border" data-testid="overview-money-bu">
            {[...busAmt.entries()]
              .sort((a, b) => b[1].amount - a[1].amount)
              .map(([k, v]) => {
                const today = bus.get(k);
                return (
                  <li key={k}>
                    {/* กดแถว = รายใบของ BU นั้น เรียงเงินมากสุดก่อน (9 พ.ย. 2569 "ถ้าใบก็ต้องใบ") */}
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-3 py-2 text-left text-sm font-normal"
                      onClick={() => openList(`เสียเงิน · ${k === 'ไม่ระบุ BU' ? k : trendBuLabel(k)}`, [...v.rows].sort((a, b) => amountOf(b) - amountOf(a)), `${BAHT.format(v.amount)} บาท ตามสัญญาในช่วง`)}
                      data-testid="overview-money-bu-row"
                    >
                      <span>{k === 'ไม่ระบุ BU' ? k : trendBuLabel(k)}</span>
                      <span className="text-right tabular-nums text-muted-foreground">
                        <span className={cn('font-medium', TONE.danger.value)}>{BAHT.format(v.amount)} บาท</span> · {NUM.format(v.rows.length)} ใบ
                        <span className="block text-xs">{today ? `ยังโดนอยู่ ${NUM.format(today.n)} ใบ · วันละ ${BAHT.format(today.perDay)}` : 'วันนี้ไม่มีใบที่ยังโดน'}</span>
                      </span>
                    </Button>
                  </li>
                );
              })}
          </ul>
          <p className="text-sm font-medium text-foreground">ใบที่เสียมากสุด</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {costlyAll.rows.slice(0, 5).map((r) => (
              <li key={r.requestNo}>
                {/* กดแถว = เปิดใบนั้นกางรายละเอียด มีปุ่มเปิดใบขอไปทำงานต่อ */}
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full items-start justify-between gap-3 whitespace-normal rounded-none px-3 py-2 text-left text-sm font-normal"
                  onClick={() => {
                    setPanel(null);
                    drill.open({ title: r.requestNo, rows: rowsOf([r]), expand: r.requestNo });
                  }}
                  data-testid="overview-money-row"
                >
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-foreground">
                      {r.unit} · {r.position}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {r.requestNo} · ขาด {NUM.format(r.missing)} คน · {r.owner ?? 'ยังไม่มีคนรับผิดชอบ'}
                    </span>
                  </span>
                  <span className={cn('shrink-0 font-medium tabular-nums', TONE.danger.value)}>{BAHT.format(r.perDay)}/วัน</span>
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="w-full" onClick={() => openList('ใบที่เสียเงิน', rows)} data-testid="overview-money-all">
            ดูทุกใบ {NUM.format(costlyAll.total)} ใบ
          </Button>
        </div>
      ),
    });
  };

  /** เหลือหา (เจ้าของ 10 พ.ย. 2569 "เหลือหาก็เหมือนกัน") — แยก BU + เทียบรายเดือน/รายวัน → รายใบ · ชุดใบเดียวกับการ์ด */
  const openRemaining = () => {
    const open = flowRows((f) => f.open).sort((a, b) => perDayOf(b) - perDayOf(a));
    const byBu = new Map<string, MoneyRequest[]>();
    for (const r of open) byBu.set(r.bu ?? 'ไม่ระบุ BU', [...(byBu.get(r.bu ?? 'ไม่ระบุ BU') ?? []), r]);
    setPanel({
      wide: true,
      title: 'เหลือหา',
      sub: flow ? `${NUM.format(flow.remainingRequests)} ใบ · ${NUM.format(flow.remaining)} อัตรา · ณ ${thaiDate(range.to)}` : undefined,
      go: PAGE.requests,
      body: (
        <div className="space-y-4">
          <BuTrendTable metric="remaining" bu={bu} />
          <p className="text-sm font-medium text-foreground">แยก BU · ณ {thaiDate(range.to)}</p>
          <PanelRows
            unit="ใบ"
            rows={[...byBu.entries()]
              .sort((a, b) => b[1].length - a[1].length)
              .map(([k, list]) => {
                const label = k === 'ไม่ระบุ BU' ? k : trendBuLabel(k);
                return { label: `${label} · ${NUM.format(list.reduce((n, r) => n + (r.flow?.remaining ?? 0), 0))} อัตรา`, value: list.length, onOpen: () => openList(`เหลือหา · ${label}`, list) };
              })}
          />
          <Button type="button" variant="outline" className="w-full" onClick={() => openList('เหลือหา', open)} data-testid="overview-remain-all">
            ดูทุกใบ {NUM.format(open.length)} ใบ
          </Button>
        </div>
      ),
    });
  };

  const openNew = () => {
    const list = flowRows((f) => f.isNew);
    const lead = new Map<RequestLeadKind, number>();
    for (const r of list) {
      const k = requestLeadKindFromYmd(r.keyYmd, r.needYmd);
      lead.set(k, (lead.get(k) ?? 0) + 1);
    }
    const days = (roNow?.requestDays ?? []).filter((d) => d.day >= range.from && d.day <= range.to);
    const dayMax = Math.max(1, ...days.map((d) => d.total));
    const kinds = new Map<string, number>();
    for (const r of list) {
      const k = (r.position || 'ไม่ระบุ').trim();
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    const topKinds = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
    const bus = new Map<string, number>();
    for (const r of list) bus.set(r.bu ?? 'ไม่ระบุ BU', (bus.get(r.bu ?? 'ไม่ระบุ BU') ?? 0) + 1);
    setPanel({
      title: 'ขอใหม่',
      sub: flow ? `${NUM.format(flow.newRequests)} ใบ · ${NUM.format(flow.newPositions)} อัตรา` : undefined,
      go: PAGE.requests,
      body: (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">เข้ามารายวัน</p>
            <div className="flex h-24 items-end gap-0.5" data-testid="overview-new-days">
              {days.map((d) => (
                <span
                  key={d.day}
                  className={cn('flex-1 rounded-t-sm', TONE.info.dot)}
                  style={{ height: `${Math.max(2, (d.total / dayMax) * 100)}%` }}
                  title={`${thaiDate(d.day)} · ${NUM.format(d.total)} ใบ`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{thaiDate(range.from)}</span>
              <span>{thaiDate(range.to)}</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">ด่วนแบบไหน</p>
          <PanelRows
            unit="ใบ"
            rows={(['advance', 'urgent', 'retroactive'] as const).map((k) => ({
              label: REQUEST_LEAD_KIND_LABEL[k],
              value: lead.get(k) ?? 0,
              emphasis: k === 'retroactive' ? 'danger' : k === 'urgent' ? 'warn' : null,
              onOpen: () => openList(`ขอใหม่ · ${REQUEST_LEAD_KIND_LABEL[k]}`, list.filter((r) => requestLeadKindFromYmd(r.keyYmd, r.needYmd) === k)),
            }))}
          />
          <p className="text-sm font-medium text-foreground">งานอะไร</p>
          {/* 8 อันดับแรก + อื่น ๆ — รวมกัน = ขอใหม่ทั้งหมด */}
          <PanelRows
            unit="ใบ"
            rows={[
              ...topKinds.slice(0, 8).map(([label, value]) => ({ label, value, onOpen: () => openList(`ขอใหม่ · ${label}`, list.filter((r) => (r.position || 'ไม่ระบุ').trim() === label)) })),
              ...(topKinds.length > 8
                ? [
                    {
                      label: 'อื่น ๆ',
                      value: topKinds.slice(8).reduce((n, [, v]) => n + v, 0),
                      onOpen: () => {
                        const top = new Set(topKinds.slice(0, 8).map(([k]) => k));
                        openList('ขอใหม่ · อื่น ๆ', list.filter((r) => !top.has((r.position || 'ไม่ระบุ').trim())));
                      },
                    },
                  ]
                : []),
            ]}
          />
          <p className="text-sm font-medium text-foreground">แยก BU</p>
          <PanelRows
            unit="ใบ"
            rows={[...bus.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => {
                const label = k === 'ไม่ระบุ BU' ? k : trendBuLabel(k);
                return { label, value: v, onOpen: () => openList(`ขอใหม่ · ${label}`, list.filter((r) => (r.bu ?? 'ไม่ระบุ BU') === k)) };
              })}
          />
          <Button type="button" variant="outline" className="w-full" onClick={() => openList('ขอใหม่', list)}>
            ดูทุกใบ {NUM.format(list.length)} ใบ
          </Button>
        </div>
      ),
    });
  };

  /** รายชื่อของเลขที่กด (9 พ.ย. 2569 "บอกชื่อกดไปต้องเห็นชื่อแล้วกดไปทำงานต่อได้") — ปิดแผงก่อน ไม่ซ้อนป๊อป */
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);
  const openNames = (title: string, ids: readonly string[]) => {
    setPanel(null);
    setNames({ title, ids });
  };

  /** รายชื่อคนติดตาม — ผลรายคนที่กด (null = ทุกคน) · ปิดแผงก่อน ไม่ซ้อนป๊อป */
  const [followNames, setFollowNames] = useState<{ title: string; bucket: FollowBucketKey | null } | null>(null);
  /** รายชื่อหลังเลข ดูแลหลังเริ่มงาน / จับคู่งาน (ชุดส่งต่อ H09 · ป๊อปเดียวกับหน้าหลักรุ่นก่อน แบ่งหน้า ช่วง/BU เดียวกับเลข) */
  const [blockNames, setBlockNames] = useState<{ block: 'aftercare' | 'matching'; title: string; count: number | null } | null>(null);
  const openFollowNames = (title: string, bucket: FollowBucketKey | null) => {
    setPanel(null);
    setFollowNames({ title, bucket });
  };
  /**
   * เปลี่ยนช่วง/BU = ปิดแผง · รายใบ (ทั้งชั้นที่กดลึก) · รายชื่อ ที่เปิดค้างทันที (ชุดส่งต่อ 10 พ.ย. 2569 G04)
   * แผงถ่ายรายการตอนกด — ห้ามค้างรายการช่วงเก่าใต้ป้ายช่วงใหม่ · รอบสดชุดเดิม (dataKey ไม่เปลี่ยน) ไม่ปิด
   */
  const openedKey = useRef(dataKey);
  useEffect(() => {
    if (openedKey.current === dataKey) return;
    openedKey.current = dataKey;
    setPanel(null);
    setNames(null);
    setFollowNames(null);
    setBlockNames(null);
    drill.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drill.close ตั้งค่าว่างเสมอ
  }, [dataKey]);

  const openStep = (s: FunnelStep) => {
    const staffRows = s.key === 'staff' || s.key === 'reached' ? (roNow?.staff ?? []).filter((x) => x.claimed + x.called > 0) : [];
    setPanel({
      // ผู้สมัคร (ขั้นแรก) มีกราฟเทียบ BU บนสุด — แผงกว้าง (10 พ.ย. 2569 "กดแล้วเป็นกราฟทุกการ์ด")
      wide: s.key === 'applied',
      title: s.label,
      sub: `${NUM.format(s.value)} คน${s.from ? ` · ${s.from}` : ''}`,
      // พาช่วงวันที่สมัครไปด้วย (เจ้าของ 10 พ.ย. 2569 "1474 คือของ 1-10 พย ถ้ากดไปก็ต้องโชว์ยอดของ 1-10 พย")
      go: { label: STEP_PAGE[s.key].label, to: withRange(STEP_PAGE[s.key].to, range) },
      body: (
        <div className="space-y-4">
          {s.key === 'applied' ? <BuTrendTable metric="applicants" bu={bu} /> : null}
          {s.rows.length ? (
            <PanelRows
              unit="คน"
              rows={s.rows.map((r) => ({ label: r.label, value: r.value, emphasis: toneOfRow(r.tone), onOpen: () => openNames(`${s.label} · ${r.label}`, r.ids) }))}
            />
          ) : null}
          {staffRows.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">แยกเจ้าหน้าที่</p>
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                <li className="flex justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <span>เจ้าหน้าที่</span>
                  <span>เก็บ · โทร · ติดต่อได้ · นัดได้</span>
                </li>
                {staffRows.map((x) => (
                  <li key={x.name} className="flex justify-between gap-2 px-3 py-2">
                    <span>{x.name}</span>
                    <span className="tabular-nums">
                      {NUM.format(x.claimed)} · {NUM.format(x.called)} · {NUM.format(x.reached)} · {NUM.format(x.appointed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ChannelTable channels={s.channels} />
          <Button type="button" variant="outline" className="w-full" onClick={() => openNames(s.label, s.ids)} disabled={s.value === 0} data-testid="overview-step-names">
            ดูรายชื่อ {NUM.format(s.value)} คน
          </Button>
          {/* ทางลัดไปทำงาน (เจ้าของ 10 พ.ย. 2569 "กดไปเพื่อดูว่าชื่อฉันอย่างเดียวเหลือเท่าไหร่" · "ดูว่าวันนี้นัดมาเท่านี้นะกดไปแล้วเห็นเลย") */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => navigate(withRange('/jobs/board?view=contact&scope=mine&chip=uncalled', range))} data-testid="overview-my-uncalled">
              ชื่อที่ฉันเก็บไว้ ยังไม่โทร ›
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(withRange('/jobs/board?view=appointments', { from: today, to: today }))} data-testid="overview-appt-today">
              นัดวันนี้ ›
            </Button>
          </div>
        </div>
      ),
    });
  };

  const openFollow = () =>
    setPanel({
      wide: true,
      title: 'ติดตามคนเริ่มงาน / ติดตามส่งคนแทน',
      sub: cells ? `${NUM.format(peopleTotal)} คน · ${NUM.format(followLive)} สาย · ยกเลิก ${NUM.format(followCancelled)} สายไม่นับ` : undefined,
      go: PAGE.follow,
      body: (
        <div className="space-y-4">
          <BuTrendTable metric="follow" bu={bu} />
          <p className="text-sm font-medium text-foreground">ผลรายคน</p>
          <PanelRows
            unit="คน"
            rows={personRows.map((r) => ({
              label: `${r.label} · ${NUM.format(r.calls)} สาย`,
              value: r.people,
              emphasis: r.key === 'went' ? 'success' : r.key === 'notWent' ? 'danger' : r.key === 'failed' || r.key === 'reschedule' ? 'warn' : null,
              // กดแถว = รายชื่อคนของผลนั้น (9 พ.ย. 2569 "ทำแผงติดตามให้กดเห็นชื่อด้วย")
              onOpen: () => openFollowNames(`ติดตาม · ${r.label}`, r.key),
            }))}
          />
          <Button type="button" variant="outline" className="w-full" onClick={() => openFollowNames('ติดตาม', null)} disabled={peopleTotal === 0} data-testid="overview-follow-names">
            ดูรายชื่อ {NUM.format(peopleTotal)} คน
          </Button>
          {teams ? (
            <PanelRows
              unit="สาย"
              rows={[
                { label: 'คนเริ่มงาน', value: teams.main },
                { label: 'ส่งคนแทน', value: teams.replacement },
              ]}
            />
          ) : null}
          <p className="text-sm font-medium text-foreground">ผลรายสาย</p>
          <PanelRows
            unit="สาย"
            rows={followResults.map((r) => ({
              label: `${r.label} · AI ${NUM.format(r.parts.ai ?? 0)} · คน ${NUM.format(r.parts.staff ?? 0)}`,
              value: r.total,
              emphasis: r.key === 'went' ? 'success' : r.key === 'notWent' ? 'danger' : r.key === 'failed' || r.key === 'reschedule' ? 'warn' : null,
            }))}
          />
          <p className="text-sm font-medium text-foreground">แต่ละ BU ใช้เท่าไหร่</p>
          <PanelRows
            unit="สาย"
            rows={followBus.map((r) => ({ label: `${r.label} · AI ${NUM.format(r.parts.ai ?? 0)} · คน ${NUM.format(r.parts.staff ?? 0)}`, value: r.total }))}
          />
        </div>
      ),
    });

  const applied = funnel?.[0] ?? null;
  const aiStep = funnel?.[1] ?? null;

  // ═══ โฉมต้นแบบ SO Recruit (`?home=v5` · เจ้าของ 10 พ.ย. 2569) — ทุกเลข/การกดใช้ตัวแปรและตัวเปิดแผงชุดเดียวกับหน้าหลักสรุป ═══
  const req = roNow?.requests ?? null;
  /** ใบขอใหม่ของช่วงตามสถานะประกาศ — กดแถวไปหน้าใบขอ · กดจำนวนคนเปิดรายชื่อ (รายการชุดเดียวกับเลขในตาราง) */
  const openRequestList = (title: string, pick: (r: RecruitRequestItem) => boolean) => {
    const list = (roNow?.requestList ?? []).filter(pick);
    setPanel({
      title,
      sub: `${NUM.format(list.length)} ใบ · ${thaiDate(range.from)} – ${thaiDate(range.to)}`,
      go: PAGE.board,
      body: (
        <RequestListPanel
          key={title}
          list={list}
          onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))}
          onOpenNames={(r) => openNames(`${r.requestNo} · คนกรอก`, r.appIds)}
        />
      ),
    });
  };
  const calls = liveCells ? followCallsMade(liveCells) : null;
  const periodText = `${thaiDate(range.from)} – ${thaiDate(range.to)}`;
  const followMax = Math.max(1, ...followResults.map((r) => r.total));
  const funnelMax = Math.max(1, funnel?.[0]?.value ?? 0);
  const overlays = (
    <>
      {blockNames ? (
        <AiShareListDialog
          key={`${blockNames.block}|${dataKey}`}
          open
          onOpenChange={(o) => !o && setBlockNames(null)}
          block={blockNames.block}
          blockTitle={blockNames.title}
          listKey="total"
          unit={AI_SHARE_UNIT}
          win={winQ}
          count={blockNames.count}
          contentStyle={v5 ? v5Style : undefined}
        />
      ) : null}
      <OverviewSheet panel={panel} onClose={() => setPanel(null)} contentStyle={v5 ? v5Style : undefined} />
      <ExecDrill drill={drill} all={openReqs} today={today} contentStyle={v5 ? v5Style : undefined} stageOf={stageOf} />
      <FollowNamesDialog
        open={followNames !== null}
        onOpenChange={(o) => !o && setFollowNames(null)}
        title={followNames?.title ?? ''}
        q={winQ}
        bucket={followNames?.bucket ?? null}
        contentStyle={v5 ? v5Style : undefined}
      />
      <JourneyNamesDialog open={names !== null} onOpenChange={(o) => !o && setNames(null)} title={names?.title ?? ''} ids={names?.ids ?? []} contentStyle={v5 ? v5Style : undefined} />
    </>
  );

  if (v5) {
    const ready = Boolean(moneyNow && roNow);
    return (
      <div className="-mx-4 -my-4 min-h-screen bg-background px-4 py-6 text-foreground sm:-mx-6 sm:px-6 sm:py-8" style={v5Style} data-testid="home-v5">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-3xl font-medium tracking-tight">หน้าหลัก</h1>
              <p className="text-sm text-muted-foreground">ใบขอ ผลการสรรหา และการติดตามในระบบ</p>
            </div>
            <div className="flex items-center gap-2">
              <PeriodPicker value={win} onChange={setWin} />
              {buChoices?.length ? (
                <BuChoiceSelect value={bu} choices={buChoices} onChange={setBu} allOption triggerClassName="h-10 w-32 bg-card" />
              ) : moneyNow?.forcedBu && moneyNow.bu ? (
                <span className="text-sm text-muted-foreground">{trendBuLabel(moneyNow.bu)}</span>
              ) : (
                <Select value={bu ?? 'all'} onValueChange={(v) => setBu(v === 'all' ? null : v)}>
                  <SelectTrigger className="h-10 w-32 shrink-0 bg-card" aria-label="เลือก BU">
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
          </header>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span data-testid="v5-period">{ready ? `ข้อมูล ${periodText}${roNow?.generatedAt ? ` · อ่านเมื่อ ${shortTimeOf(roNow.generatedAt)} น.` : ''}` : `กำลังโหลด ${periodText}`}</span>
            <span>กดตัวเลขเพื่อดูรายการ แล้วกดชื่อเพื่อดูสิ่งที่ต้องทำต่อ</span>
          </div>
          {moneyError || roError ? <p className={cn('text-sm', TONE.danger.value)}>{moneyError ?? roError}</p> : null}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-testid="v5-kpis">
            <V5Kpi
              wine
              label="ผลกระทบตามสัญญา"
              icon={Banknote}
              value={contract}
              unit="บาท"
              money
              left={moneyNow ? `${NUM.format(costlyAll.total)} ใบที่มีผลกระทบ` : '—'}
              right="แยกค่าปรับ / ลดมูลค่า"
              onClick={moneyNow ? openMoney : undefined}
              testId="v5-kpi-money"
            />
            <V5Kpi
              label="ใบขอที่เหลือหา"
              icon={FileText}
              value={flow?.remainingRequests}
              unit="ใบ"
              left={flow ? `เหลือหา ${NUM.format(flow.remaining)} อัตรา` : '—'}
              right={flow ? `รวมใบขอชั่วคราว ${NUM.format(preCount)} ใบ` : ''}
              onClick={flow ? openRemaining : undefined}
              testId="v5-kpi-remain"
            />
            <V5Kpi
              label="ผู้สมัคร"
              icon={Users}
              value={applied?.value}
              unit="รายชื่อ"
              left={aiStep ? `AI โทรแล้ว ${NUM.format(aiStep.value)}` : '—'}
              right={aiStep ? `สนใจ ${NUM.format(aiStep.rows[0].value)}` : ''}
              onClick={applied ? () => openStep(applied) : undefined}
              testId="v5-kpi-apps"
            />
            <V5Kpi
              label="ติดตามก่อนเริ่มงาน / คนแทน"
              icon={Phone}
              value={people ? peopleTotal : null}
              unit="คน"
              left={people ? `${NUM.format(followLive)} สาย` : '—'}
              right={people ? `ไป ${NUM.format(wentPeople)} คน` : ''}
              onClick={cells ? openFollow : undefined}
              testId="v5-kpi-follow"
            />
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v === 'proportion' ? 'proportion' : 'overview')}>
            <TabsList variant="line" aria-label="เลือกมุมมอง">
              <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
              <TabsTrigger value="proportion" data-testid="home-tab-proportion">
                สัดส่วน AI และคน
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'proportion' ? (
            <ProportionTab win={win} bu={bu} apps={apps} appsError={roError} openJobIds={openJobIds} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <V5Card className="lg:col-span-2" title="ใบขอเข้ามา แล้วปิดได้เท่าไหร่" sub={`ตามสมุดใบขอ · ${periodText} · รวมใบขอชั่วคราว`} testId="v5-ledger">
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-5">
                    <V5EqCell label="ยกมา" value={flow?.carryInRequests} onClick={flow ? () => openList('ยกมา', flowRows((f) => f.carry)) : undefined} testId="v5-eq-carry" />
                    <V5EqCell label="+ ขอใหม่" value={flow?.newRequests} onClick={flow ? openNew : undefined} testId="v5-eq-new" />
                    <V5EqCell label="− ปิดครบ" value={flow?.closedRequests} onClick={flow ? () => openList('ปิดครบ', flowRows((f) => f.closed)) : undefined} testId="v5-eq-closed" />
                    <V5EqCell
                      label="− ยกเลิก"
                      value={flow?.cancelledRequests}
                      onClick={
                        flow
                          ? () => {
                              const list = flowRows((f) => f.cancelledReq);
                              setPanel(null);
                              drill.open({ title: 'ยกเลิก', rows: list, expand: null, reasons: { unit: 'ใบ', items: reasonsOf(list, () => 1) } });
                            }
                          : undefined
                      }
                      testId="v5-eq-cancel"
                    />
                    <V5EqCell result label="= เหลือหา" value={flow?.remainingRequests} onClick={flow ? () => openList('เหลือหา', flowRows((f) => f.open)) : undefined} testId="v5-eq-remain" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs tabular-nums text-muted-foreground">
                    <span data-testid="overview-req-sum">
                      {flow
                        ? `ใบ: ${NUM.format(flow.carryInRequests)} + ${NUM.format(flow.newRequests)} − ${NUM.format(flow.closedRequests)} − ${NUM.format(flow.cancelledRequests)} = ${NUM.format(flow.remainingRequests)} · อัตรา: ${NUM.format(flow.carryIn)} + ${NUM.format(flow.newPositions)} − ${NUM.format(flow.filled)} − ${NUM.format(flow.cancelled)} = ${NUM.format(flow.remaining)}`
                        : '—'}
                    </span>
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs"
                      disabled={!flow}
                      onClick={flow ? () => openList('หาได้แล้ว', flowRows((f) => f.filled > 0), `หาได้ ${NUM.format(flow.filled)} อัตรา`) : undefined}
                      data-testid="v5-filled"
                    >
                      หาได้ {v5Num(flow?.filled)} อัตรา · {v5Num(flow ? flowRows((f) => f.filled > 0).length : null)} ใบ ›
                    </Button>
                  </div>
                </V5Card>

                <V5Card title="ใบขอใหม่ ประกาศไปแค่ไหน" sub="กดสถานะเพื่อดูใบขอและผู้รับผิดชอบ" testId="v5-release">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex items-baseline gap-2 text-sm text-muted-foreground">
                      <V5NumLink value={req?.released} label="ประกาศแล้ว" onClick={req ? () => openRequestList('ประกาศแล้ว', (r) => r.released) : undefined} testId="v5-rel-released" />/{' '}
                      <V5NumLink value={req?.total} label="ขอใหม่" onClick={req ? () => openRequestList('ขอใหม่', () => true) : undefined} testId="v5-rel-total" /> ใบ
                    </span>
                    <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">ประกาศแล้ว</span>
                  </div>
                  <ul className="divide-y divide-border text-sm">
                    <li className="flex justify-between py-2 text-xs text-muted-foreground">
                      <span>สถานะ</span>
                      <span>ใบ</span>
                    </li>
                    {(
                      [
                        ['ยังไม่ประกาศ · ยังเปิด', req?.notReleasedOpen, (r: RecruitRequestItem) => !r.released && r.open],
                        ['ยังไม่ประกาศ · ปิดแล้ว', req?.notReleasedClosed, (r: RecruitRequestItem) => !r.released && !r.open],
                        ['ประกาศแล้ว · มีคนกรอก', req?.releasedWithApps, (r: RecruitRequestItem) => r.released && r.applications > 0],
                        ['ประกาศแล้ว · ไม่มีคนกรอก', req?.releasedNoApps, (r: RecruitRequestItem) => r.released && r.applications === 0],
                      ] as const
                    ).map(([label, value, pick]) => (
                      <li key={label} className="flex items-center justify-between gap-2 py-2">
                        <span>{label}</span>
                        <V5NumLink value={value} label={label} onClick={req ? () => openRequestList(label, pick) : undefined} />
                      </li>
                    ))}
                  </ul>
                </V5Card>
              </div>

              <V5Card title="จากผู้สมัคร ไปถึงวันนัด" sub={`รายชื่อที่กรอก ${periodText} · คนโทรต่อรวมทั้งกลุ่ม AI สนใจและกลุ่มอื่น`} testId="v5-funnel">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
                  {(funnel ?? buildApplicantFunnel([])).map((st, i) => (
                    <Button
                      key={st.key}
                      type="button"
                      variant="ghost"
                      disabled={!funnel}
                      onClick={() => openStep(st)}
                      className="h-auto min-w-0 flex-col items-stretch justify-start gap-2 whitespace-normal rounded-xl p-3 text-left font-normal disabled:opacity-100"
                      data-testid={`overview-step-${st.key}`}
                    >
                      <span className="text-xs text-muted-foreground">
                        {String(i + 1).padStart(2, '0')} {st.label}
                      </span>
                      <span className="text-3xl font-medium tabular-nums">{funnel ? NUM.format(st.value) : '—'}</span>
                      <V5Bar pct={funnel ? (st.value / funnelMax) * 100 : 0} />
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {st.from && funnel ? `${st.from} · ` : ''}
                        {st.rows.map((r) => `${r.label} ${funnel ? NUM.format(r.value) : '—'}`).join(' · ')}
                      </span>
                    </Button>
                  ))}
                </div>
              </V5Card>

              <V5Divider label="หลังได้คน" />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <V5Card className="lg:col-span-2" title="ติดตามก่อนเริ่มงาน / ส่งคนแทน" testId="v5-follow">
                  <div className="space-y-1">
                    {followResults.map((r) => (
                      <Button
                        key={r.key}
                        type="button"
                        variant="ghost"
                        onClick={() => openFollowNames(`ติดตาม · ${r.label}`, r.key as FollowBucketKey)}
                        className="grid h-auto w-full grid-cols-3 items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm font-normal sm:grid-cols-5"
                        data-testid={`v5-follow-${r.key}`}
                      >
                        <span>{r.label}</span>
                        <span className="sm:col-span-3">
                          <V5Bar pct={(r.total / followMax) * 100} muted />
                        </span>
                        <span className="text-right font-medium tabular-nums">{NUM.format(r.total)}</span>
                      </Button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>หน่วย: สาย · คนเดียวมีได้หลายสาย</span>
                    <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={cells ? openFollow : undefined} disabled={!cells}>
                      ยกเลิก {v5Num(cells ? followCancelled : null)} สาย · ดูทั้งหมด ›
                    </Button>
                  </div>
                </V5Card>
                <V5Card title="AI และคน โทรไปเท่าไหร่" testId="v5-callers">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted-foreground">
                        <th className="py-2 text-left font-normal">ผู้โทร</th>
                        <th className="py-2 text-right font-normal">โทรแล้ว</th>
                        <th className="py-2 text-right font-normal">รอโทร</th>
                      </tr>
                    </thead>
                    <tbody className="tabular-nums">
                      <tr className="border-b border-border">
                        <td className="py-2">AI</td>
                        <td className="py-2 text-right">{v5Num(calls?.aiDone)}</td>
                        <td className="py-2 text-right">{v5Num(calls?.aiWaiting)}</td>
                      </tr>
                      <tr>
                        <td className="py-2">คน</td>
                        <td className="py-2 text-right">{v5Num(calls?.staffDone)}</td>
                        <td className="py-2 text-right">{v5Num(calls?.staffWaiting)}</td>
                      </tr>
                    </tbody>
                  </table>
                  {/* กดเลข = รายชื่อจริง (H09) · ลิงก์ล่าง = ไปทำงานที่หน้าเต็ม */}
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
                    {([
                      { block: 'aftercare', label: 'ดูแลหลังเริ่มงาน', value: aiV5?.aftercare?.total, to: PAGE.aftercare.to },
                      { block: 'matching', label: 'จับคู่งาน', value: aiV5?.matching?.total, to: '/matching/match' },
                    ] as const).map((b) => (
                      <div key={b.block} className="space-y-1 p-2">
                        <span className="block text-xs text-muted-foreground">{b.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-auto gap-1 rounded-lg px-1 py-0 text-2xl font-medium tabular-nums"
                          disabled={b.value == null}
                          onClick={() => setBlockNames({ block: b.block, title: b.label, count: b.value ?? null })}
                          data-testid={`v5-${b.block}`}
                        >
                          {v5Num(b.value)} <span className="text-xs font-normal text-muted-foreground">รายชื่อ</span>
                        </Button>
                        <Button type="button" variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => navigate(b.to)} data-testid={`v5-${b.block}-page`}>
                          ไปหน้า{b.label} ›
                        </Button>
                      </div>
                    ))}
                  </div>
                  {aiV5Error && !aiV5 ? <p className="text-xs text-muted-foreground">{aiV5Error}</p> : null}
                </V5Card>
              </div>
            </>
          )}
        </div>
        {overlays}
      </div>
    );
  }


  return (
    <div className="space-y-6" data-testid="home-overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
          {/* แท็บ "สัดส่วน" (เจ้าของ 28 ต.ค. 2569 · ชื่อแท็บเจ้าของตั้งเอง) — ช่วง/BU ชุดเดียวกับภาพรวม */}
          <Tabs value={tab} onValueChange={(v) => setTab(v === 'proportion' ? 'proportion' : 'overview')}>
            <TabsList variant="glass" aria-label="เลือกมุมมอง">
              <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
              <TabsTrigger value="proportion" data-testid="home-tab-proportion">
                สัดส่วน
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={win} onChange={setWin} />
          {buChoices?.length ? (
            <BuChoiceSelect value={bu} choices={buChoices} onChange={setBu} allOption triggerClassName="h-10 w-32 bg-card" />
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
      {tab === 'proportion' ? (
        <ProportionTab win={win} bu={bu} apps={apps} appsError={roError} openJobIds={openJobIds} />
      ) : (
      <>
      {moneyError || roError ? <p className={cn('text-sm', TONE.danger.value)}>{moneyError ?? roError}</p> : null}

      {/* ── ตอนนี้: แถบกรมท่า (แบบร่าง A "หัวกรมท่า" เจ้าของเลือก 9 พ.ย. 2569 หลัง "บ้านนอกคอกนาสุดๆ") ──
           เหลือหาตัวใหญ่ 2 ช่อง · เสียเงิน · ผู้สมัคร/ติดตามซ้อนกันช่องขวา */}
      <Card variant="solid" className="bg-foreground p-3 text-background dark:bg-card dark:text-foreground sm:p-5" data-testid="overview-kpis">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewNode
            big
            variant="hero"
            label="เหลือหา"
            value={flow?.remainingRequests}
            unit="ใบ"
            emphasis="warn"
            tag="ต้องหา"
            // 9 พ.ย. 2569 ใบขอชั่วคราวอยู่ในเลขนี้แล้ว (สมุดใบขอ) — บอกว่ารวมกี่ใบ ไม่ใช่ "อีก"
            sub={flow ? `${NUM.format(flow.remaining)} อัตรา · รวมใบขอชั่วคราว ${NUM.format(preCount)} ใบ` : undefined}
            // กด = กราฟเทียบ BU + แยก BU → รายใบ (เจ้าของ 10 พ.ย. 2569 "พอกดเข้าให้มันโชว์กราฟไง") — เดิมเปิดรายใบเลย
            onClick={flow ? openRemaining : undefined}
            className="justify-center sm:col-span-2 lg:row-span-2"
            testId="overview-kpi-remain"
          />
          <OverviewNode
            variant="hero"
            label="เสียเงิน (ตามสัญญา)"
            value={contract}
            unit="บาท"
            emphasis="danger"
            tag="ด่วน"
            sub={moneyNow ? `${NUM.format(costlyAll.total)} ใบ · วันละ ${BAHT.format(perDayTotal)} · ลูกค้าหักจริง ${BAHT.format(moneyNow.customerFines.total)}` : undefined}
            onClick={moneyNow ? openMoney : undefined}
            className="justify-center lg:row-span-2"
            testId="overview-kpi-money"
          />
          <OverviewNode
            variant="hero"
            label="ผู้สมัคร"
            value={applied?.value}
            unit="คน"
            sub={aiStep ? `AI โทรแล้ว ${NUM.format(aiStep.value)} · สนใจ ${NUM.format(aiStep.rows[0].value)}` : undefined}
            onClick={applied ? () => openStep(applied) : undefined}
            testId="overview-kpi-apps"
          />
          <OverviewNode
            variant="hero"
            label="ติดตาม"
            value={people ? peopleTotal : null}
            unit="คน"
            sub={people ? `${NUM.format(followLive)} สาย · ไป ${NUM.format(wentPeople)} คน` : undefined}
            onClick={cells ? openFollow : undefined}
            testId="overview-kpi-follow"
          />
        </div>
      </Card>

      {/* ── ใบขอ: ยกมา + ขอใหม่ − ปิดครบ − ยกเลิก = เหลือหา · ลูกโซ่ซ้ายไปขวา ผลลัพธ์พื้นเบอร์กันดี ── */}
      <OverviewSection title="ใบขอ" sub="ใบ (อัตรา) · รวมใบขอชั่วคราว" testId="overview-requests">
        <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-5">
          <OverviewNode big label="ยกมา" value={flow?.carryInRequests} unit="ใบ" sub={flow ? `${NUM.format(flow.carryIn)} อัตรา` : undefined} onClick={flow ? () => openList('ยกมา', flowRows((f) => f.carry)) : undefined} testId="overview-req-carry" />
          <OverviewNode big label="+ ขอใหม่" value={flow?.newRequests} unit="ใบ" sub={flow ? `${NUM.format(flow.newPositions)} อัตรา` : undefined} onClick={flow ? openNew : undefined} testId="overview-req-new" />
          <OverviewNode big label="− ปิดครบ" value={flow?.closedRequests} unit="ใบ" emphasis="success" onClick={flow ? () => openList('ปิดครบ', flowRows((f) => f.closed)) : undefined} testId="overview-req-closed" />
          <OverviewNode
            big
            label="− ยกเลิก"
            value={flow?.cancelledRequests}
            unit="ใบ"
            sub={flow ? `${NUM.format(flow.cancelled)} อัตรา` : undefined}
            onClick={
              flow
                ? () => {
                    const list = flowRows((f) => f.cancelledReq);
                    setPanel(null);
                    drill.open({ title: 'ยกเลิก', rows: list, expand: null, reasons: { unit: 'ใบ', items: reasonsOf(list, () => 1) } });
                  }
                : undefined
            }
            testId="overview-req-cancel"
          />
          <OverviewNode big label="= เหลือหา" value={flow?.remainingRequests} unit="ใบ" variant="solid" sub={flow ? `${NUM.format(flow.remaining)} อัตรา` : undefined} onClick={flow ? () => openList('เหลือหา', flowRows((f) => f.open)) : undefined} testId="overview-req-remain" />
        </div>
        {/* หาได้แล้ว (ลงงาน) แยกกล่อง — คนที่หาได้ทุกใบ รวมใบที่ได้บางส่วน ≠ ปิดครบ (CLAUDE.md "ห้ามปน หาได้แล้ว กับ ปิดครบใบขอ") */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1 text-xs tabular-nums text-muted-foreground">
            <p data-testid="overview-req-sum">
              {flow
                ? `ยกมา ${NUM.format(flow.carryInRequests)} + ขอใหม่ ${NUM.format(flow.newRequests)} − ปิดครบ ${NUM.format(flow.closedRequests)} − ยกเลิก ${NUM.format(flow.cancelledRequests)} = เหลือหา ${NUM.format(flow.remainingRequests)} ใบ`
                : '—'}
            </p>
            <p>
              {flow
                ? `ยกมา ${NUM.format(flow.carryIn)} + ขอใหม่ ${NUM.format(flow.newPositions)} − หาได้ ${NUM.format(flow.filled)} − ยกเลิก ${NUM.format(flow.cancelled)} = เหลือหา ${NUM.format(flow.remaining)} อัตรา`
                : '—'}
            </p>
          </div>
          <OverviewNode
            label="หาได้แล้ว · ลงงาน"
            value={flow?.filled}
            unit="อัตรา"
            emphasis="success"
            variant="outline"
            className="shrink-0 sm:w-48"
            onClick={flow ? () => openList('หาได้แล้ว', flowRows((f) => f.filled > 0), `หาได้ ${NUM.format(flow.filled)} อัตรา`) : undefined}
            testId="overview-req-filled"
          />
        </div>
      </OverviewSection>

      {/* ใบขอใหม่ ประกาศไปแค่ไหน → ย้ายไปหน้าภาพรวมงานสรรหา (เจ้าของ 9 พ.ย. 2569 "ตามร่างทั้งหมด") */}

      {/* ── ผู้สมัคร 6 ขั้น + แถบช่องทาง ── */}
      <OverviewSection title="ผู้สมัคร" sub="ไปถึงขั้นไหน · คน" testId="overview-funnel">
        {/* แบบร่าง B (2 พ.ย. 2569): แท่งยาวตามจำนวนไล่ลงทีละขั้น · ตัวเลขย่อยขวามือ */}
        <div className="space-y-1">
          {(funnel ?? buildApplicantFunnel([])).map((s) => (
            <OverviewBarRow
              key={s.key}
              label={s.label}
              value={funnel ? s.value : null}
              max={funnel?.[0]?.value ?? 0}
              onClick={funnel ? () => openStep(s) : undefined}
              testId={`overview-step-${s.key}`}
              strip={<ChannelStrip channels={s.channels} total={s.value} />}
            >
              <span className="flex flex-wrap gap-x-3 gap-y-0.5">
                {s.from && funnel ? <span className="w-full text-muted-foreground">{s.from}</span> : null}
                {s.rows.map((r) => (
                  <span key={r.key} className="whitespace-nowrap">
                    <span className="text-muted-foreground">{r.label}</span>{' '}
                    <span className={cn('font-medium', r.tone === 'neutral' ? 'text-foreground' : TONE[r.tone].value)}>{funnel ? NUM.format(r.value) : '—'}</span>
                  </span>
                ))}
              </span>
            </OverviewBarRow>
          ))}
        </div>
        <ChannelLegend channels={funnel?.[0]?.channels} />
      </OverviewSection>

      {/* หลังได้คน (ติดตาม · ดูแลหลังเริ่มงาน) → อยู่หน้าติดตาม/ดูแลหลังเริ่มงาน · หน้าหลักเหลือการ์ดสรุป "ติดตาม" ด้านบน (9 พ.ย. 2569) */}
      </>
      )}

      {overlays}
    </div>
  );
};

export default HomeOverviewPage;
