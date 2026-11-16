/**
 * ═══ ภาพรวมงานสรรหา 8 เรื่อง เทียบ BU (เจ้าของ 16 พ.ย. 2569 เคาะจากตัวอย่าง แล้ว "ทำมาก่อน") ═══
 * > *"ทั้งหมดมันต้องเทียบเป็น Bu ให้ดู … เปลี่ยนเรื่องแล้วกราฟเปลี่ยน"* · *"รายชื่อเข้ามา 1388 โทรแล้ว 1103 แล้วที่เหลือไปไหน … มันต้องตอบได้โดยไม่ต้องถาม"*
 * ซ้าย = กราฟเทียบ BU ของเรื่องที่เลือก · ขวา = รายละเอียด BU ที่กด · บน = กราฟเวลา (กดเดือน = ทั้งหน้าเป็นเดือนนั้น · กดวัน = ป๊อปแยกก้อน)
 * 🔴 ทุกยอดเป็นสมการบวกลงตัว · นิยามมาจากตัวกลางเดิม (`buildPersonJourney` · ขั้นที่ติดของใบขอ · `reasonGroups` · `buildCallerResults` · `funnelPlaceOf`)
 *    ไฟล์นี้แค่จัดกลุ่มตาม BU/วัน ห้ามนับเองใหม่ (เลขต้องตรงกับหน้าอื่น)
 * pure — เทสต์ `tests/api/recruitTopics2569-11-16.test.ts`
 */
import type { ToneKey } from './designTokens';
import type { RecruitAppFact } from './recruitOverviewTypes';
import { aiStage } from './recruitJourney';
import { buildPersonJourney, type PersonPart, type PersonStage } from './recruitPersonJourney';
import { STUCK_PHASES, stuckInScope, stuckPhaseOf, type StuckRequest } from './recruitStuck';
import { reasonGroups } from './recruitOverview';
import { buildCallerResults } from './callerResults';
import { FUNNEL_GROUP_LABEL, funnelPlaceOf, type FunnelGroupKey } from './channelFunnel';
import type { ManualLinkRow } from './jobPostActions';

export const TOPIC_KEYS = ['req', 'start', 'fb', 'self', 'people', 'staff', 'channel', 'why'] as const;
export type TopicKey = (typeof TOPIC_KEYS)[number];

/** ชื่อเรื่อง — ชุดเดียวกับตัวอย่างที่เจ้าของเคาะ */
export const TOPIC_TITLES: Record<TopicKey, string> = {
  req: 'ใบขอเหลือหา',
  start: 'เริ่มหาแล้ว / ยังไม่เริ่ม',
  fb: 'โพสต์ลงกลุ่ม Facebook',
  self: 'โพสต์เอง',
  people: 'รายชื่อ → ลงงาน',
  staff: 'คนโทรต่อ',
  channel: 'ช่องทาง',
  why: 'เหตุผลที่ไม่สำเร็จ',
};
export const isTopicKey = (v: string | null | undefined): v is TopicKey => Boolean(v && (TOPIC_KEYS as readonly string[]).includes(v));

/** ก้อนหนึ่งในแท่ง/สมการ — `ids` = id ใบสมัคร (กดเปิดรายชื่อ) · ใบขอไม่มี id */
export type TopicPart = { key: string; label: string; value: number; tone: ToneKey; ids?: string[] };
export type BuBar = { bu: string; total: number; parts: TopicPart[] };

const sumOf = (parts: readonly TopicPart[]) => parts.reduce((s, p) => s + p.value, 0);
const bar = (bu: string, parts: TopicPart[]): BuBar => ({ bu, total: sumOf(parts), parts });

/* ─────────── ใบขอ ─────────── */

/** ใบขอที่ยังเปิด ณ วันนี้ (เหลือหา) */
export const openRequestsOf = (rows: readonly StuckRequest[]): StuckRequest[] => rows.filter((r) => stuckInScope(r, 'remaining'));

/** ใบขอเข้ามาในวันนั้น แยกสถานะตอนนี้ — ยังเปิด · ได้คนแล้ว · ยกเลิก (ตัวแบ่งเดียวกับสมการใบขอ `stuckInScope`) */
export function requestStateParts(rows: readonly StuckRequest[]): TopicPart[] {
  return [
    { key: 'open', label: 'ยังเปิด', tone: 'warn', value: rows.filter((r) => stuckInScope(r, 'remaining')).length },
    { key: 'filled', label: 'ได้คนแล้ว', tone: 'success', value: rows.filter((r) => stuckInScope(r, 'filled')).length },
    { key: 'cancelled', label: 'ยกเลิก', tone: 'neutral', value: rows.filter((r) => stuckInScope(r, 'cancelled')).length },
  ];
}

