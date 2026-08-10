/**
 * Lumos outbound dispatch — คิวส่งข้อมูลให้ Lumos
 *
 * เส้นทางข้อมูล:
 *   1. AI match "คนของเรา" เสร็จ → enqueue channel "reminder" **อัตโนมัติ** (green/yellow)
 *      → Lumos ดึงไปโทรตาม/แจ้งงานผ่าน GET /api/lumos/reminder/contacts
 *   2. กด "ค้นหา iRecruit" → enqueue channel "interview" **อัตโนมัติ** (green/yellow)
 *      → Lumos ดึงไปให้ AI โทรสัมภาษณ์ผ่าน GET /api/lumos/interview/candidates
 *   3. หน้า Follow — คนกรอกรายชื่อเอง → enqueue channel "reminder"
 *   4. **ส่งเองแบบเลือก** (POST /api/lumos/dispatch) — ใช้ตอนมีคนเพิ่มเข้ามาทีหลัง
 *      หรืออยากดันคนที่ auto ไม่ส่ง (เช่น tier red) เข้าคิวทันทีเพราะใบขอด่วน
 *
 * auto-send กับส่งเองใช้ตรรกะ enqueue ตัวเดียวกัน ต่างกันแค่ใครเลือกและการรายงานผล:
 *   - auto  = เลือกให้เอง (green/yellow) · error กลืน (ห้ามทำ flow matching พัง)
 *   - ส่งเอง = คนติ๊กเลือก · throw/คืนผลให้ผู้ใช้รู้ว่าเข้าคิวจริงไหม
 *
 * ทุก enqueue กันซ้ำด้วย unique (channel, job_ref, person_ref) — คนเดิมในใบเดิมส่งครั้งเดียว
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logInfo, logError } from './logger.js';
import { applyCallFollowupToQueueRow, listSuppressedPhones } from './callFollowup.js';
import { releaseDueCallBatches } from './callBatchStore.js';
import type { BoardMatchResult } from './boardCandidateMatcher.js';
import type { IrecruitMatchResult } from './irecruitCandidateMatcher.js';
import { listHeldPhones } from './candidateCallHolds.js';
import { toE164Thai } from './thaiPhone.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  shiftOutOfQuietHours,
} from '../../src/lib/callFollowupPolicy.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

// ─── Utils ────────────────────────────────────────────────────────────────────

/** re-export ให้ผู้ใช้เดิมไม่พัง — ตัวจริงอยู่ที่ ./thaiPhone.ts (ตัดวง import กับ callHolds) */
export { toE164Thai };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** ป้ายตำแหน่งจากใบขอ — ใช้ในข้อความ/คำถามที่ส่งให้ Lumos */
export function jobPositionLabel(job: Record<string, unknown>, familyLabel?: string | null): string {
  const parts = [str(job.job_description_code_1), str(job.job_description_code_2)]
    .filter((v) => v && v !== 'ไม่ระบุ');
  return parts.join(' ') || str(job.staff_title_name) || (familyLabel || '').trim() || 'ตามใบขอ';
}

// ─── Payload builders (pure — มี unit test) ──────────────────────────────────

export type LumosReminderPayload = {
  client_contact_id: string;
  recipient_name: string;
  recipient_phone: string;
  title: string;
  language: string;
  tone: string;
  steps: Array<{ type: 'remind' | 'follow_up' | 'confirmation'; message: string; scheduled_at: string }>;
};

