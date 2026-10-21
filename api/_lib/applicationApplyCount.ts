/**
 * ═══ เคยสมัครมากี่ครั้ง — นับใบสมัครทุกใบของเบอร์เดียวกัน (เจ้าของ 21 ต.ค. 2569) ═══
 * > *"ก็เพิ่ม บอกเลยคนนี้เคยสมัครมากี่ครั้งดีกว่า"* (เคส: เพิ่มชื่อซ้ำหลัง 14 วัน — ระบบรับตามกติกาแต่ไม่บอก)
 * คีย์ = `phone_e164` (คนเดียวหลายใบ เบอร์เดียว — กติกาเดียวกับประวัติการสมัคร/ล็อกโทร) · นับใบใน Jarvis เท่านั้น
 * อ่านไม่ได้ = ไม่ติดป้าย (ห้ามทำให้ลิสต์ล้ม)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logWarn } from './logger.js';

const APPS = tableInAppSchema('public_job_applications');

/** id ใบสมัคร → จำนวนใบทั้งหมดของเบอร์เดียวกัน (รวมใบนี้) · ใบที่ไม่มีเบอร์ E.164 ไม่อยู่ในผล */
export async function loadApplyCounts(ids: ReadonlyArray<string>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const list = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
  if (list.length === 0) return out;
  try {
    const { rows } = await dbQuery<{ id: string; n: number }>(
      `with mine as (select id, phone_e164 from ${APPS} where id = any($1::uuid[]) and phone_e164 is not null),
            counts as (select b.phone_e164, count(*)::int as n from ${APPS} b
                        where b.phone_e164 in (select phone_e164 from mine) group by b.phone_e164)
       select m.id::text as id, c.n from mine m join counts c on c.phone_e164 = m.phone_e164`,
      [list],
    );
    for (const r of rows) out.set(r.id, Number(r.n) || 0);
  } catch (e) {
    logWarn('applyCount: นับใบสมัครของเบอร์ไม่สำเร็จ', { reason: e instanceof Error ? e.message : String(e) });
  }
  return out;
}
