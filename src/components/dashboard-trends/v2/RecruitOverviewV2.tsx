/**
 * ═══ ภาพรวมงานสรรหา v2 — หน้าเดียว (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP `Jarvis-Recruit-Overview-Claude-Final-Checked`) ═══
 * ค่าเริ่มของ `/jobs/board?view=dashboard` ตั้งแต่ 17 พ.ย. 2569 ค่ำ (เจ้าของเทสผ่าน) · หน้า 8 เรื่องเดิมอยู่ `&dash=topics`
 * อ่านภาพใหญ่ก่อน → กดยอดเปิดรายละเอียดทางขวา (`V2Drawer`) · ตัวกรองบนสุด (วันที่ · BU) คุมทุกส่วน
 * ข้อมูลจริงผ่านเส้นเดิมที่ตรวจสิทธิ์: `/api/recruit-overview?asof=1` (ผล ณ วันสิ้นสุด) · `/api/recruit-stuck` · So Scraping · ลิงก์โพสต์เอง
 * นิยามทุกยอดมาจากตัวกลางเดิม (`v2Model.ts`) — ไม่มีตัวเลขฝัง · ไม่ทราบ = "—"
 */
import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import { stuckEquation, type StuckRequest } from '@/lib/recruitStuck';
import { POSTING_STATES, POSTING_STATE_LABEL, postingStateOf } from '@/lib/recruitPostingState';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import { fetchManualLinks } from '@/lib/jobPostActionsApi';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { RELEASE_LANE_TEXT } from '@/lib/boardRelease';
import { EMPTY_REQUEST_FILTER, filterRequestRows, isRequestFilterActive, jobFilterOf, type RequestTabFilter } from '@/lib/recruitRequestTab';
import { prevCohortOf } from '@/lib/recruitScale';
import { friendlyErrorText } from '@/lib/friendlyError';
import { BU_UNKNOWN, buOfFact, pageOf, bkkDay } from '@/lib/recruitAudience';
import SoPostGroupsCard from '../stuck/SoPostGroupsCard';
import SelfLinksPanel from '../topics/SelfLinksPanel';
import StuckFilterBar from '../stuck/StuckFilterBar';
import StuckAreaTable from '../stuck/StuckAreaTable';
import CallerResultsTable from '../stuck/CallerResultsTable';
import V2Drawer, { type V2Pane } from './V2Drawer';
import ApplicantStory from './ApplicantStory';
import PostingProgress from './PostingProgress';
import { Kpi, Pager, SectionTitle, fmt } from './V2Parts';
import StaffActivityPanel from './StaffActivityPanel';
import { ActivityFeed, DailyCharts, OutreachTiles, TODO_ICONS, TodoList, dailyPulse } from './PulseParts';
import { fetchStaffActivity, fetchStaffActivityFeed } from '@/lib/staffActivityApi';
import type { StaffActivityFeedItem, StaffActivityKind, StaffActivityRow } from '@/lib/staffActivity';
import { MonthCompareBars } from './MonthCompareBars';
import WorkStatusBoard from './WorkStatusBoard';
import IntakeFlowPanel from './IntakeFlowPanel';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { filterUnitRequestsByDepartment } from '@/lib/siamrajUnitFilters';
import { V2_METRICS, V2_METRIC_LABEL, buildV2Model, type V2Metric } from './v2Model';