export function buildReminderPayload(
  job: Record<string, unknown>,
  result: Pick<BoardMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  match: { card_id: number; full_name: string; mobile: string | null },
  now = new Date(),
): LumosReminderPayload | null {
  const phone = toE164Thai(match.mobile);
  if (!phone || !match.full_name) return null;
  const position = jobPositionLabel(job, result.job_family_label);
  const unit = str(job.unit_name) || 'หน่วยงานของเรา';
  const income = Number(job.total_income) > 0 ? ` รายได้ ${Number(job.total_income).toLocaleString('th-TH')} บาท` : '';
  const requiredDate = str(job.required_date);
  const start = requiredDate ? ` เริ่มงาน ${requiredDate}` : '';
  return {
    client_contact_id: `${result.jobId}::card-${match.card_id}`,
    recipient_name: match.full_name,
    recipient_phone: phone,
    title: `แจ้งงาน ${position} — ${unit}`,
    language: 'th',
    tone: 'professional',
    steps: [
      {
        type: 'remind',
        message:
          `ระบบคัดเลือกพบว่าคุณเหมาะกับงานตำแหน่ง${position} ที่ ${unit}` +
          `${start}${income} (ใบขอ ${result.request_no || result.jobId})` +
          ' หากสนใจ ทีมสรรหาจะติดต่อนัดหมายรายละเอียดต่อไป',
        scheduled_at: now.toISOString(),
      },
    ],
  };
}

export type LumosInterviewPayload = {
  client_candidate_id: string;
  client_interview_id: string;
  candidate_name: string;
  phone: string;
  position: string;
  scheduled_at: string;
  questions: string[];
  type: string;
  language: string;
  tone: string;
  skills?: string[];
};

export function buildInterviewPayload(
  job: Record<string, unknown>,
  result: Pick<IrecruitMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  match: { id: number; full_name: string; phone_number: string | null; job_name_th: string | null; position_name: string | null },
  now = new Date(),
): LumosInterviewPayload | null {
  const phone = toE164Thai(match.phone_number);
  if (!phone || !match.full_name) return null;
  const position = jobPositionLabel(job, result.job_family_label);
  const unit = str(job.unit_name) || 'หน่วยงานของเรา';
  const skills = [match.job_name_th, match.position_name]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  return {
    client_candidate_id: `${result.jobId}::ir-${match.id}`,
    client_interview_id: `${result.jobId}::ir-${match.id}::interview`,
    candidate_name: match.full_name,
    phone,
    position,
    scheduled_at: now.toISOString(),
    questions: [
      `เคยทำงานตำแหน่ง${position}หรืองานใกล้เคียงมาก่อนไหม เล่าประสบการณ์ให้ฟังหน่อยครับ`,
      `สะดวกเดินทางไปทำงานที่ ${unit} ไหมครับ`,
      'สามารถเริ่มงานได้เร็วที่สุดเมื่อไหร่ครับ',
      'ค่าแรงหรือเงินเดือนที่คาดหวังประมาณเท่าไหร่ครับ',
    ],
    type: 'phone',
    language: 'th',
    tone: 'professional',
    ...(skills.length ? { skills } : {}),
  };
}

// ─── Enqueue (คนกดส่งเอง — ต้องรายงานผลกลับให้ผู้ใช้) ───────────────────────

/** อ่านเบอร์ผู้รับออกจาก payload — ใช้เทียบกับล็อก "รับไปโทรเอง" */
function payloadPhone(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = (payload as Record<string, unknown>).recipient_phone;
  return typeof p === 'string' && p.trim() ? p.trim() : null;
}

/**
 * insert คิว — คืน ref ที่เข้าคิวใหม่จริง (`added`) กับ ref ที่ไม่ส่งเพราะคนถือไปโทรเอง (`held`)
 *
 * **คอขวดเดียวของการเข้าคิวทุกเส้น** (auto / คนติ๊กเลือก / หน้า Follow) — กรองล็อกที่นี่
 * ที่เดียวจึงครอบทุกทางเข้า: เบอร์ที่เจ้าหน้าที่กด "รับไปโทรเอง" ไว้ AI จะไม่แตะ
 * ตารางล็อกยังไม่ถูก migrate ก็ไม่พัง — listHeldPhones() คืนเซ็ตว่าง
 */
