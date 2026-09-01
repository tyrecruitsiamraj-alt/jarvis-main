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
import type { FollowDispatchState } from '@/lib/followDispatchState';
import { applyCallFollowupToQueueRow, listSuppressedPhones } from './callFollowup.js';
import { countPendingApprovalByJob, releaseDueCallBatches } from './callBatchStore.js';
import type { BoardMatchResult } from './boardCandidateMatcher.js';
import type { IrecruitMatchResult } from './irecruitCandidateMatcher.js';
import { listHeldPhones } from './candidateCallHolds.js';
import {
  fetchJobBenefitRates,
  monthlyGuaranteedIncome,
  requestNoFromJobRef,
  speakableBenefitLine,
} from './siamrajJobBenefits.js';
import {
  phonesContactedAboutJob,
  phonesContactedAnyJob,
  phonesDeclinedThisUnit,
} from './applicationRotationSql.js';
import { toE164Thai } from './thaiPhone.js';
import { ensureCallScriptsFresh } from './callScriptStore.js';
import { MATCH_RANK_UNKNOWN, matchRankFromTier } from '../../src/lib/matchRank.js';
import { buildJobBrief, speakableDate } from './lumosJobBrief.js';
import {
  activeScriptFingerprint,
  activeScriptSource,
  appendExtraInfoToPayload,
  buildExtraInfoSentence,
  buildFollowMessage,
  buildOfferMessage,
  buildOfferQuestions,
  buildScreeningQuestions,
  type EditableScriptKey,
} from './lumosCallScript.js';
import { getCallFollowupPolicy } from './callFollowupPolicyStore.js';
import {
  CONFIRMED_FOCUS_DAYS,
  DEFAULT_CALL_FOLLOWUP_POLICY,
  shiftOutOfQuietHours,
} from '../../src/lib/callFollowupPolicy.js';
import {
  cancelPushedReminder,
  getLumosPushConfig,
  pushInterviews,
  pushReminders,
} from './lumosPushClient.js';
import type { LumosPushInterviewRecord, LumosPushReminderRecord } from './lumosPushClient.js';
import { resolveInterviewAdminPhone } from './interviewAdminPhone.js';

const queueTable = tableInAppSchema('lumos_dispatch_queue');

// ─── Utils ────────────────────────────────────────────────────────────────────

/** re-export ให้ผู้ใช้เดิมไม่พัง — ตัวจริงอยู่ที่ ./thaiPhone.ts (ตัดวง import กับ callHolds) */
export { toE164Thai };

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * ใส่ `admin_phone` ให้ทุก item ในคิวสัมภาษณ์ — เรียกครั้งเดียวต่อใบขอ (ไม่ใช่ต่อผู้สมัคร)
 * เพราะเบอร์ผู้รับผิดชอบเป็นค่าเดียวกันทั้งใบ — กันยิง DB ซ้ำต่อคน
 */
async function attachInterviewAdminPhone(
  items: Array<{ payload: LumosInterviewPayload }>,
  requestNo: string | null,
): Promise<void> {
  if (items.length === 0) return;
  const adminPhone = await resolveInterviewAdminPhone(requestNo);
  if (!adminPhone) return;
  for (const item of items) item.payload.admin_phone = adminPhone;
}

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
  /**
   * เบอร์เจ้าหน้าที่ — AI โทรหาเบอร์นี้เมื่อโทรหาผู้รับไม่สำเร็จ (E.164)
   * ⚠️ คนละเรื่องกับเบอร์ที่ AI **พูด** ให้ผู้รับโทรกลับ (อันนั้นอยู่ใน `steps[].message`)
   */
  admin_phone?: string;
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
  // วันที่ต้อง "พูดออกเสียงแล้วเข้าใจ" — เดิมส่ง 2026-08-01 ดิบ AI เลยอ่านเป็นตัวเลขเรียง
  const requiredDate = speakableDate(job.required_date);
  // รายละเอียดงานที่ผู้สมัครถามเป็นอย่างแรกเสมอ (ที่ไหน · เวลาไหน · ต้องมีรถไหม)
  // เดิมไม่ได้บอกเลย เขาเลยต้องรอเจ้าหน้าที่โทรกลับมาตอบเรื่องพื้นฐานที่สุด
  const brief = buildJobBrief(job);
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
        // 🔴 ไม่มีตัวเลขรายได้ตรงนี้ — เดิมพูด `total_income` ดิบซึ่งเป็น payment_rate
        // ที่ยังไม่รู้หน่วย (รายวัน 2,608 แถวจาก 16,264) → เติมตอนเสิร์ฟจาก ERP แทน
        message: buildOfferMessage({
          candidateName: match.full_name,
          position,
          unit,
          placeForTravel: brief.workPlace || unit,
          startDate: requiredDate,
          requestNo: result.request_no || result.jobId,
          detail: brief.detail,
        }),
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
  /** เบอร์เจ้าหน้าที่ — AI โทรหาเมื่อโทรหาผู้สมัครไม่สำเร็จ ใส่ตอน enqueue (ดู resolveInterviewAdminPhone) */
  admin_phone?: string;
  position: string;
  scheduled_at: string;
  questions: string[];
  type: string;
  language: string;
  tone: string;
  skills?: string[];
  priority?: 'high' | 'medium' | 'low';
};

export function buildInterviewPayload(
  job: Record<string, unknown>,
  result: Pick<IrecruitMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  match: { id: number; full_name: string; phone_number: string | null; job_name_th: string | null; position_name: string | null },
  now = new Date(),
  priority?: 'high' | 'medium' | 'low',
): LumosInterviewPayload | null {
  const phone = toE164Thai(match.phone_number);
  if (!phone || !match.full_name) return null;
  const position = jobPositionLabel(job, result.job_family_label);
  const unit = str(job.unit_name) || 'หน่วยงานของเรา';
  const skills = [match.job_name_th, match.position_name]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  const brief = buildJobBrief(job);
  /**
   * ฝั่ง interview ไม่มีช่องข้อความอิสระเหมือน reminder — ที่พูดได้คือ `questions`
   * จึงเอารายละเอียดงานไปผูกกับคำถามให้เป็นคำถามที่ "บอกข้อมูลไปในตัว"
   * (ถามเรื่องเดินทางโดยระบุสถานที่จริง · ถามเรื่องเวลาโดยบอกเวลาจริง)
   *
   * คนจาก iRecruit **ยังไม่ได้สมัครงานใบนี้** → บท Part 1 (สัมภาษณ์เบื้องต้น)
   */
  const placeForTravel = brief.workPlace && brief.workPlace !== unit ? brief.workPlace : unit;
  return {
    client_candidate_id: `${result.jobId}::ir-${match.id}`,
    client_interview_id: `${result.jobId}::ir-${match.id}::interview`,
    candidate_name: match.full_name,
    phone,
    position,
    scheduled_at: now.toISOString(),
    questions: buildScreeningQuestions({
      candidateName: match.full_name,
      position,
      unit,
      placeForTravel,
      workSchedule: brief.workSchedule,
      needsOwnVehicle: brief.needsOwnVehicle,
      startDate: speakableDate(job.required_date),
    }),
    type: 'phone',
    language: 'th',
    tone: 'professional',
    ...(skills.length ? { skills } : {}),
    ...(priority ? { priority } : {}),
  };
}

/**
 * payload สำหรับ **ใบสมัครจากบอร์ดรับสมัคร** (S8 · เจ้าของเคาะ 15 ส.ค. 2569:
 * "เมื่อมีคนกรอกรายชื่อเข้ามาผ่านหน้าสาธารณะ...ส่งให้ Lumos โทร" — อัตโนมัติทันทีที่กรอก)
 *
 * ใช้ช่อง interview (โทรถามความสนใจ-คัดกรอง) · personRef = `app-<uuid>`
 * ข้อมูลงานใช้ snapshot บนใบ (job_title/unit_name) — ไม่ต้องยิง ERP (เส้นนี้ถูกเรียก
 * จาก /api/public/apply ซึ่งห้ามแตะ ERP เด็ดขาด)
 */
export function buildApplicationInterviewPayload(
  app: {
    id: string;
    full_name: string;
    phone: string | null;
    job_id: string | null;
    job_title?: string | null;
    unit_name?: string | null;
    position_interest?: string | null;
  },
  now = new Date(),
): LumosInterviewPayload | null {
  const phone = toE164Thai(app.phone);
  if (!phone || !app.full_name?.trim() || !app.job_id) return null;
  const position = (app.job_title || app.position_interest || 'งานที่เปิดรับ').trim();
  const unit = (app.unit_name || '').trim() || 'หน่วยงานของเรา';
  return {
    client_candidate_id: `${app.job_id}::app-${app.id}`,
    client_interview_id: `${app.job_id}::app-${app.id}::interview`,
    candidate_name: app.full_name.trim(),
    phone,
    position,
    scheduled_at: now.toISOString(),
    // เขากรอกใบสมัครมาเองแล้ว → บท Part 2 (เสนองาน) ไม่ใช่บทแนะนำตัวหาคนแปลกหน้า
    // ⚠️ เส้นนี้ถูกเรียกจาก /api/public/apply ซึ่งห้ามยิง ERP — ข้อมูลงานมีแค่ snapshot
    // บนใบ (ไม่มีเวลาทำงาน/เงื่อนไขรถ) บทจึงสั้นกว่าเส้นอื่นโดยตั้งใจ
    questions: buildOfferQuestions({
      candidateName: app.full_name,
      position,
      unit,
      placeForTravel: unit,
    }),
    type: 'phone',
    language: 'th',
    tone: 'professional',
  };
}

/**
 * payload ของ **เลนสรรหา** (R2b) — คนที่ยังไม่สมัคร จาก 3 แหล่งรวมกัน
 *
 * ใช้ตัวเดียวทุกแหล่งเพื่อให้คนที่รับสายได้ยินเหมือนกันหมด (เจ้าของ: *"Format ก็ทำให้
 * มันเท่ากัน"*) — ต่างกันแค่ `ref` ที่ผูกกลับไปยังฐานต้นทาง
 * `ref` ต้องเป็น person_ref เต็ม (`ir-` / `app-` / `card-`) แล้ว client_candidate_id
 * จะออกมาเป็น `<jobId>::<ref>` = รูปแบบเดียวกับเส้นเดิมเป๊ะ
 */
export function buildRecruitLaneInterviewPayload(
  job: Record<string, unknown>,
  result: { jobId: string; job_family_label: string | null },
  candidate: { ref: string; full_name: string; phone_number: string | null; position_text: string },
  now = new Date(),
): LumosInterviewPayload | null {
  const phone = toE164Thai(candidate.phone_number);
  if (!phone || !candidate.full_name.trim() || !candidate.ref.trim()) return null;
  const position = jobPositionLabel(job, result.job_family_label);
  const unit = str(job.unit_name) || 'หน่วยงานของเรา';
  const brief = buildJobBrief(job);
  const placeForTravel = brief.workPlace && brief.workPlace !== unit ? brief.workPlace : unit;
  const skills = candidate.position_text.trim() ? [candidate.position_text.trim()] : [];
  return {
    client_candidate_id: `${result.jobId}::${candidate.ref}`,
    client_interview_id: `${result.jobId}::${candidate.ref}::interview`,
    candidate_name: candidate.full_name.trim(),
    phone,
    position,
    scheduled_at: now.toISOString(),
    // เลนสรรหา = คนที่ยังไม่ได้สมัครงานใบนี้ → บท Part 1 (สัมภาษณ์เบื้องต้น)
    questions: buildScreeningQuestions({
      candidateName: candidate.full_name,
      position,
      unit,
      placeForTravel,
      workSchedule: brief.workSchedule,
      needsOwnVehicle: brief.needsOwnVehicle,
      startDate: speakableDate(job.required_date),
    }),
    type: 'phone',
    language: 'th',
    tone: 'professional',
    ...(skills.length ? { skills } : {}),
  };
}

/**
 * ส่งใบสมัครเข้าคิว AI โทร — ใช้ทั้งเส้น auto (ตอนกรอกเสร็จ · flag
 * APPLICATION_AUTO_DISPATCH_ENABLED) และปุ่ม manual ในกล่องงาน
 * กันชั้นเดิมครบที่ insertQueueItems (held + suppressed) · แถวยกเลิก revive ได้
 */
