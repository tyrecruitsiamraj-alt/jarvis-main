/**
 * ═══ หน้าทีม Online (29 ก.ย. 2569) — ตามภาพต้นแบบของเจ้าของ · แผน `docs/plan-team-online-2569-09-29.md` ═══
 *
 * เจ้าของ: *"หน้าหลัก ฉันจะเริ่มแก้ใหม่ เพราะตอนนี้บอกได้งงมาก อันนี้ฉันจะเริ่มจากทีม Online"* → Choice
 * **"ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน"** · คนใช้งาน = เจ้าหน้าที่ที่เข้าใช้ระบบ ·
 * อนุมัติ/เผยแพร่ = ใบที่ Gen link · ความคุ้มค่า = เว้นไว้ก่อน
 *
 * - ช่วงเวลา = ถึงตอนนี้ เทียบช่วงก่อนถึงจุดเดียวกัน (`?period=` · ตัวคิด `src/lib/teamOnline.ts`)
 * - ตัวกรอง BU ชุดเดียวของทั้งหน้า (`?bu=`) — ยกเว้น "คนใช้งาน" (ทุก BU เสมอ) กับแผง BU (แสดงทุก BU เสมอ)
 * - ตัวเลขทั้งหมดมาจาก `/api/team-online` · ปุ่มตรวจคิวโทร = ป๊อปเดิมของหน้าหลัก (`useHomeCallDialogs`)
 * - 🔴 **ชั้นคู่ขนาน**: เปิดด้วย `?home=online` · กลับหน้าเดิม `?home=classic` · หน้าเดิมยังเป็นค่าตั้งต้น (ทางถอย)
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import TeamKpiCard from '@/components/team-online/TeamKpiCard';
import TeamTrendCard, { type TeamTrendOption } from '@/components/team-online/TeamTrendCard';
import TeamBuPanel from '@/components/team-online/TeamBuPanel';
import TeamOnlineTabs from '@/components/team-online/TeamOnlineTabs';
import { useHomeCallDialogs } from '@/components/home/useHomeCallDialogs';
import { fetchFlowSummary, type FlowSummary } from '@/lib/flowSummaryApi';
import { fetchTeamOnline } from '@/lib/teamOnlineApi';
import {
  TEAM_PERIODS,
  countDelta,
  fmtPct,
  isTeamPeriod,
  rateDelta,
  ratio,
  teamWatchItems,
  teamWindowText,
  type DeltaTone,
  type TeamCount,
  type TeamCoverage,
  type TeamOnlineResponse,
  type TeamPeriod,
} from '@/lib/teamOnline';
import { normalizeTrendBu, trendBuLabel } from '@/lib/trends/bu';
import { METRICS } from '@/lib/metricDictionary';
import { DASH, TONE } from '@/lib/designTokens';
import { cn } from '@/lib/utils';

const NUM = new Intl.NumberFormat('th-TH');
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const DATE = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' });
const ALL = '__all__';

const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));

/** อายุของสำเนา ERP — ภาษาเดียวกับก้อนผลงานหน้าหลักโฉม 3 ก้อน */
function ageText(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return 'เมื่อสักครู่';
  if (m < 60) return `${NUM.format(m)} นาทีก่อน`;
  return `${NUM.format(Math.round(m / 60))} ชั่วโมงก่อน`;
}
const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

type CardBits = {
  value: string;
  delta: { text: string; tone: DeltaTone } | null;
  foot: string | null;
  flags: string[];
  series?: number[];
  prevSeries?: number[];
};

const NO_PREV = { text: 'ช่วงก่อนยังไม่มีข้อมูล', tone: 'none' as const };

/** ธงความครอบคลุม — ข้อมูลเริ่มกลางช่วง ต้องบอก (ห้ามให้อ่านเป็น "เพิ่มขึ้น") */
function coverageFlags(cov: TeamCoverage): string[] {
  if (!cov.since) return [];
  const since = DATE.format(new Date(cov.since));
  const out: string[] = [];
  if (cov.cur === 'partial') out.push(`ข้อมูลเริ่ม ${since}`);
  else if (cov.prev === 'partial') out.push(`ช่วงก่อนมีข้อมูลตั้งแต่ ${since}`);
  return out;
}

