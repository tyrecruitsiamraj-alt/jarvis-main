import React from 'react';
import { AlertCircle, ListChecks, Megaphone, PhoneCall, UserRound } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { V5Divider } from '@/components/so-recruit-v5/V5Parts';
import { EMPTY_REQUEST_FILTER, appsOfFilter, filterRequestRows, jobFilterOf, requestFilterToParams, type RequestTabFilter } from '@/lib/recruitRequestTab';
import { cohortOf, reasonGroups } from '@/lib/recruitOverview';
import { buildBringerFunnelTree, buildChannelFunnelTree } from '@/lib/channelFunnel';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { RecruitRequestRow } from '@/lib/recruitRequestTab';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import { STUCK_PHASES, STUCK_REASON_LABEL, STUCK_SCOPE_LABEL, stuckInScope, stuckPhaseOf, type StuckPhaseKey, type StuckReasonKey, type StuckRequest, type StuckScope } from '@/lib/recruitStuck';
import { friendlyErrorText } from '@/lib/friendlyError';
import { legacyReportsPath, requestPathOfJobId } from '@/lib/jobNavigation';
import { OverviewCard, ReasonColumns, SectionError } from '../RecruitOverviewParts';
import ChannelFunnelTable from '../ChannelFunnelTable';
import { buildFbGroupClickRows, mergeFbGroupClicks } from '@/lib/fbGroupClicks';
import StuckFilterBar from './StuckFilterBar';
import SoPostGroupsCard from './SoPostGroupsCard';
import ManualPostDaysCard from './ManualPostDaysCard';
import StuckPhasesCard, { StuckPickedList } from './StuckPhasesCard';
import StuckOwnerTable from './StuckOwnerTable';
import StuckAreaTable from './StuckAreaTable';
import MonthlyBarsCard from './MonthlyBarsCard';
import StuckEquationCard from './StuckEquationCard';
import StuckTodoTable from './StuckTodoTable';
import CallerResultsTable from './CallerResultsTable';
import PersonJourneyCard from './PersonJourneyCard';
import ReleaseProgressCard from './ReleaseProgressCard';
import RecruitScaleView, { type ScaleStripCell } from './RecruitScaleView';
import DailyCompareChart from './DailyCompareChart';
import type { SoPostPrevCounts } from './SoPostGroupsCard';
import { buildCallerResults } from '@/lib/callerResults';
import { SCALE_TITLES, SO_POST_SINCE, comparableSince, isScaleSection, prevCohortOf, type ScaleSectionKey } from '@/lib/recruitScale';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import { fetchManualPostDays } from '@/lib/jobPostActionsApi';
import type { ManualPostDays } from '@/lib/jobPostActions';
import { rangeText } from '@/lib/teamOnline';
import { formatYmdTh } from '@/lib/dateTh';


const SCOPE_TITLE: Record<StuckScope, { title: string; sub: string }> = {
  remaining: { title: 'ใบขอที่เหลือหา แยกขั้นที่ติด', sub: 'ใบที่ยังเปิดอยู่ ณ วันนี้ · กดได้ทุกตัวเลข' },
  carried: { title: 'ใบยกมา แยกขั้นที่ติด', sub: 'ใบที่เปิดอยู่ก่อนเริ่มช่วง · กดได้ทุกตัวเลข' },
  new: { title: 'ใบขอใหม่ แยกขั้นล่าสุด', sub: 'ใบที่ส่งเข้ามาในช่วง ทุกสถานะ · กดได้ทุกตัวเลข' },
  filled: { title: 'ใบที่ปิดแล้ว แยกขั้นล่าสุด', sub: 'ใบขอใหม่ที่ได้คนแล้ว · กดได้ทุกตัวเลข' },
  cancelled: { title: 'ใบที่ยกเลิก แยกขั้นล่าสุด', sub: 'ใบขอใหม่ที่ยกเลิกทั้งใบ · กดได้ทุกตัวเลข' },
};

