/**
 * ═══ ส่วนรายละเอียดของหน้าทีม Online — ใช้ทั้งในแท็บล่างและในแผงด้านขวาตอนกดการ์ด (29 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"การ์ดพวก คนใช้งาน · ทุก BU ฉันกดไปไม่มีไรเลย"* → Choice แผงเลื่อนออกด้านขวา ·
 * *"มีรายชื่อมา มาจากไหน มาแล้วยังไง แล้วใบที่ยังไม่มาเยอะแค่ไหน นานแค่ไหน แต่ละ bu เป็นยังไง"*
 * ⇒ ส่วนใหม่ "ผู้สมัคร" (มาจากไหน · มาแล้วยังไง — ถังเดียวกับศูนย์คุมงานสรรหา) + "ใบยังไม่มีผู้สมัคร" (เลนเดียวกับกล่องงาน + อายุใบ)
 *
 * วาดอย่างเดียว — ตัวเลขทั้งหมดมาจาก `/api/team-online` · ป้ายจากพจนานุกรมเลข / ตัวคิด (`APPLICANT_STAGES` · `AGE_BUCKETS`)
 * 🔴 ปุ่มพาไปหน้าอื่นพาไป "ชุดเดียวกับเลข" เสมอ (กล่องงาน `?lane=` · หน้ารายชื่อ `?bucket=`) — กดแล้วต้องเจอเลขเท่ากัน
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { boardPostingPath } from '@/lib/jobNavigation';
import { METRICS, metricHelp, type MetricKey } from '@/lib/metricDictionary';
import { REFERRAL_SOURCE_LABEL, type ApplicationReferralSource } from '@/lib/publicApplicationsApi';
import {
  AGE_BUCKETS,
  APPLICANT_STAGES,
  FUNNEL_STAGES,
  TEAM_LANES,
  TEAM_ROLES,
  countDelta,
  emptyLumosStats,
  fmtPct,
  rateDelta,
  ratio,
  successRate,
  type ApplicantStage,
  type TeamLumosSeriesKey,
  type TeamLumosStats,
  type TeamOnlineResponse,
} from '@/lib/teamOnline';
import { TREND_GRAIN_LABEL } from '@/lib/trends/timeBuckets';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import type { JobRequest } from '@/types';
import BuTrendChart, { type BuTrendSeries } from './BuTrendChart';
import { LANE_TONE, toneOfBu } from './teamOnlineTones';

const NUM = new Intl.NumberFormat('th-TH');
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));

type Data = TeamOnlineResponse;

/* ─────────────── ชิ้นส่วนร่วม ─────────────── */

function Head({ metric, suffix, className }: { metric: MetricKey; suffix?: string; className?: string }) {
  return (
    <TableHead className={cn('text-right text-xs', className)} title={metricHelp(metric)}>
      {METRICS[metric].label}
      {suffix ?? ` (${METRICS[metric].unit})`}
    </TableHead>
  );
}

function Num({ children, strong, className }: { children: React.ReactNode; strong?: boolean; className?: string }) {
  return (
    <TableCell className={cn('text-right text-sm tabular-nums', strong ? DASH.cellStrong : DASH.cell, className)}>{children}</TableCell>
  );
}

function BuCell({ label, bu, indent }: { label: string; bu: string | null; indent?: React.ReactNode }) {
  return (
    <TableCell className="text-sm">
      {bu === null ? (
        <span className="font-medium text-foreground">รวม</span>
      ) : indent ? (
        <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap pl-3 text-xs', DASH.muted)}>{indent}</span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-foreground" title={label}>
          <span className={cn('inline-block h-2 w-2 rounded-full bg-current', bu ? TONE[toneOfBu(bu)].value : DASH.muted)} aria-hidden />
          {bu || label}
        </span>
      )}
    </TableCell>
  );
}

export function Section({
  title,
  buBadge,
  right,
  children,
  foot,
}: {
  title: string;
  buBadge: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <Badge variant="secondary" className="text-xs">
            {buBadge}
          </Badge>
        </div>
        {right}
      </div>
      {children}
      {foot ? <p className={cn('text-xs', DASH.muted)}>{foot}</p> : null}
    </Card>
  );
}

