/**
 * ═══ ตัวส่งซ้ำ/ตัวตามสายที่ไปไม่ถึง Lumos — ใบสมัคร · เลน Match · โทรซ้ำ (เจ้าของเคาะ 28–29 ก.ย. 2569) ═══
 *
 * ไล่พบ 28 ก.ย.: **Lumos ไม่มาดึงคิวเราแล้ว** (`delivery_count` 0 ทุกแถว) ทุกอย่างที่เคยพึ่งการดึงคิวจึงตายเงียบ:
 * push ล้มครั้งเดียว = ค้างถาวร · โทรซ้ำหลังไม่รับสายไม่เคยถูกโทรจริง · ชุดโทรที่อนุมัติไม่ถูกปล่อย
 *
 * Choice ที่เจ้าของเลือก:
 * - *"ตัวส่งซ้ำแบบงานติดตาม — จดว่าส่งไม่ถึง แล้วลองใหม่ทุกนาทีจนถึง (รหัสเดิม ไม่เกิดสายซ้อน) · เกิน 24 ชม. ยังไม่ถึง
 *   = เลิกส่ง AI แล้วขึ้นให้เจ้าหน้าที่โทรเอง"* · เลน Match: *"ถ้าอันไหนให้ส่งก็ส่งไปเลยแล้วก็เข้าคิวโทร"*
 * - ช่วงห้ามโทร: **ยกเลิกทั้งระบบ** (migration 125) — ตัวนี้อ่านนโยบายกลางทุกรอบ ตั้งกลับเมื่อไหร่ก็เคารพทันที
 * - โทรซ้ำงานติดตาม: *"ถ้าโทรไปแล้วไม่รับให้โทรใหม่ในวันถัดไปจนครบ 3 ครั้ง"* · ใบสมัคร: *"โทรซ้ำคละช่วงเวลาจนครบ 3 ครั้ง"*
 *
 * ทุกนาทีทำ 4 อย่าง:
 * 0. ปล่อยชุดโทรที่อนุมัติแล้วและถึงเวลา (`releaseDueCallBatches` — เดิมถูกเรียกแค่ตอนเปิดแผงหรือตอน Lumos ดึงคิว)
 * 1. ส่งซ้ำแถวที่ **push ไม่ถึง** (`push_failed` / `push_pending` ค้าง) — ใบสมัคร `app-` · iRecruit `ir-` · คนของเรา `card-`
 * 2. **โทรซ้ำที่ถึงเวลา** (`followup_state = 'retry_scheduled'`) — ใบสมัคร (คละช่วงเวลา) + งานติดตาม (วันถัดไป)
 *    ผู้สมัครขอให้โทรกลับตามเวลาที่นัด = โทรตามเวลานั้น (คละช่วงเวลาเฉพาะผล "ยังไม่ติด")
 *    ส่งเป็น **งานใหม่ที่ Lumos** (รหัสรอบต่อท้าย `::r<ครั้งที่>` / `-r<ครั้งที่>` + คีย์กันซ้ำประจำรอบ) — ไม่ทับแผนเดิม
 * 3. ส่งถึงแล้วแต่ **ไม่มีผลกลับเกิน 24 ชม.** ⇒ ขึ้นให้เจ้าหน้าที่ (`needs_human`) — ปิดทาง "ส่งแล้วเงียบ"
 *
 * 🔴 ก่อนยิงเช็คซ้ำทุกครั้ง: เบอร์ถูกพัก · เบอร์มีคนถือ · ใบสมัครมีคนรับไป/บันทึกผลติดต่อแล้ว/ย้ายเป็น Lead ·
 *    งานติดตามถูกปิดแล้ว ⇒ **ไม่โทร** (fail-safe ไปทางไม่โทร — โทรทับคนที่มีเจ้าของแล้วกู้คืนไม่ได้)
 * 🔴 งานติดตามแบบตั้งตาราง (หลายรอบ) ไม่มีโทรซ้ำนอกตาราง — `callFollowup` ไม่ตั้ง retry ให้อยู่แล้ว (ตารางคือ retry)
 * ปิดได้ด้วย `LUMOS_PUSH_RETRY_ENABLED=false` · ไม่มีคีย์ push (เครื่อง dev) = ไม่ทำอะไร
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { errorSummaryText, logError, logInfo, logWarn } from './logger.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { queuePending } from './lumosQueueDefs.js';
import { bangkokIso } from './bangkokIso.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import { listSuppressedPhones } from './callFollowup.js';
import { listHeldPhones } from './candidateCallHolds.js';
import { releaseDueCallBatches } from './callBatchStore.js';
import { pushQueueRowsTracked, type LumosPushChannel } from './lumosPushTracking.js';
import {
  DEFAULT_CALL_FOLLOWUP_POLICY,
  isRotatedRetrySlot,
  isSameRetrySlot,
  rotatedRetryAt,
  type CallFollowupPolicy,
} from '../../src/lib/callFollowupPolicy.js';
import { UNREACHED_CALL_OUTCOMES } from '../../src/lib/callOutcomeBuckets.js';
import {
  decideLumosPushRetry,
  isQuietAt,
  readLumosPushRetryConfig,
  retryScheduledAt,
  type LumosPushRetryConfig,
} from '../../src/lib/lumosPushRetryPolicy.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');
const appsTable = tableInAppSchema('public_job_applications');
const contactsTable = tableInAppSchema('application_contact_logs');
const followTable = tableInAppSchema('follow_entries');

/** โทรซ้ำที่เลยเวลามาเกินเท่านี้โดยยังไม่เคยลองส่ง (เครื่องหยุด/งานค้างเก่า) ⇒ นัดช่องเวลาถัดไปใหม่ ไม่โทรทันที */
const RETRY_REPLAN_AFTER_MINUTES = 30;
/** ผลที่ "ยังไม่ติด" (นิยามกลาง) — เฉพาะพวกนี้ที่คละช่วงเวลา · ขอให้โทรกลับตามเวลาที่นัดไม่อยู่ในนี้ */
const UNREACHED = new Set<string>(UNREACHED_CALL_OUTCOMES);
/** ส่งถึงแล้วแต่เงียบเกินเท่านี้ ⇒ ขึ้นให้เจ้าหน้าที่ (ผลช้าสุดที่วัดได้ 134 นาที) */
const NO_RESULT_ESCALATE_MINUTES = 24 * 60;

