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
import { DASH, TONE } from '@/lib/designTokens';
import { applicantWorkLink } from '@/lib/recruitRm';
import { fetchApplicantNames, type ApplicantNameRow, type TodoBucket } from '@/lib/recruitOverviewApi';
import TodoPane from './TodoPane';
import type { StuckRequest } from '@/lib/recruitStuck';
import { requestPathOfJobId } from '@/lib/jobNavigation';
import { MonthCompareBars } from './MonthCompareBars';
import DateRangeCalendarPicker, { type DateRangeYmd } from '@/components/shared/DateRangeCalendarPicker';
import { thaiDate } from '@/lib/periodPick';
import { POSTING_STATE_LABEL, postingStateOf } from '@/lib/recruitPostingState';
import {
  AUDIENCE_DIM_LABEL,
  BU_UNKNOWN,
  AUDIENCE_MEASURES,
  AUDIENCE_MEASURE_LABEL,
  applyAudience,
  audienceRows,
  buCompare,
  dimValueOf,
  pageOf,
  type AudienceDim,
  type AudienceDisplay,
  type AudienceFilter,
  type AudienceMeasure,
} from '@/lib/recruitAudience';
import { BuBars, Pager, fmt, fmtPct } from './V2Parts';
import type { V2Model } from './v2Model';

