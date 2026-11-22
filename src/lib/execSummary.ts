/**
 * ═══ สรุปงานสรรหาให้ผู้ช่วย AI ตอบผู้บริหาร (เจ้าของ 20 พ.ย. 2569 "ถ้าในจอตอบไม่ได้ ผู้ช่วย AI ต้องช่วยได้") ═══
 * เลขทุกตัว = ตัวคิดของแท็บ "Scale ลง" (`overviewScale.ts`) — ไฟล์นี้แค่เรียงเป็นก้อนเล็กที่อ่านง่าย ไม่เกินเพดานผลอ่านของผู้ช่วย
 * 🔴 ไม่มีนิยามใหม่ของเลขใด · ไม่มีชื่อ/เบอร์/id ผู้สมัคร (นับเป็นจำนวน) · เทียบไม่ได้ = null ไม่ใช่ 0
 * ตรรกะล้วน ไม่มี IO — เทสต์ `execSummary.test.ts` · เส้น `/api/exec-summary`
 */
import type { StaffRosterRow } from '@/lib/staffActivity';
import { STAFF_PERSON_KINDS } from '@/lib/staffActivity';
import { isPostingStarted } from '@/lib/recruitPostingState';
import { recruiterLabelOf } from '@/lib/recruitStuck';
import {
  SCALE_CHAIN,
  SCALE_CHILD_TITLE,
  SCALE_FIT_KEYS,
  SCALE_VERSUS_LABEL,
  scaleBoxOf,
  scaleBreakdown,
  scaleBreakdownCompared,
  scaleBus,
  scaleBuTable,
  scaleCancelReasons,
  scaleChainTable,
  scaleCompareOf,
  scaleCrumbs,
  scaleDayCount,
  scaleDaySeries,
  scaleDayTable,
  scaleFitStages,
  scaleFitUnknownWhy,
  scaleHoldTable,
  scaleInformedRows,
  scaleMonthTable,
  scaleMonths,
  scaleNext,
  scalePeopleTable,
  scalePrevDay,
  scaleReqAmount,
  scaleReqRoleOf,
  scaleRequestsOf,
  scaleSections,
  scaleStopReasonOf,
  scaleStopReasons,
  scaleTopRequests,
  type ScaleBoxKey,
  type ScaleCompareCtx,
  type ScaleInput,
  type ScaleLevel,
} from '@/lib/overviewScale';

/** ผลอ่านของผู้ช่วยถูกตัดที่ 24,000 ตัวอักษร — สรุปต้องเล็กกว่านั้นเสมอ (เผื่อหัว HTTP) */
export const EXEC_SUMMARY_MAX = 22_000;

