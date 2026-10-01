/**
 * ═══ ตัวคิดของหน้า "ภาพรวมงานสรรหา" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569) ═══
 *
 * เจ้าของ: *"นับแบบ 1 [AI + คน] แต่บอกว่า มีกี่ใบที่ประกาศไป แล้วมีรายชื่อมาเท่าไหร่ Ai โทรไปให้ทั้งหมดเท่าไหร่
 * เหลือสนใจแล้วคนมาโทรอีกเท่าไหร่ อะไรประมาณนี้แต่คิดเพิ่มให้ครอบคลุม ต้องบอกด้วยว่า กรอกมาวันนี้โดนโทรวันไหน
 * จะนับเป็นวันต้องครบ 24 ชม นะถึงจะนับเป็น 1 วัน"*
 *
 * 🔴 กติกา (ไฟล์นี้ pure · หน้าจอวาดอย่างเดียว ห้ามนับเอง):
 * - ทุกตัวเลขของเดือน = **รายชื่อที่กรอกเข้ามาในเดือนนั้น** (วันไทย) แล้วดูว่าตอนนี้ไปถึงขั้นไหน — ยกเว้น
 *   "งานค้างตอนนี้" (สถานะวันนี้) · "ผลงานรายคน" (งานที่ลงผลในเดือน) · "ใบที่ประกาศ" ไม่ได้คิดที่นี่
 *   (เลขเดียวกับหัวกล่องงาน — กล่องงานส่งมา `BoardPublishedTotals` · เจ้าของสั่ง 1 ต.ค. 2569)
 * - หน่วย = รายชื่อ (ใบสมัครที่ไม่ใช่ Lead — ตัวเดียวกับหน้าหลัก "ระบบไปกี่ %")
 * - **วัน = ครบ 24 ชม.** (`fullDaysBetween`) — กรอก 21:00 โทร 08:00 วันถัดไป = ภายใน 24 ชม. ไม่ใช่ "1 วัน"
 * - โทรแล้ว/ติดต่อสำเร็จ นับ AI + คน · แยกบรรทัดล่างว่า AI กี่รายชื่อ คนกี่รายชื่อ (Choice "นับแบบ 1")
 * - ตอบ AI ว่าสนใจ = คำตอบล่าสุดที่ให้ AI อยู่ถัง "ตอบว่าสนใจ" (ตัวเดียวกับคอลัมน์ "คำตอบกับ AI" ของแท็บผู้สมัคร)
 * - คนโทรต่อแล้ว = ตอบ AI ว่าสนใจ แล้วเจ้าหน้าที่ลงผลโทร/บันทึกผลติดต่อ **หลัง** เวลาที่ AI ได้คำตอบ
 * - อ่านไม่ได้ = null (จอขึ้น "—") ห้ามแทนด้วย 0
 */
import type { CallMicroOutcome } from '@/lib/callMicroOutcome';
import { callResultLabel } from '@/lib/homeCallResults';
import { REFERRAL_SOURCE_LABEL, type ApplicationReferralSource } from '@/lib/publicApplicationsApi';
import { bangkokYmd } from '@/lib/trends/timeBuckets';
import { DAY_MS, fullDaysBetween } from '@/lib/fullDays';
import type {
  RecruitAiRow,
  RecruitAppFact,
  RecruitStaffRow,
} from '@/lib/recruitOverviewTypes';

/** วันเต็ม **ครบ 24 ชม. ถึงนับเป็น 1 วัน** — ตัวเดียวกับ "สมัครมาแล้ว" บนตารางผู้สมัคร (`fullDays.ts`) */
export { DAY_MS, fullDaysBetween } from '@/lib/fullDays';

export const appliedYmd = (f: Pick<RecruitAppFact, 'createdAt'>) => bangkokYmd(f.createdAt);

/** รายชื่อที่กรอกเข้ามาในช่วง [from, to] (วันไทย รวมหัวท้าย) */
export function cohortOf(apps: readonly RecruitAppFact[], from: string, to: string): RecruitAppFact[] {
  return apps.filter((f) => {
    const d = appliedYmd(f);
    return d !== null && d >= from && d <= to;
  });
}