let running = false;
let stopped = false;

export type LumosPushRetryRun = {
  at: string;
  found: number;
  sent: number;
  failed: number;
  waiting: number;
  /** ปิดฝั่ง AI เพราะมีเจ้าของ/ถูกพักแล้ว */
  skipped: number;
  /** เลยเพดาน โยนให้เจ้าหน้าที่ */
  gaveUp: number;
  /** โทรซ้ำ: ส่งรอบใหม่ไปแล้ว */
  retriesSent: number;
  /** โทรซ้ำ: ปิดธงเพราะงานปิด/มีเจ้าของแล้ว (ไม่โทร) */
  retriesClosed: number;
  /** โทรซ้ำ: นัดช่องเวลาใหม่ (งานค้างเก่า/นัดแบบเดิม) */
  retriesReplanned: number;
  /** ส่งถึงแล้วแต่ไม่มีผลเกิน 24 ชม. ⇒ ให้เจ้าหน้าที่ */
  silentEscalated: number;
  /** ชุดโทรที่อนุมัติแล้วถูกปล่อยเข้าคิว */
  batchesReleased: number;
};

let lastRun: LumosPushRetryRun | null = null;

export function getLastLumosPushRetryRun(): LumosPushRetryRun | null {
  return lastRun;
}

export function getLumosPushRetryConfig(): LumosPushRetryConfig {
  return readLumosPushRetryConfig(process.env);
}

type Candidate = {
  id: string;
  channel: LumosPushChannel;
  person_ref: string;
  payload: unknown;
  created_at: string | Date;
  next_attempt_at: string | Date | null;
  app_exists: boolean;
  claimed: boolean;
  is_lead: boolean;
  contacted: boolean;
};

