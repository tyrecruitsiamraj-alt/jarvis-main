/**
 * ═══ เหตุผลยกเลิกใบขอ — ฐานข้อมูล (migration 197 · เจ้าของ 24 พ.ย. 2569) ═══
 * ตัวตัดสินว่าใช้เหตุผลไหนอยู่ `src/lib/requestCancelReason.ts` ที่เดียว · ที่นี่แค่อ่าน/เขียนฐาน + ถาม ERP ว่าใบนี้ใส่ได้ไหม
 * ยังไม่ได้รัน migration = รายการว่าง · ไม่มีเหตุผลของทีม (หน้าเว็บยังเห็นเหตุผลจาก ERP ตามเดิม)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { STAFF_NAME_SQL } from './staffNameSql.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import {
  cancelTagKey,
  canTagCancelReason,
  effectiveCancelReason,
  OVERRIDABLE_ERP_CODES,
  type CancelReasonMaster,
  type CancelReasonTag,
} from '../../src/lib/requestCancelReason.js';

const REASONS = tableInAppSchema('request_cancel_reasons');
const TAGS = tableInAppSchema('request_cancel_reason_tags');
const USERS = tableInAppSchema('users');

const isMissingTable = (e: unknown) => /request_cancel_reason/i.test(String(e instanceof Error ? e.message : e)) && /does not exist|relation/i.test(String(e instanceof Error ? e.message : e));

type MasterRow = { id: number; label: string; got_person: boolean; erp_code: string | null; is_active: boolean; sort_order: number };
const toMaster = (r: MasterRow): CancelReasonMaster => ({
  id: Number(r.id),
  label: r.label,
  gotPerson: r.got_person,
  erpCode: r.erp_code,
  active: r.is_active,
  sortOrder: Number(r.sort_order),
});

export async function listCancelReasonMasters(): Promise<CancelReasonMaster[]> {
  try {
    const { rows } = await dbQuery<MasterRow>(`select id, label, got_person, erp_code, is_active, sort_order from ${REASONS} order by sort_order, id`);
    return rows.map(toMaster);
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

export async function listCancelReasonTags(): Promise<CancelReasonTag[]> {
  try {
    const { rows } = await dbQuery<{ request_no: string; reason_id: number; by_name: string | null; set_at: string }>(
      `select t.request_no, t.reason_id, ${STAFF_NAME_SQL('u', 't.set_by_name')} as by_name, t.set_at
         from ${TAGS} t left join ${USERS} u on u.id = t.set_by`,
    );
    return rows.map((r) => ({ requestNo: r.request_no, reasonId: Number(r.reason_id), byName: r.by_name, at: new Date(r.set_at).toISOString() }));
  } catch (e) {
    if (isMissingTable(e)) return [];
    throw e;
  }
}

const cleanLabel = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : '');

export async function createCancelReason(input: { label: unknown; gotPerson: unknown }, by: { id: string; name: string }): Promise<CancelReasonMaster> {
  const label = cleanLabel(input.label);
  if (!label) throw new Error('ต้องใส่ชื่อเหตุผล');
  try {
    const { rows } = await dbQuery<MasterRow>(
      `insert into ${REASONS} (label, got_person, sort_order, created_by, created_by_name, updated_by, updated_by_name)
       values ($1, $2, coalesce((select max(sort_order) from ${REASONS}), 0) + 10, $3::uuid, $4, $3::uuid, $4)
       returning id, label, got_person, erp_code, is_active, sort_order`,
      [label, input.gotPerson === true, by.id, by.name],
    );
    return toMaster(rows[0]);
  } catch (e) {
    if (/request_cancel_reasons_label_uq|duplicate key/i.test(String(e instanceof Error ? e.message : e))) throw new Error('มีเหตุผลชื่อนี้แล้ว');
    throw e;
  }
}

/** แก้ชื่อ (เฉพาะข้อที่ทีมเพิ่มเอง — ข้อของ ERP ใช้ชื่อตาม ERP) · ติ๊กได้คนแล้ว · เปิด/เลิกใช้ */
export async function updateCancelReason(
  id: number,
  patch: { label?: unknown; gotPerson?: unknown; active?: unknown },
  by: { id: string; name: string },
): Promise<{ before: CancelReasonMaster; after: CancelReasonMaster } | null> {
  const { rows: cur } = await dbQuery<MasterRow>(`select id, label, got_person, erp_code, is_active, sort_order from ${REASONS} where id = $1`, [id]);
  if (!cur[0]) return null;
  const before = toMaster(cur[0]);
  const label = patch.label === undefined ? before.label : cleanLabel(patch.label);
  if (!label) throw new Error('ต้องใส่ชื่อเหตุผล');
  if (before.erpCode && label !== before.label) throw new Error('เหตุผลที่มาจาก ERP แก้ชื่อไม่ได้');
  const gotPerson = typeof patch.gotPerson === 'boolean' ? patch.gotPerson : before.gotPerson;
  const active = typeof patch.active === 'boolean' ? patch.active : before.active;
  try {
    const { rows } = await dbQuery<MasterRow>(
      `update ${REASONS} set label = $2, got_person = $3, is_active = $4, updated_by = $5::uuid, updated_by_name = $6, updated_at = now()
        where id = $1 returning id, label, got_person, erp_code, is_active, sort_order`,
      [id, label, gotPerson, active, by.id, by.name],
    );
    return { before, after: toMaster(rows[0]) };
  } catch (e) {
    if (/request_cancel_reasons_label_uq|duplicate key/i.test(String(e instanceof Error ? e.message : e))) throw new Error('มีเหตุผลชื่อนี้แล้ว');
    throw e;
  }
}

