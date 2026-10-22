/**
 * ═══ แท็บ "ใบขอ" ของหน้าหลัก — เส้นใบขอ 12 ขั้น · ค้าง · ค่าปรับ · ช่องทาง (เจ้าของ 22 ต.ค. 2569) ═══
 * > *"หน้าหลักฉันไม่สนนะว่านายจะออกแบบแบบไหนมา แต่ข้อมูลต้องครบ"* · Choice "ทำครบทั้ง 3 ก้อนรอบเดียว"
 * 1. ใบขอค้าง: เหลือกี่ใบ · ล่วงหน้า / ต่ำกว่า 30 / 30–60 / เกิน 60 วัน · ค่าปรับ + ลดมูลค่าสะสม
 * 2. เส้น 12 ขั้น: แต่ละขั้นมีกี่คน แยกผล · ติดขั้นนี้กี่ใบ (กดแล้วกรองตาราง)
 * 3. รายใบขอ: ผ่านมา · คนสนใจ · ติดขั้น · ส่งคนแทน · วันโดนปรับ · ค่าปรับ · ลดมูลค่า · กดใบ = เส้น 12 ขั้นของใบนั้น
 * 4. ช่องทาง: Facebook / TikTok / ออฟไลน์ … → กลุ่ม/Ads/เพจ → ชื่อ · ลงทะเบียน · ลงงาน
 * ใบขอ = ชุดเดียวกับเมนูใบขอ (`useUnitRequestsFeed`) · นับที่ `src/lib/requestPipeline.ts` · ทุกก้อนบวกกันลงตัวบนจอ
 * 🔴 shadcn Card/Button/Table/Badge · สีจาก TONE · ไม่มีประโยคอธิบายบนจอ · ว่างแล้วขึ้น 0 ไม่หาย
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HomeSection } from '@/components/home-ai-share/HomeSections';
import { useUnitRequestsFeed } from '@/hooks/useUnitRequestsFeed';
import { fetchRequestPipeline } from '@/lib/requestPipelineApi';
import {
  AGE_BUCKETS,
  PIPELINE_STEPS,
  buildPipelineRequests,
  summarizePipeline,
  type AgeBucket,
  type PipelineCounts,
  type PipelineRequest,
  type PipelineStepKey,
} from '@/lib/requestPipeline';
import { buildPlatforms, type PlatformKey } from '@/lib/channelPlatforms';
import type { RequestPipelineResponse } from '@/lib/requestPipelineTypes';
import { rangeText, thaiDate } from '@/lib/periodPick';
import { TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import { friendlyErrorText } from '@/lib/friendlyError';
import { jobBoardCardTitle } from '@/lib/unitRequestDisplay';
import { publicJobTitle } from '@/lib/publicJobTitle';

const NUM = new Intl.NumberFormat('th-TH');
const BAHT = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : NUM.format(n));

const BUCKET_TONE: Record<AgeBucket, ToneKey> = { advance: 'info', lt30: 'success', d30to60: 'warn', gt60: 'danger', unknown: 'neutral' };
const STEP_LABEL = new Map(PIPELINE_STEPS.map((s) => [s.key, s]));

type Filter = { kind: 'bucket'; key: AgeBucket } | { kind: 'stuck'; key: PipelineStepKey } | null;

/** ตัวเลขของขั้นในเส้น — หลัก (เลขใหญ่) + ก้อนย่อย */
function stepNumbers(key: PipelineStepKey, c: PipelineCounts, opts: { requests: number; released: number; replacedDays: number }) {
  const part = (label: string, value: number, tone: ToneKey) => ({ label, value, tone });
  switch (key) {
    case 'request':
      return { main: opts.requests, unit: 'ใบ', parts: [] };
    case 'released':
      return { main: opts.released, unit: 'ใบ', parts: [part('ยังไม่ประกาศ', opts.requests - opts.released, 'neutral')] };
    case 'apps':
      return { main: c.apps, unit: 'คน', parts: [] };
    case 'ai':
      return {
        main: c.aiCalled,
        unit: 'คน',
        parts: [
          part('สนใจ', c.aiYes, 'success'),
          part('ไม่สนใจ', c.aiNo, 'danger'),
          part('คนละพื้นที่', c.aiOutOfArea, 'orange'),
          part('ไม่รับสาย', c.aiNoPickup, 'warn'),
          part('ยังสรุปไม่ได้', c.aiOther, 'neutral'),
        ],
      };
    case 'staff':
      return {
        main: c.staffFollowed,
        unit: 'คน',
        parts: [part('ติดต่อได้', c.staffReached, 'success'), part('ติดต่อไม่ได้', c.staffFollowed - c.staffReached, 'danger')],
      };
    case 'interested':
      return {
        main: c.staffReached,
        unit: 'คน',
        parts: [
          part('สนใจ', c.interested, 'success'),
          part('ไม่สนใจ', c.notInterested, 'danger'),
          part('ยังไม่ระบุ', c.staffReached - c.interested - c.notInterested, 'neutral'),
        ],
      };
    case 'appointment':
      return { main: c.appointed, unit: 'คน', parts: [part('นัดไม่ได้', c.apptFailed, 'danger')] };
    case 'showed':
      return { main: c.showed, unit: 'คน', parts: [part('ไม่มา', c.noShow, 'danger')] };
    case 'passed':
      return { main: c.passed, unit: 'คน', parts: [part('ไม่ผ่าน', c.notPassed, 'danger')] };
    case 'follow':
      return { main: c.followStarts, unit: 'คน', parts: [part('ส่งคนแทน (วัน)', opts.replacedDays, 'teal')] };
    case 'aftercare':
      return { main: c.aftercare, unit: 'คน', parts: [] };
    case 'closed':
      return { main: null, unit: 'ใบ', parts: [part('ยังเปิด', opts.requests, 'neutral')] };
  }
}

