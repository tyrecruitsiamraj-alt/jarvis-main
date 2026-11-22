/**
 * ═══ แท็บ "Scale ลง" ของหน้าภาพรวมงานสรรหา (เจ้าของ 20 พ.ย. 2569) ═══
 * > *"แก้ทั้งหมดไว้อีกแท็บของหน้าภาพรวม แล้วเดี๋ยวฉันเปิดดูแล้วตัดสินใจเองว่าจะเอาอันไหนไว้"*
 * หน้าตา + ลำดับการกด = แบบร่างรอบ 5 ที่เจ้าของดู (`reports-local/so-recruit-scale-draft.html`)
 *
 * ทางเดิน (ทั้งหมด › BU › คน › ช่องทาง › กลุ่ม · วัน) → กล่องเลขทุกแถว (ที่เดิมทุกชั้น · กดได้ทุกกล่องที่มีเลข)
 * → กดกล่อง = เลขนั้นแยกตามชั้นถัดไป · ไม่กดกล่อง = กราฟรายวัน + ตารางของชั้น
 * ตัวเลข/แถวทั้งหมดมาจาก `src/lib/overviewScale.ts` — ไฟล์นี้วาดอย่างเดียว · ชั้น กล่อง เดือน และใบขอที่เปิดอยู่ใน URL (กดย้อนกลับได้)
 * อ่านอย่างเดียว: `/api/home-money` (ค่าปรับ · นาฬิกา) + `/api/staff-activity?person=1` (งานของคนในวันนั้น)
 *
 * ก้อนสอง (20 พ.ย. 2569 "ทำที่เหลือต่อเลย"): ทุกกล่องบอกเพิ่ม/ลดจากช่วงก่อน (ชั้นวัน = เทียบวันก่อน) · แถว "ตรงเกณฑ์ใบขอ"
 * ตารางเทียบเดือน (ช่วงที่ครอบหลายเดือน · กดเดือน = กราฟรายวันของเดือนนั้น) · กดกล่องรายชื่อ = คนในกล่องไปไหนต่อ
 * ใบขอ: ยกมา · ขอใหม่ · หาได้แล้ว · ยกเลิก (+ ยกเลิกเพราะอะไร) → รายใบพร้อมงานที่ทำไปแล้ว → กดเลขที่ใบ = ใบนี้ทำอะไรไปแล้ว ไล่ตามวัน
 * อ่านเพิ่ม (อย่างเดียว): ช่วงก่อนของ `/api/staff-activity` `/api/recruit-stuck` `/api/home-money` · `roster=1` · `/api/request-timeline`
 */
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DASH, TONE } from '@/lib/designTokens';
import type { RecruitAppFact, RecruitAppJob } from '@/lib/recruitOverviewTypes';
import type { StuckRequest } from '@/lib/recruitStuck';
import { flowOf, recruiterLabelOf } from '@/lib/recruitStuck';
import { fetchRecruitStuck } from '@/lib/recruitStuckApi';
import { isPostingStarted } from '@/lib/recruitPostingState';
import { STAFF_PERSON_KINDS, staffSubText, staffWorkTotal, ymdAddDays, type StaffActivityRow, type StaffPersonDay, type StaffRosterRow } from '@/lib/staffActivity';
import { fetchStaffActivity, fetchStaffPersonDay, fetchStaffRoster } from '@/lib/staffActivityApi';
import { fetchHomeMoney } from '@/lib/homeMoneyApi';
import type { MoneyRequest } from '@/lib/homeMoney';
import { friendlyErrorText } from '@/lib/friendlyError';
import { pageOf } from '@/lib/recruitAudience';
import { rangeText } from '@/lib/periodPick';
import type { TrendSense } from '@/lib/recruitScale';
import { buildRequestTimeline, type RequestTimelineJob } from '@/lib/requestTimeline';
import { fetchRequestTimeline } from '@/lib/requestTimelineApi';
import {
  SCALE_BOX_PARAM,
  SCALE_CHAIN,
  SCALE_CHILD_TITLE,
  SCALE_FIT_KEYS,
  SCALE_HOLD,
  SCALE_VERSUS_LABEL,
  scaleBoxOf,
  scaleBreakdown,
  scaleBreakdownCompared,
  scaleBuTable,
  scaleCancelReasons,
  scaleChainTable,
  scaleClockedRows,
  scaleCompareOf,
  scaleCrumbs,
  scaleDayCount,
  scaleDayLabel,
  scaleDaySeries,
  scaleDayTable,
  scaleDays,
  scaleFitStages,
  scaleFitUnknownWhy,
  scaleHoldTable,
  scaleInformedRows,
  scaleIsWeekend,
  scaleLevelFromParams,
  scaleLevelToParams,
  scaleMoneyOf,
  scaleMonthFromParams,
  scaleMonthTable,
  scaleMonths,
  scaleNext,
  scalePenaltyRows,
  scalePeopleTable,
  scalePrevDay,
  scaleReqAmount,
  scaleReqRoleOf,
  scaleRequestFromParams,
  scaleRequestsOf,
  scaleSections,
  scaleStaffNamer,
  scaleStopReasonOf,
  scaleStopReasons,
  scaleTopRequests,
  scaleUserIdOf,
  scaleWeekday,
  type ScaleBox,
  type ScaleBoxKey,
  type ScaleCompare,
  type ScaleCompareCtx,
  type ScaleInput,
  type ScaleLevel,
  type ScaleReqRole,
  type ScaleRow,
  type ScaleRowCompared,
} from '@/lib/overviewScale';
import TrendDelta from '../stuck/TrendDelta';
import { Pager, SectionTitle, fmt } from './V2Parts';

const one = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** เงิน — ถึงสตางค์ (รายใบมีสตางค์ ปัดเป็นบาทแล้วบวกไม่ลงตัว) */
const two = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dash = <span className="text-muted-foreground">—</span>;
const num = (v: number | null | undefined) => (v == null ? dash : fmt(Math.round(v)));
/** เลขของกล่อง/แถวตามรูปแบบ */
const shown = (b: Pick<ScaleBox, 'value' | 'format' | 'text'>): React.ReactNode =>
  b.format === 'text' ? (b.text ?? dash) : b.value == null ? (b.text ?? dash) : b.format === 'dec1' ? one(b.value) : b.format === 'dec2' ? two(b.value) : b.format === 'pct' ? `${fmt(b.value)}%` : fmt(b.value);
const shownText = (b: Pick<ScaleBox, 'value' | 'format' | 'text'>): string =>
  b.format === 'text' ? (b.text ?? '—') : b.value == null ? '—' : b.format === 'dec1' ? one(b.value) : b.format === 'dec2' ? two(b.value) : b.format === 'pct' ? `${fmt(b.value)}%` : fmt(b.value);

const PEN_KEYS: readonly ScaleBoxKey[] = ['penCount', 'fine', 'deduct'];
const CLOCK_KEYS: readonly ScaleBoxKey[] = ['speed', 'onTime'];
const FLOW_KEYS: readonly ScaleBoxKey[] = ['inPerDay', 'outPerDay', 'eta'];
const KIND_LABELS = STAFF_PERSON_KINDS.map((k) => k.label);

/** `trend` = ป้ายเทียบช่วงก่อนของกล่อง — บรรทัดจองที่ไว้เสมอ (ไม่มีป้ายก็ไม่ทำให้กล่องเตี้ยลง) */
function BoxTile({ box, active, onPick, trend }: { box: ScaleBox; active: boolean; onPick: (key: ScaleBoxKey) => void; trend: React.ReactNode }) {
  const has = box.value != null || Boolean(box.text);
  const body = (
    <>
      <span className={cn('min-h-8 text-xs leading-4', DASH.sub)}>{box.label}</span>
      <span className={cn('font-medium tabular-nums text-foreground', box.format === 'text' || shownText(box).length > 9 ? 'text-lg' : 'text-2xl')}>{shown(box)}</span>
      {box.bar != null ? <Progress value={Math.min(100, Math.round(box.bar * 100))} className="h-1" /> : null}
      <span className={cn('mt-auto text-xs leading-4', DASH.sub)}>{has ? box.sub : ''}</span>
      <span className="block min-h-4 w-full truncate leading-4" data-testid={`scale-trend-${box.key}`}>
        {trend}
      </span>
    </>
  );
  const tile = 'flex min-h-32 min-w-0 flex-col items-start gap-0.5 rounded-xl border border-border bg-background px-3 py-2.5 text-left';
  if (!has)
    return (
      <div className={tile} data-testid={`scale-box-${box.key}`}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      onClick={() => onPick(box.key)}
      aria-pressed={active}
      data-testid={`scale-box-${box.key}`}
      className={cn(tile, 'transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', active && 'border-primary bg-primary/5 ring-1 ring-primary')}
    >
      {body}
    </button>
  );
}