export const isCalled = (f: RecruitAppFact) => f.calledByAi || f.calledByStaff;
export const isAiSaidYes = (f: RecruitAppFact) => f.aiAnswer === 'said_yes';
/** ตอบ AI ว่าสนใจ แล้วเจ้าหน้าที่ลงมือหลังเวลาที่ AI ได้คำตอบ */
export const isStaffFollowed = (f: RecruitAppFact) =>
  isAiSaidYes(f) && !!f.staffLastAt && !!f.aiAnswerAt && f.staffLastAt >= f.aiAnswerAt;

/** ช่องทาง — ตารางช่องทางของลิงก์ก่อน แล้วค่อยที่ผู้สมัครเลือกเอง (ตัวเดียวกับหัวข้อกรอง "ช่องทาง") */
export function channelOf(f: Pick<RecruitAppFact, 'channelLabel' | 'referralSource'>): string {
  const label = f.channelLabel?.trim();
  if (label) return label;
  const src = f.referralSource as ApplicationReferralSource | null;
  return (src && REFERRAL_SOURCE_LABEL[src]) || 'ไม่ระบุ';
}

export const positionOf = (f: Pick<RecruitAppFact, 'position'>) => f.position?.trim() || 'ไม่ระบุ';

export type RecruitTotals = {
  names: number;
  /** ใบขอที่มีรายชื่อเข้ามา (ไม่นับใบสมัครที่ไม่ผูกใบขอ) */
  jobs: number;
  called: number;
  calledByAi: number;
  calledByStaff: number;
  reached: number;
  reachedByAi: number;
  reachedByStaff: number;
  aiSaidYes: number;
  staffFollowed: number;
  appointed: number;
  showed: number;
  /** null = อ่านบอร์ด ERP ไม่ได้ */
  onBoard: number | null;
};

export function totalsOf(apps: readonly RecruitAppFact[], from: string, to: string): RecruitTotals {
  const c = cohortOf(apps, from, to);
  const count = (p: (f: RecruitAppFact) => boolean) => c.filter(p).length;
  return {
    names: c.length,
    jobs: new Set(c.map((f) => f.jobId).filter((j): j is string => !!j)).size,
    called: count(isCalled),
    calledByAi: count((f) => f.calledByAi),
    calledByStaff: count((f) => f.calledByStaff),
    reached: count((f) => f.contact === 'success'),
    reachedByAi: count((f) => f.contact === 'success' && f.contactBy === 'ai'),
    reachedByStaff: count((f) => f.contact === 'success' && f.contactBy === 'staff'),
    aiSaidYes: count(isAiSaidYes),
    staffFollowed: count(isStaffFollowed),
    appointed: count((f) => !!f.appointmentAt),
    showed: count((f) => f.attendance === 'showed'),
    onBoard: c.some((f) => f.onBoard === null) ? null : count((f) => f.onBoard === true),
  };
}

/** % แบบปัดทศนิยมหนึ่งตำแหน่ง · ตัวหาร 0 = null (ห้ามโชว์ 0%) */
export function pctOf(n: number | null, of: number | null): number | null {
  if (n === null || of === null || of <= 0) return null;
  return Math.round((n / of) * 1000) / 10;
}

/* ─────────── เส้นทางของรายชื่อ ─────────── */

export type FunnelKey = 'names' | 'calledByAi' | 'aiSaidYes' | 'staffFollowed' | 'appointed' | 'showed' | 'onBoard';

export type FunnelStep = {
  key: FunnelKey;
  label: string;
  /** null = ยังบอกไม่ได้ (ยังไม่เคยมีใครบันทึก / อ่านไม่ได้) */
  value: number | null;
  /** % ของรายชื่อที่เข้ามา */
  pct: number | null;
  note?: string;
};

/** ลำดับตามที่เจ้าของไล่: รายชื่อ → AI โทร → สนใจ → คนโทรต่อ → (คิดเพิ่ม) นัด → มาตามนัด → ได้ใบสมัคร */
export function funnelSteps(t: RecruitTotals, opts: { attendanceEverRecorded: boolean }): FunnelStep[] {
  const step = (key: FunnelKey, label: string, value: number | null, note?: string): FunnelStep => ({
    key,
    label,
    value,
    pct: key === 'names' ? (t.names > 0 ? 100 : null) : pctOf(value, t.names),
    ...(note ? { note } : {}),
  });
  return [
    step('names', 'รายชื่อเข้ามา', t.names),
    step('calledByAi', 'AI โทรแล้ว', t.calledByAi),
    step('aiSaidYes', 'ตอบ AI ว่าสนใจ', t.aiSaidYes),
    step('staffFollowed', 'คนโทรต่อแล้ว', t.staffFollowed),
    step('appointed', 'นัดได้', t.appointed),
    opts.attendanceEverRecorded
      ? step('showed', 'มาตามนัด', t.showed)
      : step('showed', 'มาตามนัด', null, 'ยังไม่มีใครบันทึกมา/ไม่มา'),
    t.onBoard === null
      ? step('onBoard', 'ได้ใบสมัคร', null, 'อ่านบอร์ด ERP ไม่ได้')
      : step('onBoard', 'ได้ใบสมัคร', t.onBoard),
  ];
}

