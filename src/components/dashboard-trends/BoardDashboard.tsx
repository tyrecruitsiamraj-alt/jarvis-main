import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { useTrendWindow } from '@/hooks/useTrendWindow';
import {
  fetchApplicantTrendRows,
  fetchFollowTrendRows,
  fetchReleaseTrendRows,
  fetchRequestTrends,
} from '@/lib/trends/api';
import {
  bangkokYmd,
  breakdown,
  seriesByBucket,
} from '@/lib/trends/timeBuckets';
import {
  activityLedger,
  cohortSeries,
  releaseStats,
  REQUEST_DIM_LABEL,
  requestDimGetter,
  type RequestDim,
} from '@/lib/trends/requestTrends';
import { appliedYmd } from '@/lib/trends/applicantTrends';
import { lumosPipeline, pipelineRates } from '@/lib/trends/lumosPipeline';
import { staffTable } from '@/lib/trends/staffTrends';
import { formatTrendNumber as fmt, formatTrendPct as pct } from '@/lib/trends/format';
import type {
  ApplicantTrendRow,
  FollowTrendRow,
  ReleaseTrendRow,
  RequestTrendPayload,
  RequestTrendRow,
} from '@/lib/trends/types';
import {
  DeltaChip,
  TrendBadge,
  TrendBreakdown,
  TrendChart,
  TrendKpiCard,
  TrendSection,
  TrendState,
  TrendTable,
  TrendToolbar,
} from './TrendParts';
import LumosPipelineSection from './LumosPipelineSection';

/**
 * ═══ แท็บ "Dashboard" ของหน้ากล่องงาน — มุมผู้บริหาร (28 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"สวมบทบาทเป็นผู้บริหาร … แต่ละวันทีมมีแนวโน้มเติบโตลดลงยังไง … รายวัน สัปดาห์ เดือน ปี
 * ดูได้ในหลายๆมิติ"* → Choice: แท็บในหน้า (ชื่อ "Dashboard") · ทำครบ 4 ส่วน (ใบขอ+ปล่อยประกาศ ·
 * ผู้สมัคร+AI โทร · เทียบเจ้าหน้าที่ · ติดตามอยู่หน้าติดตาม) · ERP อ่านอย่างเดียว + สำเนาฝั่งเรา
 * รอบ 2 (เจ้าของสั่งวันเดียวกัน): ส่วนผู้สมัครกลายเป็น "รายชื่อ → Lumos → ผลโทร" (`LumosPipelineSection`)
 * — เส้นทางคนกลุ่มเดียวกัน · ผลโทรแยกถัง · ช่วงเวลาที่คนกรอก · แยกมิติ
 *
 * 🔴 กติกา:
 * - ทุกตัวเลขมาจาก `src/lib/trends/*` (มีเทสต์) — จอนี้วาดอย่างเดียว ห้ามนับเอง
 * - ใบขอมีสองมุม **แยกป้ายชัด**: "ตามวันที่เกิดจริง" (ค่าตั้งต้น) กับ "ตามงวดของใบ" (= Dashboard ศูนย์ควบคุมใบขอ)
 * - หาได้แล้วที่ไม่มีวันที่แจ้งเข้า = ติดธงประมาณการพร้อมจำนวน (กติกาโปรเจกต์ · ห้ามกลบ)
 * - ห้ามพาออกนอกกล่องงาน (ไม่มีลิงก์ไปหน้าใบขอ/จับคู่งาน)
 */

/** ข้อมูลใบขอดึงย้อนตั้งแต่ต้นปีของ 2 ปีก่อน — ปุ่ม "ปี" ดู 3 ปี · งานค้างต้องมียอดยกมาครบ */
function requestDataFrom(today: string): string {
  return `${Number(today.slice(0, 4)) - 2}-01-01`;
}

const REQUEST_DIMS = (Object.keys(REQUEST_DIM_LABEL) as RequestDim[]).map((value) => ({ value, label: REQUEST_DIM_LABEL[value] }));