/** ใบนี้ใน ERP: หยุด/ยกเลิกแล้วไหม + รหัสเหตุผล — ใช้ตัดสินว่าทีมใส่เหตุผลได้ไหม (ถาม ERP ตรง ไม่เชื่อค่าที่หน้าเว็บส่งมา) */
async function erpStopOf(requestNo: string): Promise<{ found: boolean; ended: boolean; code: string | null; name: string | null }> {
  const rows = await siamrajSqlQuery<{ ended: number; code: string | null; name: string | null }>(
    `SELECT TOP 1
            CASE WHEN A.status <> 'A' OR ISNULL(A.is_stop, 'N') = 'Y' OR ISNULL(RTRIM(A.stop_no), '') <> '' THEN 1 ELSE 0 END AS ended,
            RTRIM(A.stop_code) AS code,
            (SELECT TOP 1 RTRIM(z.stop_by_name) FROM st_ms_stop_by z WHERE z.stop_by_code = A.stop_code) AS name
       FROM st_request_head A WHERE RTRIM(A.request_no) = @requestNo`,
    { requestNo },
  );
  const r = rows[0];
  return r ? { found: true, ended: Number(r.ended) === 1, code: (r.code ?? '').trim() || null, name: (r.name ?? '').trim() || null } : { found: false, ended: false, code: null, name: null };
}

export type SetTagResult =
  | { ok: true; before: { reasonId: number | null; label: string | null }; after: { reasonId: number | null; label: string | null } }
  | { ok: false; status: number; message: string };

/** ใส่/เปลี่ยน/ล้าง (`reasonId = null`) เหตุผลบนใบ — ใส่ใหม่แทนของเดิม · คนเรียกจด audit จากผลที่คืน */
export async function setCancelReasonTag(requestNoRaw: string, reasonId: number | null, by: { id: string; name: string }): Promise<SetTagResult> {
  const requestNo = cancelTagKey(requestNoRaw);
  if (!/^[A-Z0-9-]{4,30}$/.test(requestNo)) return { ok: false, status: 400, message: 'เลขที่ใบขอไม่ถูกต้อง' };
  const erp = await erpStopOf(requestNo);
  if (!erp.found) return { ok: false, status: 404, message: 'ไม่พบใบขอนี้ใน ERP' };
  if (!erp.ended) return { ok: false, status: 409, message: 'ใบนี้ยังไม่ได้ยกเลิก' };
  if (!canTagCancelReason(erp.code)) return { ok: false, status: 409, message: `ใบนี้ ERP ใส่เหตุผลไว้แล้ว (${erp.name ?? erp.code})` };
  const masters = await listCancelReasonMasters();
  const labelOf = (id: number | null) => (id == null ? null : (masters.find((m) => m.id === id)?.label ?? null));
  const { rows: prev } = await dbQuery<{ reason_id: number }>(`select reason_id from ${TAGS} where request_no = $1`, [requestNo]);
  const before = { reasonId: prev[0] ? Number(prev[0].reason_id) : null, label: labelOf(prev[0] ? Number(prev[0].reason_id) : null) };
  if (reasonId == null) {
    await dbQuery(`delete from ${TAGS} where request_no = $1`, [requestNo]);
    return { ok: true, before, after: { reasonId: null, label: null } };
  }
  const m = masters.find((x) => x.id === reasonId);
  if (!m || !m.active) return { ok: false, status: 400, message: 'ไม่พบเหตุผลนี้ในรายการ หรือเลิกใช้แล้ว' };
  // เลือก "ยกเลิกโดย-สยามราช" ซ้ำ = ไม่ได้บอกอะไรเพิ่ม (ตัวเลือกบนจอก็ไม่มีข้อนี้ — `pickableCancelReasons`)
  if (m.erpCode && OVERRIDABLE_ERP_CODES.includes(m.erpCode.trim())) {
    return { ok: false, status: 400, message: 'เลือกเหตุผลที่บอกได้ว่าเพราะอะไร' };
  }
  await dbQuery(
    `insert into ${TAGS} (request_no, reason_id, set_by, set_by_name, set_at) values ($1, $2, $3::uuid, $4, now())
     on conflict (request_no) do update set reason_id = excluded.reason_id, set_by = excluded.set_by, set_by_name = excluded.set_by_name, set_at = now()`,
    [requestNo, reasonId, by.id, by.name],
  );
  return { ok: true, before, after: { reasonId, label: m.label } };
}

/**
 * เติมเหตุผลที่ทีมใส่ลงแถวสมุดใบขอ (หน้าหลัก · ภาพรวม · ผู้ช่วย AI อ่าน `stopReason` ชุดนี้)
 * อ่านตารางสด ๆ ทุกครั้ง (ตารางเล็ก) — สมุดจาก ERP แคช 10 นาที แต่ใส่เหตุผลแล้วต้องเห็นทันที
 * อ่านไม่ได้ = คืนแถวเดิม (เหตุผลจาก ERP) ไม่ทำให้หน้าล้ม
 */
export async function withCancelReasonTags<T extends { requestNo: string; stopCode?: string | null; stopReason?: string | null }>(rows: T[]): Promise<T[]> {
  let masters: CancelReasonMaster[];
  let tags: CancelReasonTag[];
  try {
    [masters, tags] = await Promise.all([listCancelReasonMasters(), listCancelReasonTags()]);
  } catch {
    return rows;
  }
  if (tags.length === 0) return rows;
  const byNo = new Map(tags.map((t) => [cancelTagKey(t.requestNo), t]));
  return rows.map((r) => {
    const tag = byNo.get(cancelTagKey(r.requestNo));
    if (!tag) return r;
    const eff = effectiveCancelReason({ code: r.stopCode, name: r.stopReason }, tag, masters);
    return eff.source === 'team' ? { ...r, stopReason: eff.label } : r;
  });
}
