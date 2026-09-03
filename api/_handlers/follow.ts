/**
 * Follow — รายชื่อคนที่ต้องติดตาม (คนกรอกเอง) → ส่งเข้าเส้น reminder ให้ Lumos โทร
 *
 * GET    /api/follow            → รายการ + สถานะการโทรจาก Lumos
 * POST   /api/follow            → เพิ่มรายชื่อ (enqueue ให้ Lumos ทันที)
 * DELETE /api/follow?id=<uuid>  → ยกเลิก (soft cancel + ยกเลิกในคิวถ้ายังไม่ถูกดึง)
 * DELETE /api/follow?id=<uuid>&purge=1 → **ลบทิ้งจริง** (admin เท่านั้น · ล้างข้อมูลทดสอบ)
 */
import { dbQuery } from '../_lib/postgres.js';

/** 42703 undefined_column — โค้ดใหม่ขึ้นก่อน migration 092 (group_id/call_times) */
function isUndefinedColumn(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703';
}
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import type { FollowDispatchState } from '@/lib/followDispatchState';
import { tableInAppSchema } from '../_lib/schema.js';
import { logWarn } from '../_lib/logger.js';
import { auditFromAuthed } from '../_lib/audit.js';
import {
  enqueueFollowReminder,
  cancelFollowReminder,
  refreshFollowReminderPayload,
} from '../_lib/lumosDispatch.js';
import { isAutoDispatchEnabled } from '../_lib/lumosDispatchMode.js';
import { toE164Thai } from '../_lib/lumosDispatch.js';
import {
  FOLLOW_OUTCOME_ALL,
  isFollowOutcome,
  requiresNote,
} from '../../src/lib/followOutcome.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');
const staffTable = tableInAppSchema('follow_staff_contacts');

/**
 * ชื่อเจ้าหน้าที่จากเบอร์ — บทติดตามแนะนำตัวด้วยชื่อคนตาม (เจ้าของสั่ง 1 ก.ย. 2569:
 * *"สวัสดีค่ะ ...(ชื่อเจ้าของงาน)... จากสยามราชธานีนะคะ"*)
 *
 * 🔴 **ไม่เพิ่มคอลัมน์ในใบติดตาม** — ฟอร์มเก็บแค่เบอร์ (คนเลือกจาก dropdown ที่มีชื่ออยู่แล้ว)
 * เทียบด้วย **เลข 9 ตัวท้าย** เพราะเบอร์ในสองตารางเขียนคนละรูป (0812345678 / +66812345678)
 * ⚠️ หาไม่เจอ = คืน null แล้วบททักทายโดยไม่เอ่ยชื่อ **ห้ามเดาชื่อ**
 */
async function staffNameOfPhone(phone: string | null): Promise<string | null> {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  try {
    const { rows } = await dbQuery<{ name: string }>(
      `select name from ${staffTable}
        where right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1
        order by created_at desc limit 1`,
      [digits.slice(-9)],
    );
    return rows[0]?.name?.trim() || null;
  } catch {
    // ตารางยังไม่ migrate / ค้นไม่ได้ = ไม่มีชื่อ — ห้ามทำให้สร้างรายการล้ม
    return null;
  }
}

type LumosNextAction = {
  type: string;
  urgency: 'urgent' | 'normal' | 'not urgent';
  due_at: string;
  reason: string;
};

type FollowRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI บอกผู้สมัครไว้โทรกลับ (migration 081) */
  staff_phone: string | null;
  scheduled_at: string | Date;
  /** รอบเวลาของวันนั้น (092) — ต้องพกไปด้วยตอนสร้าง payload ใหม่ ไม่งั้นตารางหลายรอบหาย */
  call_times: string[] | null;
  /**
   * รอบนี้คือ "สายที่เท่าไหร่" (113) — คนเลือกเองตอนเพิ่ม
   * 1 = สายแรก (บท `follow`) · 2 ขึ้นไป = บท `follow_repeat` · null = แถวเก่า ถือเป็นสายแรก
   */
  call_round: number | null;
  /** หน่วยงานที่ตามเรื่องให้ + รหัสไซต์ (migration 096) — snapshot ตอนกรอก ไม่ใช่ FK */
  unit_name: string | null;
  site_code: string | null;
  created_by_name: string | null;
  /** คนแก้ล่าสุด — คนละคนกับเจ้าของข้อมูล (created_by_name) ได้ */
  updated_at: string | Date | null;
  updated_by_name: string | null;
  cancelled_at: string | Date | null;
  /** ปิดงานแล้วเมื่อไหร่ + จบแบบไหน (migration 095) */
  completed_at: string | Date | null;
  outcome_code: string | null;
  outcome_note: string | null;
  completed_by_name: string | null;
  created_at: string | Date;
  /**
   * ผลตอนพยายามส่งเข้าคิว AI ตอนสร้าง (migration 109)
   * `null` = แถวเก่าก่อนมีคอลัมน์นี้ ⇒ **ไม่รู้ว่าทำไม** ห้ามตีความว่าส่งแล้ว
   */
  dispatch_state: string | null;
  call_status: string | null;
  call_outcome: string | null;
  /** รอบที่โทรล่าสุดของแถวคิว — ใช้จัดกลุ่ม "ใครอยู่รอบไหน" บนแผงหน้าหลัก */
  call_attempt: number | null;
  call_summary: string | null;
  call_next_action: LumosNextAction | null;
  called_at: string | Date | null;
  /** สถานะ followup ของคิว (070) — 'needs_human' = AI เอาไม่อยู่ ต้องคนตาม */
  followup_state: string | null;
  /**
   * เบอร์ฉุกเฉินที่ส่งไปกับสายนั้น (`payload->>'admin_phone'`) — เบอร์ที่ **AI โทรหา**
   * เมื่อติดต่อผู้รับไม่ได้ · คนละช่องกับเบอร์ที่ AI พูดให้ผู้สมัครโทรกลับ
   *
   * 🔴 feedback 2 ก.ย. 2569: *"เพิ่มการแสดงสถานะการโทรติดต่อเบอร์ฉุกเฉิน"*
   * ⚠️ **บอกได้แค่ "ส่งเบอร์ไปแล้ว" ไม่ใช่ "โทรไปแล้ว"** — ผลที่ Lumos ส่งกลับ
   * ยังไม่มีช่องบอกว่าโทรเบอร์ฉุกเฉินหรือยัง (ตรวจครบทุกช่อง 2 ก.ย. 2569)
   */
  emergency_phone: string | null;
};

