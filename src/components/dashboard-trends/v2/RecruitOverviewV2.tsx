/**
 * ═══ ภาพรวมงานสรรหา v2 — หน้าเดียว (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP `Jarvis-Recruit-Overview-Claude-Final-Checked`) ═══
 * ค่าเริ่มของ `/jobs/board?view=dashboard` ตั้งแต่ 17 พ.ย. 2569 ค่ำ (เจ้าของเทสผ่าน) · หน้า 8 เรื่องเดิมอยู่ `&dash=topics`
 * อ่านภาพใหญ่ก่อน → กดยอดเปิดรายละเอียดทางขวา (`V2Drawer`) · ตัวกรองบนสุด (วันที่ · BU) คุมทุกส่วน
 * ข้อมูลจริงผ่านเส้นเดิมที่ตรวจสิทธิ์: `/api/recruit-overview?asof=1` (ผล ณ วันสิ้นสุด) · `/api/recruit-stuck` · So Scraping · ลิงก์โพสต์เอง
 * นิยามทุกยอดมาจากตัวกลางเดิม (`v2Model.ts`) — ไม่มีตัวเลขฝัง · ไม่ทราบ = "—"
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import { stuckEquation, type StuckRequest } from '@/lib/recruitStuck';
import { POSTING_STATES, POSTING_STATE_LABEL, isPostingStarted, postingStateOf } from '@/lib/recruitPostingState';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import { fetchManualLinks } from '@/lib/jobPostActionsApi';
import { legacyReportsPath, requestPathOfJobId } from '@/lib/jobNavigation';
import { EMPTY_REQUEST_FILTER, filterRequestRows, isRequestFilterActive, jobFilterOf, requestFilterToParams, type RequestTabFilter } from '@/lib/recruitRequestTab';
import { prevCohortOf } from '@/lib/recruitScale';
import { friendlyErrorText } from '@/lib/friendlyError';
import { AUDIENCE_MEASURE_LABEL, BU_UNKNOWN, ageStats, audienceRows, buOfFact, pageOf, bkkDay } from '@/lib/recruitAudience';
import SoPostGroupsCard from '../stuck/SoPostGroupsCard';
import SelfLinksPanel from '../topics/SelfLinksPanel';
import StuckFilterBar from '../stuck/StuckFilterBar';
import StuckTodoTable from '../stuck/StuckTodoTable';
import StuckAreaTable from '../stuck/StuckAreaTable';
import CallerResultsTable from '../stuck/CallerResultsTable';
import V2Drawer, { type V2Pane } from './V2Drawer';
import { BuBars, Kpi, Pager, SectionTitle, TrendBars, fmt, fmtPct } from './V2Parts';
import { BRINGER_UNKNOWN, V2_METRICS, V2_METRIC_LABEL, buildV2Model, bringerOf, holderOf, type V2Metric } from './v2Model';

const ALL_BUS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayText = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(0, 4)) + 543}`;
const monthText = (ym: string) => `${TH_MONTH[Number(ym.slice(5, 7)) - 1]} ${String(Number(ym.slice(0, 4)) + 543).slice(2)}`;

type Holder = 'holder' | 'bringer' | 'booker';
const HOLDER_LABEL: Record<Holder, string> = { holder: 'ผู้รับรายชื่อ', bringer: 'ผู้พารายชื่อเข้ามา', booker: 'ผู้นัด' };
const BOOKER_UNKNOWN = 'ไม่ทราบผู้นัด';

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
  const [trendMonth, setTrendMonth] = React.useState<string | null>(null);
  const [trendUnit, setTrendUnit] = React.useState<'month' | 'day'>('month');
  /** ช่วงอยู่ในเดือนเดียว = รายวันเสมอ (แบบเดือนเหลือแท่งเดียว · เจ้าของ 17 พ.ย. 2569 "บ้านนอกมาก") · ปุ่ม "เดือน" ปิดไว้ ไม่ซ่อน (ของบนจอไม่ขยับ) */
  const multiMonth = win.from.slice(0, 7) !== win.to.slice(0, 7);
  const shownUnit: 'month' | 'day' = multiMonth ? trendUnit : 'day';
  const [holder, setHolder] = React.useState<Holder>('holder');
  const [holderPage, setHolderPage] = React.useState(1);
  const [chPage, setChPage] = React.useState(1);
  const [workPage, setWorkPage] = React.useState(1);
  const [clickPage, setClickPage] = React.useState(1);
  // เปลี่ยนวัน/BU = ล้างรายละเอียด + กลับหน้า 1 ทุกตาราง (ห้ามค้างข้อมูลช่วงเดิม)
  React.useEffect(() => {
    setStack([]);
    setTrendMonth(null);
    setHolderPage(1);
    setChPage(1);
    setWorkPage(1);
    setClickPage(1);
  }, [viewKey]);

  // ใบขอ + การประกาศ (เส้นเดิม) — ทิ้งคำตอบที่ไม่ใช่ตัวกรองปัจจุบัน
  const [stuck, setStuck] = React.useState<{ key: string; data: RecruitStuckResponse | null; error: string | null }>({ key: '', data: null, error: null });
  const [posts, setPosts] = React.useState<{ key: string; total: number | null; error: string | null }>({ key: '', total: null, error: null });
  const [links, setLinks] = React.useState<{ key: string; rows: Awaited<ReturnType<typeof fetchManualLinks>> | null }>({ key: '', rows: null });
  React.useEffect(() => {
    let alive = true;
    fetchRecruitStuck(data.bu, { from: win.from, to: win.to })
      .then((d) => alive && setStuck({ key: filterKey, data: d, error: null }))
      .catch((e: unknown) => alive && setStuck({ key: filterKey, data: null, error: friendlyErrorText(e, 'โหลดใบขอไม่ได้') }));
    fetchSoPostGroups({ from: win.from, to: win.to, bu: data.bu, page: 1 })
      .then((d) => alive && setPosts({ key: filterKey, total: d.total, error: null }))
      .catch((e: unknown) => alive && setPosts({ key: filterKey, total: null, error: friendlyErrorText(e, 'อ่านรายการโพสต์ไม่ได้') }));
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
  /** ช่วงก่อน (ช่วงวันเท่ากัน · ตัวกรองชุดเดียวกัน) — เทียบไม่ได้ = null */
  const prevModel = React.useMemo(() => {
    const prev = prevCohortOf(data.apps ?? [], win, data.firstDay, data.generatedAt);
    return prev ? buildV2Model(data, keep, prev) : null;
  }, [data, win, keep]);
  const prevOf = (m: V2Metric): number | null => (prevModel ? (prevModel.stages[m].ids?.length ?? null) : null);
  const appRecruiters = React.useMemo(() => Object.values(data.appJobs ?? {}).map((j) => j.recruiter), [data.appJobs]);
  const eq = reqRows ? stuckEquation(reqRows) : null;
  const openRows = eq?.remaining ?? [];
  const started = openRows.filter(isPostingStarted);
  const notStarted = openRows.filter((r) => !isPostingStarted(r));

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
  const buBars = bus
    .map((bu) => {
      const n = idSet ? model.cohort.filter((f) => buOfFact(f) === bu && inMetric(f.id)).length : null;
      return { bu, value: n, result: n, sample: n ?? 0 };
    })
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  const trendPoints = (() => {
    const unit = trendMonth ? 'day' : shownUnit;
    const keys: string[] = [];
    const days: string[] = [];
    for (let d = trendMonth ? (trendMonth + '-01' > win.from ? trendMonth + '-01' : win.from) : win.from; d <= win.to; d = bkkDay(new Date(Date.parse(`${d}T12:00:00+07:00`) + 86_400_000).toISOString())) {
      if (trendMonth && !d.startsWith(trendMonth)) break;
      days.push(d);
    }
    for (const d of days) {
      const k = unit === 'month' ? d.slice(0, 7) : d;
      if (!keys.includes(k)) keys.push(k);
    }
    return keys.map((k) => {
      const list = model.cohort.filter((f) => {
        const d = bkkDay(f.createdAt);
        return unit === 'month' ? d.startsWith(k) : d === k;
      });
      return { key: k, n: idSet ? list.filter((f) => inMetric(f.id)).length : null, ids: list.filter((f) => inMetric(f.id)).map((f) => f.id ?? '') };
    });
  })();

  // ── ผู้สมัครมาจากไหน (ช่องทางหลัก) — 5 ยอด เรียงตาม % นัดได้ ──
  const chRows = audienceRows(model.cohort, 'ch', model.sets, 'apps', 'count');
  const chPg = pageOf(chRows, chPage);

  // ── รายชื่ออยู่กับใคร ──
  const holderRows = (() => {
    const m = new Map<string, string[]>();
    // ผู้นัด = เฉพาะรายการที่นัดได้ (คนบันทึกนัด) · อื่น = ทุกรายการ
    for (const f of holder === 'booker' ? model.cohort.filter((x) => x.appointmentAt) : model.cohort) {
      const k = holder === 'holder' ? holderOf(f) : holder === 'bringer' ? bringerOf(f) : f.bookedBy?.trim() || BOOKER_UNKNOWN;
      m.set(k, [...(m.get(k) ?? []), f.id ?? '']);
    }
    return [...m.entries()]
      .map(([name, ids]) => ({
        name,
        ids,
        late: ids.filter((id) => model.late.has(id)),
        booked: ids.filter((id) => model.sets.allBooked.has(id)),
        showed: ids.filter((id) => model.sets.showed.has(id)),
        erp: ids.every((id) => model.sets.erpUnknown.has(id)) ? null : ids.filter((id) => model.sets.erp.has(id)),
      }))
      .sort((a, b) => b.ids.length - a.ids.length || a.name.localeCompare(b.name, 'th'));
  })();
  const holderPg = pageOf(holderRows, holderPage);

  // ── คนสมัครงานที่ไหน (จังหวัดของงานที่สมัคร — ใบขอในรายการของช่วง) ──
  const jobProvince = new Map((reqRows ?? []).filter((r) => r.jobId).map((r) => [r.jobId as string, r.province?.trim() || null]));
  const workRows = (() => {
    const m = new Map<string, string[]>();
    for (const f of model.cohort) {
      const k = (f.jobId && jobProvince.get(f.jobId)) || 'ไม่ทราบพื้นที่งาน';
      m.set(k, [...(m.get(k) ?? []), f.id ?? '']);
    }
    return [...m.entries()].map(([k, ids]) => ({ k, ids })).sort((a, b) => (a.k === 'ไม่ทราบพื้นที่งาน' ? 1 : 0) - (b.k === 'ไม่ทราบพื้นที่งาน' ? 1 : 0) || b.ids.length - a.ids.length || a.k.localeCompare(b.k, 'th'));
  })();
  const workPg = pageOf(workRows, workPage);
  const age = ageStats(model.cohort);
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
    todo: <StuckTodoTable rows={openRows} onPick={(title, rows) => setStack((cur) => [...cur, { kind: 'requests', title, rows, page: 1 }])} />,
    area: (
      <StuckAreaTable
        rows={openRows.filter((r) => (r.remaining ?? 0) > 0)}
        title="งานที่ยังขาดคน"
        onPick={(title, rows) => setStack((cur) => [...cur, { kind: 'requests', title, rows, page: 1 }])}
      />
    ),
    callers: (
      <CallerResultsTable
        cohort={model.cohort}
        prev={prevModel?.cohort ?? null}
        onOpen={(title, ids) => setStack((cur) => [...cur, { kind: 'names', title, ids: [...ids], page: 1 }])}
      />
    ),
    posts: <SoPostGroupsCard from={win.from} to={win.to} bu={data.bu} title="Autopost · รายการโพสต์" />,
    self: links.rows ? <SelfLinksPanel rows={links.rows} onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))} /> : <Skeleton className="h-40 rounded-xl" />,
  };

  const loadingReq = stuck.key !== filterKey;
  return (
    <div className="space-y-8" data-testid="recruit-overview-v2">
      <StuckFilterBar rows={allRows ?? []} appRecruiters={appRecruiters} value={reqFilter} onChange={setReqFilter} />
      {/* ── ใบขอ + รายชื่อรอติดต่อ | การประกาศรับสมัคร ── */}
      <Card className="grid gap-6 rounded-2xl p-5 lg:grid-cols-2">
        <section className="min-w-0 space-y-4">
          <SectionTitle title="ใบขอ" right="หน่วย: ใบ" />
          {stuck.error && stuck.key === filterKey ? <p className="text-sm text-destructive">{stuck.error}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="ดำเนินการ" emphasis value={loadingReq ? undefined : eq ? eq.remaining.length : null} onClick={eq ? () => openRequests('ดำเนินการ', eq.remaining) : undefined} testId="v2-req-open" />
            <Kpi label="ใบขอใหม่" value={loadingReq ? undefined : eq ? eq.new.length : null} onClick={eq ? () => openRequests('ใบขอใหม่', eq.new) : undefined} />
            <Kpi label="ปิดใบขอ" value={loadingReq ? undefined : eq ? eq.filled.length : null} onClick={eq ? () => openRequests('ปิดใบขอ', eq.filled) : undefined} />
            <Kpi label="ยกเลิกใบขอ" value={loadingReq ? undefined : eq ? eq.cancelled.length : null} onClick={eq ? () => openRequests('ยกเลิกใบขอ', eq.cancelled) : undefined} tone="danger" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={!eq} onClick={() => push({ kind: 'embed', title: 'ใครต้องทำอะไร', embed: 'todo' })}>
              ใครต้องทำอะไร
            </Button>
          </div>
          <p className={cn('text-xs', DASH.sub)}>
            ทั้งหมดในรายงานนี้ {fmt(reqRows?.length ?? null)} ใบ · สถานะ ณ {dayText(win.to)} · ใบขอใหม่นับตามวันคีย์ใน ERP
          </p>
          <div className="space-y-2 border-t pt-4">
            <h3 className="text-sm font-medium">รายชื่อรอติดต่อ</h3>
            <div className="grid grid-cols-2 gap-3">
              <Kpi label="รอโทรเกิน 24 ชม." emphasis tone="danger" value={model.late.size} onClick={() => openNames('สนใจแล้ว รอโทรเกิน 24 ชม.', [...model.late])} testId="v2-late" />
              <Kpi
                label="สนใจแล้ว รอเจ้าหน้าที่โทร"
                emphasis
                value={model.stages.follow.parts.find((p) => p.key === 'waiting')?.ids.length ?? 0}
                onClick={() => openNames('สนใจแล้ว รอเจ้าหน้าที่โทร', model.stages.follow.parts.find((p) => p.key === 'waiting')?.ids ?? [])}
              />
            </div>
          </div>
        </section>
        <section className="min-w-0 space-y-4 border-t pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <SectionTitle title="การประกาศรับสมัคร" />
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="ยังไม่เริ่มหา" emphasis value={loadingReq ? undefined : eq ? notStarted.length : null} onClick={eq ? () => openRequests('ยังไม่เริ่มหา', notStarted) : undefined} />
            <Kpi label="เริ่มหาคนแล้ว" emphasis value={loadingReq ? undefined : eq ? started.length : null} onClick={eq ? () => openRequests('เริ่มหาคนแล้ว', started) : undefined} />
            <Kpi label="Autopost · รายการโพสต์" emphasis value={posts.key === filterKey ? posts.total : undefined} onClick={() => push({ kind: 'embed', title: 'Autopost · รายการโพสต์', embed: 'posts' })} />
          </div>
          {posts.error && posts.key === filterKey ? <p className="text-xs text-destructive">{posts.error}</p> : null}
          <p className={cn('text-xs', DASH.sub)}>ยังไม่เริ่มหา / เริ่มหาคนแล้ว นับใบขอที่ดำเนินการ · Autopost นับรายการโพสต์</p>
          <div className="flex flex-wrap gap-2">
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
        </section>
      </Card>

      <Separator />
      {/* ── ผู้สมัครและผลการติดต่อ ── */}
      <Card className="space-y-4 rounded-2xl p-5">
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
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="v2-equation">
          <span className={DASH.sub}>จากรายการทั้งหมด</span>
          {model.equation.map((p, i) => (
            <React.Fragment key={p.key}>
              {i > 0 ? <span className={DASH.sub}>+</span> : null}
              <button type="button" className="rounded px-1 hover:bg-muted/60" onClick={() => openNames(`รายการสมัคร · ${p.label}`, p.ids)}>
                {p.label} <span className="font-medium tabular-nums">{fmt(p.ids.length)}</span>
              </button>
            </React.Fragment>
          ))}
          <span className={DASH.sub}>= {fmt(model.cohort.length)} รายการ</span>
        </p>
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
      </Card>

      {/* ── เปรียบเทียบ BU และช่วงเวลา ── */}
      <Card className="space-y-4 rounded-2xl p-5" data-testid="v2-compare">
        <div>
          <SectionTitle title={`เปรียบเทียบ BU และช่วงเวลา · ${V2_METRIC_LABEL[metric]}`} right={buText} />
        </div>
        {st.ids === null ? (
          <p className={cn('text-sm', DASH.muted)}>อ่านข้อมูลแจ้งเข้า ERP ไม่ได้ในช่วงนี้ — ไม่ทราบผล</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="min-w-0 space-y-2">
              <h3 className="text-sm font-medium">แยกตาม BU</h3>
              <BuBars bars={buBars} unit="รายการ" onPick={(bu) => push({ kind: 'metric', metric, bu, page: 1 })} />
            </section>
            <section className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">
                  ตามวันที่สมัคร · {V2_METRIC_LABEL[metric]} (รายการ){trendMonth ? ` · ${monthText(trendMonth)}` : ''}
                </h3>
                <div className="flex gap-1">
                  {trendMonth ? (
                    <Button type="button" size="xs" variant="outline" onClick={() => setTrendMonth(null)}>
                      ทุกเดือน
                    </Button>
                  ) : (
                    <>
                      <Button type="button" size="xs" variant={shownUnit === 'month' ? 'default' : 'outline'} disabled={!multiMonth} onClick={() => setTrendUnit('month')}>
                        เดือน
                      </Button>
                      <Button type="button" size="xs" variant={shownUnit === 'day' ? 'default' : 'outline'} onClick={() => setTrendUnit('day')}>
                        วัน
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <TrendBars
                points={trendPoints}
                labelOf={(k) => (k.length === 7 ? monthText(k) : String(Number(k.slice(8, 10))))}
                onPick={(k) => {
                  if (k.length === 7) setTrendMonth(k);
                  else openNames(`${V2_METRIC_LABEL[metric]} · สมัคร ${dayText(k)}`, trendPoints.find((p) => p.key === k)?.ids ?? []);
                }}
              />
              <p className={cn('text-xs', DASH.sub)}>แบ่งตามวันที่สมัคร ผลถึงวันที่เลือก · แท่งรวมตรงกับยอดที่เลือก ไม่ใช่จำนวนครั้งที่โทรในวันนั้น</p>
            </section>
          </div>
        )}
      </Card>

      <Separator />
      {/* ── ผู้สมัครมาจากไหน | รายชื่ออยู่กับใคร ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-channels">
          <SectionTitle title="ผู้สมัครมาจากไหน" right="% นัดได้ / รายการสมัคร" />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ช่องทาง / ที่มา</TableHead>
                  <TableHead className="text-right">สมัคร</TableHead>
                  <TableHead className="text-right">{AUDIENCE_MEASURE_LABEL.follow}</TableHead>
                  <TableHead className="text-right">นัดได้</TableHead>
                  <TableHead className="text-right">มา</TableHead>
                  <TableHead className="text-right">นัดได้ %</TableHead>
                  <TableHead className="text-right">ERP / สมัคร %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chPg.slice.map((r) => (
                  <TableRow key={r.key} className="cursor-pointer" onClick={() => push({ kind: 'audience', view: 'sub', filter: { dims: { ch: r.key }, results: [] }, measure: 'apps', display: 'count', page: 1, title: r.key })}>
                    <TableCell className="font-medium">{r.key}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.counts.apps)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.counts.follow)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.counts.allBooked)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.counts.showed)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.rates.allBooked)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmt(r.counts.erp)} · {fmtPct(r.rates.erp)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager {...chPg} onPage={setChPage} />
          <p className={cn('text-xs', DASH.sub)}>เลือกช่องทางเพื่อดูช่องทางรอง กลุ่ม เพจ อายุ จังหวัด และรายชื่อ · ERP จับคู่จากเบอร์โทร</p>
        </Card>

        <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-holders">
          <SectionTitle
            title="รายชื่ออยู่กับใคร"
            right={
              <Select
                value={holder}
                onValueChange={(v) => {
                  setHolder(v as Holder);
                  setHolderPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-44" aria-label="ดูตาม">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(HOLDER_LABEL) as Holder[]).map((h) => (
                    <SelectItem key={h} value={h}>
                      {HOLDER_LABEL[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{holder === 'holder' ? 'เจ้าหน้าที่' : holder === 'bringer' ? 'ผู้พารายชื่อ' : 'ผู้นัด'}</TableHead>
                  <TableHead className="text-right">รายการ</TableHead>
                  <TableHead className="text-right">เกิน 24 ชม.</TableHead>
                  <TableHead className="text-right">นัดได้</TableHead>
                  <TableHead className="text-right">มา</TableHead>
                  <TableHead className="text-right">ERP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holderPg.slice.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name === BRINGER_UNKNOWN || r.name === BOOKER_UNKNOWN ? <span className={DASH.muted}>{r.name}</span> : r.name}</TableCell>
                    {(
                      [
                        ['ids', r.ids],
                        ['late', r.late],
                        ['booked', r.booked],
                        ['showed', r.showed],
                        ['erp', r.erp],
                      ] as const
                    ).map(([k, ids]) => (
                      <TableCell key={k} className="text-right">
                        <button type="button" disabled={ids === null} className="rounded px-1 tabular-nums hover:bg-muted/60" onClick={() => ids && openNames(`${r.name} · ${k === 'ids' ? 'รายการ' : k === 'late' ? 'เกิน 24 ชม.' : k === 'booked' ? 'นัดได้' : k === 'showed' ? 'มา' : 'ERP'}`, ids)}>
                          {fmt(ids?.length ?? null)}
                        </button>
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager {...holderPg} onPage={setHolderPage} />
          <div className="border-t pt-3">
            <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'embed', title: 'ผลงานรายคน', embed: 'callers' })}>
              ผลงานรายคน
            </Button>
          </div>
        </Card>
      </div>

      {/* ── เหตุผลที่ยังไม่ได้คน | คนสมัครงานที่ไหน ── */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-why">
          <SectionTitle title="เหตุผลที่ยังไม่ได้คน" />
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
          <p className={cn('text-xs', DASH.sub)}>ผู้สมัครคนเดียวอาจมีเหตุไม่สำเร็จหลายขั้น ยอดแต่ละแถวจึงรวมกันเป็นจำนวนคนไม่ได้</p>
        </Card>

        <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-work">
          <SectionTitle title="คนสมัครงานที่ไหน" />
          <p className={cn('text-xs', DASH.sub)}>จังหวัดของงานที่เลือกสมัคร แยกจากจังหวัดที่ผู้สมัครอยู่</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>จังหวัดของงาน</TableHead>
                  <TableHead className="text-right">รายการสมัคร</TableHead>
                  <TableHead className="text-right">สัดส่วน</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workPg.slice.map((r) => (
                  <TableRow key={r.k} className="cursor-pointer" onClick={() => openNames(`สมัครงาน ${r.k}`, r.ids)}>
                    <TableCell className="font-medium">{r.k}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.ids.length)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(model.cohort.length ? (r.ids.length / model.cohort.length) * 100 : null)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pager {...workPg} onPage={setWorkPage} />
          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'audience', view: 'home', filter: { dims: {}, results: [] }, measure: 'apps', display: 'count', page: 1, title: 'ผู้สมัครอยู่จังหวัดไหน' })}>
              ผู้สมัครอยู่จังหวัดไหน
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={!eq} onClick={() => push({ kind: 'embed', title: 'งานที่ยังขาดคน', embed: 'area' })}>
              งานที่ยังขาดคน
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'audience', view: 'age', filter: { dims: {}, results: [] }, measure: 'apps', display: 'count', page: 1, title: 'อายุผู้สมัคร' })} data-testid="v2-age">
              อายุผู้สมัคร · เฉลี่ย {age.average === null ? '—' : age.average.toFixed(1)} ปี
            </Button>
          </div>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            navigate(legacyReportsPath(win, data.bu, requestFilterToParams(reqFilter)));
            window.scrollTo({ top: 0 });
          }}
        >
          รายงานเพิ่มเติม (แบบเดิม)
        </Button>
      </div>

      <V2Drawer stack={stack} onStack={setStack} model={model} bus={bus} periodText={periodText} buText={buText} embeds={embeds} />
    </div>
  );
}