/** ใบขอเหลือหา แยกขั้นที่ติด — 4 ขั้นของ `STUCK_PHASES` (ตัวเดียวกับ "ใครต้องทำอะไร") */
export function requestPhaseParts(rows: readonly StuckRequest[]): TopicPart[] {
  return STUCK_PHASES.map((p) => ({ key: p.key, label: p.label, tone: p.tone, value: rows.filter((r) => stuckPhaseOf(r.reason) === p.key).length }));
}

/**
 * เริ่มหาแล้ว = ประกาศหน้าประกาศ หรือมีลิงก์/Autopost ที่ยังไม่ยกเลิก (`signals.links`) หรือเคยสั่งโพสต์ (`signals.post`)
 * ยังไม่เริ่ม = ไม่ได้ทำอะไรกับใบนั้นเลย (เจ้าของ "ปล่อยนิ่ง")
 */
export const isStartedRequest = (r: StuckRequest): boolean => r.signals.released || r.signals.links > 0 || r.signals.post !== null;
export function startParts(rows: readonly StuckRequest[]): TopicPart[] {
  const started = rows.filter(isStartedRequest).length;
  return [
    { key: 'started', label: 'เริ่มหาแล้ว', tone: 'success', value: started },
    { key: 'notStarted', label: 'ยังไม่เริ่ม', tone: 'neutral', value: rows.length - started },
  ];
}
/** เริ่มหาด้วยอะไร (ใบ) — ใบเดียวทำได้หลายอย่าง ยอดแต่ละช่องจึงรวมเกินจำนวนใบที่เริ่มหา */
export function startMethods(rows: readonly StuckRequest[]): { released: number; links: number; post: number } {
  return {
    released: rows.filter((r) => r.signals.released).length,
    links: rows.filter((r) => r.signals.links > 0).length,
    post: rows.filter((r) => r.signals.post !== null).length,
  };
}

/* ─────────── รายชื่อ ─────────── */

/** เหตุที่ยังไม่ส่ง AI — แตก "ยังไม่ส่ง AI" ให้ตอบได้ว่าทำไม (เจ้าของ "ยังไม่ส่ง Ai เพราะอะไรอะ") */
export type NotSentReason = 'keptNot' | 'noIncome' | 'paused' | 'unknown';
export const NOT_SENT_LABEL: Record<NotSentReason, string> = {
  keptNot: 'มีคนเก็บไป · ยังไม่โทร',
  noIncome: 'ใบขอยังไม่ตั้งรายได้',
  paused: 'เบอร์ถูกพัก',
  unknown: 'ยังไม่รู้เหตุ',
};
export const notSentReasonOf = (f: RecruitAppFact): NotSentReason =>
  f.claimedBy && !f.calledByStaff ? 'keptNot' : f.aiBlock === 'income' ? 'noIncome' : f.aiBlock === 'paused' ? 'paused' : 'unknown';

const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));
const fromPart = (p: PersonPart): TopicPart => ({ key: p.key, label: p.label, tone: p.tone, value: p.ids.length, ids: p.ids });
const factPart = (key: string, label: string, tone: ToneKey, list: readonly RecruitAppFact[]): TopicPart => ({ key, label, tone, value: list.length, ids: idsOf(list) });

export type TopicStep = { key: string; label: string; total: number; ids: string[]; parts: TopicPart[] };
const fromStage = (s: PersonStage): TopicStep => ({ key: s.key, label: s.label, total: s.total, ids: s.ids, parts: s.parts.map(fromPart) });

/**
 * สมการของรายชื่อ ทีละขั้น — แกนคือ `buildPersonJourney` (เส้นที่เจ้าของเคาะ "ตามร่างทั้งหมด" 9 พ.ย. 2569 · เลขเดียวกับหน้าเดิม)
 * เพิ่ม: ยังไม่มีใครโทร แตกเหตุ · นัดได้ทุกทาง (สาย AI + คนโทรเอง + ทางอื่น · เจ้าของ Choice "นับทุกทาง แยกที่มา") · ผลนัดของนัดทุกทาง
 */