type RetryCandidate = Candidate & {
  job_ref: string;
  attempt_count: number | null;
  push_state: string | null;
  step_position: number | null;
  last_outcome: string | null;
  last_call_at: string | Date | null;
  follow_exists: boolean;
  follow_closed: boolean;
};

/**
 * 1) แถวที่ push ไม่ถึง — ใบสมัคร/iRecruit/คนของเรา (interview) · คนของเรา (reminder) · ยังไม่มีผล (นิยามกลาง
 * `queuePending`) · จดว่าส่งไม่ถึง หรือกำลังส่งค้างนานเกิน · แถวเก่าก่อน migration 123 (`push_state` null) และงานติดตามไม่แตะ
 */
export function buildCandidateSql(): string {
  return `select q.id::text as id, q.channel, q.person_ref, q.payload, q.created_at, q.next_attempt_at,
                 (a.id is not null) as app_exists,
                 (a.claimed_by is not null) as claimed,
                 coalesce(a.is_lead, false) as is_lead,
                 exists (select 1 from ${contactsTable} c where c.application_id = a.id) as contacted
            from ${queueTable} q
            left join ${appsTable} a on q.person_ref = 'app-' || a.id::text
           where q.job_ref <> 'follow'
             and ((q.channel = 'interview'
                   and (q.person_ref like 'app-%' or q.person_ref like 'ir-%' or q.person_ref like 'card-%'))
                  or (q.channel = 'reminder' and q.person_ref like 'card-%'))
             and ${queuePending('q')}
             and q.result is null
             and (q.push_state = 'push_failed'
                  or (q.push_state = 'push_pending'
                      and q.push_started_at < now() - make_interval(mins => $2::int)))
           order by coalesce(q.next_attempt_at, q.created_at) asc
           limit $1`;
}

/**
 * 2) โทรซ้ำที่ถึงเวลา (หรือจะถึงภายในช่วงยิงล่วงหน้า) — ใบสมัคร (interview · `app-`) + งานติดตาม (reminder · `follow-`)
 * ⚠️ แถวโทรซ้ำมีผลรอบก่อนอยู่ที่ `last_outcome` (ไม่ใช่ `queuePending`) และ `result` ถูกล้างไว้แล้วตอนตั้งโทรซ้ำ
 * ⚠️ `last_call_at` ห้ามถอยไปใช้ `updated_at` — การนัดใหม่แตะ `updated_at` ⇒ ช่องของ "สายล่าสุด" จะขยับทุกรอบ
 */
export function buildRetryDueSql(): string {
  return `select q.id::text as id, q.channel, q.person_ref, q.job_ref, q.payload, q.created_at, q.next_attempt_at,
                 q.attempt_count, q.push_state, q.step_position, q.last_outcome,
                 coalesce(q.last_result_at, q.first_result_at) as last_call_at,
                 (a.id is not null) as app_exists,
                 (a.claimed_by is not null) as claimed,
                 coalesce(a.is_lead, false) as is_lead,
                 exists (select 1 from ${contactsTable} c where c.application_id = a.id) as contacted,
                 (f.id is not null) as follow_exists,
                 (f.completed_at is not null or f.cancelled_at is not null) as follow_closed
            from ${queueTable} q
            left join ${appsTable} a on q.person_ref = 'app-' || a.id::text
            left join ${followTable} f on q.person_ref = 'follow-' || f.id::text
           where q.followup_state = 'retry_scheduled'
             and q.status = 'pending'
             and q.result is null
             and q.next_attempt_at is not null
             and q.next_attempt_at <= now() + make_interval(mins => $2::int)
             and ((q.channel = 'interview' and q.person_ref like 'app-%')
                  or (q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref like 'follow-%'))
           order by q.next_attempt_at asc
           limit $1`;
}