/** แถบแนวนอน: ป้าย · แถบสัดส่วน · จำนวน (+ % ) · ปุ่มไปดูรายชื่อ (ถ้ามี) */
function BarRow({
  label,
  count,
  total,
  tone,
  href,
  hrefLabel = 'ดูรายชื่อ',
}: {
  label: string;
  count: number;
  total: number;
  tone: ToneKey;
  href?: string;
  hrefLabel?: string;
}) {
  const share = ratio(count, total);
  const go = href && count > 0 ? href : null;
  return (
    <div className="grid grid-cols-12 items-center gap-2">
      {go ? (
        <Link to={go} className={cn('col-span-4 truncate text-xs underline-offset-2 hover:underline', TONE.primary.value)} title={`${label} · ${hrefLabel}`}>
          {label}
        </Link>
      ) : (
        <span className="col-span-4 truncate text-xs text-foreground" title={label}>
          {label}
        </span>
      )}
      <div className="col-span-5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full bg-current', TONE[tone].value)} style={{ width: `${Math.min(100, (share ?? 0) * 100)}%` }} />
      </div>
      <span className="col-span-2 text-right text-xs tabular-nums text-foreground">
        {NUM.format(count)}
        <span className={cn('ml-1', DASH.muted)}>{share === null ? '' : `${Math.round(share * 100)}%`}</span>
      </span>
      <span className="col-span-1 text-right">
        {go ? (
          <Link to={go} className={cn('text-xs', TONE.primary.value)} title={hrefLabel} aria-label={`${label} · ${hrefLabel}`}>
            ›
          </Link>
        ) : null}
      </span>
    </div>
  );
}