export async function enqueueLumosInterviewForApplications(
  jobId: string,
  applications: Array<{
    id: string;
    full_name: string;
    phone: string | null;
    job_id: string | null;
    job_title?: string | null;
    unit_name?: string | null;
    position_interest?: string | null;
  }>,
  opts?: { autoPush?: boolean },
): Promise<LumosDispatchOutcome> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  const skipped: LumosDispatchOutcome['skipped'] = [];
  const items: Array<{ personRef: string; payload: LumosInterviewPayload; matchRank: number | null }> = [];
  for (const app of applications) {
    const payload = buildApplicationInterviewPayload(app);
    if (!payload) {
      skipped.push({ ref: `app-${app.id}`, name: app.full_name, reason: NO_PHONE_REASON });
      continue;
    }
    // ใบสมัครไม่มี tier จาก AI แมท — null = MATCH_RANK_UNKNOWN (เท่าเหลือง) ตอนเสิร์ฟ
    items.push({ personRef: `app-${app.id}`, payload, matchRank: null });
  }
  await attachInterviewAdminPhone(items, requestNoFromJobRef(jobId));
  const { added, held, suppressed, declined, guarded } = await insertQueueItems('interview', jobId, items);
  const addedSet = new Set(added);
  const heldSet = new Set(held);
  /**
   * 🔴 "ไม่ได้ส่ง" ทุกเหตุผลรวมที่เดียว — เดิมนับ `duplicated` โดยตัดแค่ held/declined
   * ⇒ คนที่ถูก **พักเบอร์** หรือ **กันไว้ก่อนเพราะตรวจไม่ได้** ถูกนับเป็น "เคยส่งแล้ว"
   * ทั้งที่ไม่เคยส่ง · รายงานบนจอเลยบอกผิดทาง
   */
  const skippedSet = new Set([...held, ...suppressed, ...declined, ...guarded]);
  const nameByRef = new Map(applications.map((a) => [`app-${a.id}`, a.full_name]));
  for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
  for (const ref of suppressed) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
  }
  for (const ref of declined) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: DECLINED_REASON });
  }
  for (const ref of guarded) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: GUARDED_REASON });
  }
  const declinedSet = new Set(declined);
  const duplicated = items
    .map((i) => i.personRef)
    .filter((ref) => !addedSet.has(ref) && !skippedSet.has(ref));
  logInfo('lumos.dispatch.application', {
    jobId,
    requested: applications.length,
    queued: added.length,
    duplicated: duplicated.length,
    held: held.length,
    suppressed: suppressed.length,
    skipped: skipped.length,
  });
  if (opts?.autoPush && added.length > 0 && getLumosPushConfig()) {
    const pushPayloads = items
      .filter((i) => addedSet.has(i.personRef))
      .map((i) => i.payload as unknown as LumosPushInterviewRecord);
    try {
      await pushInterviews(pushPayloads);
      logInfo('lumos.push.application.ok', { jobId, pushed: pushPayloads.length });
    } catch (e) {
      logError('lumos.push.application failed (ยังอยู่ในคิว — Lumos โทรดึงได้เอง)', e, { jobId });
    }
  }
  return { queued: added.length, duplicated, skipped };
}

// ─── Enqueue (คนกดส่งเอง — ต้องรายงานผลกลับให้ผู้ใช้) ───────────────────────

/**
 * ชื่อคีย์ของเบอร์ใน payload — **ต่างกันตามช่อง**
 * reminder (คนของเรา) ใช้ `recipient_phone` · interview (iRecruit) ใช้ `phone`
 *
 * ⚠️ เดิมอ่านแค่ `recipient_phone` → ฝั่ง iRecruit ได้ null ทุกแถว แปลว่า
 * **ล็อก "รับไปโทรเอง" และการพักเบอร์ไม่เคยมีผลกับช่อง interview เลย**
 * (โค้ดข้ามการเช็คทั้งสองอย่างเมื่อไม่มีเบอร์) — อาการคือ AI โทรทับคนที่เจ้าหน้าที่
 * รับไปโทรเองอยู่ และโทรหาคนที่บอกว่า "ไม่หางานแล้ว" เฉพาะทางฝั่ง iRecruit
 * ที่เดียวกับที่ `phoneFromPayload()` ใน callFollowup.ts อ่านครบทั้งสองคีย์อยู่แล้ว
 */
const PAYLOAD_PHONE_KEYS = ['recipient_phone', 'phone'] as const;

/** เบอร์ผู้รับใน payload ฝั่ง SQL — ต้องตรงกับ PAYLOAD_PHONE_KEYS เสมอ */
const phoneExprFor = (alias: string): string =>
  `coalesce(${PAYLOAD_PHONE_KEYS.map((k) => `${alias}.payload->>'${k}'`).join(', ')})`;

