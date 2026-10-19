import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCheck,
  Filter,
  Link2,
  Megaphone,
  PhoneCall,
  PhoneOutgoing,
  RefreshCw,
  ThumbsUp,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Skeleton } from '@/components/ui/skeleton';
import { ChoiceDropdown } from '@/components/shared/ChoiceDropdown';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import { rangeText } from '@/lib/teamOnline';
import { shortTime } from '@/lib/dateTh';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import { monthLabel, monthOptions, shiftMonth, shiftRange } from '@/lib/recruitOverviewWindow';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import {
  channelRows,
  cohortOf,
  dailyRows,
  delayRows,
  funnelSteps,
  positionRows,
  reasonGroups,
  totalsOf,
  trimLastDayToNow,
} from '@/lib/recruitOverview';
import { WEEKDAY_CHOICES, buildRecruitJourney, filterByWeekdays } from '@/lib/recruitJourney';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { BoardPublishedTotals } from '@/lib/boardRelease';
import {
  BacklogBody,
  ChannelTable,
  DailyCard,
  DelayList,
  EmptyNote,
  JourneyList,
  OverviewCard,
  OverviewKpi,
  PositionList,
  ReasonColumns,
  SectionError,
  StaffTable,
} from './RecruitOverviewParts';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TrendState } from './TrendParts';
import JourneyNamesDialog from './JourneyNamesDialog';

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
 */

type Load = { data: RecruitOverviewResponse | null; loading: boolean; error: string | null };

