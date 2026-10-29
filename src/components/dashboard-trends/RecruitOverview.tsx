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
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { rangeText } from '@/lib/teamOnline';
import { shortTime } from '@/lib/dateTh';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { monthLabel, monthOptions, shiftMonth, shiftRange } from '@/lib/recruitOverviewWindow';
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
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
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
import ChannelPlacementTable from './ChannelPlacementTable';
import ChannelFunnelTable from './ChannelFunnelTable';
import { buildChannelFunnelTree } from '@/lib/channelFunnel';
import { OVERVIEW_TABS, overviewTabOf, type OverviewTabId } from '@/lib/recruitOverviewTabs';
import { compareRowsOf, dailySeriesOf } from '@/lib/recruitCompare';
import TrendLinesCard, { type ComparePeriod } from './TrendLinesCard';
import RequestTab from './RequestTab';
import DrillDownCard from './DrillDownCard';
import { drillTreeOf } from '@/lib/recruitDrill';
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

/** กล่องบนการ์ดแนวโน้มใบขอ → ชั้นของต้นไม้ใบขอ (`drillTreeOf('requests')`) · ไม่มีในนี้ = กดไม่ได้ */
const REQUEST_DRILL_PATH: Record<string, string[]> = {
  total: [],
  released: ['released'],
  releasedWithApps: ['released', 'withApps'],
  releasedNoApps: ['released', 'noApps'],
  notReleasedOpen: ['notReleased'],
};