/* ─────────── กรอกแล้วโทรวันไหน (ครบ 24 ชม. = 1 วัน) ─────────── */

export type DelayKey = 'd0' | 'd1' | 'd2' | 'd3' | 'd4_7' | 'over7' | 'none';

export const DELAY_ORDER: readonly DelayKey[] = ['d0', 'd1', 'd2', 'd3', 'd4_7', 'over7', 'none'];

export const DELAY_LABEL: Record<DelayKey, string> = {
  d0: 'ภายใน 24 ชม.',
  d1: '1 วัน',
  d2: '2 วัน',
  d3: '3 วัน',
  d4_7: '4–7 วัน',
  over7: 'เกิน 7 วัน',
  none: 'ยังไม่ได้โทร',
};

/** กรอกแล้วได้ผลโทรครั้งแรก (ใครโทรก็ได้) หลังกี่วันเต็ม */
export function delayOf(f: Pick<RecruitAppFact, 'createdAt' | 'firstCalledAt'>): DelayKey {
  const d = fullDaysBetween(f.createdAt, f.firstCalledAt);
  if (d === null) return 'none';
  if (d <= 3) return (['d0', 'd1', 'd2', 'd3'] as const)[d];
  return d <= 7 ? 'd4_7' : 'over7';
}

export type DelayRow = { key: DelayKey; label: string; count: number; pct: number | null };