export type V2Pane =
  | { kind: 'audience'; view: AudienceDim | 'records'; filter: AudienceFilter; measure: AudienceMeasure; display: AudienceDisplay; page: number; title: string }
  | { kind: 'names'; title: string; ids: string[]; page: number; /** สถานะของแต่ละชื่อ (ใบขอที่กดจากการประกาศ) */ labels?: Record<string, string>; /** BU ที่กด — ไม่มี = ทุก BU */ bu?: string }
  | { kind: 'requests'; title: string; rows: StuckRequest[]; page: number; /** BU ที่กดจากกราฟ — มี = รายการใบ · ไม่มี + หลาย BU = กราฟเทียบ BU ก่อน */ bu?: string }
  /** การ์ด "ต้องทำ" (19 พ.ย. 2569) — กราฟ BU + รายชื่อ + ปุ่มทำทีละแถว · `listHref` = หน้าผู้สมัครคนชุดเดียวกัน */
  | { kind: 'todo'; title: string; todo: TodoBucket; listHref: string }
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
  bu = null,
  onPublish,
}: {
  /** BU ที่เลือกบนหน้า (แผงการ์ดต้องทำดึงคนของ BU นี้) */
  bu?: string | null;
  /** ปุ่ม "ประกาศ" ในรายการใบขอ — เปิดป๊อปประกาศของใบนั้นบนหน้านี้ (ปิดแผงก่อน ไม่ซ้อนป๊อป) */
  onPublish?: (jobId: string) => void;
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
              <SheetTitle className="text-lg font-medium">{pane.title}</SheetTitle>
              <SheetDescription className={cn('text-xs', DASH.sub)}>
                {periodText} · {buText}
                {pane.kind === 'audience' && filterLabel(pane.filter) ? ` / ${filterLabel(pane.filter)}` : ''}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-5 py-4">
              {pane.kind === 'audience' ? <AudiencePane pane={pane} model={model} bus={bus} push={push} replace={replace} /> : null}
              {pane.kind === 'names' ? <NamesByBu pane={pane} replace={replace} model={model} /> : null}
              {pane.kind === 'requests' ? (
                <RequestsByBu pane={pane} push={push} replace={replace} onPublish={onPublish} />
              ) : null}
              {pane.kind === 'todo' ? <TodoPane key={pane.todo} todo={pane.todo} bu={bu} listHref={pane.listHref} /> : null}
              {pane.kind === 'embed' ? (embeds[pane.embed] ?? null) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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

const ALL_BU = 'ทุก BU';
/**
 * รายชื่อที่กดมา → กราฟแท่งแยก BU + ปุ่ม BU ก่อน · รายชื่อรวมขึ้นเลย · กด BU = เหลือคนของ BU นั้น
 * (เจ้าของ 19 พ.ย. 2569 กล่องรายชื่อเข้ามา "อยากกดแล้วเห็นแยก Bu ก่อน พอกดแต่ละ Bu ค่อยโชว์ยอดของ Bu นั้นๆ") · BU เดียว = รายชื่อเลย
 */
function NamesByBu({ pane, replace, model }: { pane: Extract<V2Pane, { kind: 'names' }>; replace: (p: V2Pane) => void; model: V2Model }) {
  const buOf = React.useCallback((id: string) => model.byId.get(id)?.bu?.trim() || BU_UNKNOWN, [model]);
  const ids = React.useMemo(() => [...new Set(pane.ids)].filter(Boolean), [pane.ids]);
  const groups = React.useMemo(() => {
    const by = new Map<string, number>();
    for (const id of ids) by.set(buOf(id), (by.get(buOf(id)) ?? 0) + 1);
    return [...by.entries()].map(([key, n]) => ({ key, byMonth: { all: n } })).sort((a, b) => b.byMonth.all - a.byMonth.all || a.key.localeCompare(b.key));
  }, [ids, buOf]);
  const pick = pane.bu ?? ALL_BU;
  const shown = React.useMemo(() => (pick === ALL_BU ? ids : ids.filter((id) => buOf(id) === pick)), [ids, pick, buOf]);
  const choose = (bu: string) => replace({ ...pane, bu: bu === ALL_BU ? undefined : bu, page: 1 });
  return (
    <section className="space-y-3" data-testid="v2-names-by-bu">
      {groups.length > 1 ? (
        <>
          <h3 className="text-sm font-medium">{fmt(ids.length)} คน · แยกตาม BU</h3>
          <MonthCompareBars groups={groups} months={['all']} unit="คน" seriesName={() => 'คน'} onPick={choose} testId="v2-names-bu-chart" />
          <div className="flex flex-wrap items-center gap-2">
            {[{ key: ALL_BU, n: ids.length }, ...groups.map((g) => ({ key: g.key, n: g.byMonth.all }))].map((g) => (
              <Button key={g.key} type="button" size="xs" variant={pick === g.key ? 'default' : 'outline'} onClick={() => choose(g.key)}>
                {g.key} {fmt(g.n)}
              </Button>
            ))}
          </div>
        </>
      ) : null}
      <NamesList ids={shown} page={pane.page} onPage={(page) => replace({ ...pane, page })} model={model} labels={pane.labels} />
    </section>
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
  /** ยังโหลดไม่เสร็จ = "กำลังโหลด…" (เดิมขึ้น "ไม่พบชื่อ" ระหว่างรอ · เจ้าของ 18 พ.ย. 2569) · โหลดไม่ได้ = บอกตรง ๆ */
  const nameState = rows.key !== key || (rows.data === null && !rows.error) ? 'loading' : rows.error ? 'error' : 'ready';
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
                <div className="font-medium">{nameState === 'loading' ? 'กำลังโหลด…' : nameState === 'error' ? 'โหลดชื่อไม่ได้' : r?.full_name || 'ไม่พบชื่อ'}</div>
                {labels?.[id] ? <div className="text-xs font-medium text-primary">{labels[id]}</div> : null}
                <div className={cn('text-xs', DASH.sub)}>
                  {[
                    f?.bu || 'ไม่ระบุ BU',
                    // ช่องที่มาจากชื่อ (ใบขอ · คนเก็บ) ยังไม่รู้ระหว่างโหลด — ห้ามขึ้น "ยังไม่ผูกใบขอ" / "ยังไม่มีคนเก็บ" ก่อนได้ข้อมูล
                    nameState === 'ready' ? r?.unit_name || r?.job_title || 'ยังไม่ผูกใบขอ' : null,
                    f ? dimValueOf(f, 'sub') : null,
                    nameState === 'ready' ? (r?.claimed_by ? `อยู่กับ ${r.claimed_by}` : 'ยังไม่มีคนเก็บ') : null,
                  ]
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
 * ใบขอที่กดมา → กราฟแท่งตั้งเทียบ BU · กรองวันที่ใบเข้ามาได้ · กดแท่ง BU = รายการใบใต้กราฟในหน้าเดิม (ไม่เด้งหน้าใหม่)
 * เจ้าของ 18 พ.ย. 2569 "กดช่องพวกนี้ปุ้บ มันต้องขึ้นกราฟแท่ง ที่เปรียบเทียบของแต่ละ Bu" + "Fil ดูวันที่ไม่ได้ทำให้ Fil ได้
 * แล้ว พอกด Bu ไหนก็ไม่ต้องให้มันเด้งไปอีกหน้า เอาชื่อลงมาเลย บอกด้วยว่าค้างมานานแค่ไหนแล้ว โชว์รายละเอียดแบบหน้าใบขอ"
 * มี BU เดียว / มาจากกด BU แล้ว = รายการใบเลย
 */
function RequestsByBu({
  pane,
  replace,
  onPublish,
}: {
  pane: Extract<V2Pane, { kind: 'requests' }>;
  push: (p: V2Pane) => void;
  replace: (p: V2Pane) => void;
  onPublish?: (jobId: string) => void;
}) {
  const [range, setRange] = React.useState<DateRangeYmd | null>(null);
  // รายการรวมขึ้นก่อน · กดแท่ง/ปุ่ม BU = เหลือ BU นั้น (เจ้าของ 19 พ.ย. 2569 "ขึ้นรวมก่อนแล้วกด Bu ไหนก็เป็นของ BU นั้นๆ")
  const [bu, setBu] = React.useState<string>('ทุก BU');
  const inRange = (r: StuckRequest) => !range || !r.day || ((!range.from || r.day >= range.from) && (!range.to || r.day <= range.to));
  const rows = pane.rows.filter(inRange);
  const byBu = new Map<string, StuckRequest[]>();
  for (const r of rows) {
    const k = r.bu?.trim() || BU_UNKNOWN;
    byBu.set(k, [...(byBu.get(k) ?? []), r]);
  }
  const allBus = new Set(pane.rows.map((r) => r.bu?.trim() || BU_UNKNOWN));
  if (pane.bu || allBus.size <= 1) return <RequestList rows={rows} page={pane.page} onPage={(page) => replace({ ...pane, page })} onPublish={onPublish} />;
  const groups = [...allBus].map((k) => ({ key: k, byMonth: { all: byBu.get(k)?.length ?? 0 } })).sort((x, y) => y.byMonth.all - x.byMonth.all);
  const shown = bu === 'ทุก BU' ? rows : byBu.get(bu) ?? [];
  const remaining = rows.reduce((n, r) => n + (r.remaining ?? 0), 0);
  return (
    <section className="space-y-3" data-testid="v2-requests-by-bu">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          {fmt(rows.length)} ใบ · เหลือหา {fmt(remaining)} อัตรา · แยกตาม BU
        </h3>
        <DateRangeCalendarPicker triggerVariant="filter" value={range} onChange={setRange} emptyLabel="ทุกวันที่ใบเข้า" />
      </div>
      <MonthCompareBars groups={groups} months={['all']} unit="ใบ" seriesName={() => 'ใบขอ'} onPick={(k) => setBu(k)} testId="v2-requests-bu-chart" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant={bu === 'ทุก BU' ? 'default' : 'outline'} onClick={() => setBu('ทุก BU')}>
          ทุก BU {fmt(rows.length)}
        </Button>
        {groups.map((g) => (
          <Button key={g.key} type="button" size="xs" variant={bu === g.key ? 'default' : 'outline'} onClick={() => setBu(g.key)}>
            {g.key} {fmt(g.byMonth.all)}
          </Button>
        ))}
      </div>
      <RequestList key={`${bu}:${range?.from ?? ''}:${range?.to ?? ''}`} rows={shown} page={1} onPublish={onPublish} />
    </section>
  );
}

const STATE_LABEL: Record<string, string> = { open: 'ยังเปิด', filled: 'ปิดครบใบขอ', cancelled: 'ยกเลิกใบขอ' };

/** ใบขอทีละ 10 — รายละเอียดแบบหน้าใบขอ: ค้างกี่วัน · หน่วยงาน · ตำแหน่ง · พื้นที่ · ผู้รับผิดชอบ · ประกาศ · คนสมัคร · อัตรา · ทางไปหน้าใบขอจริง */
function RequestList({ rows, page, onPage, onPublish }: { rows: readonly StuckRequest[]; page: number; onPage?: (p: number) => void; onPublish?: (jobId: string) => void }) {
  const [own, setOwn] = React.useState(page);
  const cur = onPage ? page : own;
  const sorted = React.useMemo(
    () => [...rows].sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo)),
    [rows],
  );
  const pg = pageOf(sorted, cur);
  return (
    <div className="space-y-1" data-testid="v2-requests">
      <ul className="divide-y rounded-xl border">
        {pg.slice.length === 0 ? <li className={cn('px-3 py-3 text-sm', DASH.muted)}>ไม่มีรายการ</li> : null}
        {pg.slice.map((r) => (
          <li key={`${r.jobId ?? ''}:${r.requestNo}`} className="space-y-1.5 px-3 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  {r.requestNo} · {r.unitName || 'ไม่พบชื่อหน่วยงาน'}
                </div>
                <div className={cn('text-xs', DASH.sub)}>{[r.bu || 'ไม่ระบุ BU', r.position || null, r.siteName || null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {r.ageDays === null ? null : (
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums', r.ageDays > 30 ? cn(TONE.warn.soft, TONE.warn.value) : DASH.sub)}>
                    ค้าง {fmt(r.ageDays)} วัน
                  </span>
                )}
                {r.jobId && onPublish && r.state !== 'filled' && r.state !== 'cancelled' ? (
                  <Button type="button" size="xs" onClick={() => r.jobId && onPublish(r.jobId)} data-testid="v2-request-publish">
                    ประกาศ
                  </Button>
                ) : null}
                {r.jobId ? (
                  <Button asChild size="xs" variant="outline">
                    <Link to={requestPathOfJobId(r.jobId)}>
                      <ExternalLink aria-hidden /> เปิด
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs sm:grid-cols-3">
              {(
                [
                  ['วันที่ใบเข้า', r.day ? thaiDate(r.day) : '—'],
                  ['พื้นที่', [r.province, r.district].filter(Boolean).join(' · ') || '—'],
                  ['ผู้รับผิดชอบ', r.recruiter?.trim() || 'ยังไม่ตั้ง'],
                  ['สถานะ', STATE_LABEL[r.state ?? 'open'] ?? r.state ?? '—'],
                  ['การประกาศ', r.released ? 'ประกาศแล้ว' : 'ยังไม่ประกาศ'],
                  ['หลักฐานการออกหาคน', POSTING_STATE_LABEL[postingStateOf(r)]],
                  ['คนสมัคร', `${fmt(r.applications ?? 0)} คน`],
                  ['อัตรา', `ขอ ${fmt(r.requested)} · หาได้ ${fmt(r.filled)} · ยกเลิก ${fmt(r.cancelled)} · เหลือหา ${fmt(r.remaining)}`],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-1">
                  <dt className={cn('shrink-0', DASH.sub)}>{k}</dt>
                  <dd className="min-w-0 truncate tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
      <Pager {...pg} onPage={onPage ?? setOwn} testId="v2-requests-pager" />
    </div>
  );
}
