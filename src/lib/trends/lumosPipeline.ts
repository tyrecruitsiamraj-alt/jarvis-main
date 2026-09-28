/**
 * ═══ เส้นทาง "รายชื่อเข้ามา → ส่งให้ Lumos → Lumos โทร → ผลโทร" ของกล่องงาน ═══
 *
 * เจ้าของสั่ง 28 ก.ย. 2569: *"ฉันต้องการเห็นว่า มีรายชื่อเข้ามาเท่าไหร่ ส่งไปหา lumos เท่าไหร่ Lumos โทรหมดไหม
 * โทรแล้วผลเป็นไง หรือ แค่รับสายแล้ววาง ไม่รับเยอะไหม ถ้าบอกช่วงเวลาที่คนกรอกเข้ามาเยอะด้วยยิ่งดีเลย"*
 *
 * 🔴 นิยาม (ยืมตัวกลางทั้งหมด — หนึ่งเมตริกหนึ่งนิยาม):
 * - รายชื่อเข้ามา = ใบสมัครจากหน้าสมัครสาธารณะ (นับตามเวลาที่กรอก · ปฏิทินกรุงเทพ)
 * - ส่งให้ Lumos = มีแถวคิว `person_ref = 'app-<id>'` (ตัวเดียวกับ "ส่ง AI แล้ว x/y" บนการ์ด)
 * - สถานะคิว = `lumosQueueDefs` · ผลโทร = `classifyCallMicro` + คลังคำ "ถามความสนใจ" (ตัวเดียวกับแผง Rate ผลโทร)
 * - มีคนรับ/ได้คุย/ตอบรับ = `addCallMicro` + `callMicroRates` (มีคนรับ ÷ มีผล · ได้คุย ÷ มีผล · ตอบรับ ÷ ได้คุย)
 * - ป้ายถังผล = พจนานุกรมเมตริก `lumos.result.*` (คำเดียวกับหน้าแรก)
 *
 * นับแบบ **กลุ่มเดียวกัน (cohort)** — คนที่กรอกในช่วงนี้ ไปถึงขั้นไหนแล้ว (ห้ามเอาคนละกลุ่มมาหาร)
 * ⚠️ ถังผลโทร = รหัสผลของ Lumos ก่อน (confirmed → สนใจ · no_answer/busy/failed → ไม่รับสาย …) รหัสที่ไม่ชี้ขาด
 *    จึงอ่านคำพูดในสาย (`classifyCallMicro`) — ไม่ชัดตกถัง "คุยแล้วแต่ไม่ได้คำตอบ" เสมอ
 */
import { callAttemptSlot } from '@/lib/callOutcomeBuckets';
import { addCallMicro, callMicroRates, emptyCallMicroSummary, type CallMicroSummary } from '@/lib/callMicroOutcome';
import type { ToneKey } from '@/lib/designTokens';
import { METRICS, type MetricKey } from '@/lib/metricDictionary';
import { appliedYmd } from './applicantTrends';
import { bangkokYmd, inRange } from './timeBuckets';
import type { ApplicantTrendRow, TrendCallMicro } from './types';

/**
 * ถังผลโทร → คำในพจนานุกรมเมตริก (งานถามความสนใจ) — ป้ายชุดเดียวกับหน้าแรก (`TeamBoardPanel`)
 * 🔴 ห้ามตั้งคำเอง: อยากเปลี่ยนคำให้แก้ `metricDictionary.ts` ที่เดียว ทุกจอเปลี่ยนตาม
 */
const INTEREST_MICRO_METRIC: Record<TrendCallMicro, MetricKey> = {
  no_pickup: 'lumos.result.no_pickup',
  picked_silent: 'lumos.result.silent',
  wrong_person: 'lumos.result.wrong_person',
  said_yes: 'lumos.result.interested',
  said_no: 'lumos.result.not_interested',
  not_yet: 'lumos.result.thinking',
  talked_unclear: 'lumos.result.unclear',
};

/** ลำดับบนจอ: ไม่ได้คุย → ได้คุย */
export const INTEREST_MICRO_ORDER: readonly TrendCallMicro[] = [
  'no_pickup',
  'picked_silent',
  'wrong_person',
  'said_yes',
  'said_no',
  'not_yet',
  'talked_unclear',
];

