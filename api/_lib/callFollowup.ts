/**
 * ลงมือทำตามนโยบายหลังได้ผลโทร — ตั้งคิวโทรซ้ำ / ตกถังต้องคนตาม / พักเบอร์
 *
 * ตรรกะการตัดสินใจอยู่ที่ src/lib/callFollowupPolicy.ts (pure + มีเทสต์ 25 เคส)
 * ไฟล์นี้แค่เอาคำตัดสินไปเขียนลง DB
 *
 * เรียกจาก 2 ทาง:
 *   1. Lumos POST ผลกลับมา  → applyLumosResult() ใน lumosDispatch.ts
 *   2. คนกดผลโทรเอง        → matching-call-holds.ts (PATCH)
 * ทั้งสองทางใช้ศัพท์ outcome ชุดเดียวกัน จึงเดินนโยบายเดียวกันได้
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  isCallOutcome,
  resolveCallFollowup,
  type CallFollowupDecision,
  type CallOutcome,
} from '../../src/lib/callFollowupPolicy.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const suppressionTable = tableInAppSchema('candidate_call_suppression');

/**
 * ดึงเวลาที่ผู้สมัครขอให้โทรกลับออกจากผลที่ Lumos ส่งมา
 * Lumos ใช้ชื่อฟิลด์ไม่นิ่ง (เจอทั้ง 3 แบบ) — รับทุกแบบไว้ก่อน
 */
