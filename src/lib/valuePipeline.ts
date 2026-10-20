/**
 * ═══ หน้าความคุ้มค่า: ใบขอครบเส้น 4 แท็บ (เจ้าของ 19 ต.ค. 2569) ═══
 * > *"ทำไว้ที่หน้าความคุ้มค่าระบบก่อน"* + Choice "ทั้ง 4 แบบเป็นแท็บ" · "AI เคยโทรภายใน 60 วันก่อนแจ้งเข้า"
 * แท็บ: คุ้มไหม · ช้าที่ตรงไหน · ใบขอนี้ติดอะไร · จุดบอด
 *
 * 🔴 กติกาเจ้าของ: ช้า = เกิน 24 ชม. ทุกขั้น · ขั้นที่ยังไม่มีข้อมูลต้องบอกว่า "ยังไม่มีข้อมูล" ห้ามขึ้น 0
 * ตรรกะล้วน — ฝั่ง API ส่งข้อเท็จจริงมา (`api/_handlers/value-pipeline.ts`) · เทสต์ `tests/api/valuePipeline2569-10-19.test.ts`
 */
import type { RecruitAppFact } from '@/lib/recruitOverviewTypes';
import { isFromIrecruit } from './recruitJourney';

export const SLA_MS = 24 * 3_600_000;
export const AI_ATTRIBUTION_DAYS = 60;

/* ─────────── คุ้มไหม ─────────── */

/** แจ้งเข้าที่นับเป็นผลของ AI: AI เคยโทรเบอร์นี้ภายใน 60 วันก่อน (หรือวันเดียวกับ) วันแจ้งเข้า */
export function informedAfterAi(
  informs: ReadonlyArray<{ phone9: string; day: string }>,
  aiCalls: ReadonlyMap<string, readonly number[]>,
): { informed: number; fromAi: number } {
  const seen = new Set<string>();
  let fromAi = 0;
  for (const i of informs) {
    if (!/^\d{9}$/.test(i.phone9) || seen.has(i.phone9)) continue;
    seen.add(i.phone9);
    const t = Date.parse(`${i.day}T00:00:00+07:00`);
    const end = t + 86_400_000;
    const start = t - AI_ATTRIBUTION_DAYS * 86_400_000;
    if ((aiCalls.get(i.phone9) ?? []).some((c) => c >= start && c < end)) fromAi += 1;
  }
  return { informed: seen.size, fromAi };
}

export type ValueOutcome = {
  month: string;
  aiCalls: number;
  informed: number;
  informedFromAi: number;
  requestsIn: number;
  requestsClosed: number;
  systemCost: number;
  staffCost: number;
  /** ค่าระบบ ÷ แจ้งเข้าที่ AI เคยโทร · ไม่มีคน = null */
  costPerInform: number | null;
  /** (ค่าระบบ + ค่าคน) ÷ ใบขอที่หาครบ · ไม่มีใบ = null */
  costPerClosed: number | null;
};

export function computeOutcome(input: Omit<ValueOutcome, 'costPerInform' | 'costPerClosed'>): ValueOutcome {
  return {
    ...input,
    costPerInform: input.informedFromAi > 0 ? input.systemCost / input.informedFromAi : null,
    costPerClosed: input.requestsClosed > 0 ? (input.systemCost + input.staffCost) / input.requestsClosed : null,
  };
}

/* ─────────── ช้าที่ตรงไหน ─────────── */

export type StageKey =
  | 'match'
  | 'release'
  | 'aiCall'
  | 'staffCall'
  | 'appointment'
  | 'attendance'
  | 'screening'
  | 'inform'
  | 'follow'
  | 'replace'
  | 'aftercare';

export const STAGES: ReadonlyArray<{ key: StageKey; label: string }> = [
  { key: 'match', label: 'จับคู่คนรอไว้' },
  { key: 'release', label: 'ประกาศหาคน' },
  { key: 'aiCall', label: 'AI โทรคัดกรอง' },
  { key: 'staffCall', label: 'คนโทรต่อคนสนใจ' },
  { key: 'appointment', label: 'นัดหมาย' },
  { key: 'attendance', label: 'ลงผลมา/ไม่มา' },
  { key: 'screening', label: 'ผ่านไหม' },
  { key: 'inform', label: 'คีย์ iRecruit → แจ้งเข้า ERP' },
  { key: 'follow', label: 'ติดตามคนเริ่มงาน' },
  { key: 'replace', label: 'ส่งคนแทน' },
  { key: 'aftercare', label: 'ดูแลหลังเริ่มงาน' },
];

