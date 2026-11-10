/**
 * ═══ กลุ่ม Facebook ของระบบ So Scraping — อ่านอย่างเดียว (เจ้าของ 20 ต.ค. 2569) ═══
 * รายชื่อกลุ่มดูแลที่ So Scraping (เพิ่ม/ลบ/ตั้งชื่อ/ติดป้ายธุรกิจที่นั่น) · Jarvis อ่านมาให้เลือกในป๊อปสั่งโพสต์
 * - อ่าน **ทุกกลุ่ม** (2 พ.ย. 2569) — เดิมกรองเฉพาะกลุ่มที่มีบัญชีผูก (`users.group_ids`) · เลิกแล้วเพราะ
 *   ใบสั่งส่ง account_id + group_ids ไปเอง และ So Scraping โพสต์ได้ทุกกลุ่มด้วยบัญชีที่ Jarvis เลือก
 *   (worker กดเข้าร่วมกลุ่มให้ · `resolvePostAccount` ฝั่ง So Scraping) · options API ก็ส่งทุกกลุ่มให้ทุกบัญชีอยู่แล้ว
 *   ตอนนั้น 33/34 บัญชียังไม่ผูกกลุ่ม ถ้ายังกรองไว้ กลุ่มจะหายทันทีที่บัญชีเดียวที่ผูกถูกแก้
 * - `department` = ธุรกิจของกลุ่ม (LBD · LBA · LM · DS · SN) ป๊อปใช้จัดหมวด/ติ๊กให้
 * - 🔴 ห้ามแตะตาราง users (มีรหัสผ่าน/token) ในคำสั่งนี้ · ห้ามเขียนตารางของ So Scraping
 * schema อ่านไม่ได้ / ยังไม่มี = รายการว่าง (ป๊อปบอก "ยังไม่มีกลุ่ม")
 */
import { dbQuery } from './postgres.js';
import { logWarn, errorSummaryText } from './logger.js';
import { SO_GROUP_SECTOR_BEFORE_TAG, soGroupSectorOf, type SoGroup } from '../../src/lib/soScraping.js';

export const SO_SCHEMA = 'so_autopost_apiscraper';
const SCHEMA = SO_SCHEMA;

/** ช่องที่ So Scraping ยังไม่ได้เพิ่ม (42703) */
const isUndefinedColumn = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '42703';

/** `withSector` = อ่านช่อง ราชการ/เอกชน (4 พ.ย. 2569 · So Scraping ยังไม่ได้เพิ่มช่องนี้ = อ่านแบบไม่มีช่อง) */
export function soGroupsSql(withSector = true): string {
  return `
    select g.id::text as id, g.fb_group_id::text as fb_group_id, g.name::text as name, g.province::text as province,
           g.department::text as department, g.job_type::text as job_type${withSector ? ', g.sector::text as sector' : ''}
      from ${SCHEMA}.groups g
     order by g.name`;
}

type SoGroupRow = Omit<SoGroup, 'sector'> & { fb_group_id: string | null; sector?: string | null };

export async function listSoGroups(): Promise<SoGroup[]> {
  try {
    let rows: SoGroupRow[];
    let tagged = true;
    try {
      ({ rows } = await dbQuery<SoGroupRow>(soGroupsSql(true)));
    } catch (e) {
      if (!isUndefinedColumn(e)) throw e;
      tagged = false;
      ({ rows } = await dbQuery<SoGroupRow>(soGroupsSql(false)));
    }
    return rows.map((r) => ({
      id: r.id,
      fbGroupId: (r.fb_group_id ?? '').trim() || null,
      // ยังไม่มีช่อง = กลุ่มที่มีอยู่ทั้งหมดเป็นเอกชน (เจ้าของ 4 พ.ย. 2569) · มีช่องแต่ว่าง = ยังไม่ระบุ
      sector: tagged ? soGroupSectorOf(r.sector) : SO_GROUP_SECTOR_BEFORE_TAG,
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

/** ธุรกิจของบัญชี Facebook — อ่านแค่ id + department (🔴 ห้ามเลือกคอลัมน์อื่นของ users) · ยังไม่มีคอลัมน์/อ่านไม่ได้ = รายการว่าง */
export async function listSoAccountDepartments(): Promise<Array<{ id: string; department: string | null }>> {
  try {
    const { rows } = await dbQuery<{ id: string; department: string | null }>(`select u.id::text as id, u.department::text as department from ${SCHEMA}.users u`);
    return rows.map((r) => ({ id: r.id, department: (r.department ?? '').trim() || null }));
  } catch (e) {
    logWarn('soScraping.accountDepartments: อ่านธุรกิจของบัญชีไม่ได้', { error: errorSummaryText(e) });
    return [];
  }
}

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
