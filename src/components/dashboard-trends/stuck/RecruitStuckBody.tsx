import React from 'react';
import { AlertCircle, ListChecks, Megaphone, PhoneCall, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
import StuckPhasesCard from './StuckPhasesCard';
import StuckOwnerTable from './StuckOwnerTable';
import StuckAreaTable from './StuckAreaTable';
import MonthlyBarsCard from './MonthlyBarsCard';
import StuckEquationCard from './StuckEquationCard';
import StuckTodoTable from './StuckTodoTable';
import CallerResultsTable from './CallerResultsTable';
import PersonJourneyCard from './PersonJourneyCard';
import ReleaseProgressCard from './ReleaseProgressCard';


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
  requestTrend,
}: {
  data: RecruitOverviewResponse;
  win: RecruitOverviewResponse['window'];
  /** การ์ดแนวโน้มใบขอรายวัน (ใบเข้า/ประกาศ/มีผู้สมัคร/ไม่มี) ของรายงานเดิม — โฉมต้นแบบวางในแท็บแนวโน้ม · ใบตามตัวกรองบนสุด */
  requestTrend?: (rows: RecruitRequestRow[] | null, prevRows: RecruitRequestRow[] | null) => React.ReactNode;
  onOpenNames: (title: string, ids: readonly string[]) => void;
  onPickMonth: (month: string) => void;
  /** `v5` = โฉมต้นแบบ SO Recruit (10 พ.ย. 2569 · &dash=v5) — 11 พ.ย. 2569 หน้าเดียว 4 ข้อ ไม่มีแท็บ */
  layout?: 'v5';
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
  const pick = (title: string, list: StuckRequest[]) => {
    setPicked({ title, rows: list });
    requestAnimationFrame(() => phasesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const openRequest = (r: StuckRequest) => r.jobId && navigate(requestPathOfJobId(r.jobId));

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
        {stuck.data?.requests ? (
          <>
            <StuckEquationCard look="v5" rows={filtered} window={stuck.data.window ?? null} value={scope} onChange={setScope} />
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
          </>
        ) : stuck.error || stuck.data ? null : (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        )}

        {/*
         * 🔴 หน้าเดียว ไม่มีแท็บ (เจ้าของ 11 พ.ย. 2569 "ทำไมต้องแยกกัน เอามันรวมกันเลย" → แบบร่างรอบ 2 "ทำตามแบบร่างนี้")
         * 1 ใครต้องทำอะไร · 2 ทำแล้วเป็นไง · 3 ที่มามาจากใคร · 4 ช่องทางไหนทำได้ดี · ต่อท้ายพื้นที่ · แนวโน้ม
         * การ์ดเดิมของแท็บอยู่ครบ: ใบขอใหม่ประกาศไปแค่ไหน (ข้อ 1) · คนที่กรอกมาไปถึงไหน + เหตุผลที่ไม่สำเร็จ (ข้อ 2)
         */}
        <V5Divider label="รายงาน" />
        {stuck.data?.requests ? (
          <OverviewCard icon={ListChecks} title="1. ใครต้องทำอะไร" sub={`${rows.length.toLocaleString('th-TH')} ใบ${scope === 'remaining' ? 'ที่ยังเปิด' : STUCK_SCOPE_LABEL[scope]} แยกตามเจ้าหน้าที่สรรหาของใบ · กดเลขดูใบ`}>
            <StuckTodoTable rows={rows} onPick={pick} />
          </OverviewCard>
        ) : null}
        {stuck.data?.requests ? <ReleaseProgressCard rows={filtered} onPick={pick} /> : null}
        <OverviewCard icon={PhoneCall} title="2. ทำแล้วเป็นไง" sub={`${cohortSub} · ตัวแดง = ยังไม่ทำ กดดูชื่อไปทำต่อ`}>
          {appsUnknown ? appsError : <CallerResultsTable cohort={cohort} onOpen={onOpenNames} />}
        </OverviewCard>
        {appsUnknown ? null : <PersonJourneyCard list={cohort} sub={cohortSub} onOpenNames={onOpenNames} />}
        <OverviewCard icon={AlertCircle} title="เหตุผลที่ไม่สำเร็จ" sub={`${cohortSub} · ผลล่าสุดของแต่ละคน`}>
          {appsUnknown ? appsError : <ReasonColumns groups={reasons} onOpen={onOpenNames} />}
        </OverviewCard>
        {bringerCard}
        {channelCard}
        {/* 5. โพสต์ลงกลุ่ม Facebook จาก So Scraping (เจ้าของ 11 พ.ย. 2569) — ช่วง/BU ตามภาพรวม ไม่ตามตัวกรองย่อย (ข้อมูลอยู่ฝั่ง So Scraping) */}
        <SoPostGroupsCard from={win.from} to={win.to} bu={data.bu} />
        {stuck.data?.requests ? (
          <StuckAreaTable rows={focused} title={scope === 'remaining' ? undefined : `พื้นที่ · ใบ${STUCK_SCOPE_LABEL[scope]}`} countLabel={scope === 'remaining' ? undefined : `ใบ${STUCK_SCOPE_LABEL[scope]}`} onPick={pick} />
        ) : null}
        {/* ใบขอรายวันตามช่วงที่เลือก (R09) — ใบตามตัวกรองบนสุด · ช่วงก่อนสำหรับเทียบ */}
        {requestTrend?.(data.requestRows ? (filterRequestRows(data.requestRows, filter) as RecruitRequestRow[]) : null, data.requestRowsPrev ? (filterRequestRows(data.requestRowsPrev, filter) as RecruitRequestRow[]) : null)}
        <MonthlyBarsCard rows={monthly.data} error={monthly.error} ok={jobOk} onPickMonth={onPickMonth} open={monthlyOpen} onOpen={() => setMonthlyOpen(true)} />
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