/** หนึ่งขั้น · `null` = ยังไม่มีข้อมูล (ห้ามขึ้น 0) */
export type StageSla = {
  key: StageKey;
  label: string;
  /** ผ่านขั้นนี้แล้วกี่ราย · ในนั้นทันใน 24 ชม. กี่ราย */
  done: number | null;
  onTime: number | null;
  /** ค้างอยู่ตอนนี้เกิน 24 ชม. */
  stuck: number | null;
  /** ids ของใบสมัครที่ค้าง (กดดูรายชื่อ) */
  stuckIds: string[];
  /** เหตุที่ยังไม่มีข้อมูล */
  missing?: string;
};

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : NaN);
const within = (from: string | null | undefined, to: string | null | undefined) => {
  const a = ms(from);
  const b = ms(to);
  return Number.isFinite(a) && Number.isFinite(b) && b - a <= SLA_MS;
};
const olderThan = (iso: string | null | undefined, now: number) => {
  const t = ms(iso);
  return Number.isFinite(t) && now - t > SLA_MS;
};
const idsOf = (list: readonly RecruitAppFact[]) => list.map((f) => f.id).filter((v): v is string => Boolean(v));

export type ReleaseRow = { jobId: string | null; day: string; releasedAt: string | null; remaining: number; filled: number };

/**
 * ขั้นต่อขั้นจากข้อเท็จจริงของใบสมัคร (เดือนที่เลือก) + ใบขอที่เข้ามา
 * ขั้นที่ระบบยังไม่มีข้อมูลเวลา (จับคู่ · iRecruit/ERP · ติดตาม · ส่งคนแทน · ดูแล) = `missing`
 */