export function pickRequestedCallbackAt(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const r = result as Record<string, unknown>;
  for (const key of ['requested_callback_at', 'callback_at', 'reschedule_at']) {
    const v = r[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  // บางทีซ้อนใน detail/summary object
  const nested = r.detail;
  if (typeof nested === 'object' && nested !== null) {
    const d = nested as Record<string, unknown>;
    for (const key of ['callbackAt', 'requested_callback_at', 'callback_at']) {
      const v = d[key];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
  }
  return null;
}

/** เบอร์นี้ถูกพักอยู่ไหม (ไม่หางานแล้ว / เบอร์เสีย) */
export async function isPhoneSuppressed(rawPhone: string | null | undefined): Promise<boolean> {
  const phone = toE164Thai(rawPhone);
  if (!phone) return false;
  try {
    const { rows } = await dbQuery<{ phone_e164: string }>(
      `select phone_e164 from ${suppressionTable}
        where phone_e164 = $1 and suppressed_until > now() limit 1`,
      [phone],
    );
    return rows.length > 0;
  } catch (e) {
    // ยังไม่ migrate = ไม่มีใครถูกพัก (พฤติกรรมเดิม)
    if (isPgUndefinedTable(e)) return false;
    throw e;
  }
}

/** เบอร์ที่ถูกพักทั้งชุด — ใช้กรองตอน enqueue หลายคนพร้อมกัน */
export async function listSuppressedPhones(): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const { rows } = await dbQuery<{ phone_e164: string }>(
      `select phone_e164 from ${suppressionTable} where suppressed_until > now()`,
    );
    for (const r of rows) out.add(r.phone_e164);
  } catch (e) {
    if (isPgUndefinedTable(e)) return out;
    throw e;
  }
  return out;
}

export async function suppressPhone(input: {
  phone: string | null | undefined;
  until: string;
  reason: 'not_looking' | 'wrong_number' | 'manual';
  note?: string | null;
  byName?: string | null;
}): Promise<boolean> {
  const phone = toE164Thai(input.phone);
  if (!phone) return false;
  try {
    await dbQuery(
      `insert into ${suppressionTable} (phone_e164, suppressed_until, reason, note, created_by_name)
       values ($1, $2::timestamptz, $3, $4, $5)
       on conflict (phone_e164) do update
         set suppressed_until = greatest(${suppressionTable}.suppressed_until, excluded.suppressed_until),
             reason = excluded.reason,
             note = coalesce(excluded.note, ${suppressionTable}.note),
             created_by_name = excluded.created_by_name`,
      [phone, input.until, input.reason, input.note ?? null, input.byName ?? null],
    );
    return true;
  } catch (e) {
    if (isPgUndefinedTable(e)) return false;
    throw e;
  }
}

type QueueRow = {
  id: number;
  attempt_count: number;
  payload: unknown;
};

function phoneFromPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_phone', 'candidate_phone', 'phone']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * เดินนโยบายกับแถวคิวหนึ่งแถว
 *
 * - retry       → ตั้งกลับเป็น pending + attempt_count +1 + next_attempt_at
 *                 (รีเซ็ต result/delivery_count ไม่งั้น takePendingLumosItems จะไม่หยิบ)
 * - needs_human → คงสถานะเดิม แต่ติดธง followup_state ให้หน้า Follow เห็น
 * - closed      → ปิดเรื่อง
 * - suppress    → ปิดเรื่อง + พักเบอร์
 *
 * คืน decision ที่ใช้ (null = ไม่มีแถวนั้น / outcome ไม่รู้จัก)
 */
export async function applyCallFollowupToQueueRow(input: {
  queueId: number;
  outcome: string;
  result?: unknown;
  declinedScope?: 'job' | 'all' | null;
  now?: Date;
}): Promise<CallFollowupDecision | null> {
  if (!isCallOutcome(input.outcome)) return null;

  let row: QueueRow | undefined;
  try {
    const { rows } = await dbQuery<QueueRow>(
      `select id, attempt_count, payload from ${queueTable} where id = $1 limit 1`,
      [input.queueId],
    );
    row = rows[0];
  } catch (e) {
    // คอลัมน์ attempt_count ยังไม่ถูก migrate → ข้ามการตามงานไปเลย (พฤติกรรมเดิม ไม่พัง)
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return null;
    throw e;
  }
  if (!row) return null;

  const decision = resolveCallFollowup({
    outcome: input.outcome as CallOutcome,
    attemptCount: Number(row.attempt_count) || 1,
    now: input.now ?? new Date(),
    requestedCallbackAt: pickRequestedCallbackAt(input.result),
    declinedScope: input.declinedScope ?? null,
    policy: DEFAULT_CALL_FOLLOWUP_POLICY,
  });

  try {
    if (decision.action === 'retry') {
      await dbQuery(
        `update ${queueTable}
            set status = 'pending', result = null, delivered_at = null, delivery_count = 0,
                attempt_count = attempt_count + 1,
                next_attempt_at = $2::timestamptz,
                last_outcome = $3, followup_state = 'retry_scheduled', updated_at = now()
          where id = $1`,
        [row.id, decision.nextAttemptAt, input.outcome],
      );
    } else {
      const state = decision.action === 'needs_human' ? 'needs_human' : 'closed';
      await dbQuery(
        `update ${queueTable}
            set last_outcome = $2, followup_state = $3, next_attempt_at = null, updated_at = now()
          where id = $1`,
        [row.id, input.outcome, state],
      );
    }
  } catch (e) {
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return null;
    throw e;
  }

  if (decision.action === 'suppress' && decision.suppressUntil) {
    await suppressPhone({
      phone: phoneFromPayload(row.payload),
      until: decision.suppressUntil,
      reason: 'not_looking',
      note: decision.reason,
    });
  }
  if (decision.action === 'needs_human' && input.outcome === 'wrong_person') {
    // เบอร์เสีย: พักไว้สั้น ๆ กัน AI วนโทรเบอร์เดิมระหว่างรอคนไปหาเบอร์ใหม่
    const until = new Date((input.now ?? new Date()).getTime() + 7 * 24 * 60 * 60 * 1000);
    await suppressPhone({
      phone: phoneFromPayload(row.payload),
      until: until.toISOString(),
      reason: 'wrong_number',
      note: decision.reason,
    });
  }

  return decision;
}

/**
 * ผลที่ "คน" กดเอง (หน้า Matching / โทรของฉัน) → เดินนโยบายเดียวกับผลของ AI
 *
 * ต่างจากทาง Lumos ตรงที่ไม่มีแถวคิวให้ผูกเสมอ (คนอาจโทรคนที่ไม่เคยเข้าคิว)
 * ถ้ามีแถวคิวของคู่ (job, person) อยู่ → อัปเดตแถวนั้นให้ต่อลูปได้
 * ถ้าไม่มี → ยังต้องพักเบอร์ให้ถูกเมื่อเขาบอกว่าไม่หางานแล้ว
 */
export async function applyHumanCallFollowup(input: {
  phone: string | null | undefined;
  jobId: string;
  candidateRef: string;
  outcome: string;
  declinedScope?: 'job' | 'all' | null;
  detail?: unknown;
  byName?: string | null;
  now?: Date;
}): Promise<CallFollowupDecision | null> {
  if (!isCallOutcome(input.outcome)) return null;
  const now = input.now ?? new Date();

  // หาแถวคิวของคู่ (ใบขอ, คน) ถ้ามี — person_ref ของฝั่งบอร์ดคือ card-<id>
  let queueId: number | null = null;
  let attemptCount = 1;
  try {
    const { rows } = await dbQuery<{ id: number; attempt_count: number }>(
      `select id, attempt_count from ${queueTable}
        where job_ref = $1 and person_ref like $2
        order by id desc limit 1`,
      [input.jobId, `%${input.candidateRef}`],
    );
    if (rows[0]) {
      queueId = rows[0].id;
      attemptCount = Number(rows[0].attempt_count) || 1;
    }
  } catch (e) {
    if (!isPgUndefinedTable(e) && !isUndefinedColumn(e)) throw e;
  }

  const decision = resolveCallFollowup({
    outcome: input.outcome as CallOutcome,
    attemptCount,
    now,
    requestedCallbackAt: pickRequestedCallbackAt(input.detail),
    declinedScope: input.declinedScope ?? null,
    policy: DEFAULT_CALL_FOLLOWUP_POLICY,
  });

  // มีแถวคิว → เขียนสถานะให้ลูปเดินต่อได้ (คนโทรไม่ติด AI รับช่วงโทรซ้ำได้)
  if (queueId != null) {
    try {
      if (decision.action === 'retry') {
        await dbQuery(
          `update ${queueTable}
              set status = 'pending', result = null, delivered_at = null, delivery_count = 0,
                  attempt_count = attempt_count + 1,
                  next_attempt_at = $2::timestamptz,
                  last_outcome = $3, followup_state = 'retry_scheduled', updated_at = now()
            where id = $1`,
          [queueId, decision.nextAttemptAt, input.outcome],
        );
      } else {
        const state = decision.action === 'needs_human' ? 'needs_human' : 'closed';
        await dbQuery(
          `update ${queueTable}
              set last_outcome = $2, followup_state = $3, next_attempt_at = null, updated_at = now()
            where id = $1`,
          [queueId, input.outcome, state],
        );
      }
    } catch (e) {
      if (!isPgUndefinedTable(e) && !isUndefinedColumn(e)) throw e;
    }
  }

  if (decision.action === 'suppress' && decision.suppressUntil) {
    await suppressPhone({
      phone: input.phone,
      until: decision.suppressUntil,
      reason: 'not_looking',
      note: decision.reason,
      byName: input.byName ?? null,
    });
  }
  if (decision.action === 'needs_human' && input.outcome === 'wrong_person') {
    await suppressPhone({
      phone: input.phone,
      until: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      reason: 'wrong_number',
      note: decision.reason,
      byName: input.byName ?? null,
    });
  }

  return decision;
}

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 070 */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === '42703'
  );
}

/** งานที่ AI เอาไม่อยู่ ต้องให้คนตาม — หน้า Follow อ่านจากนี่ */
export async function listNeedsHumanQueueItems(limit = 200): Promise<
  Array<{
    id: number;
    channel: string;
    jobRef: string;
    personRef: string;
    lastOutcome: string | null;
    attemptCount: number;
    updatedAt: string;
    payload: unknown;
  }>
> {
  try {
    const { rows } = await dbQuery<{
      id: number;
      channel: string;
      job_ref: string;
      person_ref: string;
      last_outcome: string | null;
      attempt_count: number;
      updated_at: string;
      payload: unknown;
    }>(
      `select id, channel, job_ref, person_ref, last_outcome, attempt_count, updated_at, payload
         from ${queueTable}
        where followup_state = 'needs_human'
        order by updated_at desc
        limit $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    return rows.map((r) => ({
      id: r.id,
      channel: r.channel,
      jobRef: r.job_ref,
      personRef: r.person_ref,
      lastOutcome: r.last_outcome,
      attemptCount: Number(r.attempt_count) || 1,
      updatedAt: r.updated_at,
      payload: r.payload,
    }));
  } catch (e) {
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return [];
    throw e;
  }
}
