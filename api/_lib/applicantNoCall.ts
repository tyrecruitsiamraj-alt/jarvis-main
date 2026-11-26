/**
 * ═══ ปุ่ม "ไม่โทร" + เหตุผล (เจ้าของ 26 พ.ย. 2569 · migration 200) ═══
 * ตั้ง = ใบย้ายไปกล่องของเหตุผล (`src/lib/applicantNoCall.ts` ตัดสินกล่อง) · คิว AI ที่ยังค้างของใบนั้นถูกยกเลิก (ที่ Lumos ด้วย)
 * ล้าง = กลับกล่องเดิม · รายการเหตุผลแก้จากหน้าจอ (Supervisor ขึ้นไป) · ลบไม่ได้ เลิกใช้ได้
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logError } from './logger.js';
import { loadStaffDisplay } from './staffDisplay.js';
import { cancelLumosQueueItem } from './lumosDispatch.js';
import { NO_CALL_BOXES, type NoCallBox, type NoCallReason } from '../../src/lib/applicantNoCall.js';

const REASONS = tableInAppSchema('applicant_no_call_reasons');
const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');

type Actor = { id: string; name: string | null };
type Row = { id: number; label: string; box: string; is_active: boolean; sort_order: number };
const toReason = (r: Row): NoCallReason => ({
  id: r.id,
  label: r.label,
  box: (NO_CALL_BOXES as readonly string[]).includes(r.box) ? (r.box as NoCallBox) : 'own',
  active: r.is_active,
  sort: r.sort_order,
});

export async function listNoCallReasons(): Promise<NoCallReason[]> {
  const { rows } = await dbQuery<Row>(`select id, label, box, is_active, sort_order from ${REASONS} order by sort_order, id`);
  return rows.map(toReason);
}

const cleanLabel = (v: unknown): string => {
  const s = typeof v === 'string' ? v.trim().slice(0, 80) : '';
  if (!s) throw new Error('ต้องใส่ชื่อเหตุผล');
  return s;
};
const cleanBox = (v: unknown): NoCallBox => ((NO_CALL_BOXES as readonly string[]).includes(String(v)) ? (v as NoCallBox) : 'own');

export async function createNoCallReason(input: { label: unknown; box: unknown }, by: Actor): Promise<NoCallReason> {
  const label = cleanLabel(input.label);
  try {
    const { rows } = await dbQuery<Row>(
      `insert into ${REASONS} (label, box, sort_order, created_by, created_by_name, updated_by, updated_by_name)
       values ($1, $2, coalesce((select max(sort_order) from ${REASONS}), 0) + 10, $3, $4, $3, $4)
       returning id, label, box, is_active, sort_order`,
      [label, cleanBox(input.box), by.id, by.name],
    );
    return toReason(rows[0]);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new Error('มีเหตุผลชื่อนี้แล้ว');
    throw e;
  }
}

export async function updateNoCallReason(
  id: number,
  input: { label?: unknown; active?: unknown },
  by: Actor,
): Promise<{ before: NoCallReason; after: NoCallReason } | null> {
  const { rows: cur } = await dbQuery<Row>(`select id, label, box, is_active, sort_order from ${REASONS} where id = $1`, [id]);
  if (!cur[0]) return null;
  const label = input.label === undefined ? cur[0].label : cleanLabel(input.label);
  const active = typeof input.active === 'boolean' ? input.active : cur[0].is_active;
  try {
    const { rows } = await dbQuery<Row>(
      `update ${REASONS} set label = $2, is_active = $3, updated_by = $4, updated_by_name = $5, updated_at = now()
        where id = $1 returning id, label, box, is_active, sort_order`,
      [id, label, active, by.id, by.name],
    );
    return { before: toReason(cur[0]), after: toReason(rows[0]) };
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new Error('มีเหตุผลชื่อนี้แล้ว');
    throw e;
  }
}

/**
 * ตั้ง/ล้าง "ไม่โทร" ของใบที่ผู้เรียกผ่านด่านสิทธิ์แล้ว · reasonId null = ล้าง
 * ตั้งแล้ว: คิว AI ที่ยังค้าง (pending) ของใบนั้นยกเลิกทั้งในระบบและที่ Lumos — ห้ามมีสายตามไปหลังกดไม่โทร
 */
export async function setNoCall(ids: readonly string[], reasonId: number | null, by: Actor): Promise<{ done: number; cancelledCalls: number }> {
  if (ids.length === 0) return { done: 0, cancelledCalls: 0 };
  if (reasonId !== null) {
    const { rows } = await dbQuery<{ id: number }>(`select id from ${REASONS} where id = $1 and is_active`, [reasonId]);
    if (!rows[0]) throw new Error('ไม่พบเหตุผลนี้ หรือเลิกใช้แล้ว');
  }
  const { rows } = await dbQuery<{ id: string }>(
    reasonId === null
      ? `update ${APPS} set no_call_reason_id = null, no_call_at = null, no_call_by_name = null, updated_at = now()
          where id = any($1::uuid[]) and no_call_reason_id is not null returning id::text as id`
      : `update ${APPS} set no_call_reason_id = $2, no_call_at = now(), no_call_by_name = $3, updated_at = now()
          where id = any($1::uuid[]) returning id::text as id`,
    reasonId === null ? [ids] : [ids, reasonId, by.name],
  );
  let cancelledCalls = 0;
  if (reasonId !== null && rows.length > 0) {
    const { rows: open } = await dbQuery<{ job_ref: string; channel: 'interview' | 'reminder'; person_ref: string }>(
      `select job_ref, channel, person_ref from ${QUEUE} where person_ref = any($1::text[]) and status = 'pending'`,
      [rows.map((r) => `app-${r.id}`)],
    );
    for (const q of open) {
      try {
        if (await cancelLumosQueueItem(q.job_ref, q.channel, q.person_ref)) cancelledCalls++;
      } catch (e) {
        logError('applicant-no-call.cancel_queue', e, { personRef: q.person_ref });
      }
    }
  }
  return { done: rows.length, cancelledCalls };
}

/** ช่องไม่โทรของใบที่จะส่งให้จอ · ยังไม่รัน 200 = ไม่มีช่อง */
export type NoCallOnApplication = { reasonId: number; label: string | null; box: NoCallBox; at: string | null; by: string | null };
export async function loadNoCallByApplication(ids: readonly string[]): Promise<Map<string, NoCallOnApplication>> {
  const out = new Map<string, NoCallOnApplication>();
  if (ids.length === 0) return out;
  const { rows } = await dbQuery<{ id: string; no_call_reason_id: number; no_call_at: Date | string | null; no_call_by_name: string | null; label: string | null; box: string | null }>(
    `select a.id::text as id, a.no_call_reason_id, a.no_call_at, a.no_call_by_name, r.label, r.box
       from ${APPS} a left join ${REASONS} r on r.id = a.no_call_reason_id
      where a.id = any($1::uuid[]) and a.no_call_reason_id is not null`,
    [ids],
  );
  const nameOf = rows.length > 0 ? await loadStaffDisplay() : () => null;
  for (const r of rows) {
    out.set(r.id, {
      reasonId: r.no_call_reason_id,
      label: r.label,
      box: cleanBox(r.box),
      at: r.no_call_at ? new Date(r.no_call_at).toISOString() : null,
      // เก็บอีเมลคนกด · ส่งให้จอเป็นชื่อเล่น (`loadStaffDisplay`)
      by: r.no_call_by_name ? (nameOf(r.no_call_by_name.trim().toLowerCase()) ?? r.no_call_by_name) : null,
    });
  }
  return out;
}