/** อ่านเบอร์ผู้รับออกจาก payload — ใช้เทียบกับล็อก "รับไปโทรเอง" และรายการพักเบอร์ */
function payloadPhone(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  for (const key of PAYLOAD_PHONE_KEYS) {
    const v = p[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/**
 * on-conflict ที่ **ชุบชีวิตแถวที่ถูกยกเลิก** แทนการเงียบ (`do nothing` เดิม)
 *
 * ⚠️ unique `(channel, job_ref, person_ref)` เป็น constraint เต็มตาราง (migration 059)
 * แถว `cancelled` จึงยังกินสิทธิ์คู่ (คน, ใบ) นั้นอยู่ · `do nothing` เดิมทำให้ส่งซ้ำ
 * คนเดิม+ใบเดิมไม่ได้เลย — เงียบ ๆ ได้ 0 แถว (เจอตอนล้างคิว 4,849 แถวเป็น cancelled)
 *
 * `where ... status = 'cancelled'` = revive เฉพาะแถวที่ยกเลิกแล้ว · แถว active
 * (pending/delivered/มีผล) ยังกันซ้ำเหมือนเดิม (update ไม่ผ่านเงื่อนไข → ไม่ returning →
 * นับเป็น duplicated) · **ต้อง reset `result` + `delivery_count` ด้วย** ไม่งั้น
 * `takePendingLumosItems()` ไม่หยิบ (มันกรอง `result is null` และ `delivery_count < MAX`)
 */
// ⚠️ **ห้ามเพิ่ม first_delivered_at / first_result_at / last_result_at ลงรายการ reset นี้**
// (migration 088) — สามคอลัมน์นั้นคือหลักฐานประวัติแบบเขียนครั้งเดียว ใช้คิด "โทรแล้ว/
// เวลารอโทร" บน dashboard · revive แล้วล้าง = ประวัติการโทรจริงหายเงียบ (มีเทสต์ guard คุม)
const REVIVE_CANCELLED_SET = `set status = 'pending', result = null, last_outcome = null,
        delivered_at = null, delivery_count = 0, attempt_count = 1,
        followup_state = null, next_attempt_at = excluded.next_attempt_at,
        payload = excluded.payload, updated_at = now()`;
const REVIVE_CANCELLED_ON_CONFLICT = `on conflict (channel, job_ref, person_ref) do update
        ${REVIVE_CANCELLED_SET}, match_rank = excluded.match_rank
        where ${queueTable}.status = 'cancelled'`;
const REVIVE_CANCELLED_ON_CONFLICT_NO_RANK = `on conflict (channel, job_ref, person_ref) do update
        ${REVIVE_CANCELLED_SET}
        where ${queueTable}.status = 'cancelled'`;

/**
 * insert คิว — คืน ref ที่เข้าคิวใหม่จริง (`added`) กับ ref ที่ไม่ส่งเพราะคนถือไปโทรเอง (`held`)
 *
 * **คอขวดเดียวของการเข้าคิวทุกเส้น** (auto / คนติ๊กเลือก / หน้า Follow) — กรองล็อกที่นี่
 * ที่เดียวจึงครอบทุกทางเข้า: เบอร์ที่เจ้าหน้าที่กด "รับไปโทรเอง" ไว้ AI จะไม่แตะ
 * ตารางล็อกยังไม่ถูก migrate ก็ไม่พัง — listHeldPhones() คืนเซ็ตว่าง
 */
/**
 * 🔴 กันเสนอซ้ำใบที่เคยปฏิเสธ — **ถาวร** (เจ้าของสั่ง 16 ส.ค. 2569) วางที่คอขวดนี้
 * เพื่อครอบทุกทางเข้า (auto / คนติ๊กเลือก / เส้นชวนกลับ) · ยกเว้น job_ref='follow'
 * (ตารางโทรตามคนละเรื่อง — ปฏิเสธหัวข้อหนึ่งไม่ได้แปลว่าห้ามตามเรื่องอื่นตลอดไป)
 */
/**
 * ═══ "สายนี้ AI ใช้บทชุดไหน" ═══
 *
 * เดาได้จากคอขวดเข้าคิวโดยไม่ต้องให้ทุกจุดที่เรียกส่งมาเอง:
 *   ช่อง interview            → บทสัมภาษณ์เบื้องต้น (คนยังไม่ได้สมัครใบนี้)
 *   ช่อง reminder + job_ref 'follow' → บทติดตาม (งานตามนัดที่เจ้าหน้าที่ตั้งเอง)
 *   ช่อง reminder อื่น ๆ       → บทเสนองาน (คนที่ติดต่อเรามาแล้ว)
 *
 * ⚠️ ผูกกับกติกา `job_ref='follow'` ที่ใช้อยู่แล้วในไฟล์นี้ (ดูตัวกรอง "ปฏิเสธถาวร")
 * เปลี่ยนค่านั้นเมื่อไหร่ ต้องแก้ที่นี่ด้วย
 */
function scriptKeyFor(channel: 'reminder' | 'interview', jobRef: string): EditableScriptKey {
  if (channel === 'interview') return 'interview';
  return jobRef === 'follow' ? 'follow' : 'offer';
}

/**
 * จดป้ายบทลงแถวคิว — **แยกจาก insert โดยตั้งใจ**
 *
 * 🔴 ห้ามให้เรื่องนี้ทำให้คิวเข้าไม่ได้ · เป็นข้อมูลไว้ย้อนตรวจ ไม่ใช่ของที่สายต้องใช้
 * ⇒ ยังไม่ได้รัน migration 112 ก็แค่ไม่มีป้าย คิวเดินปกติ (แพตเทิร์นเดียวกับ
 *   `first_delivered_at` ของ 088)
 * 🔴 **ไม่ยัดลง payload** เพราะ payload ถูกส่งให้ Lumos ทั้งก้อน และ Lumos กลืน field
 *   ที่ไม่รู้จักแบบเงียบ ๆ — เพิ่มเข้า payload ได้ต่อเมื่อฝั่งนั้นยืนยันว่ารับได้
 */
/**
 * งานติดตามหนึ่งแถวใช้ **สองบท** (สายแรก + รอบถัดไป) — ป้ายจึงต้องครอบทั้งคู่
 * ไม่งั้นแก้บทรอบสองแล้วลายนิ้วมือไม่ขยับ ย้อนดูไม่รู้ว่าเปลี่ยนอะไรไป
 */
function dispatchScriptFingerprint(key: EditableScriptKey): string {
  if (key !== 'follow') return activeScriptFingerprint(key);
  return `${activeScriptFingerprint('follow')}+${activeScriptFingerprint('follow_repeat')}`;
}

/** แก้บทไหนก็ตามในงานติดตาม ถือว่าเป็นฉบับแก้ */
function dispatchScriptSource(key: EditableScriptKey): 'default' | 'custom' {
  if (key !== 'follow') return activeScriptSource(key);
  return activeScriptSource('follow') === 'custom' || activeScriptSource('follow_repeat') === 'custom'
    ? 'custom'
    : 'default';
}

async function stampScriptTag(
  ids: number[],
  channel: 'reminder' | 'interview',
  jobRef: string,
): Promise<void> {
  if (ids.length === 0) return;
  const key = scriptKeyFor(channel, jobRef);
  try {
    await dbQuery(
      `update ${queueTable}
          set script_key = $2, script_source = $3, script_fingerprint = $4
        where id = any($1::bigint[])`,
      [ids, key, dispatchScriptSource(key), dispatchScriptFingerprint(key)],
    );
  } catch (e) {
    if (!isUndefinedColumnError(e)) throw e;
    logError('lumos.queue.script_tag.missing', {
      hint: 'ยังไม่ได้รัน migration 112 — คิวเดินปกติแต่ไม่มีป้ายบอกว่าใช้บทไหน',
    });
  }
}

async function insertQueueItems(
  channel: 'reminder' | 'interview',
  jobRef: string,
  /**
   * `matchRank` = ลำดับจาก tier ของ AI (ดู src/lib/matchRank.ts) · ไม่ส่ง = ท้ายแถว
   * `scheduledFor` = เวลาที่ **เร็วสุด**ที่จะเสิร์ฟแถวนี้ให้ Lumos (ISO) — ใช้กับ Follow
   * ตั้งตาราง (แถววันอนาคตต้องไม่ถูกเสิร์ฟ+bump มาโทรวันนี้) · จะ max กับ quiet-hours
   */
  items: Array<{ personRef: string; payload: unknown; matchRank?: number | null; scheduledFor?: string | null }>,
): Promise<{
  added: string[];
  held: string[];
  suppressed: string[];
  declined: string[];
  /**
   * 🔴 **กันไว้ก่อนเพราะ "ตรวจไม่ได้" ไม่ใช่ "ติดเงื่อนไข"** (แยกออกมา 25 ส.ค. 2569)
   *
   * เดิมเคสนี้ถูกยัดรวมไปกับ `held` ทำให้รายงานบอกว่า "เจ้าหน้าที่รับไปโทรเอง"
   * ทั้งที่ไม่มีใครรับ · ตามหาสาเหตุไม่เจอเลยว่างานหายไปไหน
   * (เจอจริง: รายการติดตาม 24 ส.ค. 2569 ไม่เข้าคิวโดยไม่มีใครรู้)
   *
   * ต่างกันตรง **แก้ได้ไหม**: `held` ต้องรอเจ้าหน้าที่ปล่อยเบอร์ ·
   * `guarded` แค่ลองส่งใหม่ก็ผ่าน (ตอนนั้นอ่านตารางไม่ได้ชั่วคราว)
   */
  guarded: string[];
}> {
  const added: string[] = [];
  /** id ของแถวที่เพิ่ง insert สำเร็จ — ใช้จดป้ายบทท้ายลูป */
  const insertedIds: number[] = [];
  const held: string[] = [];
  const suppressed: string[] = [];
  const guarded: string[] = [];
  const declined: string[] = [];
  if (items.length === 0) return { added, held, suppressed, declined, guarded };

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

  // เบอร์ที่เคยปฏิเสธ **หน่วยงานนี้** — ไม่เสนอซ้ำตลอดไป (ไม่ใช่แค่ 30 วัน · Phase 6.8)
  // 🔴 เดิมกันแค่ระดับใบขอ → คนที่บอกไม่เอาไซต์หนึ่งยังถูกเสนอไซต์เดิมซ้ำผ่านใบขอใบอื่น
  // ตอนนี้กันทุกใบขอของไซต์เดียวกัน (jobSiteMap) · ไม่รู้ไซต์ = กันระดับใบขอเหมือนเดิม
  // อ่านไม่ได้ = ไม่กรอง (ตารางเดียวกับคิวเอง — ถ้าพังจริง insert ข้างล่างก็พังอยู่ดี)
  let declinedPhones: Set<string>;
  try {
    declinedPhones =
      jobRef === 'follow'
        ? new Set()
        : await phonesDeclinedThisUnit(
            jobRef,
            items.map((i) => payloadPhone(i.payload)).filter((p): p is string => Boolean(p)),
          );
  } catch {
    declinedPhones = new Set();
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
        // อ่านรายการพักเบอร์ไม่ได้ → กันไว้ก่อน · 🔴 นับเป็น `guarded` **ไม่ใช่ `held`**
        // (เดิมยัดรวมกับ held แล้วรายงานโกหกว่า "เจ้าหน้าที่รับไปโทรเอง" ทั้งที่ไม่มีใครรับ)
        guarded.push(item.personRef);
        continue;
      }
      if (suppressedPhones.has(phone)) {
        suppressed.push(item.personRef);
        continue;
      }
      if (declinedPhones.has(phone)) {
        declined.push(item.personRef);
        continue;
      }
    }
    // เวลาเสิร์ฟเร็วสุด = ช้ากว่าเสมอระหว่าง quiet-hours (nextAttemptAt) กับ scheduledFor
    // ของรายการ (Follow ตั้งตาราง: วันอนาคตต้องรอถึงวันนั้นก่อนเสิร์ฟ ไม่งั้น bump มาโทรวันนี้)
    let itemNextAttempt = nextAttemptAt;
    if (item.scheduledFor) {
      const sched = new Date(item.scheduledFor);
      if (!Number.isNaN(sched.getTime())) {
        const base = nextAttemptAt ? new Date(nextAttemptAt) : new Date();
        itemNextAttempt = (sched.getTime() > base.getTime() ? sched : base).toISOString();
      }
    }
    const base = [channel, jobRef, item.personRef, JSON.stringify(item.payload), itemNextAttempt];
    const rank = item.matchRank ?? null;
    let rows: Array<{ id: number }>;
    try {
      ({ rows } = await dbQuery<{ id: number }>(
        `insert into ${queueTable} (channel, job_ref, person_ref, payload, next_attempt_at, match_rank)
         values ($1, $2, $3, $4::jsonb, $5, $6)
         ${REVIVE_CANCELLED_ON_CONFLICT}
         returning id`,
        [...base, rank],
      ));
    } catch (e) {
      // ⚠️ ยังไม่รัน 084 → **ต้องยังเข้าคิวได้** ไม่งั้นการส่งงานพังทั้งระบบเพราะคอลัมน์เสริม
      if (!isUndefinedColumnError(e)) throw e;
      ({ rows } = await dbQuery<{ id: number }>(
        `insert into ${queueTable} (channel, job_ref, person_ref, payload, next_attempt_at)
         values ($1, $2, $3, $4::jsonb, $5)
         ${REVIVE_CANCELLED_ON_CONFLICT_NO_RANK}
         returning id`,
        base,
      ));
    }
    if (rows.length > 0) {
      added.push(item.personRef);
      insertedIds.push(rows[0].id);
    }
  }
  // จดว่าแถวพวกนี้ใช้บทชุดไหน — ล้มก็ไม่กระทบการเข้าคิว (ดู stampScriptTag)
  await stampScriptTag(insertedIds, channel, jobRef);
  return { added, held, suppressed, declined, guarded };
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
const DECLINED_REASON = 'เคยปฏิเสธงานนี้ไปแล้ว — ไม่เสนอซ้ำ';
/**
 * 🔴 คนละเรื่องกับ HELD — อันนี้คือ "ระบบตรวจไม่ได้" ไม่ใช่ "มีคนจองไปแล้ว"
 * ต้องบอกให้ชัดว่า **ลองใหม่ได้** ไม่งั้นคนนั่งรอสายที่ไม่มีวันออก (เจอจริง 24 ส.ค. 2569)
 */
const GUARDED_REASON = 'ระบบตรวจบัญชีห้ามโทรไม่ได้ตอนนั้น จึงกันไว้ก่อน — กดส่งใหม่ได้';

/** ผู้สมัคร "คนของเรา" ที่คนติ๊กเลือก → คิว reminder */
export async function enqueueLumosReminderForSelected(
  job: Record<string, unknown>,
  result: Pick<BoardMatchResult, 'jobId' | 'request_no'> & { job_family_label: string | null },
  /** `tier` มาจากผล AI แมท — ไม่มีก็ส่งได้ แค่ไปต่อท้ายคิว (ดู src/lib/matchRank.ts) */
  selected: Array<{
    card_id: number;
    full_name: string;
    mobile: string | null;
    tier?: string | null;
  }>,
  opts?: { autoPush?: boolean },
): Promise<LumosDispatchOutcome> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  const skipped: LumosDispatchOutcome['skipped'] = [];
  const items: Array<{ personRef: string; payload: LumosReminderPayload; matchRank: number }> = [];
  for (const m of selected) {
    const payload = buildReminderPayload(job, result, m);
    if (!payload) {
      skipped.push({ ref: `card-${m.card_id}`, name: m.full_name, reason: NO_PHONE_REASON });
      continue;
    }
    items.push({ personRef: `card-${m.card_id}`, payload, matchRank: matchRankFromTier(m.tier) });
  }
  const { added, held, suppressed, declined, guarded } = await insertQueueItems('reminder', result.jobId, items);
  const addedSet = new Set(added);
  const heldSet = new Set(held);
  /**
   * 🔴 "ไม่ได้ส่ง" ทุกเหตุผลรวมที่เดียว — เดิมนับ `duplicated` โดยตัดแค่ held/declined
   * ⇒ คนที่ถูก **พักเบอร์** หรือ **กันไว้ก่อนเพราะตรวจไม่ได้** ถูกนับเป็น "เคยส่งแล้ว"
   * ทั้งที่ไม่เคยส่ง · รายงานบนจอเลยบอกผิดทาง
   */
  const skippedSet = new Set([...held, ...suppressed, ...declined, ...guarded]);
  const nameByRef = new Map(selected.map((m) => [`card-${m.card_id}`, m.full_name]));
  for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
  for (const ref of suppressed) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
  }
  for (const ref of declined) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: DECLINED_REASON });
  }
  for (const ref of guarded) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: GUARDED_REASON });
  }
  const declinedSet = new Set(declined);
  const duplicated = items
    .map((i) => i.personRef)
    .filter((ref) => !addedSet.has(ref) && !skippedSet.has(ref));
  logInfo('lumos.dispatch.reminder.manual', {
    jobId: result.jobId,
    requested: selected.length,
    queued: added.length,
    duplicated: duplicated.length,
    held: held.length,
    suppressed: suppressed.length,
    skipped: skipped.length,
  });
  if (opts?.autoPush && added.length > 0 && getLumosPushConfig()) {
    const pushPayloads = items
      .filter((i) => addedSet.has(i.personRef))
      .map((i) => i.payload as unknown as LumosPushReminderRecord);
    try {
      await pushReminders(pushPayloads);
      logInfo('lumos.push.reminder.manual.ok', { jobId: result.jobId, pushed: pushPayloads.length });
    } catch (e) {
      logError('lumos.push.reminder.manual failed (ยังอยู่ในคิว — Lumos โทรดึงได้เอง)', e, { jobId: result.jobId });
    }
  }
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
    tier?: string | null;
  }>,
  priority?: 'high' | 'medium' | 'low',
  opts?: { autoPush?: boolean },
): Promise<LumosDispatchOutcome> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  const skipped: LumosDispatchOutcome['skipped'] = [];
  const items: Array<{ personRef: string; payload: LumosInterviewPayload; matchRank: number }> = [];
  for (const m of selected) {
    const payload = buildInterviewPayload(job, result, m, new Date(), priority);
    if (!payload) {
      skipped.push({ ref: `ir-${m.id}`, name: m.full_name, reason: NO_PHONE_REASON });
      continue;
    }
    items.push({ personRef: `ir-${m.id}`, payload, matchRank: matchRankFromTier(m.tier) });
  }
  await attachInterviewAdminPhone(items, result.request_no || requestNoFromJobRef(result.jobId));
  const { added, held, suppressed, declined, guarded } = await insertQueueItems('interview', result.jobId, items);
  const addedSet = new Set(added);
  const heldSet = new Set(held);
  /**
   * 🔴 "ไม่ได้ส่ง" ทุกเหตุผลรวมที่เดียว — เดิมนับ `duplicated` โดยตัดแค่ held/declined
   * ⇒ คนที่ถูก **พักเบอร์** หรือ **กันไว้ก่อนเพราะตรวจไม่ได้** ถูกนับเป็น "เคยส่งแล้ว"
   * ทั้งที่ไม่เคยส่ง · รายงานบนจอเลยบอกผิดทาง
   */
  const skippedSet = new Set([...held, ...suppressed, ...declined, ...guarded]);
  const nameByRef = new Map(selected.map((m) => [`ir-${m.id}`, m.full_name]));
  for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
  for (const ref of suppressed) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
  }
  for (const ref of declined) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: DECLINED_REASON });
  }
  for (const ref of guarded) {
    skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: GUARDED_REASON });
  }
  const declinedSet = new Set(declined);
  const duplicated = items
    .map((i) => i.personRef)
    .filter((ref) => !addedSet.has(ref) && !skippedSet.has(ref));
  logInfo('lumos.dispatch.interview.manual', {
    jobId: result.jobId,
    requested: selected.length,
    queued: added.length,
    duplicated: duplicated.length,
    held: held.length,
    suppressed: suppressed.length,
    skipped: skipped.length,
  });
  if (opts?.autoPush && added.length > 0 && getLumosPushConfig()) {
    const pushPayloads = items
      .filter((i) => addedSet.has(i.personRef))
      .map((i) => i.payload as unknown as LumosPushInterviewRecord);
    try {
      await pushInterviews(pushPayloads);
      logInfo('lumos.push.interview.manual.ok', { jobId: result.jobId, pushed: pushPayloads.length });
    } catch (e) {
      logError('lumos.push.interview.manual failed (ยังอยู่ในคิว — Lumos โทรดึงได้เอง)', e, { jobId: result.jobId });
    }
  }
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

/**
 * ผลกดค้นหา iRecruit (green/yellow) → คิว interview
 * เจ้าของเคาะ 16 ส.ค.: เลนคัดสรร "ค้นเจอแล้วส่ง AI ทันที ไม่ต้องอนุมัติ" (เขียว+เหลือง)
 * · กัน 30 วันต่องาน (R1) — คนเพิ่งถูกโทรเรื่องงานนี้ไม่ส่งซ้ำ
 * · OT/สวัสดิการติดไปเองตอนเสิร์ฟคิว (takePendingLumosItems · ช่อง interview)
 * คืน outcome ให้ผู้เรียกรายงาน (ถ้าเรียกจาก auto flow เดิมไม่สนใจค่าคืนก็ได้)
 */