/** 3) ส่งถึงแล้วแต่ไม่มีผลกลับเกินเพดาน ⇒ ขึ้นให้เจ้าหน้าที่ (เฉพาะแถวที่ระบบนี้จด push ไว้ — แถวเก่า/รอบแรกของงานติดตามไม่แตะ) */
export function buildSilentEscalateSql(): string {
  return `update ${queueTable} q
             set followup_state = 'needs_human', push_state = 'push_gave_up',
                 push_error = 'ส่งถึง Lumos แล้วแต่ไม่มีผลโทรกลับเกิน 24 ชม. — ให้เจ้าหน้าที่โทรเอง',
                 updated_at = now()
           where q.push_state = 'pushed'
             and q.result is null
             and q.status = 'pending'
             and q.followup_state is null
             and greatest(q.push_started_at, coalesce(q.next_attempt_at, q.push_started_at))
                 < now() - make_interval(mins => $1::int)
           returning q.id`;
}

/** ปิดฝั่ง AI ของแถวที่ยังค้างจริงเท่านั้น (ผลโทรเพิ่งกลับมา = ไม่แตะ) */
async function closeAiSide(id: string, pushState: 'push_skipped' | 'push_gave_up', reason: string): Promise<void> {
  const needsHuman = pushState === 'push_gave_up';
  try {
    await dbQuery(
      `update ${queueTable}
          set status = 'cancelled', push_state = $2, push_error = $3, updated_at = now()
              ${needsHuman ? `, followup_state = 'needs_human'` : ''}
        where id = $1::bigint and ${queuePending('')} and result is null`,
      [id, pushState, reason],
    );
  } catch (e) {
    logError('lumos.pushRetry: ปิดฝั่ง AI ไม่สำเร็จ', e, { queueId: id, pushState });
  }
}

/**
 * ปิดธงโทรซ้ำ — `closed` = ไม่ต้องโทรแล้ว (งานปิด/มีเจ้าของ) · `needs_human` = ส่งไม่ถึงนานเกิน ให้เจ้าหน้าที่
 * ⚠️ แตะเฉพาะแถวที่ยังเป็นโทรซ้ำอยู่ (ผลรอบใหม่เพิ่งกลับมา/มีคนแก้ไปแล้ว = ไม่แตะ)
 */
async function closeRetry(id: string, state: 'closed' | 'needs_human', reason: string): Promise<void> {
  try {
    await dbQuery(
      `update ${queueTable}
          set followup_state = $2, next_attempt_at = null, push_error = $3, updated_at = now()
        where id = $1::bigint and followup_state = 'retry_scheduled' and result is null`,
      [id, state, reason],
    );
  } catch (e) {
    logError('lumos.pushRetry: ปิดธงโทรซ้ำไม่สำเร็จ', e, { queueId: id, state });
  }
}

async function replanRetry(id: string, at: Date): Promise<void> {
  try {
    await dbQuery(
      `update ${queueTable} set next_attempt_at = $2::timestamptz, updated_at = now()
        where id = $1::bigint and followup_state = 'retry_scheduled' and result is null`,
      [id, at.toISOString()],
    );
  } catch (e) {
    logError('lumos.pushRetry: นัดโทรซ้ำใหม่ไม่สำเร็จ', e, { queueId: id });
  }
}

/** เบอร์ใน payload — interview ใช้ `phone` · reminder ใช้ `recipient_phone` (ตัวเดียวกับ PAYLOAD_PHONE_KEYS) */
const phoneOf = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_phone', 'phone']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
};

/** เลื่อนเวลานัดของ payload — interview มีช่องเดียว · reminder ของเลน Match เป็นแผนรอบเดียวใน `steps` */
export function withScheduledAt(payload: Record<string, unknown>, iso: string): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload };
  if ('scheduled_at' in out || !Array.isArray(out.steps)) out.scheduled_at = iso;
  if (Array.isArray(out.steps)) {
    out.steps = out.steps.map((s) =>
      typeof s === 'object' && s !== null ? { ...(s as Record<string, unknown>), scheduled_at: iso } : s,
    );
  }
  return out;
}

