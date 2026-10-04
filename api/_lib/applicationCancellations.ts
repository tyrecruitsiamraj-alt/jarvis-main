/**
 * ═══ ยกเลิกข้อมูลผู้สมัคร = ซ่อนจากรายชื่อหลัก กู้คืนได้ (migration 135 · 4 ต.ค. 2569) ═══
 *
 * มีแถวใน `application_cancellations` = ยกเลิกอยู่ · กู้คืน = ลบแถว
 * ยกเลิกแล้ว: ไม่โชว์ในรายชื่อทุกแท็บ (ดูได้ที่ "แสดงรายการ: ที่ยกเลิก") · ปลดการเก็บของเจ้าหน้าที่
 * **โดยไม่ตั้ง `unclaimed_at`** (ตั้ง = เข้ากองเลือกวิธีโทร แล้ว worker ส่ง AI ใน 1 วัน) · worker ส่ง AI ข้ามใบที่ยกเลิก
 * ⚠️ ตารางยังไม่ migrate (42P01) = ไม่มีใบไหนยกเลิก (อ่าน) · กดยกเลิกได้ 503 บอกตรง ๆ (เขียน)
 */
import { dbQuery, dbTransaction } from './postgres.js';
import { tableInAppSchema } from './schema.js';

export const CANCELLATIONS = tableInAppSchema('application_cancellations');
const APPS = tableInAppSchema('public_job_applications');

export type ApplicationCancellation = { at: string; byName: string | null; reason: string | null };

export function isUndefinedTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01';
}

/** ใบที่ยกเลิกอยู่ในชุดนี้ — ตารางยังไม่มี = Map ว่าง */
export async function loadCancellations(ids: readonly string[]): Promise<Map<string, ApplicationCancellation>> {
  const out = new Map<string, ApplicationCancellation>();
  if (ids.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ application_id: string; cancelled_at: string; cancelled_by_name: string | null; reason: string | null }>(
      `select application_id::text, cancelled_at, cancelled_by_name, reason from ${CANCELLATIONS}
        where application_id = any($1::uuid[])`,
      [ids],
    );
    for (const r of rows) {
      out.set(r.application_id, { at: new Date(r.cancelled_at).toISOString(), byName: r.cancelled_by_name, reason: r.reason });
    }
  } catch (e) {
    if (!isUndefinedTable(e)) throw e;
  }
  return out;
}

/** ยกเลิก — ปลดการเก็บ (ไม่เข้ากอง AI) ในธุรกรรมเดียวกับการบันทึก */
export async function cancelApplication(input: {
  id: string;
  byUserId: string | null;
  byName: string | null;
  reason: string | null;
}): Promise<void> {
  await dbTransaction(async (client) => {
    await client.query(
      `insert into ${CANCELLATIONS} (application_id, cancelled_by, cancelled_by_name, reason)
       values ($1, $2, $3, $4)
       on conflict (application_id) do update
         set cancelled_at = now(), cancelled_by = excluded.cancelled_by,
             cancelled_by_name = excluded.cancelled_by_name, reason = excluded.reason`,
      [input.id, input.byUserId, input.byName, input.reason],
    );
    await client.query('savepoint cancel_unclaim');
    try {
      await client.query(
        `update ${APPS} set claimed_by = null, claimed_by_name = null, claimed_at = null, updated_at = now()
          where id = $1 and claimed_by is not null`,
        [input.id],
      );
      await client.query('release savepoint cancel_unclaim');
    } catch (e) {
      // ยังไม่รัน 079 (ไม่มีคอลัมน์เก็บ) = ไม่มีอะไรให้ปลด
      await client.query('rollback to savepoint cancel_unclaim');
      if (!(typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42703')) throw e;
    }
  });
}

/** กู้คืน — กลับเข้ารายชื่อตามเดิม (สถานะ/ผลโทรเดิมยังอยู่ครบ) */
export async function restoreApplication(id: string): Promise<boolean> {
  const { rows } = await dbQuery<{ application_id: string }>(
    `delete from ${CANCELLATIONS} where application_id = $1 returning application_id`,
    [id],
  );
  return rows.length > 0;
}
