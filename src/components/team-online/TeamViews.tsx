/**
 * ═══ ข้อมูลใต้การ์ด — การ์ดทำตัวเป็นแท็บ (หน้าทีม Online รอบ 5 · 29 ก.ย. 2569) ═══
 *
 * เจ้าของ Choice **"ส่วนล่างของหน้าเปลี่ยนตามการ์ด"** (ไม่มีแผงเด้ง) — ทุกการ์ดทรงเดียวกัน:
 *   กราฟแท่งทุก BU ต่อช่วงย่อย (ค่าตั้งต้น 7 วัน) + เส้นแนวโน้ม · โดนัทสัดส่วน BU (จี้แล้วบอกรายละเอียด) · ตามด้วยรายละเอียดของเรื่องนั้น
 * - คนใช้งาน → โดนัทจี้แล้วแยก หัวหน้า/สายงาน · รายชื่อแบ่งหน้าเรียงตาม BU (Online ล่าสุด · ใครยังไม่เคยเข้า) — รายชื่อเฉพาะหัวหน้า/admin
 * - อัตราที่ขอเข้า → 3 ก้อนกดได้: อนุมัติแล้ว (Gen link) · รอดำเนินการ (รออะไร) · ไม่อนุมัติ (เพราะอะไร)
 * - Lumos → ส่งไปต่อ BU · ผลลัพธ์ · มาจากไหน (ติดตาม / ผู้สมัคร / จับคู่) · แนวโน้มการใช้งาน + Success rate ดีขึ้นไหม
 * - ผู้สมัครใหม่ / Success ประกาศ → ทรงเดียวกัน + ตารางเดิม
 * วาดอย่างเดียว — ตัวเลขทั้งหมดมาจาก `/api/team-online` · ป้าย/นิยามจากตัวคิด (`teamOnline.ts`) + พจนานุกรมเลข
 */
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { METRICS } from '@/lib/metricDictionary';
import {
  APPLICANT_STAGES,
  PENDING_WAITS,
  PERSON_KIND_LABEL,
  REQUEST_DECISIONS,
  TEAM_LANES,
  TREND_TEXT,
  countDelta,
  fmtPct,
  pooledUsage,
  rateDelta,
  ratio,
  successRate,
  trendOf,
  type RequestDecision,
  type TeamDecisionPart,
  type TeamLumosStats,
  type TeamOnlineResponse,
  type TeamPerson,
} from '@/lib/teamOnline';
import { TREND_GRAIN_LABEL, daysBetween } from '@/lib/trends/timeBuckets';
import { DASH, TONE, type ToneKey } from '@/lib/designTokens';
import { cn } from '@/lib/utils';
import BuDonut, { type DonutLine, type DonutSlice } from './BuDonut';
import BuTrendChart, { type BuTrendSeries } from './BuTrendChart';
import UsageVsRequestsChart from './UsageVsRequestsChart';
import {
  ApplicantsSection,
  FunnelSection,
  LumosSection,
  NoApplicantsSection,
  RequestsSection,
  Section,
  SuccessSection,
} from './TeamOnlineSections';
import { LANE_TONE, toneOfBu } from './teamOnlineTones';

const NUM = new Intl.NumberFormat('th-TH');
const AVG = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 });
const TIME = new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const DAY = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const BKK_YMD = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' });
const n = (v: number | null | undefined) => (v === null || v === undefined ? '—' : NUM.format(v));

export type TeamViewKey = 'users' | 'positions' | 'applicants' | 'called' | 'postings' | 'successRate';

type Data = TeamOnlineResponse;
type ViewProps = { data: Data | null; loading: boolean };

const buBadgeOf = (data: Data | null) => data?.bu ?? 'ทุก BU';
const sliceKey = (bu: string) => bu || 'none';
const sliceLabel = (bu: string, label: string) => (bu ? label : 'ไม่ระบุ BU');
const sliceTone = (bu: string): ToneKey => (bu ? toneOfBu(bu) : 'neutral');

function footOf(data: Data | null): string | null {
  const w = data?.window;
  if (!w) return null;
  return `ราย${TREND_GRAIN_LABEL[w.grain]} · แท่ง = แต่ละ BU · เส้นประ = แนวโน้ม · จี้ชิ้นโดนัทหรือรายการเพื่อดูรายละเอียด${
    w.lastBucketOpen && w.buckets.length > 1 ? ' · ช่วงสุดท้ายยังไม่จบ ไม่นับในเส้นแนวโน้ม' : ''
  }`;
}

