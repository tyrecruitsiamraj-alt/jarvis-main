/**
 * `GET/POST/PATCH /api/aftercare` — "ดูแลหลังเริ่มงาน" (Phase 7.2-7.5 · migration 107)
 *
 * เจ้าของเคาะชื่อหน้าเอง: **"ดูแลหลังเริ่มงาน"** · คนเข้ามาสองทาง
 *   1. ปุ่ม [ย้ายไปดูแลหลังเริ่มงาน] จากกล่อง "โทรครบแล้ว" บนหน้า Follow (7.2)
 *   2. เพิ่มเองจากหน้าดูแลหลังเริ่มงาน (source `manual`)
 *
 * ⚠️ คีย์คือ **เบอร์ E.164** — คนเดียวมีหลายรหัส/หลายใบสมัคร แต่เบอร์มีเบอร์เดียว
 * (แพตเทิร์นเดียวกับล็อกโทร 068 และ `selection_progress` 105)
 * ⚠️ รอบโทร "ถามความเป็นอยู่" **ไม่ได้ทำระบบโทรใหม่** — ใช้โครง Follow เดิม (topic ใหม่)
 * เส้นนี้จึงไม่มีอะไรเกี่ยวกับคิว/การยิงสายเลย
 */
import {
  withRbac,
  sendError,
  handleApiError,
  type ApiRes,
  type AuthedReq,
} from '../_lib/http.js';
import { readJsonBody, getString } from '../_lib/body.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import { auditFromAuthed } from '../_lib/audit.js';
import { AFTERCARE_RESULTS, isAftercareResult } from '../../src/lib/aftercareContact.js';

const TABLE = tableInAppSchema('aftercare_people');
/** ผลการโทรดูแล (142 · 10 ต.ค. 2569) */
const CONTACTS = tableInAppSchema('aftercare_contacts');

type Row = {
  phone_e164: string;
  full_name: string;
  unit_name: string | null;
  site_code: string | null;
  start_date: string | Date | null;
  source: string;
  from_follow_id: string | null;
  note: string | null;
  moved_by_name: string | null;
  closed_at: string | Date | null;
  closed_reason: string | null;
  created_at: string | Date;
};

const iso = (v: string | Date | null): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

/** `YYYY-MM-DD` — วันเริ่มงานเป็นวันตามปฏิทิน ไม่ใช่จุดเวลา */
const ymd = (v: string | Date | null): string | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return String(v).slice(0, 10);
};

function toResponse(r: Row) {
  return {
    phone_e164: r.phone_e164,
    full_name: r.full_name,
    unit_name: r.unit_name,
    site_code: r.site_code,
    start_date: ymd(r.start_date),
    source: r.source,
    from_follow_id: r.from_follow_id,
    note: r.note,
    moved_by_name: r.moved_by_name,
    closed_at: iso(r.closed_at),
    closed_reason: r.closed_reason,
    created_at: iso(r.created_at),
  };
}

const COLS = `phone_e164, full_name, unit_name, site_code, start_date, source,
              from_follow_id, note, moved_by_name, closed_at, closed_reason, created_at`;

type ContactRow = {
  id: string;
  phone_e164: string;
  result: string;
  note: string | null;
  created_by_name: string | null;
  created_at: string | Date;
};
const toContact = (c: ContactRow) => ({
  id: String(c.id),
  phone_e164: c.phone_e164,
  result: c.result,
  note: c.note,
  created_by_name: c.created_by_name,
  created_at: iso(c.created_at),
});

/** ผลล่าสุด + จำนวนครั้งที่โทร ต่อเบอร์ — ยังไม่ migrate 142 = ไม่มี (หน้าเดิมยังเปิดได้) */
async function lastContactsOf(phones: readonly string[]): Promise<Map<string, { last: ReturnType<typeof toContact>; count: number }>> {
  const out = new Map<string, { last: ReturnType<typeof toContact>; count: number }>();
  if (phones.length === 0) return out;
  try {
    const { rows } = await dbQuery<ContactRow & { n: number }>(
      `select distinct on (phone_e164) id::text as id, phone_e164, result, note, created_by_name, created_at,
              count(*) over (partition by phone_e164)::int as n
         from ${CONTACTS}
        where phone_e164 = any($1::text[])
        order by phone_e164, created_at desc`,
      [[...phones]],
    );
    for (const r of rows) out.set(r.phone_e164, { last: toContact(r), count: Number(r.n) });
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
  }
  return out;
}