export async function enqueueLumosInterviewForIrecruit(
  job: Record<string, unknown>,
  result: IrecruitMatchResult,
): Promise<LumosDispatchOutcome & { cooldownSkipped: number }> {
  const empty = { queued: 0, duplicated: [] as string[], skipped: [], cooldownSkipped: 0 };
  try {
    const auto = result.matches.filter((m) => m.tier === 'green' || m.tier === 'yellow');
    if (auto.length === 0) return empty;

    // กัน 30 วัน — เบอร์ที่เพิ่งถูกติดต่อเรื่องงานนี้ ตัดออกก่อนเข้าคิว
    const phones = auto
      .map((m) => toE164Thai(m.phone_number))
      .filter((p): p is string => Boolean(p));
    const recentlyContacted = await phonesContactedAboutJob(result.jobId, phones);
    const eligible = auto.filter((m) => {
      const e164 = toE164Thai(m.phone_number);
      return !e164 || !recentlyContacted.has(e164); // เบอร์แปลงไม่ได้ปล่อยผ่าน (โดนคัดที่ payload อยู่แล้ว)
    });
    const cooldownSkipped = auto.length - eligible.length;
    if (eligible.length === 0) return { ...empty, cooldownSkipped };

    const outcome = await enqueueLumosInterviewForSelected(job, result, eligible);
    if (outcome.queued > 0) {
      logInfo('lumos.dispatch.interview.auto', {
        jobId: result.jobId,
        queued: outcome.queued,
        matched: auto.length,
        cooldownSkipped,
      });
    }
    return { ...outcome, cooldownSkipped };
  } catch (e) {
    logError('lumos.dispatch.interview.fail', {
      jobId: result.jobId,
      message: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

/**
 * payload ของเส้น "ชวนกลับ" ในเลนคัดสรร (16 ส.ค. 2569) — คนที่**สมัครไว้แล้ว**
 * แต่เคยปฏิเสธงานอื่น · คำถามแรกต้องอ้างว่าเขาเคยสมัครกับเรา ไม่ใช่แนะนำตัวใหม่
 * (ถ้าใช้ประโยคของเลนสรรหา เขาจะงงว่าไปเอาเบอร์มาจากไหน ทั้งที่เขากรอกให้เราเอง)
 */
export function buildRecallInterviewPayload(
  job: Record<string, unknown>,
  result: { jobId: string; job_family_label: string | null },
  candidate: { ref: string; full_name: string; phone_number: string | null; position_text: string },
  now = new Date(),
): LumosInterviewPayload | null {
  const phone = toE164Thai(candidate.phone_number);
  if (!phone || !candidate.full_name.trim() || !candidate.ref.trim()) return null;
  const position = jobPositionLabel(job, result.job_family_label);
  const unit = str(job.unit_name) || 'หน่วยงานของเรา';
  const brief = buildJobBrief(job);
  const placeForTravel = brief.workPlace && brief.workPlace !== unit ? brief.workPlace : unit;
  const skills = candidate.position_text.trim() ? [candidate.position_text.trim()] : [];
  return {
    client_candidate_id: `${result.jobId}::${candidate.ref}`,
    client_interview_id: `${result.jobId}::${candidate.ref}::interview`,
    candidate_name: candidate.full_name.trim(),
    phone,
    position,
    scheduled_at: now.toISOString(),
    // สมัครไว้แล้วแต่เคยปฏิเสธงานอื่น → บท Part 2 + ถามก่อนว่ายังหางานอยู่ไหม
    questions: buildOfferQuestions(
      {
        candidateName: candidate.full_name,
        position,
        unit,
        placeForTravel,
        workSchedule: brief.workSchedule,
        needsOwnVehicle: brief.needsOwnVehicle,
        startDate: speakableDate(job.required_date),
      },
      { askStillLooking: true },
    ),
    type: 'phone',
    language: 'th',
    tone: 'professional',
    ...(skills.length ? { skills } : {}),
  };
}

/** คนหนึ่งคนในผลแมทเลนสรรหา — รับเป็นรูปโครงสร้าง ไม่ import type ข้ามไฟล์ (กันวง import) */
type RecruitLaneDispatchInput = {
  source: 'irecruit' | 'so_recruit' | 'checklist' | 'declined';
  ref: string;
  full_name: string;
  phone_number: string | null;
  position_text: string;
  source_label: string;
  tier: string;
};

export type RecruitLaneDispatchOutcome = LumosDispatchOutcome & {
  /** ข้ามเพราะเพิ่งติดต่อเรื่องงานนี้ภายใน 30 วัน */
  cooldownSkipped: number;
  /** ข้ามเพราะเป็นใบสนใจของฐานใหม่ที่เพิ่งถูกโทรเรื่องงานอื่นภายใน 30 วัน */
  leadCooldownSkipped: number;
  /** เข้าคิวได้กี่คนต่อแหล่ง — ป้ายบอกแหล่งบนสรุปตอนส่ง (เจ้าของขอ) */
  queuedBySource: Record<'irecruit' | 'so_recruit' | 'checklist' | 'declined', number>;
};

/**
 * ผลแมท **เลนสรรหา** (green/yellow) → คิว interview ทันที (R2b · เจ้าของเคาะ 16 ส.ค.)
 *
 * กติกาตัด — ชุดเดียวกับเลนคัดสรร บวกข้อพิเศษของกองใบสนใจ:
 *   1. เพิ่งติดต่อ**เรื่องงานนี้**ใน 30 วัน → ข้าม (ทุกแหล่ง · R1)
 *   2. เป็นใบสนใจฐานใหม่ (`so_recruit`) ที่เพิ่งถูกโทร**เรื่องงานไหนก็ได้**ใน 30 วัน → ข้าม
 *      (คนกลุ่มนี้แค่ทิ้งเบอร์ว่าสนใจ ยังไม่ได้สมัครใบไหน — กันโดนหลายสายวันเดียวกัน)
 *   3. ล็อก "รับไปโทรเอง" + เบอร์ที่ถูกพัก → กันที่ `insertQueueItems` เหมือนทุกเส้น
 * คืนผลให้ผู้เรียกรายงาน · error กลืน (ปุ่มค้นหาต้องไม่พังเพราะคิวมีปัญหา)
 */
export async function enqueueLumosInterviewForRecruitLane(
  job: Record<string, unknown>,
  result: { jobId: string; job_family_label: string | null; matches: RecruitLaneDispatchInput[] },
): Promise<RecruitLaneDispatchOutcome> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  const empty: RecruitLaneDispatchOutcome = {
    queued: 0,
    duplicated: [],
    skipped: [],
    cooldownSkipped: 0,
    leadCooldownSkipped: 0,
    queuedBySource: { irecruit: 0, so_recruit: 0, checklist: 0, declined: 0 },
  };
  try {
    const auto = result.matches.filter((m) => m.tier === 'green' || m.tier === 'yellow');
    if (auto.length === 0) return empty;

    const e164ByRef = new Map<string, string>();
    for (const m of auto) {
      const e164 = toE164Thai(m.phone_number);
      if (e164) e164ByRef.set(m.ref, e164);
    }
    const phones = [...new Set(e164ByRef.values())];

    const [contactedThisJob, contactedAnyJob] = await Promise.all([
      phonesContactedAboutJob(result.jobId, phones),
      // ยิงเฉพาะตอนมีใบสนใจอยู่ในกอง — กองอื่นไม่ใช้เกณฑ์นี้
      auto.some((m) => m.source === 'so_recruit')
        ? phonesContactedAnyJob(
            auto
              .filter((m) => m.source === 'so_recruit')
              .map((m) => e164ByRef.get(m.ref))
              .filter((p): p is string => Boolean(p)),
          )
        : Promise.resolve(new Set<string>()),
    ]);

    let cooldownSkipped = 0;
    let leadCooldownSkipped = 0;
    const eligible: RecruitLaneDispatchInput[] = [];
    for (const m of auto) {
      const e164 = e164ByRef.get(m.ref);
      // เบอร์แปลงไม่ได้ปล่อยผ่าน — โดนคัดที่ payload อยู่แล้ว (รายงานเป็น "ส่งไม่ได้")
      if (e164 && contactedThisJob.has(e164)) {
        cooldownSkipped += 1;
        continue;
      }
      if (e164 && m.source === 'so_recruit' && contactedAnyJob.has(e164)) {
        leadCooldownSkipped += 1;
        continue;
      }
      eligible.push(m);
    }
    if (eligible.length === 0) return { ...empty, cooldownSkipped, leadCooldownSkipped };

    const skipped: LumosDispatchOutcome['skipped'] = [];
    const items: Array<{ personRef: string; payload: LumosInterviewPayload; matchRank: number }> = [];
    const sourceByRef = new Map<string, RecruitLaneDispatchInput['source']>();
    const nameByRef = new Map<string, string>();
    for (const m of eligible) {
      sourceByRef.set(m.ref, m.source);
      // ชื่อในรายงานติดป้ายแหล่งไว้ด้วย — คนอ่านสรุปจะได้รู้ว่าต้องตามเอกสารแบบไหน
      nameByRef.set(m.ref, `${m.full_name} (${m.source_label})`);
      const payload = buildRecruitLaneInterviewPayload(job, result, m);
      if (!payload) {
        skipped.push({ ref: m.ref, name: nameByRef.get(m.ref) || m.ref, reason: NO_PHONE_REASON });
        continue;
      }
      items.push({ personRef: m.ref, payload, matchRank: matchRankFromTier(m.tier) });
    }

    await attachInterviewAdminPhone(items, requestNoFromJobRef(result.jobId));
    const { added, held, suppressed, declined, guarded } = await insertQueueItems('interview', result.jobId, items);
    const addedSet = new Set(added);
    const heldSet = new Set(held);
  /**
   * 🔴 "ไม่ได้ส่ง" ทุกเหตุผลรวมที่เดียว — เดิมนับ `duplicated` โดยตัดแค่ held/declined
   * ⇒ คนที่ถูก **พักเบอร์** หรือ **กันไว้ก่อนเพราะตรวจไม่ได้** ถูกนับเป็น "เคยส่งแล้ว"
   * ทั้งที่ไม่เคยส่ง · รายงานบนจอเลยบอกผิดทาง
   */
  const skippedSet = new Set([...held, ...suppressed, ...declined, ...guarded]);
    for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
    for (const ref of suppressed) {
      skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
    }
    for (const ref of declined) {
      skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: DECLINED_REASON });
    }
    const declinedSet = new Set(declined);
    const duplicated = items
      .map((i) => i.personRef)
      .filter((ref) => !addedSet.has(ref) && !skippedSet.has(ref));

    const queuedBySource = { irecruit: 0, so_recruit: 0, checklist: 0, declined: 0 };
    for (const ref of added) {
      const s = sourceByRef.get(ref);
      if (s) queuedBySource[s] += 1;
    }

    logInfo('lumos.dispatch.recruit-lane', {
      jobId: result.jobId,
      matched: auto.length,
      queued: added.length,
      ...queuedBySource,
      duplicated: duplicated.length,
      cooldownSkipped,
      leadCooldownSkipped,
      held: held.length,
      suppressed: suppressed.length,
    });

    return {
      queued: added.length,
      duplicated,
      skipped,
      cooldownSkipped,
      leadCooldownSkipped,
      queuedBySource,
    };
  } catch (e) {
    logError('lumos.dispatch.recruit-lane.fail', {
      jobId: result.jobId,
      message: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

/**
 * ผลแมทเส้น "ชวนกลับ" (เขียว/เหลือง) → คิว interview ทันที (เลนคัดสรร · 16 ส.ค. 2569)
 *
 * กติกาตัด: cooldown 30 วัน**ต่องานนี้** (คนละงานกับที่เขาเคยปฏิเสธอยู่แล้ว —
 * คนที่ปฏิเสธใบนี้ถูกตัดตั้งแต่คิวรีของกอง) + ล็อก/พักเบอร์ที่คอขวดเดิม
 */
export async function enqueueLumosInterviewForRecall(
  job: Record<string, unknown>,
  result: { jobId: string; job_family_label: string | null; matches: RecruitLaneDispatchInput[] },
): Promise<RecruitLaneDispatchOutcome> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  const empty: RecruitLaneDispatchOutcome = {
    queued: 0,
    duplicated: [],
    skipped: [],
    cooldownSkipped: 0,
    leadCooldownSkipped: 0,
    queuedBySource: { irecruit: 0, so_recruit: 0, checklist: 0, declined: 0 },
  };
  try {
    const auto = result.matches.filter((m) => m.tier === 'green' || m.tier === 'yellow');
    if (auto.length === 0) return empty;

    const e164ByRef = new Map<string, string>();
    for (const m of auto) {
      const e164 = toE164Thai(m.phone_number);
      if (e164) e164ByRef.set(m.ref, e164);
    }
    const recentlyContacted = await phonesContactedAboutJob(result.jobId, [
      ...new Set(e164ByRef.values()),
    ]);

    let cooldownSkipped = 0;
    const eligible: RecruitLaneDispatchInput[] = [];
    for (const m of auto) {
      const e164 = e164ByRef.get(m.ref);
      if (e164 && recentlyContacted.has(e164)) {
        cooldownSkipped += 1;
        continue;
      }
      eligible.push(m);
    }
    if (eligible.length === 0) return { ...empty, cooldownSkipped };

    const skipped: LumosDispatchOutcome['skipped'] = [];
    const items: Array<{ personRef: string; payload: LumosInterviewPayload; matchRank: number }> = [];
    const nameByRef = new Map<string, string>();
    for (const m of eligible) {
      nameByRef.set(m.ref, `${m.full_name} (${m.source_label})`);
      const payload = buildRecallInterviewPayload(job, result, m);
      if (!payload) {
        skipped.push({ ref: m.ref, name: nameByRef.get(m.ref) || m.ref, reason: NO_PHONE_REASON });
        continue;
      }
      items.push({ personRef: m.ref, payload, matchRank: matchRankFromTier(m.tier) });
    }

    await attachInterviewAdminPhone(items, requestNoFromJobRef(result.jobId));
    const { added, held, suppressed, declined, guarded } = await insertQueueItems('interview', result.jobId, items);
    const addedSet = new Set(added);
    const heldSet = new Set(held);
  /**
   * 🔴 "ไม่ได้ส่ง" ทุกเหตุผลรวมที่เดียว — เดิมนับ `duplicated` โดยตัดแค่ held/declined
   * ⇒ คนที่ถูก **พักเบอร์** หรือ **กันไว้ก่อนเพราะตรวจไม่ได้** ถูกนับเป็น "เคยส่งแล้ว"
   * ทั้งที่ไม่เคยส่ง · รายงานบนจอเลยบอกผิดทาง
   */
  const skippedSet = new Set([...held, ...suppressed, ...declined, ...guarded]);
    for (const ref of held) skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: HELD_REASON });
    for (const ref of suppressed) {
      skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: SUPPRESSED_REASON });
    }
    for (const ref of declined) {
      skipped.push({ ref, name: nameByRef.get(ref) || ref, reason: DECLINED_REASON });
    }
    const declinedSet = new Set(declined);
    const duplicated = items
      .map((i) => i.personRef)
      .filter((ref) => !addedSet.has(ref) && !skippedSet.has(ref));

    logInfo('lumos.dispatch.recall', {
      jobId: result.jobId,
      matched: auto.length,
      queued: added.length,
      duplicated: duplicated.length,
      cooldownSkipped,
      held: held.length,
      suppressed: suppressed.length,
    });

    return {
      queued: added.length,
      duplicated,
      skipped,
      cooldownSkipped,
      leadCooldownSkipped: 0,
      queuedBySource: { irecruit: 0, so_recruit: 0, checklist: 0, declined: added.length },
    };
  } catch (e) {
    logError('lumos.dispatch.recall.fail', {
      jobId: result.jobId,
      message: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

// ─── สถานะการโทรต่อคน (ระดับ 1: badge ในการ์ด Matching) ──────────────────────

export type LumosNextAction = {
  type: string;
  urgency: 'urgent' | 'normal' | 'not urgent';
  due_at: string;
  reason: string;
};

export type LumosCallStatusRow = {
  channel: 'reminder' | 'interview';
  /** 'card-<id>' สำหรับคนของเรา · 'ir-<id>' สำหรับผู้สมัคร iRecruit */
  person_ref: string;
  status: 'pending' | 'delivered' | 'completed' | 'failed' | 'cancelled';
  outcome: string | null;
  summary: string | null;
  next_action: LumosNextAction | null;
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
  next_action_raw: LumosNextAction | null;
  delivery_count: number;
  created_at: string | Date;
  updated_at: string | Date;
};

const iso = (v: string | Date): string => (v instanceof Date ? v.toISOString() : String(v));

/**
 * สถานะ+ผลการโทรของทุกคนที่ส่งไปแล้วในใบขอนี้ (ทั้ง 2 เส้น)
 *
 * ⚠️ **อ่าน outcome ด้วย `coalesce(last_outcome, result->>'outcome')`** — กับดักเดิม
 * ของโปรเจกต์ที่โดนมาแล้วสามที่ (funnel หน้า Follow · แถบตัวเลขต่อใบขอ · ที่นี่):
 * ผลที่ **คน** บันทึกเขียนแค่ `last_outcome` ไม่ได้เขียน `result` และตอนตั้งโทรซ้ำ
 * ก็ **ล้าง `result` ทิ้ง** → อ่าน `result` อย่างเดียวจะเห็นเป็น "ยังไม่มีผล" เงียบ ๆ
 * ตรงนี้สำคัญเป็นพิเศษเพราะหน้า Matching ใช้ค่านี้ตัดสินว่าจะซ่อนคนที่ปฏิเสธงานนี้
 * อ่านพลาด = เอาคนที่ปฏิเสธไปแล้วกลับมาเสนอใหม่
 */
export async function listLumosCallStatusForJob(jobId: string): Promise<LumosCallStatusRow[]> {
  const { rows } = await dbQuery<QueueStatusSqlRow>(
    /**
     * ⚠️ รวมสองสายที่ทำขนานกัน 17 ส.ค. 2569 — merge ต่อบรรทัดจน SQL พัง (ไม่มี conflict
     * marker เพราะเป็นการเพิ่มบรรทัดติดกัน) · เก็บ `next_action` ของอีกสาย และคง
     * `coalesce(last_outcome, ...)` ของสายนี้ไว้ตามกติกา (เทสต์ outcomeReadGuard คุมอยู่):
     * ผลที่คนบันทึกเขียนแค่ `last_outcome` อ่าน `result` ทางเดียว = ผลของคนหายเงียบ
     */
    `select channel, person_ref, status, delivery_count, created_at, updated_at,
            coalesce(last_outcome, result->>'outcome') as outcome,
            result->>'summary' as summary,
            result->'next_action' as next_action_raw
       from ${queueTable}
      where job_ref = $1 and status <> 'cancelled'
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
    next_action: r.next_action_raw ?? null,
    delivery_count: Number(r.delivery_count) || 0,
    sent_at: iso(r.created_at),
    updated_at: iso(r.updated_at),
  }));
}

// ─── สรุปผลโทรต่อใบขอ (โชว์ข้างการ์ดในลิสต์ Matching) ────────────────────────

export type LumosJobCallSummary = {
  /** ยังไม่ได้โทรเพราะติดขั้นอนุมัติ (รอกด + อนุมัติแล้วแต่ยังอยู่ในช่วงถอนคำ) */
  pendingApproval: number;
  /** ส่งเข้าคิวแล้ว (ไม่นับที่ถูกยกเลิก) */
  sent: number;
  /** มีผลโทรกลับมาจริง (ไม่นับที่ Lumos ยกเลิกสายเอง) */
  called: number;
  confirmed: number;
  declined: number;
  no_answer: number;
  /** ผู้สมัครขอให้โทรกลับ — นัดใหม่ไว้แล้ว */
  reschedule: number;
  /** AI เอาไม่อยู่แล้ว ต้องให้คนตาม */
  needsHuman: number;
};

type JobSummarySqlRow = {
  job_ref: string;
  sent: string;
  called: string;
  confirmed: string;
  declined: string;
  no_answer: string;
  reschedule: string;
  needs_human: string;
};

/**
 * ⚠️ **อ่าน outcome ด้วย `coalesce(last_outcome, result->>'outcome')`**
 *
 * ผลที่ **คน** บันทึก (`applyHumanCallFollowup`) เขียนแค่ `last_outcome`/`followup_state`
 * ไม่ได้เขียน `result` · และตอนตั้งโทรซ้ำก็ **ล้าง `result` ทิ้ง** (`result = null`)
 * เดิมคิวรีนี้อ่าน `result->>'outcome'` อย่างเดียว ผลจากคนกับผลของรอบก่อนโทรซ้ำ
 * จึงหายไปจากตัวเลขข้างการ์ดแบบเงียบ ๆ (funnel หน้า Follow แก้ไปแล้ว ที่นี่ตกหล่น)
 *
 * ตรวจกับฐานจริง 10 ส.ค. 2569: ตอนนี้สองสูตรให้เลขเท่ากันเป๊ะ (ยังไม่มีผลที่คนบันทึก)
 * = เปลี่ยนแล้วตัวเลขวันนี้ไม่ขยับ แต่กันไม่ให้หายตอนเริ่มมีคนบันทึกผลเอง
 */
const JOB_SUMMARY_SQL = `
  select job_ref,
         count(*) filter (where status <> 'cancelled')                          as sent,
         count(*) filter (where oc is not null and oc <> 'cancelled')           as called,
         count(*) filter (where oc = 'confirmed')                               as confirmed,
         count(*) filter (where oc = 'declined')                                as declined,
         count(*) filter (where oc in ('no_answer', 'unresponsive'))            as no_answer,
         count(*) filter (where oc = 'reschedule_requested')                    as reschedule,
         count(*) filter (where followup_state = 'needs_human')                 as needs_human
    from (
      select job_ref, status, followup_state,
             coalesce(last_outcome, result->>'outcome') as oc
        from {{queue}}
       where job_ref <> 'follow'
    ) t
   group by job_ref`;

/** สูตรเดิมสำหรับกรณีที่ยังไม่ได้รัน migration 070 (ไม่มีคอลัมน์ last_outcome/followup_state) */
const JOB_SUMMARY_SQL_LEGACY = `
  select job_ref,
         count(*) filter (where status <> 'cancelled')                                as sent,
         count(*) filter (where result is not null
                            and coalesce(result->>'outcome', '') <> 'cancelled')      as called,
         count(*) filter (where result->>'outcome' = 'confirmed')                     as confirmed,
         count(*) filter (where result->>'outcome' = 'declined')                      as declined,
         count(*) filter (where result->>'outcome' in ('no_answer', 'unresponsive'))  as no_answer,
         0 as reschedule,
         0 as needs_human
    from {{queue}}
   where job_ref <> 'follow'
   group by job_ref`;

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 070 */
function isUndefinedColumn(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

/** รวมผลคิว Lumos ต่อใบขอในคำสั่งเดียว — เฉพาะเส้นใบขอ (ไม่รวมหน้า Follow) */
export async function loadLumosJobCallSummaryMap(): Promise<Map<string, LumosJobCallSummary>> {
  const map = new Map<string, LumosJobCallSummary>();

  let rows: JobSummarySqlRow[];
  try {
    ({ rows } = await dbQuery<JobSummarySqlRow>(JOB_SUMMARY_SQL.replace('{{queue}}', queueTable)));
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    ({ rows } = await dbQuery<JobSummarySqlRow>(
      JOB_SUMMARY_SQL_LEGACY.replace('{{queue}}', queueTable),
    ));
  }

  // ชุดที่ยังไม่ถูกปล่อย — คนละตารางกัน จึงต้องอ่านแยกแล้วมาต่อกัน
  // ⚠️ **ห้ามครอบ .catch() ตรงนี้** — ตารางยังไม่ migrate ถูกกลืนไปแล้วข้างใน (คืน map ว่าง)
  // ที่เหลือคือ DB ล้มจริง ซึ่งถ้ากลืนจะได้การ์ดที่เขียนว่า "รออนุมัติ 0" ทั้งที่แปลว่า
  // "เช็คไม่ได้" — โกหกในทางที่อันตราย (คนอ่านจะคิดว่าไม่มีใครรอให้กดอนุมัติ)
  // ตรงกับกติกาเดียวกับ callFollowupPolicyStore: กลืนเฉพาะ 42P01 ที่เหลือโยนต่อ
  const pending = await countPendingApprovalByJob();

  for (const r of rows) {
    map.set(r.job_ref, {
      pendingApproval: pending.get(r.job_ref) ?? 0,
      sent: Number(r.sent) || 0,
      called: Number(r.called) || 0,
      confirmed: Number(r.confirmed) || 0,
      declined: Number(r.declined) || 0,
      no_answer: Number(r.no_answer) || 0,
      reschedule: Number(r.reschedule) || 0,
      needsHuman: Number(r.needs_human) || 0,
    });
  }

  // ใบที่ "มีแต่ชุดรออนุมัติ ยังไม่เคยเข้าคิวเลย" ไม่มีแถวใน queue — ต้องเติมเอง
  // ไม่งั้นการ์ดใบนั้นจะว่างเปล่าทั้งที่มีคนรอให้กดอนุมัติอยู่
  for (const [jobRef, n] of pending) {
    if (map.has(jobRef) || n <= 0) continue;
    map.set(jobRef, {
      pendingApproval: n,
      sent: 0,
      called: 0,
      confirmed: 0,
      declined: 0,
      no_answer: 0,
      reschedule: 0,
      needsHuman: 0,
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
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI พูดให้ผู้สมัครโทรกลับ (ไม่ใช่เบอร์ที่ระบบโทรออก) */
  staffPhone?: string | null;
  scheduled_at: Date;
  /**
   * รอบเวลาของวันนั้น (HH:MM) — 1 แถว = 1 วัน = 1 plan (16 ส.ค.) · หลาย step ในวันเดียว
   * รับสายยืนยัน → Lumos `stop_early` หยุด step ที่เหลือของวันนั้น (พรุ่งนี้เป็นแถว/plan ใหม่)
   * ว่าง/ไม่ส่ง = รอบเดียวที่ scheduled_at (แบบเดิม)
   */
  callTimes?: string[] | null;
  /**
   * รอบนี้คือ "สายที่เท่าไหร่" (migration 113) — **คนเลือกเอง** ตอนตั้งรอบ
   *
   * 🔴 ทำไมต้องมี: โหมดตั้งเวลาเป็นรอบ ๆ สร้าง **หนึ่งแถวต่อหนึ่งรอบ** แถวเดี่ยวจึงไม่รู้
   * ว่าตัวเองเป็นรอบที่เท่าไหร่ ⇒ ก่อนหน้านี้ทุกแถวใช้บท "สายแรก" หมด ทั้งที่จอเขียนว่า
   * รอบ 2 ใช้บทรอบถัดไป (จอกับของจริงไม่ตรงกันตั้งแต่ 31 ส.ค. 2569)
   *
   * ไม่ส่ง/null = สายแรก — ของเดิมที่เรียกอยู่จึงไม่ต้องแก้
   */
  callRound?: number | null;
  /** ชื่อเจ้าหน้าที่ผู้ติดตาม — ใช้แนะนำตัวต้นสาย (1 ก.ย. 2569) · ไม่มี = ทักทายโดยไม่เอ่ยชื่อ */
  staffName?: string | null;
  /** หน่วยงานที่ไปทำงาน — บทถามว่า "ไปหน่วยงาน...แล้วใช่ไหม" */
  unitName?: string | null;
};

/**
 * ISO เวลาไทย `YYYY-MM-DDTHH:mm:ss+07:00` — instant เดียวกับ `toISOString()` แต่เขียน
 * ด้วย offset ไทยแทน `Z` (18 ส.ค. 2569: Lumos ดึงรายการไปแล้วแต่ไม่ขึ้นหน้าแจ้งเตือน
 * — หนึ่งในสามข้อสงสัยคือฝั่งเขาอ่านเวลารูป UTC แล้วปัดทิ้งเงียบ ๆ จึงส่งเป็นเวลาไทยให้ชัด)
 * ตั้งใจไม่ใช้ `Intl` — กติกาโปรเจกต์ห้าม `new Intl.*` นอกระดับโมดูล (เคยทำ API ช้า 4.7 วิ)
 */
export function bangkokIso(d: Date): string {
  const t = new Date(d.getTime() + 7 * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}` +
    `T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}:${pad(t.getUTCSeconds())}+07:00`
  );
}

/** ประกอบ ISO (เวลาไทย +07:00) ของ "วันเดียวกับ scheduled_at + เวลา HH:MM" */
function dayAtTime(day: Date, hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  const ymd = day.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  if (!m) return bangkokIso(day);
  const hh = String(Math.min(23, Number(m[1]))).padStart(2, '0');
  return `${ymd}T${hh}:${m[2]}:00+07:00`;
}

export function buildFollowReminderPayload(
  entry: FollowEntryInput,
  adminPhone?: string | null,
): LumosReminderPayload {
  // ⚠️ เบอร์ที่ AI **พูด** ให้ผู้สมัครโทรกลับ ไปได้ทางเดียวคือ `steps[].message`
  // (ช่องนั้นคือสิ่งที่ถึงหูผู้รับ) — ส่วน `admin_phone` เป็นเบอร์ที่ **AI โทรไปหา**
  // เมื่อติดต่อผู้รับไม่ได้ คนละเรื่องกัน จึงต้องมีทั้งสองทาง
  /**
   * 🔴 **สายแรกกับสายรอบถัดไปพูดคนละบท** (เจ้าของสั่ง 31 ส.ค. 2569:
   * *"การติดตามต้องมี 2 บทอะ เพราะโทรรอบแรกกับรอบที่ 2 มันไม่เหมือนกันอะ"*)
   *
   * ของเดิมสร้างข้อความครั้งเดียวแล้วยัดให้ทุกรอบ ⇒ รอบสองพูดคำต่อคำเหมือนรอบแรก
   * ทั้งที่เพิ่งคุยกันไป ฟังแล้วเหมือนหุ่นยนต์ที่ไม่รู้ว่าเคยโทรมา
   *
   * `type` ก็เปลี่ยนตามให้ตรงความหมาย — รอบแรกเป็น `remind` (แจ้งครั้งแรก)
   * รอบถัดไปเป็น `follow_up` · ทั้งสองค่าอยู่ในชุดที่ Lumos รับอยู่แล้ว ไม่ใช่ของใหม่
   */
  const messageFor = (round: 'first' | 'repeat') =>
    buildFollowMessage(
      {
        recipientName: entry.recipient_name,
        topic: entry.topic,
        note: entry.note,
        staffPhone: entry.staffPhone,
        staffName: entry.staffName,
        unitName: entry.unitName,
      },
      round,
    );
  /**
   * สายแรกของงานนี้คือสายที่เท่าไหร่ — คนเลือกเองตอนตั้งรอบ (113) · ไม่ระบุ = 1
   * step ถัดไปในวันเดียวกันนับต่อจากนี้ (สายที่ 2 + อีก 1 step = สายที่ 3)
   */
  const baseRound = Number.isInteger(entry.callRound) && (entry.callRound as number) >= 1
    ? (entry.callRound as number)
    : 1;
  const roundOf = (stepIndex: number): 'first' | 'repeat' =>
    baseRound + stepIndex === 1 ? 'first' : 'repeat';
  // หลายรอบในวันเดียว → หลาย step (เวลาต่างกัน) · Lumos หยุดที่เหลือเองเมื่อยืนยัน (stop_early)
  const times = (entry.callTimes || []).filter((t) => /^\d{1,2}:\d{2}$/.test((t || '').trim()));
  const steps =
    times.length > 0
      ? times.map((t, i) => ({
          type: (roundOf(i) === 'first' ? 'remind' : 'follow_up') as 'remind' | 'follow_up',
          message: messageFor(roundOf(i)),
          scheduled_at: dayAtTime(entry.scheduled_at, t),
        }))
      : [
          {
            type: (roundOf(0) === 'first' ? 'remind' : 'follow_up') as 'remind' | 'follow_up',
            message: messageFor(roundOf(0)),
            scheduled_at: bangkokIso(entry.scheduled_at),
          },
        ];
  return {
    /**
     * 🔴 **ห้ามมี `::` ในรหัสอ้างอิง** (18 ส.ค. 2569: Lumos ดึงไปแล้วแต่ไม่ขึ้น
     * หน้าแจ้งเตือน — ข้อสงสัยหนึ่งคือฝั่งเขาใช้ `::` เป็นตัวคั่นภายในแล้วรายการพังเงียบ)
     * ใช้ `follow-<id>` ให้ตรงกับ person_ref ไปเลย
     *
     * ตัวรับผล (`applyLumosResult`) จับคู่ด้วยค่าใน payload ของแถวนั้นเอง
     * (`payload->>'client_contact_id' = <ค่าที่ Lumos ส่งกลับ>`) — แถวเก่าที่ค้างคิว
     * ด้วยรูป `follow::<id>` จึงยังจับคู่ได้เหมือนเดิม รองรับสองรูปแบบโดยไม่ต้องแปลง
     */
    client_contact_id: `follow-${entry.id}`,
    recipient_name: entry.recipient_name,
    recipient_phone: entry.recipient_phone,
    // ไม่มีเบอร์ = ไม่ส่งคีย์นี้เลย (ดีกว่าส่งค่าว่าง/เบอร์ผิดไปให้ AI โทร)
    ...(adminPhone ? { admin_phone: adminPhone } : {}),
    title: entry.topic,
    language: 'th',
    tone: 'professional',
    steps,
  };
}

/** รายชื่อ Follow ที่คนกรอก → คิว reminder (throw ให้ handler จัดการ เพราะผู้ใช้ต้องรู้ว่าเข้าคิวไหม) */
/**
 * 🔴 **คืนผลออกไป ไม่ใช่ log ทิ้ง** (เจ้าของสั่ง 25 ส.ค. 2569)
 *
 * เดิมคืน `void` แล้ว log อย่างเดียว ⇒ เวลาระบบ "ไม่ส่ง" (ซึ่งมีหลายทางและถูกต้องทั้งนั้น)
 * **ไม่มีอะไรไปถึงคนใช้งานเลย** · รายการติดตาม 24 ส.ค. 2569 หายเงียบแบบนี้
 * กว่าจะรู้ต้องไล่ฐานย้อนหลังทีละตาราง
 */
export async function enqueueFollowReminder(
  entry: FollowEntryInput,
): Promise<FollowDispatchState> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  /**
   * 🔴 `admin_phone` ของเลน Follow — เจ้าของสั่งเพิ่ม 27 ส.ค. 2569
   * ลำดับ: **เบอร์เจ้าหน้าที่ที่คนกรอกเลือกไว้กับรายการนี้** มาก่อนเสมอ (เขาเจาะจงเอง)
   * ไม่มีค่อยถอยไปใช้ตัวหาเบอร์กลางตัวเดียวกับเลนสัมภาษณ์ (ผู้รับผิดชอบใบขอ →
   * สุ่ม supervisor) · หาไม่ได้เลย = ไม่ส่งคีย์นี้ ไม่ใช่ส่งค่าว่าง
   * ⚠️ รายการ Follow ไม่ผูกกับเลขที่ใบขอ จึงส่ง `null` เข้าไป = ข้ามขั้นผู้รับผิดชอบ
   */
  const adminPhone =
    (entry.staffPhone ? toE164Thai(entry.staffPhone) : null) ||
    (await resolveInterviewAdminPhone(null));
  const payload = buildFollowReminderPayload(entry, adminPhone);
  // แถวตั้งตาราง (มีหลายรอบ) เสิร์ฟเร็วสุด = รอบแรกของวันนั้น (step แรก) — กันวันอนาคตถูก bump มาโทรก่อน
  const scheduledFor = payload.steps[0]?.scheduled_at ?? entry.scheduled_at.toISOString();
  const { added, held, suppressed, guarded } = await insertQueueItems('reminder', 'follow', [
    { personRef: `follow-${entry.id}`, payload, scheduledFor },
  ]);
  logInfo('lumos.dispatch.follow', { followId: entry.id, added, held, suppressed, guarded });
  if (added.length > 0) {
    await pushFollowReminderToLumos(entry.id, payload);
    return 'queued';
  }
  if (held.length > 0) return 'held';
  if (suppressed.length > 0) return 'suppressed';
  if (guarded.length > 0) return 'guarded';
  // ไม่เข้าถังไหนเลย = ชน unique เดิม (ส่งซ้ำ) — ถือว่าอยู่ในคิวแล้ว (push ไปแล้วตอนสร้างครั้งแรก)
  return 'queued';
}

/**
 * แปลง payload ของคิวเป็น record สำหรับดันตรงไปหา Lumos (push mode)
 *
 * 🔴 ต้อง bump เวลาที่ผ่านมาแล้วก่อนส่งเสมอ — Lumos บังคับ scheduled_at เป็น
 * "now or future" ไม่งั้น**ปัดทิ้งตอน ingest แบบเงียบ ๆ** (เคสจริง 18 ส.ค. 2569)
 * เวลาใน Follow เป็นเวลาที่คนเลือกเอง (เช่นบ่ายสองตั้งรายการให้โทร 09:00 วันนี้)
 * เส้น poll แก้เรื่องนี้ตอนเสิร์ฟด้วย bumpScheduledAtForward — push ไม่ผ่านจุดเสิร์ฟ
 * จึงต้องทำเองที่นี่ (ตัวเดียวกัน: อดีต → now+10 นาที · ทุกค่าเขียนเป็นเวลาไทย +07:00)
 */
export function buildFollowPushRecord(
  payload: LumosReminderPayload,
  now = new Date(),
): LumosPushReminderRecord {
  return bumpScheduledAtForward(payload, now) as unknown as LumosPushReminderRecord;
}

/**
 * ดันรายการ Follow ตรงไปหา Lumos ทันทีหลังเข้าคิว (เจ้าของสั่ง 26 ส.ค. 2569:
 * "กรอกจากระบบเรา แล้วไปขึ้นเขาเลย") — แพตเทิร์นเดียวกับ autoPush ของเลนอื่น:
 * best-effort · push ล้มห้ามทำให้การสร้างรายการล้ม เพราะแถวยังอยู่ในคิว
 * Lumos โทรดึงได้เอง (pull เป็นทางถอยเสมอ) · ไม่ได้ตั้ง env push = ข้ามเงียบ
 *
 * Idempotency-Key = follow-<id> — หนึ่งรายการติดตามส่งได้ครั้งเดียว
 * กันเคสยิงซ้ำ (retry/กดเบิ้ล) กลายเป็นสายที่สองไปหาคนจริง
 */
async function pushFollowReminderToLumos(
  followId: string,
  payload: LumosReminderPayload,
): Promise<void> {
  if (!getLumosPushConfig()) return;
  try {
    await pushReminders(buildFollowPushRecord(payload), `follow-${followId}`);
    logInfo('lumos.push.follow.ok', { followId });
  } catch (e) {
    logError('lumos.push.follow failed (ยังอยู่ในคิว — Lumos โทรดึงได้เอง)', e, { followId });
  }
}

/**
 * ยกเลิกรายการ Follow ในคิว — ฝั่งเราได้ผลเฉพาะแถวที่ Lumos ยังไม่ดึงไป (pending)
 *
 * 🔴 เมื่อเปิด push mode ต้องแจ้งยกเลิกฝั่ง Lumos ด้วยเสมอ — record ไปอยู่ในระบบเขา
 * ตั้งแต่ตอนสร้างแล้ว ยกเลิกแค่คิวฝั่งเรา = AI ยังโทรหาคนจริงเรื่องงานที่ยกเลิกไปแล้ว
 * (กู้คืนไม่ได้) · best-effort เหมือนตอน push: แจ้งไม่สำเร็จแค่ log ไม่ทำให้การยกเลิกล้ม
 * และยิงแม้คิวฝั่งเราไม่มีแถว pending (Lumos อาจถือ record อยู่โดยที่ฝั่งเราปิดไปแล้ว)
 */
export async function cancelFollowReminder(followId: string): Promise<boolean> {
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set status = 'cancelled', updated_at = now()
      where channel = 'reminder' and job_ref = 'follow'
        and person_ref = $1 and status = 'pending'
      returning id`,
    [`follow-${followId}`],
  );
  if (getLumosPushConfig()) {
    try {
      await cancelPushedReminder(`follow-${followId}`);
      logInfo('lumos.push.follow.cancel.ok', { followId });
    } catch (e) {
      logError('lumos.push.follow.cancel failed (คิวฝั่งเรายกเลิกแล้ว)', e, { followId });
    }
  }
  return rows.length > 0;
}

/**
 * 🔴 **แก้รายการ Follow แล้วต้องแก้บทพูดในคิวด้วย** (เจ้าของสั่ง 17 ส.ค. 2569 — "เพิ่มให้แก้ไขได้")
 *
 * payload ถูกสร้างตอน **เข้าคิว** ไม่ใช่ตอนเสิร์ฟ — แก้แถวในฐานเฉย ๆ แล้วไม่แตะคิว
 * = AI ยังโทรไปพูดชื่อ/เรื่อง/เบอร์ติดต่อกลับ**ชุดเก่า** โดยที่หน้าจอโชว์ชุดใหม่
 * (พังเงียบสนิท ไม่มีอะไรเตือน)
 *
 * ⚠️ ได้ผลเฉพาะแถวที่ **Lumos ยังไม่ดึงไป** (`status='pending'`) — ดึงไปแล้วเรียกคืนไม่ได้
 * คืนจำนวนแถวที่แก้ได้จริง เพื่อให้ฝั่ง API บอกคนใช้ได้ว่า "สายที่ออกไปแล้วใช้ข้อมูลเดิม"
 *
 * ⚠️ **ช่องโหว่ push mode (รู้แล้ว ตั้งใจยังไม่ปิด — 26 ส.ค. 2569):** ตอนสร้างเรา push
 * record ไปหา Lumos แล้ว การแก้ตรงนี้อัปเดตแค่คิวฝั่งเรา ⇒ ฝั่ง Lumos ยังถือบทพูดชุดเก่า
 * ยังไม่ wire re-push เพราะไม่รู้ว่า Lumos เจอ client_contact_id ซ้ำแล้ว "ทับ" หรือ
 * "สร้างซ้ำ" — ถ้าสร้างซ้ำ = คนจริงโดนโทรสองสาย ซึ่งแย่กว่าบทพูดเก่า · รอยืนยันจากทีม Lumos
 */
export async function refreshFollowReminderPayload(entry: FollowEntryInput): Promise<number> {
  // บทฉบับแก้จากหน้าตั้งค่า — โหลดก่อนประกอบบทเสมอ (ล้มก็ใช้บทเดิม ไม่ทำให้สายล้ม)
  await ensureCallScriptsFresh();
  /**
   * 🔴 `admin_phone` ของเลน Follow — เจ้าของสั่งเพิ่ม 27 ส.ค. 2569
   * ลำดับ: **เบอร์เจ้าหน้าที่ที่คนกรอกเลือกไว้กับรายการนี้** มาก่อนเสมอ (เขาเจาะจงเอง)
   * ไม่มีค่อยถอยไปใช้ตัวหาเบอร์กลางตัวเดียวกับเลนสัมภาษณ์ (ผู้รับผิดชอบใบขอ →
   * สุ่ม supervisor) · หาไม่ได้เลย = ไม่ส่งคีย์นี้ ไม่ใช่ส่งค่าว่าง
   * ⚠️ รายการ Follow ไม่ผูกกับเลขที่ใบขอ จึงส่ง `null` เข้าไป = ข้ามขั้นผู้รับผิดชอบ
   */
  const adminPhone =
    (entry.staffPhone ? toE164Thai(entry.staffPhone) : null) ||
    (await resolveInterviewAdminPhone(null));
  const payload = buildFollowReminderPayload(entry, adminPhone);
  const scheduledFor = payload.steps[0]?.scheduled_at ?? entry.scheduled_at.toISOString();
  const { rows } = await dbQuery<{ id: number }>(
    `update ${queueTable}
        set payload = $2, next_attempt_at = $3, updated_at = now()
      where channel = 'reminder' and job_ref = 'follow'
        and person_ref = $1 and status = 'pending'
      returning id`,
    [`follow-${entry.id}`, JSON.stringify(payload), scheduledFor],
  );
  logInfo('lumos.dispatch.follow.refresh', { followId: entry.id, updated: rows.length });
  return rows.length;
}

// ─── Serve + result (เรียกจาก lumos endpoints) ───────────────────────────────

/**
 * Lumos spec บังคับ scheduled_at ต้องเป็น "now or future" — ถ้าเวลาที่เก็บไว้เลยมาแล้ว
 * (เช่น เข้าคิวก่อน Lumos มาดึงหลายนาที) ให้ขยับไปอนาคต ณ ตอนเสิร์ฟ
 * มิฉะนั้นฝั่ง Lumos จะปัดรายการทิ้งตอน ingest แบบเงียบ ๆ
 *
 * 18 ส.ค. 2569 (เคส follow ไม่ขึ้นหน้าแจ้งเตือนทั้งที่ดึงไปแล้ว) ปรับสองอย่าง:
 * - เผื่อล่วงหน้า **10 นาที** (เดิม 2) — เผื่อรอบ ingest/ตั้งสายฝั่งเขาช้ากว่าที่คิด
 * - เวลาที่เสิร์ฟออกทุกค่า **เขียนเป็นเวลาไทย +07:00** (instant เดิม ไม่เลื่อนเวลา)
 *   ครอบทุก payload ณ จุดเสิร์ฟที่เดียว — แถวเก่าในคิวที่เก็บรูป UTC ก็ถูกแปลงตอนออก
 */
export function bumpScheduledAtForward(payload: unknown, now = new Date()): unknown {
  if (typeof payload !== 'object' || payload === null) return payload;
  const p = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
  const floor = bangkokIso(new Date(now.getTime() + 10 * 60_000));
  const bump = (v: unknown): string | unknown => {
    if (typeof v !== 'string' || !v) return floor;
    const t = new Date(v);
    return Number.isNaN(t.getTime()) || t.getTime() < now.getTime() ? floor : bangkokIso(t);
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
 * เงื่อนไข "แถวนี้ถึงคิวเสิร์ฟแล้ว" — ใช้ทั้งกับแถวที่กำลังพิจารณาและแถวคู่แข่งของเบอร์เดียวกัน
 * ต้องเป็นชุดเดียวกันเป๊ะ ไม่งั้น "ใบที่มาก่อน" จะนับรวมใบที่ยังเสิร์ฟไม่ได้ แล้วบังใบอื่นค้าง
 */
const SERVE_ELIGIBLE = (a: string) => `
  ${a}.result is null
  and ${a}.delivery_count < ${MAX_DELIVERIES}
  and (${a}.next_attempt_at is null or ${a}.next_attempt_at <= now())
  and (
    ${a}.status = 'pending'
    or (${a}.status = 'delivered' and ${a}.delivered_at < now() - interval '${REDELIVER_AFTER_MINUTES} minutes')
  )`;

/**
 * เสิร์ฟรายการให้ Lumos แบบ at-least-once:
 * - pending เสิร์ฟทันที · delivered ที่ยังไม่มีผลกลับเกิน 30 นาที เสิร์ฟซ้ำ (กันของหายเงียบ)
 * - หยุดถาวรเมื่อ Lumos POST ผลกลับ (completed/failed/cancelled) หรือครบ 5 ครั้ง
 *
 * ⚠️ **หนึ่งเบอร์ = หนึ่งใบขอที่กำลังเสนออยู่** (เจ้าของกำหนด: เสนอทีละงาน)
 * คนเดียวอยู่ในผลแมทได้หลายใบมาก — ข้อมูลจริง card 1805 อยู่ใน **113 ใบขอ**
 * เดิมคิวเสิร์ฟตาม created_at ล้วน ไม่มีเงื่อนไข "เบอร์นี้มีสายค้างอยู่แล้ว"
 * คนคนเดียวจึงถูกโทรถล่มจากหลายใบพร้อมกัน · กันไว้ 2 ชั้น:
 *
 *   1. **สายกำลังเดิน** — เบอร์นี้มีแถวที่เพิ่งส่งให้ Lumos ไปและยังไม่มีผลกลับ → ยังไม่เสิร์ฟใบอื่น
 *   2. **ใบที่มาก่อนได้ก่อน** — ในบรรดาแถวที่ถึงคิวของเบอร์เดียวกัน เสิร์ฟแถวแรกตาม
 *      (created_at, id) เท่านั้น · ที่เหลือรอจนใบนั้นได้ผล
 *   3. **สนใจใบไหนแล้ว บังใบอื่น** — ตอบ `confirmed` ไว้กับใบไหน ใบอื่นของคนคนนั้น
 *      หยุดเสนอจนพ้น `CONFIRMED_FOCUS_DAYS` · ใบเดิมยังเดินต่อได้ (`k.job_ref <> c.job_ref`)
 *
 * ปลดชั้นที่ 3 ได้ 3 ทาง: มีคนบันทึกผลใหม่ทับใบนั้น (last_outcome เปลี่ยน ไม่ใช่
 * `confirmed` แล้ว) · ยกเลิกแถวนั้น · หรือพ้นเพดานเวลา — **ไม่มีทางที่คนจะค้างถาวร**
 * ⚠️ ยังไม่ได้ผูกกับ "คนถูกจองแล้ว" (`candidate_proposals`) — ถูกจองแล้วยังนับเป็น
 * บังใบอื่นตามเวลาเหมือนเดิม ซึ่งเป็นทิศทางที่ปลอดภัยกว่า (ไม่เสนองานให้คนที่มีงานแล้ว)
 *
 * ทั้งสองชั้น **ข้ามช่อง** (reminder ↔ interview) เพราะคนเดียวอยู่ได้ทั้งสองคิว
 * เบอร์เดียวกันคือคนเดียวกันเสมอ — กันเฉพาะในช่องตัวเองจะกันไม่อยู่จริง
 *
 * ⚠️ แถวที่ไม่มีเบอร์ใน payload จะไม่บังใครและไม่ถูกใครบัง (`null = null` เป็นเท็จใน SQL)
 * ซึ่งถูกแล้ว — ไม่มีเบอร์ก็ไม่รู้ว่าเป็นคนเดียวกันไหม
 *
 * วัดกับข้อมูลจริงแล้ว (11 ส.ค. 2569 · อ่านอย่างเดียว): ช่อง reminder มีแถวที่ถึงคิว
 * **2,816 แถว → เสิร์ฟจริง 126 แถว = 126 คน** (เฉลี่ยคนละ ~22 ใบขอ) · คิวรี 19 ms
 * ไม่ต้องมี index เพิ่ม — ถ้าวันไหนคิวโตจนช้า ค่อยทำ expression index ของเบอร์
 *
 * export ไว้ให้เทสต์อ่าน — เงื่อนไขพวกนี้พังแล้วเงียบสนิท (ยังตอบ 200 · Lumos ยังได้งาน
 * แค่ได้คนเดิมหลายใบพร้อมกัน) เทสต์โครงสร้าง SQL จึงเป็นด่านเดียวที่จับได้
 */
/**
 * นิพจน์ลำดับความสำคัญ — `withRank = false` แทนด้วยค่าคงที่เดียวกันทั้งสองฝั่ง
 * ผลลัพธ์จึงเท่ากับพฤติกรรมเดิมเป๊ะ (เรียงตามคิวเก่าก่อน) สำหรับฐานที่ยังไม่รัน 084
 *
 * ⚠️ **ต้อง coalesce เสมอ** — `match_rank` เป็น null ได้ (คิวเก่า · งานจาก Follow)
 * ปล่อย NULL เข้า row comparison แล้วผลเป็น NULL ไม่ใช่ true → ชั้นกัน
 * "หนึ่งเบอร์ = หนึ่งใบขอที่กำลังเสนอ" หลุด แล้วคนเดียวจะโดนหลายสายพร้อมกัน
 */
/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration (กติกาข้อ 9: กลืนเฉพาะเคสนี้) */
function isUndefinedColumnError(e: unknown): boolean {
  return (
    typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703'
  );
}

const rankExprFor = (alias: string, withRank: boolean) =>
  withRank ? `coalesce(${alias}.match_rank, ${MATCH_RANK_UNKNOWN})` : String(MATCH_RANK_UNKNOWN);

export function buildTakePendingSql(withRank: boolean): string {
  const rank = (a: string) => rankExprFor(a, withRank);
  return `update ${queueTable} q
    set status = 'delivered', delivered_at = now(), updated_at = now(),
        delivery_count = q.delivery_count + 1
  where q.id in (
    select c.id from ${queueTable} c
     where c.channel = $1
       -- นัดโทรซ้ำไว้แล้ว: ห้ามเสิร์ฟก่อนถึงเวลา (ดู api/_lib/callFollowup.ts)
       and ${SERVE_ELIGIBLE('c')}
       -- ชั้นที่ 1: เบอร์นี้มีสายที่ส่งไปแล้วและยังไม่มีผลกลับ (ข้ามช่อง)
       and not exists (
         select 1 from ${queueTable} f
          where f.id <> c.id
            and ${phoneExprFor('f')} = ${phoneExprFor('c')}
            and f.result is null
            and f.status = 'delivered'
            and f.delivered_at >= now() - interval '${REDELIVER_AFTER_MINUTES} minutes'
       )
       -- ชั้นที่ 2: ในบรรดาใบที่ถึงคิวของเบอร์เดียวกัน เอาใบที่มาก่อนใบเดียว (ข้ามช่อง)
       and not exists (
         select 1 from ${queueTable} e
          where e.id <> c.id
            and ${phoneExprFor('e')} = ${phoneExprFor('c')}
            and ${SERVE_ELIGIBLE('e')}
            -- ⚠️ คะแนนนำหน้าลำดับเวลา — คนที่ AI ให้เขียวต้องได้เสนอก่อน
            -- แม้ใบขอนั้นจะเข้าคิวทีหลัง (เจ้าของเคาะ: ใช้ tier ของ AI)
            and (${rank('e')}, e.created_at, e.id) < (${rank('c')}, c.created_at, c.id)
       )
       -- ชั้นที่ 3: ตอบว่าสนใจใบไหนไว้แล้ว → บังใบ**อื่น**ไว้จนพ้นเพดานเวลา
       and not exists (
         select 1 from ${queueTable} k
          where ${phoneExprFor('k')} = ${phoneExprFor('c')}
            and k.job_ref <> c.job_ref
            -- ⚠️ coalesce กับ result->>'outcome' — ผลที่คนบันทึกเขียนแค่ last_outcome
            -- และแถวก่อน migration 070 มีแต่ result · อ่านทางเดียวจะนับหายเงียบ ๆ
            and coalesce(k.last_outcome, k.result->>'outcome') = 'confirmed'
            and k.updated_at >= now() - interval '${CONFIRMED_FOCUS_DAYS} days'
       )
     order by ${rank('c')} asc, c.created_at asc
     limit $2
     for update skip locked
  )
  returning q.id, q.job_ref, q.payload`;
}

/**
 * คิวรีเสิร์ฟตัวจริง — export ไว้ให้เทสต์อ่านโครงสร้าง (เงื่อนไขพวกนี้พังแล้วเงียบสนิท)
 * ⚠️ ฐานที่ยังไม่รัน 084 ใช้ `TAKE_PENDING_SQL_NO_RANK` แทน (ดู takePendingLumosItems)
 */
export const TAKE_PENDING_SQL = buildTakePendingSql(true);
export const TAKE_PENDING_SQL_NO_RANK = buildTakePendingSql(false);

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

  const params = [channel, Math.min(Math.max(limit, 1), 500)];
  let rows: Array<{ id: number; job_ref: string; payload: unknown }>;
  try {
    ({ rows } = await dbQuery<{ id: number; job_ref: string; payload: unknown }>(TAKE_PENDING_SQL, params));
  } catch (e) {
    // ⚠️ ยังไม่รัน 084 → **ห้ามให้คิวหยุดเดิน** (Lumos จะไม่ได้งานเลย ซึ่งแย่กว่าเรียงผิด)
    // ถอยไปคิวรีที่ไม่มี match_rank = พฤติกรรมเดิมเป๊ะ (เรียงตามคิวเก่าก่อน)
    if (!isUndefinedColumnError(e)) throw e;
    logError('lumos.serve.match_rank.missing', {
      hint: 'ยังไม่ได้รัน migration 084 — คิวยังเดินแต่เรียงตามลำดับเข้าคิว ไม่ใช่คะแนน AI',
    });
    ({ rows } = await dbQuery<{ id: number; job_ref: string; payload: unknown }>(
      TAKE_PENDING_SQL_NO_RANK,
      params,
    ));
  }

  // stamp "Lumos ดึงงานไปครั้งแรก" (088) — post-update แยกจากคิวรีเสิร์ฟ โดยตั้งใจ:
  // ยัด first_delivered_at เข้า SET ของ TAKE_PENDING_SQL จะต้องมี variant คูณสอง
  // (084×088) · coalesce = idempotent เสิร์ฟซ้ำไม่ทับค่าแรก · ล้ม/ยังไม่รัน 088
  // ห้ามกระทบการเสิร์ฟ (delivered_at เดิมยังบอกรอบล่าสุดอยู่)
  if (rows.length > 0) {
    try {
      await dbQuery(
        `update ${queueTable}
            set first_delivered_at = coalesce(first_delivered_at, now())
          where id = any($1::bigint[])`,
        [rows.map((r) => r.id)],
      );
    } catch (e) {
      if (!isUndefinedColumnError(e)) throw e;
      logError('lumos.serve.stamps.missing', {
        hint: 'ยังไม่ได้รัน migration 088 — เสิร์ฟได้ปกติแต่ไม่มี first_delivered_at',
      });
    }
  }

  /**
   * เติม **รายได้ต่อเดือน + สวัสดิการ** ตอนเสิร์ฟ (เจ้าของสั่ง 15 ส.ค. 2569:
   * "OT ชั่วโมงละเท่าไหร่ เบี้ยขยัน ค่าโทรศัพท์ ถ้าหน่วยงานไหนมีส่งไปด้วย"
   * · 16 ส.ค.: บทพูดต้องบอกรายได้ด้วย)
   *
   * ทำไมตอนเสิร์ฟ ไม่ใช่ตอนเข้าคิว:
   * - เส้น auto เข้าคิวจาก /api/public/apply ซึ่ง **ห้ามยิง ERP เด็ดขาด** — เติมตรงนี้
   *   ทั้งเส้น auto/manual/iRecruit ได้ข้อมูลเท่ากันหมด
   * - ข้อมูลสดเสมอ (อัตราเปลี่ยนก็ได้ค่าล่าสุด ไม่ค้างใน payload เก่า)
   * - 🔴 **หน่วยของค่าแรงรู้ได้ที่นี่ที่เดียว** — `total_income` ตอนประกอบ payload คือ
   *   `payment_rate` ดิบ ไม่มีหน่วย (รายวัน 2,608 แถวจาก 16,264) พูดออกไปตรง ๆ
   *   = บอกเลขผิดสูงสุด 30 เท่า · ที่นี่มี `fee_unit_code_1` จึงคิดเป็นรายเดือนได้
   * ⚠️ ERP ล่ม/ช้า = เสิร์ฟแบบไม่พูดเรื่องเงินเลย (คิวหยุดเดินแย่กว่าขาดข้อมูลเสริม
   *   และ "ไม่พูด" ปลอดภัยกว่า "พูดเลขที่ไม่รู้หน่วย")
   * ⚠️ ทำทั้งสองช่อง — reminder ก็ต้องมี เพราะเลขรายได้ถูกถอดออกจากบทตอนประกอบแล้ว
   */
  if (rows.length > 0) {
    try {
      const byNo = await fetchJobBenefitRates(
        rows.map((r) => requestNoFromJobRef(r.job_ref)).filter((v): v is string => Boolean(v)),
      );
      if (byNo.size > 0) {
        for (const r of rows) {
          const no = requestNoFromJobRef(r.job_ref);
          const rates = no ? byNo.get(no) : undefined;
          if (!rates || rates.length === 0) continue;
          const sentence = buildExtraInfoSentence({
            monthlyIncome: monthlyGuaranteedIncome(rates).total,
            benefitLine: speakableBenefitLine(rates),
          });
          if (!sentence) continue;
          appendExtraInfoToPayload(r.payload, sentence);
        }
      }
    } catch (e) {
      logError('lumos.serve.benefits.failed', e, {
        hint: 'อ่านอัตราจาก ERP ไม่ได้ — เสิร์ฟแบบไม่มีรายได้/สวัสดิการ (คิวยังเดินปกติ)',
      });
    }
  }

  return rows.map((r) => bumpScheduledAtForward(r.payload));
}

/** ผูกผลจาก Lumos กลับเข้าคิว — หาแถวจาก client id ใน payload */
export async function applyLumosResult(
  channel: 'reminder' | 'interview',
  clientId: string,
  status: 'completed' | 'failed' | 'cancelled',
  result: unknown,
  /**
   * คำผลที่ใช้ "ตามงานต่อ" — ไม่ส่ง = อ่านจาก `result.outcome` ตามเดิม
   * ช่องสัมภาษณ์ส่งคำที่แปลแล้วเข้ามา (`completed` → `confirmed`) เพราะสองช่อง
   * ใช้ศัพท์คนละชุด · **ผลดิบใน `result` ยังเป็นคำเดิมของ Lumos ไม่ถูกทับ**
   */
  outcomeForFollowup?: string | null,
): Promise<boolean> {
  const idField = channel === 'reminder' ? 'client_contact_id' : 'client_candidate_id';
  // ⚠️ stamp `first_result_at` **ใน UPDATE เดียวกับผล** (migration 088) — เวลานี้คือ
  // หลักฐาน "ถูกโทรแล้ว" ของ dashboard เขียนครั้งเดียวด้วย coalesce แล้วห้ามมี reset
  // ที่ไหนล้าง (มีเทสต์ guard คุม) · ฐานยังไม่รัน 088 → ถอยไป SQL เดิม (คิวห้ามหยุดเดิน)
  const applySql = (withStamps: boolean) =>
    `update ${queueTable}
        set status = $3, result = $4::jsonb, updated_at = now()${
          withStamps
            ? `,
            first_result_at = coalesce(first_result_at, now()),
            last_result_at = now()`
            : ''
        }
      where channel = $1 and payload->>'${idField}' = $2
      returning id`;
  const params = [channel, clientId, status, JSON.stringify(result ?? null)];
  let rows: Array<{ id: number }>;
  try {
    ({ rows } = await dbQuery<{ id: number }>(applySql(true), params));
  } catch (e) {
    if (!isUndefinedColumnError(e)) throw e;
    logError('lumos.result.stamps.missing', {
      hint: 'ยังไม่ได้รัน migration 088 — ผลถูกบันทึกแต่ไม่มี first_result_at (เวลารอโทรจะไม่แม่น)',
    });
    ({ rows } = await dbQuery<{ id: number }>(applySql(false), params));
  }
  if (rows.length === 0) return false;

  // ได้ผลแล้วต้องมีคนทำอะไรต่อ — ไม่รับสายก็โทรซ้ำ ขอเลื่อนก็นัดใหม่ ครบเพดานก็ส่งให้คนตาม
  // เดิมจบแค่บันทึกผล งานเลยตายคาที่ · error ที่นี่ห้ามทำให้ ingest ล้ม (Lumos จะยิงซ้ำ)
  const outcome = outcomeForFollowup ?? readOutcome(result);
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