export function peopleSteps(list: readonly RecruitAppFact[], now: Date = new Date()): TopicStep[] {
  const stages = buildPersonJourney(list, now);
  const base = stages.filter((s) => s.key !== 'pass').map(fromStage);

  const notCalled = list.filter((f) => !f.calledByAi && !f.calledByStaff && aiStage(f) !== 'queued');
  const byStage = (s: ReturnType<typeof aiStage>) => notCalled.filter((f) => aiStage(f) === s);
  const notSent = byStage('notSent');
  const byReason = (r: NotSentReason) => notSent.filter((f) => notSentReasonOf(f) === r);
  const noQueue: TopicStep = {
    key: 'noQueue',
    label: 'ยังไม่มีใครโทร',
    total: notCalled.length,
    ids: idsOf(notCalled),
    parts: [
      factPart('bad', 'เบอร์ผิด', 'danger', byStage('bad')),
      factPart('overAge', 'อายุเกิน', 'orange', byStage('overAge')),
      factPart('irecruit', 'มาจาก iRecruit', 'violet', byStage('irecruit')),
      ...(['keptNot', 'noIncome', 'paused', 'unknown'] as const).map((r) => factPart(r, NOT_SENT_LABEL[r], r === 'keptNot' ? 'warn' : 'neutral', byReason(r))),
    ],
  };

  const booked = list.filter((f) => Boolean(f.appointmentAt));
  const viaAi = new Set(stages.find((s) => s.key === 'attend')?.ids ?? []);
  const viaStaff = booked.filter((f) => !f.calledByAi && f.calledByStaff);
  const viaStaffIds = new Set(idsOf(viaStaff));
  const allBooked: TopicStep = {
    key: 'allBooked',
    label: 'นัดได้ทั้งหมด',
    total: booked.length,
    ids: idsOf(booked),
    parts: [
      factPart('viaAi', 'จากสาย AI → คนโทรต่อ', 'success', booked.filter((f) => f.id && viaAi.has(f.id))),
      factPart('viaStaff', 'คนโทรเองนัดได้', 'violet', viaStaff),
      factPart('viaOther', 'นัดทางอื่น', 'info', booked.filter((f) => !(f.id && (viaAi.has(f.id) || viaStaffIds.has(f.id))))),
    ],
  };
  const allAttend: TopicStep = {
    key: 'allAttend',
    label: 'นัดได้ทั้งหมด · มาไหม',
    total: booked.length,
    ids: idsOf(booked),
    parts: [
      factPart('showed', 'มา', 'success', booked.filter((f) => f.attendance === 'showed')),
      factPart('noShow', 'ไม่มา', 'danger', booked.filter((f) => f.attendance === 'no_show')),
      factPart('pending', 'ยังไม่ลงผล', 'warn', booked.filter((f) => f.attendance !== 'showed' && f.attendance !== 'no_show')),
    ],
  };
  // ลำดับอ่านไล่ลง: กรอกเข้ามา → (ยังไม่มีใครโทร แตกเหตุ) → AI โทรแล้ว → สนใจ → ติดต่อได้ → นัดได้ (สาย AI) → นัดได้ทุกทาง → มาไหม
  const [apps, ...rest] = base;
  return [apps, noQueue, ...rest.filter((s) => s.key !== 'attend'), allBooked, allAttend];
}

/** แท่ง BU ของรายชื่อ = ขั้นแรก (กรอกเข้ามา) แยก AI โทรแล้ว · คนโทรเอง · รอ AI โทร · ยังไม่มีใครโทร */
export const peopleParts = (list: readonly RecruitAppFact[]): TopicPart[] => buildPersonJourney(list)[0].parts.map(fromPart);

/** คนเก็บไปโทรต่อ — ยังไม่ทำ · ติดต่อไม่ได้ · ติดต่อได้ (ตัวเดียวกับตาราง "ทำแล้วเป็นไง") */
export function staffParts(list: readonly RecruitAppFact[]): TopicPart[] {
  const t = buildCallerResults(list).total;
  return [
    { key: 'notLogged', label: 'ยังไม่ทำ', tone: 'warn', value: t.notLogged.length, ids: t.notLogged },
    { key: 'notOk', label: 'ติดต่อไม่ได้', tone: 'danger', value: t.notOk.length, ids: t.notOk },
    { key: 'ok', label: 'ติดต่อได้', tone: 'success', value: t.ok.length, ids: t.ok },
  ];
}