const ALL_BUS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayText = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(0, 4)) + 543}`;
const monthText = (ym: string) => `${TH_MONTH[Number(ym.slice(5, 7)) - 1]} ${String(Number(ym.slice(0, 4)) + 543).slice(2)}`;


export default function RecruitOverviewV2({ data }: { data: RecruitOverviewResponse }) {
  const navigate = useNavigate();
  const win = data.window;
  /** BU ที่เทียบ — ล็อก BU เดียว = BU นั้นอย่างเดียว (ไม่ดึง BU นอกสิทธิ์มาเทียบ) */
  const bus = React.useMemo(() => {
    if (data.bu) return [data.bu];
    const base = data.buChoices?.length ? data.buChoices : ALL_BUS;
    return [...base, BU_UNKNOWN];
  }, [data.bu, data.buChoices]);
  const periodText = win.all ? 'ทั้งหมด' : win.from === win.to ? dayText(win.from) : `${dayText(win.from)} – ${dayText(win.to)}`;
  const buText = data.bu ?? 'ทุก BU';
  const filterKey = `${data.bu ?? 'all'}:${win.from}:${win.to}:${data.generatedAt}`;
  /** ตัวกรองบนสุดชุดเดียวกับหน้าเดิม (เจ้าหน้าที่ · ประเภทงาน · งานย่อย · Code Site · จังหวัด · อำเภอ · ตำบล) — คุมใบขอ + รายชื่อทุกส่วน */
  const [reqFilter, setReqFilter] = React.useState<RequestTabFilter>(EMPTY_REQUEST_FILTER);
  const viewKey = `${filterKey}:${JSON.stringify(reqFilter)}`;

  const [stack, setStack] = React.useState<V2Pane[]>([]);
  const [metric, setMetric] = React.useState<V2Metric>('apps');
  /** ไส้ในของการประกาศ — กดยอดไหนเห็นอันนั้น (ค่าเริ่ม = เริ่มหาแล้ว) */
  const [postView, setPostView] = React.useState<'released' | 'unreleased'>('released');
  /** BU ที่กดแท่ง — เรื่องเล่ารายชื่อใต้กราฟ (null = ทุก BU) */
  const [storyBu, setStoryBu] = React.useState<string | null>(null);
  const [clickPage, setClickPage] = React.useState(1);
  // เปลี่ยนวัน/BU = ล้างรายละเอียด + กลับหน้า 1 ทุกตาราง (ห้ามค้างข้อมูลช่วงเดิม)
  React.useEffect(() => {
    setStack([]);
    setStoryBu(null);
    setClickPage(1);
  }, [viewKey]);

  // ใบขอ + การประกาศ (เส้นเดิม) — ทิ้งคำตอบที่ไม่ใช่ตัวกรองปัจจุบัน
  const [stuck, setStuck] = React.useState<{ key: string; data: RecruitStuckResponse | null; error: string | null }>({ key: '', data: null, error: null });
  const [posts, setPosts] = React.useState<{ key: string; total: number | null; jobs: number | null; posted: number | null; postedJobs: number | null; error: string | null }>({ key: '', total: null, jobs: null, posted: null, postedJobs: null, error: null });
  /** งานรายคน + ความเคลื่อนไหวล่าสุด (ภาพรวมแบบ Mobix · 18 พ.ย. 2569) — ดึงครั้งเดียวต่อช่วง/BU */
  const [staff, setStaff] = React.useState<{ key: string; rows: StaffActivityRow[] | null; error: string | null }>({ key: '', rows: null, error: null });
  const [feed, setFeed] = React.useState<{ key: string; items: StaffActivityFeedItem[] | null }>({ key: '', items: null });
  const [links, setLinks] = React.useState<{ key: string; rows: Awaited<ReturnType<typeof fetchManualLinks>> | null }>({ key: '', rows: null });
  React.useEffect(() => {
    let alive = true;
    fetchRecruitStuck(data.bu, { from: win.from, to: win.to })
      .then((d) => alive && setStuck({ key: filterKey, data: d, error: null }))
      .catch((e: unknown) => alive && setStuck({ key: filterKey, data: null, error: friendlyErrorText(e, 'โหลดใบขอไม่ได้') }));
    fetchSoPostGroups({ from: win.from, to: win.to, bu: data.bu, page: 1 })
      .then((d) => alive && setPosts({ key: filterKey, total: d.total, jobs: d.jobs ?? null, posted: d.counts?.posted ?? 0, postedJobs: d.postedJobs ?? null, error: null }))
      .catch((e: unknown) => alive && setPosts({ key: filterKey, total: null, jobs: null, posted: null, postedJobs: null, error: friendlyErrorText(e, 'อ่านรายการโพสต์ไม่ได้') }));
    fetchStaffActivity({ from: win.from, to: win.to, bu: data.bu })
      .then((rows) => alive && setStaff({ key: filterKey, rows, error: null }))
      .catch((e: unknown) => alive && setStaff({ key: filterKey, rows: null, error: friendlyErrorText(e, 'อ่านงานรายคนไม่ได้') }));
    fetchStaffActivityFeed({ from: win.from, to: win.to, bu: data.bu })
      .then((items) => alive && setFeed({ key: filterKey, items }))
      .catch(() => alive && setFeed({ key: filterKey, items: [] }));
    fetchManualLinks({ from: win.from, to: win.to, bu: data.bu })
      .then((rows) => alive && setLinks({ key: filterKey, rows }))
      .catch(() => alive && setLinks({ key: filterKey, rows: null }));
    return () => {
      alive = false;
    };
  }, [filterKey, data.bu, win.from, win.to]);
  const allRows = stuck.key === filterKey ? stuck.data?.requests ?? null : null;
  const reqRows = React.useMemo(() => (allRows ? (filterRequestRows(allRows, reqFilter) as StuckRequest[]) : null), [allRows, reqFilter]);
  const filterOn = isRequestFilterActive(reqFilter);
  // รายชื่อตามตัวกรองบนสุด — ตัวตัดสินเดียวกับหน้าเดิม (`jobFilterOf`) · รายชื่อที่ไม่ผูกใบขอหลุดตอนกรอง (ตั้งใจ เหมือนหน้าเดิม)
  const keep = React.useMemo(() => {
    if (!filterOn || !reqRows) return undefined;
    const ok = jobFilterOf(reqFilter, reqRows, (jobId) => data.appJobs?.[jobId]?.recruiter ?? null);
    return (f: { jobId?: string | null }) => ok(f.jobId ?? null);
  }, [filterOn, reqFilter, reqRows, data.appJobs]);
  const model = React.useMemo(() => buildV2Model(data, keep), [data, keep]);
  /** ใบขอเส้นเดียวกับ Dashboard (กล่องสถานะทำงาน · 18 พ.ย. 2569) — BU + ตัวกรองบนสุดชุดเดียวกับส่วนอื่น */
  const reqFeed = useUnitRequestsFeed();
  const statusJobs = React.useMemo(() => {
    if (reqFeed.feedState !== 'ready') return null;
    const byBu = data.bu ? filterUnitRequestsByDepartment(reqFeed.jobs, data.bu) : reqFeed.jobs;
    return keep ? byBu.filter((j) => keep({ jobId: j.id })) : byBu;
  }, [reqFeed.feedState, reqFeed.jobs, data.bu, keep]);
  const statusRange = React.useMemo(() => (win.all ? null : { from: win.from, to: win.to }), [win.all, win.from, win.to]);
  /** ช่วงก่อน (ช่วงวันเท่ากัน · ตัวกรองชุดเดียวกัน) — เทียบไม่ได้ = null */
  const prevModel = React.useMemo(() => {
    const prev = prevCohortOf(data.apps ?? [], win, data.firstDay, data.generatedAt);
    return prev ? buildV2Model(data, keep, prev) : null;
  }, [data, win, keep]);
  const prevOf = (m: V2Metric): number | null => (prevModel ? (prevModel.stages[m].ids?.length ?? null) : null);
  const appRecruiters = React.useMemo(() => Object.values(data.appJobs ?? {}).map((j) => j.recruiter), [data.appJobs]);
  const eq = reqRows ? stuckEquation(reqRows) : null;
  const openRows = eq?.remaining ?? [];
  /** ประกาศแล้ว / ยังไม่ประกาศ — ตัวแบ่งเดียวกับหัวหน้าโพสต์ประกาศ (เจ้าของ 18 พ.ย. 2569 "ยอดมันไม่ตรงกับหน้าภาพรวมหรอ") */
  const releasedRows = openRows.filter((r) => r.released);
  const unreleasedRows = openRows.filter((r) => !r.released);
  const postLanes: Array<{ key: keyof typeof RELEASE_LANE_TEXT; rows: StuckRequest[]; view: 'released' | 'unreleased' | null }> = [
    { key: 'all', rows: openRows, view: null },
    { key: 'released', rows: releasedRows, view: 'released' },
    { key: 'unreleased', rows: unreleasedRows, view: 'unreleased' },
  ];

  const [areaOpen, setAreaOpen] = React.useState(false);
  const push = (p: V2Pane) => setStack([p]);
  const openRequests = (title: string, rows: StuckRequest[]) => push({ kind: 'requests', title, rows, page: 1 });
  const openNames = (title: string, ids: readonly string[]) => push({ kind: 'names', title, ids: [...ids], page: 1 });
  const openMetric = (m: V2Metric) => {
    setMetric(m);
    push({ kind: 'metric', metric: m, page: 1 });
  };

  // ── กราฟเทียบ BU + ตามวันที่สมัคร ของยอดที่เลือก ──
  const st = model.stages[metric];
  const idSet = st.ids ? new Set(st.ids) : null;
  const inMetric = (id: string | undefined) => Boolean(id && idSet?.has(id));
  /** เดือนในช่วงที่เลือก (กราฟแท่งตั้งเทียบรายเดือน · เจ้าของ 17 พ.ย. 2569) */
  const months = (() => {
    const out: string[] = [];
    for (let y = Number(win.from.slice(0, 4)), m = Number(win.from.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}` <= win.to.slice(0, 7); m === 12 ? ((m = 1), (y += 1)) : (m += 1)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return out;
  })();
  /** BU × เดือน ของยอดที่เลือก — BU ที่ไม่มีรายการเลยไม่ขึ้นแท่ง ("ไม่ระบุ BU" ขึ้นเมื่อมีจริง) */
  const buGroups = bus
    .map((bu) => {
      const byMonth: Record<string, number> = {};
      for (const f of model.cohort) if (buOfFact(f) === bu && inMetric(f.id)) byMonth[bkkDay(f.createdAt).slice(0, 7)] = (byMonth[bkkDay(f.createdAt).slice(0, 7)] ?? 0) + 1;
      return { key: bu, byMonth, total: Object.values(byMonth).reduce((a, b) => a + b, 0) };
    })
    .filter((g) => g.total > 0 || g.key !== BU_UNKNOWN)
    .sort((a, b) => b.total - a.total);

  const unlinked = model.cohort.filter((f) => !f.jobId);

  /** สถานะการออกหาคนรายใบ 9 แบบ (ใบขอที่ดำเนินการ) — กดสถานะ = รายการใบ */
  const stateGroups = POSTING_STATES.map((k) => ({ k, rows: openRows.filter((r) => postingStateOf(r) === k) }));
  /** เบอร์ไม่ซ้ำต่อ BU — เบอร์เดียวสมัครหลาย BU นับ BU ละครั้ง (ผลรวม BU จึงไม่บังคับเท่ายอดรวม) */
  const distinct = [...bus, null].map((bu) => {
    const list = bu === null ? model.cohort : model.cohort.filter((f) => buOfFact(f) === bu);
    return { bu: bu ?? 'รวมทุก BU', apps: list.length, phones: new Set(list.map((f) => f.phoneKey).filter(Boolean)).size, noPhone: list.filter((f) => !f.phoneKey).length };
  });
  const clickRows = [...(data.linkClicks ?? [])].sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label, 'th'));
  const clickPg = pageOf(clickRows, clickPage);
  const embeds: Record<string, React.ReactNode> = {
    distinct: (
      <div className="space-y-2" data-testid="v2-distinct">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BU</TableHead>
              <TableHead className="text-right">รายการสมัคร</TableHead>
              <TableHead className="text-right">เบอร์ไม่ซ้ำ</TableHead>
              <TableHead className="text-right">ไม่มีเบอร์ที่ใช้ได้</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {distinct.map((r) => (
              <TableRow key={r.bu}>
                <TableCell className={r.bu === 'รวมทุก BU' ? 'font-medium' : undefined}>{r.bu}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.apps)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.phones)}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(r.noPhone)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className={cn('text-xs', DASH.sub)}>
          ฐานหลักของหน้านี้คือรายการสมัคร · เบอร์ไม่ซ้ำเป็นตัวแทนคน ไม่ใช่คนไม่ซ้ำที่ยืนยันตัวแล้ว · เบอร์เดียวสมัครหลาย BU นับ BU ละครั้ง ผลรวมของ BU จึงอาจมากกว่ารวมทุก BU
        </p>
      </div>
    ),
    clicks: (
      <div className="space-y-2" data-testid="v2-clicks">
        {data.linkClicks === null || data.linkClicks === undefined ? (
          <p className={cn('text-sm', DASH.muted)}>อ่านยอดคลิกไม่ได้ในช่วงนี้</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ลิงก์ / กลุ่ม</TableHead>
                  <TableHead className="text-right">คลิก</TableHead>
                  <TableHead className="text-right">กดสมัคร</TableHead>
                  <TableHead className="text-right">ส่งใบสมัคร</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clickPg.slice.map((r) => (
                  <TableRow key={`${r.label}:${r.fbGroupId ?? ''}`}>
                    <TableCell className="max-w-64 break-words">{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.clicks)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.applyPresses ?? null)}</TableCell>
                    <TableCell className="text-right">
                      <button type="button" className="rounded px-1 tabular-nums hover:bg-muted/60" onClick={() => setStack((cur) => [...cur, { kind: 'names', title: `ส่งใบสมัคร · ${r.label}`, ids: r.appIds, page: 1 }])}>
                        {fmt(r.appIds.length)}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager {...clickPg} onPage={setClickPage} />
          </>
        )}
        <p className={cn('text-xs', DASH.sub)}>คลิกเป็นจำนวนครั้ง ยอดตั้งแต่สร้างลิงก์ · ยังนับคนที่เปิดฟอร์มแล้วไม่กรอกไม่ได้ (ไม่มีรหัสครั้งเปิดที่ผูกกับใบสมัคร)</p>
      </div>
    ),
    states: (
      <div className="space-y-2" data-testid="v2-posting-states">
        <ul className="divide-y rounded-xl border">
          {stateGroups.map((g) => (
            <li key={g.k}>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                onClick={() => setStack((cur) => [...cur, { kind: 'requests', title: POSTING_STATE_LABEL[g.k], rows: g.rows, page: 1 }])}
              >
                <span>{POSTING_STATE_LABEL[g.k]}</span>
                <span className="font-medium tabular-nums">{fmt(g.rows.length)} ›</span>
              </button>
            </li>
          ))}
        </ul>
        <p className={cn('text-xs', DASH.sub)}>
          ใบขอที่ดำเนินการ {fmt(openRows.length)} ใบ แยกตามหลักฐานล่าสุด ใบละสถานะเดียว · ยังไม่เริ่มหา = ไม่พบหลักฐาน + เตรียมไว้ · ไม่พบหลักฐาน ไม่ได้ยืนยันว่าไม่มีใครทำนอกระบบ
        </p>
      </div>
    ),
    posts: <SoPostGroupsCard from={win.from} to={win.to} bu={data.bu} title="Autopost · รายการโพสต์" />,
    self: links.rows ? <SelfLinksPanel rows={links.rows} onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))} /> : <Skeleton className="h-40 rounded-xl" />,
  };

  const loadingReq = stuck.key !== filterKey;
  /** รวมงานรายคนทั้งช่วง (ทุกคนใน BU) — การ์ดการออกหาคน · null = ยังโหลด */
  const staffSum = (k: StaffActivityKind): number | null =>
    staff.key === filterKey && staff.rows ? staff.rows.reduce((n, r) => n + r[k], 0) : null;
  /** วันสั้นบนหัวการ์ด เช่น "1 พ.ย." / "1–18 พ.ย." */
  const shortDay = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]}`;
  const rangeShort = win.from === win.to ? shortDay(win.from) : `${shortDay(win.from)}–${shortDay(win.to)}`;
  /** อัตราของใบชุดนั้น (ใบ ≠ อัตรา · เจ้าของ 17 พ.ย. 2569 "322 ใบ กี่อัตรา") */
  const sumOf = (rows: readonly StuckRequest[], k: 'requested' | 'filled' | 'cancelled' | 'remaining') => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const rateText = (rows: readonly StuckRequest[] | undefined, label: string, k: 'requested' | 'filled' | 'cancelled' | 'remaining') =>
    rows ? `${label} ${fmt(sumOf(rows, k))} อัตรา` : undefined;
  /** เรื่องเล่ารายชื่อ = รายชื่อของยอดที่เลือก (ERP อ่านไม่ได้ = รายชื่อทั้งหมด) */
  const storyCohort = idSet ? model.cohort.filter((f) => inMetric(f.id)) : model.cohort;
  return (
    <div className="space-y-8" data-testid="recruit-overview-v2">
      <StuckFilterBar rows={allRows ?? []} appRecruiters={appRecruiters} value={reqFilter} onChange={setReqFilter} />

      {/* ── ต้องทำ (บนสุด · ณ ตอนนี้ ไม่ขึ้นกับช่วงวันที่) — แบบ Mobix (เจ้าของ 18 พ.ย. 2569) · กด = ไปหน้าที่แก้ได้ ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-todo-card">
        <SectionTitle title="ต้องทำ" right="ณ ตอนนี้" />
        <TodoList
          items={[
            {
              key: 'waiting',
              n: data.backlog?.waitingStaff.total ?? null,
              title: 'สนใจแล้ว รอเจ้าหน้าที่โทร',
              sub: data.backlog ? `ค้างเกิน 3 วัน ${fmt(data.backlog.waitingStaff.over3)}` : '—',
              tone: 'danger',
              icon: TODO_ICONS.PhoneCall,
              onOpen: () => navigate('/jobs/board?view=list'),
            },
            {
              key: 'uncalled',
              n: data.backlog?.uncalled.total ?? null,
              title: 'ใบสมัครที่ยังไม่มีใครโทร',
              sub: data.backlog ? `อยู่ในคิว AI ${fmt(data.backlog.uncalled.inQueue)} · ค้างเกิน 7 วัน ${fmt(data.backlog.uncalled.over7)}` : '—',
              tone: 'danger',
              icon: TODO_ICONS.UserRoundSearch,
              onOpen: () => navigate('/jobs/board?view=list&bucket=untouched'),
            },
            {
              key: 'overdue',
              n: data.backlog?.appointments?.overdue ?? null,
              title: 'นัดเลยวันแล้ว ยังไม่ลง มา/ไม่มา',
              sub: 'ลงผลที่หน้าติดตามนัดหมาย',
              tone: 'warn',
              icon: TODO_ICONS.CalendarX,
              onOpen: () => navigate('/jobs/board?view=appointments&bucket=overdue_no_result'),
            },
            {
              key: 'unreleased',
              n: loadingReq || !eq ? null : unreleasedRows.length,
              title: 'ใบขอที่ยังไม่ประกาศ',
              sub: eq ? `จากเหลือหา ${fmt(openRows.length)} ใบ` : '—',
              tone: 'info',
              icon: TODO_ICONS.FileText,
              onOpen: eq ? () => openRequests(RELEASE_LANE_TEXT.unreleased.label, unreleasedRows) : undefined,
            },
          ]}
        />
      </Card>

      {/* ── ใบขอ (ใบ + อัตรา) · ใครต้องทำอะไร · งานที่ยังขาดคน — กางไว้ (เจ้าของ 17 พ.ย. 2569 "ซ่อนไว้ทำไม") ── */}
      <Card className="min-w-0 space-y-5 rounded-2xl p-5" data-testid="v2-requests">
        <SectionTitle title="ใบขอ" right={`สถานะ ณ ${dayText(win.to)} · ใบขอใหม่นับตามวันคีย์ใน ERP`} />
        {stuck.error && stuck.key === filterKey ? <p className="text-sm text-destructive">{stuck.error}</p> : null}
        {/* บวกลบลงตัวทั้งใบและอัตรา (เจ้าของ 18 พ.ย. 2569 "ตรงนี้บวกลบกันต้องลง 327 ใบ 378 อัตรา และคำต้องบอกเลยว่าคือสถานะอะไร")
            ใบ: ยกมา + ขอใหม่ − ปิดครบ − ยกเลิก = เหลือหา · อัตรา: ขอไว้ของใบยกมา + ขอมา − หาได้แล้ว − ยกเลิก = เหลือหา
            อัตราหาได้/ยกเลิก = สะสมของใบทุกใบในชุด (รวมที่หาได้บางส่วนของใบที่ยังเปิด) — ERP ไม่มีวันที่ของการหาได้รายอัตรา */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5" data-testid="v2-req-equation">
          <Kpi label={`ยอดยกมา · เปิดอยู่ก่อน ${shortDay(win.from)}`} emphasis value={loadingReq ? undefined : eq ? eq.carried.length : null} sub={eq ? `ขอไว้ ${fmt(sumOf(eq.carried, 'requested'))} อัตรา` : undefined} onClick={eq ? () => openRequests('ยอดยกมา', eq.carried) : undefined} testId="v2-req-carried" />
          <Kpi label={`+ ใบขอใหม่ · ${rangeShort}`} emphasis value={loadingReq ? undefined : eq ? eq.new.length : null} sub={rateText(eq?.new, 'ขอมา', 'requested')} onClick={eq ? () => openRequests('ใบขอใหม่', eq.new) : undefined} testId="v2-req-new" />
          <Kpi label={`− ปิดครบใบขอ · ${rangeShort}`} emphasis value={loadingReq ? undefined : eq ? eq.filled.length : null} sub={reqRows ? `หาได้แล้ว ${fmt(sumOf(reqRows, 'filled'))} อัตรา (รวมใบที่หาได้บางส่วน)` : undefined} onClick={eq ? () => openRequests('ปิดครบใบขอ', eq.filled) : undefined} testId="v2-req-filled" />
          <Kpi label={`− ยกเลิกใบขอ · ${rangeShort}`} emphasis value={loadingReq ? undefined : eq ? eq.cancelled.length : null} sub={reqRows ? `ยกเลิก ${fmt(sumOf(reqRows, 'cancelled'))} อัตรา` : undefined} onClick={eq ? () => openRequests('ยกเลิกใบขอ', eq.cancelled) : undefined} tone="danger" testId="v2-req-cancelled" />
          <Kpi label={`= เหลือหา · ยังเปิดอยู่ ณ ${shortDay(win.to)}`} emphasis value={loadingReq ? undefined : eq ? eq.remaining.length : null} sub={rateText(eq?.remaining, 'เหลือหา', 'remaining')} onClick={eq ? () => openRequests('เหลือหา', eq.remaining) : undefined} testId="v2-req-open" />
        </div>
        {/* สถานะทำงานแบบ Dashboard — ช่วง = วันที่ต้องการคน ตามวันที่ที่เลือก (เจ้าของ 18 พ.ย. 2569 Choice) */}
        <div className="border-t pt-4">
          <WorkStatusBoard
            jobs={statusJobs}
            range={statusRange}
            error={reqFeed.feedState === 'failed' || reqFeed.feedState === 'forbidden' ? 'โหลดใบขอไม่ได้' : null}
            onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))}
            resetKey={viewKey}
          />
        </div>
      </Card>

      {/* ── การออกหาคน: Autopost / โพสต์เอง / Scrap (เจ้าของ 18 พ.ย. 2569 "ยังต้องบอกเรื่อง Autopost โพสต์เอง Scrap ด้วย") ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-outreach-card">
        <SectionTitle title="การออกหาคน" right={`${dayText(win.from)} – ${dayText(win.to)}`} />
        <OutreachTiles
          tiles={[
            {
              key: 'autopost',
              n: posts.key === filterKey ? posts.jobs : null,
              unit: 'งาน',
              sub: posts.key === filterKey && posts.total !== null ? `${fmt(posts.total)} กลุ่ม · เผยแพร่แล้ว ${fmt(posts.posted)} กลุ่ม (${fmt(posts.postedJobs)} งาน)` : '—',
              onOpen: () => push({ kind: 'embed', title: 'Autopost · รายการโพสต์', embed: 'posts' }),
            },
            {
              key: 'self',
              n: staffSum('links'),
              unit: 'ลิงก์',
              sub: staffSum('manualPosted') === null ? '—' : `ติ๊กโพสต์เองแล้ว ${fmt(staffSum('manualPosted'))}`,
              onOpen: () => push({ kind: 'embed', title: 'โพสต์เอง / สร้างลิงก์', embed: 'self' }),
            },
            { key: 'scrap', n: staffSum('scrap'), unit: 'ใบ', sub: 'ใบขอที่สั่ง Scrap · ดูรายคนที่งานรายคน' },
          ]}
        />
      </Card>

      {/* ── รายชื่อเข้ามาไปถึงไหน (เจ้าของ 18 พ.ย. 2569 จากการ์ด Milo "รายชื่อเข้ามาหายไปไหน") — ทุกกล่องบอกขั้นที่หลุด · แยกช่องทางกดไล่ลงถึงคนหามา ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-intake-card">
        <SectionTitle title="รายชื่อเข้ามาไปถึงไหน" right={`${buText} · คนที่สมัคร ${periodText}`} />
        <IntakeFlowPanel cohort={model.cohort} onNames={openNames} resetKey={viewKey} />
      </Card>

      {/* ── การประกาศรับสมัคร ── */}
      <Card className="min-w-0 space-y-4 rounded-2xl p-5" data-testid="v2-posting">
        <SectionTitle title="การประกาศรับสมัคร" />
        {/* 3 ช่องก่อน (เจ้าของ 18 พ.ย. 2569 "ถ้าจากตรงนี้ฉันอ่านฉันคงเอา 165+150+15+157+68+89 แน่นอน โชว์ 3 อันก่อนก็พอ")
            คำเดียวกับหัวหน้าโพสต์ประกาศ · กดประกาศแล้ว/ยังไม่ประกาศ = ก้อนย่อยขึ้นข้างล่าง (PostingProgress) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="v2-post-lanes">
          {postLanes.map((c) => (
            <Kpi
              key={c.key}
              label={RELEASE_LANE_TEXT[c.key].label}
              emphasis
              active={c.view === postView}
              value={loadingReq ? undefined : eq ? c.rows.length : null}
              sub={c.key === 'all' && eq ? `เหลือหา ${fmt(c.rows.reduce((n, r) => n + (r.remaining ?? 0), 0))} อัตรา` : undefined}
              onClick={
                eq
                  ? () => {
                      // ประกาศแล้ว/ยังไม่ประกาศ = ก้อนย่อยข้างล่าง · ใบขอทั้งหมด = กราฟ BU + รายการใบ
                      if (c.view) setPostView(c.view);
                      else openRequests(RELEASE_LANE_TEXT[c.key].label, c.rows);
                    }
                  : undefined
              }
              testId={`v2-post-${c.key}`}
            />
          ))}
        </div>
        {posts.error && posts.key === filterKey ? <p className="text-xs text-destructive">{posts.error}</p> : null}
        {/* ไส้ใน: กดยังไม่เริ่มหา = ใครถือกี่ใบ · กดเริ่มหาแล้ว = มีชื่อ/ไม่มีชื่อ + ใบที่มีชื่อติดขั้นไหน (เจ้าของ 17 พ.ย. 2569) */}
        <div className="border-t pt-4">
          {eq ? (
            <PostingProgress
              view={postView}
              open={openRows}
              onRequests={openRequests}
              onNames={(title, ids, labels) => push({ kind: 'names', title, ids: [...ids], page: 1, labels })}
              resetKey={viewKey}
            />
          ) : (
            <Skeleton className="h-40 rounded-xl" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'embed', title: 'Autopost · รายการโพสต์', embed: 'posts' })}>
            Autopost · รายการโพสต์ {posts.key === filterKey ? fmt(posts.total) : ''}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'embed', title: 'โพสต์เอง / สร้างลิงก์', embed: 'self' })}>
            โพสต์เอง / สร้างลิงก์
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!eq} onClick={() => push({ kind: 'embed', title: 'สถานะและหลักฐานรายใบ', embed: 'states' })}>
            สถานะและหลักฐานรายใบ
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'embed', title: 'เปิดฟอร์ม / ส่งใบสมัคร', embed: 'clicks' })}>
            เปิดฟอร์ม / ส่งใบสมัคร
          </Button>
        </div>
      </Card>

      <Separator />

      {/* ── งานรายคน (เจ้าของ 18 พ.ย. 2569 "วันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป" · Choice ภาพรวม + Filter รายคน) ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-staff-card">
        <SectionTitle title="งานรายคน" right={`${dayText(win.from)} – ${dayText(win.to)}`} />
        <StaffActivityPanel from={win.from} to={win.to} bu={data.bu} rows={staff.key === filterKey ? staff.rows : null} error={staff.key === filterKey ? staff.error : null} onNames={openNames} />
      </Card>

      <Separator />

      {/* ── ผู้สมัครและผลการติดต่อ — ทุกเรื่องของรายชื่ออยู่ในส่วนนี้ (เจ้าของ 17 พ.ย. 2569) ── */}
      <Card className="min-w-0 space-y-5 rounded-2xl p-5" data-testid="v2-applicants">
        <SectionTitle title="ผู้สมัครและผลการติดต่อ" right={`รายการสมัคร${win.asOf ? ` · ผล ณ ${dayText(win.asOf)}` : ''}`} />
        {data.errors.apps ? <p className="text-sm text-destructive">{data.errors.apps}</p> : null}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {V2_METRICS.map((m) => (
            <Kpi
              key={m}
              label={V2_METRIC_LABEL[m]}
              value={model.stages[m].ids === null ? null : model.stages[m].ids?.length}
              prev={win.all ? undefined : prevOf(m)}
              active={metric === m}
              onClick={() => openMetric(m)}
              testId={`v2-kpi-${m}`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => openMetric('allBooked')}>
            ที่มาของยอดนัด
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => openMetric('reached')}>
            ผลโทรต่อของเจ้าหน้าที่
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => push({ kind: 'embed', title: 'เบอร์ไม่ซ้ำ / คนไม่ซ้ำ', embed: 'distinct' })}>
            เบอร์ไม่ซ้ำ / คนไม่ซ้ำ
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => openNames('ยังไม่ผูกใบขอ', unlinked.map((f) => f.id ?? ''))}>
            ยังไม่ผูกใบขอ {fmt(unlinked.length)}
          </Button>
        </div>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-medium">รายชื่อรอติดต่อ</h3>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="รอโทรเกิน 24 ชม." tone="danger" value={model.late.size} onClick={() => openNames('สนใจแล้ว รอโทรเกิน 24 ชม.', [...model.late])} testId="v2-late" />
            <Kpi
              label="สนใจแล้ว รอเจ้าหน้าที่โทร"
              value={model.stages.follow.parts.find((p) => p.key === 'waiting')?.ids.length ?? 0}
              onClick={() => openNames('สนใจแล้ว รอเจ้าหน้าที่โทร', model.stages.follow.parts.find((p) => p.key === 'waiting')?.ids ?? [])}
            />
          </div>
        </section>

        {/* กราฟแท่ง BU ของยอดที่เลือก → กดแท่ง = เล่าเรื่องรายชื่อใต้กราฟ (ช่องทาง › ใครเอาเข้ามา › วิธี › จังหวัด › อายุ/เพศ) */}
        <section className="space-y-4 border-t pt-4" data-testid="v2-compare">
          {st.ids === null ? (
            <p className={cn('text-sm', DASH.muted)}>อ่านข้อมูลแจ้งเข้า ERP ไม่ได้ในช่วงนี้ ไม่ทราบผล</p>
          ) : (
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-medium">
                {V2_METRIC_LABEL[metric]} {fmt(st.ids.length)} · แยกตาม BU
              </h3>
              <MonthCompareBars groups={buGroups} months={months} onPick={(bu) => setStoryBu(bu)} testId="v2-bu-chart" />
            </section>
          )}
          <ApplicantStory
            cohort={storyCohort}
            sets={model.sets}
            bu={storyBu}
            onBu={setStoryBu}
            scopeLabel={V2_METRIC_LABEL[metric]}
            onNames={openNames}
            resetKey={`${viewKey}:${metric}`}
          />
        </section>

        {/* รายชื่ออยู่กับใคร = ทีมสรรหาแต่ละคน เก็บไป → โทร → นัด → ผลนัด → แจ้งเข้า บวกลบลงตัวในแถว (เจ้าของ 17 พ.ย. 2569) */}
        <section className="min-w-0 space-y-2 border-t pt-4" data-testid="v2-holders">
          <h3 className="text-sm font-medium">รายชื่ออยู่กับใคร</h3>
          {/* ไม่ส่ง prev = ไม่มีแถว/ช่องเทียบช่วงก่อน (เจ้าของ 18 พ.ย. 2569 "เอาแถวที่ฉันส่งรูปให้ออกไปเลย เกะกะ") */}
          <CallerResultsTable cohort={model.cohort} onOpen={(title, ids) => openNames(title, ids)} />
        </section>

        <div className="border-t pt-4">
          <section className="min-w-0 space-y-2" data-testid="v2-why">
            <h3 className="text-sm font-medium">เหตุผลที่ยังไม่ได้คน</h3>
            <ul className="space-y-1">
              {model.why.map((p) => {
                const max = Math.max(1, ...model.why.map((x) => x.ids.length));
                return (
                  <li key={p.key}>
                    <button type="button" onClick={() => openNames(p.label, p.ids)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left text-sm hover:bg-muted/60">
                      <span className="w-48 shrink-0">{p.label}</span>
                      <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className={cn('absolute inset-y-0 left-0 rounded-full', TONE.primary.dot)} style={{ width: `${(p.ids.length / max) * 100}%` }} />
                      </span>
                      <span className="w-14 shrink-0 text-right font-medium tabular-nums">{fmt(p.ids.length)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className={cn('text-xs', DASH.sub)}>คนเดียวอาจมีเหตุหลายขั้น ยอดแต่ละแถวรวมกันเป็นจำนวนคนไม่ได้</p>
          </section>
        </div>
      </Card>

      {/* พื้นที่ที่ขาดคน ย้ายลงล่างสุด (เจ้าของ 17 พ.ย. 2569 "เอาไปไว้ด้านล่างเถอะตรงนี้เกะกะ") · ชื่อเจ้าของ 18 พ.ย. 2569 */}
      {/* ── แนวโน้มรายวัน + ความเคลื่อนไหวล่าสุด (แบบ Mobix · 18 พ.ย. 2569) ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-daily-card">
        <SectionTitle title="แนวโน้มรายวัน" right={`${dayText(win.from)} – ${dayText(win.to)}`} />
        <DailyCharts points={dailyPulse(model.cohort, win.from, win.to)} />
      </Card>
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-feed-card">
        <SectionTitle title="ความเคลื่อนไหวล่าสุด" right="30 รายการล่าสุดในช่วง" />
        <ActivityFeed items={feed.key === filterKey ? feed.items : null} today={data.today} onPerson={(id, name) => openNames(name, [id])} />
      </Card>

      {/* พับไว้ กดค่อยกาง (เจ้าของ 18 พ.ย. 2569 "ซ่อนไว้กดค่อยกาง") · ปุ่มรายงานเพิ่มเติม (แบบเดิม) ถอดแล้ว ("เอาออก") */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-area">
        <SectionTitle
          title="พื้นที่ที่ขาดคน"
          right={
            <Button type="button" size="sm" variant="outline" aria-expanded={areaOpen} onClick={() => setAreaOpen((v) => !v)} data-testid="v2-area-toggle">
              {areaOpen ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
              {areaOpen ? 'พับ' : 'ดูแยกจังหวัด / อำเภอ'}
            </Button>
          }
        />
        {areaOpen ? (
          eq ? <StuckAreaTable bare rows={openRows.filter((r) => (r.remaining ?? 0) > 0)} onPick={(title, rows) => openRequests(title, rows)} /> : <Skeleton className="h-32 rounded-xl" />
        ) : null}
      </Card>

      <V2Drawer stack={stack} onStack={setStack} model={model} bus={bus} periodText={periodText} buText={buText} embeds={embeds} />
    </div>
  );
}
