/**
 * ═══ ก้อนใบขอของภาพรวมงานสรรหา (เจ้าของ 19 พ.ย. 2569 แบบร่าง → "เอาขึ้นระบบเลย") ═══
 * > *"2 ก้อนนี้รวมเป็น Dropdown เลยเลือกอันไหนขึ้นกราฟแยก Bu"* · *"ต้อง Filter เจ้าหน้าที่สรรหาได้ เจ้าหน้าที่คัดสรรได้"* ·
 * > *"แยกล่วงหน้าออกมาด้วย"* (Filter เลือกหลายอันได้) · *"ไม่ต้องเด้ง Popup แล้วเอามาโชว์ด้านล่างเลยแต่โชว์แค่หน้าละ 10 แถว"* ·
 * > *"Ai สนใจ กับ นัดได้ถ้ากดต้องเด้ง Pop up อันนั้นให้ดู"*
 * เรื่อง = สมการใบขอ (ยกมา · ขอใหม่ · หาได้แล้ว · ยกเลิก · เหลือหา) + เหลือหาแยกสถานะทำงาน (`workStatusOfRemaining`) · ค่าเริ่ม กำลังดำเนินการสรรหา
 * ตัวกรองคัดใบก่อนทุกอย่าง ⇒ สมการ/สถานะ/กราฟ/ตารางเป็นใบชุดเดียวกันเสมอ
 * สีเรื่อง `REQUEST_TOPIC_HEX` (จุด + เลขใหญ่) · สีแท่ง/สัดส่วน = สีประจำ BU (`buHex`)
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, REQUEST_TOPIC_HEX, TONE, type ToneKey } from '@/lib/designTokens';
import { BU_UNKNOWN, pageOf } from '@/lib/recruitAudience';
import { recruiterLabelOf, stuckEquation, type StuckRequest } from '@/lib/recruitStuck';
import { REQUEST_LEAD_KIND_LABEL, type RequestLeadKind } from '@/lib/requestLeadKind';
import { STATUS_TOTAL_ID, workStatusOfRemaining } from '@/lib/workStatusOfRemaining';
import type { JobRequest } from '@/types';
import { Pager, buHex, fmt } from './V2Parts';

type Field = 'requested' | 'filled' | 'cancelled' | 'remaining';
type Topic = { key: string; label: string; field: Field; rows: StuckRequest[]; group: 'eq' | 'status' };
type FilterKey = 'rec' | 'scr' | 'kind';

const NO_SCREENER = 'ยังไม่ได้ตั้งเจ้าหน้าที่คัดสรร';
const NO_KIND = 'ไม่ระบุ';
const KIND_ORDER: RequestLeadKind[] = ['advance', 'urgent', 'retroactive'];
const valueOf: Record<FilterKey, (r: StuckRequest) => string> = {
  rec: recruiterLabelOf,
  scr: (r) => r.screener?.trim() || NO_SCREENER,
  kind: (r) => (r.leadKind ? REQUEST_LEAD_KIND_LABEL[r.leadKind] : NO_KIND),
};
const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'rec', label: 'เจ้าหน้าที่สรรหา' },
  { key: 'scr', label: 'เจ้าหน้าที่คัดสรร' },
  { key: 'kind', label: 'ชนิดใบ' },
];
const KIND_TONE: Record<RequestLeadKind, ToneKey> = { advance: 'success', urgent: 'warn', retroactive: 'danger' };
const DEFAULT_TOPIC = 'work_status_in_progress';
const topicHex = (key: string) => REQUEST_TOPIC_HEX[key] ?? REQUEST_TOPIC_HEX.work_status_none;
const buKey = (r: StuckRequest) => r.bu?.trim() || BU_UNKNOWN;
const BU_ORDER = ['LBD', 'LBA', 'LM', 'SN', 'DS', 'CR'];
const buRank = (b: string) => (b === BU_UNKNOWN ? 99 : BU_ORDER.indexOf(b) < 0 ? 50 : BU_ORDER.indexOf(b));
const sumOf = (rows: readonly StuckRequest[], f: Field) => rows.reduce((n, r) => n + (Number(r[f]) || 0), 0);
const aiYesOf = (r: StuckRequest) => r.aiYesIds?.length ?? r.signals?.counts?.aiYes ?? 0;
const apptOf = (r: StuckRequest) => r.apptIds?.length ?? r.signals?.counts?.appointed ?? 0;

export default function RequestBuPanel({
  rows,
  jobs,
  bus,
  rangeText,
  error,
  onOpenRequest,
  onNames,
  resetKey,
}: {
  /** ใบชุดเดียวกับสมการ (`recruit-stuck`) · null = ยังโหลด */
  rows: readonly StuckRequest[] | null;
  /** ใบขอเส้นเดียวกับ Dashboard — อ่านสถานะทำงาน · null = ยังโหลด */
  jobs: readonly JobRequest[] | null;
  bus: readonly string[];
  rangeText: string;
  error: string | null;
  onOpenRequest: (jobId: string) => void;
  onNames: (title: string, ids: readonly string[]) => void;
  resetKey: string;
}) {
  const [picked, setPicked] = React.useState<Record<FilterKey, string[]>>({ rec: [], scr: [], kind: [] });
  const [topicKey, setTopicKey] = React.useState(DEFAULT_TOPIC);
  const [bu, setBu] = React.useState<string | null>(null);
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    setBu(null);
    setPage(1);
  }, [resetKey]);
  React.useEffect(() => setPage(1), [picked, topicKey, bu, q]);

  const pass = React.useCallback(
    (r: StuckRequest, skip?: FilterKey) => FILTERS.every((f) => f.key === skip || !picked[f.key].length || picked[f.key].includes(valueOf[f.key](r))),
    [picked],
  );
  const kept = React.useMemo(() => (rows ? rows.filter((r) => pass(r)) : null), [rows, pass]);
  const eq = React.useMemo(() => (kept ? stuckEquation(kept) : null), [kept]);
  const topics = React.useMemo<Topic[]>(() => {
    if (!kept || !eq) return [];
    const list: Topic[] = [
      { key: 'carried', label: 'ยอดยกมา', field: 'requested', rows: eq.carried, group: 'eq' },
      { key: 'new', label: 'ขอใหม่', field: 'requested', rows: eq.new, group: 'eq' },
      { key: 'filled', label: 'หาได้แล้ว', field: 'filled', rows: kept.filter((r) => r.filled > 0), group: 'eq' },
      { key: 'cancelled', label: 'ยกเลิก', field: 'cancelled', rows: kept.filter((r) => r.cancelled > 0), group: 'eq' },
      { key: 'remaining', label: 'เหลือหา', field: 'remaining', rows: eq.remaining, group: 'eq' },
    ];
    if (jobs) for (const b of workStatusOfRemaining(eq.remaining, jobs)) if (b.id !== STATUS_TOTAL_ID) list.push({ key: b.id, label: b.label, field: 'remaining', rows: b.rows, group: 'status' });
    return list;
  }, [kept, eq, jobs]);
  // สถานะยังไม่มา (เส้นใบขอยังโหลด) = โชว์เหลือหาไปก่อน
  const topic = topics.find((t) => t.key === topicKey) ?? topics.find((t) => t.key === 'remaining') ?? null;

  /** ใบขอ/ปิดครบ/ยกเลิกทั้งใบ — บรรทัดรองของแต่ละเรื่อง (ปิดครบ = ใบที่จบเป็นปิดแล้ว ตัวเดียวกับการ์ดเดิม) */
  const subOf = (t: Topic, onlyBu?: string | null) => {
    const inBu = (r: StuckRequest) => !onlyBu || buKey(r) === onlyBu;
    if (t.key === 'filled' && eq) return `ปิดครบ ${fmt(eq.filled.filter(inBu).length)} ใบ`;
    if (t.key === 'cancelled' && eq) return `ยกเลิกทั้งใบ ${fmt(eq.cancelled.filter(inBu).length)} ใบ`;
    return `${fmt(t.rows.filter(inBu).length)} ใบ`;
  };

  // ไม่ระบุ BU ขึ้นเฉพาะเมื่อมีใบแบบนั้นจริง (BU อื่นอยู่เสมอ ว่าง = 0)
  // ลำดับคงที่ BU ใหญ่ซ้ายสุด (ภาพรวมจริง 19 พ.ย. 2569 ขึ้น SN DS LM LBA LBD ตามลำดับสิทธิ์ผู้ใช้)
  const busShown = bus
    .filter((b) => b !== BU_UNKNOWN || (rows ?? []).some((r) => buKey(r) === BU_UNKNOWN))
    .sort((a, b) => buRank(a) - buRank(b));
  const byBu = topic
    ? busShown.map((b) => {
        const list = topic.rows.filter((r) => buKey(r) === b);
        return { bu: b, rows: list, v: sumOf(list, topic.field) };
      })
    : [];
  const total = topic ? sumOf(topic.rows, topic.field) : 0;
  const max = Math.max(1, ...byBu.map((b) => b.v));
  const step = max > 200 ? 50 : max > 100 ? 25 : max > 40 ? 10 : max > 10 ? 5 : 1;
  const top = Math.ceil((max * 1.1) / step) * step;
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const pickBu = (b: string) => setBu((cur) => (cur === b ? null : b));

  const listAll = React.useMemo(() => {
    if (!topic) return [];
    const needle = q.trim().toLowerCase();
    return topic.rows
      
      .filter((r) => (!bu || buKey(r) === bu) && (!needle || `${r.requestNo} ${r.unitName ?? ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1) || a.requestNo.localeCompare(b.requestNo));
  }, [topic, bu, q]);
  const scope = topic ? topic.rows.filter((r) => !bu || buKey(r) === bu) : [];
  const aged = scope.filter((r) => r.ageDays != null);
  const pg = pageOf(listAll, page);

  const filterButton = (f: { key: FilterKey; label: string }) => {
    const all = rows ?? [];
    const counts = new Map<string, number>();
    for (const r of all) if (pass(r, f.key)) counts.set(valueOf[f.key](r), (counts.get(valueOf[f.key](r)) ?? 0) + 1);
    const values =
      f.key === 'kind'
        ? [...KIND_ORDER.map((k) => REQUEST_LEAD_KIND_LABEL[k]), ...(all.some((r) => !r.leadKind) ? [NO_KIND] : [])]
        : [...new Set(all.map(valueOf[f.key]))].sort(
            (a, b) => Number(a === NO_SCREENER || a === recruiterLabelOf({ recruiter: null })) - Number(b === NO_SCREENER || b === recruiterLabelOf({ recruiter: null })) || (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || a.localeCompare(b, 'th'),
          );
    const sel = picked[f.key];
    const toggle = (v: string, on: boolean) => setPicked((cur) => ({ ...cur, [f.key]: on ? [...cur[f.key], v] : cur[f.key].filter((x) => x !== v) }));
    return (
      <Popover key={f.key}>
        <PopoverTrigger asChild>
          <Button type="button" size="xs" variant={sel.length ? 'default' : 'outline'} className="rounded-full" data-testid={`req-bu-filter-${f.key}`}>
            <span className={sel.length ? undefined : DASH.sub}>{f.label}</span>
            <span className="font-medium">{sel.length ? `${sel[0]}${sel.length > 1 ? ` +${sel.length - 1}` : ''}` : 'ทั้งหมด'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-80 w-64 overflow-y-auto p-2">
          {values.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox checked={sel.includes(v)} onCheckedChange={(c) => toggle(v, c === true)} data-testid={`req-bu-opt-${f.key}`} />
              <span className="min-w-0 flex-1 break-words">{v}</span>
              <span className={cn('text-xs tabular-nums', DASH.sub)}>{fmt(counts.get(v) ?? 0)} ใบ</span>
            </label>
          ))}
          {sel.length ? (
            <Button type="button" size="xs" variant="ghost" className="mt-1 w-full" onClick={() => setPicked((cur) => ({ ...cur, [f.key]: [] }))}>
              ล้าง
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    );
  };
  const anyFilter = FILTERS.some((f) => picked[f.key].length);

  return (
    <section className="min-w-0 space-y-4" data-testid="req-bu-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="border-l-4 border-primary pl-3 text-lg font-medium text-foreground">ใบขอ</h2>
          <span className={cn('text-xs', DASH.sub)}>นับอัตรา · {rangeText}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(filterButton)}
          {anyFilter ? (
            <Button type="button" size="xs" variant="ghost" onClick={() => setPicked({ rec: [], scr: [], kind: [] })} data-testid="req-bu-clear">
              ล้างตัวกรอง
            </Button>
          ) : null}
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {!topic ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-[13rem_1fr]">
            <div className="space-y-3 lg:border-r lg:pr-5">
              <Popover open={menuOpen} onOpenChange={setMenuOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between rounded-xl px-3" data-testid="req-bu-topic">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="size-2.5 shrink-0 rounded-sm" style={{ background: topicHex(topic.key) }} />
                      <span className="truncate">{topic.label}</span>
                    </span>
                    <span className={DASH.sub}>▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="max-h-96 w-72 max-w-[calc(100vw-2rem)] overflow-y-auto p-2">
                  {(['eq', 'status'] as const).map((g) => (
                    <div key={g}>
                      <p className={cn('px-2 pb-1 pt-2 text-xs', DASH.sub)}>{g === 'eq' ? 'ใบขอ' : 'เหลือหา แยกตามสถานะทำงาน'}</p>
                      {topics
                        .filter((t) => t.group === g)
                        .map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            data-testid={`req-bu-topic-${t.key}`}
                            onClick={() => {
                              setTopicKey(t.key);
                              setMenuOpen(false);
                            }}
                            className={cn('flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted', t.key === topic.key && 'bg-muted')}
                          >
                            <span className="size-2.5 rounded-sm" style={{ background: topicHex(t.key) }} />
                            {/* ชื่อเรื่องอย่างเดียว ไม่มีเลข (เจ้าของ 19 พ.ย. 2569 "คำอธิบายว่า 461 311ใบ พวกนี้เอาออก") */}
                            <span>{t.label}</span>
                          </button>
                        ))}
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <div>
                <p className="text-4xl font-medium tabular-nums" style={{ color: topicHex(topic.key) }} data-testid="req-bu-total">
                  {fmt(total)}
                </p>
                <p className={cn('mt-1 text-sm', DASH.sub)}>อัตรา · {subOf(topic)}</p>
              </div>
            </div>

            {/* กราฟแท่ง BU + ตัวเลขทุกเรื่องข้างกัน · หัว "… แยกตาม BU" ถอดแล้ว (เจ้าของ 20 พ.ย. 2569) */}
            <div className="grid min-w-0 gap-5 md:grid-cols-[1fr_15rem]">
            <div className="min-w-0">
              <div className="grid grid-cols-[2.5rem_1fr] gap-2" data-testid="req-bu-chart">
                <div className="relative h-48">
                  {ticks.map((t) => (
                    <span key={t} className={cn('absolute right-0 translate-y-1/2 text-xs tabular-nums', DASH.muted)} style={{ bottom: `${(t / top) * 100}%` }}>
                      {fmt(t)}
                    </span>
                  ))}
                </div>
                <div className="relative flex h-48 items-end gap-3 border-b px-2 sm:gap-5">
                  {ticks.map((t) => (
                    <span key={t} className="pointer-events-none absolute inset-x-0 border-t border-muted" style={{ bottom: `${(t / top) * 100}%` }} />
                  ))}
                  {byBu.map((b) => (
                    <button
                      key={b.bu}
                      type="button"
                      disabled={!b.rows.length}
                      onClick={() => pickBu(b.bu)}
                      title={`${b.bu} · ${fmt(b.v)} อัตรา · ${subOf(topic, b.bu)}`}
                      data-testid={`req-bu-bar-${b.bu}`}
                      className={cn('relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 disabled:cursor-default', bu && bu !== b.bu && 'opacity-30')}
                    >
                      <span className="rounded-full border bg-background px-2 text-xs font-medium tabular-nums">{fmt(b.v)}</span>
                      <span className="w-8 rounded-t-lg transition-transform hover:-translate-y-0.5" style={{ height: `${(b.v / top) * 100}%`, minHeight: 2, background: buHex(b.bu) }} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="ml-12 flex gap-3 px-2 pt-1.5 sm:gap-5">
                {byBu.map((b) => (
                  <div key={b.bu} className="min-w-0 flex-1 text-center">
                    <p className="text-sm font-medium">{b.bu}</p>
                    <p className={cn('text-xs tabular-nums', DASH.sub)}>{subOf(topic, b.bu)}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* ตัวเลขทุกเรื่องแทนโดนัท (เจ้าของ 20 พ.ย. 2569 "เอามาโชว์ตัวเลขแทนกราฟโดนัทได้ไหม") · กดแถว = เลือกเรื่อง */}
            <div className="space-y-2 md:border-l md:pl-4" data-testid="req-bu-numbers">
              {(['eq', 'status'] as const).map((g) => (
                <div key={g}>
                  <p className={cn('px-1.5 pb-1 text-xs', DASH.sub)}>{g === 'eq' ? 'ใบขอ' : 'เหลือหา แยกตามสถานะทำงาน'}</p>
                  {topics
                    .filter((t) => t.group === g)
                    .map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTopicKey(t.key)}
                        data-testid={`req-bu-number-${t.key}`}
                        className={cn('grid w-full grid-cols-[0.625rem_1fr_auto] items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs hover:bg-muted', t.key === topic.key && 'bg-muted font-medium')}
                      >
                        <span className="size-2.5 rounded-sm" style={{ background: topicHex(t.key) }} />
                        <span className="min-w-0 break-words">{t.label}</span>
                        <span className="text-right tabular-nums">
                          <b className="font-medium">{fmt(sumOf(t.rows, t.field))}</b> <span className={DASH.sub}>· {subOf(t)}</span>
                        </span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
            </div>
          </div>

          <div className="space-y-3 border-t pt-4" data-testid="req-bu-list">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {topic.label} · {bu ?? 'ทุก BU'}
                {bu ? (
                  <Button type="button" size="xs" variant="link" className="ml-1" onClick={() => setBu(null)}>
                    ดูทุก BU
                  </Button>
                ) : null}
              </p>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาเลขที่ใบขอ หรือหน่วยงาน" className="h-8 max-w-72 text-sm" data-testid="req-bu-search" />
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-muted px-3 py-1">
                <span className={DASH.sub}>อัตรา</span> <b className="font-medium tabular-nums" style={{ color: topicHex(topic.key) }}>{fmt(sumOf(scope, topic.field))}</b>
              </span>
              <span className="rounded-lg bg-muted px-3 py-1">
                <span className={DASH.sub}>ใบขอ</span> <b className="font-medium tabular-nums">{fmt(scope.length)}</b>
              </span>
              <span className="rounded-lg bg-muted px-3 py-1">
                <span className={DASH.sub}>ค้างเฉลี่ย</span>{' '}
                <b className="font-medium tabular-nums">{aged.length ? `${fmt(Math.round(aged.reduce((n, r) => n + (r.ageDays ?? 0), 0) / aged.length))} วัน` : '—'}</b>
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-max text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>ใบขอ</TableHead>
                    <TableHead>หน่วยงาน</TableHead>
                    <TableHead>เจ้าหน้าที่สรรหา</TableHead>
                    <TableHead>เจ้าหน้าที่คัดสรร</TableHead>
                    <TableHead>ชนิดใบ</TableHead>
                    <TableHead className="text-right">ค้าง (วัน)</TableHead>
                    <TableHead className="text-right">เหลือหา</TableHead>
                    <TableHead className="text-right">AI สนใจ</TableHead>
                    <TableHead className="text-right">นัดได้</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pg.slice.map((r) => {
                    const head = `${r.requestNo} · ${r.unitName || r.position || ''}`;
                    const yes = aiYesOf(r);
                    const appt = apptOf(r);
                    return (
                      <TableRow key={`${r.jobId ?? ''}:${r.requestNo}`}>
                        <TableCell className="py-1.5">
                          {r.jobId ? (
                            <button type="button" className="font-medium tabular-nums text-primary hover:underline" onClick={() => onOpenRequest(r.jobId as string)}>
                              {r.requestNo}
                            </button>
                          ) : (
                            <span className="font-medium tabular-nums">{r.requestNo}</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-64 break-words py-1.5">{r.unitName || '—'}</TableCell>
                        <TableCell className="py-1.5">{r.recruiter?.trim() || '—'}</TableCell>
                        <TableCell className="py-1.5">{r.screener?.trim() || '—'}</TableCell>
                        <TableCell className="py-1.5">
                          {r.leadKind ? (
                            <span className={cn('inline-block rounded-full border px-2 py-0.5 text-xs', TONE[KIND_TONE[r.leadKind]].soft)}>
                              {REQUEST_LEAD_KIND_LABEL[r.leadKind]}
                            </span>
                          ) : (
                            <span className={DASH.muted}>—</span>
                          )}
                        </TableCell>
                        <TableCell className={cn('py-1.5 text-right tabular-nums', r.ageDays == null && DASH.muted)}>{r.ageDays == null ? '—' : fmt(r.ageDays)}</TableCell>
                        <TableCell className={cn('py-1.5 text-right font-medium tabular-nums', !r.remaining && DASH.muted)}>{fmt(r.remaining ?? 0)}</TableCell>
                        {(
                          [
                            [yes, r.aiYesIds, 'AI สนใจ'],
                            [appt, r.apptIds, 'นัดได้'],
                          ] as const
                        ).map(([n, ids, label]) => (
                          <TableCell key={label} className="py-1.5 text-right">
                            {n && ids?.length ? (
                              <Button type="button" size="xs" variant="ghost" className="tabular-nums" onClick={() => onNames(`${head} · ${label}`, ids)} data-testid={`req-bu-names-${label === 'AI สนใจ' ? 'yes' : 'appt'}`}>
                                {fmt(n)}
                              </Button>
                            ) : (
                              <span className={cn('px-2.5 tabular-nums', DASH.muted)}>{fmt(n)}</span>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {pg.slice.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className={DASH.muted}>
                        ไม่มีใบขอ
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
            <Pager {...pg} onPage={setPage} testId="req-bu-pager" />
          </div>
        </>
      )}
    </section>
  );
}
