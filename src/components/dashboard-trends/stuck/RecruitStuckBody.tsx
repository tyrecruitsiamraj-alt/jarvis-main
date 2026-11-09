import React from 'react';
import { AlertCircle, Megaphone, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY_REQUEST_FILTER, appsOfFilter, filterRequestRows, jobFilterOf, type RequestTabFilter } from '@/lib/recruitRequestTab';
import { cohortOf, reasonGroups } from '@/lib/recruitOverview';
import { buildBringerFunnelTree, buildChannelFunnelTree } from '@/lib/channelFunnel';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import { STUCK_PHASES, STUCK_REASON_LABEL, STUCK_SCOPE_LABEL, stuckInScope, stuckPhaseOf, type StuckPhaseKey, type StuckReasonKey, type StuckRequest, type StuckScope } from '@/lib/recruitStuck';
import { friendlyErrorText } from '@/lib/friendlyError';
import { OverviewCard, ReasonColumns, SectionError } from '../RecruitOverviewParts';
import ChannelFunnelTable from '../ChannelFunnelTable';
import StuckFilterBar from './StuckFilterBar';
import StuckPhasesCard from './StuckPhasesCard';
import StuckOwnerTable from './StuckOwnerTable';
import StuckAreaTable from './StuckAreaTable';
import MonthlyBarsCard from './MonthlyBarsCard';
import StuckEquationCard from './StuckEquationCard';
import PersonJourneyCard from './PersonJourneyCard';

const SCOPE_TITLE: Record<StuckScope, { title: string; sub: string }> = {
  remaining: { title: 'ใบขอที่เหลือหา ติดตรงไหน', sub: 'ใบที่ยังเปิดอยู่ ณ วันนี้ · กดได้ทุกตัวเลข' },
  carried: { title: 'ใบยกมา ติดตรงไหน', sub: 'ใบที่เปิดอยู่ก่อนเริ่มช่วง · กดได้ทุกตัวเลข' },
  new: { title: 'ใบขอใหม่ ไปถึงขั้นไหน', sub: 'ใบที่ส่งเข้ามาในช่วง ทุกสถานะ · กดได้ทุกตัวเลข' },
  filled: { title: 'ใบที่ปิดแล้ว ไปถึงขั้นไหน', sub: 'ใบขอใหม่ที่ได้คนแล้ว · กดได้ทุกตัวเลข' },
  cancelled: { title: 'ใบที่ยกเลิก ไปถึงขั้นไหน', sub: 'ใบขอใหม่ที่ยกเลิกทั้งใบ · กดได้ทุกตัวเลข' },
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
}: {
  data: RecruitOverviewResponse;
  win: RecruitOverviewResponse['window'];
  onOpenNames: (title: string, ids: readonly string[]) => void;
  onPickMonth: (month: string) => void;
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
  const jobOkBase = React.useMemo(() => jobFilterOf(filter, allRows, recruiterOf), [filter, allRows, recruiterOf]);
  const jobOk = React.useCallback((jobId: string | null) => (narrowIds ? Boolean(jobId && narrowIds.has(jobId)) : jobOkBase(jobId)), [narrowIds, jobOkBase]);
  const cohort = React.useMemo(() => {
    const all = cohortOf(data.apps ?? [], win.from, win.to);
    const byFilter = appsOfFilter(all, filter, allRows, recruiterOf);
    return narrowIds ? byFilter.filter((f) => Boolean(f.jobId && narrowIds.has(f.jobId))) : byFilter;
  }, [data.apps, win.from, win.to, filter, allRows, recruiterOf, narrowIds]);
  const narrowText = [scope !== 'remaining' ? `ใบ${STUCK_SCOPE_LABEL[scope]}` : null, focusLabel].filter(Boolean).join(' · ');
  const cohortSub = `รายชื่อที่กรอกในช่วงที่เลือก ${cohort.length.toLocaleString('th-TH')} คน${narrowText ? ` · เฉพาะ${narrowText}` : ''}`;
  const channels = React.useMemo(() => buildChannelFunnelTree(cohort), [cohort]);
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
  const openRequest = (r: StuckRequest) => navigate(`/jobs/siamraj/${encodeURIComponent(r.jobId ?? '')}`);

  return (
    <div className="space-y-3" data-testid="recruit-stuck">
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
        </>
      ) : stuck.error || stuck.data ? null : (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      <PersonJourneyCard list={cohort} sub={cohortSub} onOpenNames={onOpenNames} />

      {/* 3 รายชื่อมาจากไหน ไปถึงไหน — ตารางเดิม 4 กลุ่ม → ช่องทาง → กลุ่ม/เพจ · ถึงแจ้งเข้า */}
      <OverviewCard icon={Megaphone} title="รายชื่อมาจากไหน ไปถึงไหน" sub={`${cohortSub}${data.errors.informs ? ' · อ่านแจ้งเข้า ERP ไม่ได้' : ''}`}>
        <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} />
      </OverviewCard>

      {/* ใครหารายชื่อเข้ามา (เจ้าของ 9 พ.ย. 2569 "ใครทำก็คนนั้นได้ จะได้วัดผลว่าใครมีรายชื่อเข้ามาเยอะ") — คน → วิธี → ช่องทาง/กลุ่ม */}
      <OverviewCard icon={UserRound} title="ใครหารายชื่อเข้ามา" sub={cohortSub}>
        <ChannelFunnelTable groups={bringers.groups} total={bringers.total} onOpen={onOpenNames} firstLabel="คน" rootLabel="ทุกคน" />
      </OverviewCard>

      {stuck.data?.requests ? <StuckAreaTable rows={focused} title={scope === 'remaining' ? undefined : `พื้นที่ · ใบ${STUCK_SCOPE_LABEL[scope]}`} countLabel={scope === 'remaining' ? undefined : `ใบ${STUCK_SCOPE_LABEL[scope]}`} onPick={pick} /> : null}

      <MonthlyBarsCard rows={stuck.data?.monthly ?? null} error={stuck.data?.errors.monthly ?? stuck.error} ok={jobOk} onPickMonth={onPickMonth} />

      <OverviewCard icon={AlertCircle} title="ทำไมไม่สำเร็จ" sub={`${cohortSub} · ผลล่าสุดของแต่ละคน`}>
        <ReasonColumns groups={reasons} onOpen={onOpenNames} />
      </OverviewCard>
    </div>
  );
}