const fromDictionary = (pick: (key: MetricKey) => string) =>
  Object.fromEntries(INTEREST_MICRO_ORDER.map((k) => [k, pick(INTEREST_MICRO_METRIC[k])])) as Record<TrendCallMicro, string>;

/** ป้ายของถัง (จากพจนานุกรมเมตริก) */
export const INTEREST_MICRO_LABEL = fromDictionary((key) => METRICS[key].label);
/** คำอธิบายของถัง — โชว์ตอนชี้ */
export const INTEREST_MICRO_HINT = fromDictionary((key) => METRICS[key].what);

/** โทนสีของถัง — ภาษาเดียวกับทั้งระบบ (เขียว = สำเร็จ · แดง = ปฏิเสธ · เทา = ไม่รับ) */
export const INTEREST_MICRO_TONE: Record<TrendCallMicro, ToneKey> = {
  no_pickup: 'neutral',
  picked_silent: 'warn',
  wrong_person: 'orange',
  said_yes: 'success',
  said_no: 'danger',
  not_yet: 'info',
  talked_unclear: 'violet',
};

export type PipelineStep = {
  key: 'names' | 'sent' | 'called' | 'pickedUp' | 'talked' | 'interested';
  label: string;
  count: number;
  /** ÷ รายชื่อเข้ามา */
  ofNames: number | null;
  /** ÷ ขั้นก่อนหน้า */
  ofPrevious: number | null;
};