async function insertQueueItems(
  channel: 'reminder' | 'interview',
  jobRef: string,
  items: Array<{ personRef: string; payload: unknown }>,
): Promise<{ added: string[]; held: string[]; suppressed: string[] }> {
  const added: string[] = [];
  const held: string[] = [];
  const suppressed: string[] = [];
  if (items.length === 0) return { added, held, suppressed };

  let heldPhones: Set<string>;
  try {
    heldPhones = await listHeldPhones();
  } catch {
    // อ่านล็อกไม่ได้ = ไม่กรอง ดีกว่าหยุดส่งงานทั้งระบบ (เสี่ยงโทรซ้ำ < เสี่ยงงานไม่วิ่ง)
    heldPhones = new Set();
  }

  // เบอร์ที่ถูกพัก ("ไม่หางานแล้ว" / เบอร์เสีย) — ห้ามโทรอีกไม่ว่าจากใบขอไหน
  // อันนี้ต่างจากล็อก: ถ้าอ่านไม่ได้ต้อง **ไม่ส่ง** ดีกว่าเผลอโทรคนที่บอกว่าเลิกหางานแล้ว
  let suppressedPhones: Set<string> | null;
  try {
    suppressedPhones = await listSuppressedPhones();
  } catch {
    suppressedPhones = null;
  }

  // "โทรได้ช่วงกี่โมง" ต้องมีผลกับ **ของใหม่** ด้วย ไม่ใช่แค่โทรซ้ำ — เดิมคิวใหม่
  // ไม่มี next_attempt_at ทำให้งานที่กดส่งตอน 19:55 ถูก Lumos หยิบไปโทรตอน 21:00 ได้
  // ตั้งเวลาให้พ้นช่วงห้ามโทรตั้งแต่ตอนเข้าคิว (takePendingLumosItems กรองคอลัมน์นี้อยู่แล้ว)
  // อ่านนโยบายไม่ได้ = ใช้ค่าเริ่มต้น (ห้ามโทร 20:00–08:00) — เข้มไว้ก่อน ปลอดภัยกว่า
  let nextAttemptAt: string | null = null;
  try {
    const policy = await getCallFollowupPolicy().catch(() => DEFAULT_CALL_FOLLOWUP_POLICY);
    const now = new Date();
    const shifted = shiftOutOfQuietHours(now, policy);
    if (shifted.getTime() > now.getTime()) nextAttemptAt = shifted.toISOString();
  } catch {
    nextAttemptAt = null;
  }

  for (const item of items) {
    const phone = payloadPhone(item.payload);
    if (phone) {
      if (heldPhones.has(phone)) {
        held.push(item.personRef);
        continue;
      }
      if (suppressedPhones === null) {
        // อ่านรายการพักเบอร์ไม่ได้ → กันไว้ก่อน (นับเป็น held เพื่อให้รายงานบอกว่ายังไม่ส่ง)
        held.push(item.personRef);
        continue;
      }
      if (suppressedPhones.has(phone)) {
        suppressed.push(item.personRef);
        continue;
      }
    }
    const { rows } = await dbQuery<{ id: number }>(
      `insert into ${queueTable} (channel, job_ref, person_ref, payload, next_attempt_at)
       values ($1, $2, $3, $4::jsonb, $5)
       on conflict (channel, job_ref, person_ref) do nothing
       returning id`,
      [channel, jobRef, item.personRef, JSON.stringify(item.payload), nextAttemptAt],
    );
    if (rows.length > 0) added.push(item.personRef);
  }
  return { added, held, suppressed };
}

export type LumosDispatchOutcome = {
  /** เข้าคิวใหม่สำเร็จกี่คน */
  queued: number;
  /** เคยส่งคนนี้ในใบขอนี้ไปแล้ว — ไม่ส่งซ้ำ */
  duplicated: string[];
  /** ส่งไม่ได้ พร้อมเหตุผล (เช่น ไม่มีเบอร์มือถือที่แปลงเป็น E.164 ได้) */
  skipped: Array<{ ref: string; name: string; reason: string }>;
};

const NO_PHONE_REASON = 'ไม่มีเบอร์มือถือที่ใช้โทรได้ (ต้องเป็นมือถือ 10 หลัก)';
const HELD_REASON = 'เจ้าหน้าที่รับไปโทรเองอยู่ — AI ไม่โทรทับ';
const SUPPRESSED_REASON = 'เบอร์นี้ถูกพักอยู่ (แจ้งว่าไม่หางานแล้ว / เบอร์เสีย)';