/**
 * ═══ ตัวหน้าภาพรวมงานสรรหาโฉมใหม่ (เจ้าของ 4 พ.ย. 2569 นิยามเอง · Choice "เอาทำเลย") ═══
 * 6 ส่วน เรียงตามคำถามของเจ้าของ · ตัวกรองบนสุดคุมทุกส่วน · กดได้ทุกเลข
 * 1 ใบขอที่เหลือหา ติดตรงไหน (ใบที่เปิดอยู่ ณ วันนี้ · `/api/recruit-stuck`)
 * 2 ติดที่ใคร · 3 รายชื่อมาจากไหน ไปถึงไหน (ช่วงที่เลือก · ชุดเดิม `buildChannelFunnelTree`) · 4 พื้นที่ · 5 เทียบเดือน · 6 ทำไมไม่สำเร็จ (`reasonGroups`)
 * ตัวกรองใบขอ (ประเภท/ไซต์/พื้นที่/เจ้าหน้าที่) กรองรายชื่อด้วยตัวตัดสินเดียวกัน (`jobFilterOf`) — รายชื่อของใบที่ปิดแล้วหายตอนกรองใบ (ตั้งใจ)
 */
export default function RecruitStuckBody({
  data,
  win,
  onOpenNames,
  onPickMonth,
  layout,
}: {
  data: RecruitOverviewResponse;
  win: RecruitOverviewResponse['window'];
  onOpenNames: (title: string, ids: readonly string[]) => void;
  onPickMonth: (month: string) => void;
  /**
   * `scale` = ค่าเริ่ม (เจ้าของ 13 พ.ย. 2569 "เปิดมาปุ้บเป็นภาพใหญ่ พอกดอะไรก็ Scale ลงไป") แถบ 6 ช่อง + เทียบช่วงก่อนทุกเลข
   * `v5` = หน้าเดียวเลื่อนลง (11 พ.ย. 2569) — ทางถอย `&dash=list`
   */
  layout?: 'v5' | 'scale';
}) {
  const navigate = useNavigate();
  const [stuck, setStuck] = React.useState<{ data: RecruitStuckResponse | null; error: string | null }>({ data: null, error: null });
  const [rev, setRev] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    fetchRecruitStuck(data.bu, { from: win.from, to: win.to })
      .then((d) => alive && setStuck({ data: d, error: null }))
      .catch((e: unknown) => alive && setStuck({ data: null, error: friendlyErrorText(e, 'โหลดใบขอที่เหลือหาไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [data.bu, data.generatedAt, win.from, win.to, rev]);

  // เทียบเดือน: พับไว้ โหลดตอนกด (9 พ.ย. 2569 · หน้าโหลดช้า) — อ่าน 6 เดือนแยกเส้น `part=monthly`
  const [monthlyOpen, setMonthlyOpen] = React.useState(false);
  /** เหตุผลที่ไม่สำเร็จ พับไว้ล่างสุด (เจ้าของ 13 พ.ย. 2569) */
  const [reasonsOpen, setReasonsOpen] = React.useState(false);
  const [monthly, setMonthly] = React.useState<{ data: RecruitStuckResponse['monthly']; error: string | null }>({ data: null, error: null });
  React.useEffect(() => {
    if (!monthlyOpen) return;
    let alive = true;
    setMonthly({ data: null, error: null });
    fetchRecruitStuck(data.bu, { from: win.from, to: win.to }, 'monthly')
      .then((d) => alive && setMonthly({ data: d.monthly, error: d.errors.monthly ?? (d.monthly ? null : 'อ่านยอดรายเดือนไม่ได้') }))
      .catch((e: unknown) => alive && setMonthly({ data: null, error: friendlyErrorText(e, 'อ่านยอดรายเดือนไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [monthlyOpen, data.bu, win.from, win.to]);

  const [filter, setFilter] = React.useState<RequestTabFilter>(EMPTY_REQUEST_FILTER);
  /** สมการบนสุด: ใบชุดไหน (ค่าเริ่ม = เหลือหา) · ช่วง/เหตุที่กดในการ์ดติดตรงไหน */
  const [scope, setScope] = React.useState<StuckScope>('remaining');
  const [focus, setFocus] = React.useState<{ phase: StuckPhaseKey | null; reason: StuckReasonKey | null }>({ phase: null, reason: null });
  const allRows = React.useMemo(() => stuck.data?.requests ?? [], [stuck.data]);
  /** ใบที่ผ่านตัวกรองบนสุด (ทุกสถานะ) — สมการนับจากชุดนี้ */
  const filtered = React.useMemo(() => filterRequestRows(allRows, filter) as StuckRequest[], [allRows, filter]);
  const rows = React.useMemo(() => filtered.filter((r) => stuckInScope(r, scope)), [filtered, scope]);
  const focused = React.useMemo(
    () => rows.filter((r) => (focus.reason ? r.reason === focus.reason : focus.phase ? stuckPhaseOf(r.reason) === focus.phase : true)),
    [rows, focus],
  );
  const focusLabel = focus.reason ? STUCK_REASON_LABEL[focus.reason] : focus.phase ? STUCK_PHASES.find((p) => p.key === focus.phase)?.label ?? null : null;
  /** เลือกชุดใบ/ช่วง/เหตุแล้ว = รายชื่อทั้งหน้าเหลือเฉพาะของใบชุดนั้น · ค่าเริ่ม = รายชื่อทุกคนในช่วง (รวมใบที่ปิดแล้ว/ไม่ผูกใบ) */
  const narrow = scope !== 'remaining' || focusLabel !== null;
  const narrowIds = React.useMemo(() => (narrow ? new Set(focused.map((r) => r.jobId).filter((v): v is string => Boolean(v))) : null), [narrow, focused]);
  const recruiterOf = React.useCallback((jobId: string) => data.appJobs?.[jobId]?.recruiter ?? null, [data.appJobs]);
  /**
   * 🔴 ใบที่ผ่านตัวกรอง (`filtered`) ไม่ใช่ใบทั้งหมด — เดิมส่ง `allRows` ทำให้ ประเภทงาน/งานย่อย/Code Site/จังหวัด/อำเภอ/ตำบล
   * ไม่กรองรายชื่อ (ข้อ 2–4 · เหตุผล · เทียบเดือน) กรองได้แค่เจ้าหน้าที่ (เจ้าของ 11 พ.ย. 2569 "เลือกแล้วดูในหน้านี้ได้ครบยัง")
   * ชุดเดียวกับแท็บใบขอเดิม (`RequestTab` ส่งใบที่ผ่านตัวกรอง)
   */
  const jobOkBase = React.useMemo(() => jobFilterOf(filter, filtered, recruiterOf), [filter, filtered, recruiterOf]);
  const jobOk = React.useCallback((jobId: string | null) => (narrowIds ? Boolean(jobId && narrowIds.has(jobId)) : jobOkBase(jobId)), [narrowIds, jobOkBase]);
  const cohort = React.useMemo(() => {
    const all = cohortOf(data.apps ?? [], win.from, win.to);
    const byFilter = appsOfFilter(all, filter, filtered, recruiterOf);
    return narrowIds ? byFilter.filter((f) => Boolean(f.jobId && narrowIds.has(f.jobId))) : byFilter;
  }, [data.apps, win.from, win.to, filter, filtered, recruiterOf, narrowIds]);
  const narrowText = [scope !== 'remaining' ? `ใบ${STUCK_SCOPE_LABEL[scope]}` : null, focusLabel].filter(Boolean).join(' · ');
  /**
   * รายชื่อผู้สมัครอ่านไม่ได้ (`apps` null · เช่นช่วงเว็บรีสตาร์ต) = การ์ดที่นับจากรายชื่อบอกว่าอ่านไม่ได้ ห้ามโชว์ 0
   * (เจ้าของ 10 พ.ย. 2569 "ทำไมเป็น 0" — รายชื่อหลุดตรงไหนขึ้น 0 ทุกช่องตอนเว็บกำลังขึ้นของใหม่)
   */
  const appsUnknown = data.apps == null;
  const appsError = <SectionError message={data.errors.apps ?? 'อ่านรายชื่อผู้สมัครไม่ได้ชั่วคราว'} />;
  const cohortSub = appsUnknown
    ? 'อ่านรายชื่อผู้สมัครไม่ได้'
    : `รายชื่อที่กรอกในช่วงที่เลือก ${cohort.length.toLocaleString('th-TH')} คน${narrowText ? ` · เฉพาะ${narrowText}` : ''}`;
  // กลุ่ม Facebook คลิก ยอดทั้งหมดตั้งแต่สร้างลิงก์ (เจ้าของ 10 พ.ย. 2569 Choice "แบบ 1") — ไม่ตามปฏิทิน/ตัวกรองย่อย
  // 11 พ.ย. 2569 รวมเป็นไส้ในของตารางช่องทาง (เจ้าของ "คลิกและกรอก แยกกลุ่ม Facebook คือไส้ใน") — การ์ดแยกถอดแล้ว
  const fbGroups = React.useMemo(() => buildFbGroupClickRows(data.linkClicks), [data.linkClicks]);
  const channels = React.useMemo(() => mergeFbGroupClicks(buildChannelFunnelTree(cohort), fbGroups), [cohort, fbGroups]);
  const channelSub = `${cohortSub}${data.errors.informs ? ' · อ่านแจ้งเข้า ERP ไม่ได้' : ''}${
    fbGroups ? ' · คลิก ยอดทั้งหมดตั้งแต่สร้างลิงก์ · กดสมัคร สมัครซ้ำโดนกัน นับตั้งแต่ 10 พ.ย. 2569' : data.linkClicks === null ? ' · อ่านยอดคลิกไม่ได้ชั่วคราว' : ''
  }`;
  const bringers = React.useMemo(() => buildBringerFunnelTree(cohort), [cohort]);
  const reasons = React.useMemo(() => reasonGroups(cohort), [cohort]);
  const appRecruiters = React.useMemo(() => Object.values(data.appJobs ?? {}).map((j) => j.recruiter), [data.appJobs]);

  /** รายการใบที่กดมาจาก "ติดที่ใคร" / "พื้นที่" — ขึ้นในส่วนที่ 1 แล้วเลื่อนไปหา */
  const [picked, setPicked] = React.useState<{ title: string; rows: StuckRequest[] } | null>(null);
  const phasesRef = React.useRef<HTMLDivElement>(null);
  const pickedRef = React.useRef<HTMLDivElement>(null);
  const scale = layout === 'scale';
  const pick = (title: string, list: StuckRequest[]) => {
    setPicked({ title, rows: list });
    requestAnimationFrame(() => (scale ? pickedRef : phasesRef).current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openRequest = (r: StuckRequest) => r.jobId && navigate(requestPathOfJobId(r.jobId));

  // ═══ Scale ลง (13 พ.ย. 2569) — ข้อที่เลือกอยู่ใน `?sec=` (กดย้อนกลับ/ส่งลิงก์ได้) · ทุกเลขเทียบช่วงก่อน ═══
  const [searchParams, setSearchParams] = useSearchParams();
  const secParam = searchParams.get('sec');
  const section: ScaleSectionKey = isScaleSection(secParam) ? secParam : 'todo';
  const pickSection = (k: ScaleSectionKey) => {
    setPicked(null);
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set('sec', k);
        return next;
      },
      { replace: true },
    );
  };
  // เทียบเดือนโหลดตอนเปิดข้อนั้น (ของเดิมพับไว้เพราะหน้าโหลดช้า 9 พ.ย. 2569)
  React.useEffect(() => {
    if (scale && section === 'mon') setMonthlyOpen(true);
  }, [scale, section]);
  /** รายชื่อช่วงก่อน ผ่านตัวกรองชุดเดียวกับช่วงนี้ · null = เทียบไม่ได้ */
  const prevCohort = React.useMemo(() => {
    if (!scale) return null;
    const all = prevCohortOf(data.apps ?? [], win, data.firstDay, data.generatedAt);
    if (!all) return null;
    const byFilter = appsOfFilter(all, filter, filtered, recruiterOf);
    return narrowIds ? byFilter.filter((f) => Boolean(f.jobId && narrowIds.has(f.jobId))) : byFilter;
  }, [scale, data.apps, win, data.firstDay, data.generatedAt, filter, filtered, recruiterOf, narrowIds]);
  const prevChannels = React.useMemo(() => (prevCohort ? buildChannelFunnelTree(prevCohort) : null), [prevCohort]);
  const prevBringers = React.useMemo(() => (prevCohort ? buildBringerFunnelTree(prevCohort) : null), [prevCohort]);
  const prevReasons = React.useMemo(() => (prevCohort ? reasonGroups(prevCohort) : null), [prevCohort]);
  const kept = React.useMemo(() => (scale ? buildCallerResults(cohort).total.kept.length : 0), [scale, cohort]);
  const prevKept = React.useMemo(() => (prevCohort ? buildCallerResults(prevCohort).total.kept.length : null), [prevCohort]);
  /** ยอดข้อ 5–6 ของแถบบน + ช่วงก่อนที่ส่งให้การ์ด · ดึงไม่ได้ = null ("—" / "เทียบไม่ได้") */
  const [posts, setPosts] = React.useState<{ so: number | null; soPrev: SoPostPrevCounts | null; manual: ManualPostDays['total'] | null; manualPrev: ManualPostDays['total'] | null }>({
    so: null,
    soPrev: null,
    manual: null,
    manualPrev: null,
  });
  React.useEffect(() => {
    if (!scale) return;
    let alive = true;
    const soComparable = !win.all && comparableSince(win.prevFrom, SO_POST_SINCE);
    const none = Promise.resolve(null);
    Promise.all([
      fetchSoPostGroups({ from: win.from, to: win.to, bu: data.bu, page: 1 }).catch(() => null),
      soComparable ? fetchSoPostGroups({ from: win.prevFrom, to: win.prevTo, bu: data.bu, page: 1 }).catch(() => null) : none,
      fetchManualPostDays({ from: win.from, to: win.to, bu: data.bu }).catch(() => null),
      win.all ? none : fetchManualPostDays({ from: win.prevFrom, to: win.prevTo, bu: data.bu }).catch(() => null),
    ]).then(([so, soPrev, manual, manualPrev]) => {
      if (!alive) return;
      setPosts({
        so: so ? so.total : null,
        soPrev: soPrev ? { total: soPrev.total, counts: soPrev.counts } : null,
        manual: manual ? manual.total : null,
        manualPrev: manualPrev ? manualPrev.total : null,
      });
    });
    return () => {
      alive = false;
    };
  }, [scale, data.bu, win.from, win.to, win.prevFrom, win.prevTo, win.all]);

  if (scale) {
    const curLabel = rangeText({ from: win.from, to: win.to });
    const prevLabel = rangeText({ from: win.prevFrom, to: win.prevTo });
    const strip: Record<'todo' | 'done' | 'src' | 'ch' | 'fb' | 'self', ScaleStripCell> = {
      // ยอด ณ วันนี้ ไม่มียอดย้อนหลังรายวัน = เทียบไม่ได้ (ห้ามโชว์ช่วงก่อน 0)
      todo: { n: stuck.data?.requests ? rows.length : null, unit: 'ใบที่เหลือหา', prev: null },
      done: { n: appsUnknown ? null : kept, unit: 'เก็บไป', prev: appsUnknown ? null : prevKept },
      src: { n: appsUnknown ? null : cohort.length, unit: 'รายชื่อ', prev: appsUnknown ? null : (prevCohort?.length ?? null) },
      ch: { n: appsUnknown ? null : channels.total.booked.value, unit: 'นัดได้', prev: appsUnknown ? null : (prevChannels?.total.booked.value ?? null) },
      fb: { n: posts.so, unit: 'ที่สั่ง', prev: posts.soPrev?.total ?? null, sense: 'plain' },
      self: { n: posts.manual?.jobs ?? null, unit: 'ใบขอ', prev: posts.manualPrev?.jobs ?? null },
    };
    const stuckWait = stuck.error || stuck.data ? null : <Skeleton className="h-64 rounded-2xl" />;
    const pickedList = picked ? (
      <div ref={pickedRef} className="scroll-mt-20">
        <StuckPickedList list={picked} onClose={() => setPicked(null)} onOpenRequest={openRequest} />
      </div>
    ) : null;
    const zone = (() => {
      switch (section) {
        case 'todo':
          return stuck.data?.requests ? (
            <OverviewCard icon={ListChecks} title={SCALE_TITLES.todo} sub={`ยอด ณ ${formatYmdTh(data.today)}`}>
              <StuckTodoTable rows={rows} onPick={pick} />
              {pickedList}
            </OverviewCard>
          ) : (
            stuckWait
          );
        case 'done':
          return (
            <OverviewCard icon={PhoneCall} title={SCALE_TITLES.done} sub={cohortSub}>
              {appsUnknown ? appsError : <CallerResultsTable cohort={cohort} onOpen={onOpenNames} prev={prevCohort} prevLabel={prevLabel} />}
              {appsUnknown ? null : <PersonJourneyCard embedded list={cohort} sub={cohortSub} onOpenNames={onOpenNames} prev={prevCohort} />}
            </OverviewCard>
          );
        case 'src':
          return (
            <OverviewCard icon={UserRound} title={SCALE_TITLES.src} sub={cohortSub}>
              {appsUnknown ? appsError : (
                <>
                  {prevCohort ? <DailyCompareChart list={cohort} prevList={prevCohort} from={win.from} to={win.to} prevFrom={win.prevFrom} prevTo={win.prevTo} curLabel={curLabel} prevLabel={prevLabel} /> : null}
                  <ChannelFunnelTable groups={bringers.groups} total={bringers.total} onOpen={onOpenNames} firstLabel="คนหา" prev={prevBringers} prevLabel={prevLabel} />
                </>
              )}
            </OverviewCard>
          );
        case 'ch':
          return (
            <OverviewCard icon={Megaphone} title={SCALE_TITLES.ch} sub={channelSub}>
              {appsUnknown ? appsError : <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} clicks={channels.clicks} prev={prevChannels} prevLabel={prevLabel} />}
            </OverviewCard>
          );
        case 'fb':
          return (
            <SoPostGroupsCard
              from={win.from}
              to={win.to}
              bu={data.bu}
              buChoices={data.buChoices}
              prevRange={!win.all && comparableSince(win.prevFrom, SO_POST_SINCE) ? { from: win.prevFrom, to: win.prevTo } : null}
            />
          );
        case 'self':
          return <ManualPostDaysCard from={win.from} to={win.to} bu={data.bu} prev={posts.manualPrev} prevFrom={win.prevFrom} />;
        case 'area':
          return stuck.data?.requests ? (
            <div className="space-y-4">
              <StuckAreaTable rows={focused} onPick={pick} />
              {pickedList}
            </div>
          ) : (
            stuckWait
          );
        case 'mon':
          return <MonthlyBarsCard rows={monthly.data} error={monthly.error} ok={jobOk} onPickMonth={onPickMonth} open={monthlyOpen} onOpen={() => setMonthlyOpen(true)} />;
        case 'why':
          return (
            <OverviewCard icon={AlertCircle} title={SCALE_TITLES.why} sub={`${cohortSub} · ผลล่าสุดของแต่ละคน`}>
              {appsUnknown ? appsError : <ReasonColumns groups={reasons} onOpen={onOpenNames} prev={prevReasons} />}
            </OverviewCard>
          );
      }
    })();
    return (
      <div className="space-y-6" data-testid="recruit-stuck">
        <StuckFilterBar rows={allRows} appRecruiters={appRecruiters} value={filter} onChange={setFilter} />
        {stuck.error || stuck.data?.errors.requests ? (
          <SectionError message={stuck.error ?? stuck.data?.errors.requests ?? 'อ่านใบขอที่เหลือหาไม่ได้'} onRetry={() => setRev((n) => n + 1)} />
        ) : null}
        <RecruitScaleView value={section} onChange={pickSection} strip={strip}>
          {zone}
        </RecruitScaleView>
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              navigate(legacyReportsPath(win, data.bu, requestFilterToParams(filter)));
              window.scrollTo({ top: 0 });
            }}
            data-testid="v5-legacy-reports"
          >
            รายงานเพิ่มเติม (แบบเดิม)
          </Button>
        </div>
      </div>
    );
  }

  if (layout === 'v5') {
    const bringerCard = (
      <OverviewCard icon={UserRound} title="3. ที่มามาจากใคร" sub={cohortSub}>
        {appsUnknown ? appsError : <ChannelFunnelTable groups={bringers.groups} total={bringers.total} onOpen={onOpenNames} firstLabel="คนหา" />}
      </OverviewCard>
    );
    const channelCard = (
      <OverviewCard icon={Megaphone} title="4. ช่องทางไหนทำได้ดี" sub={channelSub}>
        {appsUnknown ? appsError : <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} clicks={channels.clicks} />}
      </OverviewCard>
    );
    return (
      <div className="space-y-6" data-testid="recruit-stuck">
        <StuckFilterBar rows={allRows} appRecruiters={appRecruiters} value={filter} onChange={setFilter} />
        {stuck.error || stuck.data?.errors.requests ? (
          <SectionError message={stuck.error ?? stuck.data?.errors.requests ?? 'อ่านใบขอที่เหลือหาไม่ได้'} onRetry={() => setRev((n) => n + 1)} />
        ) : null}
        {/* 12 พ.ย. 2569 เจ้าของจัดหน้าใหม่ (แบบร่างติ๊ก 15 ใบ): ถอดสมการใบขอ · สถานะประกาศใบขอใหม่ · แนวโน้มใบขอ
            "ใบที่เหลือหา แยกขั้นที่ติด" รวมเข้าข้อ 1 (รายการใบที่กดขึ้นใต้ตารางข้อ 1) · จุดที่รายชื่อหลุด อยู่ใต้ข้อ 2
            · 13 พ.ย. เหตุผลที่ไม่สำเร็จ ย้ายไปล่างสุด พับไว้ */}
        {stuck.data?.requests ? null : stuck.error || stuck.data ? null : (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}
        {stuck.data?.requests ? (
          <div ref={phasesRef} className="scroll-mt-20">
            <OverviewCard icon={ListChecks} title="1. ใครต้องทำอะไร" sub={`${rows.length.toLocaleString('th-TH')} ใบที่ยังเปิด`}>
              <StuckTodoTable rows={rows} onPick={pick} />
              {picked ? <StuckPickedList list={picked} onClose={() => setPicked(null)} onOpenRequest={openRequest} /> : null}
            </OverviewCard>
          </div>
        ) : null}
        <OverviewCard icon={PhoneCall} title="2. ทำแล้วเป็นไง" sub={cohortSub}>
          {appsUnknown ? appsError : <CallerResultsTable cohort={cohort} onOpen={onOpenNames} />}
          {appsUnknown ? null : <PersonJourneyCard embedded list={cohort} sub={cohortSub} onOpenNames={onOpenNames} />}
        </OverviewCard>
        {bringerCard}
        {channelCard}
        {/* 5. โพสต์ลงกลุ่ม Facebook จาก So Scraping (เจ้าของ 11 พ.ย. 2569) — ช่วง/BU ตามภาพรวม ไม่ตามตัวกรองย่อย (ข้อมูลอยู่ฝั่ง So Scraping) */}
        <SoPostGroupsCard from={win.from} to={win.to} bu={data.bu} buChoices={data.buChoices} />
        {/* 6. โพสต์เอง รายวัน (เจ้าของ 13 พ.ย. 2569) — ช่วง/BU ตามภาพรวม */}
        <ManualPostDaysCard from={win.from} to={win.to} bu={data.bu} />
        {stuck.data?.requests ? (
          <StuckAreaTable rows={focused} title={scope === 'remaining' ? undefined : `พื้นที่ · ใบ${STUCK_SCOPE_LABEL[scope]}`} countLabel={scope === 'remaining' ? undefined : `ใบ${STUCK_SCOPE_LABEL[scope]}`} onPick={pick} />
        ) : null}
        <MonthlyBarsCard rows={monthly.data} error={monthly.error} ok={jobOk} onPickMonth={onPickMonth} open={monthlyOpen} onOpen={() => setMonthlyOpen(true)} />
        {/* เหตุผลที่ไม่สำเร็จ ย้ายจากใต้ข้อ 2 มาล่างสุด พับไว้ (เจ้าของ 13 พ.ย. 2569 "เอาไปย่อไว้ล่างสุด") */}
        <OverviewCard
          icon={AlertCircle}
          title="เหตุผลที่ไม่สำเร็จ"
          sub={`${cohortSub} · ผลล่าสุดของแต่ละคน`}
          actions={
            reasonsOpen ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setReasonsOpen(false)}>
                ย่อ
              </Button>
            ) : null
          }
        >
          {!reasonsOpen ? (
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setReasonsOpen(true)} data-testid="reasons-open">
              เปิดดู
            </Button>
          ) : (
            appsUnknown ? appsError : <ReasonColumns groups={reasons} onOpen={onOpenNames} />
          )}
        </OverviewCard>
        {/* รายงานเดิม (ตำแหน่งสมัคร · เทียบช่วงก่อน · งานค้างตามอายุ · กรอกแล้วโทรวันไหน · ผลงานรายคน · ช่องทางแจ้งเข้า) — หน้าเดิมยังอยู่ครบ */}
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => {
              navigate(legacyReportsPath(win, data.bu, requestFilterToParams(filter)));
              window.scrollTo({ top: 0 });
            }} data-testid="v5-legacy-reports">
            รายงานเพิ่มเติม (แบบเดิม)
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="recruit-stuck">
      <StuckFilterBar rows={allRows} appRecruiters={appRecruiters} value={filter} onChange={setFilter} />

      {stuck.error || stuck.data?.errors.requests ? (
        <SectionError message={stuck.error ?? stuck.data?.errors.requests ?? 'อ่านใบขอที่เหลือหาไม่ได้'} onRetry={() => setRev((n) => n + 1)} />
      ) : null}
      {/* อ่านไม่ได้ = บอกเหตุอย่างเดียว ห้ามโชว์ 0 แทน (กติกาเดิมของหน้า) · ยังโหลด = โครงรอ */}
      {stuck.data?.requests ? (
        <>
          <StuckEquationCard rows={filtered} window={stuck.data.window ?? null} value={scope} onChange={setScope} />
          <div ref={phasesRef} className="scroll-mt-20">
            <StuckPhasesCard
              key={scope}
              rows={rows}
              title={SCOPE_TITLE[scope].title}
              sub={SCOPE_TITLE[scope].sub}
              onFocus={setFocus}
              onOpenRequest={openRequest}
              listOverride={picked}
              onCloseList={() => setPicked(null)}
            />
          </div>
          <StuckOwnerTable rows={focused} countLabel={scope === 'remaining' ? 'ใบที่ต้องหา' : `ใบ${STUCK_SCOPE_LABEL[scope]}`} onPick={pick} />
          {/* ย้ายมาจากหน้าหลัก (9 พ.ย. 2569 "ตามร่างทั้งหมด") — ใบขอใหม่ของช่วง ตามตัวกรองบนสุด */}
          <ReleaseProgressCard rows={filtered} onPick={pick} />
        </>
      ) : stuck.error || stuck.data ? null : (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      {appsUnknown ? appsError : <PersonJourneyCard list={cohort} sub={cohortSub} onOpenNames={onOpenNames} />}

      {/* 3 รายชื่อมาจากไหน ไปถึงไหน — ตารางเดิม 4 กลุ่ม → ช่องทาง → กลุ่ม/เพจ · ถึงแจ้งเข้า */}
      <OverviewCard icon={Megaphone} title="รายชื่อ แยกช่องทาง" sub={channelSub}>
        {appsUnknown ? appsError : <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} clicks={channels.clicks} />}
      </OverviewCard>

      {/* ใครหารายชื่อเข้ามา (เจ้าของ 9 พ.ย. 2569 "ใครทำก็คนนั้นได้ จะได้วัดผลว่าใครมีรายชื่อเข้ามาเยอะ") — คน → วิธี → ช่องทาง/กลุ่ม */}
      <OverviewCard icon={UserRound} title="รายชื่อ แยกคนหา" sub={cohortSub}>
        {appsUnknown ? appsError : <ChannelFunnelTable groups={bringers.groups} total={bringers.total} onOpen={onOpenNames} firstLabel="คน" />}
      </OverviewCard>

      {stuck.data?.requests ? <StuckAreaTable rows={focused} title={scope === 'remaining' ? undefined : `พื้นที่ · ใบ${STUCK_SCOPE_LABEL[scope]}`} countLabel={scope === 'remaining' ? undefined : `ใบ${STUCK_SCOPE_LABEL[scope]}`} onPick={pick} /> : null}

      <MonthlyBarsCard
        rows={monthly.data}
        error={monthly.error}
        ok={jobOk}
        onPickMonth={onPickMonth}
        open={monthlyOpen}
        onOpen={() => setMonthlyOpen(true)}
      />

      <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub={`${cohortSub} · ผลล่าสุดของแต่ละคน`}>
        {appsUnknown ? appsError : <ReasonColumns groups={reasons} onOpen={onOpenNames} />}
      </OverviewCard>
    </div>
  );
}