/**
 * payload ของ **รอบโทรซ้ำ** — ส่งเป็นงานใหม่ที่ Lumos ไม่ไปทับแผนเดิม
 * - interview: `client_interview_id` ต่อท้าย `::r<ครั้งที่>` (ผลจับกลับด้วย `client_candidate_id` เดิม — ไม่เปลี่ยน)
 * - reminder (งานติดตาม): รอบเดียวของแถวนี้ (แถวหัวขบวนถือทั้งแผน ⇒ เลือก step ของตัวเอง) ·
 *   `client_contact_id` ต่อท้าย `-r<ครั้งที่>` (`applyLumosResult` ถอยไปจับรหัสเดิมเมื่อไม่เจอ)
 */
export function buildRetryPayload(
  channel: LumosPushChannel,
  payload: Record<string, unknown>,
  attempt: number,
  stepPosition: number | null,
  iso: string,
): Record<string, unknown> {
  if (channel === 'interview') {
    const base = String(payload.client_interview_id ?? '').replace(/::r\d+$/, '');
    return { ...payload, client_interview_id: `${base}::r${attempt}`, scheduled_at: iso };
  }
  const steps = Array.isArray(payload.steps) ? (payload.steps as unknown[]) : [];
  const own = steps.length > 0 ? steps[Math.min(Math.max(stepPosition ?? 0, 0), steps.length - 1)] : null;
  const base = String(payload.client_contact_id ?? '').replace(/-r\d+$/, '');
  const out: Record<string, unknown> = { ...payload, client_contact_id: `${base}-r${attempt}` };
  if (own && typeof own === 'object') out.steps = [{ ...(own as Record<string, unknown>), scheduled_at: iso }];
  if ('scheduled_at' in out) out.scheduled_at = iso;
  return out;
}

export const retryKeyFor = (channel: LumosPushChannel, id: string, attempt: number) =>
  `${channel === 'interview' ? 'interview' : 'follow'}-${id}-r${attempt}`;

