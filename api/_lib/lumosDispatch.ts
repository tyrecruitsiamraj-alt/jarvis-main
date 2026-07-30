/**
 * Lumos outbound dispatch — คิวส่งข้อมูลให้ Lumos
 *
 * เส้นทางข้อมูล (ตามที่ตกลงกับเจ้าของระบบ):
 *   1. AI match "คนของเรา" เสร็จ (ใบขอ A ได้ N คน) → enqueue channel "reminder"
 *      → Lumos ดึงไปโทรตาม/แจ้งงานผ่าน GET /api/lumos/reminder/contacts
 *   2. กด "ค้นหา iRecruit" ในหน้า matching → enqueue channel "interview"
 *      → Lumos ดึงไปให้ AI โทรสัมภาษณ์ผ่าน GET /api/lumos/interview/candidates
 *
 * ทุก enqueue กันซ้ำด้วย unique (channel, job_ref, person_ref) — คนเดิมในใบเดิมส่งครั้งเดียว
 * และห้าม throw ออกไปทำ flow หลัก (matching) พัง — log แล้วไปต่อ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logInfo, logError } from './logger.js';
import type { BoardMatchResult } from './boardCandidateMatcher.js';
import type { IrecruitMatchResult } from './irecruitCandidateMatcher.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

// ─── Utils ────────────────────────────────────────────────────────────────────

/** เบอร์ไทย → E.164 (+66…) — คืน null ถ้าแปลงไม่ได้ (Lumos ต้องการ E.164 เท่านั้น) */
export function toE164Thai(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('66') && digits.length === 11) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+66${digits.slice(1)}`;
  return null;
}

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
  result: Pick<BoardMatchResult, 'jobId' | 'request_no' | 'job_family_label'>,
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
  result: Pick<IrecruitMatchResult, 'jobId' | 'request_no' | 'job_family_label'>,
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

// ─── Enqueue (เรียกจาก flow matching — ห้ามพังงานหลัก) ───────────────────────

async function insertQueueItems(
  channel: 'reminder' | 'interview',
  jobRef: string,
  items: Array<{ personRef: string; payload: unknown }>,
): Promise<number> {
  let added = 0;
  for (const item of items) {
    const { rows } = await dbQuery<{ id: number }>(
      `insert into ${queueTable} (channel, job_ref, person_ref, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (channel, job_ref, person_ref) do nothing
       returning id`,
      [channel, jobRef, item.personRef, JSON.stringify(item.payload)],
    );
    added += rows.length;
  }
  return added;
}

/** ผล AI match "คนของเรา" (green/yellow) → คิว reminder */
export async function enqueueLumosReminderForBoardMatch(
  job: Record<string, unknown>,
  result: BoardMatchResult,
): Promise<void> {
  try {
    const items = result.matches
      .filter((m) => m.tier === 'green' || m.tier === 'yellow')
      .map((m) => {
        const payload = buildReminderPayload(job, result, m);
        return payload ? { personRef: `card-${m.card_id}`, payload } : null;
      })
      .filter((x): x is { personRef: string; payload: LumosReminderPayload } => x !== null);
    if (items.length === 0) return;
    const added = await insertQueueItems('reminder', result.jobId, items);
    if (added > 0) logInfo('lumos.dispatch.reminder', { jobId: result.jobId, added, matched: items.length });
  } catch (e) {
    logError('lumos.dispatch.reminder.fail', { jobId: result.jobId, message: e instanceof Error ? e.message : String(e) });
  }
}

/** ผลกดค้นหา iRecruit (green/yellow) → คิว interview */
export async function enqueueLumosInterviewForIrecruit(
  job: Record<string, unknown>,
  result: IrecruitMatchResult,
): Promise<void> {
  try {
    const items = result.matches
      .filter((m) => m.tier === 'green' || m.tier === 'yellow')
      .map((m) => {
        const payload = buildInterviewPayload(job, result, m);
        return payload ? { personRef: `ir-${m.id}`, payload } : null;
      })
      .filter((x): x is { personRef: string; payload: LumosInterviewPayload } => x !== null);
    if (items.length === 0) return;
    const added = await insertQueueItems('interview', result.jobId, items);
    if (added > 0) logInfo('lumos.dispatch.interview', { jobId: result.jobId, added, matched: items.length });
  } catch (e) {
    logError('lumos.dispatch.interview.fail', { jobId: result.jobId, message: e instanceof Error ? e.message : String(e) });
  }
}

// ─── Serve + result (เรียกจาก lumos endpoints) ───────────────────────────────

/** ดึงรายการ pending แล้ว mark delivered ในจังหวะเดียว (Lumos poll ซ้ำจะไม่ได้ของเดิมซ้ำ) */
export async function takePendingLumosItems(
  channel: 'reminder' | 'interview',
  limit: number,
): Promise<unknown[]> {
  const { rows } = await dbQuery<{ payload: unknown }>(
    `update ${queueTable} q
        set status = 'delivered', delivered_at = now(), updated_at = now()
      where q.id in (
        select id from ${queueTable}
         where channel = $1 and status = 'pending'
         order by created_at asc
         limit $2
         for update skip locked
      )
      returning q.payload`,
    [channel, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => r.payload);
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
  return rows.length > 0;
}
