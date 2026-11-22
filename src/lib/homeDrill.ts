/**
 * ═══ กดกล่องหน้าหลัก → ไล่ 12 เดือน → รายวัน → BU → เหตุผล (เจ้าของ 22 พ.ย. 2569) ═══
 * > "เวลากดไปที่กล่องอย่าพึ่งโชว์ข้อมูลแต่แยกเป็นเดือนก่อนว่าแต่ละเดือนยอดเท่าไหร่ พอกดเดือนไหนก็แยกเป็นวัน
 * >  ที่ในแท่ง 100% บอกว่า Bu ละกี่ % ทุกกล่องกดแล้วต้องเห็นหมด แล้วกด Bu ไหนก็เห็นว่าเหตุผลยังไง
 * >  อ้อต้องบอกยอดรวมแล้วบอก % ด้วยนะ" · Choice "12 เดือนล่าสุด"
 *
 * เซิร์ฟเวอร์ (`/api/home-drill`) จัดใบสมัคร 12 เดือนเข้าช่องของทุกกล่องด้วยตัวตัดสินเดียวกับเลขบนกล่อง
 * (`buildApplicantFunnel` · `prescreenItemOf` · `afterPrescreenItemOf` · `appointmentItemOf` · `entryKindOf`)
 * แล้วส่งมาเป็นรหัสต่อใบ (เล็ก) — หน้าเว็บนับเป็นเดือน/วัน/BU/เหตุผลเองด้วยฟังก์ชันในไฟล์นี้
 * วันที่ของใบ = วันที่กรอก (วันไทย) — แบบเดียวกับช่วงวันที่ของหน้าหลัก ⇒ เดือนนี้ในแผง = เลขบนกล่องตอนเลือก "เดือนนี้"
 * ไฟล์นี้ pure — เทสต์ `tests/api/homeDrill2569-11-22.test.ts`
 */
import type { ToneKey } from './designTokens';
import type { RecruitAppFact } from './recruitOverviewTypes';
import { appliedYmd } from './recruitOverview';
import { buildApplicantFunnel } from './homeOverviewFunnel';
import { afterPrescreenItemOf, appointmentItemOf, prescreenItemOf, type ProportionAppFlag, type ProportionItem } from './homeProportion';
import { ENTRY_KINDS, ENTRY_KIND_META, entryKindOf, type EntryRow } from './homeEntryKind';

export const DRILL_MONTHS = 12;

/** กล่องที่กดแล้วไล่เดือนได้ — ขั้นผู้สมัคร 6 ขั้น (แท็บภาพรวม · การ์ดผู้สมัคร = applied) + แถวสรรหา/ทางเข้า (แท็บสัดส่วน) */
export const DRILL_BOX_KEYS = ['applied', 'ai', 'interested', 'staff', 'reached', 'booked', 'prescreen', 'afterPrescreen', 'appointment', 'entry'] as const;
export type DrillBoxKey = (typeof DRILL_BOX_KEYS)[number];
export const isDrillBoxKey = (v: unknown): v is DrillBoxKey => typeof v === 'string' && (DRILL_BOX_KEYS as readonly string[]).includes(v);

export type DrillReason = { key: string; label: string; tone: ToneKey; group?: string };
export type DrillBox = { key: DrillBoxKey; title: string; unit: string; reasons: DrillReason[] };

export type DrillPayload = {
  version: 1;
  /** วันแรก (วันที่ 1 ของเดือนแรก) และวันสุดท้าย (วันนี้) — วันไทย */
  from: string;
  to: string;
  /** รหัส BU ตามดัชนีใน items · '' = ไม่ระบุ BU */
  bus: string[];
  boxes: DrillBox[];
  /** ต่อใบ: [วันที่นับจาก from, ดัชนี BU, ดัชนีเหตุผลของกล่องตามลำดับ boxes … (-1 = ใบนี้ไม่อยู่ในกล่องนั้น)] */
  items: number[][];
  /** id ของใบตามลำดับ items — เปิดรายชื่อ */
  ids: string[];
};

