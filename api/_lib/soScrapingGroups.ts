/**
 * ═══ กลุ่ม Facebook ของระบบ So Scraping — อ่านอย่างเดียว (เจ้าของ 20 ต.ค. 2569) ═══
 * รายชื่อกลุ่มดูแลที่ So Scraping (เพิ่ม/ลบ/ตั้งชื่อที่นั่น) · Jarvis อ่านมาให้เลือกในป๊อปสั่งโพสต์
 * - เฉพาะกลุ่มที่มีบัญชี Facebook ผูกอยู่ (`users.group_ids` jsonb array มี id ของกลุ่ม)
 * - 🔴 ตาราง users มีรหัสผ่าน/token — อ่านแค่ `group_ids` ห้ามเลือกคอลัมน์อื่น · ห้ามเขียนตารางของ So Scraping
 * schema อ่านไม่ได้ / ยังไม่มี = รายการว่าง (ป๊อปบอก "ยังไม่มีกลุ่ม")
 */
import { dbQuery } from './postgres.js';
import { logWarn, errorSummaryText } from './logger.js';
import type { SoGroup } from '../../src/lib/soScraping.js';

const SCHEMA = 'so_autopost_apiscraper';

export function soLinkedGroupsSql(): string {
  return `
    select g.id::text as id, g.name::text as name, g.province::text as province,
           g.department::text as department, g.job_type::text as job_type
      from ${SCHEMA}.groups g
     where exists (
       select 1 from ${SCHEMA}.users u
        where jsonb_typeof(u.group_ids) = 'array' and u.group_ids ? g.id::text
     )
     order by g.name`;
}

export async function listLinkedSoGroups(): Promise<SoGroup[]> {
  try {
    const { rows } = await dbQuery<SoGroup>(soLinkedGroupsSql());
    return rows.map((r) => ({
      id: r.id,
      name: (r.name ?? '').trim() || r.id,
      province: (r.province ?? '').trim() || null,
      department: (r.department ?? '').trim() || null,
      job_type: (r.job_type ?? '').trim() || null,
    }));
  } catch (e) {
    logWarn('soScraping.groups: อ่านกลุ่มไม่ได้', { error: errorSummaryText(e) });
    return [];
  }
}

/** id ที่เลือกมาต้องเป็นกลุ่มที่มีบัญชีผูกอยู่จริง — คืนตัวที่ไม่รู้จัก */
export async function unknownSoGroupIds(ids: readonly string[]): Promise<string[]> {
  const known = new Set((await listLinkedSoGroups()).map((g) => g.id));
  return ids.filter((id) => !known.has(id));
}
