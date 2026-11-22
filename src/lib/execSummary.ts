/**
 * ═══ สรุปงานสรรหาให้ผู้ช่วย AI ตอบผู้บริหาร (เจ้าของ 20 พ.ย. 2569 "ถ้าในจอตอบไม่ได้ ผู้ช่วย AI ต้องช่วยได้") ═══
 * เลขทุกตัว = ตัวคิดของแท็บ "Scale ลง" (`overviewScale.ts`) — ไฟล์นี้แค่เรียงเป็นก้อนเล็กที่อ่านง่าย ไม่เกินเพดานผลอ่านของผู้ช่วย
 * 🔴 ไม่มีนิยามใหม่ของเลขใด · ไม่มีชื่อ/เบอร์/id ผู้สมัคร (นับเป็นจำนวน) · เทียบไม่ได้ = null ไม่ใช่ 0
 * 🔴 ทุกตาราง = แถวละ 1 ก้อน หัวคอลัมน์เป็นคำเดียวกับจอ ห้ามส่งแถวเลขเรียงตำแหน่ง — ทดสอบบนเว็บจริง 22 พ.ย. 2569
 *    ผู้ช่วยหยิบเลขตัวท้ายของแถว (แจ้งเข้า 12) ไปตอบเป็น "รายชื่อเข้า" และหลุดชื่อช่องภาษาอังกฤษ ("work") ให้ผู้ใช้เห็น
 * ตรรกะล้วน ไม่มี IO — เทสต์ `execSummary.test.ts` · เส้น `/api/exec-summary`
 */
import type { StaffKindCounts, StaffRosterRow } from '@/lib/staffActivity';
import { STAFF_PERSON_KINDS, staffWorkTotal } from '@/lib/staffActivity';
import { POSTING_STATE_LABEL, isPostingStarted, postingStateOf } from '@/lib/recruitPostingState';
import { flowOf, recruiterLabelOf, type StuckRequest } from '@/lib/recruitStuck';
import { REQUEST_FUNNEL_LABEL } from '@/lib/recruitRequestTab';
import { rangeText } from '@/lib/periodPick';
import { buildRequestTimeline, type RequestTimelineJob } from '@/lib/requestTimeline';
import {
  SCALE_CHAIN,
  SCALE_CHILD_TITLE,
  SCALE_FIT_KEYS,
  SCALE_HOLD,
  SCALE_ROOT,
  SCALE_VERSUS_LABEL,
  scaleAnnounce,
  scaleBoxOf,
  scaleBreakdown,
  scaleBreakdownCompared,
  scaleBus,
  scaleBuTable,
  scaleBusOfPerson,
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
  scaleNamesByBringer,
  scaleNext,
  scalePeopleTable,
  scalePostingStates,
  scalePrevDay,
  scaleReqAmount,
  scaleReqRoleOf,
  scaleRequestsOf,
  scaleSections,
  scaleStopReasonOf,
  scaleStopReasons,
  scaleTopRequests,
  scaleTrendSince,
  type ScaleBoxKey,
  type ScaleCompareCtx,
  type ScaleHoldRow,
  type ScaleInput,
  type ScaleLevel,
  type ScalePostingRow,
  type ScaleReqRole,
  type ScaleTopRow,
} from '@/lib/overviewScale';

/** ผลอ่านของผู้ช่วยถูกตัดที่ 24,000 ตัวอักษร — สรุปต้องเล็กกว่านั้นเสมอ (เผื่อหัว HTTP) */
export const EXEC_SUMMARY_MAX = 22_000;

/** แถวของตาราง — คีย์ = หัวคอลัมน์บนจอ */
export type ExecRow = Record<string, string | number | null>;
/**
 * `prev` = ค่าช่วงก่อนของกล่องเดียวกัน · null = เทียบไม่ได้ (`prevNote` บอกเหตุถ้ารู้) · ไม่มีช่องนี้ = กล่องนี้ไม่เทียบ (สถานะ ณ ตอนนี้)
 */
export type ExecBox = { key: ScaleBoxKey; label: string; value: number | null; text?: string; sub?: string; prev?: number | null; prevNote?: string };
/**
 * `from`/`to` = ค่าที่ใช้ส่งคำสั่ง (ค.ศ.) · `text` = ช่วงของเลขในผลนี้ เขียนแบบที่จอใช้ (ปี พ.ศ.) ให้ผู้ช่วยยกไปตอบได้ทั้งคำ
 * `compareWith` = เทียบกับช่วงไหน (แบบเดียวกัน) · null = ไม่เทียบ — ผู้ช่วยเคยตอบวันที่เป็นรูป 2026-11-22 ซึ่งจอไม่ใช้ (ถามบนเว็บจริง 22 พ.ย. 2569)
 */
