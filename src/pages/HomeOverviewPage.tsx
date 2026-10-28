/**
 * ═══ หน้าหลักสรุปหน้าเดียว (เจ้าของ 28 ต.ค. 2569) ═══
 * > *"หน้าหลักคือต้องบอกภาพรวมของการทำงานทั้งระบบ แล้วอยากรู้ลึก ๆ ก็กดเพิ่มเพื่อไปดูของหน้านั้น ๆ ได้เลย"*
 * Choice ที่เคาะ: บนลงล่าง ซ้ายไปขวา · มี Visual Control + Interactive · สีแดง/เหลือง/เขียวเฉดเรียบ · ถอดแท็บ ·
 * กดตัวเลข = แผงข้าง + ปุ่มไปหน้าเต็ม · ค่าเริ่ม = เดือนนี้ · แถบช่องทางใต้ทุกขั้น (iRecruit แท่งแยก) ·
 * "ลงงาน" อยู่ก้อนใบขอ (ใบแจ้งเข้า ERP ต่อท้ายเส้นผู้สมัครไม่ได้) · ประเภทใบขอดูในแผงตอนกด "ขอใหม่"
 * ภาพตัวอย่างที่เจ้าของดูก่อนสร้าง: https://claude.ai/artifact/PsMLRYXb9T3rKxruRnSxZf
 * ลำดับ: ตอนนี้ (4 กล่อง) → ใบขอ → ใบขอใหม่ประกาศแค่ไหน → ผู้สมัคร 6 ขั้น → ติดตาม · ดูแลหลังเริ่มงาน
 * ข้อมูล: `/api/home-money` (เงิน · สมการใบขอ) · `/api/recruit-overview` (ประกาศ · ผู้สมัคร · งานค้าง) ·
 *        `/api/home-ai-share` (+ `summary=lumos`) (ติดตาม · ดูแล) — ทุกเลขชุดเดียวกับหน้าที่ปุ่ม "ไปหน้าเต็ม" พาไป
 * 🔴 ชั้นคู่ขนาน: หน้าหลักผู้บริหารแบบแท็บเดิมยังเปิดได้ที่ `?home=exec` (ทางถอย · `HomeExecPage.tsx`)
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PeriodPicker from '@/components/shared/PeriodPicker';
import BuChoiceSelect from '@/components/shared/BuChoiceSelect';
import ExecDrill, { useDrill } from '@/components/home-exec/ExecDrill';
import {
  ChannelLegend,
  ChannelStrip,
  ChannelTable,
  NUM,
  OverviewNode,
  OverviewSection,
  OverviewSheet,
  PanelRows,
  type OverviewPanel,
} from '@/components/home-overview/OverviewParts';
import { useHomeLumosSummary, FOLLOW_RESULT_COLS } from '@/components/home-ai-share/AiShareLumosStats';
import { useLiveTick } from '@/hooks/useLiveTick';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { usePageTitle } from '@/hooks/usePageTitle';
import { PREQUEST_ID_PREFIX } from '@/lib/siamrajUnitRequestsApi';
import { fetchHomeMoney, type HomeMoneyPayload } from '@/lib/homeMoneyApi';
import { fetchHomeAiShare } from '@/lib/homeAiShareApi';
import type { AiShareResponse, AiShareWindow } from '@/lib/homeAiShare';
import { costliest, perDayOf, reasonsOf, thisMonthWindow } from '@/lib/homeExec';
import type { MoneyRequest } from '@/lib/homeMoney';
import { fetchRecruitOverview } from '@/lib/recruitOverviewApi';
import type { RecruitOverviewResponse } from '@/lib/recruitOverviewTypes';
import { appsInWindow, buildApplicantFunnel, type FunnelStep } from '@/lib/homeOverviewFunnel';
import { followBuSplit, followResultSplit, followTeamTotals } from '@/lib/homeSplit';
import { REQUEST_LEAD_KIND_LABEL, requestLeadKindFromYmd, type RequestLeadKind } from '@/lib/requestLeadKind';
import { SITE_BU_TO_DEPT, trendBuLabel } from '@/lib/trends/bu';
import { toYmdBangkok } from '@/lib/dateTh';
import { thaiDate } from '@/lib/periodPick';
import { friendlyErrorText } from '@/lib/friendlyError';
import { TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const BU_OPTIONS = [...new Set(Object.values(SITE_BU_TO_DEPT))];
const LIVE_MS = 60_000;
const ALL_FROM = '2024-01-01';

/** หน้าเต็มของแต่ละเรื่อง — ปุ่ม "ไปหน้าเต็ม" ในแผง */
const PAGE = {
  requests: { label: 'ใบขอ', to: '/jobs/list' },
  board: { label: 'งานสรรหา › โพสต์ประกาศ', to: '/jobs/board' },
  applicants: { label: 'งานสรรหา › ผู้สมัคร', to: '/jobs/board?view=list' },
  contact: { label: 'งานสรรหา › การติดต่อ', to: '/jobs/board?view=contact' },
  appointments: { label: 'งานสรรหา › ติดตามนัดหมาย', to: '/jobs/board?view=appointments' },
  follow: { label: 'ติดตาม', to: '/follow' },
  aftercare: { label: 'ดูแลหลังเริ่มงาน', to: '/aftercare' },
} as const;

