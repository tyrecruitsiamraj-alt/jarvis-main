import React, { useEffect, useMemo, useState } from 'react';
import BuChoiceSelect from '@/components/shared/BuChoiceSelect';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Megaphone,
  RefreshCw,
  Timer,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSearchParams } from 'react-router-dom';
import { rangeFromParams } from '@/lib/jobNavigation';
import RecruitStuckBody from './stuck/RecruitStuckBody';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { rangeText } from '@/lib/teamOnline';
import { shortTime } from '@/lib/dateTh';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { monthLabel, monthOptions, monthWindow, rangeWindow, shiftMonth, shiftRange } from '@/lib/recruitOverviewWindow';
import { prefetchRecruitStuck } from '@/lib/recruitStuckApi';
import { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { Calendar } from '@/components/ui/calendar';
import { parseYmd, toYmdLocal } from '@/lib/dateTh';
import {
  cohortOf,
  dailyRows,
  delayRows,
  positionRows,
  reasonGroups,
  totalsOf,
  trimLastDayToNow,
} from '@/lib/recruitOverview';
import { buildRecruitJourney } from '@/lib/recruitJourney';
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { RecruitRequestRow } from '@/lib/recruitRequestTab';
import { requestTrendRows, requestTrendSeries } from '@/lib/recruitRequestTrend';
import type { BoardPublishedTotals } from '@/lib/boardRelease';
import {
  BacklogBody,
  DailyCard,
  DelayList,
  EmptyNote,
  OverviewCard,
  PositionList,
  ReasonColumns,
  SectionError,
  StaffTable,
} from './RecruitOverviewParts';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TrendState } from './TrendParts';
import JourneyNamesDialog from './JourneyNamesDialog';
import { useV5ThemeStyle } from '@/components/so-recruit-v5/V5Parts';
import ChannelPlacementTable from './ChannelPlacementTable';
import ChannelFunnelTable from './ChannelFunnelTable';
import { buildChannelFunnelTree } from '@/lib/channelFunnel';
import type { OverviewTabId } from '@/lib/recruitOverviewTabs';
import { compareRowsOf, dailySeriesOf } from '@/lib/recruitCompare';
import TrendLinesCard, { type ComparePeriod, type TrendStack } from './TrendLinesCard';
import RequestTab from './RequestTab';
import ContactTab from './ContactTab';
import DrillDownCard from './DrillDownCard';
import RecruiterAppsCard from './RecruiterAppsCard';
import { drillTreeOf } from '@/lib/recruitDrill';
import { aiOfJobs, backlogOfJobs, staffOfJobs } from '@/lib/recruitOverviewScope';
import { placementOfRequests } from '@/lib/channelPlacement';
import { toYmdBangkok } from '@/lib/dateTh';

/**
 * ═══ แท็บ "ภาพรวม" ของกล่องงาน = ภาพรวมงานสรรหาแบบ iRecruit (เจ้าของสั่ง 30 ก.ย. 2569) ═══
 *
 * > *"ทำหน้าภาพรวมให้เหมือน iRecruit ต่อเลย"* → Choice **"ทั้งหน้าเป็น iRecruit"** (ถอดส่วนเดิมออก) ·
 * > **"เลือกเดือนแบบ iRecruit"** · นับโทร/ติดต่อสำเร็จ **AI + คน** แยกบรรทัดล่าง · *"บอกว่า มีกี่ใบที่ประกาศไป แล้วมีรายชื่อมา
 * > เท่าไหร่ Ai โทรไปให้ทั้งหมดเท่าไหร่ เหลือสนใจแล้วคนมาโทรอีกเท่าไหร่ … ต้องบอกด้วยว่า กรอกมาวันนี้โดนโทรวันไหน
 * > จะนับเป็นวันต้องครบ 24 ชม นะถึงจะนับเป็น 1 วัน"*
 *
 * วางตามภาพ iRecruit: การ์ด 6 ใบ · เส้นทาง (ของเราคือเส้นทางของรายชื่อ) + งานค้างตอนนี้ · รายวัน · ช่องทาง + ตำแหน่ง ·
 * เหตุผลที่ไม่สำเร็จ · ผลงานรายคน · ปุ่ม "วิธีอ่าน" ถอดแล้ว (เจ้าของ 19 ต.ค. 2569 "เอาออก")
 * 🔴 ตัวเลขทุกตัวมาจาก `src/lib/recruitOverview.ts` (มีเทสต์) · แผงเดิม (`BoardDashboard`) ยังเปิดได้ที่ `?dash=classic` (ทางถอย)
 * แยก 4 แท็บ (เจ้าของ 21 ต.ค. 2569 · Choice "แบ่งตามขั้น"): ใบขอ · กรอกเข้ามา · การติดต่อ · นัดหมาย — `?ov=` · ช่วงเวลาตัวเดียวใช้ทุกแท็บ
 */