export type ExecWindow = { from: string; to: string; days: number; text: string; compareWith: string | null };
/** วันที่แบบที่จอใช้ ("20 พ.ย. 2569") — ตัวเดียวกับ `fullDay` ของแท็บ Scale ลง */
const thaiDay = (ymd: string | null | undefined): string | null => (ymd ? rangeText(ymd, ymd) : null);
/** ช่วงของผล: ถึงวันนี้ถ้าช่วงยังไม่จบ (เหมือนหัวจอ) · ชั้นวัน = วันนั้น */
export function execWindow(input: Pick<ScaleInput, 'from' | 'to' | 'today'>, days: number, compareWith: string | null, day: string | null = null): ExecWindow {
  const end = input.to > input.today ? input.today : input.to;
  return { from: input.from, to: input.to, days, text: day ? rangeText(day, day) : rangeText(input.from, end < input.from ? input.from : end), compareWith };
}
export type ExecSummary = {
  generatedAt: string;
  /** ช่วงที่ใช้คิด + เทียบกับอะไร (ช่วงก่อนยาวเท่ากัน / วันก่อน) */
  window: ExecWindow;
  /** ชั้นที่ดูอยู่ จากบนลงล่าง เช่น ["ทั้งหมด","LBD","เจมส์"] */
  level: string[];
  /** BU ที่มีข้อมูลในช่วง (ค่าที่ส่ง `bu` ได้) */
  bus: string[];
  sections: Array<{ title: string; equation?: string; boxes: ExecBox[] }>;
  /** ชั้นทั้งหมด = ตาราง "แยกตาม BU" · ชั้นคนที่ไม่ระบุ BU = รายชื่อที่คนนั้นหามา แยก BU (รวมกัน = กล่องรายชื่อ) */
  byBu?: ExecRow[];
  /** ชั้น BU = ตาราง "แยกตามคน" ครบสาย (รายชื่อ = ที่หาให้ BU นี้) · ชั้นทั้งหมด = ทุกคนของทุก BU แบบย่อ (BU ที่สังกัด · งานที่ทำ · รายชื่อที่หามารวมทุก BU) */
  people?: ExecRow[];
  /** แถว "เฉลี่ยต่อคน" ของตารางแยกตามคน */
  peopleAverage?: ExecRow;
  /** ตาราง "รายชื่ออยู่ที่ใคร" — ชั้นทั้งหมดมีคอลัมน์ BU · `รับมาโทร` = ยอดที่รับไปทั้งหมด ไม่ใช่ยอดค้าง */
  hold?: ExecRow[];
  /** รายชื่อค้างที่ใคร: คนที่รับไปแล้วยังไม่ลงผล (รวมกัน = กล่อง "ยังไม่ลงผล") · ว่าง = ไม่มีใครค้าง */
  waiting?: ExecRow[];
  /** รายชื่อที่คนนี้หามา แยกช่องทาง (ชั้นคน) — แถวบอกขอบเขตไว้ที่ช่อง BU (รหัส BU ในชั้น หรือ "ทุก BU") */
  channels?: ExecRow[];
  /** วันนั้นใครทำอะไร (ชั้นวัน) */
  dayPeople?: ExecRow[];
  /** งานที่ทำรายวัน { วัน: รายการ } */
  days?: Record<string, number>;
  /** เทียบเดือน (ช่วงที่ครอบหลายเดือน) */
  months?: ExecRow[];
  /** ตรงเกณฑ์ใบขอ ไล่ตามขั้น · `areaUnknownWhy` = "เทียบพื้นที่ไม่ได้" เพราะอะไร (รวมกัน = กล่องเทียบพื้นที่ไม่ได้ · ใช้กับเรื่องพื้นที่เท่านั้น) */
  fit?: { stages: ExecRow[]; areaUnknownWhy: Array<{ reason: string; people: number }> };
  /** คนในแต่ละขั้นไปไหนต่อ (ช่องรวมกัน = total) · `reasons` มีเฉพาะช่องที่เจ้าหน้าที่ลงเหตุผล — ช่องที่ไม่มี = ระบบไม่ได้เก็บเหตุผล */
  next?: Array<{ from: string; total: number; parts: Array<{ label: string; value: number; reasons?: string }> }>;
  /** ใบที่เหลือหา: ประกาศแล้ว (มีคนกรอก / ไม่มีคนกรอก) · ยังไม่ประกาศ — ประกาศ = ขึ้นหน้าประกาศ · ประกาศแล้ว + ยังไม่ประกาศ = เหลือหา (ใบ) */
  announce?: ExecRow;
  /** ใบที่เหลือหา แยกตามหลักฐานการออกหาคน (โพสต์ · ลิงก์ · Autopost) ใบละสถานะเดียว — คนละเรื่องกับ "ประกาศ" · `summary` = ยอดรวมที่บวกไว้ให้แล้ว */
  posting?: { summary: ExecRow; rows: ExecRow[] };
  cancelReasons?: ExecRow[];
  topCustomers?: ExecRow[];
  topPositions?: ExecRow[];
  /** คนที่แจ้งเข้า: กรอกใบ → แจ้งเข้า กี่วัน (ติดลบ = แจ้งเข้าก่อนกรอกใบ) */
  informed?: ExecRow[];
  /** กล่องที่ขอ (`box`) แยกตามชั้นถัดไป */
  breakdown?: { box: string; by: string; total: number | null; rows: Array<{ label: string; value: number | null; text?: string; note?: string; prev?: number | null }> };
  /** รายใบของกล่องใบขอที่ขอ (ต้องอยู่ชั้น BU ลงไป) — ดูใบเดียวต่อด้วย `request=<เลขที่ใบขอ>` */
  requests?: ExecRow[];
  /**
   * ชั้นคนที่ระบุ BU เมื่อคนนี้หารายชื่อให้หลาย BU: กล่อง/ช่องทางของชั้นนี้นับเฉพาะ BU ในชั้น (เหมือนจอ) — ก้อนนี้คือยอดรวมทุก BU
   * `byBu` รวมกัน = `รายชื่อรวมทุก BU` = `channels` รวมกัน · ดูครบสายของ BU อื่นด้วย bu=<BU>&who=<ชื่อ>
   */
  allBus?: { 'รายชื่อรวมทุก BU': number; byBu: ExecRow[]; channels: ExecRow[] };
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
const DROP_ORDER = ['days', 'informed', 'topPositions', 'topCustomers', 'next', 'fit', 'months', 'posting', 'hold', 'allBus', 'channels'] as const;
const top3 = (reasons: ReadonlyArray<{ label: string; n: number }>): string | undefined => (reasons.length ? reasons.slice(0, 3).map((r) => `${r.label} ${r.n}`).join(' · ') : undefined);

/** สายรายชื่อ 7 ขั้น มีป้ายทุกตัว (คำเดียวกับหัวคอลัมน์บนจอ) */
const chainRow = (values: readonly number[]): Record<string, number> => Object.fromEntries(SCALE_CHAIN.map((c, i) => [c.label, values[i] ?? 0]));
const workRow = (w: StaffKindCounts): Record<string, number> => Object.fromEntries(STAFF_PERSON_KINDS.map((k) => [k.label, w[k.key]]));
const HOLD_LABEL = Object.fromEntries(SCALE_HOLD.map((h) => [h.key, h.label])) as Record<string, string>;
const holdRow = (r: ScaleHoldRow, bu?: string): ExecRow => ({
  คน: r.name,
  ...(bu ? { BU: bu } : {}),
  [HOLD_LABEL.hAll]: r.all,
  [HOLD_LABEL.hOk]: r.ok,
  [HOLD_LABEL.hFail]: r.fail,
  [HOLD_LABEL.hWait]: r.wait,
  'ติดต่อได้ %': r.okPct,
  'ค้างนานสุด (วัน)': r.oldestDays,
});
const topRow = (head: string, r: ScaleTopRow): ExecRow => ({ [head]: r.label, ขอใหม่: r.new, หาได้แล้ว: r.filled, ยกเลิก: r.cancelled, 'เหลือหา (อัตรา)': r.remaining, 'เหลือหา (ใบ)': r.count, 'ค้างนานสุด (วัน)': r.oldest });
const AMOUNT_HEAD: Record<ScaleReqRole, string> = { remaining: 'เหลือหา', idle: 'เหลือหา', carry: 'ยกมา', new: 'ขอใหม่', filled: 'หาได้แล้ว', cancelled: 'ยกเลิก' };
const positionOf = (r: Pick<StuckRequest, 'position'>): string => r.position?.trim() || 'ไม่ระบุ';
const unitOf = (r: Pick<StuckRequest, 'unitName' | 'siteName'>): string => r.unitName?.trim() || r.siteName?.trim() || 'ไม่ระบุ';

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
  /** วันแรกของสิ่งที่เทียบด้วย — ก่อนวันที่ระบบเริ่มนับเลขของกล่อง = เทียบไม่ได้ */
  const cmpFrom = level.day ? prevDay : (prev?.from ?? null);
  const sections = scaleSections(input, level);
  const before = cmpInput ? scaleSections(cmpInput, cmpLevel) : null;
  const root = !level.who && !level.ch && !level.grp && !level.day;
  const bus = scaleBus(input);

  const out: ExecSummary = {
    generatedAt: a.generatedAt,
    window: execWindow(input, scaleDayCount(input), level.day ? (prevDay ? `วันก่อน ${rangeText(prevDay, prevDay)}` : null) : prev ? rangeText(prev.from, prev.to) : null, level.day),
    level: scaleCrumbs(level).map((c) => c.label),
    bus,
    sections: sections.map((s) => ({
      title: s.title,
      ...(s.equation ? { equation: s.equation } : {}),
      boxes: s.boxes.map((b): ExecBox => {
        const c = b.value == null || b.format === 'text' ? null : scaleCompareOf(b.key, ctx);
        const since = scaleTrendSince(b.key);
        return {
          key: b.key,
          label: b.label,
          value: b.format === 'text' ? null : b.value,
          ...(b.format === 'text' && b.text ? { text: b.text } : {}),
          ...(b.sub ? { sub: b.sub } : {}),
          ...(c && c.state !== 'none' ? { prev: c.state === 'ok' && before ? (scaleBoxOf(before, b.key)?.value ?? null) : null } : {}),
          ...(c?.state === 'na' && since && cmpFrom && cmpFrom < since ? { prevNote: `ระบบเริ่มนับเลขนี้ ${rangeText(since, since)} ช่วงก่อนยังไม่มีครบ` } : {}),
        };
      }),
    })),
    errors,
  };

  /** ตารางยาวเกิน = ส่งแถวบนสุด (เรียงมากสุด/ค้างนานสุดไว้แล้ว) และบอกว่ามีทั้งหมดกี่แถว — ไม่ตัดเงียบ ผู้ช่วยจะได้ไม่ตอบว่ามีแค่นี้ */
  const top = <T>(name: string, rows: readonly T[], max: number): T[] => {
    if (rows.length > max) errors.push(`${name} มี ${rows.length} แถว ส่งมา ${max} แถวแรก`);
    return rows.slice(0, max);
  };
  const holdOf = new Map<string, ScaleHoldRow[]>();
  const holdRows = (bu: string) => holdOf.get(bu) ?? (holdOf.set(bu, scaleHoldTable(input, bu).rows), holdOf.get(bu) ?? []);
  const waitRow = (r: ScaleHoldRow, bu?: string): ExecRow => ({ คน: r.name, ...(bu ? { BU: bu } : {}), [HOLD_LABEL.hWait]: r.wait, 'ค้างนานสุด (วัน)': r.oldestDays });
  if (level.day && !level.who) {
    const t = scaleDayTable(input, level);
    out.dayPeople = top('ตารางใครทำอะไร', t.rows, 30).map((r) => ({ คน: r.name, BU: r.bu, รวม: r.sum, ...workRow(r.work) }));
  } else if (level.who) {
    if (!level.day) {
      const t = scaleChainTable(input, level);
      // แถวบอกขอบเขตของตัวเอง (BU ในชั้น / ทุก BU) — ห้ามปนกันเมื่อคนเดียวหารายชื่อให้หลาย BU
      out.channels = top(t.by === 'group' ? 'ตารางกลุ่ม' : 'ตารางช่องทาง', t.rows, 20).map((r) => ({ [t.by === 'group' ? 'กลุ่ม' : 'ช่องทาง']: r.label, BU: level.bu ?? 'ทุก BU', ...chainRow(r.chain) }));
    }
    if (!level.ch && !level.grp && !level.day) {
      const spots = scaleBusOfPerson(input, level.who, a.roster);
      // ไม่ระบุ BU = ทั้งชั้นนับรวมทุก BU ของคนนั้นอยู่แล้ว — แยก BU ให้ทานกับจอได้ทีละ BU (รวมกัน = กล่องรายชื่อ)
      if (!level.bu) out.byBu = spots.map((x) => ({ BU: x.bu, สังกัด: x.member ? 'สังกัด BU นี้' : 'หารายชื่อให้ BU นี้', [SCALE_CHAIN[0].label]: x.names }));
      else if (spots.length > 1) {
        const t = scaleChainTable(input, { ...SCALE_ROOT, who: level.who });
        out.allBus = {
          'รายชื่อรวมทุก BU': t.total.chain[0],
          byBu: spots.map((x) => ({ BU: x.bu, [SCALE_CHAIN[0].label]: x.names })),
          channels: t.rows.slice(0, 20).map((r) => ({ ช่องทาง: r.label, BU: 'ทุก BU', ...chainRow(r.chain) })),
        };
      }
    }
  } else if (!level.bu) {
    out.byBu = scaleBuTable(input).rows.map((r) => ({
      BU: r.bu,
      'เหลือหา (อัตรา)': r.reqPos,
      'เหลือหา (ใบ)': r.reqCount,
      'ยังไม่เริ่มหา (ใบ)': r.reqIdle,
      'AI สนใจ ยังไม่มีใครรับ': scaleBoxOf(scaleSections(input, { ...SCALE_ROOT, bu: r.bu }), 'hFree')?.value ?? null,
      คนทำงาน: r.people,
      งานที่ทำ: r.work,
      ...chainRow(r.chain),
    }));
    // ทุกคนของทุก BU แบบย่อ — ถามถึงคนที่ชั้นทั้งหมดได้เลย (คนที่ช่วงนี้ไม่มีงานก็อยู่) · ครบสายของคนนั้นส่ง who
    const namesAll = scaleNamesByBringer(input);
    const everyone = bus
      .flatMap((bu) => scalePeopleTable(input, bu, a.roster).rows.filter((r) => r.member && !r.source).map((r) => ({ bu, r })))
      .sort((x, y) => (y.r.work ?? -1) - (x.r.work ?? -1) || y.r.chain[0] - x.r.chain[0] || x.r.name.localeCompare(y.r.name, 'th'));
    out.people = top('ตารางคน', everyone, 40).map(({ bu, r }) => ({ คน: r.name, BU: bu, ทำล่าสุด: thaiDay(r.lastDay), 'ไม่มีงานมา (วัน)': r.idleDays, งานที่ทำ: r.work, 'รายชื่อที่หามา (ทุก BU)': namesAll.get(r.name) ?? 0 }));
    const held = bus.flatMap((bu) => holdRows(bu).map((r) => ({ bu, r })));
    out.hold = top('ตารางรายชื่ออยู่ที่ใคร', [...held].sort((x, y) => y.r.all - x.r.all || x.r.name.localeCompare(y.r.name, 'th')), 30).map(({ bu, r }) => holdRow(r, bu));
    out.waiting = held
      .filter((x) => x.r.wait > 0)
      .sort((x, y) => y.r.wait - x.r.wait || (y.r.oldestDays ?? 0) - (x.r.oldestDays ?? 0) || x.r.name.localeCompare(y.r.name, 'th'))
      .map(({ bu, r }) => waitRow(r, bu));
  } else {
    const t = scalePeopleTable(input, level.bu, a.roster);
    out.people = top('ตารางแยกตามคน', t.rows, 30).map((r) => ({
      คน: r.name,
      ...(!r.member && !r.source ? { สังกัด: `นอก ${level.bu}` } : {}),
      ทำล่าสุด: thaiDay(r.lastDay),
      'ไม่มีงานมา (วัน)': r.idleDays,
      งานที่ทำ: r.work,
      ...chainRow(r.chain),
      'ทำ 100 งาน ได้กี่รายชื่อ': r.per100,
      ...(r.versus ? { เทียบกับทีม: SCALE_VERSUS_LABEL[r.versus] } : {}),
    }));
    out.peopleAverage = { คนทำงาน: t.average.people, งานที่ทำ: Math.round(t.average.work), ...chainRow(t.average.chain.map((v) => Math.round(v))) };
    out.hold = top('ตารางรายชื่ออยู่ที่ใคร', holdRows(level.bu), 30).map((r) => holdRow(r));
    out.waiting = holdRows(level.bu)
      .filter((r) => r.wait > 0)
      .sort((x, y) => y.wait - x.wait || (y.oldestDays ?? 0) - (x.oldestDays ?? 0))
      .map((r) => waitRow(r));
  }

  if (!level.ch && !level.grp && input.staff) out.days = Object.fromEntries(scaleDaySeries(input, level).map((d) => [d.day, d.value]));
  if (scaleMonths(input).length >= 2) out.months = scaleMonthTable(input, level).map((m) => ({ เดือน: m.label, งานที่ทำ: m.work, ...chainRow(m.chain) }));

  const stages = scaleFitStages(input, level);
  if (stages) {
    const fitLabel = (k: ScaleBoxKey) => scaleBoxOf(sections, k)?.label ?? k;
    out.fit = {
      stages: stages.map((s) => ({ ขั้น: s.label, ทั้งหมด: s.total, ...Object.fromEntries(SCALE_FIT_KEYS.map((k) => [fitLabel(k), s.cells.find((c) => c.key === k)?.n ?? 0])) })),
      areaUnknownWhy: (scaleFitUnknownWhy(input, level) ?? []).map((w) => ({ reason: w.label, people: w.n })),
    };
  }

  out.next = NEXT_KEYS.map((k) => ({ label: scaleBoxOf(sections, k)?.label ?? k, n: scaleNext(input, level, k) }))
    .filter((x): x is { label: string; n: NonNullable<ReturnType<typeof scaleNext>> } => Boolean(x.n))
    .map((x) => ({ from: x.label, total: x.n.total, parts: x.n.parts.map((p) => ({ label: p.label, value: p.value, ...(top3(p.reasons) ? { reasons: top3(p.reasons) } : {}) })) }));

  const announce = scaleAnnounce(input, level);
  if (announce)
    out.announce = {
      'เหลือหา (ใบ)': announce.open,
      [REQUEST_FUNNEL_LABEL.released]: announce.released,
      [REQUEST_FUNNEL_LABEL.releasedWithApps]: announce.releasedWithApps,
      [REQUEST_FUNNEL_LABEL.releasedNoApps]: announce.releasedNoApps,
      [REQUEST_FUNNEL_LABEL.notReleased]: announce.notReleased,
      'ยังไม่ประกาศ แต่มีคนกรอกแล้ว': announce.notReleasedWithApps,
    };

  const posting = level.day ? null : scalePostingStates(input, level);
  if (posting) {
    const sum = (pick: (r: ScalePostingRow) => number, started: boolean) => posting.filter((r) => r.started === started).reduce((n, r) => n + pick(r), 0);
    const started = sum((r) => r.count, true);
    const withNames = sum((r) => r.withNames, true);
    out.posting = {
      summary: {
        'เหลือหา (ใบ)': posting.reduce((n, r) => n + r.count, 0),
        'เริ่มหาแล้ว (ใบ)': started,
        'เริ่มหาแล้ว มีรายชื่อแล้ว (ใบ)': withNames,
        'เริ่มหาแล้ว ยังไม่มีรายชื่อ (ใบ)': started - withNames,
        'ยังไม่เริ่มหา (ใบ)': sum((r) => r.count, false),
      },
      rows: posting.map((r) => ({ หลักฐานการออกหาคน: r.label, เริ่มหา: r.started ? 'เริ่มแล้ว' : 'ยังไม่เริ่มหา', ใบ: r.count, อัตรา: r.positions, 'มีรายชื่อแล้ว (ใบ)': r.withNames })),
    };
  }

  const cr = scaleCancelReasons(input, level);
  if (cr) out.cancelReasons = cr.rows.map((r) => ({ ยกเลิกเพราะ: r.label, อัตรา: r.n, ใบ: r.count }));
  if (root && input.requests) {
    out.topCustomers = scaleTopRequests(input, level.bu, 'customer').map((r) => topRow('ลูกค้า', r));
    out.topPositions = scaleTopRequests(input, level.bu, 'position').map((r) => topRow('ตำแหน่ง', r));
  }
  const informed = scaleInformedRows(input, level);
  if (informed.length) out.informed = top('ตารางแจ้งเข้า', informed, 20).map((r) => ({ BU: r.bu, ช่องทาง: r.channel, ใครหามา: r.bringer, กรอกใบ: thaiDay(r.createdDay), แจ้งเข้า: thaiDay(r.informedDay), ใช้กี่วัน: r.days }));

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
        rows: top(`${picked.label} ${SCALE_CHILD_TITLE[bd.kind]}`, scaleBreakdownCompared(bd, prevBd, state), 40).map((r) => ({ label: r.label, value: r.value, ...(r.text ? { text: r.text } : {}), ...(r.note ? { note: r.note } : {}), ...(r.before !== undefined ? { prev: r.before } : {}) })),
      };
    }
    const role = scaleReqRoleOf(picked.key);
    if (role && level.bu) {
      const open = role === 'remaining' || role === 'idle';
      const reasons = scaleStopReasons(input);
      out.requests = top(`รายใบ (${open ? 'ค้างนานสุดก่อน' : 'อัตรามากสุดก่อน'})`, scaleRequestsOf(input, level, role), 25).map((r) => {
          const reason = role === 'cancelled' ? scaleStopReasonOf(reasons, r) : null;
          return {
            เลขที่ใบขอ: r.requestNo,
            ตำแหน่ง: positionOf(r),
            หน่วยงาน: unitOf(r),
            [`${AMOUNT_HEAD[role]} (อัตรา)`]: scaleReqAmount(r, role),
            'ค้าง (วัน)': r.ageDays,
            ...(open ? { เริ่มหา: isPostingStarted(r) ? 'เริ่มแล้ว' : 'ยังไม่เริ่มหา' } : {}),
            เจ้าหน้าที่สรรหา: recruiterLabelOf(r),
            ...(reason ? { ยกเลิกเพราะ: reason } : {}),
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
  // ยังใหญ่เกิน (ชื่อยาวผิดปกติ) = ตัดท้ายตารางที่เหลือทีละครึ่ง แล้วบอกจำนวนแถวที่เหลือ
  const tables = (): Array<[string, unknown[]]> => [['breakdown', out.breakdown?.rows ?? []], ['people', out.people ?? []], ['requests', out.requests ?? []], ['dayPeople', out.dayPeople ?? []], ['byBu', out.byBu ?? []]];
  const cut = new Set<string>();
  for (let round = 0; round < 8 && JSON.stringify(out).length > EXEC_SUMMARY_MAX - 400; round++)
    for (const [name, rows] of tables()) {
      if (rows.length <= 5) continue;
      rows.length = Math.ceil(rows.length / 2);
      cut.add(name);
    }
  if (cut.size) errors.push(`ตารางยาวเกิน ตัดท้ายออก: ${tables().filter(([name]) => cut.has(name)).map(([name, rows]) => `${name} เหลือ ${rows.length} แถวแรก`).join(', ')}`);
  out.errors = errors;
  return out;
}

/* ═══ ใบขอใบเดียว ทำอะไรไปแล้ว — ก้อนเดียวกับจอ "<เลขที่ใบขอ> ทำอะไรไปแล้ว" ของแท็บ Scale ลง ═══
 * ผู้ช่วยถูกถาม "ใบ OPL… ที่ยกเลิกไป ทีมทำอะไรไปแล้ว" แล้วหาใบไม่เจอ เพราะมีแค่เลขที่ใบขอ ไม่มี id ใบ (ทดสอบบนเว็บจริง 22 พ.ย. 2569) */
export type ExecRequest = {
  เลขที่ใบขอ: string;
  BU?: string | null;
  ตำแหน่ง?: string;
  หน่วยงาน?: string;
  เจ้าหน้าที่สรรหา?: string;
  'ค้าง (วัน)'?: number | null;
  หลักฐานการออกหาคน?: string;
  ยกเลิกเพราะ?: string;
  /** อัตราของใบตามช่วงที่เลือก: ยกมา + ขอใหม่ − หาได้แล้ว − ยกเลิก = เหลือหา · ไม่มี = ใบไม่อยู่ในใบขอของช่วง */
  'ใบขอ (อัตรา ตามช่วง)'?: Record<string, number>;
  /** นับทุกช่วงเวลาของใบ · null = อ่านงานของใบนี้ไม่ได้ */
  'งานที่ทำ ตั้งแต่ขอ': Record<string, number> | null;
  'รายชื่อ ตั้งแต่ขอ': Record<string, number> | null;
  /** ไล่ตามวัน เก่า → ใหม่ */
  timeline: ExecRow[];
};
export type ExecRequestSummary = { generatedAt: string; window: ExecWindow; request: ExecRequest | null; errors: string[] };
/** แถวเหตุการณ์สูงสุดที่ส่ง (เกิน = ตัดแถวเก่าสุดออก แล้วบอกไว้ · หลักของใบ — ขอมา · ประกาศ · หาได้แล้ว · ยกเลิก — อยู่เสมอ) */
export const EXEC_REQUEST_ROWS = 120;

export function buildExecRequest(a: {
  requestNo: string;
  /** ใบจากใบขอของช่วง (มียอดอัตรา) — null = ใบไม่อยู่ในช่วง มีแต่งานที่ทำ */
  request: StuckRequest | null;
  /** ผลของ `/api/request-timeline` ของใบนี้ — null = อ่านไม่ได้ */
  job: RequestTimelineJob | null;
  cancelReason: string | null;
  /** ชื่อที่โชว์ของคนประกาศ (`scaleStaffNamer`) */
  nameOf: (raw: string | null | undefined) => string | null;
  window: ExecWindow;
  generatedAt: string;
  errors: readonly string[];
}): ExecRequestSummary {
  const r = a.request;
  const errors = [...a.errors];
  if (!a.job) errors.push('อ่านงานที่ทำกับใบนี้ไม่ได้ — มีแต่ยอดอัตราของใบ');
  const all = buildRequestTimeline(
    r ? { ...r, releasedBy: a.nameOf(r.releasedBy) } : { requested: 0, releasedAt: null, releasedBy: null },
    a.job?.events ?? [],
    a.cancelReason,
  );
  const flow = r ? flowOf(r) : null;
  const build = (rows: typeof all): ExecRequestSummary => ({
    generatedAt: a.generatedAt,
    window: a.window,
    request: {
      เลขที่ใบขอ: r?.requestNo ?? a.requestNo,
      ...(r
        ? {
            BU: r.bu ?? null,
            ตำแหน่ง: positionOf(r),
            หน่วยงาน: unitOf(r),
            เจ้าหน้าที่สรรหา: recruiterLabelOf(r),
            'ค้าง (วัน)': r.ageDays,
            หลักฐานการออกหาคน: POSTING_STATE_LABEL[postingStateOf(r)],
          }
        : {}),
      ...(a.cancelReason ? { ยกเลิกเพราะ: a.cancelReason } : {}),
      ...(flow ? { 'ใบขอ (อัตรา ตามช่วง)': { ยกมา: flow.carryIn, ขอใหม่: flow.new, หาได้แล้ว: flow.filled, ยกเลิก: flow.cancelled, เหลือหา: flow.remaining } } : {}),
      'งานที่ทำ ตั้งแต่ขอ': a.job ? { รวม: staffWorkTotal(a.job.done.work), ...workRow(a.job.done.work) } : null,
      'รายชื่อ ตั้งแต่ขอ': a.job ? chainRow(a.job.done.chain) : null,
      timeline: rows.map((e) => ({
        วันที่: thaiDay(e.day),
        ทำอะไร: e.label,
        ...(e.n == null ? {} : { จำนวน: `${e.n} ${e.unit}` }),
        ...(e.who ? { ใคร: e.who } : {}),
        ...(e.detail ? { รายละเอียด: e.detail } : {}),
      })),
    },
    errors,
  });
  // ── คุมขนาด: เก็บเหตุการณ์ล่าสุด `keep` แถว (+ หลักของใบทุกแถว) · ยังใหญ่เกิน = ลดลงทีละครึ่ง แล้วบอกไว้ ──
  const events = all.filter((e) => !e.mark);
  const kept = (keep: number) => {
    const drop = new Set(events.slice(0, Math.max(0, events.length - keep)).map((e) => e.key));
    return all.filter((e) => !drop.has(e.key));
  };
  let keep = EXEC_REQUEST_ROWS;
  let rows = kept(keep);
  while (keep > 0 && JSON.stringify(build(rows)).length > EXEC_SUMMARY_MAX) {
    keep = Math.floor(keep / 2);
    rows = kept(keep);
  }
  if (rows.length < all.length) errors.push(`ไทม์ไลน์มี ${all.length} แถว ส่งมา ${rows.length} แถว (ตัดแถวเก่าสุดออก ${all.length - rows.length} แถว) — ยอดรวมของงานที่ทำ/รายชื่อยังครบ`);
  return build(rows);
}