export function buildStageSla(facts: readonly RecruitAppFact[], requests: readonly ReleaseRow[], now: number): StageSla[] {
  const none = (key: StageKey, missing: string): StageSla => ({
    key,
    label: STAGES.find((s) => s.key === key)!.label,
    done: null,
    onTime: null,
    stuck: null,
    stuckIds: [],
    missing,
  });
  const stage = (key: StageKey, done: RecruitAppFact[], onTime: number, stuck: RecruitAppFact[]): StageSla => ({
    key,
    label: STAGES.find((s) => s.key === key)!.label,
    done: done.length,
    onTime,
    stuck: stuck.length,
    stuckIds: idsOf(stuck),
  });

  // ประกาศ: วันที่ใบเข้ามา (ไม่มีเวลา) → ประกาศภายในวันถัดไป
  const released = requests.filter((r) => r.releasedAt);
  const releaseOnTime = released.filter((r) => ms(r.releasedAt) - Date.parse(`${r.day}T00:00:00+07:00`) <= 2 * 86_400_000).length;
  const releaseStuck = requests.filter((r) => !r.releasedAt && r.remaining > 0 && now - Date.parse(`${r.day}T00:00:00+07:00`) > 2 * 86_400_000).length;
  const release: StageSla = {
    key: 'release',
    label: 'ประกาศหาคน',
    done: released.length,
    onTime: releaseOnTime,
    stuck: releaseStuck,
    stuckIds: [],
  };

  // ใบที่ดึงจาก iRecruit AI ไม่โทรเอง (กติกาใบซ้ำ/นำเข้า) — ไม่นับเป็นงานค้างของ AI
  const callable = facts.filter((f) => f.phoneOk && !f.overAge && !isFromIrecruit(f));
  const aiCalled = callable.filter((f) => f.calledByAi && f.firstCalledAt);
  const aiStuck = callable.filter((f) => !f.calledByAi && !f.calledByStaff && olderThan(f.createdAt, now));

  const yes = facts.filter((f) => f.aiAnswer === 'said_yes');
  const followed = yes.filter((f) => f.staffLastAt && f.aiAnswerAt && f.staffLastAt >= f.aiAnswerAt);
  const staffStuck = yes.filter((f) => !followed.includes(f) && olderThan(f.aiAnswerAt, now));

  const reached = facts.filter((f) => f.logOk === true);
  const booked = reached.filter((f) => f.appointmentAt);
  const apptStuck = reached.filter((f) => !f.appointmentAt && !f.appointmentFailed && olderThan(f.logAt, now));

  const due = booked.filter((f) => ms(f.appointmentAt) < now);
  const recorded = due.filter((f) => f.attendance === 'showed' || f.attendance === 'no_show');
  const attendStuck = due.filter((f) => !recorded.includes(f) && olderThan(f.appointmentAt, now));

  const showed = facts.filter((f) => f.attendance === 'showed');
  const screened = showed.filter((f) => f.screening === 'passed' || f.screening === 'not_passed');

  // ขั้น 8 (20 ต.ค. 2569): คนที่มาตามนัดต้องไปโผล่เป็นผู้สมัครใน iRecruit (จับด้วยเบอร์) · ทัน = ภายในวันถัดจากวันนัด
  const irecruitKnown = facts.some((f) => f.irecruitAt !== undefined);
  const keyed = showed.filter((f) => f.irecruitAt);
  const keyedOnTime = keyed.filter((f) => {
    const appt = ms(f.appointmentAt);
    return Number.isFinite(appt) && Date.parse(`${f.irecruitAt}T00:00:00+07:00`) <= appt + SLA_MS;
  });
  const keyStuck = showed.filter((f) => f.irecruitAt === null && olderThan(f.appointmentAt, now));

  return [
    none('match', 'ยังไม่จดเวลาที่จับคู่ได้'),
    release,
    stage('aiCall', aiCalled, aiCalled.filter((f) => within(f.createdAt, f.firstCalledAt)).length, aiStuck),
    stage('staffCall', followed, followed.filter((f) => within(f.aiAnswerAt, f.staffLastAt)).length, staffStuck),
    stage('appointment', booked, booked.filter((f) => within(f.aiAnswerAt ?? f.createdAt, f.logAt)).length, apptStuck),
    // มา/ไม่มา: ทัน = ลงผลแล้ว (ยังไม่มีเวลาที่ลงผล) · ค้าง = เลยวันนัดเกิน 24 ชม. ยังไม่ลง
    stage('attendance', due, recorded.length, attendStuck),
    stage('screening', showed, screened.length, showed.filter((f) => !screened.includes(f))),
    irecruitKnown
      ? { ...stage('inform', keyed, keyedOnTime.length, keyStuck), done: keyed.length }
      : none('inform', 'อ่านผู้สมัครใน iRecruit ไม่ได้'),
    none('follow', 'หน้าติดตามยังไม่ผูกกับใบสมัคร'),
    none('replace', 'ยังไม่จดเวลาที่ต้องหาคนแทน'),
    none('aftercare', 'ยังไม่จดเวลาที่ควรโทรกับที่โทรจริงเทียบกัน'),
  ];
}

/** % ทันเป้า · ยังไม่มีข้อมูล/ไม่มีราย = null */
export function onTimePct(s: Pick<StageSla, 'done' | 'onTime'>): number | null {
  if (s.done == null || s.onTime == null || s.done === 0) return null;
  return Math.round((s.onTime / s.done) * 100);
}

/** ค้างอยู่ที่ใคร — นับใบสมัครที่ค้างเกิน 24 ชม. ตามเจ้าของงานของใบขอ (ไม่มี = "ยังไม่มีเจ้าของ") */
export const NO_OWNER = 'ยังไม่มีเจ้าของ';
export function stuckByOwner(
  stages: readonly StageSla[],
  facts: readonly RecruitAppFact[],
  ownerOfJob: ReadonlyMap<string, string>,
): Array<{ owner: string; stuck: number }> {
  const jobOf = new Map(facts.map((f) => [f.id ?? '', f.jobId]));
  const counts = new Map<string, number>();
  for (const s of stages) {
    for (const id of s.stuckIds) {
      const job = jobOf.get(id);
      const owner = (job && ownerOfJob.get(job)) || NO_OWNER;
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([owner, stuck]) => ({ owner, stuck }))
    .sort((a, b) => b.stuck - a.stuck || a.owner.localeCompare(b.owner, 'th'));
}
