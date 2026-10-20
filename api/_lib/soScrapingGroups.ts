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

/* ═══ บัญชี Facebook + worker ของ So Scraping (ป๊อป Autopost · เจ้าของ 20 ต.ค. 2569) — อ่านอย่างเดียว ═══
 * 🔴 ตาราง users มีรหัสผ่าน/token/อีเมล — เลือกเฉพาะคอลัมน์ข้างล่างเท่านั้น
 */
export type SoAccount = {
  id: string;
  name: string;
  groupIds: string[];
  dailyCap: number | null;
  postedToday: number;
  pausedUntil: string | null;
  pauseReason: string | null;
  preferredWorker: string | null;
};
export type SoWorker = { name: string; lastSeen: string | null; online: boolean };

/** worker ที่เห็นภายในเท่านี้ = ออนไลน์ */
export const SO_WORKER_ONLINE_MS = 15 * 60_000;

export async function listSoAccounts(): Promise<SoAccount[]> {
  try {
    const { rows } = await dbQuery<{
      id: string;
      name: string | null;
      poster_name: string | null;
      group_ids: unknown;
      daily_cap: number | null;
      paused_until: Date | string | null;
      pause_reason: string | null;
      preferred_worker: string | null;
      posted_today: string | number | null;
    }>(
      `select u.id::text as id, u.name::text as name, u.poster_name::text as poster_name,
              case when jsonb_typeof(u.group_ids) = 'array' then u.group_ids else '[]'::jsonb end as group_ids,
              u.daily_cap, u.paused_until, u.pause_reason::text as pause_reason, u.preferred_worker::text as preferred_worker,
              (select count(*) from ${SCHEMA}.post_logs p
                where p.user_id = u.id
                  and p.created_at >= date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok') as posted_today
         from ${SCHEMA}.users u
        order by coalesce(u.poster_name, u.name)`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: (r.poster_name ?? r.name ?? '').trim() || r.id,
      groupIds: Array.isArray(r.group_ids) ? r.group_ids.filter((x): x is string => typeof x === 'string') : [],
      dailyCap: typeof r.daily_cap === 'number' ? r.daily_cap : null,
      postedToday: Number(r.posted_today) || 0,
      pausedUntil: r.paused_until ? new Date(r.paused_until).toISOString() : null,
      pauseReason: (r.pause_reason ?? '').trim() || null,
      preferredWorker: (r.preferred_worker ?? '').trim() || null,
    }));
  } catch (e) {
    logWarn('soScraping.accounts: อ่านบัญชีไม่ได้', { error: errorSummaryText(e) });
    return [];
  }
}

export async function listSoWorkers(now = Date.now()): Promise<SoWorker[]> {
  try {
    const { rows } = await dbQuery<{ name: string; last_seen: Date | string | null }>(
      `select name::text as name, last_seen from ${SCHEMA}.workers where coalesce(kind, 'autopost') = 'autopost' order by last_seen desc nulls last`,
    );
    return rows.map((r) => {
      const at = r.last_seen ? new Date(r.last_seen) : null;
      return { name: r.name, lastSeen: at ? at.toISOString() : null, online: Boolean(at && now - at.getTime() < SO_WORKER_ONLINE_MS) };
    });
  } catch (e) {
    logWarn('soScraping.workers: อ่าน worker ไม่ได้', { error: errorSummaryText(e) });
    return [];
  }
}