/** ผู้สมัคร "คนของเรา" ที่คนติ๊กเลือก → คิว reminder */
export async function enqueueLumosReminderForSelected(
  job: Record<string, unknown>,
  result: Pick<BoardMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  selected: Array<{ card_id: number; full_name: string; mobile: string | null }>,
): Promise<LumosDispatchOutcome> {
  const skipped: LumosDispatchOutcome['skipped'] = [];
  const items: Array<{ personRef: string; payload: LumosReminderPayload }> = [];
  for (const m of selected) {
    const payload = buildReminderPayload(job, result, m);
    if (!payload) {
      skipped.push({ ref: `card-${m.card_id}`, name: m.full_name, reason: NO_PHONE_REASON });
      continue;
    }
    items.push({ personRef: `card-${m.card_id}`, payload });
  }
  const { added, held, suppressed } = await insertQueueItems('reminder', result.jobId, items);
  const addedSet = new Set(added);
  const heldSet = new Set(held);
  const nameByRef = new Map(selected.map((m) => [`card-${m.card_id}`, m.full_name]));
  for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
  for (const ref of suppressed) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
  }
  const duplicated = items
    .map((i) => i.personRef)
    .filter((ref) => !addedSet.has(ref) && !heldSet.has(ref));
  logInfo('lumos.dispatch.reminder.manual', {
    jobId: result.jobId,
    requested: selected.length,
    queued: added.length,
    duplicated: duplicated.length,
    held: held.length,
    suppressed: suppressed.length,
    skipped: skipped.length,
  });
  return { queued: added.length, duplicated, skipped };
}

/** ผู้สมัครจากฐาน iRecruit ที่คนติ๊กเลือก → คิว interview */
export async function enqueueLumosInterviewForSelected(
  job: Record<string, unknown>,
  result: Pick<IrecruitMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  selected: Array<{
    id: number;
    full_name: string;
    phone_number: string | null;
    job_name_th: string | null;
    position_name: string | null;
  }>,
): Promise<LumosDispatchOutcome> {
  const skipped: LumosDispatchOutcome['skipped'] = [];
  const items: Array<{ personRef: string; payload: LumosInterviewPayload }> = [];
  for (const m of selected) {
    const payload = buildInterviewPayload(job, result, m);
    if (!payload) {
      skipped.push({ ref: `ir-${m.id}`, name: m.full_name, reason: NO_PHONE_REASON });
      continue;
    }
    items.push({ personRef: `ir-${m.id}`, payload });
  }
  const { added, held, suppressed } = await insertQueueItems('interview', result.jobId, items);
  const addedSet = new Set(added);
  const heldSet = new Set(held);
  const nameByRef = new Map(selected.map((m) => [`ir-${m.id}`, m.full_name]));
  for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
  for (const ref of suppressed) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
  }
  const duplicated = items
    .map((i) => i.personRef)
    .filter((ref) => !addedSet.has(ref) && !heldSet.has(ref));
  logInfo('lumos.dispatch.interview.manual', {
    jobId: result.jobId,
    requested: selected.length,
    queued: added.length,
    duplicated: duplicated.length,
    held: held.length,
    suppressed: suppressed.length,
    skipped: skipped.length,
  });
  return { queued: added.length, duplicated, skipped };
}

// ─── Auto-send (เรียกจาก flow matching — ห้ามพังงานหลัก) ─────────────────────
// ใช้ตรรกะเดียวกับเส้นที่คนกดเอง เพียงแต่เลือกให้อัตโนมัติ (green/yellow) และกลืน error