/** ขั้นของเส้นผู้สมัคร → หน้าเต็ม */
const STEP_PAGE: Record<FunnelStep['key'], (typeof PAGE)[keyof typeof PAGE]> = {
  applied: PAGE.applicants,
  ai: PAGE.applicants,
  staff: PAGE.contact,
  contact: PAGE.contact,
  appointment: PAGE.appointments,
  showed: PAGE.appointments,
};

const toneOfRow = (t: 'success' | 'warn' | 'danger' | 'neutral') => (t === 'neutral' ? null : t);

const HomeOverviewPage: React.FC = () => {
  usePageTitle('หน้าหลัก');
  const today = toYmdBangkok(new Date());
  const [win, setWin] = useState<AiShareWindow>(() => thisMonthWindow(today));
  const [bu, setBu] = useState<string | null>(null);
  const tick = useLiveTick(true, LIVE_MS);
  const range = useMemo(() => ({ from: win.from ?? ALL_FROM, to: win.to ?? today }), [win, today]);
  const winQ = useMemo(() => ({ ...win, bu }), [win, bu]);

  // ── เงิน · สมการใบขอ ──
  const [money, setMoney] = useState<HomeMoneyPayload | null>(null);
  const [moneyError, setMoneyError] = useState<string | null>(null);
  const [ai, setAi] = useState<AiShareResponse | null>(null);
  const [ro, setRo] = useState<RecruitOverviewResponse | null>(null);
  const [roError, setRoError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setMoneyError(null);
    fetchHomeMoney({ ...range, bu })
      .then((m) => alive && setMoney(m))
      .catch((e: unknown) => alive && setMoneyError(friendlyErrorText(e, 'โหลดยอดเงินไม่ขึ้น')));
    fetchHomeAiShare({ ...win, bu })
      .then((d) => alive && setAi(d))
      .catch(() => alive && setAi(null));
    fetchRecruitOverview(null, range, bu)
      .then((d) => {
        if (!alive) return;
        setRo(d);
        setRoError(null);
      })
      .catch((e: unknown) => alive && setRoError(friendlyErrorText(e, 'โหลดข้อมูลผู้สมัครไม่ขึ้น')));
    return () => {
      alive = false;
    };
  }, [range, win, bu, tick]);
  const lumos = useHomeLumosSummary('follow', winQ, tick);
  const feed = useUnitRequestsFeed();
  const preCount = feed.jobs.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX)).length;

  // เปลี่ยนช่วง/BU แล้วเลขเก่าห้ามค้าง
  const moneyNow =
    money && money.window.from === range.from && money.window.to === range.to && (money.forcedBu || money.bu === bu || (bu === null && Boolean(money.buChoices)))
      ? money
      : null;
  const lastMoney = useRef<HomeMoneyPayload | null>(null);
  if (moneyNow) lastMoney.current = moneyNow;
  const kpi = moneyNow ?? lastMoney.current;
  const flow = moneyNow?.flow ?? null;
  const contract = moneyNow ? moneyNow.totals.need.fine + moneyNow.totals.need.deduct : null;
  const openReqs = useMemo(() => moneyNow?.requests ?? [], [moneyNow]);
  const costlyAll = useMemo(() => costliest(openReqs, today, Infinity), [openReqs, today]);
  const perDayTotal = useMemo(() => costlyAll.rows.reduce((n, r) => n + r.perDay, 0), [costlyAll]);
  const byNo = useMemo(() => new Map(openReqs.map((r) => [r.requestNo, r])), [openReqs]);
  const rowsOf = (list: ReadonlyArray<{ requestNo: string }>): MoneyRequest[] =>
    list.map((x) => byNo.get(x.requestNo)).filter((r): r is MoneyRequest => Boolean(r));
  const flowRows = (pick: (f: NonNullable<MoneyRequest['flow']>) => boolean) => openReqs.filter((r) => r.flow && pick(r.flow));

  // ── ผู้สมัคร ──
  const roNow = ro && ro.window.from === range.from && ro.window.to === range.to ? ro : null;
  const apps = useMemo(() => (roNow?.apps ? appsInWindow(roNow.apps, range.from, range.to) : null), [roNow, range]);
  const claimed = roNow?.staff ? roNow.staff.reduce((n, s) => n + s.claimed, 0) : null;
  const funnel = useMemo(() => (apps ? buildApplicantFunnel(apps, claimed) : null), [apps, claimed]);
  const req = roNow?.requests ?? null;
  const backlog = roNow?.backlog ?? null;

  // ── ติดตาม ──
  const follow = ai?.follow ?? null;
  const cells = lumos.current?.followByBu ?? null;
  const liveCells = useMemo(() => (cells ? cells.filter((c) => c.bucket !== 'cancelled') : null), [cells]);
  const followResults = useMemo(
    () => (liveCells ? followResultSplit(liveCells, FOLLOW_RESULT_COLS.filter((c) => c.key !== 'cancelled')).filter((r) => r.total > 0 || r.key === 'went') : []),
    [liveCells],
  );
  const followBus = useMemo(() => (liveCells ? followBuSplit(liveCells) : []), [liveCells]);
  const teams = useMemo(() => (liveCells ? followTeamTotals(liveCells) : null), [liveCells]);
  const followLive = followResults.reduce((n, r) => n + r.total, 0);
  const followCancelled = cells ? cells.reduce((n, c) => n + (c.bucket === 'cancelled' ? c.n : 0), 0) : 0;
  const aftercare = ai?.aftercare ?? null;
  const upcoming = money?.aftercareUpcoming ?? null;

  // ── แผง ──
  const drill = useDrill();
  const [panel, setPanel] = useState<OverviewPanel | null>(null);
  const openList = (title: string, rows: MoneyRequest[], sub?: string) => {
    setPanel(null);
    drill.open({ title, rows, expand: null, sub });
  };

  const openMoney = () => {
    const rows = rowsOf(costlyAll.rows);
    const bus = new Map<string, { n: number; missing: number; perDay: number }>();
    for (const r of costlyAll.rows) {
      const k = byNo.get(r.requestNo)?.bu ?? 'ไม่ระบุ BU';
      const cur = bus.get(k) ?? { n: 0, missing: 0, perDay: 0 };
      cur.n += 1;
      cur.missing += r.missing;
      cur.perDay += r.perDay;
      bus.set(k, cur);
    }
    setPanel({
      title: 'เสียเงิน',
      sub: `${NUM.format(costlyAll.total)} ใบ · วันละ ${BAHT.format(perDayTotal)} บาท · ตามสัญญา ${BAHT.format(contract ?? 0)} บาท`,
      go: PAGE.requests,
      body: (
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">แยก BU</p>
          <ul className="divide-y divide-border rounded-xl border border-border" data-testid="overview-money-bu">
            {[...bus.entries()]
              .sort((a, b) => b[1].perDay - a[1].perDay)
              .map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <span>{k === 'ไม่ระบุ BU' ? k : trendBuLabel(k)}</span>
                  <span className="text-right tabular-nums text-muted-foreground">
                    {NUM.format(v.n)} ใบ · ขาด {NUM.format(v.missing)} คน ·{' '}
                    <span className={cn('font-medium', TONE.danger.value)}>{BAHT.format(v.perDay)} บาท/วัน</span>
                  </span>
                </li>
              ))}
          </ul>
          <p className="text-sm font-medium text-foreground">ใบที่เสียมากสุด</p>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {costlyAll.rows.slice(0, 5).map((r) => (
              <li key={r.requestNo} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="line-clamp-2 text-foreground">
                    {r.unit} · {r.position}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {r.requestNo} · ขาด {NUM.format(r.missing)} คน · {r.owner ?? 'ยังไม่มีคนรับผิดชอบ'}
                  </span>
                </span>
                <span className={cn('shrink-0 font-medium tabular-nums', TONE.danger.value)}>{BAHT.format(r.perDay)}/วัน</span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" className="w-full" onClick={() => openList('ใบที่เสียเงิน', rows)} data-testid="overview-money-all">
            ดูทุกใบ {NUM.format(costlyAll.total)} ใบ
          </Button>
        </div>
      ),
    });
  };

  const openNew = () => {
    const list = flowRows((f) => f.isNew);
    const lead = new Map<RequestLeadKind, number>();
    for (const r of list) {
      const k = requestLeadKindFromYmd(r.keyYmd, r.needYmd);
      lead.set(k, (lead.get(k) ?? 0) + 1);
    }
    const days = (roNow?.requestDays ?? []).filter((d) => d.day >= range.from && d.day <= range.to);
    const dayMax = Math.max(1, ...days.map((d) => d.total));
    const kinds = new Map<string, number>();
    for (const r of list) {
      const k = (r.position || 'ไม่ระบุ').trim();
      kinds.set(k, (kinds.get(k) ?? 0) + 1);
    }
    const topKinds = [...kinds.entries()].sort((a, b) => b[1] - a[1]);
    const bus = new Map<string, number>();
    for (const r of list) bus.set(r.bu ?? 'ไม่ระบุ BU', (bus.get(r.bu ?? 'ไม่ระบุ BU') ?? 0) + 1);
    setPanel({
      title: 'ขอใหม่',
      sub: flow ? `${NUM.format(flow.newRequests)} ใบ · ${NUM.format(flow.newPositions)} คน` : undefined,
      go: PAGE.requests,
      body: (
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">เข้ามารายวัน</p>
            <div className="flex h-24 items-end gap-0.5" data-testid="overview-new-days">
              {days.map((d) => (
                <span
                  key={d.day}
                  className={cn('flex-1 rounded-t-sm', TONE.info.dot)}
                  style={{ height: `${Math.max(2, (d.total / dayMax) * 100)}%` }}
                  title={`${thaiDate(d.day)} · ${NUM.format(d.total)} ใบ`}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{thaiDate(range.from)}</span>
              <span>{thaiDate(range.to)}</span>
            </div>
          </div>
          <p className="text-sm font-medium text-foreground">ด่วนแบบไหน</p>
          <PanelRows
            unit="ใบ"
            rows={(['advance', 'urgent', 'retroactive'] as const).map((k) => ({
              label: REQUEST_LEAD_KIND_LABEL[k],
              value: lead.get(k) ?? 0,
              emphasis: k === 'retroactive' ? 'danger' : k === 'urgent' ? 'warn' : null,
            }))}
          />
          <p className="text-sm font-medium text-foreground">งานอะไร</p>
          {/* 8 อันดับแรก + อื่น ๆ — รวมกัน = ขอใหม่ทั้งหมด */}
          <PanelRows
            unit="ใบ"
            rows={[
              ...topKinds.slice(0, 8).map(([label, value]) => ({ label, value })),
              ...(topKinds.length > 8 ? [{ label: 'อื่น ๆ', value: topKinds.slice(8).reduce((n, [, v]) => n + v, 0) }] : []),
            ]}
          />
          <p className="text-sm font-medium text-foreground">แยก BU</p>
          <PanelRows unit="ใบ" rows={[...bus.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k === 'ไม่ระบุ BU' ? k : trendBuLabel(k), value: v }))} />
          <Button type="button" variant="outline" className="w-full" onClick={() => openList('ขอใหม่', list)}>
            ดูทุกใบ {NUM.format(list.length)} ใบ
          </Button>
        </div>
      ),
    });
  };

  const openRequestList = (title: string, pick: (r: NonNullable<RecruitOverviewResponse['requestList']>[number]) => boolean) => {
    const list = (roNow?.requestList ?? []).filter(pick);
    setPanel({
      title,
      sub: `${NUM.format(list.length)} ใบ`,
      go: PAGE.board,
      body: (
        <ul className="divide-y divide-border rounded-xl border border-border" data-testid="overview-request-list">
          {list.length === 0 ? <li className="px-3 py-2 text-sm text-muted-foreground">0 ใบ</li> : null}
          {list.map((r) => (
            <li key={r.requestNo} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="line-clamp-2 text-foreground">
                  {r.unitName ?? '—'} · {r.position ?? '—'}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {r.requestNo} · เข้ามา {thaiDate(r.day)}
                </span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{NUM.format(r.applications)} คน</span>
            </li>
          ))}
        </ul>
      ),
    });
  };

  const openStep = (s: FunnelStep) => {
    const staffRows = s.key === 'staff' || s.key === 'contact' ? (roNow?.staff ?? []).filter((x) => x.claimed + x.called > 0) : [];
    setPanel({
      title: s.label,
      sub: `${NUM.format(s.value)} คน`,
      go: STEP_PAGE[s.key],
      body: (
        <div className="space-y-4">
          {s.rows.length ? <PanelRows unit="คน" rows={s.rows.map((r) => ({ label: r.label, value: r.value, emphasis: toneOfRow(r.tone) }))} /> : null}
          {staffRows.length ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">แยกเจ้าหน้าที่</p>
              <ul className="divide-y divide-border rounded-xl border border-border text-sm">
                <li className="flex justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <span>เจ้าหน้าที่</span>
                  <span>เก็บ · โทร · ติดต่อได้ · นัดได้</span>
                </li>
                {staffRows.map((x) => (
                  <li key={x.name} className="flex justify-between gap-2 px-3 py-2">
                    <span>{x.name}</span>
                    <span className="tabular-nums">
                      {NUM.format(x.claimed)} · {NUM.format(x.called)} · {NUM.format(x.reached)} · {NUM.format(x.appointed)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ChannelTable channels={s.channels} />
        </div>
      ),
    });
  };

  const openFollow = () =>
    setPanel({
      title: 'ติดตามคนเริ่มงาน / ติดตามส่งคนแทน',
      sub: follow ? `${NUM.format(followLive)} สาย · ยกเลิก ${NUM.format(followCancelled)} ไม่นับ` : undefined,
      go: PAGE.follow,
      body: (
        <div className="space-y-4">
          {teams ? (
            <PanelRows
              unit="สาย"
              rows={[
                { label: 'คนเริ่มงาน', value: teams.main },
                { label: 'ส่งคนแทน', value: teams.replacement },
              ]}
            />
          ) : null}
          <p className="text-sm font-medium text-foreground">ผลโทร</p>
          <PanelRows
            unit="สาย"
            rows={followResults.map((r) => ({
              label: `${r.label} · AI ${NUM.format(r.parts.ai ?? 0)} · คน ${NUM.format(r.parts.staff ?? 0)}`,
              value: r.total,
              emphasis: r.key === 'went' ? 'success' : r.key === 'notWent' ? 'danger' : r.key === 'failed' || r.key === 'reschedule' ? 'warn' : null,
            }))}
          />
          <p className="text-sm font-medium text-foreground">แต่ละ BU ใช้เท่าไหร่</p>
          <PanelRows
            unit="สาย"
            rows={followBus.map((r) => ({ label: `${r.label} · AI ${NUM.format(r.parts.ai ?? 0)} · คน ${NUM.format(r.parts.staff ?? 0)}`, value: r.total }))}
          />
        </div>
      ),
    });

  const openAftercare = () =>
    setPanel({
      title: 'ดูแลหลังเริ่มงาน',
      go: PAGE.aftercare,
      body: (
        <PanelRows
          unit="สาย"
          rows={[
            { label: 'ทั้งหมด', value: aftercare?.total ?? 0 },
            { label: 'AI โทร', value: aftercare?.ai ?? 0 },
            { label: 'คนโทร', value: aftercare?.staff ?? 0 },
            { label: 'ยังไม่โทร', value: aftercare?.notCalled ?? 0, emphasis: (aftercare?.notCalled ?? 0) > 0 ? 'warn' : null },
          ]}
        />
      ),
    });

  const aiShare = follow && follow.ai + follow.staff > 0 ? Math.round((follow.ai / (follow.ai + follow.staff)) * 100) : null;
  const applied = funnel?.[0] ?? null;
  const aiStep = funnel?.[1] ?? null;

  return (
    <div className="space-y-5" data-testid="home-overview">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium text-foreground">หน้าหลัก</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker value={win} onChange={setWin} />
          {kpi?.buChoices?.length ? (
            <BuChoiceSelect value={bu ?? kpi.bu} choices={kpi.buChoices} onChange={setBu} triggerClassName="h-10 w-44 bg-card" />
          ) : moneyNow?.forcedBu && moneyNow.bu ? (
            <span className="text-sm text-muted-foreground">{trendBuLabel(moneyNow.bu)}</span>
          ) : (
            <Select value={bu ?? 'all'} onValueChange={(v) => setBu(v === 'all' ? null : v)}>
              <SelectTrigger className="h-10 w-44 bg-card" aria-label="เลือก BU">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก BU</SelectItem>
                {BU_OPTIONS.map((b) => (
                  <SelectItem key={b} value={b}>
                    {trendBuLabel(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {moneyError || roError ? <p className={cn('text-sm', TONE.danger.value)}>{moneyError ?? roError}</p> : null}

      {/* ── ตอนนี้ ── */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4" data-testid="overview-kpis">
        <OverviewNode
          big
          label="เสียเงิน (ตามสัญญา)"
          value={contract}
          unit="บาท"
          emphasis="danger"
          tag="ด่วน"
          sub={moneyNow ? `${NUM.format(costlyAll.total)} ใบ · วันละ ${BAHT.format(perDayTotal)} · ลูกค้าหักจริง ${BAHT.format(moneyNow.customerFines.total)}` : undefined}
          onClick={moneyNow ? openMoney : undefined}
          testId="overview-kpi-money"
        />
        <OverviewNode
          big
          label="เหลือหา"
          value={flow?.remainingRequests}
          unit="ใบ"
          emphasis="warn"
          tag="ต้องหา"
          sub={flow ? `${NUM.format(flow.remaining)} คน · ล่วงหน้าอีก ${NUM.format(preCount)} ใบ` : undefined}
          onClick={flow ? () => openList('เหลือหา', flowRows((f) => f.open).sort((a, b) => perDayOf(b) - perDayOf(a))) : undefined}
          testId="overview-kpi-remain"
        />
        <OverviewNode
          big
          label="ผู้สมัคร"
          value={applied?.value}
          unit="คน"
          sub={aiStep ? `AI โทรแล้ว ${NUM.format(aiStep.value)} · สนใจ ${NUM.format(aiStep.rows[0].value)}` : undefined}
          onClick={applied ? () => openStep(applied) : undefined}
          testId="overview-kpi-apps"
        />
        <OverviewNode
          big
          label="ติดตาม"
          value={cells ? followLive : null}
          unit="สาย"
          sub={aiShare !== null ? `AI ${aiShare}% · ไป ${NUM.format(followResults.find((r) => r.key === 'went')?.total ?? 0)}` : undefined}
          onClick={cells ? openFollow : undefined}
          testId="overview-kpi-follow"
        />
      </div>

      {/* ── ใบขอ: ยกมา + ขอใหม่ − ปิดครบ − ยกเลิก = เหลือหา ── */}
      <OverviewSection title="ใบขอ" sub="ใบขอจริงใน ERP · ใบ (คน)" testId="overview-requests">
        <div className="grid grid-cols-2 items-stretch gap-2 sm:grid-cols-5">
          <OverviewNode label="ยกมา" value={flow?.carryInRequests} unit="ใบ" sub={flow ? `${NUM.format(flow.carryIn)} คน` : undefined} onClick={flow ? () => openList('ยกมา', flowRows((f) => f.carry)) : undefined} testId="overview-req-carry" />
          <OverviewNode label="+ ขอใหม่" value={flow?.newRequests} unit="ใบ" sub={flow ? `${NUM.format(flow.newPositions)} คน` : undefined} onClick={flow ? openNew : undefined} testId="overview-req-new" />
          <OverviewNode label="− ปิดครบ" value={flow?.closedRequests} unit="ใบ" emphasis="success" onClick={flow ? () => openList('ปิดครบ', flowRows((f) => f.closed)) : undefined} testId="overview-req-closed" />
          <OverviewNode
            label="− ยกเลิก"
            value={flow?.cancelledRequests}
            unit="ใบ"
            sub={flow ? `${NUM.format(flow.cancelled)} คน` : undefined}
            onClick={
              flow
                ? () => {
                    const list = flowRows((f) => f.cancelledReq);
                    setPanel(null);
                    drill.open({ title: 'ยกเลิก', rows: list, expand: null, reasons: { unit: 'ใบ', items: reasonsOf(list, () => 1) } });
                  }
                : undefined
            }
            testId="overview-req-cancel"
          />
          <OverviewNode label="= เหลือหา" value={flow?.remainingRequests} unit="ใบ" emphasis="warn" sub={flow ? `${NUM.format(flow.remaining)} คน` : undefined} onClick={flow ? () => openList('เหลือหา', flowRows((f) => f.open)) : undefined} testId="overview-req-remain" />
        </div>
        {/* หาได้แล้ว (ลงงาน) แยกกล่อง — คนที่หาได้ทุกใบ รวมใบที่ได้บางส่วน ≠ ปิดครบ (CLAUDE.md "ห้ามปน หาได้แล้ว กับ ปิดครบใบขอ") */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <OverviewNode
            label="หาได้แล้ว · ลงงาน"
            value={flow?.filled}
            unit="คน"
            emphasis="success"
            onClick={flow ? () => openList('หาได้แล้ว', openReqs.filter((r) => r.filledInWindow > 0)) : undefined}
            testId="overview-req-filled"
          />
        </div>
        <div className="space-y-1 text-xs tabular-nums text-muted-foreground">
          <p data-testid="overview-req-sum">
            {flow
              ? `ยกมา ${NUM.format(flow.carryInRequests)} + ขอใหม่ ${NUM.format(flow.newRequests)} − ปิดครบ ${NUM.format(flow.closedRequests)} − ยกเลิก ${NUM.format(flow.cancelledRequests)} = เหลือหา ${NUM.format(flow.remainingRequests)} ใบ`
              : '—'}
          </p>
          <p>
            {flow
              ? `ยกมา ${NUM.format(flow.carryIn)} + ขอใหม่ ${NUM.format(flow.newPositions)} − หาได้ ${NUM.format(flow.filled)} − ยกเลิก ${NUM.format(flow.cancelled)} = เหลือหา ${NUM.format(flow.remaining)} คน`
              : '—'}
          </p>
        </div>
      </OverviewSection>

      {/* ── ใบขอใหม่ประกาศแค่ไหน ── */}
      <OverviewSection title="ใบขอใหม่ ประกาศไปแค่ไหน" sub={req ? `${NUM.format(req.total)} ใบ` : undefined} testId="overview-release">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <OverviewNode label="ขอใหม่" value={req?.total} unit="ใบ" onClick={req ? () => openRequestList('ขอใหม่', () => true) : undefined} testId="overview-rel-total" />
          <div className="grid gap-2">
            <OverviewNode label="ประกาศแล้ว" value={req?.released} unit="ใบ" onClick={req ? () => openRequestList('ประกาศแล้ว', (r) => r.released) : undefined} testId="overview-rel-released" />
            <OverviewNode label="ยังไม่ประกาศ · ยังเปิด" value={req?.notReleasedOpen} unit="ใบ" emphasis={req && req.notReleasedOpen > 0 ? 'warn' : null} tag="ต้องประกาศ" onClick={req ? () => openRequestList('ยังไม่ประกาศ · ยังเปิด', (r) => !r.released && r.open) : undefined} testId="overview-rel-open" />
            <OverviewNode label="ไม่ได้ประกาศ · ปิดไปแล้ว" value={req?.notReleasedClosed} unit="ใบ" onClick={req ? () => openRequestList('ไม่ได้ประกาศ · ปิดไปแล้ว', (r) => !r.released && !r.open) : undefined} testId="overview-rel-closed" />
          </div>
          <div className="grid gap-2">
            <OverviewNode
              label="มีคนกรอก"
              value={req?.releasedWithApps}
              unit="ใบ"
              emphasis="success"
              sub={req ? `${NUM.format(req.appsOnReleased)} คน${req.releasedWithApps ? ` · ใบละ ~${NUM.format(Math.round(req.appsOnReleased / req.releasedWithApps))} คน` : ''}` : undefined}
              onClick={req ? () => openRequestList('มีคนกรอก', (r) => r.released && r.applications > 0) : undefined}
              testId="overview-rel-apps"
            />
            <OverviewNode label="ไม่มีคนกรอก" value={req?.releasedNoApps} unit="ใบ" emphasis={req && req.releasedNoApps > 0 ? 'warn' : null} tag="ต้องดู" onClick={req ? () => openRequestList('ประกาศแล้ว ไม่มีคนกรอก', (r) => r.released && r.applications === 0) : undefined} testId="overview-rel-noapps" />
          </div>
        </div>
        <p className="text-xs tabular-nums text-muted-foreground">
          {req
            ? `ประกาศแล้ว ${NUM.format(req.released)} + ยังไม่ประกาศ ${NUM.format(req.notReleasedOpen)} + ปิดไปแล้ว ${NUM.format(req.notReleasedClosed)} = ${NUM.format(req.total)} · มีคนกรอก ${NUM.format(req.releasedWithApps)} + ไม่มี ${NUM.format(req.releasedNoApps)} = ${NUM.format(req.released)}`
            : '—'}
        </p>
      </OverviewSection>

      {/* ── ผู้สมัคร 6 ขั้น + แถบช่องทาง ── */}
      <OverviewSection title="ผู้สมัคร" sub="กรอกในช่วงที่เลือก · คน · แถบสี = มาจากช่องทางไหน" testId="overview-funnel">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {(funnel ?? buildApplicantFunnel([], null)).map((s) => (
            <OverviewNode key={s.key} label={s.label} value={funnel ? s.value : null} onClick={funnel ? () => openStep(s) : undefined} testId={`overview-step-${s.key}`}>
              <span className="mt-1 space-y-0.5 text-xs tabular-nums">
                {s.rows.map((r) => (
                  <span key={r.key} className="flex justify-between gap-2">
                    <span className={r.tone === 'neutral' ? 'text-muted-foreground' : TONE[r.tone].value}>{r.label}</span>
                    <span className={r.tone === 'neutral' ? 'text-foreground' : TONE[r.tone].value}>{funnel ? NUM.format(r.value) : '—'}</span>
                  </span>
                ))}
              </span>
              <span className="mt-2 block">
                <ChannelStrip channels={s.channels} total={s.value} />
              </span>
            </OverviewNode>
          ))}
        </div>
        <ChannelLegend channels={funnel?.[0]?.channels} />
      </OverviewSection>

      {/* ── ติดตาม · ดูแลหลังเริ่มงาน ── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <OverviewSection
          title="ติดตามคนเริ่มงาน / ติดตามส่งคนแทน"
          sub={cells ? `ยกเลิก ${NUM.format(followCancelled)} สาย ไม่นับ` : undefined}
          testId="overview-follow"
          className="lg:col-span-2"
          right={
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={openFollow} disabled={!cells}>
              ดูทั้งหมด
            </Button>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <OverviewNode label="ทั้งหมด" value={cells ? followLive : null} unit="สาย" sub={teams ? `เริ่มงาน ${NUM.format(teams.main)} · คนแทน ${NUM.format(teams.replacement)}` : undefined} onClick={cells ? openFollow : undefined} testId="overview-follow-total" />
            <OverviewNode label="AI โทร" value={follow?.ai} sub={aiShare !== null ? `${aiShare}%` : undefined} onClick={cells ? openFollow : undefined} />
            <OverviewNode label="คนโทร" value={follow?.staff} sub={aiShare !== null ? `${100 - aiShare}%` : undefined} onClick={cells ? openFollow : undefined} />
          </div>
          <ul className="space-y-1.5" data-testid="overview-follow-results">
            {followResults.map((r) => {
              const max = Math.max(1, ...followResults.map((x) => x.total));
              const tone = r.key === 'went' ? 'success' : r.key === 'notWent' ? 'danger' : r.key === 'failed' || r.key === 'reschedule' ? 'warn' : 'neutral';
              return (
                <li key={r.key} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 truncate">{r.label}</span>
                  <span className="block h-2.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className={cn('block h-full rounded-full transition-all duration-700 motion-reduce:transition-none', TONE[tone].dot)} style={{ width: `${(r.total / max) * 100}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right tabular-nums">{NUM.format(r.total)}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs tabular-nums text-muted-foreground">
            {followResults.length ? `${followResults.map((r) => `${r.label} ${NUM.format(r.total)}`).join(' + ')} = ${NUM.format(followLive)} สาย` : '—'}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground" data-testid="overview-follow-bu">
            {followBus.length ? `แต่ละ BU: ${followBus.map((r) => `${r.label} ${NUM.format(r.total)}`).join(' · ')}` : null}
          </p>
        </OverviewSection>
        <OverviewSection
          title="ดูแลหลังเริ่มงาน"
          testId="overview-aftercare"
          right={
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={openAftercare}>
              ดูทั้งหมด
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-2">
            <OverviewNode label="โทรในช่วงนี้" value={aftercare?.total ?? (ai ? 0 : null)} unit="สาย" onClick={openAftercare} testId="overview-aftercare-total" />
            <OverviewNode label="ยังไม่โทร" value={aftercare?.notCalled ?? (ai ? 0 : null)} emphasis={(aftercare?.notCalled ?? 0) > 0 ? 'warn' : null} onClick={openAftercare} />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">
            {upcoming && upcoming.calls > 0
              ? `รอโทร ${NUM.format(upcoming.calls)} สาย${upcoming.firstAt ? ` · เริ่ม ${thaiDate(toYmdBangkok(new Date(upcoming.firstAt)))}` : ''}`
              : 'รอโทร 0 สาย'}
          </p>
        </OverviewSection>
      </div>

      <OverviewSheet panel={panel} onClose={() => setPanel(null)} />
      <ExecDrill drill={drill} all={openReqs} today={today} />
    </div>
  );
};

export default HomeOverviewPage;