type Loadable<T> = { data: T | null; loading: boolean; error: string | null };
const idle = <T,>(): Loadable<T> => ({ data: null, loading: true, error: null });

function useLoad<T>(key: string, load: () => Promise<T>): Loadable<T> & { reload: () => void } {
  const [state, setState] = useState<Loadable<T>>(idle<T>());
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ data: s.data, loading: true, error: null }));
    load()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e: unknown) => !cancelled && setState({ data: null, loading: false, error: e instanceof Error ? e.message : 'โหลดไม่สำเร็จ' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key คือสิ่งที่กำหนดว่าต้องโหลดใหม่ไหม
  }, [key, rev]);
  return { ...state, reload: () => setRev((n) => n + 1) };
}

export type BoardOpenTotals = {
  /** อัตราที่ยังต้องหาทั้งกล่องงาน (ตัวเดียวกับหัวกล่องงาน "N อัตรา") */
  positions: number;
  /** ในนั้นเป็นใบขอล่วงหน้าฝั่งเรา (ไม่อยู่ใน ERP) กี่อัตรา / กี่ใบ */
  prePositions: number;
  preCount: number;
};

const BoardDashboard: React.FC<{
  /**
   * 🔴 ยอด "เหลือหาตอนนี้" ต้องเท่าหัวกล่องงานเสมอ (หนึ่งเมตริกหนึ่งนิยาม) — มาจาก feed เดียวกับกล่องงาน
   * วัดจริง 28 ก.ย. 2569: ERP 387 + ใบขอล่วงหน้า 26 = 413 = หัวกล่องงาน · null = feed ยังโหลดไม่เสร็จ
   */
  boardOpen?: BoardOpenTotals | null;
}> = ({ boardOpen = null }) => {
  const win = useTrendWindow('day');
  const { range, previous, grain } = win;
  const dataFrom = requestDataFrom(win.today);

  const requests = useLoad<RequestTrendPayload>(`req:${dataFrom}`, () => fetchRequestTrends(dataFrom));
  const releases = useLoad<ReleaseTrendRow[]>(`rel:${win.fetchFrom}:${win.today}`, () =>
    fetchReleaseTrendRows(win.fetchFrom, win.today),
  );
  const applicants = useLoad<ApplicantTrendRow[]>(`app:${win.fetchFrom}:${win.today}`, () =>
    fetchApplicantTrendRows(win.fetchFrom, win.today),
  );
  const follow = useLoad<FollowTrendRow[]>(`fol:${win.fetchFrom}:${win.today}`, () =>
    fetchFollowTrendRows(win.fetchFrom, win.today),
  );

  const [requestView, setRequestView] = useState<'activity' | 'cohort'>('activity');
  const [requestDim, setRequestDim] = useState<RequestDim>('bu');

  const reloadAll = () => {
    requests.reload();
    releases.reload();
    applicants.reload();
    follow.reload();
  };

  /* ─── ใบขอ ─── */
  const req = requests.data;
  const ledger = useMemo(
    () => (req ? activityLedger(req.requests, req.informs, range, grain) : null),
    [req, range, grain],
  );
  const ledgerPrev = useMemo(
    () => (req ? activityLedger(req.requests, req.informs, previous, grain) : null),
    [req, previous, grain],
  );
  const cohort = useMemo(() => (req ? cohortSeries(req.requests, range, grain) : null), [req, range, grain]);
  const sum = <K extends 'added' | 'informed' | 'cancelled'>(l: typeof ledger, k: K) =>
    l ? l.points.reduce((s, p) => s + p[k], 0) : 0;
  const requestBreakdown = useMemo(() => {
    if (!req) return [];
    const getDim = requestDimGetter(requestDim);
    // มุมเกิดจริง = ขอเข้ามาตามวันที่กรอก · มุมงวด = ขอมาตามงวดของใบ (ตัวเดียวกับกราฟที่ดูอยู่)
    const ymd =
      requestView === 'activity'
        ? (r: RequestTrendRow) => r.submittedDate ?? r.cohortDate
        : (r: RequestTrendRow) => r.cohortDate;
    return breakdown(req.requests, ymd, getDim, range, previous, 8, (r) => r.positions);
  }, [req, requestDim, requestView, range, previous]);

  /* ─── ปล่อยประกาศ ─── */
  const rel = useMemo(() => releases.data ?? [], [releases.data]);
  const relNow = useMemo(() => releaseStats(rel, req?.requests ?? [], range), [rel, req, range]);
  const relPrev = useMemo(() => releaseStats(rel, req?.requests ?? [], previous), [rel, req, previous]);
  const relSeries = useMemo(
    () => seriesByBucket(rel, (x) => bangkokYmd(x.releasedAt), range, grain),
    [rel, range, grain],
  );

  /* ─── รายชื่อ → Lumos → ผลโทร ─── */
  const apps = useMemo(() => applicants.data ?? [], [applicants.data]);
  const appSeries = useMemo(() => seriesByBucket(apps, appliedYmd, range, grain), [apps, range, grain]);
  const sentSeries = useMemo(
    () => seriesByBucket(apps, appliedYmd, range, grain, (r) => (r.lumos ? 1 : 0)),
    [apps, range, grain],
  );
  const pipeNow = useMemo(() => lumosPipeline(apps, range), [apps, range]);
  const pipePrev = useMemo(() => lumosPipeline(apps, previous), [apps, previous]);
  const pipeRates = pipelineRates(pipeNow);

  /* ─── เจ้าหน้าที่ ─── */
  const staff = useMemo(
    () => staffTable({ releases: rel, follow: follow.data ?? [] }, range, previous),
    [rel, follow.data, range, previous],
  );

  const addedNow = sum(ledger, 'added');
  const informedNow = sum(ledger, 'informed');
  const cancelledNow = sum(ledger, 'cancelled');
  const sentNow = pipeNow.steps.find((x) => x.key === 'sent')?.count ?? 0;
  const sentPrev = pipePrev.steps.find((x) => x.key === 'sent')?.count ?? 0;

  const reqAge = req ? Math.round(req.ageSeconds / 60) : null;

  return (
    <div className="space-y-6">
      <TrendToolbar
        win={win}
        note={
          <>
            {range.from} ถึง {range.to} · เทียบ {previous.from} ถึง {previous.to}
          </>
        }
      />

      {/* ═══ ภาพรวม ═══ */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <TrendKpiCard label="ขอเข้ามา" unit="อัตรา" value={req ? addedNow : null} previous={req ? sum(ledgerPrev, 'added') : null} polarity="neutral" tone="primary" spark={ledger?.points.map((p) => p.added)} />
        <TrendKpiCard label="หาได้แล้ว (วันแจ้งเข้า)" unit="อัตรา" value={req ? informedNow : null} previous={req ? sum(ledgerPrev, 'informed') : null} tone="success" spark={ledger?.points.map((p) => p.informed)} />
        <TrendKpiCard
          label="เหลือหาตอนนี้"
          unit="อัตรา"
          value={boardOpen ? boardOpen.positions : ledger ? ledger.openNow : null}
          polarity="down-good"
          tone="warn"
          foot={
            ledger
              ? boardOpen && boardOpen.prePositions > 0
                ? `ERP ${fmt(ledger.openNow)} · ใบขอล่วงหน้า ${fmt(boardOpen.prePositions)}`
                : `ยกเลิกในช่วง ${fmt(cancelledNow)} อัตรา`
              : undefined
          }
        />
        <TrendKpiCard label="ปล่อยประกาศ" unit="ใบ" value={releases.data ? relNow.released : null} previous={releases.data ? relPrev.released : null} tone="info" spark={relSeries.map((p) => p.value)} />
        <TrendKpiCard label="รายชื่อเข้ามา" unit="คน" value={applicants.data ? pipeNow.names : null} previous={applicants.data ? pipePrev.names : null} tone="violet" spark={appSeries.map((p) => p.value)} />
        <TrendKpiCard
          label="ส่งให้ Lumos"
          unit="คน"
          value={applicants.data ? sentNow : null}
          previous={applicants.data ? sentPrev : null}
          tone="primary"
          spark={sentSeries.map((p) => p.value)}
          foot={applicants.data && pipeRates.coverage !== null ? `Lumos โทรแล้ว ${pct(pipeRates.coverage)}` : undefined}
        />
      </div>

      {/* ═══ ใบขอ ═══ */}
      <TrendSection
        title="ใบขอ · ขอเข้ามา vs หาได้แล้ว"
        badge={
          req ? (
            <TrendBadge tone={req.source === 'fresh' || req.source === 'snapshot' ? 'neutral' : 'warn'}>
              ERP · ข้อมูลเมื่อ {reqAge === 0 ? 'เมื่อสักครู่' : `${fmt(reqAge ?? 0)} นาทีที่แล้ว`}
            </TrendBadge>
          ) : null
        }
        actions={
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="มุมมองใบขอ">
            <Button type="button" size="xs" variant={requestView === 'activity' ? 'default' : 'outline'} aria-pressed={requestView === 'activity'} onClick={() => setRequestView('activity')}>
              ตามวันที่เกิดจริง
            </Button>
            <Button type="button" size="xs" variant={requestView === 'cohort' ? 'default' : 'outline'} aria-pressed={requestView === 'cohort'} onClick={() => setRequestView('cohort')}>
              ตามงวดของใบ
            </Button>
          </div>
        }
      >
        <TrendState loading={requests.loading && !req} error={requests.error} onRetry={requests.reload} />
        {req && ledger && cohort ? (
          <Card className="space-y-4 rounded-2xl p-4">
            {requestView === 'activity' ? (
              <TrendChart
                ariaLabel="ขอเข้ามา หาได้แล้ว ยกเลิก และงานค้าง ตามช่วงเวลาที่เลือก"
                data={ledger.points.map((p) => ({ label: p.label, added: p.added, informed: p.informed, cancelled: p.cancelled, backlog: p.backlog }))}
                series={[
                  { key: 'added', label: 'ขอเข้ามา (วันที่กรอก)', kind: 'bar', tone: 'primary' },
                  { key: 'informed', label: 'หาได้แล้ว (วันแจ้งเข้า)', kind: 'bar', tone: 'success' },
                  { key: 'cancelled', label: 'ยกเลิก', kind: 'bar', tone: 'neutral' },
                  { key: 'backlog', label: 'งานค้างตามสมการ (ใบขอ ERP)', kind: 'line', tone: 'warn' },
                ]}
              />
            ) : (
              <TrendChart
                ariaLabel="ขอมาตามงวดของใบ แยกหาได้แล้ว ยกเลิก เหลือหา"
                data={cohort.map((p) => ({ label: p.label, filled: p.filled, cancelled: p.cancelled, remaining: p.remaining, requested: p.requested }))}
                series={[
                  { key: 'filled', label: 'หาได้แล้ว', kind: 'bar', tone: 'success', stack: 'c' },
                  { key: 'cancelled', label: 'ยกเลิก', kind: 'bar', tone: 'neutral', stack: 'c' },
                  { key: 'remaining', label: 'เหลือหา', kind: 'bar', tone: 'warn', stack: 'c' },
                  { key: 'requested', label: 'ขอมา', kind: 'line', tone: 'primary' },
                ]}
              />
            )}
            <div className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs', DASH.sub)}>
              {requestView === 'cohort' ? <span>งวดของใบ = วันที่ต้องการคน (ตัวเดียวกับ Dashboard ศูนย์ควบคุมใบขอ) · งวดล่าสุดยังไม่ปิด</span> : null}
              {requestView === 'activity' && ledger.undatedFilled > 0 ? (
                <span className={TONE.warn.value}>
                  ประมาณการ: หาได้แล้ว {fmt(ledger.undatedFilled)} อัตราไม่มีวันที่แจ้งเข้า ยอดรายงวดขาดไปเท่านี้
                </span>
              ) : null}
            </div>
            <TrendBreakdown<RequestDim>
              dims={REQUEST_DIMS}
              dim={requestDim}
              onDimChange={setRequestDim}
              rows={requestBreakdown}
              unit={requestView === 'activity' ? 'ขอเข้ามา (อัตรา)' : 'ขอมา (อัตรา)'}
              polarity="neutral"
            />
          </Card>
        ) : null}
      </TrendSection>

      {/* ═══ ปล่อยประกาศ ═══ */}
      <TrendSection
        title="ปล่อยประกาศ"
        badge={
          <>
            <TrendBadge>นับใบที่ยังปล่อยอยู่ · ถอนแล้วไม่มีประวัติ</TrendBadge>
            {[...relNow.batches, ...relPrev.batches].map((b) => (
              <TrendBadge key={`${b.day}-${b.staffName}`} tone="warn">
                ปล่อยรวดเดียว {fmt(b.count)} ใบ · {b.day} · {b.staffName}
              </TrendBadge>
            ))}
          </>
        }
      >
        <TrendState loading={releases.loading && !releases.data} error={releases.error} onRetry={releases.reload} />
        {releases.data ? (
          <Card className="space-y-4 rounded-2xl p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TrendKpiCard label="ปล่อยในช่วงนี้" unit="ใบ" value={relNow.released} previous={relPrev.released} tone="info" />
              <TrendKpiCard label="ขอ → ปล่อย (มัธยฐาน)" unit="วัน" value={relNow.medianDaysToRelease} previous={relPrev.medianDaysToRelease} polarity="down-good" tone="primary" />
              <TrendKpiCard label="ปล่อยภายใน 3 วัน" value={relNow.within3Days} previous={relPrev.within3Days} asRate tone="success" />
            </div>
            <TrendChart ariaLabel="จำนวนใบที่ปล่อยประกาศต่องวด" data={relSeries.map((p) => ({ label: p.label, released: p.value }))} series={[{ key: 'released', label: 'ปล่อยประกาศ', kind: 'bar', tone: 'info' }]} height={200} />
          </Card>
        ) : null}
      </TrendSection>

      {/* ═══ รายชื่อ → Lumos → ผลโทร ═══ */}
      <LumosPipelineSection
        rows={applicants.data}
        loading={applicants.loading}
        error={applicants.error}
        onRetry={applicants.reload}
        range={range}
        previous={previous}
        grain={grain}
        now={pipeNow}
        prev={pipePrev}
      />

      {/* ═══ เทียบเจ้าหน้าที่ ═══ */}
      <TrendSection title="เทียบเจ้าหน้าที่">
        <TrendState loading={(releases.loading && !releases.data) || (follow.loading && !follow.data)} error={releases.error ?? follow.error} onRetry={reloadAll} />
        {releases.data && follow.data ? (
          <Card className="rounded-2xl p-4">
            <TrendTable
              columns={[
                { key: 'name', label: 'เจ้าหน้าที่' },
                { key: 'released', label: 'ปล่อยประกาศ', align: 'right' },
                { key: 'registered', label: 'ลงติดตาม', align: 'right' },
                { key: 'success', label: 'ไปถึงแล้ว', align: 'right' },
                { key: 'rate', label: 'อัตราไปถึง', align: 'right' },
                { key: 'delta', label: 'งานเทียบช่วงก่อน', align: 'right' },
              ]}
              rows={staff.map((s) => ({
                key: s.key,
                cells: {
                  name: s.name,
                  released: fmt(s.released),
                  registered: fmt(s.registered),
                  success: fmt(s.success),
                  rate: s.successRate === null ? '—' : pct(s.successRate),
                  delta: <DeltaChip current={s.released + s.registered} previous={s.releasedPrev + s.registeredPrev} polarity="up-good" />,
                },
              }))}
            />
          </Card>
        ) : null}
      </TrendSection>
    </div>
  );
};

export default BoardDashboard;