const toDate = (v: string | Date | null): Date | null => {
  if (v === null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

type Gates = { suppressed: Set<string> | null; held: Set<string>; policy: CallFollowupPolicy };

async function loadGates(): Promise<Gates> {
  const policy = await getCallFollowupPolicy().catch(() => DEFAULT_CALL_FOLLOWUP_POLICY);
  // เบอร์ถูกพัก: อ่านไม่ได้ = รอบนี้ไม่ยิงใครเลย (เผลอโทรคนที่บอกเลิกหางานแล้วกู้คืนไม่ได้)
  let suppressed: Set<string> | null;
  try {
    suppressed = await listSuppressedPhones();
  } catch {
    suppressed = null;
  }
  // เบอร์มีคนถือ: อ่านไม่ได้ = ไม่กรอง (กติกาเดียวกับตอนเข้าคิว `insertQueueItems`)
  let held: Set<string>;
  try {
    held = await listHeldPhones();
  } catch {
    held = new Set();
  }
  return { suppressed, held, policy };
}

/** เหตุที่ใบสมัครนี้ไม่ควรให้ AI โทร (มีเจ้าของแล้ว) · null = โทรได้ */
function applicationSkipReason(row: Candidate): string | null {
  if (!row.person_ref.startsWith('app-')) return null;
  if (!row.app_exists) return 'ไม่พบใบสมัครแล้ว';
  if (row.claimed) return 'มีเจ้าหน้าที่รับไปโทรเองแล้ว';
  if (row.contacted) return 'มีบันทึกผลติดต่อแล้ว';
  if (row.is_lead) return 'ย้ายไปเป็น Lead แล้ว';
  return null;
}

/** เดินหนึ่งรอบ — export ไว้ให้เทสต์ */
export async function runLumosPushRetryOnce(
  cfg: LumosPushRetryConfig = getLumosPushRetryConfig(),
  now: Date = new Date(),
): Promise<LumosPushRetryRun> {
  const run: LumosPushRetryRun = {
    at: now.toISOString(),
    found: 0,
    sent: 0,
    failed: 0,
    waiting: 0,
    skipped: 0,
    gaveUp: 0,
    retriesSent: 0,
    retriesClosed: 0,
    retriesReplanned: 0,
    silentEscalated: 0,
    batchesReleased: 0,
  };
  if (!getLumosPushConfig()) {
    lastRun = run;
    return run;
  }

  // ── 0) ชุดโทรที่อนุมัติแล้ว — ปล่อยตามเวลา (เดิมรอคนเปิดแผง/รอ Lumos มาดึงคิวซึ่งไม่มาแล้ว) ──
  try {
    run.batchesReleased = await releaseDueCallBatches();
  } catch (e) {
    logError('lumos.pushRetry: ปล่อยชุดโทรไม่สำเร็จ', e);
  }

  let gates: Gates | null = null;
  const gatesOnce = async () => (gates ??= await loadGates());

  // ── 1) push ไม่ถึง ──
  let rows: Candidate[] = [];
  try {
    ({ rows } = await dbQuery<Candidate>(buildCandidateSql(), [cfg.limit, cfg.stalePendingMinutes]));
  } catch (e) {
    // ยังไม่ migrate 123 = ยังไม่มีอะไรให้ตาม (ไม่ต้องดังทุกนาที)
    if (!(typeof e === 'object' && e !== null && (e as { code?: string }).code === '42703')) {
      logError('lumos.pushRetry: อ่านแถวค้างไม่สำเร็จ', e);
    }
    rows = [];
  }
  run.found = rows.length;
  for (const row of rows) {
    if (stopped) break;
    const { suppressed, held, policy } = await gatesOnce();
    const dueAt = toDate(row.next_attempt_at) ?? toDate(row.created_at) ?? now;
    const decision = decideLumosPushRetry(dueAt, cfg, policy, now);
    if (decision.action === 'give_up') {
      run.gaveUp += 1;
      await closeAiSide(
        row.id,
        'push_gave_up',
        `ส่งไม่ถึง Lumos เกิน ${Math.round(cfg.giveUpAfterMinutes / 60)} ชม. — ให้เจ้าหน้าที่โทรเอง`,
      );
      logWarn('lumos.pushRetry.gaveUp', { queueId: row.id, channel: row.channel });
      continue;
    }
    if (decision.action === 'wait') {
      run.waiting += 1;
      continue;
    }
    const skipReason = applicationSkipReason(row);
    if (skipReason) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', skipReason);
      continue;
    }
    if (suppressed === null) {
      run.waiting += 1;
      continue;
    }
    const phone = phoneOf(row.payload);
    if (phone && suppressed.has(phone)) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', 'เบอร์ถูกพัก (ไม่หางานแล้ว/เบอร์เสีย)');
      continue;
    }
    if (phone && held.has(phone)) {
      run.skipped += 1;
      await closeAiSide(row.id, 'push_skipped', 'เบอร์นี้มีเจ้าหน้าที่ถืออยู่');
      continue;
    }
    const scheduledAt = bangkokIso(decision.scheduledAt);
    try {
      const r = await pushQueueRowsTracked(row.channel, [{ id: row.id, payload: row.payload }], (p) =>
        withScheduledAt(p, scheduledAt),
      );
      run.sent += r.pushed;
      run.failed += r.failed;
      if (r.pushed) logInfo('lumos.pushRetry.ok', { queueId: row.id, channel: row.channel, scheduledAt });
    } catch (e) {
      run.failed += 1;
      logWarn('lumos.pushRetry.failed', { queueId: row.id, reason: errorSummaryText(e, 200) });
    }
  }

  // ── 2) โทรซ้ำที่ถึงเวลา ──
  let retries: RetryCandidate[] = [];
  try {
    ({ rows: retries } = await dbQuery<RetryCandidate>(buildRetryDueSql(), [cfg.limit, cfg.leadMinutes]));
  } catch (e) {
    if (!(typeof e === 'object' && e !== null && (e as { code?: string }).code === '42703')) {
      logError('lumos.pushRetry: อ่านโทรซ้ำไม่สำเร็จ', e);
    }
    retries = [];
  }
  for (const r of retries) {
    if (stopped) break;
    const { suppressed, held, policy } = await gatesOnce();
    const isFollow = r.job_ref === 'follow' || r.person_ref.startsWith('follow-');
    // a) ไม่ต้องโทรแล้ว — งานติดตามปิดแล้ว / ใบสมัครมีเจ้าของแล้ว / เบอร์พักหรือมีคนถือ
    const closeReason = isFollow
      ? !r.follow_exists
        ? 'ไม่พบรายการติดตามแล้ว — ไม่โทรซ้ำ'
        : r.follow_closed
          ? 'งานติดตามปิดแล้ว — ไม่โทรซ้ำ'
          : null
      : applicationSkipReason(r);
    if (closeReason) {
      run.retriesClosed += 1;
      await closeRetry(r.id, 'closed', closeReason);
      continue;
    }
    if (suppressed === null) {
      run.waiting += 1;
      continue;
    }
    const phone = phoneOf(r.payload);
    if (phone && (suppressed.has(phone) || held.has(phone))) {
      run.retriesClosed += 1;
      await closeRetry(r.id, 'closed', suppressed.has(phone) ? 'เบอร์ถูกพัก — ไม่โทรซ้ำ' : 'เบอร์นี้มีเจ้าหน้าที่ถืออยู่ — ไม่โทรซ้ำ');
      continue;
    }
    const due = toDate(r.next_attempt_at) ?? now;
    const lateMinutes = (now.getTime() - due.getTime()) / 60_000;
    const failedBefore = r.push_state === 'push_failed';
    // b) ส่งไม่ถึงมานานเกินเพดาน ⇒ ให้เจ้าหน้าที่
    if (failedBefore && lateMinutes > cfg.giveUpAfterMinutes) {
      run.gaveUp += 1;
      await closeRetry(r.id, 'needs_human', `ส่งโทรซ้ำไม่ถึง Lumos เกิน ${Math.round(cfg.giveUpAfterMinutes / 60)} ชม. — ให้เจ้าหน้าที่โทรเอง`);
      continue;
    }
    // c) ใบสมัครที่ยังไม่ติด: นัดแบบเดิม (+24 ชม. เวลาเดิม) · ตกช่องเดียวกับสายที่ไม่ติด · ค้างเก่า
    //    ⇒ นัดช่องเวลาถัดไปใหม่ (คละช่วงเวลา) แล้วรอ
    //    🔴 ผู้สมัครขอให้โทรกลับตามเวลาที่นัด (`reschedule_requested`) = โทรตามเวลานั้น ห้ามย้ายช่อง
    const isApplication = r.person_ref.startsWith('app-');
    const lastCall = toDate(r.last_call_at);
    if (
      isApplication &&
      !failedBefore &&
      UNREACHED.has(String(r.last_outcome ?? '')) &&
      (!isRotatedRetrySlot(due) ||
        (lastCall !== null && isSameRetrySlot(due, lastCall)) ||
        lateMinutes > RETRY_REPLAN_AFTER_MINUTES)
    ) {
      const at = rotatedRetryAt(lastCall ?? due, now);
      run.retriesReplanned += 1;
      await replanRetry(r.id, at);
      continue;
    }
    // d) ช่วงห้ามโทร (ถ้ามี) / ยังไกลเวลานัด ⇒ รอ
    if (isQuietAt(now, policy) || due.getTime() - now.getTime() > cfg.leadMinutes * 60_000) {
      run.waiting += 1;
      continue;
    }
    // e) ส่งรอบใหม่เป็นงานใหม่ที่ Lumos
    const attempt = Math.max(2, Number(r.attempt_count) || 2);
    const iso = bangkokIso(retryScheduledAt(due, now, policy));
    try {
      const res = await pushQueueRowsTracked(
        r.channel,
        [{ id: r.id, payload: r.payload }],
        (p) => buildRetryPayload(r.channel, p, attempt, r.step_position, iso),
        (id) => retryKeyFor(r.channel, id, attempt),
      );
      if (res.pushed) {
        run.retriesSent += 1;
        // ส่งถึงแล้ว = ไม่ใช่ "รอโทรซ้ำ" อีก (รอผล) · ผลรอบใหม่กลับมาก่อน/มีคนแก้ = ไม่แตะ
        await dbQuery(
          `update ${queueTable} set followup_state = null, updated_at = now()
            where id = $1::bigint and followup_state = 'retry_scheduled' and result is null
              and abs(extract(epoch from (next_attempt_at - $2::timestamptz))) < 1`,
          [r.id, due.toISOString()],
        ).catch((e) => logError('lumos.pushRetry: ปิดธงหลังส่งโทรซ้ำไม่สำเร็จ', e, { queueId: r.id }));
        logInfo('lumos.pushRetry.retry.ok', { queueId: r.id, channel: r.channel, attempt, scheduledAt: iso });
      } else {
        run.failed += res.failed;
      }
    } catch (e) {
      run.failed += 1;
      logWarn('lumos.pushRetry.retry.failed', { queueId: r.id, reason: errorSummaryText(e, 200) });
    }
  }

  // ── 3) ส่งถึงแล้วแต่เงียบเกิน 24 ชม. ⇒ ให้เจ้าหน้าที่ ──
  try {
    const { rows: silent } = await dbQuery<{ id: string }>(buildSilentEscalateSql(), [NO_RESULT_ESCALATE_MINUTES]);
    run.silentEscalated = silent.length;
    if (silent.length) logWarn('lumos.pushRetry.silent', { rows: silent.length });
  } catch (e) {
    if (!(typeof e === 'object' && e !== null && (e as { code?: string }).code === '42703')) {
      logError('lumos.pushRetry: เช็คสายเงียบไม่สำเร็จ', e);
    }
  }

  lastRun = run;
  // รอบที่แค่ "รอ" ไม่ต้องจด — ไม่งั้นคืนละหลายร้อยบรรทัด
  if (
    run.sent ||
    run.failed ||
    run.skipped ||
    run.gaveUp ||
    run.retriesSent ||
    run.retriesClosed ||
    run.retriesReplanned ||
    run.silentEscalated ||
    run.batchesReleased
  ) {
    logInfo('lumos.pushRetry.run', { ...run });
  }
  return run;
}