export type LumosPipeline = {
  names: number;
  steps: PipelineStep[];
  /**
   * ยังไม่ได้ส่งให้ Lumos — แยกเหตุที่รู้ได้ (ที่เหลือ = อื่น ๆ)
   * `noJob` = ไม่ได้เลือกงาน · ตัวส่งอัตโนมัติต้องมีงาน (`buildApplicationInterviewPayload`) จึงข้ามเงียบ ๆ
   */
  notSent: { total: number; claimed: number; badPhone: number; noJob: number; lead: number; other: number };
  /** ส่งแล้วแต่ Lumos ยังไม่มีผล */
  notCalled: {
    total: number;
    pending: number;
    waiting: number;
    cancelled: number;
    /** ค้างนานสุดกี่ชั่วโมง (เฉพาะที่ยังไม่ถึงมือ/รอผล · นับจาก `waitingSince` · ยังไม่ถึงเวลาโทร = 0) */
    oldestHours: number | null;
  };
  /** ผลโทรแยกถัง + มีผลกลับ/มีคนรับ/ได้คุย (ตัวรวมกลาง `addCallMicro`) */
  micro: CallMicroSummary;
  /** ได้นัด / มาตามนัด (มาได้ทั้งจาก AI และเจ้าหน้าที่โทร) */
  appointment: number;
  showed: number;
  /** รอบที่โทรจนได้ผล: 1 = รอบแรกจบ */
  attempts: Array<{ slot: 1 | 2 | 3; called: number; pickedUp: number }>;
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

export function lumosPipeline(
  rows: readonly ApplicantTrendRow[],
  range: { from: string; to: string },
  now: Date = new Date(),
): LumosPipeline {
  const cohort = rows.filter((r) => inRange(appliedYmd(r), range.from, range.to));
  const micro = emptyCallMicroSummary();
  const notSent = { total: 0, claimed: 0, badPhone: 0, noJob: 0, lead: 0, other: 0 };
  const notCalled = { total: 0, pending: 0, waiting: 0, cancelled: 0, oldestHours: null as number | null };
  const attempts = new Map<1 | 2 | 3, { slot: 1 | 2 | 3; called: number; pickedUp: number }>([
    [1, { slot: 1, called: 0, pickedUp: 0 }],
    [2, { slot: 2, called: 0, pickedUp: 0 }],
    [3, { slot: 3, called: 0, pickedUp: 0 }],
  ]);
  let sent = 0;
  let called = 0;
  let appointment = 0;
  let showed = 0;
  for (const r of cohort) {
    if (r.appointmentAt) appointment += 1;
    if (r.attendance === 'showed') showed += 1;
    const l = r.lumos;
    if (!l) {
      notSent.total += 1;
      // เหตุแรกที่เจอ (ลำดับ: เก็บไปโทรเอง → เบอร์ใช้ไม่ได้ → ไม่ได้เลือกงาน → ย้ายไป Lead)
      if (r.claimed) notSent.claimed += 1;
      else if (!r.phoneOk) notSent.badPhone += 1;
      else if (!r.jobId) notSent.noJob += 1;
      else if (r.isLead) notSent.lead += 1;
      else notSent.other += 1;
      continue;
    }
    sent += 1;
    if (l.state !== 'called') {
      notCalled.total += 1;
      notCalled[l.state] += 1;
      if ((l.state === 'pending' || l.state === 'waiting') && l.waitingSince) {
        const h = Math.max(0, (now.getTime() - Date.parse(l.waitingSince)) / 3_600_000);
        notCalled.oldestHours = notCalled.oldestHours === null ? h : Math.max(notCalled.oldestHours, h);
      }
      continue;
    }
    called += 1;
    const slot = callAttemptSlot(l.attempt);
    const a = attempts.get(slot)!;
    a.called += 1;
    addCallMicro(micro, l.micro);
    if (l.micro && l.micro !== 'no_pickup') a.pickedUp += 1;
  }
  if (notCalled.oldestHours !== null) notCalled.oldestHours = Math.round(notCalled.oldestHours * 10) / 10;
  const names = cohort.length;
  const counts: Array<[PipelineStep['key'], string, number]> = [
    ['names', 'รายชื่อเข้ามา', names],
    ['sent', 'ส่งให้ Lumos', sent],
    ['called', 'Lumos โทรแล้ว', called],
    ['pickedUp', 'มีคนรับสาย', micro.pickedUp],
    ['talked', 'ได้คุยเรื่องของเรา', micro.talked],
    ['interested', INTEREST_MICRO_LABEL.said_yes, micro.said_yes],
  ];
  const steps = counts.map(([key, label, count], i) => ({
    key,
    label,
    count,
    ofNames: ratio(count, names),
    ofPrevious: i === 0 ? null : ratio(count, counts[i - 1][2]),
  }));
  return { names, steps, notSent, notCalled, micro, appointment, showed, attempts: [...attempts.values()] };
}

/**
 * อัตรา — ฐานคนละตัว (จอต้องบอกฐานทุกตัว)
 * - `coverage` = Lumos โทรแล้ว ÷ ส่งให้ Lumos (ตอบ "Lumos โทรหมดไหม")
 * - ที่เหลือ = `callMicroRates` ตัวกลางตัวเดียวกับแผน/ปฏิทินติดตาม (แปลงเป็นสัดส่วน 0–1)
 */
export function pipelineRates(p: LumosPipeline): {
  coverage: number | null;
  reach: number | null;
  talk: number | null;
  interest: number | null;
} {
  const called = p.steps.find((s) => s.key === 'called')?.count ?? 0;
  const sent = p.steps.find((s) => s.key === 'sent')?.count ?? 0;
  const r = callMicroRates(p.micro);
  const frac = (x: number | null) => (x === null ? null : x / 100);
  return { coverage: ratio(called, sent), reach: frac(r.reachRate), talk: frac(r.talkRate), interest: frac(r.successRate) };
}

/** วัน (จันทร์ = 0) และชั่วโมงตามเวลาไทย — ไทยไม่มีเวลาออมแสง จึงบวก 7 ชั่วโมงได้ตรง ๆ */
export function bangkokDowHour(iso: string | null | undefined): { dow: number; hour: number } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t + 7 * 3_600_000);
  return { dow: (d.getUTCDay() + 6) % 7, hour: d.getUTCHours() };
}

export const DOW_LABEL = ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.'] as const;

/** ตาราง วัน × ชั่วโมง ของเวลาที่กรอกใบสมัคร (7 × 24) */
export function applyHeatmap(rows: readonly ApplicantTrendRow[], range: { from: string; to: string }): number[][] {
  const m = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (const r of rows) {
    if (!inRange(appliedYmd(r), range.from, range.to)) continue;
    const dh = bangkokDowHour(r.createdAt);
    if (dh) m[dh.dow][dh.hour] += 1;
  }
  return m;
}

/**
 * Lumos โทรช่วงไหนแล้วมีคนรับ — นับตามชั่วโมงที่ได้ผล (สายที่ได้ผลในช่วงนี้)
 * ⚠️ ชั่วโมงที่มีสายน้อย % แกว่งง่าย — จอต้องโชว์จำนวนสายคู่กันเสมอ
 */
