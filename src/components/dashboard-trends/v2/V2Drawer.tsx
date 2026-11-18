/**
 * รายละเอียดด้านข้างของภาพรวม v2 (เจ้าของ 17 พ.ย. 2569 · แบบ ZIP v2) — กดยอดแล้วเปิดทางขวา ไม่พาออกจากหน้า
 * ทุกชั้นเก็บตัวกรองครบ (วันที่ · BU · ช่องทาง · อายุ · จังหวัด · ผล) · ย้อนกลับ = คืนชั้นก่อนพร้อมหน้าที่เปิดไว้
 * ทุกรายการแบ่งหน้า 10 · รายชื่อดึงทีละหน้าจากเส้นที่ตรวจสิทธิ์ BU ฝั่ง server (`fetchApplicantNames`)
 */
import React from 'react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH } from '@/lib/designTokens';
import { applicantWorkLink } from '@/lib/recruitRm';
import { fetchApplicantNames, type ApplicantNameRow } from '@/lib/recruitOverviewApi';
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { MonthCompareBars } from './MonthCompareBars';
import { POSTING_STATE_LABEL, postingStateOf } from '@/lib/recruitPostingState';
import {
  AUDIENCE_DIM_LABEL,
  BU_UNKNOWN,
  AUDIENCE_MEASURES,
  AUDIENCE_MEASURE_LABEL,
  ageStats,
  applyAudience,
  audienceRows,
  buCompare,
  dimValueOf,
  pageOf,
  topOf,
  type AudienceDim,
  type AudienceDisplay,
  type AudienceFilter,
  type AudienceMeasure,
} from '@/lib/recruitAudience';
import { BuBars, Pager, fmt, fmtPct } from './V2Parts';
import { V2_METRIC_LABEL, type V2Metric, type V2Model } from './v2Model';

export type V2Pane =
  | { kind: 'metric'; metric: V2Metric; bu?: string; page: number }
  | { kind: 'audience'; view: AudienceDim | 'records'; filter: AudienceFilter; measure: AudienceMeasure; display: AudienceDisplay; page: number; title: string }
  | { kind: 'names'; title: string; ids: string[]; page: number; /** สถานะของแต่ละชื่อ (ใบขอที่กดจากการประกาศ) */ labels?: Record<string, string> }
  | { kind: 'requests'; title: string; rows: StuckRequest[]; page: number; /** BU ที่กดจากกราฟ — มี = รายการใบ · ไม่มี + หลาย BU = กราฟเทียบ BU ก่อน */ bu?: string }
  /** ส่วนเดิมของระบบที่ฝังในแผง (รายการโพสต์ So Scraping · ลิงก์โพสต์เอง · คลิกฟอร์ม) — ไม่เขียนใหม่ */
  | { kind: 'embed'; title: string; embed: string };

const sortBars = <T extends { value: number | null }>(bars: T[]) => [...bars].sort((a, b) => (b.value ?? -1) - (a.value ?? -1));

/** ชั้นถัดไปของการเจาะ: อายุ → จังหวัด → ช่องทาง → ช่องทางรอง → กลุ่ม/เพจ → รายชื่อ */
const NEXT_DIM: Record<AudienceDim, AudienceDim | 'records'> = { age: 'home', home: 'ch', ch: 'sub', sub: 'group', group: 'records', bringer: 'method', method: 'home', gender: 'records' };

function filterLabel(f: AudienceFilter): string {
  const dims = (Object.entries(f.dims) as Array<[AudienceDim, string]>).map(([k, v]) => `${AUDIENCE_DIM_LABEL[k]} ${v}`);
  const res = f.results.map((m) => AUDIENCE_MEASURE_LABEL[m]);
  return [...(f.bu ? [f.bu] : []), ...dims, ...res].join(' · ');
}

