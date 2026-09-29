/**
 * ═══ หน้าหลักโฉม 3 ก้อน (29 ก.ย. 2569) — แผน `docs/plan-home-v3-2569-09-29.md` ═══
 *
 * เจ้าของ: *"ในหน้าหลักตอนนี้มันปน มันงงไปหมด ฉันรู้สึกว่ามันไม่ได้ตอบได้ทั้งหมดขนาดนั้น"*
 * → Choice **"จัดใหม่ 3 ก้อนตามที่เสนอ"** + **"แยกตามคนเปิด"**
 *
 * - หัวหน้า/ผู้บริหาร: ผลงานเดือนนี้ → ของค้าง → วันนี้ → 4 ทีม · เจ้าหน้าที่: งานของฉัน (ของค้าง) → ผลงาน → วันนี้ → 4 ทีม
 * - **ตัวกรอง BU ชุดเดียวคุมทุกก้อน** (อยู่ใน URL `?bu=` · ผู้ใช้ที่ถูกล็อกแผนก = BU ของตัวเองเสมอ)
 * - ทุกก้อนใช้นิยามเดิม (ยกเว้นก้อน "วันนี้" ที่นับเป็นคน) · ล้มแยกกัน · อ่านไม่ได้ = บอกตรง ๆ
 * - 🔴 **ชั้นคู่ขนาน**: เปิดด้วย `?home=v3` · กลับหน้าเดิม `?home=classic` · หน้าเดิมยังเป็นค่าตั้งต้น (ทางถอย)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import HomeBuFilter from '@/components/home/HomeBuFilter';
import HomeDeckV2 from '@/components/home/HomeDeckV2';
import TeamBoardPanel from '@/components/home/TeamBoardPanel';
import { useHomeCallDialogs } from '@/components/home/useHomeCallDialogs';
import HomeResultBlock from '@/components/home-v3/HomeResultBlock';
import HomeStuckList from '@/components/home-v3/HomeStuckList';
import HomeTodayBlock from '@/components/home-v3/HomeTodayBlock';
import { fetchHomeOverview } from '@/lib/homeOverviewApi';
import { homeBlockOrder, type HomeBlockKey, type HomeOverview } from '@/lib/homeOverview';
import { fetchOfficeFloor, type OfficeFloorResponse } from '@/lib/officeFloorApi';
import { fetchOfficeTeam, type OfficeTeamResponse } from '@/lib/officeTeamApi';
import { callBoxCount, fetchFlowSummary, type FlowSummary } from '@/lib/flowSummaryApi';
import { buildNextTasks } from '@/lib/nextTask';
import { buildCallDigest } from '@/lib/homeCallDigest';
import { fetchCallRateSeries } from '@/lib/callFunnelApi';
import { bangkokTodayYmd, compareCallRate } from '@/lib/lumosCallRate';
import { normalizeTrendBu, trendBuLabel } from '@/lib/trends/bu';
import { DASH } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const NUM = new Intl.NumberFormat('th-TH');

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const HomeV3Page: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const wanted = normalizeTrendBu(params.get('bu'));
  const [rev, setRev] = useState(0);

  /* ── ก้อน 1 + 3 + ขอบเขต/ตัวเลือก BU ── */
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [ovLoading, setOvLoading] = useState(true);
  const [ovError, setOvError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setOvLoading(true);
    fetchHomeOverview(wanted)
      .then((o) => {
        if (!alive) return;
        setOverview(o);
        setOvError(null);
      })
      .catch((e: unknown) => alive && setOvError(errText(e, 'โหลดภาพรวมไม่สำเร็จ')))
      .finally(() => alive && setOvLoading(false));
    return () => {
      alive = false;
    };
  }, [wanted, rev]);

  /**
   * BU ที่ใช้จริง — ผู้ใช้ที่ถูกล็อกแผนก เซิร์ฟเวอร์บังคับให้ (`overview.bu`) ⇒ ก้อนอื่นรอให้รู้ก่อนค่อยโหลด
   * (ไม่งั้นแวบแรกเห็นเลขทั้งบริษัท) · ภาพรวมโหลดไม่ได้ = ใช้ที่เลือกใน URL ต่อ ไม่ให้ทั้งหน้าค้าง
   */
  const effectiveBu: string | null | undefined = overview ? overview.bu : ovError ? wanted : undefined;

  /* ── ก้อน 2 (ของค้าง) + ก้อน 4 (บอร์ดทีม) — เส้นเดิม + bu ── */
  const [office, setOffice] = useState<OfficeFloorResponse | null>(null);
  const [flow, setFlow] = useState<FlowSummary | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [team, setTeam] = useState<OfficeTeamResponse | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [flowRev, setFlowRev] = useState(0);
  useEffect(() => {
    if (effectiveBu === undefined) return;
    let alive = true;
    setTeamLoading(true);
    fetchOfficeFloor(effectiveBu)
      .then((d) => alive && setOffice(d))
      .catch(() => alive && setOffice(null));
    fetchOfficeTeam(effectiveBu)
      .then((d) => alive && setTeam(d))
      .catch(() => alive && setTeam(null))
      .finally(() => alive && setTeamLoading(false));
    return () => {
      alive = false;
    };
  }, [effectiveBu, rev]);
  useEffect(() => {
    if (effectiveBu === undefined) return;
    let alive = true;
    setFlowLoading(true);
    fetchFlowSummary(effectiveBu)
      .then((d) => alive && setFlow(d))
      .catch(() => alive && setFlow(null))
      .finally(() => alive && setFlowLoading(false));
    return () => {
      alive = false;
    };
  }, [effectiveBu, rev, flowRev]);

  /** Success Rate 7 วัน (ทั้งระบบ · ทางเดียวกับแดชบอร์ด) — บอร์ดทีมโชว์เฉพาะตอนดูทั้งหมด */
  const [successRate, setSuccessRate] = useState<{ pct: number | null; connected: number; fromYmd: string; toYmd: string } | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchCallRateSeries(60)
      .then((d) => {
        if (!alive || !d) return;
        const trend = compareCallRate(d.series, 7, bangkokTodayYmd());
        setSuccessRate({
          pct: trend.current.successRatePct,
          connected: trend.current.talked,
          fromYmd: trend.current.fromYmd,
          toYmd: trend.current.toYmd,
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  /** ถังของค้าง — ป้อนค่าชุดเดียวกับหน้าหลักเดิมทุกช่อง (นิยามเดิม · แค่กรอง BU) */
  const tasks = useMemo(
    () =>
      buildNextTasks({
        followPastDue: office ? office.counts.follow.pastDue : null,
        applicantsUntouched: office ? office.counts.intake.untouched : null,
        claimedIdle: office ? office.counts.intake.claimedIdle : null,
        callsStale: flow ? flow.lumos.stale_delivered : null,
        needsHuman: flow ? callBoxCount(flow, 'needs_human') : null,
        slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
      }),
    [office, flow],
  );
  const callDigest = useMemo(() => buildCallDigest(flow), [flow]);
  const dialogs = useHomeCallDialogs({ flow, reloadFlow: () => setFlowRev((n) => n + 1) });

  const setBu = (next: string | null) => {
    const p = new URLSearchParams(params);
    if (next) p.set('bu', next);
    else p.delete('bu');
    setParams(p, { replace: true });
  };

  const role = user?.role;
  const order: HomeBlockKey[] = homeBlockOrder(role);
  const buLabel = effectiveBu ? trendBuLabel(effectiveBu) : null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'สวัสดีตอนเช้า' : hour < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
  const userName = user?.full_name || user?.username || '';
  const stuckLoading = effectiveBu === undefined || flowLoading || !office;

  const blocks: Record<HomeBlockKey, React.ReactNode> = {
    result: (
      <HomeResultBlock
        result={overview?.result ?? null}
        loading={ovLoading}
        error={overview?.errors.result ?? ovError ?? undefined}
        buLabel={buLabel}
      />
    ),
    stuck:
      role === 'staff' ? (
        <HomeDeckV2
          greeting={greeting}
          userName={userName}
          tasks={tasks}
          loading={stuckLoading}
          statusInput={{
            followPastDue: office ? office.counts.follow.pastDue : null,
            applicantsUntouched: office ? office.counts.intake.untouched : null,
            slaBreached: flow ? (flow.jobs.sla_breached ?? null) : null,
          }}
        />
      ) : (
        <HomeStuckList tasks={tasks} loading={stuckLoading} buLabel={buLabel} />
      ),
    today: (
      <HomeTodayBlock
        today={overview?.today ?? null}
        loading={ovLoading}
        error={overview?.errors.today ?? ovError ?? undefined}
        buLabel={buLabel}
      />
    ),
    teams: (
      <TeamBoardPanel
        skin="plain"
        team={team}
        loading={teamLoading}
        onRefresh={() => setRev((n) => n + 1)}
        floor={office ? office.counts : null}
        onOpenCallResults={dialogs.openCallResults}
        onOpenActiveCalls={dialogs.openActiveCalls}
        successRate={successRate}
        callDigest={callDigest}
        onOpenPerson={(it) => dialogs.openPerson(it, 'good')}
        v3={{ bu: effectiveBu ?? null }}
      />
    ),
  };

  return (
    <div className="relative -mx-4 space-y-5 px-4 py-6 sm:-mx-5 sm:px-5 md:-mx-6 md:px-6 md:py-8 lg:-mx-8 lg:px-8">
      {/* หัวหน้า: ทักทาย (เจ้าหน้าที่ทักอยู่ในการ์ดงานของฉันแล้ว) · ตัวกรอง BU ชุดเดียวของทั้งหน้า · เวลาอัปเดตจริงของข้อมูล */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {role === 'staff' ? null : (
            <p className="text-sm font-medium text-foreground">
              {greeting}
              {userName ? `, ${userName}` : ''}
            </p>
          )}
          <p className={cn('text-xs tabular-nums', DASH.muted)}>
            {overview ? `ข้อมูลเมื่อ ${TIME.format(new Date(overview.generated_at))}` : ovLoading ? 'กำลังโหลดข้อมูล…' : 'โหลดไม่สำเร็จ'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {overview?.scope === 'all' ? (
            <HomeBuFilter
              options={overview.bu_options.map((o) => ({ bu: o.bu, count: o.remaining }))}
              value={effectiveBu ?? null}
              onChange={setBu}
              labelOf={trendBuLabel}
              keepOrder
            />
          ) : overview?.forced_bu ? (
            <span className={cn('text-xs', DASH.muted)}>{trendBuLabel(overview.forced_bu)}</span>
          ) : null}
          {overview && overview.unknown_bu_jobs > 0 ? (
            <span className={cn('text-xs tabular-nums', DASH.muted)} title="ใบขอที่อ่านรหัสไซต์ไม่ออก — อยู่ในยอดทั้งหมด แต่ไม่อยู่ใน BU ไหน">
              ไม่รู้ BU {NUM.format(overview.unknown_bu_jobs)} ใบ
            </span>
          ) : null}
          <Button type="button" size="xs" variant="outline" onClick={() => setRev((n) => n + 1)} disabled={ovLoading}>
            <RefreshCw className={cn(ovLoading && 'animate-spin')} aria-hidden />
            รีเฟรช
          </Button>
        </div>
      </div>

      {order.map((k) => (
        <React.Fragment key={k}>{blocks[k]}</React.Fragment>
      ))}

      {dialogs.dialogs}
    </div>
  );
};

export default HomeV3Page;