function Waiting({ title, data, loading, error }: ViewProps & { title: string; error?: string }) {
  return (
    <Section title={title} buBadge={buBadgeOf(data)}>
      <p className={cn('py-6 text-center text-sm', DASH.muted)}>{error ?? (loading ? 'กำลังโหลด…' : '—')}</p>
    </Section>
  );
}

/** กราฟแท่ง (ซ้าย) + โดนัท (ขวา) — จอแคบเรียงลงมา */
function ChartPair({ bar, donut }: { bar: React.ReactNode; donut: React.ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="min-w-0 lg:col-span-3">{bar}</div>
      <div className="min-w-0 lg:col-span-2">{donut}</div>
    </div>
  );
}

function series<T extends { bu: string; label: string }>(rows: readonly T[], values: (r: T) => ReadonlyArray<number | null>): BuTrendSeries[] {
  return rows.filter((r) => r.bu !== '').map((r) => ({ bu: r.bu, label: r.label, values: values(r) }));
}

/* ─────────────── คนใช้งาน ─────────────── */

function lastOnline(iso: string | null, todayYmd: string): { text: string; tone: ToneKey | null } {
  if (!iso) return { text: 'ยังไม่เคยเข้าระบบ', tone: 'danger' };
  const d = new Date(iso);
  const ago = daysBetween(BKK_YMD.format(d), todayYmd);
  if (ago <= 0) return { text: `วันนี้ ${TIME.format(d)}`, tone: null };
  if (ago === 1) return { text: `เมื่อวาน ${TIME.format(d)}`, tone: null };
  if (ago < 7) return { text: `${NUM.format(ago)} วันก่อน · ${DAY.format(d)}`, tone: null };
  return { text: `${DAY.format(d)} (${NUM.format(ago)} วันก่อน)`, tone: ago > 30 ? 'warn' : null };
}

const PAGE = 10;
type PeopleFilter = 'all' | 'never' | 'idle';