export default function V2Drawer({
  stack,
  onStack,
  model,
  bus,
  periodText,
  buText,
  embeds,
}: {
  stack: V2Pane[];
  onStack: (next: V2Pane[]) => void;
  model: V2Model;
  bus: readonly string[];
  periodText: string;
  buText: string;
  embeds: Record<string, React.ReactNode>;
}) {
  const pane = stack[stack.length - 1];
  const open = stack.length > 0;
  const push = (p: V2Pane) => onStack([...stack, p]);
  const replace = (p: V2Pane) => onStack([...stack.slice(0, -1), p]);
  const back = () => onStack(stack.slice(0, -1));
  const close = () => onStack([]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && close()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-2xl" data-testid="v2-drawer">
        {pane ? (
          <>
            <SheetHeader className="sticky top-0 z-10 space-y-1 border-b bg-background px-5 py-4 text-left">
              {stack.length > 1 ? (
                <Button type="button" variant="ghost" size="sm" className="-ml-2 w-fit" onClick={back} data-testid="v2-drawer-back">
                  <ChevronLeft aria-hidden /> กลับ
                </Button>
              ) : null}
              <SheetTitle className="text-lg font-medium">{pane.kind === 'metric' ? V2_METRIC_LABEL[pane.metric] : pane.title}</SheetTitle>
              <SheetDescription className={cn('text-xs', DASH.sub)}>
                {periodText} · {pane.kind === 'metric' && pane.bu ? pane.bu : buText}
                {pane.kind === 'audience' && filterLabel(pane.filter) ? ` / ${filterLabel(pane.filter)}` : ''}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-5 py-4">
              {pane.kind === 'metric' ? <MetricPane pane={pane} model={model} bus={bus} push={push} replace={replace} /> : null}
              {pane.kind === 'audience' ? <AudiencePane pane={pane} model={model} bus={bus} push={push} replace={replace} /> : null}
              {pane.kind === 'names' ? <NamesList ids={pane.ids} page={pane.page} onPage={(page) => replace({ ...pane, page })} model={model} labels={pane.labels} /> : null}
              {pane.kind === 'requests' ? (
                <RequestsByBu pane={pane} push={push} replace={replace} />
              ) : null}
              {pane.kind === 'embed' ? (embeds[pane.embed] ?? null) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function MetricPane({ pane, model, bus, push, replace }: { pane: Extract<V2Pane, { kind: 'metric' }>; model: V2Model; bus: readonly string[]; push: (p: V2Pane) => void; replace: (p: V2Pane) => void }) {
  const st = model.stages[pane.metric];
  if (st.ids === null) {
    return <p className={cn('text-sm', DASH.muted)}>อ่านข้อมูลแจ้งเข้า ERP ไม่ได้ในช่วงนี้ — ไม่ทราบผล (ไม่ใช่ 0)</p>;
  }
  const idSet = new Set(st.ids);
  const facts = model.cohort.filter((f) => f.id && idSet.has(f.id) && (!pane.bu || (f.bu?.trim() || 'ไม่ระบุ BU') === pane.bu));
  const bars = sortBars(
    bus.map((bu) => {
      const n = model.cohort.filter((f) => f.id && idSet.has(f.id) && (f.bu?.trim() || 'ไม่ระบุ BU') === bu).length;
      return { bu, value: n, result: n, sample: n };
    }),
  );
  const ids = facts.map((f) => f.id ?? '');
  return (
    <>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-sm', DASH.muted)}>รวมทั้งหมด</span>
        <span className="text-3xl font-medium tabular-nums">{fmt(facts.length)}</span>
      </div>
      {!pane.bu ? (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-medium">เทียบแต่ละ BU</h3>
            {bars[0]?.value ? <span className={cn('text-xs', DASH.sub)}>มากสุด {bars[0].bu} · {fmt(bars[0].value)} รายการ</span> : null}
          </div>
          <BuBars bars={bars} unit="รายการ" onPick={(bu) => push({ kind: 'metric', metric: pane.metric, bu, page: 1 })} />
        </section>
      ) : null}
      {st.parts.length ? (
        <section className="space-y-1">
          <h3 className="text-sm font-medium">แยกตามผล</h3>
          <ul className="divide-y rounded-xl border">
            {st.parts.map((p) => {
              const own = p.ids.filter((id) => !pane.bu || (model.byId.get(id)?.bu?.trim() || 'ไม่ระบุ BU') === pane.bu);
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted/60"
                    onClick={() => push({ kind: 'names', title: `${V2_METRIC_LABEL[pane.metric]} · ${p.label}`, ids: own, page: 1 })}
                  >
                    <span>{p.label}</span>
                    <span className="font-medium tabular-nums">{fmt(own.length)} ›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      <AudienceSummary facts={facts} onView={(view) => push({ kind: 'audience', view, filter: { dims: {}, results: pane.metric === 'apps' ? [] : metricResults(pane.metric), bu: pane.bu }, measure: 'apps', display: 'count', page: 1, title: 'ผู้สมัครกลุ่มนี้' })} />
      <section className="space-y-1">
        <h3 className="text-sm font-medium">รายชื่อ</h3>
        <NamesList ids={ids} page={pane.page} onPage={(page) => replace({ ...pane, page })} model={model} />
      </section>
    </>
  );
}

/** ยอดหลักที่เป็นผลของตาราง 5 ยอด → ตัวกรองผล (AND) · ยอดอื่น (AI โทร/ติดต่อได้) ใช้ทางเมตริก ไม่เข้าตาราง */
function metricResults(m: V2Metric): AudienceMeasure[] {
  return (AUDIENCE_MEASURES as readonly string[]).includes(m) ? [m as AudienceMeasure] : [];
}

function AudienceSummary({ facts, onView }: { facts: readonly RecruitAppFact[]; onView: (view: AudienceDim) => void }) {
  const a = ageStats(facts);
  const topAge = topOf(facts, 'age');
  const topHome = topOf(facts, 'home');
  const homeMissing = facts.filter((f) => !f.homeProvince?.trim()).length;
  const pct = (n: number) => (facts.length ? `${((n / facts.length) * 100).toFixed(1)}%` : '—');
  return (
    <section className="space-y-1 rounded-xl border p-3" data-testid="v2-audience-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{fmt(facts.length)} รายการสมัคร</span>
        <span className="text-sm">
          อายุเฉลี่ย <span className="text-2xl font-medium tabular-nums">{a.average === null ? '—' : a.average.toFixed(1)}</span> ปี
          <span className={cn('ml-1 text-xs', DASH.sub)}>(จาก {fmt(a.known)} รายการที่มีอายุ)</span>
        </span>
      </div>
      <p className="text-sm">{topAge ? `ช่วงอายุที่พบมาก: ${topAge.key} · ${fmt(topAge.n)} (${pct(topAge.n)})` : 'ยังไม่มีข้อมูลอายุ'}</p>
      <p className="text-sm">{topHome ? `จังหวัดที่อยู่ที่พบมาก: ${topHome.key} · ${fmt(topHome.n)} (${pct(topHome.n)})` : 'ยังไม่มีข้อมูลจังหวัดที่อยู่'}</p>
      <p className={cn('text-xs', DASH.sub)}>
        อายุไม่ระบุ {fmt(a.missing)} · จังหวัดที่อยู่ไม่ระบุ {fmt(homeMissing)} รายการ · อายุ/จังหวัดเป็นค่าที่กรอกล่าสุด
      </p>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" onClick={() => onView('age')}>
          ดูอายุและผลที่ได้
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onView('home')}>
          ดูจังหวัดและผลที่ได้
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onView('ch')}>
          ดูช่องทาง
        </Button>
      </div>
    </section>
  );
}

/** ตารางกลุ่มผู้สมัคร (อายุ · จังหวัดที่อยู่ · ช่องทาง) × 5 ยอด — ใช้ทั้งในแผงข้างและกางบนหน้า (`RecruitOverviewV2`) */
export function AudiencePane({
  pane,
  model,
  bus,
  push,
  replace,
  compact = false,
}: {
  pane: Extract<V2Pane, { kind: 'audience' }>;
  model: V2Model;
  bus: readonly string[];
  push: (p: V2Pane) => void;
  replace: (p: V2Pane) => void;
  /** กางบนหน้า — ไม่ซ้ำยอดรวม/กราฟเทียบ BU ที่หน้ามีแล้ว · เหลือตัวเลือก + ตาราง */
  compact?: boolean;
}) {
  const facts = applyAudience(model.cohort, pane.filter, model.sets);
  const cmp = buCompare(facts, pane.filter.bu ? [pane.filter.bu] : bus, pane.measure, pane.display, model.sets);
  const rate = pane.display === 'rate';
  const bars = sortBars(cmp.bars);
  const view = pane.view;
  const rows = view === 'records' ? [] : audienceRows(facts, view, model.sets, pane.measure, pane.display);
  const pg = pageOf(rows, pane.page);
  const withFilter = (extra: Partial<AudienceFilter>): AudienceFilter => ({ ...pane.filter, ...extra, dims: { ...pane.filter.dims, ...(extra.dims ?? {}) }, results: extra.results ?? pane.filter.results });
  return (
    <>
      <div className="flex flex-wrap gap-3" data-testid="v2-audience-controls">
        <label className="space-y-1 text-xs">
          <span className={DASH.sub}>{compact ? 'เรียงตาม' : 'ดูผลและเทียบ BU'}</span>
          <Select value={pane.measure} onValueChange={(v) => replace({ ...pane, measure: v as AudienceMeasure, page: 1 })}>
            <SelectTrigger className="h-9 w-44" aria-label="ยอดที่ใช้เปรียบเทียบ BU">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_MEASURES.map((m) => (
                <SelectItem key={m} value={m}>
                  {AUDIENCE_MEASURE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1 text-xs">
          <span className={DASH.sub}>แสดง</span>
          <Select value={pane.display} onValueChange={(v) => replace({ ...pane, display: v as AudienceDisplay, page: 1 })}>
            <SelectTrigger className="h-9 w-44" aria-label="รูปแบบเปรียบเทียบ BU">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">จำนวน</SelectItem>
              <SelectItem value="rate">% ของรายการสมัคร</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
      {compact ? null : (
      <>
      <div className="flex items-baseline justify-between">
        <span className={cn('text-sm', DASH.muted)}>รวมทั้งหมด</span>
        <span className="text-3xl font-medium tabular-nums" data-testid="v2-audience-total">
          {rate ? fmtPct(cmp.total) : fmt(cmp.total)}
          <span className={cn('ml-1 text-sm font-normal', DASH.sub)}>{rate ? `(${fmt(cmp.totalResult)} จาก ${fmt(cmp.totalSample)} รายการ)` : 'รายการสมัคร'}</span>
        </span>
      </div>
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">เทียบแต่ละ BU</h3>
          {bars[0]?.value ? (
            <span className={cn('text-xs', DASH.sub)}>
              มากสุด {bars[0].bu} · {rate ? fmtPct(bars[0].value) : `${fmt(bars[0].value)} รายการ`}
            </span>
          ) : null}
        </div>
        <BuBars bars={bars} unit="รายการ" rate={rate} showSample onPick={pane.filter.bu ? undefined : (bu) => push({ ...pane, filter: withFilter({ bu }), page: 1, title: `ผู้สมัครกลุ่มนี้ · ${bu}` })} />
        <p className={cn('text-xs', DASH.sub)}>
          {AUDIENCE_MEASURE_LABEL[pane.measure]} · {rate ? '% = ผลที่เลือก / รายการสมัครของ BU นั้น · รวม = ผลรวม / รายการรวม' : 'จำนวนรายการที่มีผลตามที่เลือก'} · ผลถึงวันสิ้นสุดที่เลือก
        </p>
      </section>
      <AudienceSummary facts={facts} onView={(v) => push({ ...pane, view: v, page: 1 })} />
      </>
      )}
      {view === 'records' ? (
        <NamesList ids={facts.map((f) => f.id ?? '')} page={pane.page} onPage={(page) => replace({ ...pane, page })} model={model} />
      ) : (
        <section className="space-y-2" data-testid="v2-audience-table">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{AUDIENCE_DIM_LABEL[view]}</TableHead>
                  {AUDIENCE_MEASURES.map((m) => (
                    <TableHead key={m} className="text-right">
                      {AUDIENCE_MEASURE_LABEL[m]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pg.slice.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className={DASH.muted}>
                      ไม่มีรายการ
                    </TableCell>
                  </TableRow>
                ) : (
                  pg.slice.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left text-sm font-medium text-primary hover:underline"
                          onClick={() => {
                            const next = NEXT_DIM[view];
                            push({ ...pane, view: next, filter: withFilter({ dims: { [view]: r.key } }), page: 1, title: 'ผู้สมัครกลุ่มนี้' });
                          }}
                        >
                          {r.key}
                        </button>
                      </TableCell>
                      {AUDIENCE_MEASURES.map((m) => (
                        <TableCell key={m} className="text-right">
                          <button
                            type="button"
                            disabled={r.counts[m] === null}
                            aria-label={`${r.key} ${AUDIENCE_MEASURE_LABEL[m]} ${r.counts[m] === null ? 'ไม่มีข้อมูล' : `${fmt(r.counts[m])} รายการ`}`}
                            className="ml-auto flex flex-col items-end rounded-md px-1 hover:bg-muted/60 disabled:cursor-default"
                            onClick={() =>
                              push({
                                ...pane,
                                view: 'records',
                                filter: withFilter({ dims: { [view]: r.key }, results: m === 'apps' ? pane.filter.results : [...new Set([...pane.filter.results, m])] }),
                                page: 1,
                                title: `รายชื่อ · ${AUDIENCE_MEASURE_LABEL[m]}`,
                              })
                            }
                          >
                            <span className="text-sm font-medium tabular-nums">{fmt(r.counts[m])}</span>
                            <span className={cn('text-xs tabular-nums', DASH.sub)}>{fmtPct(r.rates[m])}</span>
                          </button>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <Pager {...pg} onPage={(page) => replace({ ...pane, page })} testId="v2-audience-pager" />
          <p className={cn('text-xs', DASH.sub)}>
            เรียงตาม{AUDIENCE_MEASURE_LABEL[pane.measure]} {rate ? '%' : 'จำนวน'}มากไปน้อย · % แต่ละช่อง = ผลนั้น / รายการสมัครของแถวนั้น · สนใจ = ผลหลัง AI โทร · ERP = เบอร์ที่ถูกแจ้งเข้าปีนี้
          </p>
        </section>
      )}
    </>
  );
}

/** รายชื่อทีละ 10 — ดึงชื่อเฉพาะหน้าที่เปิด (เส้นตรวจสิทธิ์ BU ฝั่ง server) · ไม่มีข้อมูลบอกว่าไม่มี */
export function NamesList({ ids, page, onPage, model, labels }: { ids: readonly string[]; page: number; onPage: (p: number) => void; model: V2Model; labels?: Record<string, string> }) {
  const sorted = React.useMemo(() => {
    const fact = (id: string) => model.byId.get(id);
    // ลำดับแน่นอน: ใบใหม่ก่อน · เวลาเท่ากันเรียงด้วย id
    return [...new Set(ids)].filter(Boolean).sort((a, b) => (fact(b)?.createdAt ?? '').localeCompare(fact(a)?.createdAt ?? '') || a.localeCompare(b));
  }, [ids, model]);
  const pg = pageOf(sorted, page);
  const key = pg.slice.join(',');
  const [rows, setRows] = React.useState<{ key: string; data: ApplicantNameRow[] | null; error: string | null }>({ key: '', data: null, error: null });
  React.useEffect(() => {
    if (!key) return;
    let alive = true;
    setRows({ key, data: null, error: null });
    fetchApplicantNames(key.split(','))
      .then((data) => alive && setRows({ key, data, error: null }))
      .catch((e: unknown) => alive && setRows({ key, data: null, error: e instanceof Error ? e.message : 'โหลดรายชื่อไม่ได้' }));
    return () => {
      alive = false;
    };
  }, [key]);
  const byId = new Map((rows.key === key ? rows.data ?? [] : []).map((r) => [r.id, r]));
  return (
    <div className="space-y-1" data-testid="v2-names">
      <ul className="divide-y rounded-xl border">
        {pg.slice.length === 0 ? <li className={cn('px-3 py-3 text-sm', DASH.muted)}>ไม่มีรายการ</li> : null}
        {pg.slice.map((id) => {
          const f = model.byId.get(id);
          const r = byId.get(id);
          return (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <div className="min-w-0 text-sm">
                <div className="font-medium">{rows.key !== key ? 'กำลังโหลด…' : r?.full_name || 'ไม่พบชื่อ'}</div>
                {labels?.[id] ? <div className="text-xs font-medium text-primary">{labels[id]}</div> : null}
                <div className={cn('text-xs', DASH.sub)}>
                  {[f?.bu || 'ไม่ระบุ BU', r?.unit_name || r?.job_title || 'ยังไม่ผูกใบขอ', f ? dimValueOf(f, 'sub') : null, r?.claimed_by ? `อยู่กับ ${r.claimed_by}` : 'ยังไม่มีคนเก็บ']
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              <Button asChild size="xs" variant="outline">
                <Link to={applicantWorkLink(id)}>
                  <ExternalLink aria-hidden /> เปิด
                </Link>
              </Button>
            </li>
          );
        })}
      </ul>
      {rows.error ? <p className="text-sm text-destructive">{rows.error}</p> : null}
      <Pager {...pg} onPage={onPage} testId="v2-names-pager" />
    </div>
  );
}

/**
 * ใบขอที่กดมา → กราฟแท่งตั้งเทียบ BU ก่อน กดแท่ง BU = รายการใบของ BU นั้น (Back กลับมากราฟ)
 * เจ้าของ 18 พ.ย. 2569 "กดช่องพวกนี้ปุ้บ มันต้องขึ้นกราฟแท่ง ที่เปรียบเทียบของแต่ละ Bu ให้ดูทันที แล้วถ้ากด Bu ไหนค่อยขึ้น(รายการใบ)"
 * มี BU เดียว / กด BU มาแล้ว = รายการใบเลย
 */
function RequestsByBu({ pane, push, replace }: { pane: Extract<V2Pane, { kind: 'requests' }>; push: (p: V2Pane) => void; replace: (p: V2Pane) => void }) {
  const byBu = new Map<string, StuckRequest[]>();
  for (const r of pane.rows) {
    const k = r.bu?.trim() || BU_UNKNOWN;
    byBu.set(k, [...(byBu.get(k) ?? []), r]);
  }
  if (pane.bu || byBu.size <= 1) return <RequestList rows={pane.rows} page={pane.page} onPage={(page) => replace({ ...pane, page })} />;
  const groups = [...byBu.entries()].map(([k, rows]) => ({ key: k, byMonth: { all: rows.length } })).sort((a, b) => b.byMonth.all - a.byMonth.all);
  const remaining = pane.rows.reduce((n, r) => n + (r.remaining ?? 0), 0);
  return (
    <section className="space-y-3" data-testid="v2-requests-by-bu">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">
          {fmt(pane.rows.length)} ใบ · เหลือหา {fmt(remaining)} อัตรา · แยกตาม BU
        </h3>
        <Button type="button" size="xs" variant="outline" onClick={() => push({ ...pane, bu: 'ทุก BU', title: `${pane.title} · ทุก BU`, page: 1 })}>
          ดูรายการทั้งหมด
        </Button>
      </div>
      <MonthCompareBars
        groups={groups}
        months={['all']}
        unit="ใบ"
        seriesName={() => 'ใบขอ'}
        onPick={(bu) => push({ kind: 'requests', title: `${pane.title} · ${bu}`, rows: byBu.get(bu) ?? [], page: 1, bu })}
        testId="v2-requests-bu-chart"
      />
    </section>
  );
}

const STATE_LABEL: Record<string, string> = { open: 'ดำเนินการ', filled: 'ปิดใบขอ', cancelled: 'ยกเลิกใบขอ' };

/** ใบขอทีละ 10 — เลขใบ · หน่วยงาน · BU · ผู้รับผิดชอบ · สถานะ · อายุค้าง · อัตรา · ทางไปหน้าใบขอจริง */
function RequestList({ rows, page, onPage }: { rows: readonly StuckRequest[]; page: number; onPage: (p: number) => void }) {
  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo)),
    [rows],
  );
  const pg = pageOf(sorted, page);
  return (
    <div className="space-y-1" data-testid="v2-requests">
      <ul className="divide-y rounded-xl border">
        {pg.slice.length === 0 ? <li className={cn('px-3 py-3 text-sm', DASH.muted)}>ไม่มีรายการ</li> : null}
        {pg.slice.map((r) => (
          <li key={`${r.jobId ?? ''}:${r.requestNo}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0 text-sm">
              <div className="font-medium">
                {r.requestNo} · {r.unitName || 'ไม่พบชื่อหน่วยงาน'}
              </div>
              <div className={cn('text-xs', DASH.sub)}>
                {[
                  r.bu || 'ไม่ระบุ BU',
                  r.position || null,
                  r.recruiter?.trim() ? `ผู้รับผิดชอบ ${r.recruiter}` : 'ยังไม่ตั้งผู้รับผิดชอบ',
                  STATE_LABEL[r.state ?? 'open'] ?? r.state,
                  POSTING_STATE_LABEL[postingStateOf(r)],
                  r.ageDays === null ? null : `ค้าง ${fmt(r.ageDays)} วัน`,
                  `ขอ ${fmt(r.requested)} · หาได้ ${fmt(r.filled)} · ยกเลิก ${fmt(r.cancelled)} · เหลือหา ${fmt(r.remaining)} อัตรา`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
            {r.jobId ? (
              <Button asChild size="xs" variant="outline">
                <Link to={requestPathOfJobId(r.jobId)}>
                  <ExternalLink aria-hidden /> เปิด
                </Link>
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Pager {...pg} onPage={onPage} testId="v2-requests-pager" />
    </div>
  );
}