const iso = (v: string | Date | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

function toResponse(r: FollowRow) {
  return {
    id: r.id,
    recipient_name: r.recipient_name,
    recipient_phone: r.recipient_phone,
    topic: r.topic,
    note: r.note,
    staff_phone: r.staff_phone ?? null,
    dispatch_state: r.dispatch_state ?? null,
    scheduled_at: iso(r.scheduled_at),
    unit_name: r.unit_name ?? null,
    site_code: r.site_code ?? null,
    /** สายที่เท่าไหร่ (113) — null = ไม่ได้ระบุ ฝั่งจออ่านเป็นสายแรก */
    call_round: r.call_round == null ? null : Number(r.call_round),
    /** เบอร์ฉุกเฉินที่ส่งไปกับสายนั้น — null = ไม่เคยเข้าคิว หรือไม่มีเบอร์ให้ส่ง */
    emergency_phone: r.emergency_phone ?? null,
    /** เจ้าของข้อมูล = คนที่กรอกครั้งแรก · ไม่เปลี่ยนแม้มีคนอื่นมาแก้ทีหลัง */
    created_by_name: r.created_by_name,
    updated_at: iso(r.updated_at ?? null),
    updated_by_name: r.updated_by_name ?? null,
    created_at: iso(r.created_at),
    cancelled: r.cancelled_at != null,
    // ปิดงาน (095) — คนละช่องกับ cancelled โดยตั้งใจ (ตามจนจบ ≠ ตัดทิ้งก่อนถึงวัน)
    completed_at: iso(r.completed_at ?? null),
    outcome_code: r.outcome_code ?? null,
    outcome_note: r.outcome_note ?? null,
    completed_by_name: r.completed_by_name ?? null,
    /** สถานะจากคิว Lumos: pending=รอโทร, delivered=Lumos รับไปแล้ว, completed/failed/cancelled */
    /**
     * 🔴 **ห้ามเดา `'pending'` เมื่อไม่มีแถวในคิว** (แก้ 25 ส.ค. 2569)
     *
     * เดิม `r.call_status ?? 'pending'` ⇒ รายการที่ **ไม่เคยถูกส่งให้ AI เลย**
     * ขึ้นบนจอว่า **"รอ AI โทร"** · นี่คือเหตุผลที่งานหายไป 5 วันโดยไม่มีใครสังเกต
     * (รายการ 24 ส.ค. 2569 — ไม่มีแถวในคิว แต่จอบอกว่ากำลังรอโทร)
     *
     * `null` = ไม่อยู่ในคิว · ฝั่งจอใช้ `followDispatchLabel()` บอกว่าไม่ได้ส่งเพราะอะไร
     */
    call_status: r.cancelled_at != null ? 'cancelled' : (r.call_status ?? null),
    call_outcome: r.call_outcome,
    call_attempt: r.call_attempt == null ? null : Number(r.call_attempt),
    call_summary: r.call_summary,
    next_action: r.call_next_action ?? null,
    called_at: iso(r.called_at),
    /**
     * 'needs_human' = AI เอาไม่อยู่ ต้องคนตาม (070) — กล่อง "โทรครบแล้ว" (Phase 7.1) ใช้ตัวนี้
     * ⚠️ ส่งมาดิบ ๆ · การตีความอยู่ที่ `followCompletion.ts` ฝั่งเดียว
     */
    followup_state: r.followup_state ?? null,
  };
}

async function listFollow(req: AuthedReq, res: ApiRes) {
  const rawLimit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

  const { rows } = await dbQuery<FollowRow>(
    /**
     * ⚠️ รวมสองสายที่ทำขนานกัน 17 ส.ค. 2569 — merge ต่อบรรทัดให้ดื้อ ๆ จน SQL พัง
     * (ไม่มี conflict marker เพราะเป็นการเพิ่มบรรทัดติดกัน) เก็บของทั้งสองฝั่ง:
     *   · `next_action` ของอีกสาย
     *   · `coalesce(last_outcome, result->>'outcome')` ของสายนี้ — ผลที่คนบันทึกเขียนแค่
     *     `last_outcome` ส่วนแถวก่อน migration 070 มีแต่ `result` อ่านทางเดียวจะหายเงียบ
     */
    `select f.*,
            q.status                                       as call_status,
            coalesce(q.last_outcome, q.result->>'outcome') as call_outcome,
            q.attempt_count                                as call_attempt,
            q.result->>'summary'                           as call_summary,
            q.result->'next_action'                        as call_next_action,
            q.updated_at                                   as called_at,
            q.followup_state                               as followup_state,
            q.payload->>'admin_phone'                      as emergency_phone
       from ${followTable} f
       left join ${queueTable} q
              on q.channel = 'reminder'
             and q.job_ref = 'follow'
             and q.person_ref = 'follow-' || f.id::text
      order by f.created_at desc
      limit $1`,
    [limit],
  );
  return res.status(200).json({ items: rows.map(toResponse), total: rows.length });
}

export type ParsedFollowInput = {
  name: string;
  phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — ไว้ให้ AI บอกผู้สมัครโทรกลับ ไม่ใช่เบอร์ที่ระบบโทรออก */
  staffPhone: string | null;
  when: Date;
  /** ชุดตารางโทร (migration 092) — client gen uuid เดียวต่อ 1 คน แล้วยิง 1 แถว/วัน · null = รอบเดี่ยว */
  groupId: string | null;
  /** รอบเวลาของวันนั้น (HH:MM) — payload สร้าง steps ตามนี้ · ว่าง = 1 รอบที่ when */
  callTimes: string[] | null;
  /** หน่วยงานที่ตามเรื่องให้ (096) — เลือกจากใบขอหรือพิมพ์เอง · null = ไม่ได้ระบุ */
  unitName: string | null;
  /** รหัสไซต์ของหน่วยงานนั้น — เติมเองเมื่อเลือกจากใบขอ */
  siteCode: string | null;
  /**
   * รอบนี้คือสายที่เท่าไหร่ (113) — คนเลือกจาก dropdown ตอนตั้งรอบ
   * null = ไม่ได้ระบุ ⇒ ถือเป็นสายแรก (ของเดิมที่ยิงมาโดยไม่มีคีย์นี้จึงไม่พัง)
   */
  callRound: number | null;
};

const HHMM_RE = /^\d{1,2}:\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * อ่าน/ตรวจ body ของ POST /api/follow — pure เพื่อคุมด้วย unit test
 * ระวัง: getString() trim ให้แล้วและคืน null เมื่อไม่มีค่า — อย่าเรียก .trim() ต่อ
 */
export type FollowInputResult = { error: string | null; value: ParsedFollowInput | null };

export function parseFollowInput(raw: unknown, now = new Date()): FollowInputResult {
  const fail = (message: string): FollowInputResult => ({ error: message, value: null });
  if (typeof raw !== 'object' || raw === null) {
    return fail('Invalid JSON body');
  }
  const body = raw as Record<string, unknown>;
  const name = getString(body.recipient_name) ?? '';
  const phoneRaw = getString(body.recipient_phone) ?? '';
  const topic = getString(body.topic) ?? '';
  const note = getString(body.note) || null;
  const staffPhoneRaw = getString(body.staff_phone) || '';
  const scheduledAt = getString(body.scheduled_at) ?? '';

  if (!name) return fail('กรุณากรอกชื่อผู้ที่ต้องติดตาม');
  if (!topic) return fail('กรุณากรอกเรื่องที่จะให้โทรติดตาม');

  const phone = toE164Thai(phoneRaw);
  if (!phone) {
    return fail('เบอร์โทรไม่ถูกต้อง — ใช้เบอร์มือถือ 10 หลัก เช่น 0812345678');
  }

  // ⚠️ เบอร์เจ้าหน้าที่เป็น **เบอร์ที่ AI พูดให้ฟัง** ไม่ใช่เบอร์ที่ระบบโทรออก
  // จึงไม่บังคับรูปแบบ E.164 (เบอร์บ้าน/เบอร์ต่อภายในก็ใช้ได้) แต่ต้องมีตัวเลขจริง
  // ไม่งั้นผู้สมัครจะได้ยินข้อความที่โทรกลับไม่ได้
  let staffPhone: string | null = null;
  if (staffPhoneRaw) {
    if ((staffPhoneRaw.match(/\d/g) ?? []).length < 8) {
      return fail('เบอร์เจ้าหน้าที่ไม่ถูกต้อง — ใส่เบอร์ที่ผู้สมัครโทรกลับได้จริง');
    }
    staffPhone = staffPhoneRaw;
  }

  const when = scheduledAt ? new Date(scheduledAt) : now;
  if (Number.isNaN(when.getTime())) {
    return fail('วันเวลาที่ให้โทรไม่ถูกต้อง');
  }

  // ตารางโทร (092): group_id (client gen · 1 คน 1 uuid) + call_times (รอบของวันนั้น)
  let groupId: string | null = null;
  const groupRaw = getString(body.group_id) || '';
  if (groupRaw) {
    if (!UUID_RE.test(groupRaw)) return fail('group_id ไม่ถูกต้อง');
    groupId = groupRaw;
  }
  let callTimes: string[] | null = null;
  if (Array.isArray(body.call_times)) {
    const times = body.call_times
      .map((t) => (typeof t === 'string' ? t.trim() : ''))
      .filter((t) => HHMM_RE.test(t));
    const uniq = [...new Set(times)];
    if (uniq.length === 0) return fail('รอบเวลาโทรไม่ถูกต้อง (เช่น 07:00)');
    if (uniq.length > 5) return fail('รอบโทรต่อวันมากสุด 5 รอบ');
    callTimes = uniq;
  }

  // หน่วยงาน/รหัสไซต์ (096) — ไม่บังคับ · Follow หลายเคสไม่ได้ผูกกับใบขอใด
  const unitName = getString(body.unit_name) || null;
  const siteCode = getString(body.site_code) || null;

  /**
   * สายที่เท่าไหร่ (113) — ตรวจที่นี่แทน CHECK constraint (บ้านนี้โดน CHECK ล็อกมาสองรอบ)
   * ไม่ส่งมา = null (สายแรก) · ค่าที่อ่านไม่ออก/นอกช่วง = ปฏิเสธไปตรง ๆ ไม่แอบปัดให้
   */
  let callRound: number | null = null;
  if (body.call_round != null && body.call_round !== '') {
    const n = Number(body.call_round);
    if (!Number.isInteger(n) || n < 1 || n > 9) return fail('สายที่เท่าไหร่ต้องเป็นเลข 1-9');
    callRound = n;
  }

  return {
    error: null,
    value: {
      name, phone, topic, note, staffPhone, when, groupId, callTimes, unitName, siteCode, callRound,
    },
  };
}

async function createFollow(req: AuthedReq, res: ApiRes) {
  const parsed = parseFollowInput(await readJsonBody(req));
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const { name, phone, topic, note, staffPhone, when, groupId, callTimes, unitName, siteCode, callRound } =
    parsed.value;

  // ฐานที่รัน 092 แล้วเก็บ group_id/call_times · ยังไม่รัน → ถอยไป insert ชุดเดิม (42703)
  let created: FollowRow | undefined;
  try {
    const { rows } = await dbQuery<FollowRow>(
      `insert into ${followTable}
         (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
          group_id, call_times, unit_name, site_code, call_round, created_by, created_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning *`,
      [name, phone, topic, note, staffPhone, when.toISOString(), groupId, callTimes,
       unitName, siteCode, callRound, req.user.sub, req.user.email],
    );
    created = rows[0];
  } catch (e) {
    if (!isUndefinedColumn(e)) throw e;
    const { rows } = await dbQuery<FollowRow>(
      `insert into ${followTable}
         (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at, created_by, created_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [name, phone, topic, note, staffPhone, when.toISOString(), req.user.sub, req.user.email],
    );
    created = rows[0];
  }
  if (!created) return sendError(res, 500, 'Failed to create follow entry');

  /**
   * ส่งให้ Lumos โทรตาม **เฉพาะเมื่อตั้งโหมดเป็น auto**
   *
   * 🔴 **ผลต้องกลับไปถึงคนกด** (เจ้าของสั่ง 25 ส.ค. 2569) — เดิมเรียกแล้วทิ้งผล
   * ระบบ "ไม่ส่ง" ได้หลายทางและถูกต้องทุกทาง แต่**เงียบสนิท** ⇒ คนสร้างรายการเสร็จ
   * เห็นว่าสำเร็จ แล้วนั่งรอสายที่ไม่มีวันออก (เกิดจริง 24 ส.ค. 2569 กว่าจะรู้ต้องไล่ฐาน)
   * ตอนนี้จด `dispatch_state` ไว้ที่แถว + ส่งกลับใน response ให้จอบอกได้ทันที
   *
   * ⚠️ จดผลล้มเหลวห้ามทำให้สร้างรายการล้ม — รายการถูกบันทึกไปแล้ว
   */
  let dispatchState: FollowDispatchState = 'off';
  if (await isAutoDispatchEnabled('follow_entry')) {
    dispatchState = await enqueueFollowReminder({
      id: created.id,
      recipient_name: name,
      recipient_phone: phone,
      topic,
      note,
      staffPhone,
      staffName: await staffNameOfPhone(staffPhone),
      unitName,
      scheduled_at: when,
      callTimes,
      callRound,
    });
  }
  try {
    await dbQuery(`update ${followTable} set dispatch_state = $2 where id = $1`, [
      created.id,
      dispatchState,
    ]);
    created = { ...created, dispatch_state: dispatchState };
  } catch (e) {
    // ฐานยังไม่รัน 109 → ข้ามการจด (จอถอยไปอ่านสถานะจากคิวเหมือนเดิม)
    if (!isUndefinedColumn(e)) throw e;
  }

  await auditFromAuthed(req, {
    action: 'follow.create',
    entityType: 'follow_entry',
    entityId: created.id,
    after: toResponse(created),
  });

  return res.status(201).json(toResponse(created));
}

async function cancelFollow(req: AuthedReq, res: ApiRes) {
  const id = getString(req.query?.id) ?? '';
  if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable} set cancelled_at = now()
      where id = $1 and cancelled_at is null
      returning *`,
    [id],
  );
  const cancelled = rows[0];
  if (!cancelled) return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือยกเลิกไปแล้ว');

  const removedFromQueue = await cancelFollowReminder(id);

  await auditFromAuthed(req, {
    action: 'follow.cancel',
    entityType: 'follow_entry',
    entityId: id,
    after: { ...toResponse(cancelled), removedFromQueue },
  });

  return res.status(200).json({ ...toResponse(cancelled), removedFromQueue });
}

/**
 * **ลบทิ้งจริง** — `DELETE /api/follow?id=<uuid>&purge=1`
 *
 * เจ้าของสั่ง 3 ก.ย. 2569: *"หน้าการติดตาม ทำให้ฉันลบได้หน่อย เฉพาะฉันนะ
 * เพราะตอนนี้ทดสอบอยู่"* — ช่วงทดลองมีแถวขยะค้างเยอะ "ยกเลิก" ยังโชว์บนจอ
 * (ตั้งใจ: ยกเลิกคือประวัติ) จึงต้องมีทางลบให้หายจริง
 *
 * 🔴 **admin เท่านั้น** — role อื่นได้ 403 แม้เส้น `follow` จะเปิดถึง staff
 * 🔴 **ลบแถวคิว Lumos ของรายการนั้นด้วย** ไม่งั้นคิวยังจ่อโทรหาคนจริงทั้งที่ต้นเรื่องหายแล้ว
 *    (ลบด้วย `person_ref` แบบตรงตัวเป๊ะ ๆ ห้ามใช้ LIKE — `_` เป็นไวลด์การ์ด เคยลบของจริงพลาด)
 * 🔴 ลบแล้วกู้ไม่ได้ — จดลง audit ก่อนลบเสมอ (เก็บค่าเดิมไว้ใน `before`)
 */
async function purgeFollow(req: AuthedReq, res: ApiRes) {
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'ลบทิ้งได้เฉพาะผู้ดูแลระบบ (admin)');
  }

  const id = getString(req.query?.id) ?? '';
  if (!id) return sendError(res, 400, 'Bad request', 'Query id is required');

  const { rows } = await dbQuery<FollowRow>(`select * from ${followTable} where id = $1`, [id]);
  const target = rows[0];
  if (!target) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');

  const { rows: removed } = await dbQuery<{ id: string }>(
    `delete from ${queueTable} where person_ref = $1 returning id`,
    [`follow-${id}`],
  );

  await dbQuery(`delete from ${followTable} where id = $1`, [id]);

  await auditFromAuthed(req, {
    action: 'follow.purge',
    entityType: 'follow_entry',
    entityId: id,
    before: { ...toResponse(target), queueRowsDeleted: removed.length },
  });

  return res.status(200).json({ purged: true, id, queueRowsDeleted: removed.length });
}

