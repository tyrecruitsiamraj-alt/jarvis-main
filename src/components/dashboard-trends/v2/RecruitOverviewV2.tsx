/**
 * ═══ ภาพรวมงานสรรหา v2 — หน้าเดียว (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP `Jarvis-Recruit-Overview-Claude-Final-Checked`) ═══
 * ค่าเริ่มของ `/jobs/board?view=dashboard` ตั้งแต่ 17 พ.ย. 2569 ค่ำ (เจ้าของเทสผ่าน) · หน้า 8 เรื่องเดิมอยู่ `&dash=topics`
 * อ่านภาพใหญ่ก่อน → กดยอดเปิดรายละเอียดทางขวา (`V2Drawer`) · ตัวกรองบนสุด (วันที่ · BU) คุมทุกส่วน
 * ข้อมูลจริงผ่านเส้นเดิมที่ตรวจสิทธิ์: `/api/recruit-overview?asof=1` (ผล ณ วันสิ้นสุด) · `/api/recruit-stuck` · So Scraping · ลิงก์โพสต์เอง
 * นิยามทุกยอดมาจากตัวกลางเดิม (`v2Model.ts`) — ไม่มีตัวเลขฝัง · ไม่ทราบ = "—"
 */
import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { fetchRecruitStuck, type RecruitStuckResponse } from '@/lib/recruitStuckApi';
import { stuckEquation, type StuckRequest } from '@/lib/recruitStuck';
import { POSTING_STATES, POSTING_STATE_LABEL, postingStateOf } from '@/lib/recruitPostingState';
import { fetchSoPostGroups } from '@/lib/soPostGroupsApi';
import { fetchManualLinks } from '@/lib/jobPostActionsApi';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { RELEASE_LANE_TEXT } from '@/lib/boardRelease';
import { prevCohortOf } from '@/lib/recruitScale';
import { friendlyErrorText } from '@/lib/friendlyError';
import { BU_UNKNOWN, pageOf } from '@/lib/recruitAudience';
import SoPostGroupsCard from '../stuck/SoPostGroupsCard';
import SelfLinksPanel from '../topics/SelfLinksPanel';
import OutreachPeopleTable from './OutreachPeopleTable';
import { outreachByPerson } from '@/lib/outreachByPerson';
import StuckAreaTable from '../stuck/StuckAreaTable';
import V2Drawer, { type V2Pane } from './V2Drawer';
import PostingProgress from './PostingProgress';
import { Kpi, Pager, SectionTitle, fmt } from './V2Parts';
import StaffActivityPanel from './StaffActivityPanel';
import { ActivityFeed, OutreachTiles, TODO_ICONS, TodoList } from './PulseParts';
import { fetchStaffActivity, fetchStaffActivityFeed } from '@/lib/staffActivityApi';
import type { StaffActivityFeedItem, StaffActivityKind, StaffActivityRow } from '@/lib/staffActivity';
import RequestBuPanel from './RequestBuPanel';
import IntakeFlowPanel from './IntakeFlowPanel';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { filterUnitRequestsByDepartment } from '@/lib/siamrajUnitFilters';
import { buildV2Model } from './v2Model';