const DAY_MS = 86_400_000;
const dayNo = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY_MS);
export const ymdOfDay = (from: string, offset: number) => new Date((dayNo(from) + offset) * DAY_MS).toISOString().slice(0, 10);

/** วันแรกของช่วง 12 เดือน (วันที่ 1 ของเดือนที่ย้อนไป 11 เดือน) */
export function drillFrom(today: string, months = DRILL_MONTHS): string {
  const [y, m] = today.split('-').map(Number);
  const total = y * 12 + (m - 1) - (months - 1);
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}-01`;
}

/** เดือนทั้งหมดในช่วง (เก่า → ใหม่) — ว่างก็อยู่ */
export function drillMonthList(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const end = to.slice(0, 7);
  for (let i = 0; i < 36; i++) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    out.push(key);
    if (key >= end) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

// ─── ฝั่งเซิร์ฟเวอร์: จัดใบเข้าช่อง ──────────────────────────────────────────

const UNIT: Record<DrillBoxKey, string> = {
  applied: 'รายชื่อ',
  ai: 'รายชื่อ',
  interested: 'รายชื่อ',
  staff: 'รายชื่อ',
  reached: 'รายชื่อ',
  booked: 'รายชื่อ',
  prescreen: 'ใบ',
  afterPrescreen: 'คน',
  appointment: 'คน',
  entry: 'ใบ',
};
const PROPORTION_TITLE: Record<'prescreen' | 'afterPrescreen' | 'appointment' | 'entry', string> = {
  prescreen: 'โทร Prescreen',
  afterPrescreen: 'โทรหลัง Prescreen',
  appointment: 'นัดได้ (จากที่สนใจแล้วติดต่อได้)',
  entry: 'ผู้สมัครเข้าระบบ',
};

/** เหตุผลของกล่องแถวสัดส่วน — เรียงตามที่เจอครั้งแรกในลำดับขั้น แล้วตัวที่ไม่มีลำดับตายตัว (เหตุที่ไม่โทร) เรียงตามจำนวน */
function reasonIndexer() {
  const list: DrillReason[] = [];
  const index = new Map<string, number>();
  return {
    list,
    of(it: ProportionItem): number {
      const id = `${it.step}:${it.key}`;
      let i = index.get(id);
      if (i === undefined) {
        i = list.length;
        index.set(id, i);
        list.push({ key: id, label: it.label, tone: it.tone, group: it.stepTitle });
      }
      return i;
    },
  };
}

export type DrillSource = {
  fact: RecruitAppFact;
  flag?: ProportionAppFlag;
  entry: EntryRow;
};

/**
 * ใบสมัครของช่วง 12 เดือน → payload · `openJobIds` = ใบขอที่เปิดอยู่ (null = อ่านไม่ได้) · `nowMs` = เวลาตอนนี้ (นัดเลยวัน)
 * ใบที่ไม่มี id หรืออ่านวันที่ไม่ได้ ไม่นับ (แบบเดียวกับรายชื่อของหน้าหลัก)
 */
export function buildDrillPayload(sources: readonly DrillSource[], from: string, to: string, openJobIds: ReadonlySet<string> | null, nowMs: number): DrillPayload {
  const inRange = sources.filter((s) => {
    const d = appliedYmd(s.fact);
    return Boolean(s.fact.id) && d !== null && d >= from && d <= to;
  });
  const facts = inRange.map((s) => s.fact);
  const funnel = buildApplicantFunnel(facts);
  const funnelRowOf = new Map<string, Map<string, number>>();
  const boxes: DrillBox[] = [];
  for (const step of funnel) {
    const byId = new Map<string, number>();
    step.rows.forEach((row, i) => row.ids.forEach((id) => byId.set(id, i)));
    funnelRowOf.set(step.key, byId);
    boxes.push({ key: step.key as DrillBoxKey, title: step.label, unit: UNIT[step.key as DrillBoxKey] ?? 'รายชื่อ', reasons: step.rows.map((r) => ({ key: r.key, label: r.label, tone: r.tone as ToneKey })) });
  }
  const pre = reasonIndexer();
  const after = reasonIndexer();
  const appt = reasonIndexer();
  const bus: string[] = [];
  const buIndex = new Map<string, number>();
  const items: number[][] = [];
  const ids: string[] = [];
  const base = dayNo(from);
  for (const s of inRange) {
    const f = s.fact;
    const id = f.id as string;
    const bu = (f.bu ?? '').trim().toUpperCase();
    let b = buIndex.get(bu);
    if (b === undefined) {
      b = bus.length;
      buIndex.set(bu, b);
      bus.push(bu);
    }
    const row = [dayNo(appliedYmd(f) as string) - base, b];
    for (const step of funnel) row.push(funnelRowOf.get(step.key)?.get(id) ?? -1);
    row.push(pre.of(prescreenItemOf(f, s.flag, openJobIds)));
    const a = afterPrescreenItemOf(f, s.flag);
    row.push(a ? after.of(a) : -1);
    const p = appointmentItemOf(f, nowMs);
    row.push(p ? appt.of(p) : -1);
    row.push(ENTRY_KINDS.indexOf(entryKindOf(s.entry)));
    items.push(row);
    ids.push(id);
  }
  boxes.push({ key: 'prescreen', title: PROPORTION_TITLE.prescreen, unit: UNIT.prescreen, reasons: pre.list });
  boxes.push({ key: 'afterPrescreen', title: PROPORTION_TITLE.afterPrescreen, unit: UNIT.afterPrescreen, reasons: after.list });
  boxes.push({ key: 'appointment', title: PROPORTION_TITLE.appointment, unit: UNIT.appointment, reasons: appt.list });
  boxes.push({
    key: 'entry',
    title: PROPORTION_TITLE.entry,
    unit: UNIT.entry,
    reasons: ENTRY_KINDS.map((k) => ({ key: k, label: ENTRY_KIND_META[k].label, tone: ENTRY_KIND_META[k].tone, group: k.startsWith('staff') ? 'คนพาเข้า' : 'ระบบพาเข้า' })),
  });
  return { version: 1, from, to, bus, boxes, items, ids };
}

// ─── ฝั่งหน้าเว็บ: นับเป็นเดือน / วัน / BU / เหตุผล ──────────────────────────────

export type DrillScope = { month?: string | null; day?: string | null; bu?: string | null };

export type DrillBar = { key: string; label: string; total: number; byBu: Array<{ bu: string; n: number }> };
export type DrillBuShare = { bu: string; n: number; pct: number };
export type DrillReasonRow = DrillReason & { n: number; pct: number };

const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const monthLabel = (month: string, withYear = false) => {
  const [y, m] = month.split('-').map(Number);
  return withYear ? `${THAI_MONTH_SHORT[m - 1]} ${y + 543}` : THAI_MONTH_SHORT[m - 1];
};

/** % ปัดเป็นจำนวนเต็ม · ทั้งหมด 0 = 0 */
export const pctOf = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

function boxIndexOf(p: DrillPayload, box: DrillBoxKey): number {
  return p.boxes.findIndex((b) => b.key === box);
}

/** ใบที่อยู่ในกล่องนี้และในขอบเขตนี้ */
function scopedItems(p: DrillPayload, box: DrillBoxKey, scope: DrillScope): number[][] {
  const bi = boxIndexOf(p, box);
  if (bi < 0) return [];
  const col = 2 + bi;
  const buIdx = scope.bu === undefined || scope.bu === null ? -2 : p.bus.indexOf(scope.bu);
  return p.items.filter((it) => {
    if (it[col] < 0) return false;
    if (buIdx !== -2 && it[1] !== buIdx) return false;
    if (scope.month || scope.day) {
      const d = ymdOfDay(p.from, it[0]);
      if (scope.day && d !== scope.day) return false;
      if (scope.month && d.slice(0, 7) !== scope.month) return false;
    }
    return true;
  });
}

const sortBu = (a: { bu: string; n: number }, b: { bu: string; n: number }) => b.n - a.n || (a.bu === '' ? 1 : b.bu === '' ? -1 : a.bu.localeCompare(b.bu));

function barOf(key: string, label: string, list: number[][], p: DrillPayload): DrillBar {
  const counts = new Map<number, number>();
  for (const it of list) counts.set(it[1], (counts.get(it[1]) ?? 0) + 1);
  return { key, label, total: list.length, byBu: [...counts.entries()].map(([b, n]) => ({ bu: p.bus[b] ?? '', n })).sort(sortBu) };
}

/** 12 แท่งรายเดือน (เดือนที่ว่างก็อยู่ = 0) */
export function drillMonthBars(p: DrillPayload, box: DrillBoxKey): DrillBar[] {
  const all = scopedItems(p, box, {});
  const byMonth = new Map<string, number[][]>();
  for (const it of all) {
    const m = ymdOfDay(p.from, it[0]).slice(0, 7);
    const list = byMonth.get(m) ?? [];
    list.push(it);
    byMonth.set(m, list);
  }
  return drillMonthList(p.from, p.to).map((m) => barOf(m, monthLabel(m), byMonth.get(m) ?? [], p));
}

/** แท่งรายวันของเดือนนั้น (ทุกวันของเดือน ถึงวันนี้) */
export function drillDayBars(p: DrillPayload, box: DrillBoxKey, month: string): DrillBar[] {
  const all = scopedItems(p, box, { month });
  const byDay = new Map<string, number[][]>();
  for (const it of all) {
    const d = ymdOfDay(p.from, it[0]);
    const list = byDay.get(d) ?? [];
    list.push(it);
    byDay.set(d, list);
  }
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: DrillBar[] = [];
  for (let d = 1; d <= last; d++) {
    const ymd = `${month}-${String(d).padStart(2, '0')}`;
    if (ymd > p.to) break;
    out.push(barOf(ymd, String(d), byDay.get(ymd) ?? [], p));
  }
  return out;
}

/** BU ละเท่าไหร่ กี่ % ของขอบเขตนี้ (มาก → น้อย) */
export function drillBuShares(p: DrillPayload, box: DrillBoxKey, scope: DrillScope): { total: number; rows: DrillBuShare[] } {
  const list = scopedItems(p, box, { ...scope, bu: null });
  const bar = barOf('', '', list, p);
  return { total: bar.total, rows: bar.byBu.map((r) => ({ ...r, pct: pctOf(r.n, bar.total) })) };
}

/** เหตุผลของขอบเขตนี้ (BU เดียวหรือทุก BU) — ครบทุกเหตุของกล่อง ว่าง = 0 · % ของยอดในขอบเขต */
export function drillReasonRows(p: DrillPayload, box: DrillBoxKey, scope: DrillScope): { total: number; rows: DrillReasonRow[] } {
  const bi = boxIndexOf(p, box);
  if (bi < 0) return { total: 0, rows: [] };
  const list = scopedItems(p, box, scope);
  const counts = new Map<number, number>();
  for (const it of list) counts.set(it[2 + bi], (counts.get(it[2 + bi]) ?? 0) + 1);
  return { total: list.length, rows: p.boxes[bi].reasons.map((r, i) => ({ ...r, n: counts.get(i) ?? 0, pct: pctOf(counts.get(i) ?? 0, list.length) })) };
}

/** id ของใบในขอบเขตนี้ (+ เหตุผลเดียว) — เปิดรายชื่อ */
export function drillIds(p: DrillPayload, box: DrillBoxKey, scope: DrillScope, reasonKey?: string | null): string[] {
  const bi = boxIndexOf(p, box);
  if (bi < 0) return [];
  const want = reasonKey ? p.boxes[bi].reasons.findIndex((r) => r.key === reasonKey) : -1;
  const set = new Set(scopedItems(p, box, scope));
  const out: string[] = [];
  p.items.forEach((it, i) => {
    if (set.has(it) && (want < 0 || it[2 + bi] === want)) out.push(p.ids[i]);
  });
  return out;
}