export function reachByCallHour(
  rows: readonly ApplicantTrendRow[],
  range: { from: string; to: string },
): Array<{ hour: number; called: number; pickedUp: number; rate: number | null }> {
  const acc = Array.from({ length: 24 }, (_, hour) => ({ hour, called: 0, pickedUp: 0 }));
  for (const r of rows) {
    const l = r.lumos;
    if (!l || l.state !== 'called' || !l.micro) continue;
    if (!inRange(bangkokYmd(l.resultAt), range.from, range.to)) continue;
    const dh = bangkokDowHour(l.resultAt);
    if (!dh) continue;
    acc[dh.hour].called += 1;
    if (l.micro !== 'no_pickup') acc[dh.hour].pickedUp += 1;
  }
  return acc.map((x) => ({ ...x, rate: ratio(x.pickedUp, x.called) }));
}

export type PipelineDimRow = {
  dim: string;
  names: number;
  /** รายชื่อเข้ามาช่วงก่อน (มิติเดียวกัน) · ไม่ส่งช่วงก่อน = 0 */
  namesPrev: number;
  sent: number;
  called: number;
  pickedUp: number;
  interested: number;
  /** สนใจ ÷ Lumos โทรแล้ว */
  interestOfCalled: number | null;
};

/**
 * เส้นทางแยกตามมิติ (ช่องทาง · ตำแหน่ง · จังหวัด · BU) — เรียงตามรายชื่อเข้ามา · เกิน top รวบเป็น "อื่น ๆ"
 * `previous` = นับรายชื่อเข้ามาช่วงก่อนต่อมิติ (แถว "อื่น ๆ" รวมทุกค่าที่ไม่ติดอันดับ)
 */
export function pipelineByDim(
  rows: readonly ApplicantTrendRow[],
  range: { from: string; to: string },
  getDim: (r: ApplicantTrendRow) => string,
  { top = 8, previous }: { top?: number; previous?: { from: string; to: string } } = {},
): PipelineDimRow[] {
  const dimOf = (r: ApplicantTrendRow) => getDim(r).trim() || 'ไม่ระบุ';
  const empty = (dim: string): PipelineDimRow => ({
    dim,
    names: 0,
    namesPrev: 0,
    sent: 0,
    called: 0,
    pickedUp: 0,
    interested: 0,
    interestOfCalled: null,
  });
  const acc = new Map<string, PipelineDimRow>();
  const prev = new Map<string, number>();
  for (const r of rows) {
    const ymd = appliedYmd(r);
    if (previous && inRange(ymd, previous.from, previous.to)) prev.set(dimOf(r), (prev.get(dimOf(r)) ?? 0) + 1);
    if (!inRange(ymd, range.from, range.to)) continue;
    const dim = dimOf(r);
    const row = acc.get(dim) ?? empty(dim);
    row.names += 1;
    if (r.lumos) row.sent += 1;
    if (r.lumos?.state === 'called') {
      row.called += 1;
      if (r.lumos.micro && r.lumos.micro !== 'no_pickup') row.pickedUp += 1;
      if (r.lumos.micro === 'said_yes') row.interested += 1;
    }
    acc.set(dim, row);
  }
  const sorted = [...acc.values()].sort((a, b) => b.names - a.names || a.dim.localeCompare(b.dim, 'th'));
  const kept = sorted.length > top ? sorted.slice(0, top) : sorted;
  const keptDims = new Set(kept.map((r) => r.dim));
  const withPrev = kept.map((r) => ({ ...r, namesPrev: prev.get(r.dim) ?? 0 }));
  if (sorted.length > top) {
    const rest = sorted.slice(top).reduce(
      (s, r) => ({
        ...s,
        names: s.names + r.names,
        sent: s.sent + r.sent,
        called: s.called + r.called,
        pickedUp: s.pickedUp + r.pickedUp,
        interested: s.interested + r.interested,
      }),
      empty('อื่น ๆ'),
    );
    rest.namesPrev = [...prev.entries()].reduce((s, [d, n]) => (keptDims.has(d) ? s : s + n), 0);
    withPrev.push(rest);
  }
  return withPrev.map((r) => ({ ...r, interestOfCalled: ratio(r.interested, r.called) }));
}