/** `prev` = ค่าช่วงก่อนของกล่องเดียวกัน · null = เทียบไม่ได้ · ไม่มีช่องนี้ = กล่องนี้ไม่เทียบ (สถานะ ณ ตอนนี้) */
export type ExecBox = { key: ScaleBoxKey; label: string; value: number | null; text?: string; sub?: string; prev?: number | null };
export type ExecSummary = {
  generatedAt: string;
  /** ช่วงที่ใช้คิด + เทียบกับอะไร (ช่วงก่อนยาวเท่ากัน / วันก่อน) */
  window: { from: string; to: string; days: number; compareWith: string | null };
  /** ชั้นที่ดูอยู่ จากบนลงล่าง เช่น ["ทั้งหมด","LBD","เจมส์"] */
  level: string[];
  /** BU ที่มีข้อมูลในช่วง (ค่าที่ส่ง `bu` ได้) */
  bus: string[];
  sections: Array<{ title: string; equation?: string; boxes: ExecBox[] }>;
  /** ลำดับของเลขในช่อง `chain` ทุกที่ */
  chain: string[];
  byBu?: Array<{ bu: string; remainingPositions: number | null; remainingRequests: number | null; notStarted: number | null; people: number | null; work: number | null; chain: number[] }>;
  people?: Array<{ name: string; outside?: true; lastDay: string | null; idleDays: number | null; work: number | null; chain: number[]; per100: number | null; versus?: string }>;
  peopleAverage?: { people: number; work: number; chain: number[] };
  hold?: Array<{ name: string; all: number; ok: number; fail: number; waiting: number; okPct: number | null; oldestDays: number | null }>;
  channels?: Array<{ label: string; chain: number[] }>;
  /** วันนั้นใครทำอะไร — `kinds` เรียงตาม `workKinds` */
  dayPeople?: Array<{ name: string; bu: string; sum: number; kinds: number[] }>;
  workKinds?: string[];
  /** งานที่ทำรายวัน [วัน, รายการ] */
  days?: Array<[string, number]>;
  months?: Array<{ month: string; work: number | null; chain: number[] }>;
  /** ตรงเกณฑ์ใบขอ ไล่ตามขั้น — `cells` เรียงตาม `columns` · `unknownWhy` = เทียบพื้นที่ไม่ได้เพราะอะไร (รวมกัน = กล่องเทียบพื้นที่ไม่ได้) */
  fit?: { columns: string[]; stages: Array<{ stage: string; total: number; cells: number[] }>; unknownWhy: Array<{ reason: string; people: number }> };
  /** คนในแต่ละขั้นไปไหนต่อ (ช่องรวมกัน = total) */
  next?: Array<{ from: string; total: number; parts: Array<{ label: string; value: number; reasons?: string }> }>;
  cancelReasons?: Array<{ reason: string; positions: number; requests: number }>;
  topCustomers?: Array<{ name: string; new: number; filled: number; cancelled: number; remaining: number; requests: number; oldestDays: number | null }>;
  topPositions?: Array<{ name: string; new: number; filled: number; cancelled: number; remaining: number; requests: number; oldestDays: number | null }>;
  /** คนที่แจ้งเข้า: กรอกใบ → แจ้งเข้า กี่วัน (ติดลบ = แจ้งเข้าก่อนกรอกใบ) */
  informed?: Array<{ bu: string; channel: string; bringer: string; createdDay: string; informedDay: string | null; days: number | null }>;
  /** กล่องที่ขอ (`box`) แยกตามชั้นถัดไป */
  breakdown?: { box: string; by: string; total: number | null; rows: Array<{ label: string; value: number | null; text?: string; note?: string; prev?: number | null }> };
  /** รายใบของกล่องใบขอที่ขอ (ต้องอยู่ชั้น BU ลงไป) — `jobId` ใช้กับ /api/request-timeline */
  requests?: Array<{ requestNo: string; jobId: string | null; position: string; unit: string; amount: number; ageDays: number | null; started?: boolean; recruiter: string; cancelReason?: string }>;
  errors: string[];
};

export type ExecSummaryArgs = {
  input: ScaleInput;
  /** ช่วงก่อน (ยาวเท่ากัน) — null = ไม่เทียบ */
  prev: ScaleInput | null;
  /** รายชื่อช่วงก่อนมีครบทั้งช่วง */
  prevCohortOk: boolean;
  level: ScaleLevel;
  box: ScaleBoxKey | null;
  roster: readonly StaffRosterRow[] | null;
  generatedAt: string;
  errors: readonly string[];
};

const NEXT_KEYS: readonly ScaleBoxKey[] = ['cNames', 'cAiCalled', 'cAiYes', 'cStaffOk', 'cBooked'];
/** ก้อนที่ตัดออกก่อนเมื่อใหญ่เกิน (สำคัญน้อยสุดก่อน) */
const DROP_ORDER = ['days', 'informed', 'topPositions', 'topCustomers', 'next', 'fit', 'months', 'hold', 'channels'] as const;
const top3 = (reasons: ReadonlyArray<{ label: string; n: number }>): string | undefined => (reasons.length ? reasons.slice(0, 3).map((r) => `${r.label} ${r.n}`).join(' · ') : undefined);