const RecruitOverview: React.FC<{
  /**
   * 🔴 ยอด "ประกาศ" จากหัวกล่องงาน (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) — หน้าแม่ส่งมา
   * สถานะตอนนี้ ไม่ขึ้นกับเดือน · `null`/ไม่ส่ง = ยังบอกไม่ได้ ("—")
   */
  published?: BoardPublishedTotals | null;
}> = () => {
  /** null = เดือนนี้ (ให้เส้นตัดสินจากวันไทยของ server) */
  const [month, setMonthState] = useState<string | null>(null);
  /**
   * ช่วงที่เลือกเอง — รายวันหรือช่วง (เจ้าของสั่ง 5 ต.ค. 2569: *"อยากดูแบบรายวันหรือ ช่วงได้ด้วย"*)
   * มีค่า = ไม่ใช้เดือน · เลือกเดือนจากปุ่มเดือน = กลับแบบเดือน
   */
  // ค่าเริ่ม = 7 วันล่าสุด เทียบ 7 วันก่อนหน้า (เจ้าของ 21 ต.ค. 2569 "Default เป็น 7 วันย้อนหลัง") · เลือกเดือน/วัน/ช่วงได้จากปุ่มช่วงเวลา
  const [range, setRange] = useState<(DateRangeYmd & { all?: boolean }) | null>(() => lastDays(7));
  const setMonth = (m: string) => {
    setRange(null);
    setMonthState(m);
  };
  const [rev, setRev] = useState(0);
  /** BU ที่เลือก — เฉพาะผู้ใช้ที่ดูได้หลาย BU (26 ต.ค. 2569) · null = BU หลัก */
  const [pickedBu, setPickedBu] = useState<string | null>(null);
  const [state, setState] = useState<Load>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRecruitOverview(month, range, pickedBu)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      // ล้มแล้วห้ามค้างเลขรอบก่อนพร้อม "ข้อมูล ณ …" (QA 18 ต.ค. 2569) ⇒ ล้างแล้วขึ้นกล่องล้ม + ลองใหม่
      .catch((e: unknown) => !cancelled && setState({ data: null, loading: false, error: friendlyErrorText(e, 'โหลดภาพรวมไม่ได้') }));
    return () => {
      cancelled = true;
    };
  }, [month, range, rev, pickedBu]);

  const data = state.data;
  const win = data?.window ?? null;
  // "ทั้งหมด" เริ่มที่วันแรกของข้อมูล — สลับ BU แล้ววันแรกเปลี่ยน ให้ขยับตาม
  useEffect(() => {
    if (range?.all && data?.firstDay && data.window.all && data.firstDay !== range.from) setRange({ ...range, from: data.firstDay });
  }, [range, data]);
  const apps = data?.apps ?? null;

  /** ป๊อปรายชื่อของเลขที่กดในเส้นทาง */
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);
  /** กล่องที่กดในการ์ดแนวโน้มใบขอ (27 ต.ค. 2569 รวมการ์ดใบขอเข้ามา) — null = ไม่ได้กด */
  const [reqPick, setReqPick] = useState<string | null>(null);
  /** แท็บย่อย — จำใน URL (`?ov=`) ส่งลิงก์ให้กันได้ · ค่าแปลก = ใบขอ */
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = overviewTabOf(searchParams.get('ov'));
  const setTab = (v: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (v === OVERVIEW_TABS[0].id) next.delete('ov');
        else next.set('ov', v);
        return next;
      },
      { replace: true },
    );

  const view = useMemo(() => {
    if (!data || !win) return null;
    const list = apps ?? [];
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
      positions: positionRows(cohort),
      reasons: reasonGroups(cohort),
    };
  }, [data, win, apps]);

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
  const compareCard = (t: OverviewTabId) => (
    <TrendLinesCard
      key={`${t}-${win.from}-${win.to}`}
      {...(t === 'requests'
        ? {
            title: 'แนวโน้มใบขอ',
            picked: reqPick,
            onPick: setReqPick,
            // ปิดไปแล้ว = นับอย่างเดียว ไม่เปิดรายการ (เจ้าของ "ถ้าปิดก็คือปิด")
            pickable: (k: string) => k in REQUEST_DRILL_PATH,
            children:
              reqPick && REQUEST_DRILL_PATH[reqPick] ? (
                <DrillDownCard
                  key={`drill-req-${reqPick}-${win.from}-${win.to}`}
                  title="ใบขอ"
                  bare
                  path={REQUEST_DRILL_PATH[reqPick]}
                  root={drillTreeOf('requests', view.cohort, data.requestList)}
                  onOpenNames={(title2, ids) => setNames({ title: title2, ids })}
                />
              ) : null,
          }
        : {})}
      rows={compareRowsOf(t, view.cur, view.prev, data.requests, data.requestsPrev)}
      curLabel={curPeriodLabel}
      prevLabel={prevPeriodLabel}
      note={
        t !== 'requests' && !view.prev
          ? view.prevPartial && data.firstDay
            ? `ไม่เทียบ${prevWord} ข้อมูลเพิ่งเริ่ม ${rangeText({ from: data.firstDay, to: data.firstDay })}`
            : `${prevWord}ยังไม่มีข้อมูล`
          : win.isCurrent && !isRange
            ? `เทียบช่วงวันเท่ากัน ${rangeText({ from: win.prevFrom, to: win.prevTo })}`
            : null
      }
      seriesOf={(key: string, period: ComparePeriod) =>
        period === 'cur'
          ? dailySeriesOf(key, win.from, win.to, view.list, data.requestDays)
          : dailySeriesOf(key, win.prevFrom, win.prevTo, view.prevList, data.requestDays)
      }
    />
  );

  /** การ์ดกดลงลึก (ไอเดียเพื่อนเจ้าของ · 21 ต.ค. 2569) — key ผูกช่วง เปลี่ยนแล้วกลับชั้นบนสุด */
  const drillCard = (t: OverviewTabId, title: string) => (
    <DrillDownCard
      key={`drill-${t}-${win.from}-${win.to}`}
      title={title}
      root={drillTreeOf(t, view.cohort, data.requestList)}
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
    <div className={cn('space-y-3', state.loading && 'opacity-70')}>
      {/* ─── หัว: ชื่อ + ปุ่มช่วงเวลาปุ่มเดียว (เจ้าของ 19 ต.ค. 2569 "รวมกันเลย" · 28 ต.ค. เหลือ เดือน · วันที่ · 7/30 วันล่าสุด) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">ภาพรวมงานสรรหา</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" size="xs" variant="outline" aria-label="เลือกช่วงเวลา" data-testid="recruit-period">
                <CalendarDays aria-hidden />
                <span className="tabular-nums">{periodLabel}</span>
                <ChevronDown className="opacity-60" aria-hidden />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 space-y-4 p-4">
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
                <Button type="button" size="xs" variant={isLast(7) ? 'default' : 'outline'} onClick={() => setRange(lastDays(7))} data-testid="recruit-last7">
                  7 วันล่าสุด
                </Button>
                <Button type="button" size="xs" variant={isLast(30) ? 'default' : 'outline'} onClick={() => setRange(lastDays(30))} data-testid="recruit-last30">
                  30 วันล่าสุด
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={win.all ? 'default' : 'outline'}
                  onClick={() => setRange({ from: data.firstDay ?? data.today, to: data.today, all: true })}
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
          <div className="w-44">
            <BuChoiceSelect value={data.bu} choices={data.buChoices} onChange={setPickedBu} triggerClassName="h-8 text-xs" itemClassName="text-xs" />
          </div>
        ) : (
          <span>{data.bu ? `เฉพาะ BU ${data.bu}` : 'ทุก BU'}</span>
        )}
        <span className="tabular-nums">{compareNote}</span>
      </div>

      {state.error ? <SectionError message={state.error} onRetry={() => setRev((n) => n + 1)} /> : null}
      {appsError ? <SectionError message={appsError} /> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList variant="glass" className="h-10 max-w-full justify-start overflow-x-auto" aria-label="ภาพรวมแยกขั้น">
          {OVERVIEW_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="rounded-full px-4" data-testid={`recruit-ov-tab-${t.id}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/*
         * ─── ใบขอ (เจ้าของ 29 ต.ค. 2569 แบบร่างที่เคาะ "อะงั้นทำเลย"): ตัวกรอง · 1 ใบขอเข้ามา · 2 แนวโน้มใบขอ · 3 พื้นที่ขาดคน · 4 คนที่กรอกมา
         * แล้วต่อด้วยของแท็บกรอกเข้ามาเดิมทั้งหมด ("หน้า กรอกเข้ามา … เอาออกเลย ไปรวมกับ แท็บใบขอ")
         */}
        <TabsContent value="requests" className="mt-3 space-y-3">
          <RequestTab rows={data.requestRows ?? null} rowsError={data.errors.requests ?? null} apps={view.cohort} trend={compareCard('requests')}>
          {compareCard('apps')}
          {drillCard('apps', 'รายชื่อที่กรอกมา')}
          {/* งานค้างของขั้นนี้ ณ วันนี้ (ย้ายจากแท็บใบขอ · เจ้าของ 29 ต.ค. 2569 "ย้ายไปให้ถูกเรื่องของมัน") */}
          <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
            {data.backlog ? <BacklogBody backlog={data.backlog} only="uncalled" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
          </OverviewCard>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <OverviewCard icon={Timer} title="กรอกแล้วโทรวันไหน">
              {apps ? <DelayList rows={view.delay} /> : <EmptyNote>{`ยังไม่มีรายชื่อใน${period}`}</EmptyNote>}
            </OverviewCard>
            <div className="min-w-0 lg:col-span-2">
              <DailyCard rows={view.daily} icon={BarChart3} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {/* ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 "facebook ad 200 สนใจ 100 … มา 10" + "จับได้ถึงแจ้งเข้า") */}
            <OverviewCard
              icon={Megaphone}
              title="รายชื่อที่กรอกในช่วงนี้ ไปถึงไหนแยกช่องทาง"
              sub={data.errors.informs ? 'อ่านแจ้งเข้า ERP ไม่ได้' : 'แจ้งเข้า = มีใบแจ้งเข้า ERP หลังวันกรอก'}
              className="lg:col-span-2"
            >
              <ChannelFunnelTable groups={view.channels.groups} total={view.channels.total} onOpen={(title, ids) => setNames({ title, ids })} />
            </OverviewCard>
            <OverviewCard icon={Briefcase} title="ตำแหน่งที่สมัคร" sub="10 อันดับ">
              <PositionList rows={view.positions} />
            </OverviewCard>
          </div>
          {/* ฐาน = ทุกรายชื่อของช่วง (เส้นทางขั้น 4 นับเฉพาะคนที่ตอบ AI ว่าสนใจ — QA 18 ต.ค. 2569 เลขเลยต่างกัน) */}
          <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub="ทุกรายชื่อของช่วงนี้">
            <ReasonColumns groups={view.reasons} />
          </OverviewCard>
          </RequestTab>
        </TabsContent>

        {/* ─── การติดต่อ: ขั้นสนใจ·คนโทรต่อ + ผลงานรายคน ─── */}
        <TabsContent value="staff" className="mt-3 space-y-3">
          {compareCard('staff')}
          {drillCard('staff', 'การติดต่อ')}
          {/* งานค้างของขั้นนี้ ณ วันนี้ (ย้ายจากแท็บใบขอ · เจ้าของ 29 ต.ค. 2569 "ย้ายไปให้ถูกเรื่องของมัน") */}
          <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
            {data.backlog ? <BacklogBody backlog={data.backlog} only="waiting" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
          </OverviewCard>
          <OverviewCard icon={Users} title="ผลงานรายคน" sub="งานที่ลงผลในช่วงนี้">
            {data.staff ? <StaffTable staff={data.staff} ai={data.ai} /> : <SectionError message={data.errors.staff ?? 'อ่านผลงานรายคนไม่ได้'} />}
          </OverviewCard>
        </TabsContent>

        {/* ─── นัดหมาย: นัด · มาไหม + คนแจ้งเข้ามาจากช่องทางไหน ─── */}
        <TabsContent value="appt" className="mt-3 space-y-3">
          {compareCard('appt')}
          {drillCard('appt', 'นัดหมาย')}
          {/* งานค้างของขั้นนี้ ณ วันนี้ (ย้ายจากแท็บใบขอ · เจ้าของ 29 ต.ค. 2569 "ย้ายไปให้ถูกเรื่องของมัน") */}
          <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub="ณ วันนี้">
            {data.backlog ? <BacklogBody backlog={data.backlog} only="appointments" /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
          </OverviewCard>
          {/* ช่องทางที่ได้คนลงงาน (เจ้าของ 19 ต.ค. 2569 — ทีม Online ดูว่าเด็กมาจากไหน ลงงานจากช่องทางไหนเยอะ) */}
          <OverviewCard icon={Megaphone} title="คนแจ้งเข้าในช่วงนี้ มาจากช่องทางไหน" sub="นับตามวันแจ้งเข้า · ทุก BU">
            {data.channelPlacement ? (
              <ChannelPlacementTable data={data.channelPlacement} />
            ) : (
              <SectionError message={data.errors.channels ?? 'อ่านช่องทางไม่ได้'} />
            )}
          </OverviewCard>
        </TabsContent>
      </Tabs>

      <JourneyNamesDialog
        open={names !== null}
        onOpenChange={(o) => !o && setNames(null)}
        title={names?.title ?? ''}
        ids={names?.ids ?? []}
      />
    </div>
  );
};

export default RecruitOverview;