async function handleGet(req: AuthedReq, res: ApiRes) {
  // ประวัติการโทรของคนเดียว (กด "ดูประวัติ" บนแถว)
  const historyPhone = getString(req.query?.history);
  if (historyPhone) {
    const phone = toE164Thai(historyPhone);
    if (!phone) return sendError(res, 400, 'Bad request', 'เบอร์ไม่ถูกต้อง');
    try {
      const { rows } = await dbQuery<ContactRow>(
        `select id::text as id, phone_e164, result, note, created_by_name, created_at
           from ${CONTACTS} where phone_e164 = $1 order by created_at desc limit 100`,
        [phone],
      );
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ items: rows.map(toContact) });
    } catch (e) {
      if (isPgUndefinedTable(e)) return res.status(200).json({ items: [], migrated: false });
      throw e;
    }
  }
  const includeClosed = getString(req.query?.closed) === '1';
  try {
    const { rows } = await dbQuery<Row>(
      `select ${COLS} from ${TABLE}
        ${includeClosed ? '' : 'where closed_at is null'}
        order by created_at desc limit 500`,
    );
    const contacts = await lastContactsOf(rows.map((r) => r.phone_e164));
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json({
      items: rows.map((r) => ({
        ...toResponse(r),
        last_contact: contacts.get(r.phone_e164)?.last ?? null,
        contact_count: contacts.get(r.phone_e164)?.count ?? 0,
      })),
      total: rows.length,
    });
  } catch (e) {
    // ตารางยังไม่ migrate → หน้าใหม่ต้องเปิดได้และบอกตรง ๆ ว่ายังว่าง (ไม่ใช่จอพัง)
    if (isPgUndefinedTable(e)) return res.status(200).json({ items: [], total: 0, migrated: false });
    throw e;
  }
}

/** ย้ายคนเข้ามาดูแล — กดซ้ำได้ (upsert ต่อเบอร์ · ไม่สร้างซ้ำ) */
/** ลงผลการโทรดูแล (10 ต.ค. 2569) — ทุกครั้งเป็นแถวใหม่ (เก็บประวัติ) · ไม่ปิดการดูแลเอง */
async function handleContact(req: AuthedReq, res: ApiRes, raw: Record<string, unknown> | null) {
  const phone = toE164Thai(getString(raw?.phone) ?? '');
  if (!phone) return sendError(res, 400, 'Bad request', 'ต้องระบุเบอร์ที่ใช้กับระบบได้');
  const result = getString(raw?.result);
  if (!isAftercareResult(result)) {
    return sendError(res, 400, 'Bad request', `ผลต้องเป็น ${AFTERCARE_RESULTS.join(' / ')}`);
  }
  const note = (getString(raw?.note) ?? '').trim().slice(0, 2000) || null;
  const { rows: known } = await dbQuery<{ n: number }>(`select count(*)::int as n from ${TABLE} where phone_e164 = $1`, [phone]);
  if (!known[0]?.n) return sendError(res, 404, 'Not found', 'ไม่พบคนนี้ในรายการดูแล');
  try {
    const { rows } = await dbQuery<ContactRow>(
      `insert into ${CONTACTS} (phone_e164, result, note, created_by, created_by_name)
       values ($1, $2, $3, $4::uuid, $5)
       returning id::text as id, phone_e164, result, note, created_by_name, created_at`,
      [phone, result, note, req.user.sub, req.user.email ?? null],
    );
    void auditFromAuthed(req, {
      action: 'aftercare.contact',
      entityType: 'aftercare',
      entityId: phone,
      after: { result, has_note: note !== null },
    });
    return res.status(200).json({ item: toContact(rows[0]) });
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      return sendError(res, 503, 'Not ready', 'ระบบลงผลยังไม่พร้อม (ยังไม่ได้อัปเดตฐานข้อมูล) — ลองใหม่หลังอัปเดต');
    }
    throw e;
  }
}

