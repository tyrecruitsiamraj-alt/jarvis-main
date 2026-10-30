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
import { GREETING_JOB_REF } from '../../src/lib/greetingCall.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';
import { notifyRoles, notifyUsers } from './appNotifications.js';
import {
  isCallOutcome,
  resolveCallFollowup,
  type CallFollowupDecision,
  type CallOutcome,
} from '../../src/lib/callFollowupPolicy.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import { getLumosPushConfig } from './lumosPushClient.js';
import { cancelFollowPlanAtLumos } from './followLumosCancel.js';
import { followSameStopUnitSql } from './followDayScope.js';
import { logError, logInfo } from './logger.js';

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
  /** pdpa = เจ้าตัวขอลบ/ขอให้หยุดติดต่อ (18 ต.ค. 2569) — หน้าบัญชีห้ามโทรปลดไม่ได้ */
  reason: 'not_looking' | 'wrong_number' | 'manual' | 'pdpa';
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
  person_ref: string;
  job_ref: string;
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
      `select id, attempt_count, payload, person_ref, job_ref from ${queueTable} where id = $1 limit 1`,
      [input.queueId],
    );
    row = rows[0];
  } catch (e) {
    // คอลัมน์ attempt_count ยังไม่ถูก migrate → ข้ามการตามงานไปเลย (พฤติกรรมเดิม ไม่พัง)
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return null;
    throw e;
  }
  if (!row) return null;

  // Follow ตั้งตาราง: person_ref = follow-<id> ที่มี group_id **หรือ** call_round/call_times
  // → **ตารางคือ retry อยู่แล้ว** (หลายรอบ/วัน + วันถัดไปเป็นแถวใหม่) ห้ามให้ policy
  // ตั้ง +24 ชม.retry ทับ ไม่งั้นได้สายนอกตารางเพิ่ม · confirmed = ปิดวันนั้นตามเดิม
  const followSchedule = await followScheduleOfPersonRef(row.person_ref);
  const followGroupId = followSchedule.groupId;

  const decision = resolveCallFollowup({
    outcome: input.outcome as CallOutcome,
    attemptCount: Number(row.attempt_count) || 1,
    now: input.now ?? new Date(),
    requestedCallbackAt: pickRequestedCallbackAt(input.result),
    // สายทักทายทั่วไป (15 ต.ค. 2569): คำถามเดียวที่ตัดสินคือ "ยังหางานอยู่ไหม" ⇒ ไม่สนใจ = ไม่หางานแล้ว = พักเบอร์ทุกใบขอ
    declinedScope: input.declinedScope ?? (row.job_ref === GREETING_JOB_REF ? 'all' : null),
    // นโยบายที่เจ้าของตั้งจากหน้า Follow (migration 073) — ตารางยังไม่ migrate = ค่าเดิมในโค้ด
    policy: await getCallFollowupPolicy(),
    // ไม่รับสาย ⇒ เวลาโทรซ้ำถัดไปจากหน้า ตั้งค่า › โทรซ้ำคนไม่รับสาย (ทุกงาน · 26 ต.ค. 2569)
  });

  // แถวตั้งตาราง: retry ของ policy → ปิดแทน (ไม่โทรซ้ำนอกตาราง) · ผลอื่นคงเดิม
  const scheduledFollow = followSchedule.scheduled;
  const effectiveRetry = decision.action === 'retry' && !scheduledFollow;

  try {
    if (effectiveRetry) {
      // ⚠️ ห้ามเพิ่ม first_delivered_at/first_result_at/last_result_at ลง reset นี้ (088)
      // — เป็นหลักฐานประวัติเขียนครั้งเดียว ล้างแล้ว "โทรแล้ว/เวลารอโทร" บน dashboard พัง
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
  // 🔴 **AI ห้ามบล็อกเบอร์เอง** (เจ้าของสั่ง 17 ก.ย. 2569: *"อย่าพึ่งบล็อคเบอร์"*)
  //
  // เดิม `wrong_person` ครั้งเดียวพักเบอร์ 7 วันทันที · เคสจริงที่ทำให้ต้องเลิกกติกานี้:
  // เบอร์ +6665xxx1768 คุยสำเร็จมาสามวันติด (15, 16, 17 รอบแรก) รอบที่สองของวันที่ 17
  // ผู้รับสายตอบว่า "ทำงาน แล้ว" ตอนถูกถามว่าใช่เจ้าตัวไหม · Lumos อ่านเป็น "โทรผิดเบอร์"
  // ⇒ เบอร์ถูกพักถึง 24 ก.ย. และสายของวันที่ 18 **ไม่ถูกส่งเลย** ทั้งที่เป็นเบอร์ที่ถูกต้อง
  //
  // ตอนนี้ `wrong_person` ได้แค่ **ติดธง needs_human** (แจ้งเตือน admin ด้านล่าง)
  // การพักเบอร์เหลือเป็น **การตัดสินใจของคน** เท่านั้น — คนกดจากหน้า "โทรของฉัน"
  // (`CallHoldPanel` → `applyHumanCallFollowup`) ซึ่งคนนั้นได้ยินเสียงจริงและกรอกเบอร์ใหม่ได้

  // แจ้งเตือนคน — เดิมผลกลับมาแล้วจบเงียบ ระบบดีแค่ไหนก็ช้าเท่าคนเปิดหน้าจอ
  // ยิงเฉพาะเหตุการณ์ที่ "คนต้องขยับ": สนใจ (รีบจอง) กับ ต้องคนตาม (AI สุดมือแล้ว)
  // ผู้รับ = admin — หน้างานโทรยังซ่อนให้ admin เท่านั้น (7 ส.ค. 2569) เปิดกว้างเมื่อไหร่ค่อยขยาย
  // dedupe ด้วย queue id + เหตุการณ์ — Lumos ยิงผลเดิมซ้ำจะไม่เด้งซ้ำ
  // ⚠️ ห้าม throw ข้ามจุดนี้ — notifyRoles กลืน error เองอยู่แล้ว
  const who = nameFromPayload(row.payload) || row.person_ref;
  /**
   * 🔴 สายติดตาม (job_ref = 'follow') ไม่ใช่ใบขอ — QA รอบ 2 ข้อ 48 (12 ต.ค. 2569):
   * เดิมผลติดตามเด้ง "X สนใจงาน — รีบติดต่อกลับ · ใบขอ follow" และลิงก์ไป /follow ทุกรายการแม้เป็นผู้สมัครจริง
   * ⇒ ติดตาม: "ตอบว่าไป" ไม่ต้องรีบทำอะไร = ไม่เด้ง · ต้องคนตาม = ลิงก์หน้าติดตาม ไม่มีคำว่าใบขอ
   *   ผู้สมัคร/จับคู่งาน: คำเดิม ลิงก์ไปแท็บผู้สมัคร
   */
  const isFollow = row.job_ref === 'follow';
  const link = isFollow ? '/follow' : '/jobs/board?view=list';
  const where = isFollow
    ? 'ติดตามเริ่มงาน'
    : row.job_ref === GREETING_JOB_REF
      ? 'AI ทักทาย (ยังไม่ผูกใบขอ)'
      : `ใบขอ ${row.job_ref}`;
  if (input.outcome === 'confirmed' && !isFollow) {
    await notifyRoles(['admin'], {
      type: 'call_confirmed',
      title: `${who} สนใจงาน — รีบติดต่อกลับ`,
      body: `${where} · AI โทรแล้วเขาตอบรับ อย่าปล่อยให้เย็นตัว`,
      link,
      dedupeKey: `call_confirmed:${row.id}`,
    });
  } else if (decision.action === 'needs_human') {
    await notifyRoles(['admin'], {
      type: 'needs_human',
      title: `${who} ต้องคนตาม — AI โทรจนสุดมือแล้ว`,
      body: `${where} · ${decision.reason}`,
      link,
      dedupeKey: `needs_human:${row.id}`,
    });
  }

  // Follow ตั้งตาราง + **เจ้าตัวบอกว่าไม่เอา** → หยุดเฉพาะสายที่เหลือของ **วันนั้น** (เจ้าของ 7 ต.ค. "หยุดแค่วันนั้น วันถัดไปโทรต่อ")
  // 🔴 16 ต.ค. 2569 (เจ้าของ Choice "หยุดแค่วันนั้น ไม่แตะวันอื่น"): เดิมยกเลิกทั้งชุดทุกวันแล้วให้ตัวซ่อมส่งวันถัดไปกลับ
  //    ⇒ ส่งกลับไม่กี่วิหลัง DELETE = Lumos รับแต่ไม่โทร (พนักงาน A 14–16 ต.ค. · พนักงาน B 15–16 ต.ค.) · ตอนนี้แผนวันอื่นไม่ถูกแตะเลย
  // (เจ้าของเคาะ 16 ส.ค.: "บอกยกเลิก = หยุดทั้งชุด") · confirmed ไม่ยกเลิกชุด — วันถัดไป
  // ยังอาจต้องยืนยันซ้ำตามเดิม (stop_early ของ Lumos หยุดแค่วันนั้น)
  //
  // 🔴 `wrong_person` **ไม่อยู่ในกติกานี้แล้ว** (17 ก.ย. 2569) — คนละเรื่องกับ "บอกยกเลิก"
  // มันคือ *ระบบเดาว่าคุยผิดคน* ซึ่งเดาพลาดได้ (ดูเคสในคอมเมนต์ด้านบน) และถ้าพลาด
  // ตารางที่เหลือทั้งชุดหายไปเงียบ ๆ · ให้ติดธง needs_human แล้วรอคนตัดสินแทน
  //
  // 🔴 ต้องหยุด **ที่ Lumos ด้วย** ไม่ใช่แค่คิวฝั่งเรา (1 ต.ค. 2569) — ดู `cancelFollowSetAfterDecline`
  //
  // 🔴 28 ต.ค. 2569 (เจ้าของ Choice "ยกเลิกสายที่เหลือของวันนั้น"): **ตอบว่าไปแล้ว** ก็หยุดแบบเดียวกัน
  //    เคสคุณนริศ: 06:40 ตอบ "รอรถตู้ฟอร์ดครับ" (ไป) แต่ 07:40 ยังโดนโทรอีก 3 ครั้ง — Lumos โทรทุก step แม้ยืนยันแล้ว
  //    "ไป" = Lumos ให้ confirmed (`followSaidGoing` · 30 ต.ค. 2569 ไม่อ่านสรุปเอง) · ส่งคนแทน = สายที่เหลือของใบงานเดียวกัน
  const answer = followAnswerOf(input.outcome);
  if ((answer === 'going' || answer === 'not_going') && (followGroupId || followSchedule.scheduled)) {
    await cancelFollowSetAfterDecline(String(row.person_ref ?? ''), followGroupId).catch(() => {});
  }
  // 28 ต.ค. 2569 (เจ้าของ Choice "แจ้งเตือนทันที" · "แจ้งเตือนให้คนโทรนัด"): ไม่ไป / ขอเลื่อน ⇒ กระดิ่งถึงคนสร้างรายการ + หัวหน้า
  if (answer === 'not_going' || answer === 'reschedule') {
    await notifyFollowAnswer(String(row.person_ref ?? ''), input.queueId, answer, input.result).catch(() => {});
  }

  return decision;
}

const followTable = tableInAppSchema('follow_entries');

export type FollowAnswer = 'going' | 'not_going' | 'reschedule' | null;

/**
 * คำตอบของสายติดตามจาก AI — ไป / ไม่ไป / ขอเลื่อน · ที่เหลือ null (ไม่รับสาย · รับสายแล้ว · ไม่ใช่เจ้าตัว ฯลฯ)
 * 🔴 ยึดรหัสผลของ Lumos อย่างเดียว ไม่อ่านสรุปเอง (เจ้าของ 30 ต.ค. 2569 · `FOLLOW_VOCAB.codeOnly`)
 */
export function followAnswerOf(outcome: string): FollowAnswer {
  if (outcome === 'reschedule_requested') return 'reschedule';
  if (outcome === 'declined') return 'not_going';
  if (followSaidGoing(outcome)) return 'going';
  return null;
}

/**
 * บอกว่าเลิกทำงานแล้ว (ลาออก · ไม่ทำแล้ว) — ไม่ใช่แค่ "วันนี้ไม่ไป" (เจ้าของ 28 ต.ค. 2569 Choice "คนกดหยุดเอง")
 * ระบบยังหยุดแค่วันนั้น · กระดิ่งบอกแยกให้เจ้าหน้าที่เช็กแล้วกด ยกเลิก › ทั้งชุด เอง (กัน AI ฟังผิดแล้วตัดคนทิ้งเงียบ ๆ)
 */
export const FOLLOW_QUIT_RE = /ลาออก|ไม่ทำแล้ว|ไม่ทำงานแล้ว|ไม่ทำต่อ|เลิกทำ|ออกจากงาน|ออกแล้ว|ไม่ไปแล้ว|ไม่ไปทำแล้ว|ไม่เอาแล้ว/;
export function followSaidQuit(result: unknown): boolean {
  const r = (typeof result === 'object' && result !== null ? result : {}) as { summary?: unknown; transcript?: unknown };
  const reply = Array.isArray(r.transcript)
    ? r.transcript
        .filter((t): t is { role?: unknown; text?: unknown } => typeof t === 'object' && t !== null && (t as { role?: unknown }).role === 'candidate')
        .map((t) => String(t.text ?? ''))
        .join(' ')
    : '';
  return FOLLOW_QUIT_RE.test(`${typeof r.summary === 'string' ? r.summary : ''} ${reply}`);
}

/** กระดิ่ง "ไม่ไป / ขอเลื่อน" — คนสร้างรายการ + แอดมิน/หัวหน้า · กลืน error เอง (ห้ามทำให้การรับผลล้ม) */
async function notifyFollowAnswer(personRef: string, queueId: number, answer: 'not_going' | 'reschedule', result: unknown): Promise<void> {
  const id = personRef.startsWith('follow-') ? personRef.slice('follow-'.length) : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  try {
    const { rows } = await dbQuery<{ created_by: string | null; name: string | null; unit: string | null; team: string | null; at: string | Date | null }>(
      `select created_by::text as created_by, recipient_name as name, unit_name as unit, follow_team as team, scheduled_at as at
         from ${followTable} where id = $1::uuid limit 1`,
      [id],
    );
    const f = rows[0];
    if (!f) return;
    const summary = typeof (result as { summary?: unknown } | null)?.summary === 'string' ? String((result as { summary: string }).summary) : '';
    const day = f.at ? new Date(f.at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' }) : null;
    const quit = answer === 'not_going' && followSaidQuit(result);
    const input = {
      type: quit ? 'follow_quit' : answer === 'not_going' ? 'follow_not_going' : 'follow_reschedule',
      title: `${f.name?.trim() || 'ผู้รับสาย'} ${quit ? 'บอกไม่ทำแล้ว' : answer === 'not_going' ? 'บอกไม่ไป' : 'ขอเลื่อน'}${f.unit?.trim() ? ` · ${f.unit.trim()}` : ''}${day ? ` · ${day}` : ''}`,
      // ไม่ทำแล้ว: วันถัดไป AI ยังโทรจนกว่าคนกดหยุด — บอกปุ่มที่ต้องกด
      body: [quit ? 'วันถัดไป AI ยังโทร · กด บันทึกว่าเสร็จสิ้น › ยกเลิก › ทั้งชุด เพื่อหยุด' : null, summary.slice(0, 160) || null].filter(Boolean).join(' · '),
      link: f.team === 'replacement' ? '/follow?view=replace' : '/follow',
      dedupeKey: `follow_answer:${queueId}`,
    };
    if (f.created_by) await notifyUsers([f.created_by], input);
    await notifyRoles(['admin', 'supervisor'], input);
  } catch (e) {
    logError('follow.answer.notify failed', e, { personRef, answer });
  }
}

/** ผลของ AI นี้คือ "ไป" ไหม — Lumos ให้ confirmed เท่านั้น (30 ต.ค. 2569 ไม่อ่านสรุปเอง) */
export function followSaidGoing(outcome: string): boolean {
  return outcome === 'confirmed';
}

/**
 * แถวนี้เป็น **สายตั้งตาราง** ไหม + กลุ่มของมันคืออะไร
 *
 * 🔴 **ห้ามดูแค่ `group_id`** (แก้ 21 ก.ย. 2569) — ของจริงพังเพราะเหตุนี้:
 * เส้นที่คนใช้สร้างรายการจริงทุกวัน (ตั้งหลายรอบในคำขอเดียว) ไม่เคยส่ง `group_id`
 * มาเลย ⇒ 287 จาก 295 แถวของ 14 วันล่าสุดมีค่า `null` ⇒ ที่นี่เห็นเป็น "สายเดี่ยว"
 * ⇒ ผลไม่รับสายเข้าทาง retry ⇒ ดีดแถวกลับเป็น `pending` โดยไม่มีใครดันแผนใหม่
 * ไป Lumos ⇒ **สายที่ระบบสัญญาว่าจะโทรซ้ำแต่ไม่มีวันโทร** (ค้างจริง 46 แถว)
 *
 * `call_round` / `call_times` บอกความเป็นตารางได้เท่ากัน และเส้นสร้างทุกเส้นเขียนไว้
 * จึงใช้เป็นตัวยืนยันอีกชั้น — `group_id` หายไปอีกเมื่อไหร่ก็ไม่ทำให้ตารางกลายเป็นสายเดี่ยว
 *
 * คืน `{ scheduled, groupId }` — `groupId` ยังต้องใช้ตอน `declined` เพื่อยกเลิกทั้งชุด
 * (ไม่มีกลุ่ม = ยกเลิกทั้งชุดไม่ได้ แต่ยังรู้ว่าเป็นตาราง จึงไม่ถูก retry นอกตาราง)
 */
async function followScheduleOfPersonRef(
  personRef: string,
): Promise<{ scheduled: boolean; groupId: string | null }> {
  const none = { scheduled: false, groupId: null };
  if (typeof personRef !== 'string' || !personRef.startsWith('follow-')) return none;
  const id = personRef.slice('follow-'.length);
  try {
    const { rows } = await dbQuery<{
      group_id: string | null;
      call_round: number | null;
      call_times: string[] | null;
    }>(
      `select group_id, call_round, call_times from ${followTable} where id = $1 limit 1`,
      [id],
    );
    const r = rows[0];
    if (!r) return none;
    const scheduled =
      r.group_id != null ||
      (r.call_round != null && Number(r.call_round) >= 1) ||
      (Array.isArray(r.call_times) && r.call_times.length > 0);
    return { scheduled, groupId: r.group_id ?? null };
  } catch (e) {
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) {
      // ยังไม่รัน 092/113 — ถอยไปอ่านเฉพาะ group_id (พฤติกรรมเดิม ไม่พัง)
      try {
        const { rows } = await dbQuery<{ group_id: string | null }>(
          `select group_id from ${followTable} where id = $1 limit 1`,
          [id],
        );
        const gid = rows[0]?.group_id ?? null;
        return { scheduled: gid != null, groupId: gid };
      } catch (e2) {
        if (isPgUndefinedTable(e2) || isUndefinedColumn(e2)) return none;
        throw e2;
      }
    }
    throw e;
  }
}

/**
 * ═══ ตอบว่า "ไม่ไป" → หยุดรอบที่เหลือของชุด ทั้งคิวฝั่งเรา **และที่ Lumos** ═══
 *
 * 🔴 ไล่ทดสอบ 1 ต.ค. 2569 (เจ้าของ Choice "ตอบว่าไม่ไป แต่ยังโดนโทรรอบต่อไป → แก้"):
 * ของเดิม (`cancelFollowGroup`) ยกเลิกแค่แถวคิวฝั่งเรา — แผนที่ส่งไปตั้งแต่ตอนสร้างยังอยู่ที่ Lumos
 * ⇒ วัดจริง: ชุดหลายรอบที่มีคนตอบว่าไม่ไป 6 ชุด · รอบที่ยังเหลือ 3 รอบ **ถูกโทรต่อครบทั้ง 3**
 *
 * พี่น้องของแถวที่ตอบ = แถวที่ยังรอโทร (pending) ของ **ชุดเดียวกัน** (`group_id`) หรือ **แผนเดียวกัน**
 * (`plan_ref` — ชุดหลายรอบก่อน 21 ก.ย. ไม่มี group_id) · ยกเลิกในคิวแล้วยกเลิก record ที่ Lumos
 * ตามรหัสที่ Lumos รู้จัก (`plan_ref` ของแผน หรือรหัสของแถวเองถ้าเป็นแผนเดี่ยว) · 404 = ไม่มีของค้างแล้ว
 * · แจ้ง Lumos ไม่สำเร็จแค่ log (คิวฝั่งเรายกเลิกไปแล้ว ห้ามทำให้การรับผลล้ม)
 */
export async function cancelFollowSetAfterDecline(personRef: string, groupId: string | null): Promise<number> {
  if (!personRef.startsWith('follow-')) return 0;
  let cancelled: Array<{ person_ref: string; plan_ref: string | null }> = [];
  try {
    ({ rows: cancelled } = await dbQuery<{ person_ref: string; plan_ref: string | null }>(
      `update ${queueTable} q
          set status = 'cancelled', updated_at = now()
        where q.channel = 'reminder' and q.job_ref = 'follow' and q.status = 'pending'
          and q.person_ref <> $1
          and (
            ($2::uuid is not null
              and q.person_ref in (select 'follow-' || f.id::text from ${followTable} f where f.group_id = $2::uuid))
            or q.plan_ref = (
              select me.plan_ref from ${queueTable} me
               where me.channel = 'reminder' and me.job_ref = 'follow' and me.person_ref = $1
               limit 1
            )
          )
          -- เฉพาะ "วันนั้น" (16 ต.ค. 2569): วันเดียวกับสายที่ตอบ (เวลาไทย) · ส่งคนแทน = ใบงานเดียวกันเท่านั้น
          -- 🔴 28 ต.ค. 2569: คนแทนไม่นับ "วันเดียวกัน" แล้ว — สายคอนเฟิร์มของใบพรุ่งนี้เคยหายไปด้วย (ดู followDayScope.ts)
          and exists (
            select 1 from ${followTable} f, ${followTable} me
             where q.person_ref = 'follow-' || f.id::text and $1 = 'follow-' || me.id::text
               and ${followSameStopUnitSql('f', 'me.source_ref', 'me.scheduled_at')}
          )
        returning q.person_ref, q.plan_ref`,
      [personRef, groupId],
    ));
  } catch (e) {
    // ยังไม่รัน 117 (ไม่มี plan_ref) — ถอยไปยกเลิกตามชุดอย่างเดียวแบบเดิม
    if (!isUndefinedColumn(e)) throw e;
    if (groupId) await cancelFollowGroup(groupId);
    return 0;
  }
  if (cancelled.length > 0 && getLumosPushConfig()) {
    const refs = [...new Set(cancelled.map((r) => r.plan_ref ?? r.person_ref))];
    for (const ref of refs) {
      const ok = await withdrawFollowPlanAtLumos(ref).catch((e) => {
        logError('lumos.push.follow.decline.cancel failed (คิวฝั่งเรายกเลิกแล้ว · ตัวส่งซ้ำจะลองใหม่)', e, { personRef, ref });
        return false;
      });
      if (!ok) await markFollowCancelFailed(ref);
    }
    logInfo('lumos.push.follow.decline.cancel', { personRef, rounds: cancelled.length, refs: refs.length });
  }
  return cancelled.length;
}

/** สายในแผนนี้ที่ยังต้องโทร (รอโทร · ยังไม่ถึงเวลา) — มี = ส่งแผนใหม่จากสายที่เหลือ ไม่ใช่ยกเลิกทั้งแผน */
async function pendingFollowInPlan(ref: string): Promise<string | null> {
  const { rows } = await dbQuery<{ id: string }>(
    `select substring(q.person_ref from 8) as id
       from ${queueTable} q
       join ${followTable} f on q.person_ref = 'follow-' || f.id::text
      where q.channel = 'reminder' and q.job_ref = 'follow' and q.status = 'pending'
        and coalesce(q.plan_ref, q.person_ref) = $1
        and f.cancelled_at is null and f.completed_at is null and f.scheduled_at > now()
      order by f.scheduled_at
      limit 1`,
    [ref],
  );
  return rows[0]?.id ?? null;
}

/**
 * ถอนสายที่ยกเลิกออกจากแผนที่ Lumos (28 ต.ค. 2569)
 * - แผนยังมีสายที่ต้องโทร (เช่น สายคอนเฟิร์มของใบพรุ่งนี้อยู่แผนเดียวกัน — Lumos 1 แผนต่อเบอร์ต่อวัน)
 *   ⇒ ส่งแผนใหม่จากสายที่เหลือ (`resyncFollowPlanWithLumos` ตัวเดียวกับปุ่มแก้ตาราง) · เดิมยกเลิกทั้งแผน = สายที่เหลือหายที่ Lumos
 * - ไม่เหลือ ⇒ ยกเลิกแผน (`cancelFollowPlanAtLumos` · แผนที่จบแล้วไม่ส่งซ้ำ · 404 = ไม่มีของค้าง)
 * คืน `false` = ยังไม่สำเร็จ (ต้องให้ตัวส่งซ้ำลองใหม่)
 */
export async function withdrawFollowPlanAtLumos(ref: string): Promise<boolean> {
  const rest = await pendingFollowInPlan(ref);
  if (!rest) {
    await cancelFollowPlanAtLumos(ref);
    return true;
  }
  // import ตอนใช้ — lumosDispatch import ไฟล์นี้อยู่ (กันวง import)
  const { resyncFollowPlanWithLumos } = await import('./lumosDispatch.js');
  const { staffNameOfPhone } = await import('./followStaffName.js');
  const r = await resyncFollowPlanWithLumos(rest, staffNameOfPhone);
  if (!r.cancelled || !r.pushed) {
    logError('lumos.push.follow.decline.resync incomplete', new Error(r.reason ?? 'resync incomplete'), { ref, ...r });
    return false;
  }
  return true;
}

/**
 * 🔴 ยกเลิกที่ Lumos ไม่สำเร็จ (28 ต.ค. 2569 — เดิมจดแค่ log ไม่มีใครรู้ Lumos อาจโทรต่อ)
 * จดที่แถวคิวที่ยกเลิกแล้ว ⇒ `retryFailedFollowCancels` (ทุก 1 นาที) ลองใหม่จนสำเร็จหรือเลยเวลาสาย
 */
export const FOLLOW_CANCEL_FAILED_STATE = 'cancel_failed';

export async function markFollowCancelFailed(ref: string): Promise<void> {
  try {
    await dbQuery(
      `update ${queueTable} set push_state = $2, updated_at = now()
        where channel = 'reminder' and job_ref = 'follow' and status = 'cancelled'
          and coalesce(plan_ref, person_ref) = $1`,
      [ref, FOLLOW_CANCEL_FAILED_STATE],
    );
  } catch (e) {
    logError('lumos.push.follow.cancel.mark failed', e, { ref });
  }
}

/**
 * ยกเลิกทุกแถวคิวที่ยังไม่โทรของชุดตาราง Follow เดียวกัน (declined/เบอร์เสีย → หยุดทั้งชุด)
 * — ยกเลิกเฉพาะ pending (Lumos ดึงไปแล้วยกเลิกฝั่งเราไม่ได้) · ผูกด้วย group_id
 */
export async function cancelFollowGroup(groupId: string): Promise<number> {
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set status = 'cancelled', updated_at = now()
      where channel = 'reminder' and job_ref = 'follow' and status = 'pending'
        and person_ref in (
          select 'follow-' || id::text from ${followTable} where group_id = $1
        )
      returning id`,
    [groupId],
  );
  return rows.length;
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
  /** ต้นทางของงานโทร — ใช้ประกอบ person_ref ให้ตรงแถวคิว (board/irecruit/application) */
  source?: string | null;
  outcome: string;
  declinedScope?: 'job' | 'all' | null;
  detail?: unknown;
  byName?: string | null;
  now?: Date;
}): Promise<CallFollowupDecision | null> {
  if (!isCallOutcome(input.outcome)) return null;
  const now = input.now ?? new Date();

  // หาแถวคิวของคู่ (ใบขอ, คน) ถ้ามี — จับด้วย person_ref เต็มตัวตาม source
  // ⚠️ ต้อง match เป๊ะ (person_ref = $2) ไม่ใช่ like '%'||ref — ดู queuePersonRefFromSource
  let queueId: number | null = null;
  let attemptCount = 1;
  const personRef = input.source ? queuePersonRefFromSource(input.source, input.candidateRef) : null;
  if (personRef) {
    try {
      const { rows } = await dbQuery<{ id: number; attempt_count: number }>(
        `select id, attempt_count from ${queueTable}
          where job_ref = $1 and person_ref = $2
          order by id desc limit 1`,
        [input.jobId, personRef],
      );
      if (rows[0]) {
        queueId = rows[0].id;
        attemptCount = Number(rows[0].attempt_count) || 1;
      }
    } catch (e) {
      if (!isPgUndefinedTable(e) && !isUndefinedColumn(e)) throw e;
    }
  }

  const decision = resolveCallFollowup({
    outcome: input.outcome as CallOutcome,
    attemptCount,
    now,
    requestedCallbackAt: pickRequestedCallbackAt(input.detail),
    declinedScope: input.declinedScope ?? null,
    policy: await getCallFollowupPolicy(),
  });

  // มีแถวคิว → เขียนสถานะให้ลูปเดินต่อได้ (คนโทรไม่ติด AI รับช่วงโทรซ้ำได้)
  if (queueId != null) {
    try {
      if (decision.action === 'retry') {
        // ⚠️ ห้ามเพิ่ม first_delivered_at/first_result_at/last_result_at ลง reset นี้ (088)
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
  // เส้นนี้คือ **คนกดเอง** จากหน้า "โทรของฉัน" (คนได้ยินเสียงจริง + กรอกเบอร์ใหม่ได้ตรงนั้น)
  // ⇒ ยังพักเบอร์ได้ตามเดิม · ต่างจากผลที่ AI อ่านเอง ซึ่งห้ามบล็อกแล้ว (17 ก.ย. 2569)
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
export type NeedsHumanItem = {
  id: number;
  channel: string;
  jobRef: string;
  personRef: string;
  /** ref ของผู้สมัครโดยตัด prefix (card-/ir-/app-) — ใช้กดรับไปตามต่อ */
  candidateRef: string | null;
  source: 'board' | 'irecruit' | 'application' | null;
  candidateName: string | null;
  /** เบอร์สำหรับกด "รับไปตาม" — จำเป็นเพราะล็อกผูกกับเบอร์ */
  phone: string | null;
  lastOutcome: string | null;
  attemptCount: number;
  updatedAt: string;
};

/** person_ref → (source, ref) · follow-xxx ไม่ใช่ผู้สมัครในบอร์ด จึงรับไปตามแบบนี้ไม่ได้ */
function splitPersonRef(personRef: string): {
  source: 'board' | 'irecruit' | 'application' | null;
  ref: string | null;
} {
  if (personRef.startsWith('card-')) return { source: 'board', ref: personRef.slice(5) };
  if (personRef.startsWith('ir-')) return { source: 'irecruit', ref: personRef.slice(3) };
  // ใบสมัครจากบอร์ดรับสมัคร (S8) — hold รองรับ source 'application' อยู่แล้ว (077)
  if (personRef.startsWith('app-')) return { source: 'application', ref: personRef.slice(4) };
  return { source: null, ref: null };
}

/**
 * prefix ของ `person_ref` ตาม source ของงานโทร — inverse ของ `splitPersonRef`
 *
 * ⚠️ ต้องประกอบ prefix ตรงตัวแล้วจับด้วย `person_ref = $n` เท่านั้น
 * **ห้ามใช้ `like '%'||ref`** — `%1805` จับ `card-11805`/`ir-1805` (คนละคน คนละฐาน)
 * แล้ว `order by id desc` เลือกแถวที่ insert ทีหลัง → เขียนผลทับแถวของคนที่ไม่เคยถูกโทร
 * · `application` ยังไม่มีแถวคิว (auto-dispatch ยังไม่เปิด) จึง match 0 แถว = ปลอดภัย
 */
function queuePersonRefFromSource(source: string, ref: string): string | null {
  const r = (ref || '').trim();
  if (!r) return null;
  if (source === 'board') return `card-${r}`;
  if (source === 'irecruit') return `ir-${r}`;
  if (source === 'application') return `app-${r}`;
  return null;
}

function nameFromPayload(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of ['recipient_name', 'candidate_name', 'full_name']) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** ต้นทางของงานโทร — ตรงกับ prefix ของ `person_ref` (ดู splitPersonRef) */
const NEEDS_HUMAN_SOURCE_WHERE = {
  follow: `and person_ref like 'follow-%'`,
  board: `and person_ref like 'card-%'`,
  irecruit: `and person_ref like 'ir-%'`,
} as const;

export async function listNeedsHumanQueueItems(
  limit = 200,
  /** null = ทุกต้นทาง (พฤติกรรมเดิม) · ระบุ = เฉพาะงานที่มาจากหน้านั้น */
  source: keyof typeof NEEDS_HUMAN_SOURCE_WHERE | null = null,
): Promise<NeedsHumanItem[]> {
  const sourceClause = source ? NEEDS_HUMAN_SOURCE_WHERE[source] : '';
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
              ${sourceClause}
        order by updated_at desc
        limit $1`,
      [Math.min(Math.max(limit, 1), 500)],
    );
    // ส่งเฉพาะฟิลด์ที่หน้าเว็บใช้จริง ไม่ dump payload ทั้งก้อน
    return rows.map((r) => {
      const { source, ref } = splitPersonRef(r.person_ref);
      return {
        id: r.id,
        channel: r.channel,
        jobRef: r.job_ref,
        personRef: r.person_ref,
        candidateRef: ref,
        source,
        candidateName: nameFromPayload(r.payload),
        phone: phoneFromPayload(r.payload),
        lastOutcome: r.last_outcome,
        attemptCount: Number(r.attempt_count) || 1,
        updatedAt: r.updated_at,
      };
    });
  } catch (e) {
    if (isPgUndefinedTable(e) || isUndefinedColumn(e)) return [];
    throw e;
  }
}