/**
 * ปิดงานติดตาม (migration 095 · เจ้าของสั่ง 17 ส.ค. 2569) — PATCH /api/follow?id=<uuid>
 *
 * ⚠️ **คนละเรื่องกับ DELETE (ยกเลิก)** — ยกเลิก = ไม่ต้องตามแล้ว ตัดสายทิ้งก่อนถึงวัน ·
 * ปิดงาน = ตามจนจบแล้ว บันทึกว่าจบแบบไหน · สองอย่างเก็บคนละช่องและนับคนละกอง
 *
 * ⚠️ ไม่แตะคิวโทร — รายการที่ปิดแล้วแต่ยังมีรอบค้างในตาราง ให้กดยกเลิกแยก
 * (ปิดงานแล้วลบสายที่นัดไว้อัตโนมัติ = เดาแทนคน · เจ้าของยังไม่ได้สั่ง)
 */
async function completeFollow(req: AuthedReq, res: ApiRes, body: Record<string, unknown> | null) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const outcome = getString(body?.outcome_code) ?? '';
  const note = getString(body?.outcome_note) || null;

  if (!isFollowOutcome(outcome)) {
    return sendError(
      res, 400, 'Bad request',
      `ผลปิดงานต้องเป็นค่าใดค่าหนึ่ง: ${FOLLOW_OUTCOME_ALL.join(', ')}`,
    );
  }
  // 'อื่น ๆ' ที่ไม่มีคำอธิบาย = เก็บไปก็ตอบอะไรไม่ได้ (กติกาเดียวกับ requiresNote ฝั่งหน้าเว็บ)
  if (requiresNote(outcome) && !note) {
    return sendError(res, 400, 'Bad request', 'เลือก "อื่น ๆ" ต้องใส่หมายเหตุด้วย');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set completed_at = now(), outcome_code = $2, outcome_note = $3,
            completed_by = $4, completed_by_name = $5
      where id = $1 and completed_at is null and cancelled_at is null
      returning *`,
    [id, outcome, note, req.user.sub, req.user.email ?? null],
  );
  const done = rows[0];
  if (!done) {
    return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือปิด/ยกเลิกไปแล้ว');
  }

  await auditFromAuthed(req, {
    action: 'follow.complete',
    entityType: 'follow_entry',
    entityId: id,
    after: { outcome_code: outcome, outcome_note: note },
  });

  return res.status(200).json(toResponse(done));
}

/**
 * ฟิลด์ที่แก้ได้ของรายการติดตาม (096 · เจ้าของสั่ง 17 ส.ค. 2569: *"เพิ่มให้แก้ไขได้"*)
 *
 * ⚠️ **เจ้าของข้อมูลแก้ไม่ได้** — `created_by` / `created_by_name` คือคนที่กรอกครั้งแรก
 * ทับเมื่อไหร่ = ประวัติว่าใครลงงานนี้หายเงียบ ๆ · คนแก้ทีหลังลงที่ `updated_by_name` แทน
 *
 * ⚠️ **`group_id` / `call_times` แก้ไม่ได้ทางนี้** — สองอันนั้นกำหนดรูปตารางโทรทั้งชุด
 * แก้ทีละแถวคือชุดเพี้ยน (บางวันรอบไม่เท่ากัน) · จะเปลี่ยนตารางให้ยกเลิกชุดแล้วตั้งใหม่
 */
export type ParsedFollowEdit = {
  name: string;
  phone: string;
  topic: string;
  note: string | null;
  staffPhone: string | null;
  when: Date;
  unitName: string | null;
  siteCode: string | null;
};

export function parseFollowEditInput(
  raw: unknown,
  now = new Date(),
): { error: string | null; value: ParsedFollowEdit | null } {
  // ใช้ตัวตรวจชุดเดียวกับตอนสร้าง — กติกาความถูกต้องต้องเหมือนกันเป๊ะ
  // ไม่งั้นแก้ทีหลังจะใส่ค่าที่ตอนสร้างห้ามใส่ได้ (เช่นเบอร์ที่โทรไม่ได้)
  const parsed = parseFollowInput(raw, now);
  if (parsed.error || !parsed.value) return { error: parsed.error, value: null };
  const v = parsed.value;
  return {
    error: null,
    value: {
      name: v.name,
      phone: v.phone,
      topic: v.topic,
      note: v.note,
      staffPhone: v.staffPhone,
      when: v.when,
      unitName: v.unitName,
      siteCode: v.siteCode,
    },
  };
}

/**
 * แก้ไขรายการติดตาม — PATCH /api/follow?id=<uuid> body มี `action: 'update'`
 *
 * ⚠️ PATCH เดิม (ไม่มี action) = **ปิดงาน** ยังทำงานเหมือนเดิมทุกอย่าง
 * แยกด้วย action เพราะของเก่ามีคนใช้อยู่ เปลี่ยนความหมายกลางทางคือพังเงียบ
 */
async function updateFollow(req: AuthedReq, res: ApiRes, body: Record<string, unknown>) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const parsed = parseFollowEditInput(body);
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const v = parsed.value;

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการติดตาม');
  // ปิด/ยกเลิกไปแล้ว = จบเรื่องแล้ว แก้ย้อนหลังคือแก้ประวัติ
  if (before.cancelled_at != null) {
    return sendError(res, 409, 'Conflict', 'รายการนี้ยกเลิกไปแล้ว แก้ไขไม่ได้');
  }
  if (before.completed_at != null) {
    return sendError(res, 409, 'Conflict', 'รายการนี้ปิดงานไปแล้ว แก้ไขไม่ได้');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set recipient_name = $2, recipient_phone = $3, topic = $4, note = $5,
            staff_phone = $6, scheduled_at = $7, unit_name = $8, site_code = $9,
            updated_at = now(), updated_by = $10, updated_by_name = $11
      where id = $1 and cancelled_at is null and completed_at is null
      returning *`,
    [id, v.name, v.phone, v.topic, v.note, v.staffPhone, v.when.toISOString(),
     v.unitName, v.siteCode, req.user.sub, req.user.email ?? null],
  );
  const updated = rows[0];
  if (!updated) return sendError(res, 404, 'Not found', 'ไม่พบรายการ หรือปิด/ยกเลิกไปแล้ว');

  /**
   * 🔴 แก้แถวแล้วต้องแก้บทพูดในคิวด้วย — payload ถูกสร้างตอนเข้าคิว ไม่ใช่ตอนเสิร์ฟ
   * ไม่แก้ = AI ไปพูดชุดเก่าโดยที่หน้าจอโชว์ชุดใหม่
   * ได้ผลเฉพาะสายที่ Lumos ยังไม่ดึงไป — ดึงไปแล้วบอกคนใช้ตรง ๆ
   */
  let queueRefreshed = 0;
  try {
    queueRefreshed = await refreshFollowReminderPayload({
      id: updated.id,
      recipient_name: v.name,
      recipient_phone: v.phone,
      topic: v.topic,
      note: v.note,
      staffPhone: v.staffPhone,
      staffName: await staffNameOfPhone(v.staffPhone),
      unitName: v.unitName,
      scheduled_at: v.when,
      callTimes: updated.call_times ?? null,
      callRound: updated.call_round ?? null,
    });
  } catch (e) {
    logWarn('follow.update.queueRefreshFailed', { followId: id, error: String(e) });
  }

  await auditFromAuthed(req, {
    action: 'follow.update',
    entityType: 'follow_entry',
    entityId: id,
    before: toResponse(before),
    after: { ...toResponse(updated), queueRefreshed },
  });

  return res.status(200).json({ ...toResponse(updated), queue_refreshed: queueRefreshed });
}