export function delayRows(cohort: readonly RecruitAppFact[]): DelayRow[] {
  const counts = new Map<DelayKey, number>(DELAY_ORDER.map((k) => [k, 0]));
  for (const f of cohort) {
    const k = delayOf(f);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return DELAY_ORDER.map((key) => {
    const count = counts.get(key) ?? 0;
    return { key, label: DELAY_LABEL[key], count, pct: pctOf(count, cohort.length) };
  });
}

/* ─────────── รายวัน ─────────── */

export type DailyMetric = 'names' | 'called' | 'aiSaidYes' | 'staffFollowed';

export const DAILY_METRIC_LABEL: Record<DailyMetric, string> = {
  names: 'รายชื่อเข้ามา',
  called: 'โทรแล้ว',
  aiSaidYes: 'ตอบ AI ว่าสนใจ',
  staffFollowed: 'คนโทรต่อแล้ว',
};

export type DailyRow = {
  ymd: string;
  /** เลขวันที่ของเดือน */
  day: number;
  names: number;
  called: number;
  aiSaidYes: number;
  staffFollowed: number;
  /** กรอกวันนั้น โทรภายใน 24 ชม. / 1 วัน / 2 วันขึ้นไป / ยังไม่ได้โทร */
  d0: number;
  d1: number;
  d2plus: number;
  none: number;
};

const addDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

/** ทุกวันในช่วง (วันไม่มีรายชื่อ = แถว 0 — กราฟไม่ขาดช่วง) · ผลรวมทุกแถว = ยอดของเดือนพอดี */
export function dailyRows(apps: readonly RecruitAppFact[], from: string, to: string): DailyRow[] {
  const rows = new Map<string, DailyRow>();
  for (let d = from; d <= to; d = addDay(d)) {
    rows.set(d, { ymd: d, day: Number(d.slice(8, 10)), names: 0, called: 0, aiSaidYes: 0, staffFollowed: 0, d0: 0, d1: 0, d2plus: 0, none: 0 });
    if (rows.size > 62) break;
  }
  for (const f of apps) {
    const r = rows.get(appliedYmd(f) ?? '');
    if (!r) continue;
    r.names += 1;
    if (isCalled(f)) r.called += 1;
    if (isAiSaidYes(f)) r.aiSaidYes += 1;
    if (isStaffFollowed(f)) r.staffFollowed += 1;
    const k = delayOf(f);
    if (k === 'd0') r.d0 += 1;
    else if (k === 'd1') r.d1 += 1;
    else if (k === 'none') r.none += 1;
    else r.d2plus += 1;
  }
  return [...rows.values()];
}

/** สรุปบรรทัดใต้หัวกราฟ: รวม · วันที่สูงสุด · เฉลี่ยต่อวัน (ปัดเป็นจำนวนเต็ม) */
export function dailySummary(rows: readonly DailyRow[], metric: DailyMetric): {
  total: number;
  peak: { ymd: string; value: number } | null;
  avg: number;
} {
  const total = rows.reduce((s, r) => s + r[metric], 0);
  let peak: { ymd: string; value: number } | null = null;
  for (const r of rows) if (r[metric] > 0 && (!peak || r[metric] > peak.value)) peak = { ymd: r.ymd, value: r[metric] };
  return { total, peak, avg: rows.length > 0 ? Math.round(total / rows.length) : 0 };
}

/* ─────────── ช่องทาง · ตำแหน่ง ─────────── */

export type ChannelRow = {
  channel: string;
  names: number;
  called: number;
  aiSaidYes: number;
  /** null = อ่านบอร์ด ERP ไม่ได้ */
  onBoard: number | null;
  /** ตอบ AI ว่าสนใจ ÷ รายชื่อ */
  interestRate: number | null;
};

function channelRowOf(channel: string, list: readonly RecruitAppFact[]): ChannelRow {
  const saidYes = list.filter(isAiSaidYes).length;
  return {
    channel,
    names: list.length,
    called: list.filter(isCalled).length,
    aiSaidYes: saidYes,
    onBoard: list.some((f) => f.onBoard === null) ? null : list.filter((f) => f.onBoard === true).length,
    interestRate: pctOf(saidYes, list.length),
  };
}

/** แถวต่อช่องทาง เรียงรายชื่อมากสุดก่อน + แถวรวม */
export function channelRows(cohort: readonly RecruitAppFact[]): { rows: ChannelRow[]; total: ChannelRow } {
  const by = new Map<string, RecruitAppFact[]>();
  for (const f of cohort) {
    const k = channelOf(f);
    by.set(k, [...(by.get(k) ?? []), f]);
  }
  const rows = [...by.entries()]
    .map(([k, list]) => channelRowOf(k, list))
    .sort((a, b) => b.names - a.names || a.channel.localeCompare(b.channel, 'th'));
  return { rows, total: channelRowOf('รวม', cohort) };
}

export type PositionRow = { position: string; names: number; pct: number | null; other?: boolean };

/** 10 อันดับแรก + "ตำแหน่งอื่นๆ" รวมที่เหลือ (ไม่มีที่เหลือ = ไม่มีแถวนี้) */
export function positionRows(cohort: readonly RecruitAppFact[], top = 10): PositionRow[] {
  const by = new Map<string, number>();
  for (const f of cohort) by.set(positionOf(f), (by.get(positionOf(f)) ?? 0) + 1);
  const sorted = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'th'));
  const head = sorted.slice(0, top).map(([position, names]) => ({ position, names, pct: pctOf(names, cohort.length) }));
  const rest = sorted.slice(top).reduce((s, [, n]) => s + n, 0);
  return rest > 0 ? [...head, { position: 'ตำแหน่งอื่นๆ', names: rest, pct: pctOf(rest, cohort.length), other: true }] : head;
}

/* ─────────── เหตุผลที่ไม่สำเร็จ ─────────── */

export type ReasonGroupKey = 'contact' | 'appoint' | 'attend';

/** ป้ายสามขั้นตามหน้า iRecruit ที่ทีมคุ้น */
export const REASON_GROUP_LABEL: Record<ReasonGroupKey, string> = {
  contact: 'ติดต่อไม่สำเร็จ',
  appoint: 'นัดหมายไม่สำเร็จ',
  attend: 'ไม่มาตามนัด',
};

export type ReasonGroup = { key: ReasonGroupKey; label: string; total: number; reasons: { label: string; count: number }[] };

const NOT_REACHED: readonly CallMicroOutcome[] = ['no_pickup', 'picked_silent', 'wrong_person'];
const TALKED_NOT_YES: readonly CallMicroOutcome[] = ['said_no', 'not_yet', 'talked_unclear'];