async function handlePost(req: AuthedReq, res: ApiRes) {
  const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
  if (getString(raw?.action) === 'contact') return handleContact(req, res, raw);
  const phone = toE164Thai(getString(raw?.phone) ?? '');
  const fullName = (getString(raw?.full_name) ?? '').trim();
  if (!phone) {
    return sendError(res, 400, 'Bad request', 'เบอร์นี้ใช้กับระบบไม่ได้ (ต้องเป็นมือถือ 10 หลัก)');
  }
  if (!fullName) return sendError(res, 400, 'Bad request', 'ต้องระบุชื่อ');

  const source = getString(raw?.source) === 'manual' ? 'manual' : 'follow_done';
  const startDate = getString(raw?.start_date);
  const followId = getString(raw?.from_follow_id);

  const { rows } = await dbQuery<Row>(
    `insert into ${TABLE}
       (phone_e164, full_name, unit_name, site_code, start_date, source, from_follow_id, note,
        moved_by, moved_by_name)
     values ($1, $2, $3, $4, $5::date, $6, $7::uuid, $8, $9::uuid, $10)
     on conflict (phone_e164) do update set
       full_name = excluded.full_name,
       unit_name = coalesce(excluded.unit_name, ${TABLE}.unit_name),
       site_code = coalesce(excluded.site_code, ${TABLE}.site_code),
       start_date = coalesce(excluded.start_date, ${TABLE}.start_date),
       note = coalesce(excluded.note, ${TABLE}.note),
       -- กดย้ายซ้ำ = เปิดการดูแลใหม่ (คนกลับมาทำงานอีกรอบได้)
       closed_at = null,
       closed_reason = null,
       updated_at = now()
     returning ${COLS}`,
    [
      phone,
      fullName.slice(0, 200),
      (getString(raw?.unit_name) ?? '').trim().slice(0, 200) || null,
      (getString(raw?.site_code) ?? '').trim().slice(0, 64) || null,
      startDate && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : null,
      source,
      followId && /^[0-9a-f-]{36}$/i.test(followId) ? followId : null,
      (getString(raw?.note) ?? '').trim().slice(0, 2000) || null,
      req.user.sub,
      req.user.email ?? null,
    ],
  );

  void auditFromAuthed(req, {
    action: 'aftercare.move_in',
    entityType: 'aftercare',
    entityId: phone,
    after: { source, unit_name: rows[0]?.unit_name ?? null, start_date: ymd(rows[0]?.start_date ?? null) },
  });
  return res.status(200).json({ item: toResponse(rows[0]) });
}

/** แก้วันเริ่มงาน/หน่วยงาน/ปิดการดูแล */
async function handlePatch(req: AuthedReq, res: ApiRes) {
  const raw = (await readJsonBody(req)) as Record<string, unknown> | null;
  const phone = toE164Thai(getString(raw?.phone) ?? '');
  if (!phone) return sendError(res, 400, 'Bad request', 'ต้องระบุเบอร์ที่ใช้กับระบบได้');

  const hasStart = raw?.start_date !== undefined;
  const startDate = getString(raw?.start_date);
  const closing = raw?.close === true;
  const hasUnit = raw?.unit_name !== undefined || raw?.site_code !== undefined;
  if (!hasStart && !closing && !hasUnit) {
    return sendError(res, 400, 'Bad request', 'ไม่มีอะไรให้บันทึก');
  }
  if (hasStart && startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    return sendError(res, 400, 'Bad request', 'วันเริ่มงานต้องเป็น YYYY-MM-DD');
  }

  const { rows } = await dbQuery<Row>(
    `update ${TABLE} set
        start_date = case when $2::boolean then $3::date else start_date end,
        unit_name  = case when $4::boolean then $5 else unit_name end,
        site_code  = case when $4::boolean then $6 else site_code end,
        closed_at  = case when $7::boolean then now() else closed_at end,
        closed_reason = case when $7::boolean then $8 else closed_reason end,
        updated_at = now()
      where phone_e164 = $1
      returning ${COLS}`,
    [
      phone,
      hasStart,
      hasStart && startDate ? startDate : null,
      hasUnit,
      (getString(raw?.unit_name) ?? '').trim().slice(0, 200) || null,
      (getString(raw?.site_code) ?? '').trim().slice(0, 64) || null,
      closing,
      (getString(raw?.close_reason) ?? '').trim().slice(0, 200) || null,
    ],
  );
  if (rows.length === 0) return sendError(res, 404, 'Not found', 'ไม่พบคนนี้ในรายการดูแล');

  void auditFromAuthed(req, {
    action: closing ? 'aftercare.close' : 'aftercare.update',
    entityType: 'aftercare',
    entityId: phone,
    after: { start_date: ymd(rows[0].start_date), closed: closing },
  });
  return res.status(200).json({ item: toResponse(rows[0]) });
}

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  try {
    if (method === 'GET') return await handleGet(req, res);
    if (method === 'POST') return await handlePost(req, res);
    if (method === 'PATCH') return await handlePatch(req, res);
    res.setHeader?.('Allow', 'GET, POST, PATCH');
    return sendError(res, 405, 'Method not allowed');
  } catch (e) {
    return handleApiError(res, e, 'aftercare', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'follow');
