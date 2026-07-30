/**
 * Follow — รายชื่อคนที่ต้องติดตาม (คนกรอกเอง) → ส่งเข้าเส้น reminder ให้ Lumos โทร
 *
 * GET    /api/follow            → รายการ + สถานะการโทรจาก Lumos
 * POST   /api/follow            → เพิ่มรายชื่อ (enqueue ให้ Lumos ทันที)
 * DELETE /api/follow?id=<uuid>  → ยกเลิก (soft cancel + ยกเลิกในคิวถ้ายังไม่ถูกดึง)
 */
import { dbQuery } from '../_lib/postgres.js';
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
import { toE164Thai } from '../_lib/lumosDispatch.js';

const followTable = tableInAppSchema('follow_entries');
const queueTable = tableInAppSchema('lumos_dispatch_queue');

type FollowRow = {
  id: string;
  recipient_name: string;
  recipient_phone: string;
  topic: string;
  note: string | null;
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
            q.status                     as call_status,
            q.result->>'outcome'         as call_outcome,
            q.result->>'summary'         as call_summary,
            q.updated_at                 as called_at
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
  when: Date;
};

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
  const scheduledAt = getString(body.scheduled_at) ?? '';

  if (!name) return fail('กรุณากรอกชื่อผู้ที่ต้องติดตาม');
  if (!topic) return fail('กรุณากรอกเรื่องที่จะให้โทรติดตาม');

  const phone = toE164Thai(phoneRaw);
  if (!phone) {
    return fail('เบอร์โทรไม่ถูกต้อง — ใช้เบอร์มือถือ 10 หลัก เช่น 0812345678');
  }

  const when = scheduledAt ? new Date(scheduledAt) : now;
  if (Number.isNaN(when.getTime())) {
    return fail('วันเวลาที่ให้โทรไม่ถูกต้อง');
  }

  return { error: null, value: { name, phone, topic, note, when } };
}

async function createFollow(req: AuthedReq, res: ApiRes) {
  const parsed = parseFollowInput(await readJsonBody(req));
  if (parsed.error || !parsed.value) {
    return sendError(res, 400, 'Bad request', parsed.error || 'ข้อมูลไม่ถูกต้อง');
  }
  const { name, phone, topic, note, when } = parsed.value;

  const { rows } = await dbQuery<FollowRow>(
    `insert into ${followTable}
       (recipient_name, recipient_phone, topic, note, scheduled_at, created_by, created_by_name)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [name, phone, topic, note, when.toISOString(), req.user.sub, req.user.email],
  );
  const created = rows[0];
  if (!created) return sendError(res, 500, 'Failed to create follow entry');

  await enqueueFollowReminder({
    id: created.id,
    recipient_name: name,
    recipient_phone: phone,
    topic,
    note,
    scheduled_at: when,
  });

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