type Load = { data: RecruitOverviewResponse | null; loading: boolean; error: string | null };

/** n วันล่าสุดถึงวันนี้ (ปฏิทินไทย) */
function lastDays(n: number): DateRangeYmd {
  const to = toYmdBangkok(new Date());
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (n - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to };
}


/** แท่งซ้อนของแนวโน้มใบขอ — ยกเลิก + ปิดแล้ว + ยังไม่ประกาศ + ไม่มีคนกรอก + มีคนกรอก = ใบขอเข้ามา (ตัวแบ่งเดียวกับการ์ดบน · 30 ต.ค. 2569) */
const REQUEST_STACK: TrendStack = {
  total: 'total',
  parts: [
    { key: 'cancelled', tone: 'danger' },
    { key: 'closed', tone: 'success' },
    { key: 'notReleased', tone: 'warn' },
    { key: 'releasedNoApps', tone: 'neutral' },
    { key: 'releasedWithApps', tone: 'info' },
  ],
};

/**
 * ชุดตัวเลขของแท็บจากรายชื่อชุดหนึ่ง — ทั้งหน้า (ไม่กรอง) และแท็บภาพรวม Online ที่ตามตัวกรองบนสุด (QA 30 ต.ค. 2569
 * "ตัวกรองภาพรวม Online ไปถึงทุกการ์ด") ใช้ตัวเดียวกัน
 */
function overviewViewOf(list: readonly RecruitAppFact[], data: RecruitOverviewResponse, win: RecruitOverviewResponse['window']) {
  const cur = totalsOf(list, win.from, win.to);
  /**
   * 🔴 เทียบเดือนก่อน **เฉพาะตอนข้อมูลมีครบทั้งช่วงก่อน** (กับดักเดียวกับหน้าทีม Online: เคยขึ้น "เพิ่ม 1,400%"
   * เพราะข้อมูลเพิ่งเริ่มกลางช่วงก่อน) — ข้อมูลเริ่มกลางเดือนก่อน/ยังไม่มีเลย = ไม่เทียบ แล้วบอกเหตุบนหัว
   */
  const prevFull = !!data.firstDay && data.firstDay <= win.prevFrom;
  const prevList = win.isCurrent ? trimLastDayToNow(list, win.prevTo, data.generatedAt) : list;
  const prev = prevFull ? totalsOf(prevList, win.prevFrom, win.prevTo) : null;
  const cohort = cohortOf(list, win.from, win.to);
  return {
    cur,
    prev,
    /** รายชื่อของช่วงนี้/ช่วงก่อน — กราฟรายวันในการ์ดเทียบ (21 ต.ค. 2569) */
    list,
    prevList,
    /** รายชื่อที่กรอกในช่วง — ต้นไม้กดลงลึก (21 ต.ค. 2569) */
    cohort,
    /** ข้อมูลเริ่มกลางช่วงก่อน (ไม่ใช่ไม่มีเลย) */
    prevPartial: !prevFull && !!data.firstDay && data.firstDay <= win.prevTo,
    journey: buildRecruitJourney(cohort),
    delay: delayRows(cohort),
    daily: dailyRows(cohort, win.from, win.to),
    channels: buildChannelFunnelTree(cohort),
  };
}