function countBits(c: TeamCount | null, cov: TeamCoverage | undefined, unit: string): CardBits {
  if (!c || !cov) return { value: '—', delta: null, foot: null, flags: [] };
  const noPrev = cov.prev === 'none';
  return {
    value: n(c.cur),
    delta: noPrev ? NO_PREV : countDelta(c.cur, c.prev, unit),
    foot: noPrev ? null : `ช่วงก่อน ${n(c.prev)} ${unit}`,
    flags: coverageFlags(cov),
    series: c.series,
    prevSeries: noPrev ? undefined : c.prevSeries,
  };
}

function rateBits(
  num: { cur: number; prev: number } | null,
  den: { cur: number; prev: number } | null,
  cov: TeamCoverage | undefined,
  footUnit: string,
): CardBits {
  if (!num || !den || !cov) return { value: '—', delta: null, foot: null, flags: [] };
  const cur = ratio(num.cur, den.cur);
  const prev = ratio(num.prev, den.prev);
  return {
    value: fmtPct(cur),
    // ช่วงนี้ยังไม่มีฐาน (เช่น วันนี้ยังไม่มีใบที่ Gen link) = ไม่มีอะไรให้เทียบ — ท้ายการ์ดบอก "0 / 0" อยู่แล้ว
    delta: cur === null ? null : cov.prev === 'none' ? NO_PREV : rateDelta(cur, prev),
    foot: `${n(num.cur)} / ${n(den.cur)} ${footUnit}`,
    flags: coverageFlags(cov),
  };
}

