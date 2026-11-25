/**
 * ใบไหนสร้างจากรายชื่อ Scrap + เว็บอะไร (เจ้าของ 25 พ.ย. 2569) — ตัวส่ง AI ใช้เลือกบท "เห็นประวัติบนเว็บ …"
 * อ่านช่องทางบนใบตรง ๆ ทีเดียวต่อชุด (ทุกเส้นที่ส่ง AI ไม่ต้องเลือกคอลัมน์ช่องทางมาเอง) · ตัดสินด้วย `scrapWebOfChannel` ที่เดียว
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { scrapWebOfChannel } from '../../src/lib/scrapCandidates.js';

const APPS = tableInAppSchema('public_job_applications');

export async function scrapWebByApplicationId(ids: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { rows } = await dbQuery<{ id: string; channel_label: string | null }>(
    `select id::text as id, channel_label from ${APPS} where id::text = any($1::text[]) and channel_label like 'Scrap · %'`,
    [ids],
  );
  for (const r of rows) {
    const web = scrapWebOfChannel(r.channel_label);
    if (web) out.set(r.id, web);
  }
  return out;
}
