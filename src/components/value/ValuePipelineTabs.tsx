import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import LoadErrorNotice from '@/components/shared/LoadErrorNotice';
import JourneyNamesDialog from '@/components/dashboard-trends/JourneyNamesDialog';
import ChannelPlacementTable from '@/components/dashboard-trends/ChannelPlacementTable';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import { friendlyErrorText } from '@/lib/friendlyError';
import { onTimePct, type StageSla } from '@/lib/valuePipeline';
import {
  fetchValueBottleneck,
  fetchValueGaps,
  fetchValueOutcome,
  fetchValueRequest,
  type BottleneckResponse,
  type GapsResponse,
  type OutcomeResponse,
  type RequestResponse,
} from '@/lib/valuePipelineApi';

/**
 * ═══ หน้าความคุ้มค่า: ใบขอครบเส้น (เจ้าของ 19 ต.ค. 2569 · Choice "ทั้ง 4 แบบเป็นแท็บ") ═══
 * คุ้มไหม · ช้าที่ตรงไหน · ใบขอนี้ติดอะไร · จุดบอด — ตัวคิด `src/lib/valuePipeline.ts`
 * 🔴 ไม่มีข้อมูล = "ยังไม่มีข้อมูล" ห้ามขึ้น 0 · ช้า = เกิน 24 ชม.
 */
const NUM = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const n = (v: number | null | undefined) => (v == null ? '—' : NUM.format(v));
const baht = (v: number | null) => (v == null ? '—' : `${NUM.format(Math.round(v))} บาท`);
const NO_DATA = 'ยังไม่มีข้อมูล';

function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [rev, setRev] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load()
      .then((data) => alive && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => alive && setState({ data: null, error: friendlyErrorText(e, 'โหลดข้อมูลไม่สำเร็จ'), loading: false }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, rev]);
  return { ...state, retry: () => setRev((r) => r + 1) };
}

function Loading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <Card className="space-y-1 rounded-2xl p-4">
      <p className={cn('text-xs', DASH.muted)}>{label}</p>
      <p className={cn('text-2xl font-medium tabular-nums', tone ?? 'text-foreground')}>{value}</p>
      {sub ? <p className={cn('text-xs tabular-nums', DASH.muted)}>{sub}</p> : null}
    </Card>
  );
}

/* ─────────── 1. คุ้มไหม ─────────── */

