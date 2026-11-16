import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { RECRUIT_TOPIC_WORDS as W } from '@/lib/uiWords';
import { DASH } from '@/lib/designTokens';
import { formatTrendNumber as fmt } from '@/lib/trends/format';
import type { RecruitAppFact, RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';
import { STUCK_PHASES, monthlySeries, type StuckDailyRow, type StuckMonthlyRow } from '@/lib/recruitStuck';
import { fetchRecruitStuck } from '@/lib/recruitStuckApi';
import { fetchRecruitPostComparison, fetchSoPostGroups, type RecruitPostComparison } from '@/lib/soPostGroupsApi';
import { fetchManualLinks } from '@/lib/jobPostActionsApi';
import { MANUAL_POSTED_SINCE, SO_POST_SINCE } from '@/lib/recruitScale';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { reasonGroups } from '@/lib/recruitOverview';
import { buildBringerFunnelTree, buildChannelFunnelTree } from '@/lib/channelFunnel';
import { informedOf } from '@/lib/recruitPersonJourney';
import {
  TOPIC_KEYS,
  TOPIC_TITLES,
  bkkDayOf,
  buBarsOf,
  channelParts,
  daysOf,
  groupByDay,
  isTopicKey,
  peopleParts,
  peopleSteps,
  requestPhaseParts,
  requestStateParts,
  selfParts,
  staffParts,
  startMethods,
  startParts,
  whyParts,
  type BuBar,
  type TopicKey,
  type TopicPart,
} from '@/lib/recruitTopics';
import { OverviewCard, ReasonColumns, SectionError } from '../RecruitOverviewParts';
import ChannelFunnelTable from '../ChannelFunnelTable';
import StuckTodoTable from '../stuck/StuckTodoTable';
import StuckAreaTable from '../stuck/StuckAreaTable';
import CallerResultsTable from '../stuck/CallerResultsTable';
import SoPostGroupsCard from '../stuck/SoPostGroupsCard';
import SelfLinksPanel from './SelfLinksPanel';
import TrendDelta from '../stuck/TrendDelta';
import TopicBuBars from './TopicBuBars';
import TopicEquation from './TopicEquation';
import TopicTimeCard, { type TimeDay, type TimeMonth } from './TopicTimeCard';

const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const monthLabel = (m: string) => `${MONTH_TH[Number(m.slice(5, 7)) - 1]} ${String(Number(m.slice(0, 4)) + 543).slice(2)}`;
/** 6 เดือนล่าสุดถึงเดือนที่ดูอยู่ */
function lastMonths(end: string, n = 6): string[] {
  const y = Number(end.slice(0, 4));
  const m = Number(end.slice(5, 7));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return d.toISOString().slice(0, 7);
  });
}
const monthRange = (m: string) => {
  const y = Number(m.slice(0, 4));
  const mm = Number(m.slice(5, 7));
  const last = new Date(Date.UTC(y, mm, 0)).getUTCDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, '0')}` };
};
const BU_ORDER = ['LBD', 'LBA', 'LM', 'DS', 'SN'];

const fbParts = (c: Record<string, number>): TopicPart[] => [
  { key: 'posted', label: W.posted, tone: 'success', value: c.posted ?? 0 },
  { key: 'pending', label: W.pending, tone: 'warn', value: (c.pending_approval ?? 0) + (c.waiting ?? 0) },
  { key: 'failed', label: W.failed, tone: 'danger', value: (c.failed ?? 0) + (c.declined ?? 0) },
  { key: 'notTried', label: W.notPosted, tone: 'neutral', value: (c.not_tried_machine ?? 0) + (c.not_tried_account ?? 0) + (c.not_tried_unknown ?? 0) },
  { key: 'removed', label: W.removed, tone: 'orange', value: c.removed ?? 0 },
];

const sumParts = (ps: readonly TopicPart[]) => ps.reduce((s, p) => s + p.value, 0);

/**
 * ═══ ภาพรวมงานสรรหา 8 เรื่อง เทียบ BU (เจ้าของ 16 พ.ย. 2569 เคาะจากตัวอย่าง artifact แล้ว "ทำมาก่อน") ═══
 * ปุ่มเรื่อง → กราฟเวลา (เดือน → ทั้งหน้า · วัน → ป๊อป) → ซ้าย เทียบ BU / ขวา รายละเอียด BU ที่กด (สมการบวกลงตัว + ตารางเดิมของเรื่องนั้น)
 * ตัวตัดสินทุกเลขอยู่ `lib/recruitTopics` (เรียกตัวกลางเดิม) · เรื่องที่เลือก `?topic=` · BU ที่กด `?tbu=`
 */
export default function RecruitTopicsView({
  data,
  win,
  cohort,
  prevCohort,
  openRows,
  requestRows,
  requestsReady,
  jobOk,
  onOpenNames,
  onPickMonth,
}: {
  data: RecruitOverviewResponse;
  win: RecruitOverviewResponse['window'];
  /** รายชื่อของช่วงที่ดู ผ่านตัวกรองบนสุดแล้ว (ทุก BU) */
  cohort: readonly RecruitAppFact[] | null;
  prevCohort: readonly RecruitAppFact[] | null;
  /** ใบขอที่ยังเปิด ผ่านตัวกรองบนสุดแล้ว */
  openRows: readonly StuckRequest[];
  /** ใบขอทุกสถานะของช่วง (ผ่านตัวกรองบนสุด) — ใบขอเข้ามารายวัน */
  requestRows: readonly StuckRequest[];
  requestsReady: boolean;
  jobOk: (jobId: string | null) => boolean;
  onOpenNames: (title: string, ids: readonly string[]) => void;
  onPickMonth: (month: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const topicParam = searchParams.get('topic');
  const topic: TopicKey = isTopicKey(topicParam) ? topicParam : 'req';
  // เรียง BU ตามตัวอย่างที่เจ้าของเคาะ (LBD ก่อน) ไม่ใช่ลำดับในสิทธิ์ (SN ขึ้นก่อน)
  const bus = React.useMemo(() => {
    if (data.bu) return [data.bu];
    const allowed = data.buChoices ?? BU_ORDER;
    return [...BU_ORDER.filter((b) => allowed.includes(b)), ...allowed.filter((b) => !BU_ORDER.includes(b))];
  }, [data.bu, data.buChoices]);
  const tbuParam = searchParams.get('tbu');
  const selBu = tbuParam && bus.includes(tbuParam) ? tbuParam : bus.includes('LBD') ? 'LBD' : bus[0] ?? '';
  const setParam = (k: string, v: string) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p);
        next.set(k, v);
        return next;
      },
      { replace: true },
    );

  const apps = cohort ?? [];
  const appsOf = (bu: string, list: readonly RecruitAppFact[] = apps) => list.filter((f) => f.bu === bu);
  const cohortBu = React.useMemo(() => appsOf(selBu), [apps, selBu]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevBu = React.useMemo(() => (prevCohort ? appsOf(selBu, prevCohort) : null), [prevCohort, selBu]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsBu = React.useMemo(() => openRows.filter((r) => r.bu === selBu), [openRows, selBu]);

  // ช่วง + สิทธิ์เป็น key: เปลี่ยน calendar/BU แล้วไม่ใช้คำตอบเก่า แม้กลับมาไม่ตามลำดับ
  const postKey = JSON.stringify([win.from, win.to, data.bu, bus]);
  const [postState, setPostState] = React.useState<{ key: string; data: RecruitPostComparison } | null>(null);
  const posts = postState?.key === postKey ? postState.data : null;
  const postTopic = topic === 'fb' || topic === 'self';
  React.useEffect(() => {
    if (!postTopic || posts) return;
    let alive = true;
    fetchRecruitPostComparison({ from: win.from, to: win.to, bu: data.bu ?? null })
      .then((data) => alive && setPostState({ key: postKey, data }))
      .catch(() => alive && setPostState({ key: postKey, data: Object.fromEntries(bus.map((bu) => [bu, { fb: null, links: null }])) }));
    return () => { alive = false; };
  }, [postTopic, postKey, posts, bus, win.from, win.to, data.bu]);

  // ── ซ้าย: เทียบ BU ──
  const bars: BuBar[] | null = React.useMemo(() => {
    switch (topic) {
      case 'req':
        return requestsReady ? buBarsOf(bus, openRows, (r) => r.bu, requestPhaseParts) : null;
      case 'start':
        return requestsReady ? buBarsOf(bus, openRows, (r) => r.bu, startParts) : null;
      case 'people':
        return cohort ? buBarsOf(bus, apps, (f) => f.bu, peopleParts) : null;
      case 'staff':
        return cohort ? buBarsOf(bus, apps, (f) => f.bu, staffParts) : null;
      case 'channel':
        return cohort ? buBarsOf(bus, apps, (f) => f.bu, channelParts) : null;
      case 'why':
        return cohort ? buBarsOf(bus, apps, (f) => f.bu, whyParts) : null;
      case 'fb':
        return posts ? bus.map((bu) => ({ bu, parts: fbParts(posts[bu]?.fb?.counts ?? {}), total: posts[bu]?.fb?.total ?? 0, unavailable: !posts[bu]?.fb })) : null;
      case 'self':
        return posts ? bus.map((bu) => ({ bu, parts: selfParts(posts[bu]?.links ?? []), total: posts[bu]?.links?.length ?? 0, unavailable: !posts[bu]?.links })) : null;
    }
  }, [topic, requestsReady, bus, openRows, cohort, apps, posts]);
  const prevBars = React.useMemo(() => {
    if (!prevCohort) return null;
    const of = { people: peopleParts, staff: staffParts, channel: channelParts, why: whyParts }[topic as 'people'];
    return of ? new Map(buBarsOf(bus, prevCohort, (f) => f.bu, of).map((b) => [b.bu, b.total] as const)) : null;
  }, [topic, prevCohort, bus]);
  const unit = topic === 'req' || topic === 'start' ? 'ใบ' : topic === 'fb' ? 'โพสต์' : topic === 'self' ? 'ลิงก์' : 'คน';
  const leftTotal = bars && !bars.some((b) => b.unavailable) ? sumParts(bars.flatMap((b) => b.parts)) : null;
  const leftTitle = {
    req: 'ใบขอเหลือหา',
    start: 'ใบขอเหลือหา · เริ่มหาแล้ว / ยังไม่เริ่ม',
    fb: 'สั่งโพสต์ลงกลุ่ม Facebook',
    self: 'โพสต์เอง',
    people: 'รายชื่อที่กรอกมา',
    staff: 'คนเก็บไปโทรต่อ',
    channel: 'รายชื่อที่กรอกมา แยกช่องทาง',
    why: 'รายชื่อที่ไม่สำเร็จ',
  }[topic];

  // ── บน: เวลา ──
  const curMonth = win.month ?? win.from.slice(0, 7);
  const [monthly, setMonthly] = React.useState<StuckMonthlyRow[] | null>(null);
  React.useEffect(() => {
    let alive = true;
    setMonthly(null);
    fetchRecruitStuck(selBu, { from: win.from, to: win.to }, 'monthly')
      .then((d) => alive && setMonthly(d.monthly ?? []))
      .catch(() => alive && setMonthly([]));
    return () => {
      alive = false;
    };
  }, [selBu, win.from, win.to]);
  /** ยอดใบขอเหลือหา ณ สิ้นวันที่จดไว้ (6 เดือนถึงวันนี้) — เรื่องใบขอเหลือหา / เริ่มหา */
  const [daily, setDaily] = React.useState<StuckDailyRow[] | null>(null);
  React.useEffect(() => {
    if (topic !== 'req' && topic !== 'start') return;
    let alive = true;
    setDaily(null);
    const from = `${lastMonths(curMonth)[0]}-01`;
    fetchRecruitStuck(selBu, { from, to: data.today }, 'daily')
      .then((d) => alive && setDaily(d.daily ?? []))
      .catch(() => alive && setDaily([]));
    return () => {
      alive = false;
    };
  }, [topic, selBu, curMonth, data.today]);
  const [postMonths, setPostMonths] = React.useState<TimeMonth[] | null>(null);
  React.useEffect(() => {
    if (topic !== 'fb' && topic !== 'self') return;
    let alive = true;
    setPostMonths(null);
    const months = lastMonths(curMonth).filter((m) => m >= (topic === 'fb' ? SO_POST_SINCE : '2026-11-13').slice(0, 7));
    Promise.all(
      months.map(async (m) => {
        const r = monthRange(m);
        if (topic === 'fb') {
          const so = await fetchSoPostGroups({ from: r.from, to: r.to, bu: selBu, page: 1 }).catch(() => null);
          return { month: m, label: monthLabel(m), value: so ? so.total : null };
        }
        const from = r.from < MANUAL_POSTED_SINCE ? MANUAL_POSTED_SINCE : r.from;
        const links = await fetchManualLinks({ from, to: r.to, bu: selBu }).catch(() => null);
        return { month: m, label: monthLabel(m), value: links ? links.length : null };
      }),
    ).then((list) => alive && setPostMonths(list));
    return () => {
      alive = false;
    };
  }, [topic, selBu, curMonth, win.from, win.to]);

  const firstMonth = (data.firstDay ?? '').slice(0, 7);
  /** วันที่จดไว้ → ยอดรวม/ก้อน ของเรื่องใบขอ (เหลือหา = ขั้นที่ติด · เริ่มหา = เริ่มแล้ว/ยังไม่เริ่ม) */
  const dailyByDay = React.useMemo(() => {
    if (!daily || daily.length === 0) return null;
    const m = new Map<string, StuckDailyRow[]>();
    for (const r of daily) m.set(r.day, [...(m.get(r.day) ?? []), r]);
    return m;
  }, [daily]);
  const dailyParts = React.useCallback(
    (rows: readonly StuckDailyRow[]): TopicPart[] =>
      topic === 'start'
        ? [
            { key: 'started', label: 'เริ่มหาแล้ว', tone: 'success', value: rows.filter((r) => r.started).reduce((s, r) => s + r.requests, 0) },
            { key: 'notStarted', label: 'ยังไม่เริ่ม', tone: 'neutral', value: rows.filter((r) => !r.started).reduce((s, r) => s + r.requests, 0) },
          ]
        : STUCK_PHASES.map((p) => ({ key: p.key, label: p.label, tone: p.tone, value: rows.filter((r) => r.phase === p.key).reduce((s, r) => s + r.requests, 0) })),
    [topic],
  );
  const timeMonths: TimeMonth[] | null = React.useMemo(() => {
    if (topic === 'fb' || topic === 'self') return postMonths;
    if ((topic === 'req' || topic === 'start') && dailyByDay) {
      // ยอด ณ สิ้นเดือน = วันสุดท้ายที่จดไว้ของเดือนนั้น · เดือนที่ยังไม่ได้จด = ขีด
      const days = [...dailyByDay.keys()].sort();
      return lastMonths(curMonth).map((m) => {
        const last = days.filter((d) => d.startsWith(m)).pop();
        return { month: m, label: monthLabel(m), value: last ? sumParts(dailyParts(dailyByDay.get(last) ?? [])) : null };
      });
    }
    if (!monthly) return null;
    const key = topic === 'req' || topic === 'start' ? 'requests' : 'apps';
    const series = new Map(monthlySeries(monthly, key, jobOk).map((s) => [s.month, s.value] as const));
    return lastMonths(curMonth).map((m) => ({
      month: m,
      label: monthLabel(m),
      // ก่อนระบบเริ่มเก็บรายชื่อ = ขีด (ไม่ใช่ 0)
      value: key === 'apps' && firstMonth && m < firstMonth ? null : (series.get(m) ?? 0),
    }));
  }, [topic, postMonths, monthly, jobOk, curMonth, firstMonth]);

  const dayParts = React.useMemo(() => ({ people: peopleParts, staff: staffParts, channel: channelParts, why: whyParts }) as const, []);
  const timeDays: TimeDay[] | null = React.useMemo(() => {
    if (topic === 'self') {
      // รายวัน = ลิงก์ที่สร้างวันนั้น (ชุดเดียวกับแท่ง BU · ก่อน 13 พ.ย. ไม่มีลิงก์ในชุด = 0)
      const links = posts?.[selBu]?.links;
      if (!links) return null;
      return [...groupByDay(links, (r) => r.day, win.from, win.to)].map(([day, list]) => ({ day, parts: selfParts(list) }));
    }
    if (topic === 'fb') return null;
    if ((topic === 'req' || topic === 'start') && dailyByDay) {
      // ยอด ณ สิ้นวันที่จดไว้ · วันที่ยังไม่ได้จด = ขีด (ไม่ใช่ 0)
      return daysOf(win.from, win.to).map((day) => {
        const rows = dailyByDay.get(day);
        return rows ? { day, parts: dailyParts(rows) } : { day, parts: [], missing: true };
      });
    }
    if (topic === 'req' || topic === 'start') {
      // ใบขอเข้ามาแต่ละวัน (ใบที่ส่งเข้ามาในช่วง ทุกสถานะ) — แยก ยังเปิด / ได้คนแล้ว / ยกเลิก
      const rows = requestRows.filter((r) => r.bu === selBu && r.inRange !== false);
      return [...groupByDay(rows, (r) => r.day ?? null, win.from, win.to)].map(([day, list]) => ({ day, parts: requestStateParts(list) }));
    }
    if (!cohort) return null;
    const of = dayParts[topic];
    return [...groupByDay(cohortBu, (f) => (f.createdAt ? bkkDayOf(f.createdAt) : null), win.from, win.to)].map(([day, list]) => ({ day, parts: of(list) }));
  }, [topic, posts, cohort, cohortBu, dayParts, win.from, win.to, requestRows, selBu, dailyByDay, dailyParts]);
  const prevDays = React.useMemo(() => {
    if (!prevBu || !(topic in dayParts)) return null;
    // วันเดียวกันของช่วงก่อน — เลื่อนตามระยะเริ่มช่วง
    const shift = Date.parse(`${win.from}T00:00:00Z`) - Date.parse(`${win.prevFrom}T00:00:00Z`);
    const m = new Map<string, number>();
    for (const f of prevBu) {
      if (!f.createdAt) continue;
      const d = new Date(Date.parse(`${bkkDayOf(f.createdAt)}T00:00:00Z`) + shift).toISOString().slice(0, 10);
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [prevBu, topic, dayParts, win.from, win.prevFrom]);

  const timeNote: string | null = {
    req: dailyByDay ? W.dailyStock : W.requestInflow,
    start: dailyByDay ? W.dailyStock : W.requestInflow,
    fb: W.fbSince,
    self: W.selfSince,
    people: null,
    staff: W.staffTime,
    channel: null,
    why: W.whyTime,
  }[topic];

  // ── ขวา: รายละเอียด BU ที่กด ──
  const [reqView, setReqView] = React.useState<'todo' | 'area'>('todo');
  const appsError = cohort ? null : <SectionError message={data.errors.apps ?? 'อ่านรายชื่อผู้สมัครไม่ได้ชั่วคราว'} />;
  const steps = React.useMemo(() => peopleSteps(cohortBu), [cohortBu]);
  const channels = React.useMemo(() => buildChannelFunnelTree(cohortBu), [cohortBu]);
  const bringers = React.useMemo(() => buildBringerFunnelTree(cohortBu), [cohortBu]);
  const prevChannels = React.useMemo(() => (prevBu ? buildChannelFunnelTree(prevBu) : null), [prevBu]);
  const prevBringers = React.useMemo(() => (prevBu ? buildBringerFunnelTree(prevBu) : null), [prevBu]);
  const reasons = React.useMemo(() => reasonGroups(cohortBu), [cohortBu]);
  const prevReasons = React.useMemo(() => (prevBu ? reasonGroups(prevBu) : null), [prevBu]);
  const informed = React.useMemo(() => informedOf(cohortBu), [cohortBu]);
  const noop = React.useCallback(() => undefined, []);

  const detail = (() => {
    switch (topic) {
      case 'req':
        return requestsReady ? (
          <div className="space-y-3">
            <TopicEquation label="ใบขอเหลือหา" unit="ใบ" total={rowsBu.length} parts={requestPhaseParts(rowsBu)} />
            <p className={cn('text-xs', DASH.sub)}>เหลือหา {fmt(rowsBu.reduce((s, r) => s + (r.remaining ?? 0), 0))} อัตรา</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={reqView === 'todo' ? 'default' : 'outline'} onClick={() => setReqView('todo')}>
                ใครต้องทำอะไร
              </Button>
              <Button type="button" size="sm" variant={reqView === 'area' ? 'default' : 'outline'} onClick={() => setReqView('area')}>
                พื้นที่ที่เหลือหา
              </Button>
            </div>
            {reqView === 'todo' ? <StuckTodoTable rows={rowsBu} onPick={noop} /> : <StuckAreaTable rows={rowsBu} onPick={noop} />}
          </div>
        ) : (
          <Skeleton className="h-64 rounded-2xl" />
        );
      case 'start': {
        const m = startMethods(rowsBu.filter((r) => r.signals));
        return requestsReady ? (
          <div className="space-y-3">
            <TopicEquation label="ใบขอเหลือหา" unit="ใบ" total={rowsBu.length} parts={startParts(rowsBu)} />
            <div className="grid gap-2 sm:grid-cols-3">
              {[
                ['ประกาศหน้าประกาศ', m.released],
                ['มีลิงก์ / Autopost', m.links],
                ['สั่งโพสต์กลุ่ม', m.post],
              ].map(([l, v]) => (
                <div key={l as string} className="rounded-xl border border-border p-3">
                  <p className="text-lg font-medium tabular-nums">{fmt(v as number)}</p>
                  <p className={cn('text-xs', DASH.sub)}>{l} (ใบ)</p>
                </div>
              ))}
            </div>
            <p className={cn('text-xs', DASH.sub)}>{W.overlappingMethods}</p>
          </div>
        ) : (
          <Skeleton className="h-64 rounded-2xl" />
        );
      }
      case 'fb':
        return posts ? <SoPostGroupsCard key={`${postKey}:${selBu}`} title={TOPIC_TITLES.fb} from={win.from} to={win.to} bu={selBu} initialData={posts[selBu]?.fb ?? undefined} /> : <Skeleton className="h-64 rounded-2xl" />;
      case 'self':
        return posts?.[selBu]?.links === null ? <SectionError message={W.loadFailed} /> : posts ? (
          <SelfLinksPanel rows={posts[selBu]?.links ?? []} onOpenRequest={(jobId) => navigate(requestPathOfJobId(jobId))} />
        ) : (
          <Skeleton className="h-64 rounded-2xl" />
        );
      case 'people':
        return (
          appsError ?? (
            <div className="space-y-3">
              {steps.map((s) => (
                <TopicEquation key={s.key} label={s.label} total={s.total} parts={s.parts} onOpenNames={onOpenNames} />
              ))}
              <div className="rounded-xl border border-border p-3">
                <p className="text-lg font-medium tabular-nums">{informed === null ? '—' : fmt(informed.length)}</p>
                <p className={cn('text-xs', DASH.sub)}>ได้ลงงาน (ใบแจ้งเข้า ERP){informed === null ? ' · อ่าน ERP ไม่ได้' : ''}</p>
              </div>
            </div>
          )
        );
      case 'staff':
        return appsError ?? <CallerResultsTable cohort={cohortBu} onOpen={onOpenNames} prev={prevBu} />;
      case 'channel':
        return (
          appsError ?? (
            <div className="space-y-4">
              <ChannelFunnelTable groups={channels.groups} total={channels.total} onOpen={onOpenNames} prev={prevChannels} />
              <ChannelFunnelTable groups={bringers.groups} total={bringers.total} onOpen={onOpenNames} firstLabel="คนหา" prev={prevBringers} />
            </div>
          )
        );
      case 'why':
        return appsError ?? <ReasonColumns groups={reasons} onOpen={onOpenNames} prev={prevReasons} />;
    }
  })();

  return (
    <div className="min-w-0 space-y-4" data-testid="recruit-topics">
      <div className="flex flex-wrap gap-2" role="group" aria-label="เรื่อง">
        {TOPIC_KEYS.map((k, i) => (
          <Button key={k} type="button" size="sm" variant={k === topic ? 'default' : 'outline'} aria-pressed={k === topic} onClick={() => setParam('topic', k)} data-testid={`topic-${k}`}>
            {i + 1} · {TOPIC_TITLES[k]}
          </Button>
        ))}
      </div>

      <Card variant="solid" className="min-w-0 p-4">
        <TopicTimeCard
          title={`${selBu} · ${TOPIC_TITLES[topic]}`}
          unit={unit}
          months={timeMonths}
          currentMonth={curMonth}
          onPickMonth={onPickMonth}
          days={timeDays}
          prevDays={prevDays}
          note={timeNote}
          onOpenNames={onOpenNames}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Card variant="solid" className="min-w-0 self-start p-4">
          <TopicBuBars
            title={`${leftTitle} ${leftTotal == null ? '' : fmt(leftTotal)} ${unit}`}
            sub={topic === 'req' || topic === 'start' ? W.todayStock : undefined}
            bars={bars}
            loading={!bars}
            selected={selBu}
            onSelect={(bu) => setParam('tbu', bu)}
            meta={(b) => (
              <>
                {b.unavailable ? <span>{W.loadFailed}</span> : <><span>
                  รวม <b className="font-medium text-foreground">{fmt(b.total)}</b> {unit}
                </span>
                {prevBars ? <TrendDelta cur={b.total} prev={prevBars.get(b.bu) ?? 0} /> : null}
                {b.parts.map((p) => (
                  <span key={p.key}>
                    {p.label} {fmt(p.value)}
                  </span>
                ))}</>}
              </>
            )}
          />
        </Card>
        <OverviewCard icon={ListChecks} title={`${selBu} · ${TOPIC_TITLES[topic]}`}>
          {detail}
        </OverviewCard>
      </div>
    </div>
  );
}