/**
 * **ย้อนสถานะปิดงาน** (feedback 2 ก.ย. 2569:
 * *"กรณีแก้ไขสถานะเสร็จแล้ว อยากให้ทำได้ต่อเนื่อง (ย้อนกลับ) ไม่ต้องเริ่มใหม่ทุกครั้ง"*)
 *
 * เดิมกด "เสร็จสิ้น" แล้วปุ่มทุกปุ่มของรอบนั้นหายไป — เลือกผิดคือแก้ไม่ได้เลย
 * ต้องสร้างรายการใหม่ทั้งชุด
 *
 * 🔴 **ล้างเฉพาะช่องปิดงาน ไม่แตะคิวโทรและไม่แตะการยกเลิก** — ปิดงานเป็นบันทึกของคน
 * ส่วนสายที่โทรไปแล้วเป็นเหตุการณ์ที่เกิดขึ้นจริง ย้อนไม่ได้และไม่ควรย้อน
 * ⚠️ รายการที่ **ยกเลิก** ไปแล้วย้อนทางนี้ไม่ได้ (คนละเรื่องกับปิดงาน)
 */
async function reopenFollow(req: AuthedReq, res: ApiRes) {
  const id = typeof req.query?.id === 'string' ? req.query.id.trim() : '';
  if (!UUID_RE.test(id)) return sendError(res, 400, 'Bad request', 'ต้องระบุ id ของรายการติดตาม');

  const { rows: beforeRows } = await dbQuery<FollowRow>(
    `select * from ${followTable} where id = $1 limit 1`,
    [id],
  );
  const before = beforeRows[0];
  if (!before) return sendError(res, 404, 'Not found', 'ไม่พบรายการ');
  if (before.cancelled_at) {
    return sendError(res, 400, 'Bad request', 'รายการนี้ถูกยกเลิกไปแล้ว — ย้อนสถานะปิดงานไม่ได้');
  }
  if (!before.completed_at) {
    return sendError(res, 400, 'Bad request', 'รายการนี้ยังไม่ได้ปิดงาน ไม่มีอะไรให้ย้อน');
  }

  const { rows } = await dbQuery<FollowRow>(
    `update ${followTable}
        set completed_at = null, outcome_code = null, outcome_note = null,
            completed_by = null, completed_by_name = null,
            updated_at = now(), updated_by = $2, updated_by_name = $3
      where id = $1 and cancelled_at is null
      returning *`,
    [id, req.user.sub, req.user.email ?? null],
  );
  const done = rows[0];
  if (!done) return sendError(res, 404, 'Not found', 'ย้อนสถานะไม่สำเร็จ');

  await auditFromAuthed(req, {
    action: 'follow.reopen',
    entityType: 'follow_entry',
    entityId: id,
    before: { outcome_code: before.outcome_code, outcome_note: before.outcome_note },
    after: { outcome_code: null },
  });

  return res.status(200).json(toResponse(done));
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await listFollow(req, res);
    if (method === 'POST') return await createFollow(req, res);
    if (method === 'PATCH') {
      // action='update' = แก้ไข · action='reopen' = ย้อนสถานะปิดงาน
      // ไม่ใส่ = ปิดงาน (พฤติกรรมเดิม ห้ามเปลี่ยน)
      const body = ((await readJsonBody(req)) ?? {}) as Record<string, unknown>;
      const action = getString(body.action);
      if (action === 'update') return await updateFollow(req, res, body);
      if (action === 'reopen') return await reopenFollow(req, res);
      return await completeFollow(req, res, body);
    }
    if (method === 'DELETE') {
      // purge=1 = ลบทิ้งจริง (admin) · ไม่ใส่ = ยกเลิก (พฤติกรรมเดิม ห้ามเปลี่ยน)
      const purge = getString(req.query?.purge);
      if (purge === '1' || purge === 'true') return await purgeFollow(req, res);
      return await cancelFollow(req, res);
    }
    return sendError(res, 405, 'Method not allowed', 'Use GET, POST, PATCH or DELETE');
  } catch (e) {
    return handleApiError(res, e, `follow ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'follow');
