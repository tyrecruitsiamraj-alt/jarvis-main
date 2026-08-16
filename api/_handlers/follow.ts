/**
 * Follow — รายชื่อคนที่ต้องติดตาม (คนกรอกเอง) → ส่งเข้าเส้น reminder ให้ Lumos โทร
 *
 * GET    /api/follow            → รายการ + สถานะการโทรจาก Lumos
 * POST   /api/follow            → เพิ่มรายชื่อ (enqueue ให้ Lumos ทันที)
 * DELETE /api/follow?id=<uuid>  → ยกเลิก (soft cancel + ยกเลิกในคิวถ้ายังไม่ถูกดึง)
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
import { tableInAppSchema } from '../_lib/schema.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { enqueueFollowReminder, cancelFollowReminder } from '../_lib/lumosDispatch.js';
import { isAutoDispatchEnabled } from '../_lib/lumosDispatchMode.js';
import { toE164Thai } from '../_lib/lumosDispatch.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

type FollowRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
  /** เบอร์เจ้าหน้าที่ผู้ติดตาม — AI บอกผู้สมัครไว้โทรกลับ (migration 081) */
  staff_phone: string | null;
  scheduled_at: string | Date;
  created_by_name: string | null;
  cancelled_at: string | Date | null;
  created_at: string | Date;
  call_status: string | null;
  call_outcome: string | null;
  call_summary: string | null;
  called_at: string | Date | null;
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
    scheduled_at: iso(r.scheduled_at),
    created_by_name: r.created_by_name,
    created_at: iso(r.created_at),
    cancelled: r.cancelled_at != null,
    /** สถานะจากคิว Lumos: pending=รอโทร, delivered=Lumos รับไปแล้ว, completed/failed/cancelled */
    call_status: r.cancelled_at != null ? 'cancelled' : (r.call_status ?? 'pending'),
    call_outcome: r.call_outcome,
    call_summary: r.call_summary,
    called_at: iso(r.called_at),
  };
}

async function listFollow(req: AuthedReq, res: ApiRes) {
  const rawLimit = typeof req.query?.limit === 'string' ? Number(req.query.limit) : NaN;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 200;

  const { rows } = await dbQuery<FollowRow>(
    `select f.*,
            q.status                                       as call_status,
            coalesce(q.last_outcome, q.result->>'outcome') as call_outcome,
            q.result->>'summary'                           as call_summary,
            q.updated_at                                   as called_at
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

  return { error: null, value: { name, phone, topic, note, staffPhone, when, groupId, callTimes } };
}

async function createFollow(req: AuthedReq, res: ApiRes) {
  const parsed = parseFollowInput(await readJsonBody(req));
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const { name, phone, topic, note, staffPhone, when, groupId, callTimes } = parsed.value;

  // ฐานที่รัน 092 แล้วเก็บ group_id/call_times · ยังไม่รัน → ถอยไป insert ชุดเดิม (42703)
  let created: FollowRow | undefined;
  try {
    const { rows } = await dbQuery<FollowRow>(
      `insert into ${followTable}
         (recipient_name, recipient_phone, topic, note, staff_phone, scheduled_at,
          group_id, call_times, created_by, created_by_name)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning *`,
      [name, phone, topic, note, staffPhone, when.toISOString(), groupId, callTimes, req.user.sub, req.user.email],
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

  // ส่งให้ Lumos โทรตาม **เฉพาะเมื่อตั้งโหมดเป็น auto**
  // ปิดอยู่ = รายการถูกบันทึกไว้แต่ยังไม่มีใครโทร (ตั้งใจ — เจ้าของสั่งปิด auto ก่อน)
  if (await isAutoDispatchEnabled('follow_entry')) {
    await enqueueFollowReminder({
      id: created.id,
      recipient_name: name,
      recipient_phone: phone,
      topic,
      note,
      staffPhone,
      scheduled_at: when,
      callTimes,
    });
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

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await listFollow(req, res);
    if (method === 'POST') return await createFollow(req, res);
    if (method === 'DELETE') return await cancelFollow(req, res);
    return sendError(res, 405, 'Method not allowed', 'Use GET, POST or DELETE');
  } catch (e) {
    return handleApiError(res, e, `follow ${method}`, { userId: req.user.sub });
  }
}

export default withRbac(handler, 'follow');