function sleepInterruptible(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === 'function') t.unref();
  });
}

/** เริ่มตัวส่งซ้ำ — เรียกครั้งเดียวตอนบูต process API · คืน `false` เมื่อถูกปิดไว้ด้วย env */
export function startLumosPushRetryWorker(): boolean {
  const cfg = getLumosPushRetryConfig();
  if (!cfg.enabled) {
    logInfo('lumos.pushRetry.worker.disabled', {
      hint: 'ลบ LUMOS_PUSH_RETRY_ENABLED หรือตั้งเป็น true เพื่อเปิด',
    });
    return false;
  }
  if (running) return true;
  running = true;
  stopped = false;
  logInfo('lumos.pushRetry.worker.start', {
    intervalMs: cfg.intervalMs,
    limit: cfg.limit,
    giveUpAfterMinutes: cfg.giveUpAfterMinutes,
  });
  void (async () => {
    await sleepInterruptible(cfg.startupDelayMs);
    while (!stopped) {
      const nowCfg = getLumosPushRetryConfig();
      if (!nowCfg.enabled) {
        logWarn('lumos.pushRetry.worker.turnedOff');
        break;
      }
      try {
        await runLumosPushRetryOnce(nowCfg);
      } catch (e) {
        logError('lumos.pushRetry: รอบนี้ล้มทั้งรอบ', e);
      }
      await sleepInterruptible(nowCfg.intervalMs);
    }
    running = false;
  })();
  return true;
}

export function stopLumosPushRetryWorker(): void {
  stopped = true;
}