const CHANNEL_TONE: Record<FunnelGroupKey, ToneKey> = { facebook: 'info', tiktok: 'violet', webjob: 'teal', offline: 'orange', unknown: 'neutral' };
/** ช่องทางหลักของรายชื่อ — กลุ่มเดียวกับตาราง "ช่องทางไหนทำได้ดี" (`funnelPlaceOf`) */
export function channelParts(list: readonly RecruitAppFact[]): TopicPart[] {
  return (Object.keys(FUNNEL_GROUP_LABEL) as FunnelGroupKey[]).map((g) => {
    const of = list.filter((f) => funnelPlaceOf(f).group === g);
    return { key: g, label: FUNNEL_GROUP_LABEL[g], tone: CHANNEL_TONE[g], value: of.length, ids: idsOf(of) };
  });
}

/** ไม่สำเร็จ 3 กอง — ตัวเดียวกับ "เหตุผลที่ไม่สำเร็จ" (`reasonGroups`) */
export function whyParts(list: readonly RecruitAppFact[]): TopicPart[] {
  const tone: Record<string, ToneKey> = { contact: 'neutral', appoint: 'danger', attend: 'warn' };
  return reasonGroups(list).map((g) => ({ key: g.key, label: g.label, tone: tone[g.key] ?? 'neutral', value: g.total, ids: g.reasons.flatMap((r) => r.ids) }));
}

/* ─────────── เทียบ BU ─────────── */

/** แท่งต่อ BU — `bus` = BU ที่ต้องขึ้นเสมอ (ไม่มีข้อมูล = แท่ง 0 ห้ามหาย) */
export function buBarsOf<T>(bus: readonly string[], items: readonly T[], buOf: (t: T) => string | null | undefined, partsOf: (list: T[]) => TopicPart[]): BuBar[] {
  return bus.map((bu) => bar(bu, partsOf(items.filter((t) => buOf(t) === bu))));
}

/* ─────────── เวลา ─────────── */

/** วันที่ (กรุงเทพ) ของเวลา ISO */
export const bkkDayOf = (iso: string): string => new Date(Date.parse(iso) + 7 * 3_600_000).toISOString().slice(0, 10);

/** ทุกวันของช่วง (มีครบแม้ไม่มีข้อมูล) */
export function daysOf(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); Number.isFinite(t) && t <= end && out.length < 400; t += 86_400_000) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

/** แบ่งชุดตามวัน — ทุกวันของช่วงมีถังเสมอ */
export function groupByDay<T>(items: readonly T[], dayOf: (t: T) => string | null, from: string, to: string): Map<string, T[]> {
  const m = new Map(daysOf(from, to).map((d) => [d, [] as T[]]));
  for (const t of items) {
    const d = dayOf(t);
    if (d) m.get(d)?.push(t);
  }
  return m;
}

/* ─────────── โพสต์เองรายลิงก์ ─────────── */

/** โพสต์แล้ว (มีลิงก์โพสต์วางกลับมา) · Gen link (ยังไม่โพสต์) — นับลิงก์ */
export function selfParts(rows: readonly ManualLinkRow[]): TopicPart[] {
  const posted = rows.filter((r) => r.posted).length;
  return [
    { key: 'posted', label: 'โพสต์แล้ว', tone: 'success', value: posted },
    { key: 'genlink', label: 'Gen link', tone: 'info', value: rows.length - posted },
  ];
}
export type LinkTotals = { links: number; clicks: number; applicants: number };
export const linkTotalsOf = (rows: readonly ManualLinkRow[]): LinkTotals => ({
  links: rows.length,
  clicks: rows.reduce((s, r) => s + r.clicks, 0),
  applicants: rows.reduce((s, r) => s + r.applicants, 0),
});
/** แยกตามกลุ่ม/ช่องทาง หรือคนสร้างลิงก์ — เรียงคลิกมากก่อน */
export function linkGroupsBy(rows: readonly ManualLinkRow[], keyOf: (r: ManualLinkRow) => string): Array<LinkTotals & { key: string }> {
  const m = new Map<string, ManualLinkRow[]>();
  for (const r of rows) m.set(keyOf(r), [...(m.get(keyOf(r)) ?? []), r]);
  return [...m.entries()].map(([key, list]) => ({ key, ...linkTotalsOf(list) })).sort((a, b) => b.applicants - a.applicants || b.clicks - a.clicks || a.key.localeCompare(b.key, 'th'));
}