/** ชั่วโมงรอ → ข้อความสั้น (นาที/ชั่วโมง/วัน) */
function waitText(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${NUM.format(Math.max(1, Math.round(hours * 60)))} นาที`;
  if (hours < 48) return `${NUM.format(Math.round(hours))} ชั่วโมง`;
  return `${NUM.format(Math.round(hours / 24))} วัน`;
}

const pickBu = <T extends { bu: string }>(data: Data | null, rows: ReadonlyArray<T> | null | undefined): T[] =>
  (rows ?? []).filter((r) => !data?.bu || r.bu === data.bu);
const chartOf = <T extends { bu: string; label: string }>(
  rows: ReadonlyArray<T> | null | undefined,
  values: (r: T) => ReadonlyArray<number | null>,
): BuTrendSeries[] => (rows ?? []).filter((r) => r.bu !== '').map((r) => ({ bu: r.bu, label: r.label, values: values(r) }));
const empty = (msg: string) => <p className={cn('py-6 text-center text-sm', DASH.muted)}>{msg}</p>;
const buBadgeOf = (data: Data | null) => data?.bu ?? 'ทุก BU';

function chartFootOf(data: Data | null): string | null {
  const w = data?.window;
  if (!w) return null;
  return `ราย${TREND_GRAIN_LABEL[w.grain]} · แท่ง = แต่ละ BU · เส้นประ = แนวโน้ม${
    w.lastBucketOpen && w.buckets.length > 1 ? ' · ช่วงสุดท้ายยังไม่จบ ไม่นับในเส้นแนวโน้ม' : ''
  }`;
}

/* ─────────────── คนใช้งาน ─────────────── */

const ROLE_LABEL = new Map(TEAM_ROLES.map((r) => [r.key, r.label]));
const TH_DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });

export function UsersSection({ data, loading }: { data: Data | null; loading: boolean }) {
  const w = data?.window ?? null;
  const users = pickBu(data, data?.users?.byBu);
  const total = users.reduce((s, r) => ({ accounts: s.accounts + r.accounts, users: s.users + r.users }), { accounts: 0, users: 0 });
  const people = data?.people ? data.people.filter((p) => !data.bu || p.bu === data.bu) : null;
  return (
    <Section title="คนใช้งานต่อ BU · % ของบัญชีใน BU" buBadge={buBadgeOf(data)} foot={chartFootOf(data)}>
      {w ? (
        <BuTrendChart
          buckets={w.buckets}
          series={chartOf(data?.users?.byBu, (r) => r.series)}
          lastOpen={w.lastBucketOpen}
          format={(v) => fmtPct(v)}
          asPct
          selected={data?.bu ?? null}
          ariaLabel="คนใช้งานต่อ BU เป็นเปอร์เซ็นต์ของบัญชี"
        />
      ) : null}
      {!data?.users ? (
        empty(data?.errors.users ?? (loading ? 'กำลังโหลด…' : '—'))
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">BU</TableHead>
              <Head metric="teamOnline.accounts" />
              <Head metric="teamOnline.users" />
              <Head metric="teamOnline.usersPct" suffix=" (%)" />
              <TableHead className="text-right text-xs">เทียบช่วงก่อน</TableHead>
              <TableHead className="text-xs">แยกบทบาท (ใช้ / บัญชี)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((r) => (
              <TableRow key={r.bu || 'unknown'}>
                <BuCell label={r.label} bu={r.bu} />
                <Num>{n(r.accounts)}</Num>
                <Num>{n(r.users)}</Num>
                <Num strong>{r.accounts === 0 ? '—' : fmtPct(r.pct)}</Num>
                <Num className={DASH.muted}>{r.accounts === 0 ? '—' : rateDelta(r.pct, r.prevPct).text}</Num>
                <TableCell className={cn('text-xs', DASH.muted)}>
                  {r.accounts === 0 ? (
                    <span className={TONE.danger.value}>ยังไม่มีบัญชีในระบบ</span>
                  ) : (
                    r.roles.map((x) => `${x.label} ${NUM.format(x.users)}/${NUM.format(x.accounts)}`).join(' · ')
                  )}
                </TableCell>
              </TableRow>
            ))}
            {users.length > 1 ? (
              <TableRow>
                <BuCell label="รวม" bu={null} />
                <Num strong>{n(total.accounts)}</Num>
                <Num strong>{n(total.users)}</Num>
                <Num strong>{fmtPct(ratio(total.users, total.accounts))}</Num>
                <Num>{''}</Num>
                <TableCell />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
      {people ? <PeopleList people={people} /> : null}
    </Section>
  );
}

/** รายชื่อคนใช้งาน (เฉพาะหัวหน้า/admin — เซิร์ฟเวอร์ส่งมาเฉพาะคนที่มีสิทธิ์) · คนที่ยังไม่ใช้ขึ้นก่อน */
function PeopleList({ people }: { people: NonNullable<Data['people']> }) {
  const idle = people.filter((p) => p.days === 0).length;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        รายชื่อ · ยังไม่ได้ใช้ในช่วงนี้ {NUM.format(idle)} จาก {NUM.format(people.length)} คน
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">ชื่อ</TableHead>
            <TableHead className="text-xs">BU</TableHead>
            <TableHead className="text-xs">บทบาท</TableHead>
            <TableHead className="text-right text-xs">ใช้กี่วัน</TableHead>
            <TableHead className="text-right text-xs">ใช้ล่าสุด</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="text-sm text-foreground">{p.name}</TableCell>
              <TableCell className={cn('text-xs', DASH.muted)}>{p.bu || 'ไม่ระบุ BU'}</TableCell>
              <TableCell className={cn('text-xs', DASH.muted)}>{ROLE_LABEL.get(p.role) ?? p.role}</TableCell>
              <Num strong={p.days === 0} className={p.days === 0 ? TONE.danger.value : undefined}>
                {p.days === 0 ? 'ไม่ได้ใช้' : NUM.format(p.days)}
              </Num>
              <Num className={DASH.muted}>{p.lastYmd ? TH_DAY.format(new Date(`${p.lastYmd}T12:00:00+07:00`)) : '—'}</Num>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─────────────── ใบขอเข้า (อัตรา) ─────────────── */

export function RequestsSection({ data, loading }: { data: Data | null; loading: boolean }) {
  const w = data?.window ?? null;
  const reqs = pickBu(data, data?.requests?.byBu);
  const openBy = new Map((data?.byBu ?? []).map((r) => [r.bu, r]));
  const laneBy = new Map((data?.lanes?.byBu ?? []).map((r) => [r.bu, r]));
  const bus = [...new Set([...reqs.map((r) => r.bu), ...pickBu(data, data?.byBu).map((r) => r.bu)])];
  return (
    <Section title="อัตราที่ขอเข้าต่อ BU" buBadge={buBadgeOf(data)} foot={chartFootOf(data)}>
      {w ? (
        <BuTrendChart
          buckets={w.buckets}
          series={chartOf(data?.requests?.byBu, (r) => r.series)}
          lastOpen={w.lastBucketOpen}
          format={(v) => NUM.format(Math.round(v))}
          selected={data?.bu ?? null}
          ariaLabel="อัตราที่ขอเข้าต่อ BU"
        />
      ) : null}
      {!data?.requests ? (
        empty(data?.errors.requests ?? (loading ? 'กำลังโหลด…' : '—'))
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">BU</TableHead>
              <Head metric="teamOnline.positionsIn" />
              <Head metric="teamOnline.requestsIn" />
              <TableHead className="text-right text-xs">เทียบช่วงก่อน</TableHead>
              <Head metric="teamOnline.openNow" />
              <Head metric="teamOnline.remaining" />
              <Head metric="teamOnline.laneSourcing" />
              <Head metric="teamOnline.laneSilent" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bus.map((b) => {
              const r = reqs.find((x) => x.bu === b);
              const o = openBy.get(b);
              const l = laneBy.get(b);
              return (
                <TableRow key={b || 'unknown'}>
                  <BuCell label={r?.label ?? o?.label ?? b} bu={b} />
                  <Num strong>{n(r?.positions.cur ?? 0)}</Num>
                  <Num>{n(r?.requests.cur ?? 0)}</Num>
                  <Num className={DASH.muted}>{r ? countDelta(r.positions.cur, r.positions.prev, 'อัตรา').text : '—'}</Num>
                  <Num>{n(o?.openNow)}</Num>
                  <Num>{n(o?.remaining)}</Num>
                  <Num>{n(l?.sourcing)}</Num>
                  <Num>{n(l?.silent)}</Num>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/* ─────────────── ผู้สมัคร: มาจากไหน · มาแล้วยังไง ─────────────── */

/** สีตามความหมายกลาง (designTokens): รอคนทำต่อ = เหลือง · ส่ง AI โทร = น้ำเงิน · ติดขัด = แดง · สนใจ/นัดได้ = เขียว */
const STAGE_TONE: Record<ApplicantStage, ToneKey> = {
  untouched: 'warn',
  held: 'neutral',
  in_queue: 'primary',
  contact_failed: 'danger',
  success_unscheduled: 'warn',
  scheduled: 'success',
};

const sourceLabel = (key: string) =>
  key ? (REFERRAL_SOURCE_LABEL[key as ApplicationReferralSource] ?? key) : 'ไม่ระบุ';
const listHref = (bucket: string) => `/jobs/board?view=list&bucket=${bucket}`;

export function ApplicantsSection({ data, loading }: { data: Data | null; loading: boolean }) {
  const a = data?.applicants ?? null;
  if (!a) {
    return (
      <Section title="ผู้สมัคร · มาจากไหน · มาแล้วยังไง" buBadge={buBadgeOf(data)}>
        {empty(data?.errors.applicants ?? (loading ? 'กำลังโหลด…' : '—'))}
      </Section>
    );
  }
  const total = a.total.cur;
  const sources = Object.entries(a.sources).sort((x, y) => y[1] - x[1]);
  const byBu = pickBu(data, a.byBu);
  const backlogTotal = APPLICANT_STAGES.reduce((s, st) => s + a.backlog.stages[st.key], 0);
  // หน้ารายชื่อไม่มีตัวกรอง BU — ปุ่ม › ขึ้นเฉพาะตอนที่เลขบนหน้านี้ = ประชากรของหน้ารายชื่อ (กดแล้วต้องเจอเลขเท่ากัน)
  const linkable = !data?.bu || data.bu === data.forced_bu;
  return (
    <Section
      title="ผู้สมัคร · มาจากไหน · มาแล้วยังไง"
      buBadge={buBadgeOf(data)}
      foot={`ถังเดียวกับศูนย์คุมงานสรรหา (ไม่ทับกัน รวมได้ทั้งหมด) · ช่องทาง = ที่ผู้สมัครเลือกเองว่ารู้จักเราจากไหน · ${
        linkable ? 'กดชื่อถังเพื่อเปิดรายชื่อ' : 'กดเปิดรายชื่อได้ตอนดูทุก BU (หน้ารายชื่อไม่แยก BU)'
      }`}
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-foreground">
          ผู้สมัครใหม่ช่วงนี้ <span className="font-medium tabular-nums">{n(total)}</span> ใบ
        </span>
        <span className={DASH.muted}>
          ได้สายแรกหลังสมัคร (ค่ากลาง) <span className="tabular-nums text-foreground">{waitText(a.waitMedianHours)}</span>
        </span>
        {a.leads > 0 ? <span className={DASH.muted}>ปัดเป็น Lead {n(a.leads)} ใบ</span> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">มาจากไหน (ช่วงนี้)</p>
          {sources.length === 0 ? empty('ยังไม่มีผู้สมัครในช่วงนี้') : null}
          {sources.map(([key, count]) => (
            <BarRow key={key || 'none'} label={sourceLabel(key)} count={count} total={total} tone="info" />
          ))}
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">มาแล้วยังไง (ผู้สมัครช่วงนี้)</p>
          {APPLICANT_STAGES.map((st) => (
            <BarRow key={st.key} label={st.label} count={a.stages[st.key]} total={total} tone={STAGE_TONE[st.key]} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">งานค้างตอนนี้ (ทุกวันที่สมัคร)</p>
        {APPLICANT_STAGES.map((st) => (
          <BarRow
            key={st.key}
            label={st.label}
            count={a.backlog.stages[st.key]}
            total={backlogTotal}
            tone={STAGE_TONE[st.key]}
            href={linkable ? listHref(st.key) : undefined}
          />
        ))}
        <BarRow
          label="ยังไม่ถูกโทรเกิน 5 วัน"
          count={a.backlog.over5d}
          total={backlogTotal}
          tone="danger"
          href={linkable ? listHref('over5d') : undefined}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">BU</TableHead>
            <Head metric="teamOnline.applicantsIn" />
            {APPLICANT_STAGES.map((st) => (
              <TableHead key={st.key} className="text-right text-xs">
                {st.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs">ยังไม่ถูกโทรเกิน 5 วัน</TableHead>
            <TableHead className="text-right text-xs">ได้สายแรก (ค่ากลาง)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {byBu.map((r) => (
            <TableRow key={r.bu || 'unknown'}>
              <BuCell label={r.label} bu={r.bu} />
              <Num strong>{n(r.total.cur)}</Num>
              {APPLICANT_STAGES.map((st) => (
                <Num key={st.key}>{n(r.stages[st.key])}</Num>
              ))}
              <Num>{n(r.over5d)}</Num>
              <Num className={DASH.muted}>{waitText(r.waitMedianHours)}</Num>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  );
}

/* ─────────────── ใบยังไม่มีผู้สมัคร: เยอะแค่ไหน · นานแค่ไหน ─────────────── */

const TH_NUM_DAYS = (d: number | null) => (d === null ? '—' : `${NUM.format(d)} วัน`);

/**
 * ลิงก์ไปหน้าประกาศของใบ — 🔴 ต้องผ่าน `boardPostingPath` ตัวเดียวกับกล่องงาน
 * (ใบขอล่วงหน้าต้องพก prefix `siamraj-pre:` · ใบปกติใช้เลขฝั่ง ERP — ประกอบเองเคยเปิดผิดบริษัท)
 */
const postingPathOf = (j: { id: string; externalId: string | null }) =>
  boardPostingPath({ id: j.id, externalId: j.externalId ?? undefined } as JobRequest);

export function NoApplicantsSection({ data, loading, limit = 30 }: { data: Data | null; loading: boolean; limit?: number }) {
  const l = data?.lanes ?? null;
  if (!l) {
    return (
      <Section title="ใบยังไม่มีผู้สมัคร · เยอะแค่ไหน · ค้างนานแค่ไหน" buBadge={buBadgeOf(data)}>
        {empty(data?.errors.lanes ?? (loading ? 'กำลังโหลด…' : '—'))}
      </Section>
    );
  }
  const t = l.total;
  const needPeople = t.sourcing + t.applied + t.silent;
  const rows = pickBu(data, l.byBu);
  return (
    <Section
      title="ใบยังไม่มีผู้สมัคร · เยอะแค่ไหน · ค้างนานแค่ไหน"
      buBadge={buBadgeOf(data)}
      foot="นับแบบเดียวกับกล่องงาน (ใบเปิดตอนนี้) · อายุ = นับจากวันที่ของใบขอ · ใบที่ค้างนานมาก ๆ ควรตรวจว่ายังต้องการคนไหม"
      right={
        <div className="flex flex-wrap gap-2">
          <Button asChild size="xs" variant="outline">
            <Link to={METRICS['teamOnline.laneSourcing'].href}>{METRICS['teamOnline.laneSourcing'].label}</Link>
          </Button>
          <Button asChild size="xs" variant="outline">
            <Link to={METRICS['teamOnline.laneSilent'].href}>{METRICS['teamOnline.laneSilent'].label}</Link>
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span className="text-foreground">
          ยังไม่มีผู้สมัครเลย <span className="font-medium tabular-nums">{n(t.noApplicants)}</span> ใบ
          <span className={cn('ml-1', DASH.muted)}>จากใบที่ยังต้องหาคน {n(needPeople)} ใบ</span>
        </span>
        <span className={DASH.muted}>
          ค้างนานสุด <span className="tabular-nums text-foreground">{TH_NUM_DAYS(t.oldestDays)}</span>
        </span>
      </div>
      <div className="space-y-2">
        {AGE_BUCKETS.map((b) => (
          <BarRow
            key={b.key}
            label={`ค้าง ${b.label}`}
            count={t.aging[b.key] ?? 0}
            total={t.noApplicants}
            tone={b.max > 30 ? 'danger' : b.max > 7 ? 'warn' : 'neutral'}
          />
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">BU</TableHead>
            <TableHead className="text-right text-xs">ใบเปิด</TableHead>
            <Head metric="teamOnline.laneSourcing" />
            <Head metric="teamOnline.lanePublish" />
            <Head metric="teamOnline.laneSilent" />
            <Head metric="teamOnline.noApplicants" />
            {AGE_BUCKETS.map((b) => (
              <TableHead key={b.key} className="text-right text-xs">
                {b.label}
              </TableHead>
            ))}
            <TableHead className="text-right text-xs">นานสุด</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.bu || 'unknown'}>
              <BuCell label={r.label} bu={r.bu} />
              <Num>{n(r.open)}</Num>
              <Num>{n(r.sourcing)}</Num>
              <Num>{n(r.publish)}</Num>
              <Num>{n(r.silent)}</Num>
              <Num strong>{n(r.noApplicants)}</Num>
              {AGE_BUCKETS.map((b) => (
                <Num key={b.key} className={b.max > 30 && (r.aging[b.key] ?? 0) > 0 ? TONE.danger.value : undefined}>
                  {n(r.aging[b.key] ?? 0)}
                </Num>
              ))}
              <Num className={DASH.muted}>{TH_NUM_DAYS(r.oldestDays)}</Num>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {l.oldest.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">ค้างนานสุด {NUM.format(Math.min(limit, l.oldest.length))} ใบแรก — กดเพื่อไปทำใบนั้นต่อ</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">เลขที่ใบ</TableHead>
                <TableHead className="text-xs">หน่วยงาน</TableHead>
                <TableHead className="text-xs">BU</TableHead>
                <TableHead className="text-right text-xs">อัตรา</TableHead>
                <TableHead className="text-right text-xs">ค้าง</TableHead>
                <TableHead className="text-xs">สถานะ</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {l.oldest.slice(0, limit).map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="whitespace-nowrap text-xs tabular-nums text-foreground">{j.requestNo}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-foreground" title={j.unit}>
                    {j.unit || '—'}
                  </TableCell>
                  <TableCell className={cn('text-xs', DASH.muted)}>{j.bu || 'ไม่ระบุ BU'}</TableCell>
                  <Num>{n(j.positions)}</Num>
                  <Num className={(j.ageDays ?? 0) > 30 ? TONE.danger.value : undefined}>{TH_NUM_DAYS(j.ageDays)}</Num>
                  <TableCell className={cn('whitespace-nowrap text-xs', DASH.muted)}>
                    {j.released ? 'ปล่อยแล้ว ยังเงียบ' : 'ยังไม่ปล่อย'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="xs" variant="outline">
                      <Link to={postingPathOf(j)}>เปิดใบ</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </Section>
  );
}

/* ─────────────── Lumos ทุกเลน ─────────────── */

const LUMOS_METRICS: ReadonlyArray<{ key: TeamLumosSeriesKey; metric: MetricKey }> = [
  { key: 'sent', metric: 'teamOnline.lumosSent' },
  { key: 'called', metric: 'teamOnline.lumosCalled' },
  { key: 'success', metric: 'teamOnline.lumosSuccess' },
  { key: 'rate', metric: 'teamOnline.successRate' },
];

function addLumos(a: TeamLumosStats, b: TeamLumosStats): TeamLumosStats {
  return {
    sent: a.sent + b.sent,
    waiting: a.waiting + b.waiting,
    called: a.called + b.called,
    success: a.success + b.success,
    fail: a.fail + b.fail,
    talked: a.talked + b.talked,
  };
}

function LumosCells({ s, strong }: { s: TeamLumosStats; strong?: boolean }) {
  return (
    <>
      <Num strong={strong}>{n(s.waiting)}</Num>
      <Num strong={strong}>{n(s.called)}</Num>
      <Num strong={strong}>{n(s.success)}</Num>
      <Num strong={strong}>{n(s.fail)}</Num>
      <Num strong>{fmtPct(successRate(s))}</Num>
    </>
  );
}

/** แท่งเล็กแยกสีตามเลน — ส่งไปของ BU นี้เป็นงานแบบไหน */
function LaneBar({ lanes, total }: { lanes: Record<string, TeamLumosStats>; total: number }) {
  if (total <= 0) return null;
  return (
    <div className="ml-auto flex h-2 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
      {TEAM_LANES.map((l) =>
        lanes[l.key]?.sent ? (
          <div
            key={l.key}
            className={cn('h-full', TONE[LANE_TONE[l.key]].dot)}
            style={{ width: `${(lanes[l.key].sent / total) * 100}%` }}
          />
        ) : null,
      )}
    </div>
  );
}

export function LumosSection({
  data,
  loading,
  initialMetric = 'sent',
}: {
  data: Data | null;
  loading: boolean;
  initialMetric?: TeamLumosSeriesKey;
}) {
  const [lumosKey, setLumosKey] = useState<TeamLumosSeriesKey>(initialMetric);
  const w = data?.window ?? null;
  const lumos = pickBu(data, data?.lumos?.byBu);
  const lumosTotal = lumos.reduce((s, r) => addLumos(s, r.total), emptyLumosStats());
  const lumosMetric = LUMOS_METRICS.find((m) => m.key === lumosKey) ?? LUMOS_METRICS[0];
  const foot = chartFootOf(data);
  return (
    <Section
      title="Lumos ต่อ BU · ทุกเลน"
      buBadge={buBadgeOf(data)}
      foot={foot ? `${foot} · นับสาย กลุ่มตามวันที่ส่งเข้าคิว` : null}
      right={
        <div className="w-40 shrink-0">
          <Select value={lumosKey} onValueChange={(v) => setLumosKey(v as TeamLumosSeriesKey)}>
            <SelectTrigger className="text-xs" aria-label="ดูเรื่อง">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LUMOS_METRICS.map((m) => (
                <SelectItem key={m.key} value={m.key} className="text-xs">
                  {METRICS[m.metric].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {w ? (
        <BuTrendChart
          buckets={w.buckets}
          series={chartOf(data?.lumos?.byBu, (r) => r.series[lumosKey])}
          lastOpen={w.lastBucketOpen}
          format={(v) => (lumosKey === 'rate' ? fmtPct(v) : NUM.format(Math.round(v)))}
          asPct={lumosKey === 'rate'}
          selected={data?.bu ?? null}
          ariaLabel={`Lumos ${METRICS[lumosMetric.metric].label} ต่อ BU`}
        />
      ) : null}
      {/* สีของเลน (ใช้กับตารางข้างล่าง) — คนละชุดกับสีประจำ BU ของกราฟ จึงเขียนกำกับว่า "เลน" */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <span className={DASH.muted}>เลน</span>
        {TEAM_LANES.filter((l) => l.key !== 'other' || (data?.lumos?.lanes.other.sent ?? 0) > 0).map((l) => (
          <span key={l.key} className="inline-flex items-center gap-1.5 text-foreground">
            <span className={cn('inline-block h-2.5 w-2.5 rounded-full bg-current', TONE[LANE_TONE[l.key]].value)} aria-hidden />
            {l.label}
          </span>
        ))}
      </div>
      {!data?.lumos ? (
        empty(data?.errors.lumos ?? (loading ? 'กำลังโหลด…' : '—'))
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">BU</TableHead>
              <Head metric="teamOnline.lumosSent" />
              <Head metric="teamOnline.lumosWaiting" />
              <Head metric="teamOnline.lumosCalled" />
              <Head metric="teamOnline.lumosSuccess" />
              <Head metric="teamOnline.lumosFail" />
              <Head metric="teamOnline.successRate" suffix="" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lumos.map((r) => (
              <React.Fragment key={r.bu || 'unknown'}>
                <TableRow>
                  <BuCell label={r.label} bu={r.bu} />
                  <TableCell className="text-right text-sm tabular-nums">
                    <div className="flex items-center justify-end gap-2">
                      <LaneBar lanes={r.lanes} total={r.total.sent} />
                      <span className={DASH.cell}>{n(r.total.sent)}</span>
                    </div>
                  </TableCell>
                  <LumosCells s={r.total} />
                </TableRow>
                {TEAM_LANES.filter((l) => r.lanes[l.key].sent > 0).map((l) => (
                  <TableRow key={`${r.bu}-${l.key}`}>
                    <BuCell
                      label={l.label}
                      bu={r.bu}
                      indent={
                        <>
                          <span className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[LANE_TONE[l.key]].value)} aria-hidden />
                          {l.label}
                        </>
                      }
                    />
                    <Num className={DASH.muted}>{n(r.lanes[l.key].sent)}</Num>
                    <LumosCells s={r.lanes[l.key]} />
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
            {lumos.length > 1 ? (
              <TableRow>
                <BuCell label="รวม" bu={null} />
                <Num strong>{n(lumosTotal.sent)}</Num>
                <LumosCells s={lumosTotal} strong />
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/* ─────────────── ติดตรงไหน ─────────────── */

export function FunnelSection({ data, loading }: { data: Data | null; loading: boolean }) {
  const funnel = pickBu(data, data?.funnel);
  return (
    <Section
      title="ติดตรงไหน · ใบขอที่เข้ามาในช่วงนี้ ตอนนี้ไปถึงขั้นไหน"
      buBadge={buBadgeOf(data)}
      foot={`นับใบที่มีอย่างน้อยหนึ่งคนถึงขั้นนั้น (ถึงตอนนี้) · นัด = บันทึกนัดของเจ้าหน้าที่ (ไม่ใช่ผลสายสัมภาษณ์ AI) · ช่องสีแดง = ขั้นที่หายมากสุด · ใบที่เพิ่งเข้ายังมีเวลาเดินน้อยกว่า${
        funnel.length > 0 && funnel.every((r) => r.counts.showed === null) ? ' · มาตามนัด “—” = ระบบยังไม่มีการบันทึกผลมาตามนัด' : ''
      }`}
    >
      {!data?.funnel ? (
        empty(data?.errors.funnel ?? (loading ? 'กำลังโหลด…' : '—'))
      ) : funnel.length === 0 ? (
        empty('ยังไม่มีใบขอเข้าในช่วงนี้')
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">BU</TableHead>
              {FUNNEL_STAGES.map((s) => (
                <TableHead key={s.key} className="text-right text-xs">
                  {s.label}
                </TableHead>
              ))}
              <TableHead className="text-xs">ติดที่</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {funnel.map((r) => (
              <TableRow key={r.bu || 'unknown'}>
                <BuCell label={r.label} bu={r.bu} />
                {FUNNEL_STAGES.map((s) => {
                  const stuck = r.stuckAt === s.key;
                  const count = r.counts[s.key];
                  const base = r.counts.requests ?? 0;
                  return (
                    <Num key={s.key} strong={stuck} className={stuck ? TONE.danger.wash : undefined}>
                      {n(count)}
                      {s.key !== 'requests' && base > 0 && count !== null ? (
                        <span className={cn('block text-xs', DASH.muted)}>{fmtPct(ratio(count, base))}</span>
                      ) : null}
                    </Num>
                  );
                })}
                <TableCell className={cn('text-xs', r.stuckAt ? TONE.danger.value : DASH.muted)}>
                  {r.stuckAt ? FUNNEL_STAGES.find((s) => s.key === r.stuckAt)?.label : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}

/* ─────────────── Success ประกาศ ─────────────── */

export function SuccessSection({ data, loading }: { data: Data | null; loading: boolean }) {
  const posts = pickBu(data, data?.byBu);
  const postTotal = posts.reduce(
    (s, r) => ({ published: s.published + r.published, withApplicants: s.withApplicants + r.withApplicants, applicants: s.applicants + r.applicants }),
    { published: 0, withApplicants: 0, applicants: 0 },
  );
  return (
    <Section
      title="Success ประกาศ · มีผู้สมัครอย่างน้อย 1 คน"
      buBadge={buBadgeOf(data)}
      foot="Success ประกาศ = ใบที่ Gen link แล้วมีผู้สมัคร ÷ ใบที่ Gen link ทั้งหมดในกลุ่มใบขอที่เลือก · ประกาศใหม่ยังมีเวลารับสมัครน้อยกว่า · “ไม่มีผู้สมัคร” ยังไม่ใช่ข้อสรุปว่าล้มเหลว"
    >
      {!data?.byBu ? (
        empty(data?.errors.byBu ?? (loading ? 'กำลังโหลด…' : '—'))
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">BU</TableHead>
              <Head metric="teamOnline.published" />
              <Head metric="teamOnline.withApplicants" />
              <TableHead className="text-right text-xs">ไม่มีผู้สมัคร (ใบ)</TableHead>
              <Head metric="teamOnline.applicants" />
              <Head metric="teamOnline.postingSuccess" suffix="" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((r) => (
              <TableRow key={r.bu || 'unknown'}>
                <BuCell label={r.label} bu={r.bu} />
                <Num>{n(r.published)}</Num>
                <Num>{n(r.withApplicants)}</Num>
                <Num>{n(r.published - r.withApplicants)}</Num>
                <Num>{n(r.applicants)}</Num>
                <Num strong>{fmtPct(ratio(r.withApplicants, r.published))}</Num>
              </TableRow>
            ))}
            {posts.length > 1 ? (
              <TableRow>
                <BuCell label="รวม" bu={null} />
                <Num strong>{n(postTotal.published)}</Num>
                <Num strong>{n(postTotal.withApplicants)}</Num>
                <Num strong>{n(postTotal.published - postTotal.withApplicants)}</Num>
                <Num strong>{n(postTotal.applicants)}</Num>
                <Num strong>{fmtPct(ratio(postTotal.withApplicants, postTotal.published))}</Num>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Section>
  );
}
