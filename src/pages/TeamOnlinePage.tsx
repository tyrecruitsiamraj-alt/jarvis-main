/**
 * ═══ หน้าทีม Online (29 ก.ย. 2569) — ตามภาพต้นแบบของเจ้าของ · แผน `docs/plan-team-online-2569-09-29.md` ═══
 *
 * รอบ 1: *"หน้าหลัก ฉันจะเริ่มแก้ใหม่ … อันนี้ฉันจะเริ่มจากทีม Online"* → ทำตามภาพด้วยข้อมูลจริง หลังสวิตช์
 * รอบ 2 (เจ้าของเปิดดูแล้วสั่งต่อ): ช่วงเวลาเป็นปฏิทิน · เทียบ BU เป็นแท่งตามช่วงย่อย + เส้นแนวโน้ม ·
 * ติดตรงไหนต่อ BU · งานที่ต้องทำต่อของคนเปิด — *"user ต้องรู้ว่าต้องทำอะไรต่อ ผู้บริหารรู้เลยว่าอ้อทีมนี้ยังไม่ใช้
 * อ้อใช้แล้วติดตรงนี้ อ้อคนใช้ลดลง"*
 *
 * - ช่วงเวลา = แถบเดียวกับแท็บ Dashboard (`useTrendWindow` + `TrendToolbar` · เก็บในหน้า ไม่ผูก URL แบบเดียวกัน)
 * - ตัวกรอง BU ชุดเดียวของทั้งหน้า (`?bu=`) — ยกเว้นการ์ดคนใช้งาน (ทุก BU) กับกราฟ/แผงเทียบ BU (แสดงทุก BU เสมอ)
 * - ตัวเลขทั้งหมดมาจาก `/api/team-online` · งานที่ต้องทำต่อ = ถังเดียวกับหน้าหลัก (`buildNextTasks`) + งานของทีม Online
 * - 🔴 **ชั้นคู่ขนาน**: เปิดด้วย `?home=online` · กลับหน้าเดิม `?home=classic` · หน้าเดิมยังเป็นค่าตั้งต้น (ทางถอย)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Link2, PhoneCall, RefreshCw, Target, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendToolbar } from '@/components/dashboard-trends/TrendParts';
import HomeStuckList from '@/components/home-v3/HomeStuckList';
import TeamKpiCard from '@/components/team-online/TeamKpiCard';
import TeamBuPanel, { type TeamBuPanelRow } from '@/components/team-online/TeamBuPanel';
import TeamOnlineTabs from '@/components/team-online/TeamOnlineTabs';
import UsageVsRequestsChart from '@/components/team-online/UsageVsRequestsChart';
import { useHomeCallDialogs } from '@/components/home/useHomeCallDialogs';
import { useAuth } from '@/contexts/AuthContext';
import { useTrendWindow } from '@/hooks/useTrendWindow';
import { callBoxCount, fetchFlowSummary, type FlowSummary } from '@/lib/flowSummaryApi';
import { fetchOfficeFloor, type OfficeFloorResponse } from '@/lib/officeFloorApi';
import { buildNextTasks, type NextTask } from '@/lib/nextTask';
import { fetchTeamOnline } from '@/lib/teamOnlineApi';
import {
  countPill,
  fmtPct,
  pooledUsage,
  ratePill,
  ratio,
  successRate,
  teamWatchItems,
  teamWindowText,
  type DeltaPill,
  type TeamCount,
  type TeamCoverage,
  type TeamOnlineResponse,
} from '@/lib/teamOnline';
import { normalizeTrendBu, trendBuLabel } from '@/lib/trends/bu';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const ALL = '__all__';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);
const ymdText = (ymd: string) => DATE.format(new Date(`${ymd}T12:00:00+07:00`));

/** อายุของสำเนา ERP — ภาษาเดียวกับก้อนผลงานหน้าหลักโฉม 3 ก้อน */
function ageText(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${NUM.format(m)} นาทีก่อน`;
  return `${NUM.format(Math.round(m / 60))} ชั่วโมงก่อน`;
}

type CardBits = {
  value: string;
  sub: string;
  pill: DeltaPill | null;
  foot: string | null;
  flags: string[];
};

const NO_PREV = 'ช่วงก่อนยังไม่มีข้อมูล';

/** ธงความครอบคลุม — ข้อมูลเริ่มกลางช่วง ต้องบอก (ห้ามให้อ่านเป็น "เพิ่มขึ้น") */
function coverageFlags(cov: TeamCoverage): string[] {
  if (!cov.since) return [];
  if (cov.cur === 'partial') return [`ข้อมูลเริ่ม ${ymdText(cov.since)}`];
  if (cov.prev === 'partial') return [`ช่วงก่อนมีข้อมูลตั้งแต่ ${ymdText(cov.since)}`];
  return [];
}

/**
 * ช่วงก่อน/ช่วงนี้มีข้อมูลไม่ครบ (ระบบเพิ่งเริ่มเก็บกลางช่วง) = บอกตัวเลขได้ แต่ห้ามลงสีดี/เสีย
 * (วัดจริง 29 ก.ย.: การ์ด Lumos ขึ้น "เพิ่ม 1,400%" สีเขียว ทั้งที่ช่วงก่อนเก็บได้แค่ครึ่งเดียว)
 */
const partial = (cov: TeamCoverage) => cov.prev === 'partial' || cov.cur === 'partial';

function countBits(
  c: TeamCount | null | undefined,
  cov: TeamCoverage | undefined,
  unit: string,
  compareText: string,
  upIsGood: boolean | null,
  foot?: string,
): CardBits {
  if (!c || !cov) return { value: '—', sub: compareText, pill: null, foot: null, flags: [] };
  const noPrev = cov.prev === 'none';
  return {
    value: n(c.cur),
    sub: noPrev ? NO_PREV : compareText,
    pill: noPrev ? null : countPill(c.cur, c.prev, upIsGood, partial(cov)),
    foot: [foot, noPrev ? null : `ช่วงก่อน ${n(c.prev)} ${unit}`].filter(Boolean).join(' · ') || null,
    flags: coverageFlags(cov),
  };
}

function rateBits(cur: number | null, prev: number | null, cov: TeamCoverage | undefined, compareText: string, foot: string): CardBits {
  if (!cov) return { value: '—', sub: compareText, pill: null, foot: null, flags: [] };
  const noPrev = cov.prev === 'none';
  return {
    value: fmtPct(cur),
    sub: noPrev ? NO_PREV : compareText,
    // ช่วงนี้ยังไม่มีฐาน = ไม่มีอะไรให้เทียบ — ท้ายการ์ดบอก "0 / 0" อยู่แล้ว
    pill: noPrev || cur === null ? null : ratePill(cur, prev, true, partial(cov)),
    foot: [foot, noPrev || prev === null ? null : `ช่วงก่อน ${fmtPct(prev)}`].filter(Boolean).join(' · '),
    flags: coverageFlags(cov),
  };
}

/** งานของทีม Online ที่ต้องทำต่อ — ต่อท้ายถังเดียวกับหน้าหลัก (`buildNextTasks`) แล้วเรียงตามความเร่ง */
function onlineTasks(data: TeamOnlineResponse | null): NextTask[] {
  const rows = (data?.byBu ?? []).filter((r) => !data?.bu || r.bu === data.bu);
  const noLink = rows.reduce((s, r) => s + r.openWithoutLink, 0);
  const stale = rows.reduce((s, r) => s + r.staleNoApplicants, 0);
  const out: NextTask[] = [];
  if (stale > 0) {
    out.push({
      key: 'online-stale-link',
      title: `Gen link เกิน 7 วันยังไม่มีผู้สมัคร ${NUM.format(stale)} ใบ`,
      reason: 'ลิงก์สมัครเปิดมาเกินสัปดาห์แล้วยังไม่มีใครกรอก — ควรดันประกาศหรือเปลี่ยนช่องทาง',
      badge: 'ประกาศเงียบ',
      count: stale,
      tone: 'warn',
      path: '/jobs/board',
      action: 'เปิดกล่องงาน',
      stepKey: 'requests',
    });
  }
  if (noLink > 0) {
    out.push({
      key: 'online-no-link',
      title: `ใบเปิดที่ยังไม่ Gen link ${NUM.format(noLink)} ใบ`,
      reason: 'ยังไม่มีลิงก์สมัคร — คนนอกยังสมัครใบนี้ผ่านลิงก์ไม่ได้',
      badge: 'ยังไม่ Gen link',
      count: noLink,
      tone: 'info',
      path: '/jobs/board',
      action: 'เปิดกล่องงาน',
      stepKey: 'requests',
    });
  }
  return out;
}

const TONE_RANK: Record<NextTask['tone'], number> = { danger: 0, warn: 1, info: 2 };

const TeamOnlinePage: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const wanted = normalizeTrendBu(params.get('bu'));
  const win = useTrendWindow('day');
  const [rev, setRev] = useState(0);

  const [data, setData] = useState<TeamOnlineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTeamOnline({ from: win.range.from, to: win.range.to, grain: win.grain, compare: win.compare, bu: wanted })
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e: unknown) => alive && setError(errText(e, 'โหลดหน้าทีม Online ไม่สำเร็จ')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [win.range.from, win.range.to, win.grain, win.compare, wanted, rev]);

  /** BU ที่ใช้จริง — ผู้ใช้ที่ถูกล็อกแผนก เซิร์ฟเวอร์บังคับให้ ⇒ เส้นอื่นรอให้รู้ก่อนค่อยโหลด */
  const effectiveBu: string | null | undefined = data ? data.bu : error ? wanted : undefined;

  /** คิวโทรที่รอผล + ถังงานค้างของหน้าหลัก — เส้นเดิม + bu (นิยามเดิมทุกตัว) */
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [office, setOffice] = useState<OfficeFloorResponse | null>(null);
  const [flowRev, setFlowRev] = useState(0);
  useEffect(() => {
    if (effectiveBu === undefined) return;
    let alive = true;
    fetchFlowSummary(effectiveBu)
      .then((d) => alive && setFlow(d))
      .catch(() => alive && setFlow(null));
    return () => {
      alive = false;
    };
  }, [effectiveBu, rev, flowRev]);
  useEffect(() => {
    if (effectiveBu === undefined) return;
    let alive = true;
    fetchOfficeFloor(effectiveBu)
      .then((d) => alive && setOffice(d))
      .catch(() => alive && setOffice(null));
    return () => {
      alive = false;
    };
  }, [effectiveBu, rev]);
  const dialogs = useHomeCallDialogs({ flow, reloadFlow: () => setFlowRev((x) => x + 1) });
  const queueWaiting = flow ? flow.lumos.waiting_call + flow.lumos.delivered_waiting : null;

  const tasks = useMemo(() => {
    const home = buildNextTasks({
      followPastDue: office ? office.counts.follow.pastDue : null,
      applicantsUntouched: office ? office.counts.intake.untouched : null,
      claimedIdle: office ? office.counts.intake.claimedIdle : null,
      callsStale: flow ? flow.lumos.stale_delivered : null,
      needsHuman: flow ? callBoxCount(flow, 'needs_human') : null,
    });
    return [...home, ...onlineTasks(data)].sort((a, b) => TONE_RANK[a.tone] - TONE_RANK[b.tone]);
  }, [office, flow, data]);

  const setBu = (value: string | null) => {
    const p = new URLSearchParams(params);
    if (value) p.set('bu', value);
    else p.delete('bu');
    setParams(p, { replace: true });
  };

  const w = data?.window ?? null;
  const buText = effectiveBu ? trendBuLabel(effectiveBu) : 'ทุก BU';
  const watch = useMemo(() => (data ? teamWatchItems(data) : []), [data]);

  const compareText = w?.compare === 'lastYear' ? 'เทียบปีก่อน' : 'เทียบช่วงก่อน';
  const accounts = data?.users?.accounts.cur ?? 0;
  const users = countBits(
    data?.users?.total,
    data?.users?.coverage,
    'คน',
    compareText,
    true,
    data?.users ? `${fmtPct(ratio(data.users.total.cur, accounts))} ของ ${n(accounts)} บัญชี` : undefined,
  );
  const positions = countBits(
    data?.requests?.positions,
    data?.requests?.coverage,
    'อัตรา',
    compareText,
    null,
    data?.requests ? `${n(data.requests.requests.cur)} ใบ` : undefined,
  );
  if (data?.requests?.stale) positions.flags.push(`ข้อมูลใบขอจาก ERP เมื่อ ${ageText(data.requests.ageSeconds)}`);
  const lumos = data?.lumos ?? null;
  const called = countBits(
    lumos?.called,
    lumos?.coverage,
    'สาย',
    compareText,
    true,
    lumos ? `ส่งไป ${n(lumos.total.sent)} · รอโทร ${n(lumos.total.waiting)}` : undefined,
  );
  const postRate = rateBits(
    data?.postings ? ratio(data.postings.withApplicants.cur, data.postings.published.cur) : null,
    data?.postings ? ratio(data.postings.withApplicants.prev, data.postings.published.prev) : null,
    data?.postings?.coverage,
    compareText,
    data?.postings ? `${n(data.postings.withApplicants.cur)} / ${n(data.postings.published.cur)} ใบที่ Gen link` : '',
  );
  const callRate = rateBits(
    lumos ? successRate(lumos.total) : null,
    lumos ? successRate(lumos.prev) : null,
    lumos?.coverage,
    compareText,
    lumos ? `${n(lumos.total.success)} / ${n(lumos.total.talked)} สายที่ได้คุยจริง` : '',
  );

  /** กราฟคนใช้ vs ใบขอเข้า — ตามตัวกรอง BU (ทุก BU = รวมตัวตั้ง ÷ รวมตัวหาร) */
  const usage = useMemo(() => {
    if (!data?.users || !w) return null;
    const rows = data.users.byBu.filter((r) => (effectiveBu ? r.bu === effectiveBu : true));
    return pooledUsage(rows, w.buckets.length);
  }, [data, w, effectiveBu]);

  /** แผง BU — รวมสามแหล่งด้วยรหัส BU (คนใช้งาน % · อัตราที่ขอเข้า · Success ประกาศ) */
  const panelRows = useMemo((): TeamBuPanelRow[] | null => {
    if (!data?.byBu) return null;
    const bus = new Set<string>([
      ...(data.users?.byBu ?? []).map((r) => r.bu),
      ...(data.requests?.byBu ?? []).map((r) => r.bu),
      ...data.byBu.map((r) => r.bu),
    ]);
    const rows = [...bus].map((bu) => {
      const u = data.users?.byBu.find((r) => r.bu === bu);
      const q = data.requests?.byBu.find((r) => r.bu === bu);
      const b = data.byBu?.find((r) => r.bu === bu);
      return {
        bu,
        label: u?.label ?? q?.label ?? b?.label ?? (bu || 'ไม่ระบุ BU'),
        usersPct: u ? u.pct : null,
        positionsIn: data.requests ? (q?.positions.cur ?? 0) : null,
        postSuccess: b ? ratio(b.withApplicants, b.published) : null,
      };
    });
    return rows.sort(
      (a, b) => Number(a.bu === '') - Number(b.bu === '') || (b.positionsIn ?? 0) - (a.positionsIn ?? 0) || a.bu.localeCompare(b.bu),
    );
  }, [data]);

  const generated = data ? new Date(data.generated_at) : null;
  const isStaff = user?.role === 'staff';
  const firstLoad = loading && !data;

  const tasksBlock = (
    <HomeStuckList tasks={tasks} loading={!office || !flow} buLabel={effectiveBu ? trendBuLabel(effectiveBu) : null} title="งานที่ต้องทำต่อ" />
  );

  /** แถวกลางแบบภาพอ้างอิง: กราฟคนใช้ vs ใบขอเข้า (ซ้าย) + รายการจัดอันดับ BU (ขวา · ทุก BU เสมอ) */
  const chartAndPanel = (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">
        <UsageVsRequestsChart
          buckets={w?.buckets ?? []}
          grain={w?.grain ?? 'day'}
          usage={usage}
          positions={data?.requests ? data.requests.positions.series : null}
          lastOpen={!!w?.lastBucketOpen}
          buLabel={buText}
          loading={firstLoad}
        />
      </div>
      <div className="min-w-0 lg:col-span-2">
        <TeamBuPanel
          rows={panelRows}
          selected={effectiveBu ?? null}
          onSelect={data?.scope === 'all' ? setBu : null}
          loading={firstLoad}
          error={data?.errors.byBu}
        />
      </div>
    </div>
  );

  return (
    <div className="relative -mx-4 space-y-5 px-4 py-6 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 md:py-8 lg:-mx-8 lg:px-8">
      {/* หัวหน้า: ชื่อทีม · เวลาอัปเดตจริงของข้อมูล */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-medium text-foreground">ทีม Online</h1>
          <p className={cn('text-sm', DASH.muted)}>การใช้งาน · งานเข้า · ผลลัพธ์ · งานที่ต้องทำ</p>
        </div>
        <p className={cn('text-xs tabular-nums', DASH.muted)}>
          {generated ? `อัปเดต ${DATE.format(generated)} · ${TIME.format(generated)}` : loading ? 'กำลังโหลดข้อมูล…' : 'โหลดไม่สำเร็จ'}
        </p>
      </div>

      {/* ช่วงเวลา (แถบเดียวกับแท็บ Dashboard) · BU · รีเฟรช */}
      <div className="flex flex-wrap items-center gap-3">
        <TrendToolbar win={win} />
        <div className="flex items-center gap-2">
          <span className={cn('whitespace-nowrap text-xs', DASH.muted)}>รายละเอียด BU</span>
          {data?.scope === 'code' && data.forced_bu ? (
            <span className="text-xs text-foreground">{trendBuLabel(data.forced_bu)}</span>
          ) : (
            /* ช่องเลือกของธีมบังคับกว้างเต็มกล่อง (`jarvis-soft-field`) ⇒ คุมความกว้างที่กล่องครอบ */
            <div className="w-60">
              <Select value={effectiveBu ?? ALL} onValueChange={(v) => setBu(v === ALL ? null : v)}>
                <SelectTrigger className="text-xs" aria-label="รายละเอียด BU">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">
                    ทุก BU
                  </SelectItem>
                  {(data?.bu_options ?? []).map((o) => (
                    <SelectItem key={o.bu} value={o.bu} className="text-xs">
                      {o.label}
                    </SelectItem>
                  ))}
                  {effectiveBu && !(data?.bu_options ?? []).some((o) => o.bu === effectiveBu) ? (
                    <SelectItem value={effectiveBu} className="text-xs">
                      {trendBuLabel(effectiveBu)}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Button type="button" size="xs" variant="outline" onClick={() => setRev((x) => x + 1)} disabled={loading}>
          <RefreshCw className={cn(loading && 'animate-spin')} aria-hidden />
          รีเฟรช
        </Button>
      </div>
      {w ? (
        <p className={cn('text-xs tabular-nums', DASH.muted)}>
          {teamWindowText(w)} · {buText}
          {w.lastBucketOpen ? ' · วันนี้ยังไม่จบวัน' : ''}
        </p>
      ) : null}
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}

      {/* เจ้าหน้าที่: งานของตัวเองก่อน (ต้องรู้ว่าต้องทำอะไรต่อ) */}
      {isStaff ? tasksBlock : null}

      {/* 5 การ์ดตามภาพต้นแบบ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TeamKpiCard metric="teamOnline.users" labelSuffix=" · ทุก BU" icon={Users} unit="คน" {...users} loading={firstLoad} error={data?.errors.users} />
        <TeamKpiCard
          metric="teamOnline.positionsIn"
          icon={ClipboardList}
          tone="info"
          unit="อัตรา"
          {...positions}
          loading={firstLoad}
          error={data?.errors.requests}
        />
        <TeamKpiCard
          metric="teamOnline.lumosCalled"
          labelSuffix=" · Lumos"
          icon={PhoneCall}
          tone="violet"
          unit="สาย"
          {...called}
          loading={firstLoad}
          error={data?.errors.lumos}
        />
        <TeamKpiCard metric="teamOnline.postingSuccess" icon={Link2} tone="success" {...postRate} loading={firstLoad} error={data?.errors.postings} />
        <TeamKpiCard
          metric="teamOnline.successRate"
          labelSuffix=" · Lumos"
          icon={Target}
          tone="success"
          {...callRate}
          loading={firstLoad}
          error={data?.errors.lumos}
        />
      </div>

      {/* สิ่งที่ต้องจับตา — สรุปจากตัวเลขบนหน้า + ปุ่มตรวจคิวโทร (ป๊อปเดิมของหน้าหลัก) */}
      <Card className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-sm font-medium text-foreground">สิ่งที่ต้องจับตา</span>
          {watch.length === 0 ? (
            <span className={cn('text-xs', DASH.muted)}>{data ? 'ยังไม่มีอะไรขยับจากช่วงก่อน' : '—'}</span>
          ) : (
            watch.map((it) => (
              <span key={it.key} className="inline-flex items-center gap-1.5 text-xs text-foreground">
                <span className={cn('inline-block h-2 w-2 rounded-full', TONE[it.tone].dot)} aria-hidden />
                {it.text}
              </span>
            ))
          )}
        </div>
        <Button type="button" size="xs" variant="outline" onClick={dialogs.openActiveCalls} disabled={queueWaiting === null}>
          ตรวจคิวโทร {n(queueWaiting)} สาย
        </Button>
      </Card>

      {chartAndPanel}

      {/* หัวหน้า/ผู้บริหาร: งานที่ต้องทำต่อหลังภาพรวม */}
      {isStaff ? null : tasksBlock}

      <TeamOnlineTabs data={data} loading={loading} />

      <p className={cn('text-xs', DASH.muted)}>ตัวเลขคนกับใบแยกหน่วย · ค่าไม่มีข้อมูลแสดง “—”</p>

      {dialogs.dialogs}
    </div>
  );
};

export default TeamOnlinePage;