function PeopleList({ people, todayYmd }: { people: readonly TeamPerson[]; todayYmd: string }) {
  const [filter, setFilter] = useState<PeopleFilter>('all');
  const [page, setPage] = useState(0);
  const never = people.filter((p) => !p.lastAt).length;
  const idle = people.filter((p) => p.days === 0).length;
  const list = filter === 'never' ? people.filter((p) => !p.lastAt) : filter === 'idle' ? people.filter((p) => p.days === 0) : people;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const rows = list.slice(cur * PAGE, cur * PAGE + PAGE);
  const choose = (f: PeopleFilter) => {
    setFilter(f);
    setPage(0);
  };
  const chips: Array<{ key: PeopleFilter; label: string }> = [
    { key: 'all', label: `ทั้งหมด ${NUM.format(people.length)} คน` },
    { key: 'never', label: `ยังไม่เคยเข้าระบบ ${NUM.format(never)}` },
    { key: 'idle', label: `ไม่ได้ใช้ในช่วงนี้ ${NUM.format(idle)}` },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">รายชื่อ · เรียงตาม BU</p>
        <div className="flex flex-wrap gap-1" role="group" aria-label="กรองรายชื่อ">
          {chips.map((c) => (
            <Button
              key={c.key}
              type="button"
              size="xs"
              variant={filter === c.key ? 'default' : 'outline'}
              aria-pressed={filter === c.key}
              onClick={() => choose(c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">ชื่อ</TableHead>
            <TableHead className="text-xs">BU</TableHead>
            <TableHead className="text-xs">หัวหน้า / สายงาน</TableHead>
            <TableHead className="text-xs">Online ล่าสุด</TableHead>
            <TableHead className="text-right text-xs">ใช้ในช่วงนี้</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => {
            const lo = lastOnline(p.lastAt, todayYmd);
            return (
              <TableRow key={p.id}>
                <TableCell className="text-sm text-foreground">{p.name}</TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1.5 text-foreground">
                    <span className={cn('inline-block h-2 w-2 rounded-full bg-current', TONE[sliceTone(p.bu)].value)} aria-hidden />
                    {p.bu || 'ไม่ระบุ BU'}
                  </span>
                </TableCell>
                <TableCell className={cn('text-xs', DASH.muted)}>{PERSON_KIND_LABEL[p.kind]}</TableCell>
                <TableCell className={cn('whitespace-nowrap text-xs tabular-nums', lo.tone ? TONE[lo.tone].value : 'text-foreground')}>
                  {lo.text}
                </TableCell>
                <TableCell className={cn('text-right text-xs tabular-nums', p.days === 0 ? DASH.muted : 'text-foreground')}>
                  {p.days === 0 ? 'ไม่ได้ใช้' : `${NUM.format(p.days)} วัน`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {list.length === 0 ? <p className={cn('py-4 text-center text-sm', DASH.muted)}>ไม่มีใครในกลุ่มนี้</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-xs tabular-nums', DASH.muted)}>
          {list.length === 0
            ? ''
            : `แสดง ${NUM.format(cur * PAGE + 1)}–${NUM.format(Math.min(list.length, cur * PAGE + PAGE))} จาก ${NUM.format(list.length)} คน`}
        </p>
        {pages > 1 ? (
          <Pagination className="mx-0 w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <Button type="button" size="xs" variant="outline" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                  ก่อนหน้า
                </Button>
              </PaginationItem>
              <PaginationItem>
                <span className={cn('px-2 text-xs tabular-nums', DASH.muted)}>
                  หน้า {NUM.format(cur + 1)} / {NUM.format(pages)}
                </span>
              </PaginationItem>
              <PaginationItem>
                <Button type="button" size="xs" variant="outline" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                  ถัดไป
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </div>
      <p className={cn('text-xs', DASH.muted)}>
        Online ล่าสุด = ล็อกอินหรือบันทึกงานครั้งล่าสุด · ยังไม่เคยเข้าระบบ = ไม่มีทั้งสองอย่างเลย (ระบบเริ่มเก็บ 1 ก.ค. 2569)
      </p>
    </div>
  );
}

function UsersView({ data, loading }: ViewProps) {
  const w = data?.window ?? null;
  const u = data?.users ?? null;
  const usage = useMemo(() => {
    if (!u || !w) return null;
    return pooledUsage(u.byBu.filter((r) => !data?.bu || r.bu === data.bu), w.buckets.length);
  }, [u, w, data?.bu]);
  if (!u || !w) return <Waiting title="คนใช้งาน · แต่ละ BU" data={data} loading={loading} error={data?.errors.users} />;
  const slices: DonutSlice[] = u.byBu.map((r) => ({
    key: sliceKey(r.bu),
    label: sliceLabel(r.bu, r.label),
    value: r.users,
    tone: sliceTone(r.bu),
    // % ของบัญชีใน BU + เทียบช่วงก่อน (รอบ 2: *"คิดจาก % นะเพราะแต่ละ Bu มีคนไม่เท่ากัน"*)
    sub:
      r.accounts === 0
        ? 'ยังไม่มีบัญชีในระบบ'
        : `${NUM.format(r.users)}/${NUM.format(r.accounts)} บัญชี · ${fmtPct(r.pct)} · ${w.compare === 'lastYear' ? 'เทียบปีก่อน' : 'เทียบช่วงก่อน'} ${rateDelta(r.pct, r.prevPct).text}`,
    lines: r.kinds.map((k) => ({ label: k.label, value: `${NUM.format(k.users)}/${NUM.format(k.accounts)} คน` })),
  }));
  const people = data?.people ? data.people.filter((p) => !data.bu || p.bu === data.bu) : null;
  return (
    <>
      <Section title="คนใช้งาน · แต่ละ BU เข้ามาเท่าไหร่" buBadge={buBadgeOf(data)} foot={footOf(data)}>
        <ChartPair
          bar={
            <BuTrendChart
              buckets={w.buckets}
              series={series(u.byBu, (r) => r.counts)}
              lastOpen={w.lastBucketOpen}
              format={(v) => `${NUM.format(Math.round(v))} คน`}
              selected={data?.bu ?? null}
              ariaLabel="คนใช้งานต่อ BU ต่อช่วงย่อย"
            />
          }
          donut={
            <BuDonut
              title="สัดส่วนคนใช้งานแต่ละ BU"
              slices={slices}
              unit="คน"
              selected={data?.bu ?? null}
              ariaLabel="สัดส่วนคนใช้งานแต่ละ BU"
            />
          }
        />
        {people ? <PeopleList people={people} todayYmd={w.today} /> : null}
      </Section>
      <UsageVsRequestsChart
        buckets={w.buckets}
        grain={w.grain}
        usage={usage}
        positions={data?.requests ? data.requests.positions.series : null}
        lastOpen={w.lastBucketOpen}
        buLabel={buBadgeOf(data)}
        loading={loading && !data}
      />
    </>
  );
}

/* ─────────────── อัตราที่ขอเข้า: อนุมัติแล้ว · รอดำเนินการ · ไม่อนุมัติ ─────────────── */

const DECISION_TONE: Record<RequestDecision, ToneKey> = { approved: 'success', pending: 'warn', rejected: 'neutral' };

function decisionLines(decision: RequestDecision, p: TeamDecisionPart): DonutLine[] {
  const d = p.decisions[decision];
  if (decision === 'approved') {
    const a = p.approvedApplicants;
    return [
      { label: 'Gen link แล้ว', value: `${NUM.format(d.requests)} ใบ` },
      { label: 'มีคนสมัคร', value: `${NUM.format(a.withApplicants)} ใบ` },
      { label: 'ผู้สมัครรวม', value: `${NUM.format(a.applicants)} คน` },
      { label: 'เฉลี่ยใบละ', value: d.requests > 0 ? `${AVG.format(a.applicants / d.requests)} คน` : '—' },
    ];
  }
  if (decision === 'pending') {
    return PENDING_WAITS.filter((x) => p.waits[x.key].positions > 0).map((x) => ({
      label: x.label,
      value: `${NUM.format(p.waits[x.key].positions)} อัตรา · ${NUM.format(p.waits[x.key].requests)} ใบ`,
    }));
  }
  return p.reasons.map((x) => ({ label: x.text, value: `${NUM.format(x.positions)} อัตรา · ${NUM.format(x.requests)} ใบ` }));
}

const DECISION_ASK: Record<RequestDecision, string> = {
  approved: 'มีคนสมัครมากี่ใบ ใบละกี่คน',
  pending: 'รออะไร',
  rejected: 'ไม่อนุมัติเพราะอะไร',
};

function RequestsView({ data, loading }: ViewProps) {
  const [decision, setDecision] = useState<RequestDecision>('approved');
  const w = data?.window ?? null;
  const d = data?.decisions ?? null;
  if (!d || !w) return <Waiting title="อัตราที่ขอเข้า · แต่ละ BU" data={data} loading={loading} error={data?.errors.decisions} />;
  const t = d.total;
  const lines = decisionLines(decision, t);
  const slices: DonutSlice[] = d.byBu.map((r) => ({
    key: sliceKey(r.bu),
    label: sliceLabel(r.bu, r.label),
    value: r.decisions[decision].positions,
    tone: sliceTone(r.bu),
    sub: `${NUM.format(r.decisions[decision].requests)} ใบ`,
    lines: decisionLines(decision, r),
  }));
  const info = REQUEST_DECISIONS.find((x) => x.key === decision) ?? REQUEST_DECISIONS[0];
  return (
    <>
      <Section title="อัตราที่ขอเข้า · อนุมัติแล้ว · รอดำเนินการ · ไม่อนุมัติ" buBadge={buBadgeOf(data)} foot={footOf(data)}>
        <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="ดูก้อนไหน">
          {REQUEST_DECISIONS.map((x) => {
            const on = decision === x.key;
            const v = t.decisions[x.key];
            return (
              <Button
                key={x.key}
                type="button"
                variant="outline"
                aria-pressed={on}
                onClick={() => setDecision(x.key)}
                className={cn(
                  'h-auto flex-col items-start justify-start gap-1 whitespace-normal rounded-xl px-4 py-3 text-left font-normal',
                  on && 'border-primary bg-muted',
                )}
              >
                <span className="text-sm font-medium text-foreground">{x.label}</span>
                <span className={cn('text-xs', DASH.muted)}>{x.hint}</span>
                <span className="flex items-baseline gap-1.5">
                  <span className={cn('text-2xl font-medium tabular-nums', TONE[DECISION_TONE[x.key]].num)}>{NUM.format(v.positions)}</span>
                  <span className={cn('text-sm', DASH.sub)}>อัตรา · {NUM.format(v.requests)} ใบ</span>
                </span>
              </Button>
            );
          })}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">
            {info.label} — {DECISION_ASK[decision]}
          </p>
          {lines.length > 0 ? (
            <p className={cn('text-xs', DASH.muted)}>{lines.map((l) => `${l.label} ${l.value}`).join(' · ')}</p>
          ) : null}
          {decision === 'rejected' && !d.skipsReady ? (
            <p className={cn('text-xs', TONE.warn.value)}>ยังอ่านทะเบียน “ไม่ประกาศ” ไม่ได้ตอนนี้ — ก้อนนี้เป็น 0 เพราะอ่านไม่ได้</p>
          ) : decision === 'rejected' && t.decisions.rejected.requests === 0 ? (
            <p className={cn('text-xs', DASH.muted)}>
              ยังไม่มีใบที่ตั้ง “ไม่ประกาศ” — ทีม Online กดได้ในป๊อปไล่งานของงานสรรหา (เริ่มนับ 29 ก.ย. 2569)
            </p>
          ) : null}
        </div>
        <ChartPair
          bar={
            <BuTrendChart
              buckets={w.buckets}
              series={series(d.byBu, (r) => r.decisions[decision].series)}
              lastOpen={w.lastBucketOpen}
              format={(v) => `${NUM.format(Math.round(v))} อัตรา`}
              selected={data?.bu ?? null}
              ariaLabel={`อัตราที่ขอเข้า ${info.label} ต่อ BU`}
            />
          }
          donut={
            <BuDonut
              title={`${info.label} · สัดส่วนแต่ละ BU`}
              slices={slices}
              unit="อัตรา"
              selected={data?.bu ?? null}
              empty={`ยังไม่มีใบ${info.label}ในช่วงนี้`}
              ariaLabel={`สัดส่วน BU ของใบ${info.label}`}
            />
          }
        />
      </Section>
      <RequestsSection data={data} loading={loading && !data} chart={false} />
      <FunnelSection data={data} loading={loading && !data} />
    </>
  );
}

/* ─────────────── ผู้สมัครใหม่ ─────────────── */

function ApplicantsView({ data, loading }: ViewProps) {
  const w = data?.window ?? null;
  const a = data?.applicants ?? null;
  if (!a || !w) return <Waiting title="ผู้สมัครใหม่ · แต่ละ BU" data={data} loading={loading} error={data?.errors.applicants} />;
  const slices: DonutSlice[] = a.byBu.map((r) => ({
    key: sliceKey(r.bu),
    label: sliceLabel(r.bu, r.label),
    value: r.total.cur,
    tone: sliceTone(r.bu),
    lines: APPLICANT_STAGES.filter((st) => r.stages[st.key] > 0).map((st) => ({ label: st.label, value: `${NUM.format(r.stages[st.key])} ใบ` })),
  }));
  return (
    <>
      <Section title="ผู้สมัครใหม่ · แต่ละ BU" buBadge={buBadgeOf(data)} foot={footOf(data)}>
        <ChartPair
          bar={
            <BuTrendChart
              buckets={w.buckets}
              series={series(a.byBu, (r) => r.series)}
              lastOpen={w.lastBucketOpen}
              format={(v) => `${NUM.format(Math.round(v))} ใบ`}
              selected={data?.bu ?? null}
              ariaLabel="ผู้สมัครใหม่ต่อ BU ต่อช่วงย่อย"
            />
          }
          donut={
            <BuDonut title="สัดส่วนผู้สมัครแต่ละ BU" slices={slices} unit="ใบ" selected={data?.bu ?? null} ariaLabel="สัดส่วนผู้สมัครแต่ละ BU" />
          }
        />
      </Section>
      <ApplicantsSection data={data} loading={loading && !data} />
      <NoApplicantsSection data={data} loading={loading && !data} />
    </>
  );
}

/* ─────────────── Lumos: ส่งไป · ผลลัพธ์ · มาจากไหน · แนวโน้ม ─────────────── */

function lumosLines(s: TeamLumosStats): DonutLine[] {
  return [
    { label: 'รอโทร', value: `${NUM.format(s.waiting)} สาย` },
    { label: 'โทรแล้ว', value: `${NUM.format(s.called)} สาย` },
    { label: 'สำเร็จ', value: `${NUM.format(s.success)} สาย` },
    { label: 'ไม่สำเร็จ', value: `${NUM.format(s.fail)} สาย` },
    { label: 'Success rate', value: fmtPct(successRate(s)) },
  ];
}

const RATE_TREND: Record<'up' | 'down' | 'flat' | 'none', string> = {
  up: 'ดีขึ้น',
  down: 'แย่ลง',
  flat: 'ทรงตัว',
  none: TREND_TEXT.none,
};

function LumosView({ data, loading, rateFirst }: ViewProps & { rateFirst: boolean }) {
  const w = data?.window ?? null;
  const l = data?.lumos ?? null;
  if (!l || !w) return <Waiting title="Lumos · แต่ละ BU" data={data} loading={loading} error={data?.errors.lumos} />;
  const page = l.byBu.filter((r) => !data?.bu || r.bu === data.bu);
  const excludeLast = w.lastBucketOpen && w.buckets.length > 1;
  const sent = w.buckets.map((_, i) => page.reduce((s, r) => s + (r.series.sent[i] ?? 0), 0));
  const rate = w.buckets.map((_, i) =>
    ratio(
      page.reduce((s, r) => s + (r.series.success[i] ?? 0), 0),
      page.reduce((s, r) => s + (r.series.talked[i] ?? 0), 0),
    ),
  );
  const sentTrend = trendOf(sent, excludeLast);
  const rateTrend = trendOf(rate, excludeLast);
  const partial = l.coverage.prev !== 'full';
  const lanes = data?.bu ? (page[0]?.lanes ?? null) : l.lanes;
  const buSlices: DonutSlice[] = l.byBu.map((r) => ({
    key: sliceKey(r.bu),
    label: sliceLabel(r.bu, r.label),
    value: r.total.sent,
    tone: sliceTone(r.bu),
    sub: `Success rate ${fmtPct(successRate(r.total))}`,
    lines: [
      ...lumosLines(r.total),
      ...TEAM_LANES.filter((x) => r.lanes[x.key].sent > 0).map((x) => ({ label: `มาจาก${x.label}`, value: `${NUM.format(r.lanes[x.key].sent)} สาย` })),
    ],
  }));
  const laneSlices: DonutSlice[] = lanes
    ? TEAM_LANES.filter((x) => x.key !== 'other' || lanes.other.sent > 0).map((x) => ({
        key: x.key,
        label: x.label,
        value: lanes[x.key].sent,
        tone: LANE_TONE[x.key],
        sub: `Success rate ${fmtPct(successRate(lanes[x.key]))}`,
        lines: lumosLines(lanes[x.key]),
      }))
    : [];
  const usage = (
    <ChartPair
      bar={
        <BuTrendChart
          buckets={w.buckets}
          series={series(l.byBu, (r) => r.series.sent)}
          lastOpen={w.lastBucketOpen}
          format={(v) => `${NUM.format(Math.round(v))} สาย`}
          selected={data?.bu ?? null}
          ariaLabel="ส่งไป Lumos ต่อ BU ต่อช่วงย่อย"
        />
      }
      donut={
        <BuDonut title="ส่งไป Lumos · สัดส่วนแต่ละ BU" slices={buSlices} unit="สาย" selected={data?.bu ?? null} ariaLabel="สัดส่วน BU ของสายที่ส่งไป Lumos" />
      }
    />
  );
  const quality = (
    <ChartPair
      bar={
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Success rate แต่ละ BU</p>
          <BuTrendChart
            buckets={w.buckets}
            series={series(l.byBu, (r) => r.series.rate)}
            lastOpen={w.lastBucketOpen}
            format={(v) => fmtPct(v)}
            asPct
            selected={data?.bu ?? null}
            ariaLabel="Success rate ของ Lumos ต่อ BU ต่อช่วงย่อย"
          />
        </div>
      }
      donut={
        <BuDonut
          title="มาจากไหน · อย่างละเท่าไหร่"
          slices={laneSlices}
          unit="สาย"
          empty="ยังไม่มีสายที่ส่งไปในช่วงนี้"
          ariaLabel="สายที่ส่งไป Lumos แยกตามที่มา"
        />
      }
    />
  );
  return (
    <>
      <Section
        title="Lumos · ส่งไปเท่าไหร่ · ผลเป็นยังไง · มาจากไหน"
        buBadge={buBadgeOf(data)}
        foot={`${footOf(data) ?? ''} · นับสาย กลุ่มตามวันที่ส่งเข้าคิว · Success rate = ตอบรับ ÷ สายที่ได้คุยจริง (ตัวเดียวกับ Dashboard)`}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <div className={cn('rounded-xl border px-4 py-3', TONE.info.soft)}>
            <p className={cn('text-xs', DASH.muted)}>การใช้งานเติบโตขึ้นไหม</p>
            <p className="text-sm font-medium text-foreground">
              {w.buckets.length > 1 ? TREND_TEXT[sentTrend.direction] : 'ดูเป็นช่วงเดียว — เลือกหลายวันเพื่อดูแนวโน้ม'}
            </p>
            <p className={cn('text-xs tabular-nums', DASH.muted)}>
              ส่งไป {NUM.format(l.total.sent)} สาย
              {partial ? ' · ช่วงก่อนข้อมูลไม่ครบ ไม่เทียบ' : ` · เทียบช่วงก่อน ${countDelta(l.total.sent, l.prev.sent, 'สาย').text}`}
            </p>
          </div>
          <div className={cn('rounded-xl border px-4 py-3', TONE.success.soft)}>
            <p className={cn('text-xs', DASH.muted)}>Success rate ดีขึ้นไหม</p>
            <p className="text-sm font-medium text-foreground">
              {w.buckets.length > 1 ? `Success rate ${RATE_TREND[rateTrend.direction]}` : 'ดูเป็นช่วงเดียว — เลือกหลายวันเพื่อดูแนวโน้ม'}
            </p>
            <p className={cn('text-xs tabular-nums', DASH.muted)}>
              ช่วงนี้ {fmtPct(successRate(l.total))}
              {partial ? ' · ช่วงก่อนข้อมูลไม่ครบ ไม่เทียบ' : ` · เทียบช่วงก่อน ${rateDelta(successRate(l.total), successRate(l.prev)).text}`}
            </p>
          </div>
        </div>
        {rateFirst ? quality : usage}
        {rateFirst ? usage : quality}
      </Section>
      <LumosSection data={data} loading={loading && !data} chart={false} />
    </>
  );
}

/* ─────────────── Success ประกาศ ─────────────── */

function PostingsView({ data, loading }: ViewProps) {
  const w = data?.window ?? null;
  const rows = data?.byBu ?? null;
  if (!rows || !w) return <Waiting title="Success ประกาศ · แต่ละ BU" data={data} loading={loading} error={data?.errors.byBu} />;
  const slices: DonutSlice[] = rows.map((r) => ({
    key: sliceKey(r.bu),
    label: sliceLabel(r.bu, r.label),
    value: r.published,
    tone: sliceTone(r.bu),
    sub: `มีผู้สมัคร ${NUM.format(r.withApplicants)} ใบ · ${fmtPct(ratio(r.withApplicants, r.published))}`,
    lines: [
      { label: 'มีผู้สมัครแล้ว', value: `${NUM.format(r.withApplicants)} ใบ` },
      { label: 'ยังไม่มีผู้สมัคร', value: `${NUM.format(Math.max(0, r.published - r.withApplicants))} ใบ` },
      { label: 'ผู้สมัครรวม', value: `${NUM.format(r.applicants)} คน` },
      { label: METRICS['teamOnline.postingSuccess'].label, value: fmtPct(ratio(r.withApplicants, r.published)) },
    ],
  }));
  return (
    <>
      <Section title="Gen link ใหม่ · แต่ละ BU · ได้ผู้สมัครแค่ไหน" buBadge={buBadgeOf(data)} foot={footOf(data)}>
        <ChartPair
          bar={
            <BuTrendChart
              buckets={w.buckets}
              series={series(rows, (r) => r.series)}
              lastOpen={w.lastBucketOpen}
              format={(v) => `${NUM.format(Math.round(v))} ใบ`}
              selected={data?.bu ?? null}
              ariaLabel="Gen link ใหม่ต่อ BU ต่อช่วงย่อย"
            />
          }
          donut={
            <BuDonut title="สัดส่วน Gen link แต่ละ BU" slices={slices} unit="ใบ" selected={data?.bu ?? null} ariaLabel="สัดส่วน BU ของใบที่ Gen link" />
          }
        />
      </Section>
      <SuccessSection data={data} loading={loading && !data} />
    </>
  );
}

/** ข้อมูลใต้การ์ดที่เลือก */
export function TeamCardView({ view, data, loading }: { view: TeamViewKey } & ViewProps) {
  switch (view) {
    case 'users':
      return <UsersView data={data} loading={loading} />;
    case 'positions':
      return <RequestsView data={data} loading={loading} />;
    case 'applicants':
      return <ApplicantsView data={data} loading={loading} />;
    case 'called':
      return <LumosView data={data} loading={loading} rateFirst={false} />;
    case 'successRate':
      return <LumosView data={data} loading={loading} rateFirst />;
    case 'postings':
      return <PostingsView data={data} loading={loading} />;
  }
}