const ALL_BUS = ['LBD', 'LBA', 'LM', 'DS', 'SN'];
const TH_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const dayText = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]} ${Number(ymd.slice(0, 4)) + 543}`;
const monthText = (ym: string) => `${TH_MONTH[Number(ym.slice(5, 7)) - 1]} ${String(Number(ym.slice(0, 4)) + 543).slice(2)}`;


export default function RecruitOverviewV2({ data }: { data: RecruitOverviewResponse }) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const win = data.window;
  /** BU ที่เทียบ — ล็อก BU เดียว = BU นั้นอย่างเดียว (ไม่ดึง BU นอกสิทธิ์มาเทียบ) */
  const bus = React.useMemo(() => {
    if (data.bu) return [data.bu];
    const base = data.buChoices?.length ? data.buChoices : ALL_BUS;
    return [...base, BU_UNKNOWN];
  }, [data.bu, data.buChoices]);
  const periodText = win.all ? 'ทั้งหมด' : win.from === win.to ? dayText(win.from) : `${dayText(win.from)} – ${dayText(win.to)}`;
  const buText = data.bu ?? 'ทุก BU';
  /** การ์ด "ต้องทำ" กดแล้วไปหน้าผู้สมัคร เห็นคนชุดเดียวกับเลข — BU เดียวกับที่เลือกบนหน้านี้ (เจ้าของ 18 พ.ย. 2569) */
  const buQs = data.bu ? `&bu=${encodeURIComponent(data.bu)}` : '';
  const filterKey = `${data.bu ?? 'all'}:${win.from}:${win.to}:${data.generatedAt}`;
  /**
   * แถบกรองบนสุด 7 ช่อง (เจ้าหน้าที่ · ประเภทงาน · งานย่อย · Code Site · จังหวัด · อำเภอ · ตำบล) ถอดแล้ว
   * (เจ้าของ 19 พ.ย. 2569 Choice "ถอดออกทั้งแถบ") — เหลือปฏิทิน + BU คุมทั้งหน้า · หน้าแบบเดิม (`RecruitStuckBody`) ยังมีแถบนี้
   */
  const viewKey = filterKey;

  const [stack, setStack] = React.useState<V2Pane[]>([]);
  /** ไส้ในของการประกาศ — กดยอดไหนเห็นอันนั้น (ค่าเริ่ม = เริ่มหาแล้ว) */
  const [postView, setPostView] = React.useState<'released' | 'unreleased'>('released');
  const [clickPage, setClickPage] = React.useState(1);
  // เปลี่ยนวัน/BU = ล้างรายละเอียด + กลับหน้า 1 ทุกตาราง (ห้ามค้างข้อมูลช่วงเดิม)
  React.useEffect(() => {
    setStack([]);
    setClickPage(1);
  }, [viewKey]);

  // ใบขอ + การประกาศ (เส้นเดิม) — ทิ้งคำตอบที่ไม่ใช่ตัวกรองปัจจุบัน
  const [stuck, setStuck] = React.useState<{ key: string; data: RecruitStuckResponse | null; error: string | null }>({ key: '', data: null, error: null });
  const [posts, setPosts] = React.useState<{ key: string; total: number | null; error: string | null }>({ key: '', total: null, error: null });
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
      .then((d) => alive && setPosts({ key: filterKey, total: d.total, error: null }))
      .catch((e: unknown) => alive && setPosts({ key: filterKey, total: null, error: friendlyErrorText(e, 'อ่านรายการโพสต์ไม่ได้') }));
    fetchStaffActivity({ from: win.from, to: win.to, bu: data.bu })
      .then((rows) => alive && setStaff({ key: filterKey, rows, error: null }))
      .catch((e: unknown) => alive && setStaff({ key: filterKey, rows: null, error: friendlyErrorText(e, 'อ่านงานรายคนไม่ได้') }));
    fetchStaffActivityFeed({ from: win.from, to: win.to, bu: data.bu })
      .then((items) => alive && setFeed({ key: filterKey, items }))
      .catch(() => alive && setFeed({ key: filterKey, items: [] }));
    return () => {
      alive = false;
    };
  }, [filterKey, data.bu, win.from, win.to]);
  /**
   * ลิงก์โพสต์เอง — โหลดพร้อมหน้าอีกครั้ง (19 พ.ย. 2569 ตารางรายคนของการสั่งงานใช้ชุดนี้ · หลังเพิ่มดัชนี 191 วัดได้ 1.8 วิ จากเดิม 11.3 วิ)
   */
  React.useEffect(() => {
    let alive = true;
    fetchManualLinks({ from: win.from, to: win.to, bu: data.bu })
      .then((rows) => alive && setLinks({ key: filterKey, rows }))
      .catch(() => alive && setLinks({ key: filterKey, rows: null }));
    return () => {
      alive = false;
    };
  }, [filterKey, win.from, win.to, data.bu]);
  const linkRows = links.key === filterKey ? links.rows : null;
  const allRows = stuck.key === filterKey ? stuck.data?.requests ?? null : null;
  const reqRows: StuckRequest[] | null = allRows;
  const model = React.useMemo(() => buildV2Model(data), [data]);
  /** การสั่งงานรายคน (19 พ.ย. 2569 Choice "ในการสั่งงาน คนละแถว") */
  const outreachPeople = staff.key === filterKey && staff.rows && linkRows ? outreachByPerson(staff.rows, linkRows, model.cohort) : null;
  /** ใบขอเส้นเดียวกับ Dashboard (กล่องสถานะทำงาน · 18 พ.ย. 2569) — BU ชุดเดียวกับส่วนอื่น */
  const reqFeed = useUnitRequestsFeed();
  const statusJobs = React.useMemo(() => {
    if (reqFeed.feedState !== 'ready') return null;
    return data.bu ? filterUnitRequestsByDepartment(reqFeed.jobs, data.bu) : reqFeed.jobs;
  }, [reqFeed.feedState, reqFeed.jobs, data.bu]);
  /** ช่วงก่อน (ช่วงวันเท่ากัน) — เทียบไม่ได้ = null */
  const prevModel = React.useMemo(() => {
    const prev = prevCohortOf(data.apps ?? [], win, data.firstDay, data.generatedAt);
    return prev ? buildV2Model(data, undefined, prev) : null;
  }, [data, win]);
  const eq = reqRows ? stuckEquation(reqRows) : null;
  const openRows = eq?.remaining ?? [];
  /** ประกาศแล้ว / ยังไม่ประกาศ — ตัวแบ่งเดียวกับหัวหน้าโพสต์ประกาศ (เจ้าของ 18 พ.ย. 2569 "ยอดมันไม่ตรงกับหน้าภาพรวมหรอ") */
  const releasedRows = openRows.filter((r) => r.released);
  const unreleasedRows = openRows.filter((r) => !r.released);
  /** ช่อง "ใบขอทั้งหมด" ถอดแล้ว — ซ้ำกับเหลือหา (เจ้าของ 19 พ.ย. 2569 "แก้ 2 อันนี้ก่อน") */
  const postLanes: Array<{ key: 'released' | 'unreleased'; rows: StuckRequest[] }> = [
    { key: 'released', rows: releasedRows },
    { key: 'unreleased', rows: unreleasedRows },
  ];

  const [areaOpen, setAreaOpen] = React.useState(false);
  const [feedOpen, setFeedOpen] = React.useState(false);
  const push = (p: V2Pane) => setStack([p]);
  const openRequests = (title: string, rows: StuckRequest[]) => push({ kind: 'requests', title, rows, page: 1 });
  const openNames = (title: string, ids: readonly string[]) => push({ kind: 'names', title, ids: [...ids], page: 1 });

  /** เดือนในช่วงที่เลือก (กราฟแท่งตั้งเทียบรายเดือน · เจ้าของ 17 พ.ย. 2569) */
  const months = (() => {
    const out: string[] = [];
    for (let y = Number(win.from.slice(0, 4)), m = Number(win.from.slice(5, 7)); `${y}-${String(m).padStart(2, '0')}` <= win.to.slice(0, 7); m === 12 ? ((m = 1), (y += 1)) : (m += 1)) {
      out.push(`${y}-${String(m).padStart(2, '0')}`);
    }
    return out;
  })();
  /** สถานะการออกหาคนรายใบ 9 แบบ (ใบขอที่ดำเนินการ) — กดสถานะ = รายการใบ */
  const stateGroups = POSTING_STATES.map((k) => ({ k, rows: openRows.filter((r) => postingStateOf(r) === k) }));
  const clickRows = [...(data.linkClicks ?? [])].sort((a, b) => b.clicks - a.clicks || a.label.localeCompare(b.label, 'th'));
  const clickPg = pageOf(clickRows, clickPage);
  const embeds: Record<string, React.ReactNode> = {
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
    self: linkRows ? <SelfLinksPanel rows={linkRows} onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))} /> : <Skeleton className="h-40 rounded-xl" />,
    // กดชื่อในตารางรายคน = แผงโพสต์เองของคนนั้น
    ...Object.fromEntries(
      (outreachPeople ?? []).map((p) => [
        `self:${p.name}`,
        linkRows ? <SelfLinksPanel key={p.name} rows={linkRows.filter((l) => (l.by.trim() || 'ไม่รู้') === p.name)} onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))} /> : null,
      ]),
    ),
  };

  const loadingReq = stuck.key !== filterKey;
  /** รวมงานรายคนทั้งช่วง (ทุกคนใน BU) — การ์ดการสั่งงาน · null = ยังโหลด */
  const staffSum = (k: StaffActivityKind): number | null =>
    staff.key === filterKey && staff.rows ? staff.rows.reduce((n, r) => n + r[k], 0) : null;
  /** วันสั้นบนหัวการ์ด เช่น "1 พ.ย." / "1–18 พ.ย." */
  const shortDay = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TH_MONTH[Number(ymd.slice(5, 7)) - 1]}`;
  const rangeShort = win.from === win.to ? shortDay(win.from) : `${shortDay(win.from)}–${shortDay(win.to)}`;
  /** อัตราของใบชุดนั้น (ใบ ≠ อัตรา · เจ้าของ 17 พ.ย. 2569 "322 ใบ กี่อัตรา") */
  const sumOf = (rows: readonly StuckRequest[], k: 'requested' | 'filled' | 'cancelled' | 'remaining') => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const rateText = (rows: readonly StuckRequest[] | undefined, label: string, k: 'requested' | 'filled' | 'cancelled' | 'remaining') =>
    rows ? `${label} ${fmt(sumOf(rows, k))} อัตรา` : undefined;
  return (
    <div className="space-y-8" data-testid="recruit-overview-v2">
      {/* ── ต้องทำ (บนสุด · ณ ตอนนี้ ไม่ขึ้นกับช่วงวันที่) — แบบ Mobix (เจ้าของ 18 พ.ย. 2569)
          กด = แผงข้าง กราฟ BU + รายชื่อ/ใบขอ + ปุ่มทำทีละแถว ทำจากหน้านี้ได้เลย (เจ้าของ 19 พ.ย. 2569) ── */}
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
              onOpen: () => push({ kind: 'todo', title: 'สนใจแล้ว รอเจ้าหน้าที่โทร', todo: 'waiting_staff', listHref: `/jobs/board?view=list&bucket=waiting_staff${buQs}` }),
            },
            {
              key: 'uncalled',
              n: data.backlog?.uncalled.total ?? null,
              title: 'ใบสมัครที่ยังไม่มีใครโทร',
              sub: data.backlog ? `อยู่ในคิว AI ${fmt(data.backlog.uncalled.inQueue)} · ค้างเกิน 7 วัน ${fmt(data.backlog.uncalled.over7)}` : '—',
              tone: 'danger',
              icon: TODO_ICONS.UserRoundSearch,
              onOpen: () => push({ kind: 'todo', title: 'ใบสมัครที่ยังไม่มีใครโทร', todo: 'uncalled_now', listHref: `/jobs/board?view=list&bucket=uncalled_now${buQs}` }),
            },
            {
              key: 'overdue',
              n: data.backlog?.appointments?.overdue ?? null,
              title: 'นัดเลยวันแล้ว ยังไม่ลง มา/ไม่มา',
              sub: data.backlog?.appointments ? `นัดใน 7 วันข้างหน้า ${fmt(data.backlog.appointments.next7)}` : '—',
              tone: 'warn',
              icon: TODO_ICONS.CalendarX,
              onOpen: () => push({ kind: 'todo', title: 'นัดเลยวันแล้ว ยังไม่ลง มา/ไม่มา', todo: 'overdue_now', listHref: `/jobs/board?view=appointments&bucket=overdue_now${buQs}` }),
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
        {/* ใบขอ + สถานะทำงาน รวมเป็นเรื่องเดียวเลือกจากรายการ → กราฟแยก BU → ตารางใบขอข้างล่าง (เจ้าของ 19 พ.ย. 2569 แบบร่าง "เอาขึ้นระบบเลย")
            ตัวกรอง เจ้าหน้าที่สรรหา · เจ้าหน้าที่คัดสรร · ชนิดใบ คัดใบก่อน ⇒ สมการ/สถานะ/กราฟ/ตาราง ชุดเดียวกัน */}
        <RequestBuPanel
          rows={loadingReq ? null : reqRows}
          jobs={statusJobs}
          bus={bus}
          rangeText={`${rangeShort} · สถานะ ณ ${dayText(win.to)}`}
          error={stuck.error && stuck.key === filterKey ? stuck.error : reqFeed.feedState === 'failed' || reqFeed.feedState === 'forbidden' ? 'โหลดสถานะทำงานของใบขอไม่ได้' : null}
          onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))}
          onNames={(title, ids) => openNames(title, ids)}
          resetKey={viewKey}
        />
        {/* ── การประกาศรับสมัคร: กราฟ BU ชุดเดียวบนหน้า กดช่อง = กราฟกับตารางข้างล่างเปลี่ยนตาม
            กดปุ่ม/แถวในนี้ = รายการใบอย่างเดียว ไม่มีกราฟ BU ซ้ำในแผงข้าง (เจ้าของ 19 พ.ย. 2569 "พอกดแต่ละช่องก็มีกราฟอีกมันซับซ้อนปะ") ── */}
        <section className="min-w-0 space-y-4 border-t pt-4" data-testid="v2-posting">
          <SectionTitle title="การประกาศรับสมัคร" right={eq ? `เหลือหา ${fmt(openRows.reduce((n, r) => n + (r.remaining ?? 0), 0))} อัตรา · ${fmt(openRows.length)} ใบ` : undefined} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="v2-post-lanes">
            {postLanes.map((c) => (
              <Kpi
                key={c.key}
                label={`${RELEASE_LANE_TEXT[c.key].label} · อัตรา`}
                active={c.key === postView}
                value={loadingReq ? undefined : eq ? c.rows.reduce((n, r) => n + (r.remaining ?? 0), 0) : null}
                sub={eq ? `${fmt(c.rows.length)} ใบ` : undefined}
                onClick={eq ? () => setPostView(c.key) : undefined}
                testId={`v2-post-${c.key}`}
              />
            ))}
          </div>
          {posts.error && posts.key === filterKey ? <p className="text-xs text-destructive">{posts.error}</p> : null}
          {eq ? (
            <PostingProgress
              view={postView}
              open={openRows}
              onRequests={(title, rows) => push({ kind: 'requests', title, rows, page: 1, listOnly: true })}
              onNames={(title, ids, labels) => push({ kind: 'names', title, ids: [...ids], page: 1, labels })}
              resetKey={viewKey}
            />
          ) : (
            <Skeleton className="h-40 rounded-xl" />
          )}
        </section>
      </Card>

      {/* ── การสั่งงาน: Autopost / โพสต์เอง / Scrap (เจ้าของ 18 พ.ย. 2569 "ยังต้องบอกเรื่อง Autopost โพสต์เอง Scrap ด้วย")
          19 พ.ย. 2569 ไม่มีไอคอน ไม่มีบรรทัดรอง หัวข้อ "การสั่งงาน" (Choice) ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-outreach-card">
        <SectionTitle title="การสั่งงาน" right={`${dayText(win.from)} – ${dayText(win.to)}`} />
        <OutreachTiles
          tiles={[
            {
              key: 'autopost',
              // ยอดสั่งโพสต์ทั้งหมด นับรายกลุ่ม Facebook (เจ้าของ 19 พ.ย. 2569 Choice "1,819 กลุ่ม" · เดิม 96 = ใบขอ)
              n: posts.key === filterKey ? posts.total : null,
              unit: 'กลุ่ม',
              onOpen: () => push({ kind: 'embed', title: 'Autopost · รายการโพสต์', embed: 'posts' }),
            },
            {
              key: 'self',
              // ลิงก์โพสต์เองชุดเดียวกับแผงและตารางรายคน (เดิมงานรายคนนับลิงก์ทุกแบบรวม Autopost — เลขไม่ตรงแผง 2,905 vs 1,508)
              n: linkRows ? linkRows.length : null,
              unit: 'ลิงก์',
              onOpen: () => push({ kind: 'embed', title: 'โพสต์เอง / สร้างลิงก์', embed: 'self' }),
            },
            { key: 'scrap', n: staffSum('scrap'), unit: 'ใบ' },
          ]}
        />
        <OutreachPeopleTable
          people={outreachPeople}
          onPerson={(name) => push({ kind: 'embed', title: `โพสต์เอง / สร้างลิงก์ · ${name}`, embed: `self:${name}` })}
          onIds={(title, ids) => push({ kind: 'story', title, ids: [...ids], key: `${viewKey}:person:${title}`, box: 'person' })}
        />
        {/* ปุ่มใต้การประกาศย้ายมาที่นี่ (เจ้าของ 19 พ.ย. 2569 "ย้ายไปไว้ในการสั่งงาน อันไหนไม่ซ้ำทำเพิ่ม") — Autopost/โพสต์เอง ซ้ำกับการ์ดข้างบน ถอดแล้ว */}
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={!eq} onClick={() => push({ kind: 'embed', title: 'สถานะและหลักฐานรายใบ', embed: 'states' })}>
            สถานะและหลักฐานรายใบ
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => push({ kind: 'embed', title: 'เปิดฟอร์ม / ส่งใบสมัคร', embed: 'clicks' })}>
            เปิดฟอร์ม / ส่งใบสมัคร
          </Button>
        </div>
      </Card>

      {/* ── รายชื่อเข้ามาไปถึงไหน (เจ้าของ 18 พ.ย. 2569 จากการ์ด Milo "รายชื่อเข้ามาหายไปไหน") — ทุกกล่องบอกขั้นที่หลุด · แยกช่องทางกดไล่ลงถึงคนหามา
          19 พ.ย. 2569 รวมส่วน "ผู้สมัครและผลการติดต่อ" เข้ามา (คนชุดเดียวกัน เลขซ้ำ) — Choice ถอดการ์ด 7 ใบ ใช้หัวกล่องแทน · เอามาแค่เรื่องเล่ารายชื่อ
          กดหัวกล่อง = แผงข้าง (เรื่องเล่ารายชื่อย้ายเข้าแผง · เจ้าของ "ต้องย้ายเข้ามาใน Pop up")
          (รอโทรเกิน 24 ชม. · รายชื่ออยู่กับใคร · เหตุผลที่ยังไม่ได้คน · ปุ่มที่มาของยอดนัด/ผลโทรต่อ/เบอร์ไม่ซ้ำ/ยังไม่ผูกใบขอ ถอดแล้ว) ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-intake-card">
        <SectionTitle title="รายชื่อเข้ามาไปถึงไหน" right={`${buText} · คนที่สมัคร ${periodText}`} />
        <IntakeFlowPanel
          cohort={model.cohort}
          onNames={openNames}
          resetKey={viewKey}
          prevCohort={win.all ? undefined : (prevModel?.cohort ?? null)}
          erpIds={model.stages.erp.ids}
          prevErpIds={prevModel?.stages.erp.ids ?? null}
          onOpenBox={(box) => push({ kind: 'story', title: box.title, ids: [...box.ids], key: `${viewKey}:${box.key}:${box.title}`, box: box.key })}
        />
      </Card>


      <Separator />

      {/* ── งานรายคน (เจ้าของ 18 พ.ย. 2569 "วันนี้ เมื่อวาน วันก่อน ใหม่ทำอะไรไป" · Choice ภาพรวม + Filter รายคน) ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-staff-card">
        <SectionTitle title="งานรายคน" right={`${dayText(win.from)} – ${dayText(win.to)}`} />
        <StaffActivityPanel from={win.from} to={win.to} bu={data.bu} rows={staff.key === filterKey ? staff.rows : null} error={staff.key === filterKey ? staff.error : null} onNames={openNames} />
      </Card>

      {/* พื้นที่ที่ขาดคน — ก่อนความเคลื่อนไหว (19 พ.ย. 2569) · พับไว้ กดค่อยกาง (เจ้าของ 18 พ.ย. 2569 "ซ่อนไว้กดค่อยกาง") · ปุ่มรายงานเพิ่มเติม (แบบเดิม) ถอดแล้ว ("เอาออก") */}
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

      {/* ── ความเคลื่อนไหวล่าสุด — พับไว้ กดค่อยกาง อยู่ใต้พื้นที่ที่ขาดคน (เจ้าของ 19 พ.ย. 2569 "ย่อไว้แล้วเอา พื้นที่ขาดคนขึ้นมาก่อนสลับตำแหน่งกัน") ── */}
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="v2-feed-card">
        <SectionTitle
          title="ความเคลื่อนไหวล่าสุด"
          right={
            <Button type="button" size="sm" variant="outline" aria-expanded={feedOpen} onClick={() => setFeedOpen((v) => !v)} data-testid="v2-feed-toggle">
              {feedOpen ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
              {feedOpen ? 'พับ' : 'ดู 30 รายการล่าสุด'}
            </Button>
          }
        />
        {feedOpen ? <ActivityFeed items={feed.key === filterKey ? feed.items : null} today={data.today} onPerson={(id, name) => openNames(name, [id])} /> : null}
      </Card>

      <V2Drawer
        stack={stack}
        onStack={setStack}
        model={model}
        bus={bus}
        periodText={periodText}
        buText={buText}
        embeds={embeds}
        bu={data.bu}
        months={months}
        range={{ from: win.from, to: win.to }}
        // ปุ่ม "ประกาศ" ในรายการใบขอ (เจ้าของ 19 พ.ย. 2569 "กดทำจากหน้านี้เลย") — ปิดแผงก่อน แล้วเปิดป๊อปประกาศของใบนั้นบนหน้านี้ (`?posting=` ของกล่องงาน)
        onPublish={(jobId) => {
          setStack([]);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.set('posting', jobId);
              return next;
            },
            { replace: true },
          );
        }}
      />
    </div>
  );
}