/** แถวเรียงมากไปน้อย: ชื่อ · แถบ · เลข · % ของรวม · เทียบช่วงก่อน (`trendOf` — ไม่ส่ง = ไม่มีคอลัมน์นี้) · `id` = ชื่อไว้อ้างในเทสต์ */
function RankRows({
  rows,
  total,
  onRow,
  trendOf,
  id = 'scale-rank',
}: {
  rows: readonly ScaleRow[];
  total: number | null;
  onRow: (r: ScaleRow) => void;
  trendOf?: (r: ScaleRow) => React.ReactNode;
  id?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  if (!rows.length) return <p className={cn('text-sm', DASH.sub)}>ไม่มีรายการ</p>;
  const cols = trendOf ? 'sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6rem_3rem_8rem_1rem]' : 'sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_6rem_3rem_1rem]';
  return (
    <div data-testid={id}>
      {rows.map((r) => {
        const can = Boolean(r.go) || Boolean(r.ids?.length);
        const cells = (
          <>
            <span className="min-w-0 text-left">
              <span className={cn('block truncate text-sm font-medium', can && 'text-primary')}>{r.label}</span>
              {r.note ? <span className={cn('block truncate text-xs', DASH.sub)}>{r.note}</span> : null}
            </span>
            <Progress value={r.value ? Math.max(1, Math.round((r.value / max) * 100)) : 0} className="hidden h-2 sm:block" />
            <span className="text-right text-base font-medium tabular-nums">{shown(r)}</span>
            <span className={cn('hidden text-right text-xs tabular-nums sm:block', DASH.sub)}>{total && r.value != null ? `${Math.round((r.value / total) * 100)}%` : ''}</span>
            {trendOf ? <span className="hidden truncate text-right sm:block">{trendOf(r)}</span> : null}
            <ChevronRight className={cn('size-4 text-muted-foreground', !can && 'invisible')} aria-hidden="true" />
          </>
        );
        const grid = cn('grid w-full grid-cols-[minmax(0,1fr)_5rem_1rem] items-center gap-3 border-t border-border px-3 py-2.5 first:border-t-0', cols);
        return can ? (
          <button key={r.key} type="button" onClick={() => onRow(r)} data-testid={`${id}-row`} className={cn(grid, 'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>
            {cells}
          </button>
        ) : (
          <div key={r.key} className={grid} data-testid={`${id}-row`}>
            {cells}
          </div>
        );
      })}
      {total != null ? (
        <div className={cn('mt-2 grid grid-cols-[minmax(0,1fr)_5rem_1rem] items-center gap-3 rounded-lg bg-muted px-3 py-2.5', cols)} data-testid={`${id}-total`}>
          <span className="text-sm font-medium">รวม</span>
          <span className="hidden sm:block" />
          <span className="text-right text-base font-medium tabular-nums">{rows.some((r) => r.format === 'dec2') ? two(total) : fmt(total)}</span>
          <span className={cn('hidden text-right text-xs sm:block', DASH.sub)}>100%</span>
          {trendOf ? <span className="hidden sm:block" /> : null}
          <span />
        </div>
      ) : null}
    </div>
  );
}

// ตารางของแท็บนี้มีถึง 12 คอลัมน์ — ช่องตัวเลขชิดกว่าค่าเริ่มของตาราง ให้พอดีจอโดยไม่ต้องเลื่อนข้าง
const th = 'whitespace-nowrap px-2 text-right';
/** หัวคอลัมน์ที่ชื่อยาว — ตัดบรรทัดได้ */
const thWrap = 'min-w-24 px-2 text-right leading-4';
const td = 'whitespace-nowrap px-2 text-right tabular-nums';
const linkCell = 'h-auto p-0 font-medium';

const AMOUNT_LABEL: Record<ScaleReqRole, string> = { remaining: 'เหลือหา', idle: 'เหลือหา', carry: 'ยกมา', new: 'ขอใหม่', filled: 'หาได้แล้ว', cancelled: 'ยกเลิก' };
const LIST_TITLE: Record<ScaleReqRole, string> = {
  remaining: 'ใบขอที่เหลือหา',
  idle: 'ใบขอที่ยังไม่เริ่มหา',
  carry: 'ใบขอที่ยกมา',
  new: 'ใบขอที่ขอใหม่',
  filled: 'ใบขอที่หาได้แล้ว',
  cancelled: 'ใบขอที่ยกเลิก',
};
/** เหตุผลที่เจ้าหน้าที่ลงไว้ — 3 อันดับแรก ที่เหลือรวมเป็น "อื่น ๆ" */
const reasonText = (reasons: ReadonlyArray<{ label: string; n: number }>): string => {
  const rest = reasons.slice(3).reduce((a, r) => a + r.n, 0);
  return [...reasons.slice(0, 3).map((r) => `${r.label} ${fmt(r.n)}`), ...(rest ? [`อื่น ๆ ${fmt(rest)}`] : [])].join(' · ');
};
/** วันที่มีปี — ใบขอเก่าข้ามปีได้ */
const fullDay = (ymd: string) => rangeText(ymd, ymd);

/** ช่องเลขที่กดไม่ได้ (หน้าใบขอใบเดียว) — หน้าตาเดียวกับกล่องของชั้น */
function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5 rounded-xl border border-border bg-background px-3 py-2.5">
      <span className={cn('text-xs leading-4', DASH.sub)}>{label}</span>
      <span className="text-2xl font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/** ตัวเลขในตาราง + บรรทัดเทียบแถวก่อน (จองที่ไว้เสมอ) */
function StackCell({ value, before, sense }: { value: number | null; before: number | null | undefined; sense: TrendSense }) {
  return (
    <span className="flex flex-col items-end">
      <span>{num(value)}</span>
      <span className="min-h-4 leading-4">{before === undefined || value == null ? null : <TrendDelta cur={value} prev={before} sense={sense} zeroAsUp />}</span>
    </span>
  );
}

export type ScalePanelProps = {
  cohort: readonly RecruitAppFact[];
  staff: readonly StaffActivityRow[] | null;
  staffError: string | null;
  requests: readonly StuckRequest[] | null;
  requestsError: string | null;
  /** ใบขอของใบสมัคร (เกณฑ์ที่ตั้งงาน · อายุ · เพศ) — null = อ่านไม่ได้ ⇒ แถว "ตรงเกณฑ์ใบขอ" ขึ้น — */
  jobs: Readonly<Record<string, RecruitAppJob>> | null;
  /** ช่วงก่อนที่ใช้เทียบ (ยาวเท่ากัน) — null = ไม่เทียบ (ปุ่ม "ทั้งหมด") · `cohort` null = ข้อมูลช่วงก่อนไม่ครบ ⇒ "เทียบไม่ได้" */
  prev: { from: string; to: string; cohort: readonly RecruitAppFact[] | null } | null;
  from: string;
  to: string;
  today: string;
  /** BU ที่หน้าเลือกไว้ (ตัวกรองบนสุด) — มีค่า = เริ่มที่ชั้น BU นั้น */
  bu: string | null;
  onNames: (title: string, ids: readonly string[]) => void;
  onOpenRequest: (jobId: string) => void;
};

/** การเทียบของกล่อง (`scaleCompareOf`): none = ไม่มีป้าย · wait = ช่วงก่อนยังโหลด · na = เทียบไม่ได้ · ok = มีค่าช่วงก่อน */
type Cmp = ScaleCompare;
const NO_CMP: Cmp = { state: 'none', sense: 'plain' };
type PrevData = { key: string; staff: StaffActivityRow[] | null; requests: StuckRequest[] | null; money: MoneyRequest[] | null };

export default function ScalePanel({ cohort, staff, staffError, requests, requestsError, jobs, prev, from, to, today, bu, onNames, onOpenRequest }: ScalePanelProps) {
  const [params, setParams] = useSearchParams();
  const urlLevel = React.useMemo(() => scaleLevelFromParams(params), [params]);
  const level: ScaleLevel = React.useMemo(() => (bu ? { ...urlLevel, bu } : urlLevel), [urlLevel, bu]);
  const boxKey = (params.get(SCALE_BOX_PARAM) as ScaleBoxKey | null) || null;
  const urlMonth = scaleMonthFromParams(params);
  const openJob = scaleRequestFromParams(params);
  const [page, setPage] = React.useState(1);
  const [eventPage, setEventPage] = React.useState(1);
  /** เปลี่ยนชั้น/กล่อง = ปิดใบขอที่เปิดอยู่ · เดือนที่กดไว้อยู่ต่อ (ไม่ส่ง `month` = คงเดิม) */
  const go = (next: ScaleLevel, nextBox: ScaleBoxKey | null, view: { month?: string | null } = {}) => {
    setPage(1);
    setEventPage(1);
    setParams((cur) => scaleLevelToParams(cur, next, nextBox, { month: view.month === undefined ? urlMonth : view.month, request: null }));
  };
  /** เปิด/ปิดใบขอ — หน้าของรายการใบขออยู่ที่เดิม (กลับมาแล้วไม่ต้องไล่หาใหม่) */
  const openRequest = (jobId: string | null) => {
    setEventPage(1);
    setParams((cur) => scaleLevelToParams(cur, level, boxKey, { month: urlMonth, request: jobId }));
  };

  // ค่าปรับ + นาฬิกา (เส้นของหน้าหลัก) — โหลดเมื่อเปิดแท็บ · อ่านไม่ได้ = กล่องขึ้น — พร้อมบอกเหตุ
  const moneyKey = `${from}:${to}:${bu ?? 'all'}`;
  const [money, setMoney] = React.useState<{ key: string; rows: MoneyRequest[] | null; error: string | null }>({ key: '', rows: null, error: null });
  React.useEffect(() => {
    let alive = true;
    fetchHomeMoney({ from, to, bu })
      .then((d) => alive && setMoney({ key: moneyKey, rows: d.requests, error: null }))
      .catch((e: unknown) => alive && setMoney({ key: moneyKey, rows: null, error: friendlyErrorText(e, 'อ่านค่าปรับไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [moneyKey, from, to, bu]);
  const moneyRows = money.key === moneyKey ? money.rows : null;

  const input: ScaleInput = React.useMemo(
    () => ({ cohort, staff, requests, money: moneyRows, jobs, from, to, today, now: Date.now() }),
    [cohort, staff, requests, moneyRows, jobs, from, to, today],
  );
  const sections = React.useMemo(() => scaleSections(input, level), [input, level]);
  const picked = boxKey ? scaleBoxOf(sections, boxKey) : null;
  const box = picked && (picked.value != null || picked.text) ? picked : null;
  const crumbs = scaleCrumbs(level).slice(bu ? 1 : 0);
  const scopeText = [level.bu, level.who, level.ch, level.grp, level.day ? scaleDayLabel(level.day) : null].filter(Boolean).join(' · ');

  // ── ช่วงก่อน (ยาวเท่ากัน): งาน · ใบขอ · ค่าปรับ โหลดเมื่อเปิดแท็บ — อ่านไม่ได้ = "เทียบไม่ได้" ไม่ใช่ 0 ──
  const prevFrom = prev?.from ?? null;
  const prevTo = prev?.to ?? null;
  const prevCohort = prev?.cohort ?? null;
  const prevKey = prevFrom && prevTo ? `${prevFrom}:${prevTo}:${bu ?? 'all'}` : '';
  const [prevData, setPrevData] = React.useState<PrevData>({ key: '', staff: null, requests: null, money: null });
  React.useEffect(() => {
    if (!prevFrom || !prevTo) return;
    let alive = true;
    const q = { from: prevFrom, to: prevTo };
    Promise.all([
      fetchStaffActivity({ ...q, bu }).catch(() => null),
      fetchRecruitStuck(bu, q)
        .then((d) => d.requests)
        .catch(() => null),
      fetchHomeMoney({ ...q, bu })
        .then((d) => d.requests)
        .catch(() => null),
    ]).then(([s, r, m]) => alive && setPrevData({ key: prevKey, staff: s, requests: r, money: m }));
    return () => {
      alive = false;
    };
  }, [prevKey, prevFrom, prevTo, bu]);
  const prevLoaded = Boolean(prevKey) && prevData.key === prevKey;
  const prevInput: ScaleInput | null = React.useMemo(
    () =>
      prevFrom && prevTo
        ? { cohort: prevCohort ?? [], staff: prevLoaded ? prevData.staff : null, requests: prevLoaded ? prevData.requests : null, money: prevLoaded ? prevData.money : null, jobs, from: prevFrom, to: prevTo, today, now: Date.now() }
        : null,
    [prevFrom, prevTo, prevCohort, prevLoaded, prevData, jobs, today],
  );
  // ชั้นวัน = เทียบกับวันก่อน (ข้อมูลชุดเดียวกัน) · ชั้นอื่น = เทียบกับช่วงก่อน
  const prevDay = level.day ? scalePrevDay({ from, to, today }, level.day) : null;
  const cmpInput = level.day ? (prevDay ? input : null) : prevInput;
  const cmpLevel = React.useMemo(() => (level.day && prevDay ? { ...level, day: prevDay } : level), [level, prevDay]);
  const cmpSections = React.useMemo(() => (cmpInput ? scaleSections(cmpInput, cmpLevel) : null), [cmpInput, cmpLevel]);
  const cmpCtx: ScaleCompareCtx = {
    day: level.day,
    prevDay,
    prevFrom,
    cohortOk: Boolean(prevCohort),
    loaded: prevLoaded,
    have: { staff: Boolean(prevData.staff), requests: Boolean(prevData.requests), money: Boolean(prevData.money) },
  };
  const cmpOf = (key: ScaleBoxKey): Cmp => scaleCompareOf(key, cmpCtx);
  /** ป้ายเทียบของเลข `cur` กับค่าช่วงก่อน `before` ตามสถานะการเทียบของกล่อง */
  const delta = (c: Cmp, cur: number | null, before: number | null | undefined) =>
    cur == null || c.state === 'none' || c.state === 'wait' ? null : <TrendDelta cur={cur} prev={c.state === 'ok' ? (before ?? null) : null} sense={c.sense} zeroAsUp />;
  const boxTrend = (b: ScaleBox) => (b.format === 'text' ? null : delta(cmpOf(b.key), b.value, cmpSections ? scaleBoxOf(cmpSections, b.key)?.value : null));
  const cmpLabel = level.day ? (prevDay ? scaleDayLabel(prevDay) : null) : prevFrom && prevTo ? rangeText(prevFrom, prevTo) : null;

  // กล่องที่กด แยกตามชั้นถัดไป (+ ของช่วงก่อน ไว้เทียบทีละแถว) — ชั้นลูกที่เป็นวันไม่เทียบ (วันของช่วงก่อนเป็นคนละวัน)
  const bd = React.useMemo(() => (box ? scaleBreakdown(input, level, box.key) : null), [input, level, box]);
  const boxCmp = box ? cmpOf(box.key) : NO_CMP;
  const rowCmp = Boolean(bd) && bd?.kind !== 'day' && boxCmp.state !== 'none';
  const prevBd = React.useMemo(
    () => (box && rowCmp && boxCmp.state === 'ok' && cmpInput ? scaleBreakdown(cmpInput, cmpLevel, box.key) : null),
    [box, rowCmp, boxCmp.state, cmpInput, cmpLevel],
  );
  /** รายการรองในการ์ดเดียวกัน (ไปไหนต่อ · เพราะอะไร) จองคอลัมน์เทียบไว้ด้วย — ตัวเลขทุกรายการในการ์ดตรงแนวเดียวกัน */
  const reserveTrend = rowCmp ? () => null : undefined;

  // เทียบเดือน: ช่วงที่ครอบตั้งแต่ 2 เดือน — กดเดือน = กราฟรายวันของเดือนนั้น
  const monthRows = React.useMemo(() => (scaleMonths({ from, to, today }).length >= 2 ? scaleMonthTable(input, level) : []), [input, level, from, to, today]);
  const month = monthRows.some((m) => m.month === urlMonth) ? urlMonth : null;

  // คนของ BU ที่มีงานใน 60 วันล่าสุด — ตารางแยกตามคนขึ้นคนที่ช่วงนี้ไม่มีงานด้วย · อ่านไม่ได้ = ตารางแบบเดิม (เฉพาะคนที่มีงานในช่วง)
  const rosterEnd = scaleDays({ from, to, today }).at(-1) ?? today;
  const rosterKey = `${rosterEnd}:${bu ?? 'all'}`;
  const [roster, setRoster] = React.useState<{ key: string; rows: StaffRosterRow[] | null }>({ key: '', rows: null });
  React.useEffect(() => {
    let alive = true;
    fetchStaffRoster({ to: rosterEnd, bu })
      .then((rows) => alive && setRoster({ key: rosterKey, rows }))
      .catch(() => alive && setRoster({ key: rosterKey, rows: null }));
    return () => {
      alive = false;
    };
  }, [rosterKey, rosterEnd, bu]);
  const rosterRows = roster.key === rosterKey ? roster.rows : null;

  // งานของคนในวันนั้น (ชั้น คน + วัน) — ทำอะไร ช่องทางไหน กับใบไหน
  const userId = level.who ? scaleUserIdOf(input, level.who) : null;
  const dayKey = level.who && level.day && userId ? `${userId}:${level.day}:${bu ?? 'all'}` : '';
  const [personDay, setPersonDay] = React.useState<{ key: string; data: StaffPersonDay | null; error: string | null }>({ key: '', data: null, error: null });
  React.useEffect(() => {
    if (!dayKey || !userId || !level.day) return;
    let alive = true;
    fetchStaffPersonDay({ from: ymdAddDays(level.day, -6), to: level.day, day: level.day, user: userId, bu })
      .then((d) => alive && setPersonDay({ key: dayKey, data: d, error: null }))
      .catch((e: unknown) => alive && setPersonDay({ key: dayKey, data: null, error: friendlyErrorText(e, 'อ่านงานของวันนี้ไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [dayKey, userId, level.day, bu]);

  // รายใบของกล่องใบขอ + งานที่ทำไปแล้วของใบในหน้านั้น (ทุกช่วงเวลาของใบ)
  const reqRole = box ? scaleReqRoleOf(box.key) : null;
  const reqRows = React.useMemo(() => (reqRole && level.bu ? scaleRequestsOf(input, level, reqRole) : []), [input, level, reqRole]);
  const doneKey = pageOf(reqRows, page)
    .slice.map((r) => r.jobId)
    .filter(Boolean)
    .join(',');
  const [done, setDone] = React.useState<{ key: string; jobs: Record<string, RequestTimelineJob | null> | null }>({ key: '', jobs: null });
  React.useEffect(() => {
    if (!doneKey) return;
    let alive = true;
    fetchRequestTimeline(doneKey.split(','))
      .then((j) => alive && setDone({ key: doneKey, jobs: j }))
      .catch(() => alive && setDone({ key: doneKey, jobs: {} }));
    return () => {
      alive = false;
    };
  }, [doneKey]);
  const doneJobs = done.key === doneKey ? done.jobs : null;
  const stopReasons = React.useMemo(() => scaleStopReasons(input), [input]);

  // ใบขอที่เปิดดู: ทำอะไรไปแล้ว ไล่ตามวัน
  const openRow = openJob ? ((requests ?? []).find((r) => r.jobId === openJob) ?? null) : null;
  const [timeline, setTimeline] = React.useState<{ key: string; job: RequestTimelineJob | null; error: string | null }>({ key: '', job: null, error: null });
  React.useEffect(() => {
    if (!openJob) return;
    let alive = true;
    fetchRequestTimeline([openJob], true)
      .then((j) => alive && setTimeline({ key: openJob, job: j[openJob] ?? null, error: null }))
      .catch((e: unknown) => alive && setTimeline({ key: openJob, job: null, error: friendlyErrorText(e, 'อ่านงานของใบขอไม่ได้') }));
    return () => {
      alive = false;
    };
  }, [openJob]);
  /** ชื่อที่โชว์ของคนประกาศ (ชื่อเล่น ไม่โชว์อีเมล) — ตัวเดียวกับผู้ช่วย AI */
  const staffNameOf = React.useMemo(() => scaleStaffNamer([...(staff ?? []), ...(prevData.staff ?? [])]), [staff, prevData.staff]);
  const requestRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (openJob) requestRef.current?.scrollIntoView?.({ block: 'start' });
  }, [openJob]);

  const pickBox = (key: ScaleBoxKey) => go(level, boxKey === key ? null : key);
  const onRow = (r: ScaleRow) => {
    if (r.go) go({ ...level, ...r.go }, boxKey);
    else if (r.ids?.length) onNames(`${box?.label ?? ''} · ${r.label}`, r.ids);
  };
  const nameButton = (label: string, patch: Partial<ScaleLevel>) => (
    <Button type="button" variant="link" size="sm" className={linkCell} onClick={() => go({ ...level, ...patch }, null)}>
      {label}
    </Button>
  );
  const idsButton = (title: string, n: number, ids: readonly string[]) =>
    n > 0 && ids.length ? (
      <Button type="button" variant="link" size="sm" className="h-auto p-0 tabular-nums" onClick={() => onNames(title, ids)}>
        {fmt(n)}
      </Button>
    ) : (
      fmt(n)
    );

  /* ── ตารางรายใบ: ใบของกล่องใบขอ + งานที่ทำไปแล้ว · กดเลขที่ใบ = ใบนี้ทำอะไรไปแล้ว ── */
  const doneCell = (r: StuckRequest, pick: (j: RequestTimelineJob) => number) => {
    if (!r.jobId) return dash;
    if (!doneJobs) return <Skeleton className="ml-auto h-4 w-6" />;
    const j = doneJobs[r.jobId];
    return j ? fmt(pick(j)) : dash;
  };
  const requestTable = (rows: readonly StuckRequest[], role: ScaleReqRole) => {
    const pg = pageOf(rows, page);
    const open = role === 'remaining' || role === 'idle';
    return (
      <div className="space-y-3">
        <SectionTitle title={LIST_TITLE[role]} right={`${fmt(rows.length)} ใบ`} />
        <div className="overflow-x-auto rounded-xl border">
          <Table data-testid="scale-requests">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">เลขที่ใบขอ</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                <TableHead>หน่วยงาน</TableHead>
                <TableHead className={th}>{AMOUNT_LABEL[role]}</TableHead>
                {open ? (
                  <>
                    <TableHead className={th}>ค้าง (วัน)</TableHead>
                    <TableHead>เริ่มหา</TableHead>
                  </>
                ) : null}
                <TableHead className={th}>งานที่ทำ</TableHead>
                <TableHead className={th}>รายชื่อ</TableHead>
                <TableHead className={th}>นัดได้</TableHead>
                <TableHead className={th}>มา</TableHead>
                {role === 'cancelled' ? <TableHead>ยกเลิกเพราะ</TableHead> : null}
                <TableHead>เจ้าหน้าที่สรรหา</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((r) => (
                <TableRow key={r.jobId ?? r.requestNo}>
                  <TableCell className="whitespace-nowrap">
                    {r.jobId ? (
                      <Button type="button" variant="link" size="sm" className={linkCell} onClick={() => openRequest(r.jobId as string)}>
                        {r.requestNo}
                      </Button>
                    ) : (
                      r.requestNo
                    )}
                  </TableCell>
                  <TableCell>{r.position?.trim() || 'ไม่ระบุ'}</TableCell>
                  <TableCell>{r.unitName?.trim() || r.siteName?.trim() || 'ไม่ระบุ'}</TableCell>
                  <TableCell className={td}>{fmt(scaleReqAmount(r, role))}</TableCell>
                  {open ? (
                    <>
                      <TableCell className={td}>{num(r.ageDays)}</TableCell>
                      <TableCell>{isPostingStarted(r) ? 'เริ่มแล้ว' : <Badge variant="outline">ยังไม่เริ่มหา</Badge>}</TableCell>
                    </>
                  ) : null}
                  <TableCell className={td}>{doneCell(r, (j) => staffWorkTotal(j.done.work))}</TableCell>
                  <TableCell className={td}>{doneCell(r, (j) => j.done.chain[0] ?? 0)}</TableCell>
                  <TableCell className={td}>{doneCell(r, (j) => j.done.chain[4] ?? 0)}</TableCell>
                  <TableCell className={td}>{doneCell(r, (j) => j.done.chain[5] ?? 0)}</TableCell>
                  {role === 'cancelled' ? <TableCell>{scaleStopReasonOf(stopReasons, r) ?? dash}</TableCell> : null}
                  <TableCell className={r.recruiter?.trim() ? undefined : TONE.danger.value}>{recruiterLabelOf(r)}</TableCell>
                </TableRow>
              ))}
              {pg.total === 0 ? (
                <TableRow>
                  <TableCell colSpan={9 + (open ? 2 : 0) + (role === 'cancelled' ? 1 : 0)} className={DASH.sub}>
                    ไม่มีใบขอ
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <Pager {...pg} onPage={setPage} testId="scale-requests-pager" />
      </div>
    );
  };
  const moneyTable = (rows: readonly MoneyRequest[], kind: 'penalty' | 'clock') => {
    const pg = pageOf(rows, page);
    return (
      <div className="space-y-3">
        <SectionTitle title={kind === 'penalty' ? 'ใบที่ยอดสูงสุด' : 'ใบที่ใช้เวลานานสุด'} right={`${fmt(rows.length)} ใบ`} />
        <div className="overflow-x-auto rounded-xl border">
          <Table data-testid={`scale-money-${kind}`}>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">เลขที่ใบขอ</TableHead>
                <TableHead>ลูกค้า</TableHead>
                <TableHead>ตำแหน่ง</TableHead>
                {kind === 'penalty' ? (
                  <>
                    <TableHead className={th}>นับกี่วัน</TableHead>
                    <TableHead className={th}>ค่าปรับ (บาท)</TableHead>
                    <TableHead className={th}>ลดมูลค่า (บาท)</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead className={th}>หาครบใช้ (วัน)</TableHead>
                    <TableHead className={th}>ช้ากว่าที่ลูกค้าต้องการ (วัน)</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((r) => (
                <TableRow key={r.requestNo}>
                  <TableCell className="whitespace-nowrap">{r.requestNo}</TableCell>
                  <TableCell>{r.unit?.trim() || 'ไม่ระบุ'}</TableCell>
                  <TableCell>{r.position?.trim() || 'ไม่ระบุ'}</TableCell>
                  {kind === 'penalty' ? (
                    <>
                      <TableCell className={td}>{fmt(r.amount.need.days)}</TableCell>
                      <TableCell className={td}>{two(r.amount.need.fine)}</TableCell>
                      <TableCell className={td}>{two(r.amount.need.deduct)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className={td}>{num(r.speedDays)}</TableCell>
                      <TableCell className={cn(td, r.lateDays ? TONE.danger.value : undefined)}>{r.lateDays == null ? dash : r.lateDays === 0 ? 'ทัน' : fmt(r.lateDays)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
              {pg.total === 0 ? (
                <TableRow>
                  <TableCell colSpan={kind === 'penalty' ? 6 : 5} className={DASH.sub}>
                    ไม่มีรายการ
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <Pager {...pg} onPage={setPage} testId={`scale-money-${kind}-pager`} />
      </div>
    );
  };
  const topTable = (by: 'customer' | 'position') => {
    const rows = scaleTopRequests(input, level.bu, by);
    const head = by === 'customer' ? 'ลูกค้า' : 'ตำแหน่ง';
    return (
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid={`scale-top-${by}`}>
        <SectionTitle title={`${head}ไหนเหลือหาเยอะสุด`} right={level.bu ?? undefined} />
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{head}</TableHead>
                <TableHead className={th}>ขอใหม่</TableHead>
                <TableHead className={th}>หาได้แล้ว</TableHead>
                <TableHead className={th}>ยกเลิก</TableHead>
                <TableHead className={th}>เหลือหา (อัตรา)</TableHead>
                <TableHead className={th}>เหลือหา (ใบ)</TableHead>
                <TableHead className={th}>ค้างนานสุด (วัน)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell>{r.label}</TableCell>
                  <TableCell className={td}>{fmt(r.new)}</TableCell>
                  <TableCell className={td}>{fmt(r.filled)}</TableCell>
                  <TableCell className={td}>{fmt(r.cancelled)}</TableCell>
                  <TableCell className={td}>{fmt(r.remaining)}</TableCell>
                  <TableCell className={td}>{fmt(r.count)}</TableCell>
                  <TableCell className={td}>{num(r.oldest)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className={DASH.sub}>
                    {requests ? 'ไม่มีใบที่เหลือหา' : (requestsError ?? 'กำลังโหลด')}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  };
  const chainHead = SCALE_CHAIN.map((c) => (
    <TableHead key={c.key} className={c.key === 'cStaffOk' ? thWrap : th}>
      {c.label}
    </TableHead>
  ));

  /* ── คนในกล่องรายชื่อ ไปไหนต่อ (ช่องรวมกัน = เลขของกล่อง) ── */
  const nextBlock = (b: ScaleBox) => {
    const next = scaleNext(input, level, b.key);
    if (!next) return null;
    return (
      <div className="space-y-3">
        <SectionTitle title={`${b.label} ${fmt(next.total)} คน ไปไหนต่อ`} />
        <RankRows
          id="scale-next"
          trendOf={reserveTrend}
          rows={next.parts.map((p) => ({ key: p.key, label: p.label, note: reasonText(p.reasons), value: p.value, format: 'int' as const, go: null, ids: p.ids }))}
          total={next.total}
          onRow={(r) => {
            if (r.ids?.length) onNames(`${b.label} · ${r.label}`, r.ids);
          }}
        />
      </div>
    );
  };
  /* ── ตรงเกณฑ์ใบขอ ไล่ตามขั้น: คนที่ไปถึงแต่ละขั้นอยู่กล่องไหน ── */
  const fitTable = (b: ScaleBox) => {
    const stages = scaleFitStages(input, level);
    if (!stages) return null;
    const labelOf = (k: ScaleBoxKey) => scaleBoxOf(sections, k)?.label ?? '';
    return (
      <div className="space-y-3">
        <SectionTitle title="แต่ละขั้น ตรงเกณฑ์ใบขอไหม" right={scopeText || undefined} />
        <div className="overflow-x-auto rounded-xl border">
          <Table data-testid="scale-fit-table">
            <TableHeader>
              <TableRow>
                <TableHead>ขั้น</TableHead>
                <TableHead className={th}>ทั้งหมด</TableHead>
                {SCALE_FIT_KEYS.map((k) => (
                  <TableHead key={k} className={cn(thWrap, k === b.key && 'text-primary')}>
                    {labelOf(k)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {stages.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="whitespace-nowrap">{s.label}</TableCell>
                  <TableCell className={td}>{fmt(s.total)}</TableCell>
                  {s.cells.map((c) => (
                    <TableCell key={c.key} className={cn(td, c.key === b.key && 'bg-primary/5 font-medium')}>
                      {idsButton(`${s.label} · ${labelOf(c.key)}`, c.n, c.ids)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };
  /* ── เทียบพื้นที่ไม่ได้เพราะอะไร: 4 เหตุรวมกัน = กล่อง ── */
  const unknownBlock = (b: ScaleBox) => {
    const why = scaleFitUnknownWhy(input, level);
    if (!why) return null;
    return (
      <div className="space-y-3">
        <SectionTitle title="เทียบไม่ได้เพราะอะไร" right={scopeText || undefined} />
        <RankRows
          id="scale-unknown"
          trendOf={reserveTrend}
          rows={why.map((w) => ({ key: w.key, label: w.label, note: '', value: w.n, format: 'int' as const, go: null, ids: w.ids }))}
          total={b.value}
          onRow={(r) => {
            if (r.ids?.length) onNames(`${b.label} · ${r.label}`, r.ids);
          }}
        />
      </div>
    );
  };
  /* ── คนที่แจ้งเข้า: ช่องทาง · ใครหามา · กรอกใบ → แจ้งเข้า กี่วัน ── */
  const informedTable = () => {
    const rows = scaleInformedRows(input, level);
    const pg = pageOf(rows, page);
    return (
      <div className="space-y-3">
        <SectionTitle title="แจ้งเข้า ใช้กี่วัน" right={`${fmt(rows.length)} คน`} />
        <div className="overflow-x-auto rounded-xl border">
          <Table data-testid="scale-informed">
            <TableHeader>
              <TableRow>
                <TableHead>BU</TableHead>
                <TableHead>ช่องทาง</TableHead>
                <TableHead>ใครหามา</TableHead>
                <TableHead className="whitespace-nowrap">กรอกใบ</TableHead>
                <TableHead className="whitespace-nowrap">แจ้งเข้า</TableHead>
                <TableHead className={th}>ใช้กี่วัน</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((r, i) => (
                <TableRow key={r.id ?? `${r.createdDay}:${i}`}>
                  <TableCell>{r.bu}</TableCell>
                  <TableCell>{r.channel}</TableCell>
                  <TableCell>{r.bringer}</TableCell>
                  <TableCell className="whitespace-nowrap">{fullDay(r.createdDay)}</TableCell>
                  <TableCell className="whitespace-nowrap">{r.informedDay ? fullDay(r.informedDay) : dash}</TableCell>
                  <TableCell className={td}>{r.days == null ? dash : r.days < 0 ? 'แจ้งเข้าก่อนกรอกใบ' : `${fmt(r.days)} วัน`}</TableCell>
                </TableRow>
              ))}
              {pg.total === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className={DASH.sub}>
                    ไม่มีคนแจ้งเข้า
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <Pager {...pg} onPage={setPage} testId="scale-informed-pager" />
      </div>
    );
  };
  /* ── ยกเลิกเพราะอะไร: เหตุผลจาก ERP รวมกัน = กล่องยกเลิก ── */
  const cancelBlock = () => {
    const cr = scaleCancelReasons(input, level);
    return (
      <div className="space-y-3" data-testid="scale-cancel-reasons">
        <SectionTitle title="ยกเลิกเพราะอะไร" right={cr ? `${fmt(cr.total)} อัตรา` : undefined} />
        {cr ? (
          <RankRows id="scale-reasons" trendOf={reserveTrend} rows={cr.rows.map((r) => ({ key: r.label, label: r.label, note: `${fmt(r.count)} ใบ`, value: r.n, format: 'int' as const, go: null }))} total={cr.total} onRow={() => undefined} />
        ) : money.key === moneyKey && money.error ? (
          <p className={cn('text-sm', TONE.danger.value)}>{money.error}</p>
        ) : (
          <Skeleton className="h-16 w-full" />
        )}
      </div>
    );
  };

  /* ── การ์ดของกล่องที่กด ── */
  const detail = () => {
    if (!box) return null;
    const leaf = !bd;
    // แถว + ค่าช่วงก่อนทีละแถว (แถวที่หายไปขึ้นเป็น 0) — กติกาอยู่ที่ `scaleBreakdownCompared`
    const rows: ScaleRowCompared[] = bd ? scaleBreakdownCompared(bd, prevBd, boxCmp.state) : [];
    const rowTrend = bd && rowCmp ? (r: ScaleRowCompared) => (r.before === undefined ? null : <TrendDelta cur={r.value} prev={r.before} sense={boxCmp.sense} zeroAsUp />) : undefined;
    return (
      <Card className="min-w-0 space-y-4 rounded-2xl p-5" data-testid="scale-detail">
        <SectionTitle
          title={`${box.label} ${shownText(box)}`}
          right={[bd ? SCALE_CHILD_TITLE[bd.kind] : null, scopeText || null].filter(Boolean).join(' · ') || undefined}
        />
        {bd ? <RankRows rows={rows} total={bd.total} onRow={onRow} trendOf={rowTrend} /> : null}
        {box.ids?.length ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onNames([box.label, scopeText].filter(Boolean).join(' · '), box.ids ?? [])} data-testid="scale-detail-names">
            ดูรายชื่อ {fmt(box.ids.length)} คน
          </Button>
        ) : null}
        {nextBlock(box)}
        {box.key === 'fitUnknown' ? unknownBlock(box) : null}
        {SCALE_FIT_KEYS.includes(box.key) ? fitTable(box) : null}
        {box.key === 'cInformed' ? informedTable() : null}
        {box.key === 'reqCancelled' ? cancelBlock() : null}
        {reqRole && level.bu ? requestTable(reqRows, reqRole) : null}
        {leaf && PEN_KEYS.includes(box.key) ? moneyTable(scalePenaltyRows(scaleMoneyOf(input, level.bu)), 'penalty') : null}
        {leaf && CLOCK_KEYS.includes(box.key) ? moneyTable(scaleClockedRows(scaleMoneyOf(input, level.bu)), 'clock') : null}
        {leaf && FLOW_KEYS.includes(box.key) ? (
          <RankRows
            rows={scaleTopRequests(input, level.bu, 'customer').map((r) => ({
              key: r.label,
              label: r.label,
              note: `เหลือหา ${fmt(r.remaining)} อัตรา${r.oldest != null ? ` · ค้างนานสุด ${fmt(r.oldest)} วัน` : ''}`,
              value: box.key === 'inPerDay' ? r.new : box.key === 'outPerDay' ? r.filled + r.cancelled : r.remaining,
              format: 'int' as const,
              go: null,
            }))}
            total={null}
            onRow={onRow}
          />
        ) : null}
      </Card>
    );
  };

  /* ── ใบขอใบเดียว: ทำอะไรไปแล้ว ไล่ตามวัน ── */
  const requestView = (r: StuckRequest) => {
    const mine = timeline.key === openJob ? timeline : null;
    const job = mine?.job ?? null;
    const flow = flowOf(r);
    const rows = buildRequestTimeline({ ...r, releasedBy: staffNameOf(r.releasedBy) }, job?.events ?? [], scaleStopReasonOf(stopReasons, r));
    const pg = pageOf(rows, eventPage, 15);
    const rowTiles = 'grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7';
    const head = 'pt-2 text-sm font-medium';
    const wait = <Skeleton className="h-7 w-10" />;
    const stat = (v: number | undefined) => (mine ? (job ? fmt(v ?? 0) : dash) : wait);
    return (
      <Card ref={requestRef} className="min-w-0 scroll-mt-24 space-y-4 rounded-2xl p-5" data-testid="scale-request">
        <SectionTitle
          title={`${r.requestNo} ทำอะไรไปแล้ว`}
          right={
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRequest(openJob as string)} data-testid="scale-request-open">
              เปิดใบขอ
            </Button>
          }
        />
        <p className="text-sm">{[r.position?.trim() || 'ไม่ระบุตำแหน่ง', r.unitName?.trim() || r.siteName?.trim() || 'ไม่ระบุหน่วยงาน', `เจ้าหน้าที่สรรหา ${recruiterLabelOf(r)}`].join(' · ')}</p>
        <div className="grid gap-3 lg:grid-cols-[8.5rem_minmax(0,1fr)]">
          <h3 className={head}>ใบขอ · {rangeText(from, to > today ? today : to)}</h3>
          <div className={rowTiles}>
            <StatTile label="ยกมา" value={fmt(flow.carryIn)} />
            <StatTile label="ขอใหม่" value={fmt(flow.new)} />
            <StatTile label="หาได้แล้ว" value={fmt(flow.filled)} />
            <StatTile label="ยกเลิก" value={fmt(flow.cancelled)} />
            <StatTile label="เหลือหา" value={fmt(flow.remaining)} />
            <StatTile label="ค้าง (วัน)" value={num(r.ageDays)} />
          </div>
          <h3 className={head}>งานที่ทำ · ตั้งแต่ขอ</h3>
          <div className={rowTiles} data-testid="scale-request-work">
            <StatTile label="รวม" value={mine ? (job ? fmt(staffWorkTotal(job.done.work)) : dash) : wait} />
            {STAFF_PERSON_KINDS.map((k) => (
              <StatTile key={k.key} label={k.label} value={stat(job?.done.work[k.key])} />
            ))}
          </div>
          <h3 className={head}>รายชื่อ · ตั้งแต่ขอ</h3>
          <div className={rowTiles} data-testid="scale-request-chain">
            {SCALE_CHAIN.map((c, i) => (
              <StatTile key={c.key} label={c.label} value={stat(job?.done.chain[i])} />
            ))}
          </div>
        </div>
        {mine?.error ? <p className={cn('text-sm', TONE.danger.value)}>{mine.error}</p> : null}
        <div className="overflow-x-auto rounded-xl border">
          <Table data-testid="scale-request-timeline">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">วันที่</TableHead>
                <TableHead>ทำอะไร</TableHead>
                <TableHead className={th}>จำนวน</TableHead>
                <TableHead>ใคร</TableHead>
                <TableHead>รายละเอียด</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pg.slice.map((e) => (
                <TableRow key={e.key} className={e.mark ? 'bg-muted/60 font-medium' : undefined}>
                  <TableCell className="whitespace-nowrap">{fullDay(e.day)}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.label}</TableCell>
                  <TableCell className={td}>{e.n == null ? dash : `${fmt(e.n)} ${e.unit}`}</TableCell>
                  <TableCell className="whitespace-nowrap">{e.who ?? dash}</TableCell>
                  <TableCell>{e.detail ?? dash}</TableCell>
                </TableRow>
              ))}
              {pg.total === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className={DASH.sub}>
                    ยังไม่มีรายการ
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
        <Pager {...pg} onPage={setEventPage} testId="scale-request-pager" />
      </Card>
    );
  };

  /* ── เทียบเดือน: แต่ละเดือนทำงานไปเท่าไหร่ ได้รายชื่อถึงไหน เทียบเดือนก่อนหน้า ── */
  const monthCard = () => (
    <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-months">
      <SectionTitle title="เทียบเดือน" right={[level.bu, level.who, level.ch, level.grp].filter(Boolean).join(' · ') || undefined} />
      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>เดือน</TableHead>
              <TableHead className={th}>งานที่ทำ</TableHead>
              {chainHead}
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthRows.map((m, i) => {
              const before = i > 0 ? monthRows[i - 1] : null;
              const on = month === m.month;
              return (
                <TableRow key={m.month} className={on ? 'bg-primary/5' : undefined} data-testid={`scale-month-${m.month}`}>
                  <TableCell className="whitespace-nowrap align-top">
                    <Button type="button" variant="link" size="sm" className={linkCell} aria-pressed={on} onClick={() => go({ ...level, day: null }, null, { month: on ? null : m.month })}>
                      {m.label}
                    </Button>
                  </TableCell>
                  <TableCell className={cn(td, 'align-top')}>
                    <StackCell value={m.work} before={before ? (m.workComparable ? before.work : null) : undefined} sense="good" />
                  </TableCell>
                  {m.chain.map((v, j) => (
                    <TableCell key={SCALE_CHAIN[j].key} className={cn(td, 'align-top')}>
                      <StackCell value={v} before={before ? before.chain[j] : undefined} sense="good" />
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/60 font-medium">
              <TableCell>รวม</TableCell>
              <TableCell className={td}>{monthRows.some((m) => m.work == null) ? dash : fmt(monthRows.reduce((a, m) => a + (m.work ?? 0), 0))}</TableCell>
              {SCALE_CHAIN.map((c, j) => (
                <TableCell key={c.key} className={td}>
                  {fmt(monthRows.reduce((a, m) => a + m.chain[j], 0))}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  /* ── กราฟรายวัน ── */
  const chart = () => {
    const series = scaleDaySeries(input, level, month);
    const max = Math.max(1, ...series.map((d) => d.value));
    const last = series.at(-1);
    const before = series.at(-2);
    const diff = last && before ? last.value - before.value : null;
    const focus = month ? (monthRows.find((m) => m.month === month)?.label ?? null) : null;
    return (
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-chart">
        <SectionTitle
          title="แต่ละวันทำงานไปกี่รายการ"
          right={[level.bu, level.who, focus, !focus && scaleDayCount(input) > series.length ? `${fmt(series.length)} วันล่าสุด` : null].filter(Boolean).join(' · ') || undefined}
        />
        {staff ? (
          <div className="overflow-x-auto">
            <div className="flex h-44 gap-1 border-b" data-testid="scale-days">
              {series.map((d) => {
                const on = level.day === d.day;
                return (
                  <button
                    key={d.day}
                    type="button"
                    onClick={() => go({ ...level, ch: null, grp: null, day: on ? null : d.day }, null)}
                    aria-pressed={on}
                    title={`${scaleDayLabel(d.day)} · ${fmt(d.value)} รายการ`}
                    data-testid={`scale-day-${d.day}`}
                    className="flex min-w-8 flex-1 flex-col items-center justify-end gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn('rounded-full border bg-background px-1.5 text-xs tabular-nums', on && 'border-primary font-medium text-primary')}>{fmt(d.value)}</span>
                    <span
                      className={cn('w-3/5 max-w-8 rounded-t-lg', !on && d.day !== last?.day && 'opacity-40')}
                      style={{ height: `${(d.value / max) * 72}%`, minHeight: 2, background: TONE.primary.hex }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1 pt-1">
              {series.map((d) => (
                <span key={d.day} className={cn('min-w-8 flex-1 text-center text-xs leading-4', level.day === d.day ? 'font-medium text-primary' : DASH.sub, scaleIsWeekend(d.day) && level.day !== d.day && 'opacity-60')}>
                  {Number(d.day.slice(8))}
                  <br />
                  {scaleWeekday(d.day)}
                </span>
              ))}
            </div>
          </div>
        ) : staffError ? (
          <p className={cn('text-sm', TONE.danger.value)}>{staffError}</p>
        ) : (
          <Skeleton className="h-44 w-full" />
        )}
        {last && before && diff != null ? (
          <p className={cn('text-right text-xs tabular-nums', DASH.sub)} data-testid="scale-days-compare">
            {scaleDayLabel(before.day)} {fmt(before.value)} · {scaleDayLabel(last.day)} {fmt(last.value)} · {diff >= 0 ? 'มากกว่าวันก่อน' : 'น้อยกว่าวันก่อน'} {fmt(Math.abs(diff))}
          </p>
        ) : null}
      </Card>
    );
  };

  /* ── ตารางปกติของชั้น ── */
  const base = () => {
    if (level.day && level.who) {
      const d = personDay.key === dayKey ? personDay.data : null;
      const work = sections.find((s) => s.key === 'work')?.boxes ?? [];
      return (
        <Card className="min-w-0 space-y-4 rounded-2xl p-5" data-testid="scale-person-day">
          <SectionTitle title={`${level.who} ทำอะไร`} right={scaleDayLabel(level.day)} />
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>งาน</TableHead>
                  <TableHead className={th}>จำนวน</TableHead>
                  <TableHead>ช่องทาง · ผล</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {STAFF_PERSON_KINDS.map((k, i) => (
                  <TableRow key={k.key}>
                    <TableCell>{k.label}</TableCell>
                    <TableCell className={td}>{num(work[i + 1]?.value)}</TableCell>
                    <TableCell className={DASH.sub}>{d?.channels[k.key]?.length ? d.channels[k.key].map((c) => staffSubText(k.key, c)).join(' · ') : '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/60 font-medium">
                  <TableCell>รวม</TableCell>
                  <TableCell className={td}>{num(work[0]?.value)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {personDay.key === dayKey && personDay.error ? <p className={cn('text-sm', TONE.danger.value)}>{personDay.error}</p> : null}
          {d ? (
            <>
              <SectionTitle title="ทำกับใบไหน" right={`${fmt(d.jobs.length)} ใบ`} />
              <div className="overflow-x-auto rounded-xl border">
                <Table data-testid="scale-person-day-jobs">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ใบขอ</TableHead>
                      <TableHead className={th}>Gen link</TableHead>
                      <TableHead className={th}>โพสต์แล้ว</TableHead>
                      <TableHead className={th}>Scrap</TableHead>
                      <TableHead className={th}>Autopost</TableHead>
                      <TableHead className={th}>คลิก</TableHead>
                      <TableHead className={th}>กรอก</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageOf(d.jobs, page).slice.map((j) => (
                      <TableRow key={j.jobId}>
                        <TableCell className="whitespace-nowrap">
                          <Button type="button" variant="link" size="sm" className={linkCell} onClick={() => onOpenRequest(j.jobId)}>
                            {j.label}
                          </Button>
                        </TableCell>
                        <TableCell className={td}>{fmt(j.links)}</TableCell>
                        <TableCell className={td}>{fmt(j.manualPosted)}</TableCell>
                        <TableCell className={td}>{fmt(j.scrap)}</TableCell>
                        <TableCell className={td}>{fmt(j.autopost)}</TableCell>
                        <TableCell className={td}>{fmt(j.clicks)}</TableCell>
                        <TableCell className={td}>{fmt(j.applicants)}</TableCell>
                      </TableRow>
                    ))}
                    {d.jobs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className={DASH.sub}>
                          ไม่มีงานที่ผูกกับใบขอ
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
              <Pager {...pageOf(d.jobs, page)} onPage={setPage} testId="scale-person-day-pager" />
            </>
          ) : dayKey && !(personDay.key === dayKey && personDay.error) ? (
            <Skeleton className="h-24 w-full" />
          ) : null}
        </Card>
      );
    }
    if (level.day) {
      const t = scaleDayTable(input, level);
      return (
        <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-day-table">
          <SectionTitle title="ใครทำอะไร" right={[scaleDayLabel(level.day), level.bu].filter(Boolean).join(' · ')} />
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>คน</TableHead>
                  <TableHead>BU</TableHead>
                  <TableHead className={th}>รวม</TableHead>
                  {KIND_LABELS.map((l) => (
                    <TableHead key={l} className={th}>
                      {l}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="whitespace-nowrap">{nameButton(r.name, { bu: level.bu ?? r.bu, who: r.name })}</TableCell>
                    <TableCell>{r.bu}</TableCell>
                    <TableCell className={td}>{fmt(r.sum)}</TableCell>
                    {STAFF_PERSON_KINDS.map((k) => (
                      <TableCell key={k.key} className={td}>
                        {fmt(r.work[k.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                {t.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3 + KIND_LABELS.length} className={DASH.sub}>
                      ไม่มีงานวันนี้
                    </TableCell>
                  </TableRow>
                ) : null}
                <TableRow className="bg-muted/60 font-medium">
                  <TableCell>รวม</TableCell>
                  <TableCell />
                  <TableCell className={td}>{fmt(t.total.sum)}</TableCell>
                  {STAFF_PERSON_KINDS.map((k) => (
                    <TableCell key={k.key} className={td}>
                      {fmt(t.total.work[k.key])}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Card>
      );
    }
    if (!level.bu) {
      const t = scaleBuTable(input);
      const buRow = (r: (typeof t.rows)[number], total = false) => (
        <TableRow key={r.bu} className={total ? 'bg-muted/60 font-medium' : undefined}>
          <TableCell>{total ? r.bu : nameButton(r.bu, { bu: r.bu })}</TableCell>
          <TableCell className={td}>
            {num(r.reqPos)} · {num(r.reqCount)}
          </TableCell>
          <TableCell className={td}>{num(r.reqIdle)}</TableCell>
          <TableCell className={td}>{num(r.people)}</TableCell>
          <TableCell className={td}>{num(r.work)}</TableCell>
          {r.chain.map((v, i) => (
            <TableCell key={SCALE_CHAIN[i].key} className={td}>
              {fmt(v)}
            </TableCell>
          ))}
        </TableRow>
      );
      return (
        <>
          <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-bu-table">
            <SectionTitle title="แยกตาม BU" />
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BU</TableHead>
                    <TableHead className={th}>เหลือหา (อัตรา · ใบ)</TableHead>
                    <TableHead className={th}>ยังไม่เริ่มหา</TableHead>
                    <TableHead className={th}>คนทำงาน</TableHead>
                    <TableHead className={th}>งานที่ทำ</TableHead>
                    {chainHead}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.rows.map((r) => buRow(r))}
                  {buRow(t.total, true)}
                </TableBody>
              </Table>
            </div>
          </Card>
          {topTable('customer')}
          {topTable('position')}
        </>
      );
    }
    if (!level.who) {
      const t = scalePeopleTable(input, level.bu, rosterRows);
      const h = scaleHoldTable(input, level.bu);
      return (
        <>
          <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-people-table">
            <SectionTitle title="แยกตามคน" right={level.bu} />
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>คน</TableHead>
                    <TableHead className="whitespace-nowrap">ทำล่าสุด</TableHead>
                    <TableHead className={th}>งานที่ทำ</TableHead>
                    {chainHead}
                    <TableHead className={thWrap}>ทำ 100 งาน ได้กี่รายชื่อ</TableHead>
                    <TableHead className="whitespace-nowrap">เทียบกับทีม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {t.rows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="whitespace-nowrap">
                        {nameButton(r.name, { who: r.name })}
                        {!r.member && !r.source ? <span className={cn('ml-1 text-xs', DASH.sub)}>นอก {level.bu}</span> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {r.lastDay ? scaleDayLabel(r.lastDay) : dash}
                        {r.idleDays ? (
                          <Badge variant="outline" className="ml-2">
                            ไม่มีงานมา {fmt(r.idleDays)} วัน
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className={td}>{num(r.work)}</TableCell>
                      {r.chain.map((v, i) => (
                        <TableCell key={SCALE_CHAIN[i].key} className={td}>
                          {fmt(v)}
                        </TableCell>
                      ))}
                      <TableCell className={td}>{r.per100 == null ? dash : one(r.per100)}</TableCell>
                      <TableCell className="whitespace-nowrap">{r.versus ? <Badge variant={r.versus === 'manyFew' ? 'secondary' : 'outline'}>{SCALE_VERSUS_LABEL[r.versus]}</Badge> : dash}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/60 font-medium">
                    <TableCell>รวม</TableCell>
                    <TableCell />
                    <TableCell className={td}>{num(t.total.work)}</TableCell>
                    {t.total.chain.map((v, i) => (
                      <TableCell key={SCALE_CHAIN[i].key} className={td}>
                        {fmt(v)}
                      </TableCell>
                    ))}
                    <TableCell className={td}>{t.total.per100 == null ? dash : one(t.total.per100)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow className={DASH.sub}>
                    <TableCell className="whitespace-nowrap">เฉลี่ยต่อคน · {fmt(t.average.people)} คน</TableCell>
                    <TableCell />
                    <TableCell className={td}>{fmt(Math.round(t.average.work))}</TableCell>
                    {t.average.chain.map((v, i) => (
                      <TableCell key={SCALE_CHAIN[i].key} className={td}>
                        {fmt(Math.round(v))}
                      </TableCell>
                    ))}
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
          <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-hold-table">
            <SectionTitle title="รายชื่ออยู่ที่ใคร" right={level.bu} />
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>คน</TableHead>
                    {SCALE_HOLD.map((c) => (
                      <TableHead key={c.key} className={th}>
                        {c.label}
                      </TableHead>
                    ))}
                    <TableHead className={th}>ติดต่อได้ %</TableHead>
                    <TableHead className="whitespace-nowrap">ค้างนานสุด</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...h.rows, h.total].map((r, i) => {
                    const total = i === h.rows.length;
                    return (
                      <TableRow key={total ? 'รวม' : r.name} className={total ? 'bg-muted/60 font-medium' : undefined}>
                        <TableCell className="whitespace-nowrap">{total ? r.name : nameButton(r.name, { who: r.name })}</TableCell>
                        <TableCell className={td}>{fmt(r.all)}</TableCell>
                        <TableCell className={td}>{fmt(r.ok)}</TableCell>
                        <TableCell className={td}>{fmt(r.fail)}</TableCell>
                        <TableCell className={td}>{fmt(r.wait)}</TableCell>
                        <TableCell className={td}>{r.okPct == null ? dash : `${fmt(r.okPct)}%`}</TableCell>
                        <TableCell className={cn('whitespace-nowrap', !total && (r.oldestDays ?? 0) >= 3 && TONE.danger.value)}>
                          {total || r.oldestDays == null ? dash : r.oldestDays === 0 ? 'วันนี้' : `${fmt(r.oldestDays)} วัน`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
          {topTable('customer')}
          {topTable('position')}
        </>
      );
    }
    const t = scaleChainTable(input, level);
    const leaf = Boolean(level.grp);
    const title = leaf ? 'รายชื่อไปถึงไหนแล้ว' : t.by === 'group' ? 'มาจากกลุ่มไหน' : `รายชื่อที่ ${level.who} หามา มาจากช่องทางไหน`;
    return (
      <Card className="min-w-0 space-y-3 rounded-2xl p-5" data-testid="scale-chain-table">
        <SectionTitle title={title} right={[level.bu, level.ch, level.grp].filter(Boolean).join(' · ')} />
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.by === 'group' ? 'กลุ่ม' : 'ช่องทาง'}</TableHead>
                {chainHead}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(leaf ? [] : t.rows).map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{nameButton(r.label, t.by === 'group' ? { grp: r.key } : { ch: r.key })}</TableCell>
                  {r.chain.map((v, i) => (
                    <TableCell key={SCALE_CHAIN[i].key} className={td}>
                      {idsButton(`${r.label} · ${SCALE_CHAIN[i].label}`, v, r.ids[i])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="bg-muted/60 font-medium">
                <TableCell>{leaf ? level.grp : 'รวม'}</TableCell>
                {t.total.chain.map((v, i) => (
                  <TableCell key={SCALE_CHAIN[i].key} className={td}>
                    {idsButton(`${scopeText} · ${SCALE_CHAIN[i].label}`, v, t.total.ids[i])}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4" data-testid="scale-panel">
      <div className="flex flex-wrap items-center gap-2" data-testid="scale-crumbs">
        {crumbs.map((c, i) => {
          const here = i === crumbs.length - 1;
          return (
            <React.Fragment key={`${i}:${c.label}`}>
              {i > 0 ? <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" /> : null}
              <Button
                type="button"
                size="sm"
                variant={here && !openRow ? 'default' : 'outline'}
                className="rounded-full"
                aria-current={here && !openRow ? 'page' : undefined}
                onClick={() => (here && openRow ? openRequest(null) : go(c.level, boxKey))}
                data-testid={`scale-crumb-${i}`}
              >
                {c.label}
              </Button>
            </React.Fragment>
          );
        })}
        {openRow ? (
          <>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            <Button type="button" size="sm" className="rounded-full" aria-current="page" data-testid="scale-crumb-request">
              {openRow.requestNo}
            </Button>
          </>
        ) : null}
        {cmpLabel ? (
          <span className={cn('ml-auto text-xs tabular-nums', DASH.sub)} data-testid="scale-compare">
            เทียบกับ {cmpLabel}
          </span>
        ) : null}
      </div>

      <Card className="min-w-0 rounded-2xl p-5" data-testid="scale-numbers">
        {sections.map((sec) => (
          <div key={sec.key} className="grid gap-3 border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0 lg:grid-cols-[8.5rem_minmax(0,1fr)]" data-testid={`scale-row-${sec.key}`}>
            <h3 className="pt-2 text-sm font-medium">{sec.title}</h3>
            <div className="min-w-0 space-y-2">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {sec.boxes.map((b) => (
                  <BoxTile key={b.key} box={b} active={box?.key === b.key} onPick={pickBox} trend={boxTrend(b)} />
                ))}
              </div>
              {sec.equation ? (
                <p className={cn('text-xs tabular-nums', DASH.sub)} data-testid="scale-equation">
                  {sec.equation}
                </p>
              ) : null}
            </div>
          </div>
        ))}
        {[requestsError, staffError, money.key === moneyKey ? money.error : null].filter(Boolean).map((e) => (
          <p key={e} className={cn('pt-3 text-sm', TONE.danger.value)}>
            {e}
          </p>
        ))}
      </Card>

      {openRow ? (
        requestView(openRow)
      ) : box ? (
        detail()
      ) : (
        <>
          {monthRows.length >= 2 ? monthCard() : null}
          {!level.ch && !level.grp ? chart() : null}
          {base()}
        </>
      )}
    </div>
  );
}