export function buildExecSummary(a: ExecSummaryArgs): ExecSummary {
  const { input, prev, level } = a;
  const errors = [...a.errors];
  const prevDay = level.day ? scalePrevDay(input, level.day) : null;
  const ctx: ScaleCompareCtx = {
    day: level.day,
    prevDay,
    prevFrom: prev?.from ?? null,
    cohortOk: a.prevCohortOk,
    loaded: true,
    have: { staff: Boolean(prev?.staff), requests: Boolean(prev?.requests), money: Boolean(prev?.money) },
  };
  const cmpInput = level.day ? (prevDay ? input : null) : prev;
  const cmpLevel: ScaleLevel = level.day && prevDay ? { ...level, day: prevDay } : level;
  const sections = scaleSections(input, level);
  const before = cmpInput ? scaleSections(cmpInput, cmpLevel) : null;
  const root = !level.who && !level.ch && !level.grp && !level.day;

  const out: ExecSummary = {
    generatedAt: a.generatedAt,
    window: { from: input.from, to: input.to, days: scaleDayCount(input), compareWith: level.day ? (prevDay ? `วันก่อน ${prevDay}` : null) : prev ? `${prev.from} ถึง ${prev.to}` : null },
    level: scaleCrumbs(level).map((c) => c.label),
    bus: scaleBus(input),
    sections: sections.map((s) => ({
      title: s.title,
      ...(s.equation ? { equation: s.equation } : {}),
      boxes: s.boxes.map((b): ExecBox => {
        const c = b.value == null || b.format === 'text' ? null : scaleCompareOf(b.key, ctx);
        return {
          key: b.key,
          label: b.label,
          value: b.format === 'text' ? null : b.value,
          ...(b.format === 'text' && b.text ? { text: b.text } : {}),
          ...(b.sub ? { sub: b.sub } : {}),
          ...(c && c.state !== 'none' ? { prev: c.state === 'ok' && before ? (scaleBoxOf(before, b.key)?.value ?? null) : null } : {}),
        };
      }),
    })),
    chain: SCALE_CHAIN.map((c) => c.label),
    errors,
  };

  if (level.day && !level.who) {
    const t = scaleDayTable(input, level);
    out.workKinds = STAFF_PERSON_KINDS.map((k) => k.label);
    out.dayPeople = t.rows.slice(0, 30).map((r) => ({ name: r.name, bu: r.bu, sum: r.sum, kinds: STAFF_PERSON_KINDS.map((k) => r.work[k.key]) }));
  } else if (!level.bu) {
    out.byBu = scaleBuTable(input).rows.map((r) => ({ bu: r.bu, remainingPositions: r.reqPos, remainingRequests: r.reqCount, notStarted: r.reqIdle, people: r.people, work: r.work, chain: r.chain }));
  } else if (!level.who) {
    const t = scalePeopleTable(input, level.bu, a.roster);
    out.people = t.rows.slice(0, 30).map((r) => ({
      name: r.name,
      ...(!r.member && !r.source ? { outside: true as const } : {}),
      lastDay: r.lastDay,
      idleDays: r.idleDays,
      work: r.work,
      chain: r.chain,
      per100: r.per100,
      ...(r.versus ? { versus: SCALE_VERSUS_LABEL[r.versus] } : {}),
    }));
    out.peopleAverage = { people: t.average.people, work: Math.round(t.average.work), chain: t.average.chain.map((v) => Math.round(v)) };
    out.hold = scaleHoldTable(input, level.bu)
      .rows.slice(0, 30)
      .map((r) => ({ name: r.name, all: r.all, ok: r.ok, fail: r.fail, waiting: r.wait, okPct: r.okPct, oldestDays: r.oldestDays }));
  } else if (!level.day) {
    out.channels = scaleChainTable(input, level)
      .rows.slice(0, 20)
      .map((r) => ({ label: r.label, chain: r.chain }));
  }

  if (!level.ch && !level.grp && input.staff) out.days = scaleDaySeries(input, level).map((d) => [d.day, d.value]);
  if (scaleMonths(input).length >= 2) out.months = scaleMonthTable(input, level).map((m) => ({ month: m.label, work: m.work, chain: m.chain }));

  const stages = scaleFitStages(input, level);
  if (stages)
    out.fit = {
      columns: SCALE_FIT_KEYS.map((k) => scaleBoxOf(sections, k)?.label ?? k),
      stages: stages.map((s) => ({ stage: s.label, total: s.total, cells: s.cells.map((c) => c.n) })),
      unknownWhy: (scaleFitUnknownWhy(input, level) ?? []).map((w) => ({ reason: w.label, people: w.n })),
    };

  out.next = NEXT_KEYS.map((k) => ({ label: scaleBoxOf(sections, k)?.label ?? k, n: scaleNext(input, level, k) }))
    .filter((x): x is { label: string; n: NonNullable<ReturnType<typeof scaleNext>> } => Boolean(x.n))
    .map((x) => ({ from: x.label, total: x.n.total, parts: x.n.parts.map((p) => ({ label: p.label, value: p.value, ...(top3(p.reasons) ? { reasons: top3(p.reasons) } : {}) })) }));

  const cr = scaleCancelReasons(input, level);
  if (cr) out.cancelReasons = cr.rows.map((r) => ({ reason: r.label, positions: r.n, requests: r.count }));
  if (root && input.requests) {
    const topOf = (by: 'customer' | 'position') => scaleTopRequests(input, level.bu, by).map((r) => ({ name: r.label, new: r.new, filled: r.filled, cancelled: r.cancelled, remaining: r.remaining, requests: r.count, oldestDays: r.oldest }));
    out.topCustomers = topOf('customer');
    out.topPositions = topOf('position');
  }
  const informed = scaleInformedRows(input, level);
  if (informed.length) out.informed = informed.slice(0, 20).map((r) => ({ bu: r.bu, channel: r.channel, bringer: r.bringer, createdDay: r.createdDay, informedDay: r.informedDay, days: r.days }));

  // ── กล่องที่ขอ: แยกตามชั้นถัดไป + รายใบของกล่องใบขอ ──
  const picked = a.box ? scaleBoxOf(sections, a.box) : null;
  if (a.box && !picked) errors.push(`ชั้นนี้ไม่มีกล่อง ${a.box}`);
  if (picked) {
    const bd = scaleBreakdown(input, level, picked.key);
    if (bd) {
      const state = scaleCompareOf(picked.key, ctx).state;
      const prevBd = state === 'ok' && cmpInput && bd.kind !== 'day' ? scaleBreakdown(cmpInput, cmpLevel, picked.key) : null;
      out.breakdown = {
        box: picked.label,
        by: SCALE_CHILD_TITLE[bd.kind],
        total: bd.total,
        rows: scaleBreakdownCompared(bd, prevBd, state)
          .slice(0, 40)
          .map((r) => ({ label: r.label, value: r.value, ...(r.text ? { text: r.text } : {}), ...(r.note ? { note: r.note } : {}), ...(r.before !== undefined ? { prev: r.before } : {}) })),
      };
    }
    const role = scaleReqRoleOf(picked.key);
    if (role && level.bu) {
      const open = role === 'remaining' || role === 'idle';
      const reasons = scaleStopReasons(input);
      out.requests = scaleRequestsOf(input, level, role)
        .slice(0, 30)
        .map((r) => {
          const reason = role === 'cancelled' ? scaleStopReasonOf(reasons, r) : null;
          return {
            requestNo: r.requestNo,
            jobId: r.jobId ?? null,
            position: r.position?.trim() || 'ไม่ระบุ',
            unit: r.unitName?.trim() || r.siteName?.trim() || 'ไม่ระบุ',
            amount: scaleReqAmount(r, role),
            ageDays: r.ageDays,
            ...(open ? { started: isPostingStarted(r) } : {}),
            recruiter: recruiterLabelOf(r),
            ...(reason ? { cancelReason: reason } : {}),
          };
        });
    }
  }

  // ── คุมขนาด: ใหญ่เกินเพดานผลอ่าน = ตัดก้อนรองออกทีละก้อน แล้วบอกไว้ (ไม่ตัดเงียบ) ──
  const dropped: string[] = [];
  for (const k of DROP_ORDER) {
    if (JSON.stringify(out).length <= EXEC_SUMMARY_MAX) break;
    if (out[k] === undefined) continue;
    delete out[k];
    dropped.push(k);
  }
  if (dropped.length) errors.push(`ข้อมูลเยอะเกิน ตัดก้อนนี้ออก: ${dropped.join(', ')} — ขอให้แคบลง (ส่ง bu / who / box)`);
  out.errors = errors;
  return out;
}