function sumCounts(rows: readonly PipelineRequest[]): PipelineCounts {
  const out = {} as PipelineCounts;
  for (const r of rows) for (const [k, v] of Object.entries(r.counts)) out[k as keyof PipelineCounts] = (out[k as keyof PipelineCounts] ?? 0) + v;
  for (const k of Object.keys(rows[0]?.counts ?? {})) out[k as keyof PipelineCounts] ??= 0;
  return out;
}

const EMPTY_COUNTS: PipelineCounts = {
  apps: 0, aiCalled: 0, aiYes: 0, aiNo: 0, aiOutOfArea: 0, aiNoPickup: 0, aiOther: 0, staffCalled: 0, staffFollowed: 0, staffReached: 0,
  interested: 0, notInterested: 0, appointed: 0, apptFailed: 0, showed: 0, noShow: 0, passed: 0, notPassed: 0, followStarts: 0, aftercare: 0,
};

/** เส้น 12 ขั้น — ใช้ทั้งภาพรวมและรายใบ */
function StepLine({
  counts,
  requests,
  released,
  replacedDays,
  stuckCount,
  onStuck,
  activeStuck,
  stuckOf,
}: {
  counts: PipelineCounts;
  requests: number;
  released: number;
  replacedDays: number;
  stuckCount?: Record<PipelineStepKey, number>;
  onStuck?: (k: PipelineStepKey) => void;
  activeStuck?: PipelineStepKey | null;
  /** รายใบ: ขั้นที่ใบนี้ติด */
  stuckOf?: PipelineStepKey;
}) {
  return (
    <ol className="divide-y divide-foreground/10" data-testid="req-steps-list">
      {PIPELINE_STEPS.map((s) => {
        const n = stepNumbers(s.key, counts, { requests, released, replacedDays });
        const stuckHere = stuckCount?.[s.key] ?? 0;
        return (
          <li key={s.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2" data-testid={`req-step-${s.key}`}>
            <span className="flex w-56 shrink-0 items-center gap-2 text-sm text-foreground">
              <span className="w-6 text-right tabular-nums text-muted-foreground">{s.no}</span>
              {s.label}
              {stuckOf === s.key ? <Badge variant="destructive">ติดตรงนี้</Badge> : null}
            </span>
            <span className="w-24 shrink-0 text-right text-lg font-medium tabular-nums text-foreground">
              {n.main === null ? '—' : fmt(n.main)} <span className="text-xs font-normal text-muted-foreground">{n.unit}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-wrap gap-x-3 gap-y-1 text-sm tabular-nums">
              {n.parts.map((p) => (
                <span key={p.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <span className={cn('h-2 w-2 rounded-full', TONE[p.tone].dot)} aria-hidden />
                  {p.label} <span className="font-medium text-foreground">{fmt(p.value)}</span>
                </span>
              ))}
            </span>
            {onStuck && stuckCount && s.key !== 'request' && s.key !== 'closed' && s.key !== 'aftercare' ? (
              <Button
                type="button"
                variant={activeStuck === s.key ? 'default' : 'outline'}
                size="sm"
                className="shrink-0"
                disabled={stuckHere === 0}
                onClick={() => onStuck(s.key)}
                data-testid={`req-stuck-${s.key}`}
              >
                ติดขั้นนี้ {fmt(stuckHere)} ใบ
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/** ช่องทาง 3 ชั้น: แพลตฟอร์ม → ประเภท → ชื่อ */
function ChannelDrill({ data, sub }: { data: RequestPipelineResponse | null; sub: string }) {
  const [path, setPath] = useState<{ platform?: PlatformKey; type?: string }>({});
  const platforms = useMemo(() => (data?.channels ? buildPlatforms(data.channels) : null), [data]);
  const platform = platforms?.find((p) => p.key === path.platform) ?? null;
  const type = platform?.types.find((t) => t.channel === path.type) ?? null;
  const rows: Array<{ key: string; label: string; registered: number; placed: number; onClick?: () => void }> = !platforms
    ? []
    : type
      ? type.subs.map((s) => ({ key: s.name, label: s.name, registered: s.registered, placed: s.placed }))
      : platform
        ? platform.types.map((t) => ({ key: t.channel, label: t.channel, registered: t.registered, placed: t.placed, onClick: () => setPath({ platform: platform.key, type: t.channel }) }))
        : platforms.map((p) => ({ key: p.key, label: p.label, registered: p.registered, placed: p.placed, onClick: () => setPath({ platform: p.key }) }));
  const sumReg = rows.reduce((n, r) => n + r.registered, 0);
  const sumPlaced = rows.reduce((n, r) => n + r.placed, 0);
  return (
    <HomeSection title="ช่องทาง" sub={`${sub} · ลงงาน = แจ้งเข้าในช่วง`} testId="req-channels">
      <nav className="flex flex-wrap items-center gap-1 text-sm" data-testid="req-channels-trail">
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setPath({})}>
          ทุกช่องทาง
        </Button>
        {platform ? (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setPath({ platform: platform.key })}>
              {platform.label}
            </Button>
          </>
        ) : null}
        {type ? (
          <>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="text-foreground">{type.channel}</span>
          </>
        ) : null}
      </nav>
      {data?.errors.channels ? <p className={cn('text-sm', TONE.danger.value)}>{data.errors.channels}</p> : null}
      {!platforms && !data?.errors.channels ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto">
          <Table data-testid="req-channels-table">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ช่องทาง</TableHead>
                <TableHead className="text-right text-xs">ลงทะเบียน</TableHead>
                <TableHead className="text-right text-xs">ลงงาน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-4 text-center text-sm text-muted-foreground">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.key} data-testid={`req-channel-${r.key}`}>
                    <TableCell className="text-sm">
                      {r.onClick ? (
                        <Button type="button" variant="link" size="sm" className="h-auto whitespace-normal p-0 text-left" onClick={r.onClick}>
                          {r.label}
                        </Button>
                      ) : (
                        <span className="text-foreground">{r.label}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.registered)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{fmt(r.placed)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {platforms ? (
        <p className="text-xs tabular-nums text-muted-foreground" data-testid="req-channels-sum">
          รวม ลงทะเบียน {fmt(sumReg)} · ลงงาน {fmt(sumPlaced)}
          {!platform && data?.channels ? ` · แจ้งเข้าทั้งหมด ${fmt(data.channels.informed)} คน` : ''}
        </p>
      ) : null}
    </HomeSection>
  );
}

const HomeRequestsTab: React.FC<{ win: { from: string | null; to: string | null }; tick: number }> = ({ win, tick }) => {
  const feed = useUnitRequestsFeed();
  const [data, setData] = useState<RequestPipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [limit, setLimit] = useState(30);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetchRequestPipeline(win)
      .then((d) => alive && setData(d))
      .catch((e: unknown) => alive && setError(friendlyErrorText(e, 'โหลดเส้นใบขอไม่ขึ้น')));
    return () => {
      alive = false;
    };
  }, [win, tick]);

  const ready = Boolean(data) && feed.feedState !== 'loading' && feed.feedState !== 'failed' && feed.feedState !== 'forbidden';
  const rows = useMemo(() => (data && ready ? buildPipelineRequests(feed.jobs, data) : []), [data, ready, feed.jobs]);
  const sum = useMemo(() => summarizePipeline(rows), [rows]);
  const allCounts = useMemo(() => (rows.length ? sumCounts(rows) : EMPTY_COUNTS), [rows]);
  const released = rows.filter((r) => r.released).length;
  const shown = useMemo(() => {
    const list = rows.filter((r) => !filter || (filter.kind === 'bucket' ? r.bucket === filter.key : r.stuck === filter.key));
    return [...list].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1));
  }, [rows, filter]);
  const sub = win.from && win.to ? rangeText(win.from, win.to) : 'ทุกวัน';
  const pick = (f: Filter) => {
    setFilter((cur) => (cur && f && cur.kind === f.kind && cur.key === f.key ? null : f));
    setLimit(30);
  };
  const dash = (v: number) => (ready ? fmt(v) : '—');

  return (
    <div className="space-y-5" data-testid="home-requests">
      {error || feed.loadError ? (
        <p className={cn('text-sm', TONE.danger.value)} data-testid="req-error">
          {error ?? feed.loadError}
        </p>
      ) : null}

      {/* 1. ใบขอค้าง */}
      <HomeSection title="ใบขอค้าง" sub="ณ วันนี้ · นับวันทำงานแบบเมนูใบขอ" testId="req-summary">
        <p className="flex items-baseline gap-2">
          <span className="text-sm text-muted-foreground">เหลือ</span>
          <span className="text-3xl font-medium tabular-nums text-primary" data-testid="req-total">
            {dash(sum.total)}
          </span>
          <span className="text-sm text-muted-foreground">ใบ</span>
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {AGE_BUCKETS.map((b) => (
            <Button
              key={b.key}
              type="button"
              variant={filter?.kind === 'bucket' && filter.key === b.key ? 'default' : 'outline'}
              className="h-auto flex-col items-start gap-1 rounded-xl p-3 text-left font-normal"
              onClick={() => pick({ kind: 'bucket', key: b.key })}
              data-testid={`req-bucket-${b.key}`}
            >
              <span className="flex items-center gap-1.5 text-xs">
                <span className={cn('h-2 w-2 rounded-full', TONE[BUCKET_TONE[b.key]].dot)} aria-hidden />
                {b.label}
              </span>
              <span className="text-xl font-medium tabular-nums">{dash(sum.buckets[b.key])}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs tabular-nums text-muted-foreground" data-testid="req-bucket-sum">
          {AGE_BUCKETS.map((b) => `${dash(sum.buckets[b.key])}`).join(' + ')} = {dash(sum.total)} ใบ
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(
            [
              ['ค่าปรับสะสม', `${ready ? BAHT.format(sum.fine) : '—'} บาท`, 'req-fine'],
              ['ลดมูลค่าสะสม', `${ready ? BAHT.format(sum.deduct) : '—'} บาท`, 'req-deduct'],
              ['วันโดนปรับรวม', `${dash(sum.penaltyDays)} วัน`, 'req-penalty-days'],
              ['ส่งคนแทนได้รวม', `${dash(sum.replacedDays)} วัน`, 'req-replaced-days'],
            ] as const
          ).map(([label, value, id]) => (
            <Card key={id} variant="solid" className="space-y-1 rounded-xl p-3" data-testid={id}>
              <span className="block text-xs text-muted-foreground">{label}</span>
              <span className="block text-lg font-medium tabular-nums text-foreground">{value}</span>
            </Card>
          ))}
        </div>
        {data?.replacementSince ? (
          <p className="text-xs text-muted-foreground" data-testid="req-replacement-since">
            ส่งคนแทนมีข้อมูลตั้งแต่ {thaiDate(data.replacementSince)}
          </p>
        ) : null}
      </HomeSection>

      {/* 2. เส้น 12 ขั้น */}
      <HomeSection title="เส้นใบขอ 12 ขั้น" sub="ใบที่ยังเปิดทั้งหมด · คนนับทุกช่วงเวลา" testId="req-steps">
        {ready ? (
          <StepLine
            counts={allCounts}
            requests={sum.total}
            released={released}
            replacedDays={sum.replacedDays}
            stuckCount={sum.stuck}
            onStuck={(k) => pick({ kind: 'stuck', key: k })}
            activeStuck={filter?.kind === 'stuck' ? filter.key : null}
          />
        ) : (
          <Skeleton className="h-80 w-full rounded-xl" />
        )}
        <p className="text-xs tabular-nums text-muted-foreground" data-testid="req-stuck-sum">
          ติดขั้น {PIPELINE_STEPS.filter((s) => sum.stuck[s.key] > 0).map((s) => `${s.no}:${fmt(sum.stuck[s.key])}`).join(' + ') || '0'} = {dash(sum.total)} ใบ
        </p>
      </HomeSection>

      {/* 3. รายใบขอ */}
      <HomeSection
        title="รายใบขอ"
        sub={
          filter
            ? filter.kind === 'bucket'
              ? AGE_BUCKETS.find((b) => b.key === filter.key)?.label
              : `ติดขั้น ${STEP_LABEL.get(filter.key)?.no} ${STEP_LABEL.get(filter.key)?.label}`
            : 'ทุกใบ · ค้างนานสุดก่อน'
        }
        testId="req-table"
        right={
          filter ? (
            <Button type="button" variant="outline" size="sm" onClick={() => pick(null)} data-testid="req-filter-clear">
              ดูทุกใบ
            </Button>
          ) : null
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">ใบขอ</TableHead>
                <TableHead className="text-right text-xs">ผ่านมา</TableHead>
                <TableHead className="text-right text-xs">คนสนใจ</TableHead>
                <TableHead className="text-xs">ติดขั้น</TableHead>
                <TableHead className="text-right text-xs">ส่งคนแทน</TableHead>
                <TableHead className="text-right text-xs">วันโดนปรับ</TableHead>
                <TableHead className="text-right text-xs">ค่าปรับ</TableHead>
                <TableHead className="text-right text-xs">ลดมูลค่า</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!ready ? (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-24 w-full rounded-xl" />
                  </TableCell>
                </TableRow>
              ) : shown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-4 text-center text-sm text-muted-foreground">
                    ไม่มีใบขอ
                  </TableCell>
                </TableRow>
              ) : (
                shown.slice(0, limit).map((r) => {
                  const open = openRow === r.jobId;
                  const step = STEP_LABEL.get(r.stuck);
                  return (
                    <React.Fragment key={r.jobId}>
                      <TableRow data-testid={`req-row-${r.requestNo}`}>
                        <TableCell className="text-sm">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto items-start gap-2 whitespace-normal p-0 text-left font-normal"
                            onClick={() => setOpenRow(open ? null : r.jobId)}
                            aria-expanded={open}
                          >
                            <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 transition-transform', !open && '-rotate-90')} aria-hidden />
                            <span>
                              <span className="block text-foreground">{`${jobBoardCardTitle(r.job)} · ${publicJobTitle(r.job)}`}</span>
                              <span className="text-xs tabular-nums text-muted-foreground">{r.requestNo}</span>
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                          {r.advance ? <Badge variant="secondary">ล่วงหน้า</Badge> : r.ageDays === null ? '—' : `${fmt(r.ageDays)} วัน`}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmt(r.counts.aiYes)}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {step ? `${step.no}. ${step.stuck}` : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{r.replacedDays > 0 ? `${fmt(r.replacedDays)} วัน` : '0'}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.penaltyDays === null ? '—' : `${fmt(r.penaltyDays)} วัน`}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.finePerDay > 0 ? BAHT.format(r.fine) : <span className="text-muted-foreground">ไม่มี</span>}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.deductPerDay > 0 ? BAHT.format(r.deduct) : <span className="text-muted-foreground">ไม่มี</span>}</TableCell>
                      </TableRow>
                      {open ? (
                        <TableRow data-testid={`req-detail-${r.requestNo}`}>
                          <TableCell colSpan={8} className="bg-muted/40">
                            <div className="space-y-2 p-2">
                              <p className="text-xs tabular-nums text-muted-foreground">
                                {r.advance ? 'ล่วงหน้า' : `ผ่านมา ${fmt(r.ageDays)} วัน − ส่งคนแทน ${fmt(r.replacedDays)} วัน = โดนปรับ ${fmt(r.penaltyDays)} วัน`}
                                {r.finePerDay > 0 ? ` · ค่าปรับ ${NUM.format(r.finePerDay)}/วัน` : ''}
                                {r.deductPerDay > 0 ? ` · ลดมูลค่า ${NUM.format(r.deductPerDay)}/วัน` : ''}
                              </p>
                              <StepLine
                                counts={r.counts}
                                requests={1}
                                released={r.released ? 1 : 0}
                                replacedDays={r.replacedDays}
                                stuckOf={r.stuck}
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums text-muted-foreground">
          <span data-testid="req-shown">
            แสดง {fmt(Math.min(limit, shown.length))} จาก {fmt(shown.length)} ใบ
          </span>
          {shown.length > limit ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setLimit((n) => n + 30)} data-testid="req-more">
              ดูเพิ่ม
            </Button>
          ) : null}
        </div>
      </HomeSection>

      {/* 4. ช่องทาง */}
      <ChannelDrill data={data} sub={sub} />
    </div>
  );
};

export default HomeRequestsTab;
