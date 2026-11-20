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
import { flowOf, monthWindowLabel, recruiterLabelOf, stuckEquation, type StuckFlowKey, type StuckMonthBlock, type StuckMonthRow, type StuckRequest } from '@/lib/recruitStuck';
import type { TrendSense } from '@/lib/recruitScale';
import { REQUEST_LEAD_KIND_LABEL, type RequestLeadKind } from '@/lib/requestLeadKind';
import { STATUS_TOTAL_ID, workStatusOfRemaining } from '@/lib/workStatusOfRemaining';
import type { JobRequest } from '@/types';
import TrendDelta from '../stuck/TrendDelta';
import { Pager, buHex, fmt } from './V2Parts';

/** ยอดตามช่วง (`flowOf`) — ยกมา/หาได้/ยกเลิก นับตามช่วง ไม่ใช่ยอดสะสมทั้งใบ (เจ้าของ 20 พ.ย. 2569 Choice "กดได้ทุกเรื่องใบขอ") */
type Field = StuckFlowKey;
type Topic<T extends StuckMonthRow = StuckRequest> = { key: string; label: string; field: Field; rows: T[]; group: 'eq' | 'status' };
type FilterKey = 'rec' | 'scr' | 'kind';

const NO_SCREENER = 'ยังไม่ได้ตั้งเจ้าหน้าที่คัดสรร';
const NO_KIND = 'ไม่ระบุ';
const KIND_ORDER: RequestLeadKind[] = ['advance', 'urgent', 'retroactive'];
const valueOf: Record<FilterKey, (r: StuckMonthRow) => string> = {
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
const buKey = (r: StuckMonthRow) => r.bu?.trim() || BU_UNKNOWN;
const BU_ORDER = ['LBD', 'LBA', 'LM', 'SN', 'DS', 'CR'];
const buRank = (b: string) => (b === BU_UNKNOWN ? 99 : BU_ORDER.indexOf(b) < 0 ? 50 : BU_ORDER.indexOf(b));
const sumOf = (rows: readonly StuckMonthRow[], f: Field) => rows.reduce((n, r) => n + flowOf(r)[f], 0);
/** เรื่องทั้งหมดของใบชุดหนึ่ง — ตัวเดียวทั้งเลขใหญ่ กราฟ BU และกราฟรายเดือน (ใบของเดือน = ช่องชุดย่อ `StuckMonthRow`) */
function topicsOf<T extends StuckMonthRow>(kept: readonly T[], jobs: readonly JobRequest[] | null): Topic<T>[] {
  const eq = stuckEquation(kept);
  const list: Topic<T>[] = [
    { key: 'carried', label: 'ยอดยกมา', field: 'carryIn', rows: kept.filter((r) => flowOf(r).carryIn > 0), group: 'eq' },
    { key: 'new', label: 'ขอใหม่', field: 'new', rows: eq.new, group: 'eq' },
    { key: 'filled', label: 'หาได้แล้ว', field: 'filled', rows: kept.filter((r) => flowOf(r).filled > 0), group: 'eq' },
    { key: 'cancelled', label: 'ยกเลิก', field: 'cancelled', rows: kept.filter((r) => flowOf(r).cancelled > 0), group: 'eq' },
    { key: 'remaining', label: 'เหลือหา', field: 'remaining', rows: eq.remaining, group: 'eq' },
  ];
  if (jobs) for (const b of workStatusOfRemaining(eq.remaining, jobs)) if (b.id !== STATUS_TOTAL_ID) list.push({ key: b.id, label: b.label, field: 'remaining', rows: b.rows, group: 'status' });
  return list;
}
/** สีของทิศบนกราฟรายเดือน — หาได้แล้วเพิ่ม = ดี · งานค้าง/ยกเลิกเพิ่ม = แย่ · ที่เหลือบอกทิศอย่างเดียว */
const TOPIC_SENSE: Record<string, TrendSense> = { filled: 'good', carried: 'bad', cancelled: 'bad', remaining: 'bad' };
const aiYesOf = (r: StuckRequest) => r.aiYesIds?.length ?? r.signals?.counts?.aiYes ?? 0;
const apptOf = (r: StuckRequest) => r.apptIds?.length ?? r.signals?.counts?.appointed ?? 0;

export default function RequestBuPanel({
  rows,
  jobs,
  bus,
  rangeText,
  months,
  monthsError = null,
  monthsCapped = false,
  compare = false,
  today,
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
  /** ใบขอทีละเดือนของช่วงที่เลือก (`part=months`) · null = ยังโหลด */
  months: readonly StuckMonthBlock[] | null;
  monthsError?: string | null;
  /** ช่วงยาวเกิน 12 เดือน — กราฟเอา 12 เดือนล่าสุด */
  monthsCapped?: boolean;
  /** โหมดเทียบเดือนจากปุ่มวันที่ — กราฟเป็นยอดรวมรายเดือนแทนแท่ง BU (เจ้าของ 20 พ.ย. 2569) */
  compare?: boolean;
  /** วันนี้ (YYYY-MM-DD) — เดือนที่จบไปแล้วไม่มีสถานะทำงานย้อนหลัง (ERP เก็บแค่สถานะปัจจุบัน) */
  today: string;
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
    (r: StuckMonthRow, skip?: FilterKey) => FILTERS.every((f) => f.key === skip || !picked[f.key].length || picked[f.key].includes(valueOf[f.key](r))),
    [picked],
  );
  const kept = React.useMemo(() => (rows ? rows.filter((r) => pass(r)) : null), [rows, pass]);
  const eq = React.useMemo(() => (kept ? stuckEquation(kept) : null), [kept]);
  const topics = React.useMemo<Topic[]>(() => (kept ? topicsOf(kept, jobs) : []), [kept, jobs]);
  // สถานะยังไม่มา (เส้นใบขอยังโหลด) = โชว์เหลือหาไปก่อน
  const topic = topics.find((t) => t.key === topicKey) ?? topics.find((t) => t.key === 'remaining') ?? null;

  /**
   * บรรทัดรอง = จำนวนใบของเรื่องนั้น แบบเดียวกันทุกเรื่อง — หาได้แล้ว = ใบที่ได้คนแล้ว · ยกเลิก = ใบที่มีอัตราถูกยกเลิก
   * (เจ้าของ 20 พ.ย. 2569 "151 อัตรา ปิดครบ 57 ใบคือไร เอาแค่ ปิดได้กี่อัตรา กี่ใบพอ" — เดิมบอกใบปิดครบ/ยกเลิกทั้งใบ อ่านเป็น 151 อัตราจาก 57 ใบ)
   */
  const subOf = (t: Topic, onlyBu?: string | null) => `${fmt(t.rows.filter((r) => !onlyBu || buKey(r) === onlyBu).length)} ใบ`;

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

  /** กราฟรายเดือนของเรื่องที่เลือก — ตัวกรอง/BU เดียวกับข้างบน · สถานะทำงานของเดือนที่จบไปแล้ว = null (ไม่มีข้อมูลย้อนหลัง ห้ามยุบเป็น 0) */
  const monthly = React.useMemo(() => {
    if (!months || !topic) return null;
    const withYear = new Set(months.map((m) => m.month.slice(0, 4))).size > 1;
    return months.map((m) => {
      // สถานะทำงาน: เดือนนี้ = สถานะสด · เดือนที่จบแล้ว = สถานะที่จดไว้สิ้นเดือน (193) · ไม่มีที่จด = ไม่มีข้อมูล (null ห้ามยุบเป็น 0)
      const monthJobs = m.to >= today ? jobs : m.statusAt ? Object.entries(m.statusAt).map(([id, work_status]) => ({ id, work_status }) as unknown as JobRequest) : null;
      const t = topicsOf(m.rows.filter((r) => pass(r)), monthJobs).find((x) => x.key === topic.key);
      const v = topic.group === 'status' && !monthJobs ? null : t ? sumOf(t.rows.filter((r) => !bu || buKey(r) === bu), t.field) : 0;
      return { month: m.month, label: monthWindowLabel(m, withYear), v };
    });
  }, [months, topic, pass, jobs, bu, today]);
  const monthTop = Math.max(1, ...(monthly ?? []).map((m) => m.v ?? 0));
  /** เดือนที่กดดูรายวัน — มีรายวันเฉพาะขอใหม่ (วันที่ใบขอเข้ามา) */
  const [dayMonth, setDayMonth] = React.useState<string | null>(null);
  React.useEffect(() => setDayMonth(null), [resetKey, topicKey, compare]);
  const daily = React.useMemo(() => {
    const block = dayMonth ? months?.find((m) => m.month === dayMonth) : null;
    if (!block) return null;
    const days: string[] = [];
    for (let d = new Date(`${block.from}T00:00:00Z`); d.toISOString().slice(0, 10) <= block.to; d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
    const lineBus = bu ? [bu] : busShown;
    const key = topic?.key ?? 'new';
    const kept = block.rows.filter((r) => pass(r));
    /** วันละเท่าไหร่ต่อ BU — ขอใหม่ = วันคีย์ · หาได้/ยกเลิก = รายวันจากสมุด · เหลือ = สิ้นวัน · ยกมา = ต้นวัน (= เหลือของวันก่อน) */
    const perDay = (rows: readonly StuckMonthRow[]) => {
      const add = (m: Map<string, number>, d: string, v: number) => m.set(d, (m.get(d) ?? 0) + v);
      const nw = new Map<string, number>();
      const fl = new Map<string, number>();
      const cx = new Map<string, number>();
      let carry = 0;
      for (const r of rows) {
        const f = flowOf(r);
        carry += f.carryIn;
        // วันคีย์จากสมุดใบขอ (ตัวเดียวกับแท่งเดือน) › วันที่ของแถว — บนเว็บจริงมีใบที่สองวันนี้ไม่ตรงกัน เส้นสิ้นวันเคยขาด 2 อัตรา
        const newDay = r.flow?.newDay ?? r.day;
        if (f.new && newDay) add(nw, newDay.slice(0, 10), f.new);
        for (const [d, v] of r.flow?.fillDays ?? []) add(fl, d, v);
        for (const [d, v] of r.flow?.cancelDays ?? []) add(cx, d, v);
      }
      let open = carry;
      return days.map((d) => {
        const start = open;
        open += (nw.get(d) ?? 0) - (fl.get(d) ?? 0) - (cx.get(d) ?? 0);
        return key === 'new' ? nw.get(d) ?? 0 : key === 'filled' ? fl.get(d) ?? 0 : key === 'cancelled' ? cx.get(d) ?? 0 : key === 'carried' ? start : open;
      });
    };
    const series = lineBus.map((b) => ({ bu: b, ys: perDay(kept.filter((r) => buKey(r) === b)) }));
    // ใบนอกสมุดใบขอไม่มีวันที่หาได้/ยกเลิก — บอกยอดไว้ ไม่เกลี่ยเอง
    const undated = kept.filter((r) => !r.flow && (!bu || buKey(r) === bu)).reduce((n, r) => n + (key === 'filled' ? flowOf(r).filled : key === 'cancelled' ? flowOf(r).cancelled : 0), 0);
    return { block, days, series, label: topic?.label ?? '', stock: key === 'remaining' || key === 'carried', undated };
  }, [dayMonth, months, bu, busShown, pass, topic]);

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

  /**
   * โหมดเทียบเดือน (เจ้าของ 20 พ.ย. 2569 "เวลาเทียบเดือนก็เป็นยอดรวมไปเลย เว้นแต่ Filter เลือกแค่ Bu ไหน" ·
   * "ไม่เอากราฟย้ายมาข้างล่าง ไอกราฟอันที่เลือกก็เปลี่ยนตาม" · "กดที่แท่งของเดือนไหนก็แยกวันให้ดู … กราฟเส้น ดูทุก Bu เทียบไปได้")
   * แท่งละเดือน สีของเรื่อง · ใต้แท่ง เพิ่มขึ้น/ลดลงจากเดือนก่อน · กดแท่ง = เส้นรายวันต่อ BU ที่เดิม
   */
  // รายวันได้ทุกเรื่องของใบขอ · สถานะทำงานไม่มีรายวัน
  const canDaily = topic?.group === 'eq';
  const compareChart = (
    <div className="min-w-0 space-y-2" data-testid="req-bu-compare">
      {monthsError ? <p className="text-sm text-destructive">{monthsError}</p> : null}
      {!monthly || !topic ? (
        <Skeleton className="h-56 rounded-xl" />
      ) : daily ? (
        <DailyLines daily={daily} onBack={() => setDayMonth(null)} />
      ) : (
        <>
          {monthsCapped ? <p className={cn('text-xs', DASH.sub)}>12 เดือนล่าสุด</p> : null}
          <div className="overflow-x-auto overflow-y-hidden">
            <div className="flex h-56 gap-4 border-b px-2 pt-1 sm:gap-6">
              {monthly.map((m) => (
                <button
                  key={m.month}
                  type="button"
                  disabled={!canDaily || m.v === null}
                  onClick={() => setDayMonth(m.month)}
                  title={canDaily ? `${m.label} · กดดูรายวัน` : m.label}
                  data-testid={`req-bu-month-${m.month}`}
                  className="flex min-w-16 flex-1 flex-col items-center justify-end gap-1 disabled:cursor-default"
                >
                  <span className={cn('rounded-full border bg-background px-2 text-xs font-medium tabular-nums', m.v === null && DASH.sub)}>{m.v === null ? 'ไม่มีข้อมูล' : fmt(m.v)}</span>
                  <span className="w-10 rounded-t-lg transition-transform hover:-translate-y-0.5" style={{ height: `${((m.v ?? 0) / monthTop) * 100}%`, minHeight: 2, background: topicHex(topic.key) }} />
                </button>
              ))}
            </div>
            <div className="flex gap-4 px-2 pt-1.5 sm:gap-6">
              {monthly.map((m, i) => (
                <div key={m.month} className="min-w-16 flex-1 text-center">
                  <p className="text-sm font-medium">{m.label}</p>
                  {/* เดือนแรกไม่มีเดือนก่อนให้เทียบ — จองบรรทัดไว้ */}
                  {i === 0 ? <p className="text-xs">&nbsp;</p> : <TrendDelta cur={m.v} prev={monthly[i - 1].v} sense={TOPIC_SENSE[topic.key] ?? 'plain'} />}
                </div>
              ))}
            </div>
          </div>
          {canDaily ? <p className={cn('text-xs', DASH.sub)}>กดแท่งเดือนไหน แยกรายวันของเดือนนั้น</p> : null}
        </>
      )}
    </div>
  );

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
            {compare ? compareChart : (
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
            )}
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
                        <TableCell className={cn('py-1.5 text-right font-medium tabular-nums', !flowOf(r).remaining && DASH.muted)}>{fmt(flowOf(r).remaining)}</TableCell>
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

/** เส้นรายวันต่อ BU ของเดือนที่กด — สเกลเดียวกันทั้งเส้น/เส้นแกน/ป้าย · วันที่ไม่มีใบเข้า = 0 */
function DailyLines({
  daily,
  onBack,
}: {
  daily: { block: StuckMonthBlock; days: string[]; series: Array<{ bu: string; ys: number[] }>; label: string; stock: boolean; undated: number };
  onBack: () => void;
}) {
  const { block, days, series, label, stock, undated } = daily;
  const max = Math.max(1, ...series.flatMap((s) => s.ys));
  const step = max > 40 ? 10 : max > 20 ? 5 : max > 8 ? 2 : 1;
  const top = Math.ceil(max / step) * step;
  const W = 640;
  const H = 220;
  const L = 32;
  const R = 10;
  const T = 10;
  const B = 24;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, days.length - 1);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const ticks = Array.from({ length: Math.floor(top / step) + 1 }, (_, i) => i * step);
  const dayNo = (d: string) => Number(d.slice(8, 10));
  return (
    <div className="space-y-2" data-testid="req-bu-daily">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="xs" variant="outline" onClick={onBack} data-testid="req-bu-daily-back">
          ← กลับไปเทียบเดือน
        </Button>
        <span className={cn('text-xs', DASH.sub)}>
          {label}รายวัน{stock ? (label === 'ยอดยกมา' ? ' (ต้นวัน)' : ' (สิ้นวัน)') : ''} · {monthWindowLabel(block)} · อัตรา
          {undated ? ` · ไม่มีวันที่ ${fmt(undated)}` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${label}รายวัน ${monthWindowLabel(block)}`}>
        {ticks.map((t) => (
          <g key={t} className="text-border">
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="currentColor" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-xs">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) =>
          i % 5 === 0 || i === days.length - 1 ? (
            <text key={d} x={x(i)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-xs">
              {dayNo(d)}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <g key={s.bu} data-testid={`req-bu-daily-${s.bu}`}>
            <polyline points={s.ys.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={buHex(s.bu)} strokeWidth={2} strokeLinejoin="round" />
            {s.ys.map((v, i) =>
              v ? (
                <circle key={days[i]} cx={x(i)} cy={y(v)} r={3.5} fill={buHex(s.bu)}>
                  <title>{`${s.bu} · วันที่ ${dayNo(days[i])} · ${v} อัตรา`}</title>
                </circle>
              ) : null,
            )}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <span key={s.bu} className="inline-flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full" style={{ background: buHex(s.bu) }} />
            {s.bu} <b className="font-medium tabular-nums">{fmt(stock ? (s.ys[s.ys.length - 1] ?? 0) : s.ys.reduce((a, c) => a + c, 0))}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