/** ผล AI match "คนของเรา" (green/yellow) → คิว reminder อัตโนมัติ */
export async function enqueueLumosReminderForBoardMatch(
  job: Record<string, unknown>,
  result: BoardMatchResult,
): Promise<void> {
  try {
    const auto = result.matches.filter((m) => m.tier === 'green' || m.tier === 'yellow');
    if (auto.length === 0) return;
    const outcome = await enqueueLumosReminderForSelected(job, result, auto);
    if (outcome.queued > 0) {
      logInfo('lumos.dispatch.reminder.auto', {
        jobId: result.jobId,
        queued: outcome.queued,
        matched: auto.length,
      });
    }
  } catch (e) {
    logError('lumos.dispatch.reminder.fail', {
      jobId: result.jobId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

/** ผลกดค้นหา iRecruit (green/yellow) → คิว interview อัตโนมัติ */
export async function enqueueLumosInterviewForIrecruit(
  job: Record<string, unknown>,
  result: IrecruitMatchResult,
): Promise<void> {
  try {
    const auto = result.matches.filter((m) => m.tier === 'green' || m.tier === 'yellow');
    if (auto.length === 0) return;
    const outcome = await enqueueLumosInterviewForSelected(job, result, auto);
    if (outcome.queued > 0) {
      logInfo('lumos.dispatch.interview.auto', {
        jobId: result.jobId,
        queued: outcome.queued,
        matched: auto.length,
      });
    }
  } catch (e) {
    logError('lumos.dispatch.interview.fail', {
      jobId: result.jobId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

// ─── สถานะการโทรต่อคน (ระดับ 1: badge ในการ์ด Matching) ──────────────────────

export type LumosCallStatusRow = {
  channel: 'reminder' | 'interview';
  /** 'card-<id>' สำหรับคนของเรา · 'ir-<id>' สำหรับผู้สมัคร iRecruit */
  person_ref: string;
  status: 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';
  outcome: string | null;
  summary: string | null;
  delivery_count: number;
  sent_at: string;
  updated_at: string;
};

type QueueStatusSqlRow = {
  channel: string;
  person_ref: string;
  status: string;
  outcome: string | null;
  summary: string | null;
  delivery_count: number;
  created_at: string | Date;
  updated_at: string | Date;
};

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : String(v));

/** สถานะ+ผลการโทรของทุกคนที่ส่งไปแล้วในใบขอนี้ (ทั้ง 2 เส้น) */
export async function listLumosCallStatusForJob(jobId: string): Promise<LumosCallStatusRow[]> {
  const { rows } = await dbQuery<QueueStatusSqlRow>(
    `select channel, person_ref, status, delivery_count, created_at, updated_at,
            result->>'outcome' as outcome,
            result->>'summary' as summary
       from ${queueTable}
      where job_ref = $1
      order by created_at asc`,
    [jobId],
  );
  return rows.map((r) => ({
    channel: r.channel === 'interview' ? 'interview' : 'reminder',
    person_ref: r.person_ref,
    status: (['pending', 'delivered', 'completed', 'failed', 'cancelled'] as const).includes(
      r.status as 'pending',
    )
      ? (r.status as LumosCallStatusRow['status'])
      : 'pending',
    outcome: r.outcome,
    summary: r.summary,
    delivery_count: Number(r.delivery_count) || 0,
    sent_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }));
}

// ─── สรุปผลโทรต่อใบขอ (โชว์ข้างการ์ดในลิสต์ Matching) ────────────────────────

export type LumosJobCallSummary = {
  /** ส่งเข้าคิวแล้ว (ไม่นับที่ถูกยกเลิก) */
  sent: number;
  /** มีผลโทรกลับมาจริง (ไม่นับที่ Lumos ยกเลิกสายเอง) */
  called: number;
  confirmed: number;
  declined: number;
  no_answer: number;
};

type JobSummarySqlRow = {
  job_ref: string;
  sent: string;
  called: string;
  confirmed: string;
  declined: string;
  no_answer: string;
};

/** รวมผลคิว Lumos ต่อใบขอในคำสั่งเดียว — เฉพาะเส้นใบขอ (ไม่รวมหน้า Follow) */
export async function loadLumosJobCallSummaryMap(): Promise<Map<string, LumosJobCallSummary>> {
  const map = new Map<string, LumosJobCallSummary>();
  const { rows } = await dbQuery<JobSummarySqlRow>(
    `select job_ref,
            count(*) filter (where status <> 'cancelled')                                        as sent,
            count(*) filter (where result is not null
                               and coalesce(result->>'outcome', '') <> 'cancelled')             as called,
            count(*) filter (where result->>'outcome' = 'confirmed')                            as confirmed,
            count(*) filter (where result->>'outcome' = 'declined')                             as declined,
            count(*) filter (where result->>'outcome' in ('no_answer', 'unresponsive'))         as no_answer
       from ${queueTable}
      where job_ref <> 'follow'
      group by job_ref`,
  );
  for (const r of rows) {
    map.set(r.job_ref, {
      sent: Number(r.sent) || 0,
      called: Number(r.called) || 0,
      confirmed: Number(r.confirmed) || 0,
      declined: Number(r.declined) || 0,
      no_answer: Number(r.no_answer) || 0,
    });
  }
  return map;
}

/** ยกเลิกรายการที่ส่งผิด — ได้ผลเฉพาะที่ยังไม่มีผลกลับ */
export async function cancelLumosQueueItem(
  jobId: string,
  channel: 'reminder' | 'interview',
  personRef: string,
): Promise<boolean> {
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set status = 'cancelled', updated_at = now()
      where job_ref = $1 and channel = $2 and person_ref = $3
        and result is null and status in ('pending', 'delivered')
      returning id`,
    [jobId, channel, personRef],
  );
  return rows.length > 0;
}

// ─── Follow (คนกรอกรายชื่อเองในหน้า Follow) ─────────────────────────────────

export type FollowEntryInput = {
  id: string;
  recipient_name: string;
  /** E.164 แล้ว (handler validate ก่อนเรียก) */
  recipient_phone: string;
  topic: string;
  note?: string | null;
  scheduled_at: Date;
};

export function buildFollowReminderPayload(entry: FollowEntryInput): LumosReminderPayload {
  const note = (entry.note || '').trim();
  return {
    client_contact_id: `follow::${entry.id}`,
    recipient_name: entry.recipient_name,
    recipient_phone: entry.recipient_phone,
    title: entry.topic,
    language: 'th',
    tone: 'professional',
    steps: [
      {
        type: 'follow_up',
        message: note ? `${entry.topic} — ${note}` : entry.topic,
        scheduled_at: entry.scheduled_at.toISOString(),
      },
    ],
  };
}

/** รายชื่อ Follow ที่คนกรอก → คิว reminder (throw ให้ handler จัดการ เพราะผู้ใช้ต้องรู้ว่าเข้าคิวไหม) */
export async function enqueueFollowReminder(entry: FollowEntryInput): Promise<void> {
  const { added, held, suppressed } = await insertQueueItems('reminder', 'follow', [
    { personRef: `follow-${entry.id}`, payload: buildFollowReminderPayload(entry) },
  ]);
  logInfo('lumos.dispatch.follow', { followId: entry.id, added, held, suppressed });
}

/** ยกเลิกรายการ Follow ในคิว — ได้ผลเฉพาะที่ Lumos ยังไม่ดึงไป (pending) */
export async function cancelFollowReminder(followId: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set status = 'cancelled', updated_at = now()
      where channel = 'reminder' and job_ref = 'follow'
        and person_ref = $1 and status = 'pending'
      returning id`,
    [`follow-${followId}`],
  );
  return rows.length > 0;
}

// ─── Serve + result (เรียกจาก lumos endpoints) ───────────────────────────────

/**
 * Lumos spec บังคับ scheduled_at ต้องเป็น "now or future" — ถ้าเวลาที่เก็บไว้เลยมาแล้ว
 * (เช่น เข้าคิวก่อน Lumos มาดึงหลายนาที) ให้ขยับไปอนาคตเล็กน้อย ณ ตอนเสิร์ฟ
 * มิฉะนั้นฝั่ง Lumos จะปัดรายการทิ้งตอน ingest แบบเงียบ ๆ
 */
export function bumpScheduledAtForward(payload: unknown, now = new Date()): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  const p = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const floor = new Date(now.getTime() + 2 * 60_000).toISOString();
  const bump = (v: unknown): string | unknown => {
    if (typeof v !== 'string' || !v) return floor;
    const t = new Date(v);
    return Number.isNaN(t.getTime()) || t.getTime() < now.getTime() ? floor : v;
  };
  if ('scheduled_at' in p) p.scheduled_at = bump(p.scheduled_at);
  if (Array.isArray(p.steps)) {
    p.steps = p.steps.map((s) =>
      typeof s === 'object' && s !== null
        ? { ...(s as Record<string, unknown>), scheduled_at: bump((s as Record<string, unknown>).scheduled_at) }
        : s,
    );
  }
  return p;
}

const MAX_DELIVERIES = 5;
const REDELIVER_AFTER_MINUTES = 30;

/**
 * เสิร์ฟรายการให้ Lumos แบบ at-least-once:
 * - pending เสิร์ฟทันที · delivered ที่ยังไม่มีผลกลับเกิน 30 นาที เสิร์ฟซ้ำ (กันของหายเงียบ)
 * - หยุดถาวรเมื่อ Lumos POST ผลกลับ (completed/failed/cancelled) หรือครบ 5 ครั้ง
 */
export async function takePendingLumosItems(
  channel: 'reminder' | 'interview',
  limit: number,
): Promise<unknown[]> {
  // ชุดที่อนุมัติแล้วและพ้นช่วงถอนคำ → ปล่อยเข้าคิวก่อนเสิร์ฟ (แทน cron —
  // Lumos ดึงคิวเป็นระยะอยู่แล้ว) · ล้มก็ไม่กระทบการเสิร์ฟคิวเดิม
  try {
    await releaseDueCallBatches();
  } catch (e) {
    logError('call-batch.release.failed', e);
  }

  const { rows } = await dbQuery<{ payload: unknown }>(
    `update ${queueTable} q
        set status = 'delivered', delivered_at = now(), updated_at = now(),
            delivery_count = q.delivery_count + 1
      where q.id in (
        select id from ${queueTable}
         where channel = $1
           and result is null
           and delivery_count < ${MAX_DELIVERIES}
           -- นัดโทรซ้ำไว้แล้ว: ห้ามเสิร์ฟก่อนถึงเวลา (ดู api/_lib/callFollowup.ts)
           and (next_attempt_at is null or next_attempt_at <= now())
           and (
             status = 'pending'
             or (status = 'delivered' and delivered_at < now() - interval '${REDELIVER_AFTER_MINUTES} minutes')
           )
         order by created_at asc
         limit $2
         for update skip locked
      )
      returning q.payload`,
    [channel, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => bumpScheduledAtForward(r.payload));
}

/** ผูกผลจาก Lumos กลับเข้าคิว — หาแถวจาก client id ใน payload */
export async function applyLumosResult(
  channel: 'reminder' | 'interview',
  clientId: string,
  status: 'completed' | 'failed' | 'cancelled',
  result: unknown,
): Promise<boolean> {
  const idField = channel === 'reminder' ? 'client_contact_id' : 'client_candidate_id';
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set status = $3, result = $4::jsonb, updated_at = now()
      where channel = $1 and payload->>'${idField}' = $2
      returning id`,
    [channel, clientId, status, JSON.stringify(result ?? null)],
  );
  if (rows.length === 0) return false;

  // ได้ผลแล้วต้องมีคนทำอะไรต่อ — ไม่รับสายก็โทรซ้ำ ขอเลื่อนก็นัดใหม่ ครบเพดานก็ส่งให้คนตาม
  // เดิมจบแค่บันทึกผล งานเลยตายคาที่ · error ที่นี่ห้ามทำให้ ingest ล้ม (Lumos จะยิงซ้ำ)
  const outcome = readOutcome(result);
  if (outcome) {
    try {
      await applyCallFollowupToQueueRow({ queueId: rows[0].id, outcome, result });
    } catch (e) {
      logError('lumos.followup.failed', e, { queueId: rows[0].id, outcome });
    }
  }
  return true;
}

/** ดึง outcome ออกจากผลที่ Lumos ส่งมา (รูปแบบต่างกันเล็กน้อยระหว่าง 2 ช่อง) */
function readOutcome(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const r = result as Record<string, unknown>;
  return typeof r.outcome === 'string' && r.outcome.trim() ? r.outcome.trim() : null;
}