type Signal = { kind: 'ai' | 'staff'; micro: CallMicroOutcome; at: string } | { kind: 'log'; ok: boolean; reason: string | null; at: string };

/**
 * สัญญาณล่าสุดของรายชื่อ (หนึ่งรายชื่อหนึ่งผล) — เทียบเวลาคำตอบของ AI / ผลที่คนลง / บันทึกผลติดต่อ
 * เวลาเท่ากัน = ฝั่งคนชนะ (หลักเดียวกับแผงผลโทรหน้าหลัก + มุมมองสนใจของแท็บผู้สมัคร)
 */
export function latestSignal(f: RecruitAppFact): Signal | null {
  const all: Signal[] = [];
  if (f.aiAnswer && f.aiAnswerAt) all.push({ kind: 'ai', micro: f.aiAnswer, at: f.aiAnswerAt });
  if (f.staffAnswer && f.staffAnswerAt) all.push({ kind: 'staff', micro: f.staffAnswer, at: f.staffAnswerAt });
  if (f.logOk !== null && f.logAt) all.push({ kind: 'log', ok: f.logOk, reason: f.logReason, at: f.logAt });
  const rank = (s: Signal) => (s.kind === 'ai' ? 0 : 1);
  all.sort((a, b) => (a.at === b.at ? rank(b) - rank(a) : a.at < b.at ? 1 : -1));
  return all[0] ?? null;
}

/** รายชื่อที่ไปต่อไม่ได้ แยกตามขั้น + เหตุผล (ถังผลโทรใช้คำในพจนานุกรม `lumos.result.*` ชุดเดียวกับหน้าหลัก) */
export function reasonGroups(cohort: readonly RecruitAppFact[]): ReasonGroup[] {
  const groups: Record<ReasonGroupKey, Map<string, number>> = { contact: new Map(), appoint: new Map(), attend: new Map() };
  const add = (g: ReasonGroupKey, label: string) => groups[g].set(label, (groups[g].get(label) ?? 0) + 1);
  for (const f of cohort) {
    if (f.attendance === 'no_show') {
      add('attend', 'ไม่มาตามนัด');
      continue;
    }
    if (f.attendance === 'rescheduled') {
      add('attend', 'เลื่อนนัด');
      continue;
    }
    if (f.appointmentAt) continue;
    const s = latestSignal(f);
    if (!s) continue;
    if (s.kind === 'log') {
      if (!s.ok) add('contact', s.reason ?? 'ไม่ระบุเหตุผล');
      else add('appoint', s.reason ?? 'ยังนัดไม่ได้');
      continue;
    }
    if (NOT_REACHED.includes(s.micro)) add('contact', callResultLabel('interest', s.micro));
    else if (TALKED_NOT_YES.includes(s.micro)) add('appoint', callResultLabel('interest', s.micro));
  }
  return (['contact', 'appoint', 'attend'] as const).map((key) => {
    const reasons = [...groups[key].entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'th'));
    return { key, label: REASON_GROUP_LABEL[key], total: reasons.reduce((s, r) => s + r.count, 0), reasons };
  });
}

/* ─────────── ผลงานรายคน ─────────── */

export type StaffSortKey = 'claimed' | 'called' | 'reached' | 'appointed' | 'showed';

export type StaffTableRow = RecruitStaffRow & { key: string; isAi?: boolean; showRate: number | null };

/** แถวเจ้าหน้าที่ + แถว AI ไว้ท้าย (AI ไม่เก็บงาน/ไม่นัด = null ไม่ใช่ 0) · เรียงตามคอลัมน์ที่กด (มากไปน้อย) */
export function staffTableRows(
  staff: readonly RecruitStaffRow[],
  ai: RecruitAiRow | null,
  sort: StaffSortKey = 'appointed',
): { rows: StaffTableRow[]; ai: (RecruitAiRow & { key: string }) | null } {
  const rows = staff
    .map((s) => ({ ...s, key: `staff:${s.name}`, showRate: pctOf(s.showed, s.appointed) }))
    .sort((a, b) => b[sort] - a[sort] || b.called - a.called || a.name.localeCompare(b.name, 'th'));
  return { rows, ai: ai ? { ...ai, key: 'ai' } : null };
}