const RecruitOverview: React.FC<{
  /**
   * 🔴 ยอด "ประกาศ" จากหัวกล่องงาน (เจ้าของ 1 ต.ค. 2569: *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) — หน้าแม่ส่งมา
   * สถานะตอนนี้ ไม่ขึ้นกับเดือน · `null`/ไม่ส่ง = ยังบอกไม่ได้ ("—")
   */
  published?: BoardPublishedTotals | null;
}> = ({ published = null }) => {
  /** null = เดือนนี้ (ให้เส้นตัดสินจากวันไทยของ server) */
  const [month, setMonthState] = useState<string | null>(null);
  /**
   * ช่วงที่เลือกเอง — รายวันหรือช่วง (เจ้าของสั่ง 5 ต.ค. 2569: *"อยากดูแบบรายวันหรือ ช่วงได้ด้วย"*)
   * มีค่า = ไม่ใช้เดือน · เลือกเดือนจากปุ่มเดือน = กลับแบบเดือน
   */
  const [range, setRange] = useState<DateRangeYmd | null>(null);
  const setMonth = (m: string) => {
    setRange(null);
    setMonthState(m);
  };
  const [rev, setRev] = useState(0);
  const [state, setState] = useState<Load>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRecruitOverview(month, range)
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      // ล้มแล้วห้ามค้างเลขรอบก่อนพร้อม "ข้อมูล ณ …" (QA 18 ต.ค. 2569) ⇒ ล้างแล้วขึ้นกล่องล้ม + ลองใหม่
      .catch((e: unknown) => !cancelled && setState({ data: null, loading: false, error: friendlyErrorText(e, 'โหลดภาพรวมไม่ได้') }));
    return () => {
      cancelled = true;
    };
  }, [month, range, rev]);

  const data = state.data;
  const win = data?.window ?? null;
  const apps = data?.apps ?? null;

  /** เฉพาะวันในสัปดาห์ (เจ้าของสั่ง 18 ต.ค. 2569 "เฉพาะวันจันทร์") — ว่าง = ทุกวัน · กรองตามวันที่กรอกใบ (เวลาไทย) */
  const [weekdays, setWeekdays] = useState<number[]>([]);
  /** ป๊อปรายชื่อของเลขที่กดในเส้นทาง */
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);

  const view = useMemo(() => {
    if (!data || !win) return null;
    const list = filterByWeekdays(apps ?? [], weekdays);
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
      /** ข้อมูลเริ่มกลางช่วงก่อน (ไม่ใช่ไม่มีเลย) */
      prevPartial: !prevFull && !!data.firstDay && data.firstDay <= win.prevTo,
      steps: funnelSteps(cur, { attendanceEverRecorded: data.attendanceEverRecorded }),
      journey: buildRecruitJourney(cohort),
      delay: delayRows(cohort),
      daily: dailyRows(cohort, win.from, win.to),
      channels: channelRows(cohort),
      positions: positionRows(cohort),
      reasons: reasonGroups(cohort),
    };
  }, [data, win, apps, weekdays]);

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

  const { cur, prev } = view;
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

  const compareNote = [
    view.prev
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
      {/* ─── หัว: ชื่อ + เลือกเดือน (แบบ iRecruit) ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-medium text-foreground">ภาพรวมงานสรรหา</h2>
        <div className="flex flex-wrap items-center gap-1">
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
          {/* รายวัน/ช่วง (5 ต.ค. 2569) — เลือกวันเดียว = รายวัน · "ทั้งเดือน" = กลับแบบเดือน */}
          <DateRangeCalendarPicker
            triggerVariant="filter"
            emptyLabel="ทั้งเดือน"
            value={isRange ? { from: win.from, to: win.to } : null}
            onChange={setRange}
          />
          <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)}>
            <RefreshCw className={cn(state.loading && 'animate-spin')} aria-hidden /> โหลดใหม่
          </Button>
        </div>
      </div>

      <div className={cn('flex flex-wrap items-center justify-between gap-2 text-xs', DASH.sub)}>
        <span>{data.bu ? `เฉพาะ BU ${data.bu}` : 'ทุก BU'}</span>
        <span className="tabular-nums">{compareNote}</span>
      </div>

      {/* เฉพาะวันในสัปดาห์ (เจ้าของสั่ง 18 ต.ค. 2569) — เลือกได้หลายวัน · ไม่เลือก = ทุกวัน · มีผลทั้งหน้า */}
      <div className="flex flex-wrap items-center gap-2" data-testid="recruit-weekdays">
        <span className={cn('text-xs', DASH.sub)}>เฉพาะวัน</span>
        <ToggleGroup
          type="multiple"
          size="xs"
          variant="outline"
          value={weekdays.map(String)}
          onValueChange={(v) => setWeekdays(v.map(Number))}
          aria-label="เฉพาะวันในสัปดาห์"
          className="flex-wrap justify-start"
        >
          {WEEKDAY_CHOICES.map((d) => (
            <ToggleGroupItem key={d.day} value={String(d.day)} aria-label={d.label}>
              {/* มือถือใช้ชื่อย่อ ปุ่มอยู่แถวเดียว (QA 18 ต.ค. 2569) */}
              <span className="sm:hidden">{d.short}</span>
              <span className="max-sm:hidden">{d.label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {weekdays.length > 0 ? (
          <Button type="button" size="xs" variant="ghost" onClick={() => setWeekdays([])}>
            ทุกวัน
          </Button>
        ) : null}
      </div>

      {state.error ? <SectionError message={state.error} onRetry={() => setRev((n) => n + 1)} /> : null}
      {appsError ? <SectionError message={appsError} /> : null}

      {/* ─── การ์ด 6 ใบ ─── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <OverviewKpi
          icon={Link2}
          label="ใบที่ประกาศ"
          value={published ? published.published : null}
          previous={null}
          foot={published ? `ตอนนี้ · มีคนสมัครแล้ว ${fmt(published.withApplicants)} ใบ` : null}
        />
        <OverviewKpi
          icon={UserPlus}
          label="รายชื่อเข้ามา"
          value={apps ? cur.names : null}
          previous={apps ? (prev?.names ?? null) : null}
          foot={apps ? `จาก ${fmt(cur.jobs)} ใบขอ` : null}
        />
        <OverviewKpi
          icon={PhoneOutgoing}
          label="โทรแล้ว"
          value={apps ? cur.called : null}
          previous={apps ? (prev?.called ?? null) : null}
          // AI + คน − ทั้งสองทาง = โทรแล้ว (QA 18 ต.ค. 2569: เดิม AI 400 · คน 56 บวกได้ 456 ≠ 402)
          foot={apps ? `AI ${fmt(cur.calledByAi)} · คน ${fmt(cur.calledByStaff)}${cur.calledBoth > 0 ? ` · โทรทั้งสองทาง ${fmt(cur.calledBoth)}` : ''}` : null}
        />
        <OverviewKpi
          icon={PhoneCall}
          label="ติดต่อสำเร็จ"
          value={apps ? cur.reached : null}
          previous={apps ? (prev?.reached ?? null) : null}
          foot={apps ? `AI ${fmt(cur.reachedByAi)} · คน ${fmt(cur.reachedByStaff)}` : null}
        />
        <OverviewKpi
          icon={ThumbsUp}
          label="ตอบ AI ว่าสนใจ"
          value={apps ? cur.aiSaidYes : null}
          previous={apps ? (prev?.aiSaidYes ?? null) : null}
          foot={apps ? `คนโทรต่อแล้ว ${fmt(cur.staffFollowed)}` : null}
        />
        <OverviewKpi
          icon={FileCheck}
          label="ได้ใบสมัคร"
          value={apps ? cur.onBoard : null}
          previous={apps && prev?.onBoard != null && cur.onBoard !== null ? prev.onBoard : null}
          foot={apps ? `นัดได้ ${fmt(cur.appointed)}` : null}
        />
      </div>

      {/* ─── เส้นทางของรายชื่อ + งานค้างตอนนี้ ─── (คำโปรยใต้หัวถอดเกือบหมด QA 5 ต.ค. 2569) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OverviewCard
          icon={Filter}
          title="เส้นทางของรายชื่อ"
          className="lg:col-span-2"
        >
          {/* 🔴 Journey ทีละขั้น (เจ้าของสั่ง 18 ต.ค. 2569) แทนบันไดเดิมที่ "มาตามนัด 0 → ได้ใบสมัคร 21" ·
              เดือนที่ยังไม่มีรายชื่อ = ขั้นครบเป็น 0 (กติกา 1 ต.ค.) */}
          {apps ? <JourneyList steps={view.journey} onOpenPart={(title, ids) => setNames({ title, ids })} /> : <EmptyNote>{`ยังไม่มีรายชื่อใน${period}`}</EmptyNote>}
          {data.errors.board ? <p className={cn('text-xs', TONE.warn.value)}>{data.errors.board}</p> : null}
        </OverviewCard>
        <OverviewCard icon={ClipboardList} title="งานค้างตอนนี้" sub={weekdays.length > 0 ? 'ณ วันนี้ · ไม่กรองตามวัน' : 'ณ วันนี้'}>
          {data.backlog ? <BacklogBody backlog={data.backlog} /> : <SectionError message={data.errors.backlog ?? 'อ่านงานค้างไม่ได้'} />}
        </OverviewCard>
      </div>

      {/* ─── กรอกแล้วโทรวันไหน + รายวัน ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OverviewCard icon={Timer} title="กรอกแล้วโทรวันไหน">
          {apps ? <DelayList rows={view.delay} /> : <EmptyNote>{`ยังไม่มีรายชื่อใน${period}`}</EmptyNote>}
        </OverviewCard>
        <div className="min-w-0 lg:col-span-2">
          <DailyCard rows={view.daily} icon={BarChart3} />
        </div>
      </div>

      {/* ─── ช่องทาง + ตำแหน่ง ─── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <OverviewCard icon={Megaphone} title="ช่องทางการสมัคร" className="lg:col-span-2">
          <ChannelTable rows={view.channels.rows} total={view.channels.total} />
        </OverviewCard>
        <OverviewCard icon={Briefcase} title="ตำแหน่งที่สมัคร" sub="10 อันดับ">
          <PositionList rows={view.positions} />
        </OverviewCard>
      </div>

      {/* ─── เหตุผลที่ไม่สำเร็จ ─── */}
      {/* ฐาน = ทุกรายชื่อของช่วง (เส้นทางขั้น 4 นับเฉพาะคนที่ตอบ AI ว่าสนใจ — QA 18 ต.ค. 2569 เลขเลยต่างกัน) */}
      <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub="ทุกรายชื่อของช่วงนี้">
        <ReasonColumns groups={view.reasons} />
      </OverviewCard>

      <JourneyNamesDialog
        open={names !== null}
        onOpenChange={(o) => !o && setNames(null)}
        title={names?.title ?? ''}
        ids={names?.ids ?? []}
      />

      {/* ─── ผลงานรายคน ─── */}
      <OverviewCard icon={Users} title="ผลงานรายคน" sub={weekdays.length > 0 ? 'งานที่ลงผลในช่วงนี้ · ไม่กรองตามวัน' : 'งานที่ลงผลในช่วงนี้'}>
        {data.staff ? <StaffTable staff={data.staff} ai={data.ai} /> : <SectionError message={data.errors.staff ?? 'อ่านผลงานรายคนไม่ได้'} />}
      </OverviewCard>
    </div>
  );
};

export default RecruitOverview;