const RecruitOverview: React.FC<{
  /**
   * 🔴 ยอด "ประกาศ" จากหัวกล่องงาน (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) — หน้าแม่ส่งมา
   * สถานะตอนนี้ ไม่ขึ้นกับเดือน · `null`/ไม่ส่ง = ยังบอกไม่ได้ ("—")
   */
  published?: BoardPublishedTotals | null;
}> = () => {
  const [searchParams] = useSearchParams();
  /** null = เดือนนี้ (ให้เส้นตัดสินจากวันไทยของ server) */
  const [month, setMonthState] = useState<string | null>(null);
  /**
   * ช่วงที่เลือกเอง — รายวันหรือช่วง (เจ้าของสั่ง 5 ต.ค. 2569: *"อยากดูแบบรายวันหรือ ช่วงได้ด้วย"*)
   * มีค่า = ไม่ใช้เดือน · เลือกเดือนจากปุ่มเดือน = กลับแบบเดือน
   */
  // ค่าเริ่ม = เดือนนี้ (null) ทุกหน้าเหมือนกัน (เจ้าของ 9 พ.ย. 2569 Choice "เดือนนี้" · แทน 7 วันล่าสุดของ 21 ต.ค.) · เลือกเดือน/วัน/ช่วงได้จากปุ่มช่วงเวลา
  // ลิงก์ที่พา `?from&to` มา (ปุ่มรายงานเดิมของโฉมต้นแบบ) = เปิดที่ช่วงนั้น ไม่ใช่เดือนนี้
  const [range, setRange] = useState<(DateRangeYmd & { all?: boolean }) | null>(() => rangeFromParams(searchParams));
  /** ป๊อปเลือกช่วง — ปุ่มลัด (7/30 วัน · ทั้งหมด) เลือกแล้วปิดเอง */
  const [periodOpen, setPeriodOpen] = useState(false);
  const pickRange = (r: DateRangeYmd & { all?: boolean }) => {
    setRange(r);
    setPeriodOpen(false);
  };
  const setMonth = (m: string) => {
    setRange(null);
    setMonthState(m);
  };
  const [rev, setRev] = useState(0);
  /** BU ที่เลือก — เฉพาะผู้ใช้ที่ดูได้หลาย BU (26 ต.ค. 2569) · null = ผลรวมทุก BU ในสิทธิ์ (เจ้าของ 29 ต.ค. 2569) */
  const [pickedBu, setPickedBu] = useState<string | null>(() => searchParams.get('bu') || null);
  const [state, setState] = useState<Load>({ data: null, loading: true, error: null });

  /**
   * โฉมใหม่ (เจ้าของ 4 พ.ย. 2569 นิยามเอง "เอาทำเลย") = ค่าเริ่ม · โฉมการ์ดเดิมยังเปิดได้ที่ `?dash=cards` (ทางถอย ห้ามลบจนกว่าเจ้าของสั่ง)
   */
  const legacyCards = searchParams.get('dash') === 'cards';
  /** โฉมต้นแบบ SO Recruit (เจ้าของ 10 พ.ย. 2569 ชุดส่งต่อ · `&dash=v5`) — ชั้นคู่ขนาน รอตรวจรับ */
  const v5 = searchParams.get('dash') === 'v5';
  const v5Style = useV5ThemeStyle();

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    // ใบขอติดตรงไหน (โฉมใหม่) ยิงพร้อมกันเลย ไม่ต้องรอก้อนนี้เสร็จ — ช่วงคิดด้วยตัวเดียวกับ server (10 พ.ย. 2569 หน้าช้า)
    if (!legacyCards) {
      const today = toYmdBangkok(new Date());
      const w = (range ? rangeWindow(range.from, range.to, today, range.all === true) : null) ?? monthWindow(month, today);
      prefetchRecruitStuck(pickedBu, { from: w.from, to: w.to });
    }
    fetchRecruitOverview(month, range, pickedBu)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      // ล้มแล้วห้ามค้างเลขรอบก่อนพร้อม "ข้อมูล ณ …" (QA 18 ต.ค. 2569) ⇒ ล้างแล้วขึ้นกล่องล้ม + ลองใหม่
      .catch((e: unknown) => !cancelled && setState({ data: null, loading: false, error: friendlyErrorText(e, 'โหลดภาพรวมไม่ได้') }));
    return () => {
      cancelled = true;
    };
  }, [month, range, rev, pickedBu, legacyCards]);

  const data = state.data;
  const win = data?.window ?? null;
  // "ทั้งหมด" เริ่มที่วันแรกของข้อมูล — สลับ BU แล้ววันแรกเปลี่ยน ให้ขยับตาม
  useEffect(() => {
    if (range?.all && data?.firstDay && data.window.all && data.firstDay !== range.from) setRange({ ...range, from: data.firstDay });
  }, [range, data]);
  const apps = data?.apps ?? null;

  /** ป๊อปรายชื่อของเลขที่กดในเส้นทาง */
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);

  const view = useMemo(() => (data && win ? overviewViewOf(apps ?? [], data, win) : null), [data, win, apps]);

  if (!data || !win || !view) {
    // ล้มแล้วมีปุ่มลองใหม่ (QA 5 ต.ค. 2569: เดิมเหลือข้อความอังกฤษดิบบรรทัดเดียว กดอะไรต่อไม่ได้)
    if (state.error) return <TrendState loading={false} error={state.error} onRetry={() => setRev((n) => n + 1)} />;
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const current = data.today.slice(0, 7);
  const options = monthOptions(data.firstDay ? data.firstDay.slice(0, 7) : null, current);
  /** แบบช่วง: ‹ › เลื่อนทีละความยาวช่วง (วันเดียว = ทีละวัน) · ห้ามเลยวันนี้/ก่อนวันแรกที่มีข้อมูล */
  const isRange = Boolean(win.range);
  const prevRange = shiftRange(win, -1);
  const canPrev = isRange ? !data.firstDay || prevRange.to >= data.firstDay : options.includes(shiftMonth(win.month, -1));
  const canNext = isRange ? win.to < data.today : win.month < current;
  const goPrev = () => (isRange ? setRange(prevRange) : setMonth(shiftMonth(win.month, -1)));
  const goNext = () => (isRange ? setRange(shiftRange(win, 1)) : setMonth(shiftMonth(win.month, 1)));
  /** คำเรียกช่วงในหัวการ์ด — แบบเดือน "เดือนนี้" · แบบช่วง "ช่วงนี้" */
  const period = isRange ? 'ช่วงนี้' : 'เดือนนี้';
  const prevWord = isRange ? 'ช่วงก่อน' : 'เดือนก่อน';
  const appsError = data.errors.apps ?? null;
  const periodLabel = win.all ? 'ทั้งหมด' : isRange ? rangeText({ from: win.from, to: win.to }) : monthLabel(win.month);
  /** ปุ่มลัด 7/30 วันล่าสุด กดอยู่ไหม */
  const isLast = (n: number) => {
    const r = lastDays(n);
    return isRange && !win.all && win.from === r.from && win.to === r.to;
  };
  const ymdDate = (ymd: string) => {
    const p = parseYmd(ymd);
    return p ? new Date(p.y, p.m - 1, p.d) : undefined;
  };
  const todayDate = ymdDate(data.today);

  /** การ์ดเทียบช่วงก่อนของแต่ละแท็บ — แบบเดือน = ชื่อเดือนเทียบกัน · แบบช่วง = ช่วงวันเทียบกัน (21 ต.ค. 2569) */
  const curPeriodLabel = isRange ? rangeText({ from: win.from, to: win.to }) : monthLabel(win.month);
  const prevPeriodLabel = isRange ? rangeText({ from: win.prevFrom, to: win.prevTo }) : monthLabel(shiftMonth(win.month, -1));
  /**
   * การ์ดเทียบช่วงก่อนของแท็บ · `v` = ชุดรายชื่อ (แท็บภาพรวม Online ส่งชุดที่ผ่านตัวกรองบนสุด)
   * แท็บใบขอ: นับจากใบรายใบชุดเดียวกับการ์ด "ใบขอเข้ามา" (`requestTrendRows` · QA 30 ต.ค. 2569 "ให้กราฟนับเหมือนการ์ดบน")
   * กล่องของการ์ดนี้ไม่กดแล้ว — กล่องเดียวกันบนการ์ด "ใบขอเข้ามา" ด้านบนกดดูรายการใบได้
   */
  const compareCard = (t: OverviewTabId, v: NonNullable<typeof view> = view!, req?: { rows: RecruitRequestRow[] | null; prevRows: RecruitRequestRow[] | null }) => (
    <TrendLinesCard
      key={`${t}-${win.from}-${win.to}`}
      monthly={Boolean(win.all)}
      {...(t === 'requests' ? { title: 'แนวโน้มใบขอ', stack: REQUEST_STACK } : {})}
      rows={t === 'requests' ? requestTrendRows(req?.rows ?? null, req?.prevRows ?? null) : compareRowsOf(t, v.cur, v.prev, data.requests, data.requestsPrev)}
      curLabel={curPeriodLabel}
      prevLabel={prevPeriodLabel}
      note={
        t !== 'requests' && !v.prev
          ? v.prevPartial && data.firstDay
            ? `ไม่เทียบ${prevWord} ข้อมูลเพิ่งเริ่ม ${rangeText({ from: data.firstDay, to: data.firstDay })}`
            : `${prevWord}ยังไม่มีข้อมูล`
          : win.isCurrent && !isRange
            ? `เทียบช่วงวันเท่ากัน ${rangeText({ from: win.prevFrom, to: win.prevTo })}`
            : null
      }
      seriesOf={(key: string, period: ComparePeriod) =>
        t === 'requests'
          ? period === 'cur'
            ? requestTrendSeries(key, win.from, win.to, req?.rows ?? null)
            : requestTrendSeries(key, win.prevFrom, win.prevTo, req?.prevRows ?? null)
          : period === 'cur'
            ? dailySeriesOf(key, win.from, win.to, v.list, data.requestDays)
            : dailySeriesOf(key, win.prevFrom, win.prevTo, v.prevList, data.requestDays)
      }
    />
  );

  /** การ์ดกดลงลึก (ไอเดียเพื่อนเจ้าของ · 21 ต.ค. 2569) — key ผูกช่วง เปลี่ยนแล้วกลับชั้นบนสุด */
  const drillCard = (t: OverviewTabId, title: string, v: NonNullable<typeof view> = view!) => (
    <DrillDownCard
      key={`drill-${t}-${win.from}-${win.to}`}
      title={title}
      root={drillTreeOf(t, v.cohort, data.requestList)}
      onOpenNames={(title2, ids) => setNames({ title: title2, ids })}
    />
  );

  const compareNote = [
    win.all
      ? rangeText({ from: win.from, to: win.to })
      : view.prev
      ? `เทียบกับ ${rangeText({ from: win.prevFrom, to: win.prevTo })}`
      : view.prevPartial && data.firstDay
        ? `ไม่เทียบ${prevWord} ข้อมูลเพิ่งเริ่ม ${rangeText({ from: data.firstDay, to: data.firstDay })}`
        : `${prevWord}ยังไม่มีข้อมูล`,
    `ข้อมูล ณ ${shortTime(data.generatedAt)} น.`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div
      className={cn(v5 ? '-mx-4 min-h-screen space-y-6 bg-background px-4 py-6 text-foreground sm:-mx-6 sm:px-6' : 'space-y-3', state.loading && 'opacity-70')}
      style={v5 ? v5Style : undefined}
      data-testid={v5 ? 'recruit-v5' : undefined}
    >
      {v5 ? (
        <div className="space-y-1">
          <h1 className="text-3xl font-medium tracking-tight">ภาพรวมงานสรรหา</h1>
          <p className="text-sm text-muted-foreground">เห็นงานค้าง คนรับผิดชอบ และสิ่งที่ต้องทำต่อ</p>
        </div>
      ) : null}
      {/* ─── หัว: ชื่อ + ปุ่มช่วงเวลาปุ่มเดียว (เจ้าของ 19 ต.ค. 2569 "รวมกันเลย" · 28 ต.ค. เหลือ เดือน · วันที่ · 7/30 วันล่าสุด) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {v5 ? <span className="text-xs text-muted-foreground">กดตัวเลขเพื่อดูรายการ แล้วกดชื่อเพื่อดูสิ่งที่ต้องทำต่อ</span> : <h2 className="text-base font-medium text-foreground">ภาพรวมงานสรรหา</h2>}
        <div className="flex flex-wrap items-center gap-2">
          <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
            <PopoverTrigger asChild>
              <Button type="button" size="xs" variant="outline" aria-label="เลือกช่วงเวลา" data-testid="recruit-period">
                <CalendarDays aria-hidden />
                <span className="tabular-nums">{periodLabel}</span>
                <ChevronDown className="opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            {/* มือถือ: ไม่ล้นจอ (เลื่อนในกล่อง) · เลือกปุ่มลัดแล้วปิดเอง (QA 30 ต.ค. 2569) */}
            <PopoverContent align="end" collisionPadding={16} className="max-h-dvh w-80 space-y-4 overflow-y-auto p-4">
              <div className="space-y-2">
                <p className={cn('text-xs', DASH.sub)}>เดือน</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="iconXs"
                    variant="outline"
                    aria-label={isRange ? 'ช่วงก่อน' : 'เดือนก่อน'}
                    disabled={!canPrev}
                    onClick={goPrev}
                  >
                    <ChevronLeft aria-hidden />
                  </Button>
                  <ChoiceDropdown
                    value={win.month}
                    options={options.map((m) => ({ value: m, label: monthLabel(m) }))}
                    onChange={(m) => setMonth(m)}
                    ariaLabel="เลือกเดือน"
                  />
                  <Button
                    type="button"
                    size="iconXs"
                    variant="outline"
                    aria-label={isRange ? 'ช่วงถัดไป' : 'เดือนถัดไป'}
                    disabled={!canNext}
                    onClick={goNext}
                  >
                    <ChevronRight aria-hidden />
                  </Button>
                </div>
              </div>
              {/*
               * เจ้าของ 28 ต.ค. 2569 "เอาเป็นตัวเลขให้เลือก มีไว้แค่นี้ — เดือน · วันที่เป็นตัวเลข · 7 วันล่าสุด 30 วันล่าสุด"
               * (ถอด "เฉพาะวัน" จ.–อา. ออกทั้งหน้า) · กดวันเดียว = รายวัน · กดวันที่สอง = ช่วง
               */}
              <div className="space-y-2" data-testid="recruit-days">
                <p className={cn('text-xs', DASH.sub)}>วันที่</p>
                <Calendar
                  mode="range"
                  className="p-0"
                  selected={isRange ? { from: ymdDate(win.from), to: ymdDate(win.to) } : undefined}
                  defaultMonth={ymdDate(isRange ? win.to : `${win.month}-01`)}
                  disabled={todayDate ? { after: todayDate } : undefined}
                  onSelect={(r) => {
                    if (!r?.from) return;
                    const from = toYmdLocal(r.from);
                    setRange({ from, to: r.to ? toYmdLocal(r.to) : from });
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="xs" variant={isLast(7) ? 'default' : 'outline'} onClick={() => pickRange(lastDays(7))} data-testid="recruit-last7">
                  7 วันล่าสุด
                </Button>
                <Button type="button" size="xs" variant={isLast(30) ? 'default' : 'outline'} onClick={() => pickRange(lastDays(30))} data-testid="recruit-last30">
                  30 วันล่าสุด
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={win.all ? 'default' : 'outline'}
                  onClick={() => pickRange({ from: data.firstDay ?? data.today, to: data.today, all: true })}
                  data-testid="recruit-all"
                >
                  ทั้งหมด
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)}>
            <RefreshCw className={cn(state.loading && 'animate-spin')} aria-hidden /> โหลดใหม่
          </Button>
        </div>
      </div>

      <div className={cn('flex flex-wrap items-center justify-between gap-2 text-xs', DASH.sub)}>
        {data.buChoices?.length ? (
          <div className="w-28">
            <BuChoiceSelect value={data.bu} choices={data.buChoices} onChange={setPickedBu} allOption triggerClassName="h-8 text-xs" itemClassName="text-xs" />
          </div>
        ) : (
          <span>{data.bu ? `เฉพาะ BU ${data.bu}` : 'ทุก BU'}</span>
        )}
        <span className="tabular-nums">{compareNote}</span>
      </div>

      {state.error ? <SectionError message={state.error} onRetry={() => setRev((n) => n + 1)} /> : null}
      {appsError ? <SectionError message={appsError} /> : null}

      {/*
       * หน้าเดียว (เจ้าของ 4 พ.ย. 2569 "เอา 3 แท็บมันรวมกันเลย … filter เปลี่ยน ข้อมูลเปลี่ยนตาม Filter เป็นเหมือน query")
       * ตัวกรองบนสุด (รวมเจ้าหน้าที่สรรหา) คุมทุกการ์ด · การติดต่อ / นัดหมาย เรียงต่อท้าย พับไว้ กดกางค่อยโชว์
       * การ์ดที่นับฝั่งเซิร์ฟเวอร์ (งานค้างตอนนี้ · ผลงานรายคน · คนแจ้งเข้า) ตามตัวกรองด้วย — เซิร์ฟเวอร์ส่งแยกต่อใบขอ (`recruitOverviewScope.ts`)
       */}
      {legacyCards ? null : (
        <RecruitStuckBody
          layout={v5 ? 'v5' : undefined}
          data={data}
          win={win}
          onOpenNames={(title, ids) => setNames({ title, ids })}
          onPickMonth={(m) => setMonth(m)}
        />
      )}
      {legacyCards ? (
      <div className="space-y-3">
          <RequestTab
            appJobs={data.appJobs}
            rows={data.requestRows ?? null}
            prevRows={data.requestRowsPrev ?? null}
            rowsError={data.errors.requests ?? null}
            apps={view.cohort}
            trend={(sc) => compareCard('requests', view, { rows: sc.rows, prevRows: sc.prevRows })}
            scoped={(scopedApps, channel) => (
              // ตามตัวกรองบนสุด + ช่องทางที่กดในตาราง "คนที่กรอกมา" (เจ้าของ 29 ต.ค. 2569 "ไม่ได้บอกช่องทางหรอ")
              // ฐาน = ทุกรายชื่อ (เส้นทางขั้น 4 นับเฉพาะคนที่ตอบ AI ว่าสนใจ — QA 18 ต.ค. 2569 เลขเลยต่างกัน)
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <OverviewCard icon={Briefcase} title="ตำแหน่งที่สมัคร" sub={channel ? `10 อันดับ · ${channel}` : '10 อันดับ'}>
                  <PositionList rows={positionRows(scopedApps)} />
                </OverviewCard>
                <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub={channel ?? 'ทุกช่องทาง'} className="lg:col-span-2">
                  <ReasonColumns groups={reasonGroups(scopedApps)} />
                </OverviewCard>
              </div>
            )}
          >
            {(sc) => {
              // ตามตัวกรองบนสุด (QA 30 ต.ค. 2569) — ไม่กรอง = ชุดเดิมของทั้งหน้า
              const fv = sc.active ? overviewViewOf(sc.appsOf(apps ?? []), data, win) : view;
              // การ์ดที่นับฝั่งเซิร์ฟเวอร์ ตามตัวกรองด้วย (เจ้าของ 4 พ.ย. 2569) — รวมเฉพาะใบขอที่ผ่าน `sc.jobOk` · ไม่กรอง = ยอดรวมเดิม
              const backlog = data.backlog && sc.active && data.backlogByJob ? backlogOfJobs(data.backlogByJob, sc.jobOk, data.backlog) : data.backlog;
              const staff = data.staff && sc.active && data.staffByJob ? staffOfJobs(data.staffByJob, sc.jobOk) : data.staff;
              const ai = data.ai && sc.active && data.aiByJob ? aiOfJobs(data.aiByJob, sc.jobOk) : data.ai;
              const placementFiltered = Boolean(sc.active && data.channelPlacement?.byRequest);
              const placement =
                data.channelPlacement && placementFiltered ? placementOfRequests(data.channelPlacement, (rq) => sc.jobOk(`siamraj-sql:${rq}`)) : data.channelPlacement;
              return (
                <>
              {compareCard('apps', fv)}
              {drillCard('apps', 'รายชื่อที่กรอกมา', fv)}
              {/* เป็นงานของใคร → ใบไหน (เจ้าของ 4 พ.ย. 2569 "แบงค์ เข้ามา 50 คน แบ่งเป็น งาน ก 5 ข 5 ค 40") */}
              <RecruiterAppsCard
                apps={fv.cohort}
                jobs={data.appJobs}
                jobsError={data.errors.appJobs ?? null}
                onOpenNames={(title, ids) => setNames({ title, ids })}
              />
              {/* งานค้างของขั้นนี้ ณ วันนี้ (ย้ายจากแท็บใบขอ · เจ้าของ 29 ต.ค. 2569 "ย้ายไปให้ถูกเรื่องของมัน") */}
              <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
                {backlog ? <BacklogBody backlog={backlog} only="uncalled" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
              </OverviewCard>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                <OverviewCard icon={Timer} title="กรอกแล้วโทรวันไหน">
                  {apps ? <DelayList rows={fv.delay} /> : <EmptyNote>{`ยังไม่มีรายชื่อใน${period}`}</EmptyNote>}
                </OverviewCard>
                <div className="min-w-0 lg:col-span-2">
                  <DailyCard rows={fv.daily} icon={BarChart3} />
                </div>
              </div>
              {/* ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 "facebook ad 200 สนใจ 100 … มา 10" + "จับได้ถึงแจ้งเข้า") */}
              <OverviewCard
                icon={Megaphone}
                title="รายชื่อที่กรอกในช่วงนี้ ไปถึงไหนแยกช่องทาง"
                sub={data.errors.informs ? 'อ่านแจ้งเข้า ERP ไม่ได้' : undefined}
              >
                <ChannelFunnelTable groups={fv.channels.groups} total={fv.channels.total} onOpen={(title, ids) => setNames({ title, ids })} />
              </OverviewCard>

              {/* ─── การติดต่อ (เดิมแท็บ "การติดต่อ" · 29 ต.ค. 2569): คนที่สนใจ โทรแล้วเป็นไง · รายคนที่เก็บไป · แยกช่องทาง ─── */}
              <FoldSection title="การติดต่อ" testId="recruit-ov-contact">
                <ContactTab apps={fv.cohort} onOpenNames={(title, ids) => setNames({ title, ids })}>
                  {compareCard('staff', fv)}
                  {drillCard('staff', 'การติดต่อ', fv)}
                  <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
                    {backlog ? <BacklogBody backlog={backlog} only="waiting" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
                  </OverviewCard>
                  <OverviewCard icon={Users} title="ผลงานรายคน" sub="งานที่ลงผลในช่วงนี้">
                    {staff ? <StaffTable staff={staff} ai={ai} /> : <SectionError message={data.errors.staff ?? 'อ่านผลงานรายคนไม่ได้'} />}
                  </OverviewCard>
                </ContactTab>
              </FoldSection>

              {/* ─── นัดหมาย (เดิมแท็บ "นัดหมาย"): นัด · มาไหม + คนแจ้งเข้ามาจากช่องทางไหน ─── */}
              <FoldSection title="นัดหมาย" testId="recruit-ov-appt">
                {compareCard('appt', fv)}
                {drillCard('appt', 'นัดหมาย', fv)}
                <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
                  {backlog ? <BacklogBody backlog={backlog} only="appointments" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
                </OverviewCard>
                {/* ช่องทางที่ได้คนลงงาน (เจ้าของ 19 ต.ค. 2569 — ทีม Online ดูว่าเด็กมาจากไหน ลงงานจากช่องทางไหนเยอะ) */}
                <OverviewCard icon={Megaphone} title="คนแจ้งเข้าในช่วงนี้ มาจากช่องทางไหน" sub={placementFiltered ? 'นับตามวันแจ้งเข้า' : 'นับตามวันแจ้งเข้า · ทุก BU'}>
                  {placement ? (
                    <ChannelPlacementTable data={placement} placedOnly={placementFiltered} />
                  ) : (
                    <SectionError message={data.errors.channels ?? 'อ่านช่องทางไม่ได้'} />
                  )}
                </OverviewCard>
              </FoldSection>
                </>
              );
            }}
          </RequestTab>
      </div>
      ) : null}

      <JourneyNamesDialog
        open={names !== null}
        onOpenChange={(o) => !o && setNames(null)}
        title={names?.title ?? ''}
        ids={names?.ids ?? []}
        contentStyle={v5 ? v5Style : undefined}
      />
    </div>
  );
};

export default RecruitOverview;

/** ส่วนที่พับไว้ — กดหัวแล้วค่อยกาง (เจ้าของ 4 พ.ย. 2569 "ย่อไว้ก็ได้กดกางค่อยโชว์") · พับอยู่ = การ์ดข้างในยังไม่วาด */
function FoldSection({ title, testId, children }: { title: string; testId: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card p-3" data-testid={testId}>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" className="h-10 w-full justify-between px-2 text-base font-medium">
          {title}
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