const TeamOnlinePage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const rawPeriod = params.get('period');
  const period: TeamPeriod = isTeamPeriod(rawPeriod) ? rawPeriod : 'today';
  const wanted = normalizeTrendBu(params.get('bu'));
  const [rev, setRev] = useState(0);

  const [data, setData] = useState<TeamOnlineResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchTeamOnline(period, wanted)
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
  }, [period, wanted, rev]);

  /** BU ที่ใช้จริง — ผู้ใช้ที่ถูกล็อกแผนก เซิร์ฟเวอร์บังคับให้ ⇒ คิวโทรรอให้รู้ก่อนค่อยโหลด */
  const effectiveBu: string | null | undefined = data ? data.bu : error ? wanted : undefined;

  /** คิวโทรที่รอผล — ตัวเดียวกับป๊อป "ส่ง AI โทร" ของหน้าหลัก (เส้นเดิม + bu) */
  const [flow, setFlow] = useState<FlowSummary | null>(null);
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
  const dialogs = useHomeCallDialogs({ flow, reloadFlow: () => setFlowRev((x) => x + 1) });
  const queueWaiting = flow ? flow.lumos.waiting_call + flow.lumos.delivered_waiting : null;

  const setParam = (key: string, value: string | null) => {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
  };

  const [line, setLine] = useState('users');
  const w = data?.window ?? null;
  const buText = effectiveBu ? trendBuLabel(effectiveBu) : 'ทุก BU';
  const watch = useMemo(() => (data ? teamWatchItems(data) : []), [data]);

  const users = countBits(data?.users ?? null, data?.users?.coverage, 'คน');
  const reqs = countBits(data?.requestsIn ?? null, data?.requestsIn?.coverage, 'ใบ');
  if (data?.requestsIn) {
    reqs.flags.push(period === 'today' ? 'ERP มีแต่วันที่ · เทียบเมื่อวานทั้งวัน' : 'ERP มีแต่วันที่ · นับถึงสิ้นวัน');
    if (data.requestsIn.stale) reqs.flags.push(`ข้อมูลใบขอจาก ERP เมื่อ ${ageText(data.requestsIn.ageSeconds)}`);
  }
  const called = countBits(data?.lumos?.called ?? null, data?.lumos?.coverage, 'คน');
  const postRate = rateBits(data?.postings?.withApplicants ?? null, data?.postings?.published ?? null, data?.postings?.coverage, 'ใบที่ Gen link');
  const callRate = rateBits(data?.lumos?.interested ?? null, data?.lumos?.reached ?? null, data?.lumos?.coverage, 'คนที่ติดต่อได้');

  const trendOptions: TeamTrendOption[] = [
    {
      key: 'users',
      label: 'คนใช้งาน · ทุก BU',
      count: data?.users ?? null,
      distinct: true,
      hidePrev: data?.users?.coverage.prev === 'none',
      note: 'คนใช้เพิ่ม = การใช้งานขยายตัว ดูผลลัพธ์ประกอบก่อนสรุปความคุ้มค่า',
    },
    {
      key: 'requestsIn',
      label: 'ใบขอเข้า',
      count: data?.requestsIn ?? null,
      distinct: false,
      unavailable: w?.grain === 'hour' ? 'ระบบงานหลักมีแต่วันที่ — ดูรายวันได้ที่ "สัปดาห์นี้"' : null,
    },
    {
      key: 'called',
      label: 'Lumos โทรแล้ว',
      count: data?.lumos?.called ?? null,
      distinct: true,
      hidePrev: data?.lumos?.coverage.prev === 'none',
    },
    {
      key: 'published',
      label: METRICS['teamOnline.published'].label,
      count: data?.postings?.published ?? null,
      distinct: false,
      hidePrev: data?.postings?.coverage.prev === 'none',
    },
  ];

  const generated = data ? new Date(data.generated_at) : null;

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

      {/* ช่วงเวลา · BU · รีเฟรช */}
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={period}
          onValueChange={(v) => {
            if (isTeamPeriod(v)) setParam('period', v === 'today' ? null : v);
          }}
          className="flex-wrap justify-start gap-1.5"
        >
          {TEAM_PERIODS.map((p) => (
            <ToggleGroupItem key={p.key} value={p.key} className="text-xs">
              {p.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <span className={cn('whitespace-nowrap text-xs', DASH.muted)}>รายละเอียด BU</span>
          {data?.scope === 'code' && data.forced_bu ? (
            <span className="text-xs text-foreground">{trendBuLabel(data.forced_bu)}</span>
          ) : (
            /* ช่องเลือกของธีมบังคับกว้างเต็มกล่อง (`jarvis-soft-field`) ⇒ คุมความกว้างที่กล่องครอบ */
            <div className="w-60">
              <Select value={effectiveBu ?? ALL} onValueChange={(v) => setParam('bu', v === ALL ? null : v)}>
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
        </p>
      ) : null}
      {error ? <p className={cn('text-sm', TONE.danger.value)}>{error}</p> : null}

      {/* 5 การ์ดตามภาพต้นแบบ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TeamKpiCard metric="teamOnline.users" labelSuffix=" · ทุก BU" unit="คน" {...users} loading={loading && !data} error={data?.errors.users} />
        <TeamKpiCard metric="teamOnline.requestsIn" unit="ใบ" upIsGood={null} {...reqs} loading={loading && !data} error={data?.errors.requestsIn} />
        <TeamKpiCard metric="teamOnline.called" unit="คน" {...called} loading={loading && !data} error={data?.errors.lumos} />
        <TeamKpiCard metric="teamOnline.postingSuccess" tone="success" {...postRate} loading={loading && !data} error={data?.errors.postings} />
        <TeamKpiCard metric="teamOnline.callSuccess" tone="success" {...callRate} loading={loading && !data} error={data?.errors.lumos} />
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

      {/* กราฟ (ซ้าย) + แผง BU (ขวา · ทุก BU เสมอ) */}
      <div className="grid gap-3 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <TeamTrendCard window={w} options={trendOptions} value={line} onChange={setLine} loading={loading && !data} />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <TeamBuPanel
            rows={data?.byBu ?? null}
            selected={effectiveBu ?? null}
            onSelect={data?.scope === 'all' ? (bu) => setParam('bu', bu) : null}
            loading={loading && !data}
            error={data?.errors.byBu}
          />
        </div>
      </div>

      <TeamOnlineTabs data={data} queueWaiting={queueWaiting} onOpenQueue={dialogs.openActiveCalls} />

      <p className={cn('text-xs', DASH.muted)}>ตัวเลขคนกับใบแยกหน่วย · ค่าไม่มีข้อมูลแสดง “—”</p>

      {dialogs.dialogs}
    </div>
  );
};

export default TeamOnlinePage;
