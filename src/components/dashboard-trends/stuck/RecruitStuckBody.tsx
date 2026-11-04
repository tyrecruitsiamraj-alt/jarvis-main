import React from 'react';
import { AlertCircle, Megaphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { EMPTY_REQUEST_FILTER, appsOfFilter, filterRequestRows, jobFilterOf, type RequestTabFilter } from '@/lib/recruitRequestTab';
import { cohortOf, reasonGroups } from '@/lib/recruitOverview';
import { buildChannelFunnelTree } from '@/lib/channelFunnel';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import type { StuckRequest } from '@/lib/recruitStuck';
import { friendlyErrorText } from '@/lib/friendlyError';
import { OverviewCard, ReasonColumns, SectionError } from '../RecruitOverviewParts';
import ChannelFunnelTable from '../ChannelFunnelTable';
import StuckFilterBar from './StuckFilterBar';
import StuckPhasesCard from './StuckPhasesCard';
import StuckOwnerTable from './StuckOwnerTable';
import StuckAreaTable from './StuckAreaTable';
import MonthlyBarsCard from './MonthlyBarsCard';

/**
 * ═══ ตัวหน้าภาพรวมงานสรรหาโฉมใหม่ (เจ้าของ 4 พ.ย. 2569 นิยามเอง · Choice "เอาทำเลย") ═══
 * 6 ส่วน เรียงตามคำถามของเจ้าของ · ตัวกรองบนสุดคุมทุกส่วน · กดได้ทุกเลข
 * 1 ใบขอที่ยังต้องหา ติดตรงไหน (ใบที่เปิดอยู่ ณ วันนี้ · `/api/recruit-stuck`)
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
    fetchRecruitStuck(data.bu)
      .then((d) => alive && setStuck({ data: d, error: null }))
      .catch((e: unknown) => alive && setStuck({ data: null, error: friendlyErrorText(e, 'โหลดใบขอที่ยังต้องหาไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [data.bu, data.generatedAt, rev]);

  const [filter, setFilter] = React.useState<RequestTabFilter>(EMPTY_REQUEST_FILTER);
  const allRows = React.useMemo(() => stuck.data?.requests ?? [], [stuck.data]);
  const rows = React.useMemo(() => filterRequestRows(allRows, filter) as StuckRequest[], [allRows, filter]);
  const recruiterOf = React.useCallback((jobId: string) => data.appJobs?.[jobId]?.recruiter ?? null, [data.appJobs]);
  const jobOk = React.useMemo(() => jobFilterOf(filter, allRows, recruiterOf), [filter, allRows, recruiterOf]);
  const cohort = React.useMemo(() => {
    const all = cohortOf(data.apps ?? [], win.from, win.to);
    return appsOfFilter(all, filter, allRows, recruiterOf);
  }, [data.apps, win.from, win.to, filter, allRows, recruiterOf]);
  const channels = React.useMemo(() => buildChannelFunnelTree(cohort), [cohort]);
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
        <SectionError message={stuck.error ?? stuck.data?.errors.requests ?? 'อ่านใบขอที่ยังต้องหาไม่ได้'} onRetry={() => setRev((n) => n + 1)} />
      ) : null}
      {/* อ่านไม่ได้ = บอกเหตุอย่างเดียว ห้ามโชว์ 0 แทน (กติกาเดิมของหน้า) · ยังโหลด = โครงรอ */}
      {stuck.data?.requests ? (
        <>
          <div ref={phasesRef} className="scroll-mt-20">
            <StuckPhasesCard rows={rows} onOpenRequest={openRequest} listOverride={picked} onCloseList={() => setPicked(null)} />
          </div>
          <StuckOwnerTable rows={rows} onPick={pick} />
        </>
      ) : stuck.error || stuck.data ? null : (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      )}

      {/* 3 รายชื่อมาจากไหน ไปถึงไหน — ตารางเดิม 4 กลุ่ม → ช่องทาง → กลุ่ม/เพจ · ถึงแจ้งเข้า */}
      <OverviewCard icon={Megaphone} title="รายชื่อมาจากไหน ไปถึงไหน" sub={`รายชื่อที่กรอกในช่วงที่เลือก ${cohort.length.toLocaleString('th-TH')} คน${data.errors.informs ? ' · อ่านแจ้งเข้า ERP ไม่ได้' : ''}`}>
        <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} />
      </OverviewCard>

      {stuck.data?.requests ? <StuckAreaTable rows={rows} onPick={pick} /> : null}

      <MonthlyBarsCard rows={stuck.data?.monthly ?? null} error={stuck.data?.errors.monthly ?? stuck.error} ok={jobOk} onPickMonth={onPickMonth} />

      <OverviewCard icon={AlertCircle} title="ทำไมไม่สำเร็จ" sub="รายชื่อที่กรอกในช่วงที่เลือก · ผลล่าสุดของแต่ละคน · กดเลขดูรายชื่อ">
        <ReasonColumns groups={reasons} onOpen={onOpenNames} />
      </OverviewCard>
    </div>
  );
}
