/**
 * แอดไลน์ประจำ BU (13 พ.ย. 2569) — ตาราง `bu_line_ids` (migration 178) · ความหมาย/ตัวกรองค่าอยู่ `src/lib/buLineIds.ts`
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import type { BuLineIds } from '../../src/lib/buLineIds.js';

const TABLE = tableInAppSchema('bu_line_ids');

export async function getBuLineIds(): Promise<BuLineIds> {
  const { rows } = await dbQuery<{ bu: string; line_id: string }>(`select bu, line_id from ${TABLE} order by bu`);
  return Object.fromEntries(rows.map((r) => [r.bu, r.line_id]));
}

/** ตั้ง/ลบของ BU เดียว — null = ลบ */
export async function setBuLineId(bu: string, lineId: string | null, by: string | null): Promise<void> {
  if (lineId === null) {
    await dbQuery(`delete from ${TABLE} where bu = $1`, [bu]);
    return;
  }
  await dbQuery(
    `insert into ${TABLE} (bu, line_id, updated_by, updated_at) values ($1, $2, $3, now())
     on conflict (bu) do update set line_id = excluded.line_id, updated_by = excluded.updated_by, updated_at = now()`,
    [bu, lineId, by],
  );
}