export function ValueOutcomeSection({ month }: { month: string }) {
  const { data, error, loading, retry } = useLoad(() => fetchValueOutcome(month), [month]);
  if (error) return <LoadErrorNotice message={error} onRetry={retry} />;
  if (loading || !data) return <Loading />;
  const o = data.outcome;
  const f = data.funnel;
  const steps: Array<{ label: string; value: number | null }> = [
    { label: 'กรอกมา', value: f.names },
    { label: 'AI โทรแล้ว', value: f.aiCalled },
    { label: 'สนใจ', value: f.aiYes },
    { label: 'คนโทรต่อแล้วติด', value: f.staffOk },
    { label: 'นัดได้', value: f.booked },
    { label: 'มาตามนัด', value: f.showed },
    { label: 'แจ้งเข้า', value: f.informed },
  ];
  const max = Math.max(f.names, 1);
  return (
    <div className="space-y-4" data-testid="value-outcome">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="ต้นทุนต่อคนที่แจ้งเข้า"
          value={baht(o.costPerInform)}
          sub={`ค่าระบบ ${n(o.systemCost)} ÷ แจ้งเข้าที่ AI เคยโทร ${n(o.informedFromAi)} คน`}
        />
        <Stat
          label="ต้นทุนต่อใบขอที่หาครบ"
          value={baht(o.costPerClosed)}
          sub={`(ค่าระบบ + ค่าคน ${n(o.systemCost + o.staffCost)}) ÷ ${n(o.requestsClosed)} ใบ`}
        />
        <Stat
          label="แจ้งเข้าเดือนนี้"
          value={`${n(o.informed)} คน`}
          sub={`AI เคยโทร ${n(o.informedFromAi)} · สายสรรหา/จับคู่ ${n(data.informedFromAiRecruit)}`}
        />
      </div>
      {!data.inputsSaved ? (
        <p className={cn('rounded-xl border px-3 py-2 text-xs', TONE.warn.soft, TONE.warn.value)}>ยังไม่ได้กรอกค่าระบบและค่าคนด้านล่าง ต้นทุนยังเป็น 0</p>
      ) : null}
      <Card className="space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-foreground">ผู้สมัครเดือนนี้ไปถึงไหน</h2>
        <ol className="space-y-2">
          {steps.map((s) => (
            <li key={s.label} className="grid grid-cols-[8rem_1fr_4rem] items-center gap-3 text-sm">
              <span>{s.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                {s.value != null ? <span className={cn('block h-full', TONE.info.dot)} style={{ width: `${Math.max((s.value / max) * 100, s.value > 0 ? 1 : 0)}%` }} /> : null}
              </span>
              <span className={cn('text-right tabular-nums', s.value == null && DASH.muted)}>{s.value == null ? NO_DATA : n(s.value)}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card className="space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-foreground">คนแจ้งเข้าเดือนนี้ มาจากช่องทางไหน</h2>
        {data.channels ? <ChannelPlacementTable data={data.channels} /> : <p className={cn('text-sm', DASH.muted)}>{NO_DATA}</p>}
      </Card>
    </div>
  );
}

/* ─────────── ขั้นตอน (ใช้ร่วมสองแท็บ) ─────────── */

function StageTable({ stages, onOpen }: { stages: readonly StageSla[]; onOpen: (title: string, ids: readonly string[]) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">ขั้น</TableHead>
            <TableHead className="text-right text-xs">ผ่านขั้นนี้</TableHead>
            <TableHead className="text-right text-xs">ทันใน 24 ชม.</TableHead>
            <TableHead className="text-right text-xs">ค้างเกิน 24 ชม.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((s, i) => {
            const pct = onTimePct(s);
            const missing = s.done == null;
            return (
              <TableRow key={s.key} data-testid={`stage-${s.key}`}>
                <TableCell className="text-sm">
                  <span className={cn('mr-2 tabular-nums', DASH.muted)}>{i + 1}</span>
                  {s.label}
                  {missing ? <span className={cn('block text-xs', DASH.muted)}>{s.missing}</span> : null}
                </TableCell>
                <TableCell className={cn('text-right text-sm tabular-nums', missing && DASH.muted)}>{missing ? NO_DATA : n(s.done)}</TableCell>
                <TableCell
                  className={cn(
                    'text-right text-sm tabular-nums',
                    pct == null ? DASH.muted : pct >= 80 ? TONE.success.value : pct >= 50 ? TONE.warn.value : TONE.danger.value,
                  )}
                >
                  {missing ? '—' : pct == null ? '—' : `${pct}%`}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">
                  {s.stuck == null ? (
                    <span className={DASH.muted}>—</span>
                  ) : s.stuck > 0 && s.stuckIds.length > 0 ? (
                    <Button type="button" variant="ghost" size="xs" className={cn('-mr-2 px-2 text-sm', TONE.danger.value)} onClick={() => onOpen(`${s.label} · ค้างเกิน 24 ชม.`, s.stuckIds)}>
                      {n(s.stuck)}
                    </Button>
                  ) : (
                    <span className={s.stuck > 0 ? TONE.danger.value : DASH.muted}>{n(s.stuck)}</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─────────── 2. ช้าที่ตรงไหน ─────────── */

export function ValueBottleneckTab({ month, onOpenJob }: { month: string; onOpenJob: (jobId: string) => void }) {
  const { data, error, loading, retry } = useLoad<BottleneckResponse>(() => fetchValueBottleneck(month), [month]);
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);
  if (error) return <LoadErrorNotice message={error} onRetry={retry} />;
  if (loading || !data) return <Loading />;
  const measured = data.stages.filter((s) => s.done != null && s.done > 0);
  const totalStuck = data.stages.reduce((t, s) => t + (s.stuck ?? 0), 0);
  const worst = [...measured].sort((a, b) => (b.stuck ?? 0) - (a.stuck ?? 0))[0];
  return (
    <div className="space-y-4" data-testid="value-bottleneck">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="ใบขอที่เปิดอยู่" value={n(data.openRequests)} />
        <Stat label="ค้างเกิน 24 ชม. ตอนนี้" value={`${n(totalStuck)} ราย`} tone={totalStuck > 0 ? TONE.danger.value : undefined} />
        <Stat label="ค้างเยอะสุด" value={worst ? worst.label : '—'} sub={worst ? `${n(worst.stuck)} ราย` : undefined} tone={worst ? TONE.danger.value : undefined} />
      </div>
      <Card className="space-y-3 rounded-2xl p-4">
        <h2 className="text-sm font-medium text-foreground">แต่ละขั้นทันเป้า 24 ชม. แค่ไหน</h2>
        <StageTable stages={data.stages} onOpen={(title, ids) => setNames({ title, ids })} />
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 rounded-2xl p-4">
          <h2 className="text-sm font-medium text-foreground">ค้างอยู่ที่ใคร</h2>
          <ul className="space-y-2 text-sm">
            {data.owners.length === 0 ? <li className={DASH.muted}>ไม่มีงานค้าง</li> : null}
            {data.owners.map((o) => (
              <li key={o.owner} className="flex justify-between gap-3">
                <span>{o.owner}</span>
                <span className={cn('tabular-nums', TONE.danger.value)}>{n(o.stuck)} ราย</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="space-y-3 rounded-2xl p-4">
          <h2 className="text-sm font-medium text-foreground">ใบขอที่ค้างเยอะสุด</h2>
          <ul className="space-y-2 text-sm">
            {data.worstJobs.length === 0 ? <li className={DASH.muted}>ไม่มีใบค้าง</li> : null}
            {data.worstJobs.map((j) => (
              <li key={j.jobId} className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" variant="link" size="xs" className="h-auto p-0 text-sm" onClick={() => onOpenJob(j.jobId)}>
                  {j.label}
                </Button>
                <span className={cn('tabular-nums', TONE.danger.value)}>
                  {j.stage} · {n(j.stuck)} ราย{j.owner ? ` · ${j.owner}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <JourneyNamesDialog open={names !== null} onOpenChange={(o) => !o && setNames(null)} title={names?.title ?? ''} ids={names?.ids ?? []} />
    </div>
  );
}

/* ─────────── 3. ใบขอนี้ติดอะไร ─────────── */

export function ValueRequestTab({ jobId, onPick }: { jobId: string; onPick: (jobId: string) => void }) {
  const [draft, setDraft] = useState(jobId.replace(/^siamraj-(sql|pre):/, ''));
  const [names, setNames] = useState<{ title: string; ids: readonly string[] } | null>(null);
  const { data, error, loading, retry } = useLoad<RequestResponse | null>(() => (jobId ? fetchValueRequest(jobId) : Promise.resolve(null)), [jobId]);
  const submit = () => {
    const v = draft.trim().toUpperCase();
    if (v) onPick(/^siamraj-/.test(v) ? v : `siamraj-sql:${v}`);
  };
  const stuck = data?.stages.filter((s) => (s.stuck ?? 0) > 0) ?? [];
  return (
    <div className="space-y-4" data-testid="value-request">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="w-56">
          <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="เลขที่ใบขอ เช่น OPL6910009" aria-label="เลขที่ใบขอ" />
        </div>
        <Button type="submit" size="sm">ดูใบนี้</Button>
      </form>
      {!jobId ? <p className={cn('text-sm', DASH.muted)}>ใส่เลขที่ใบขอ หรือกดใบจากแท็บช้าที่ตรงไหน</p> : null}
      {jobId && error ? <LoadErrorNotice message={error} onRetry={retry} /> : null}
      {jobId && loading ? <Loading /> : null}
      {data ? (
        <>
          <Card className="space-y-2 rounded-2xl p-4">
            <p className={cn('text-xs', DASH.muted)}>{data.job.requestNo}</p>
            <h2 className="text-lg font-medium text-foreground">
              {data.job.unit || '—'}
              {data.job.position ? <span className={cn('ml-2 text-sm font-normal', DASH.muted)}>{data.job.position}</span> : null}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm tabular-nums">
              <span>ขอ {n(data.job.requested)}</span>
              <span className={TONE.success.value}>แจ้งเข้าแล้ว {n(data.informed)}</span>
              <span>ผู้สมัครในระบบ {n(data.applications)}</span>
              <span className={DASH.muted}>เจ้าของงาน {data.job.owner ?? '—'}</span>
              <span className={DASH.muted}>{data.job.status === 'closed' ? 'ปิดแล้ว' : 'เปิดอยู่'}</span>
            </div>
          </Card>
          <Card className={cn('rounded-2xl p-4', stuck.length > 0 ? cn(TONE.danger.soft) : undefined)}>
            <p className="text-sm font-medium">
              {stuck.length > 0
                ? `ต้องทำตอนนี้: ${stuck.map((s) => `${s.label} ${n(s.stuck)} ราย`).join(' · ')}`
                : 'ไม่มีขั้นที่ค้างเกิน 24 ชม.'}
            </p>
          </Card>
          <Card className="space-y-3 rounded-2xl p-4">
            <h2 className="text-sm font-medium text-foreground">ไล่ทีละขั้น</h2>
            <StageTable stages={data.stages} onOpen={(title, ids) => setNames({ title, ids })} />
          </Card>
          <Card className="space-y-3 rounded-2xl p-4">
            <h2 className="text-sm font-medium text-foreground">ลิงก์ของใบนี้</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">ช่องทาง</TableHead>
                    <TableHead className="text-xs">Gen เมื่อ</TableHead>
                    <TableHead className="text-right text-xs">กรอก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.links.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className={cn('text-sm', DASH.muted)}>ยังไม่มีลิงก์</TableCell>
                    </TableRow>
                  ) : null}
                  {data.links.map((l, i) => (
                    <TableRow key={`${l.createdAt}-${i}`}>
                      <TableCell className={cn('text-sm', !l.label && TONE.warn.value)}>{l.label ?? 'ไม่ได้บอกช่องทาง'}</TableCell>
                      <TableCell className="text-sm tabular-nums">{new Date(l.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{n(l.apps)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : null}
      <JourneyNamesDialog open={names !== null} onOpenChange={(o) => !o && setNames(null)} title={names?.title ?? ''} ids={names?.ids ?? []} />
    </div>
  );
}

/* ─────────── 4. จุดบอด ─────────── */

export function ValueGapsTab({ month }: { month: string }) {
  const { data, error, loading, retry } = useLoad<GapsResponse>(() => fetchValueGaps(month), [month]);
  if (error) return <LoadErrorNotice message={error} onRetry={retry} />;
  if (loading || !data) return <Loading />;
  const rows: Array<{ label: string; value: string; bad: boolean }> = [
    {
      label: 'ลิงก์ที่ไม่ได้บอกช่องทาง',
      value: `${n(data.linksTotal - data.linksWithChannel)} จาก ${n(data.linksTotal)} ลิงก์`,
      bad: data.linksTotal - data.linksWithChannel > 0,
    },
    {
      label: 'คนแจ้งเข้าที่ไม่รู้ช่องทาง',
      value: data.informedUnknownChannel == null ? NO_DATA : `${n(data.informedUnknownChannel)} จาก ${n(data.informedTotal)} คน`,
      bad: (data.informedUnknownChannel ?? 0) > 0,
    },
    {
      label: 'นัดที่เลยวันแล้วยังไม่ลงผลมา/ไม่มา',
      value: `${n(data.appointmentsNoResult)} จาก ${n(data.appointmentsDue)} นัด`,
      bad: data.appointmentsNoResult > 0,
    },
    {
      label: 'ในนั้นเบอร์ไปโผล่ใน iRecruit แล้ว (น่าจะมาแต่ไม่มีคนลงผล)',
      value: `${n(data.appointmentsLikelyCame)} นัด`,
      bad: data.appointmentsLikelyCame > 0,
    },
    {
      label: 'คนที่มาแล้วยังไม่ลงผลผ่าน/ไม่ผ่าน',
      value: `${n(data.showed - data.screened)} จาก ${n(data.showed)} คน`,
      bad: data.showed - data.screened > 0,
    },
    {
      label: 'ผู้สมัครที่หาใบแจ้งเข้า ERP ไม่เจอ',
      value: data.applicantsInformed == null ? NO_DATA : `${n(data.applicants - data.applicantsInformed)} จาก ${n(data.applicants)} คน`,
      bad: true,
    },
    { label: 'สายติดตามเดือนนี้ที่ไม่ผูกกับใบสมัคร', value: `${n(data.followAdded)} สาย`, bad: data.followAdded > 0 },
    { label: 'ไลฟ์สด · Call in', value: 'ยังไม่มีทางบันทึก', bad: true },
  ];
  return (
    <Card className="space-y-3 rounded-2xl p-4" data-testid="value-gaps">
      <h2 className="text-sm font-medium text-foreground">ขั้นที่ระบบยังมองไม่เห็น</h2>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
            <span>{r.label}</span>
            <span className={cn('tabular-nums', r.bad ? TONE.danger.value : TONE.success.value)}>{r.value}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
