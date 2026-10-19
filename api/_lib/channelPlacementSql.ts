/**
 * ═══ ข้อมูลของ "ช่องทางที่ได้คนลงงาน" (เจ้าของ 19 ต.ค. 2569 — หน้าภาพรวมงานสรรหา) ═══
 * ตัวคิดอยู่ที่ `src/lib/channelPlacement.ts` · ที่นี่แค่อ่าน (อ่านอย่างเดียวทั้งสามแหล่ง · ส่งออกแค่ยอด ไม่มีชื่อ/เบอร์)
 * - iRecruit `recruit_register` (ช่องทาง/กลุ่มย่อยของ RM · เบอร์) — ย้อน 365 วันก่อนต้นช่วง
 * - ใบสมัครผ่านลิงก์ของระบบเรา (ไม่นับใบที่ดึงมาจาก iRecruit — ซ้ำกับแหล่งแรก)
 * - ERP ใบแจ้งเข้าที่ไม่ถูกยกเลิก (`activeInformWhereSql`) ในช่วง · เบอร์จาก `hr_recruitment.mobile`
 * แคช 10 นาทีต่อช่วง — iRecruit ปีหนึ่ง ~4 หมื่นแถว ไม่ควรอ่านทุกครั้งที่เปิดหน้า
 */
import { irecruitSqlQuery } from './irecruitSqlServer.js';
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { activeInformWhereSql } from './siamrajStaffingOpen.js';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  buildChannelPlacement,
  type ChannelInform,
  type ChannelPlacement,
  type ChannelRegistration,
} from '../../src/lib/channelPlacement.js';

const APPS = tableInAppSchema('public_job_applications');
const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { at: number; value: ChannelPlacement }>();

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v ?? ''));
const shiftYmd = (ymd: string, days: number) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export async function loadChannelPlacement(window: { from: string; to: string }): Promise<ChannelPlacement> {
  const key = `${window.from}|${window.to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const regFrom = shiftYmd(window.from, -365);
  const regTo = shiftYmd(window.to, 1);
  const [irec, apps, informs] = await Promise.all([
    irecruitSqlQuery<{ k: string; at: Date | string; ch: string | null; sub: string | null }>(
      `SELECT RIGHT(REPLACE(REPLACE(RTRIM(r.phone_number), '-', ''), ' ', ''), 9) AS k, r.created_at AS at, c.name AS ch, s.name AS sub
         FROM recruit_register r
         LEFT JOIN recruit_master_sub_channel s ON s.id = r.channel_id
         LEFT JOIN recruit_master_channel c ON c.id = s.channel_id
        WHERE r.deleted_at IS NULL AND r.created_at >= @from AND r.created_at < @to`,
      { from: regFrom, to: regTo },
    ),
    dbQuery<{ k: string; at: Date | string; ch: string | null; sub: string | null }>(
      `select right(regexp_replace(coalesce(phone_e164, phone, ''), '\\D', '', 'g'), 9) as k, created_at as at,
              coalesce(nullif(btrim(referral_source), ''), nullif(btrim(channel_label), '')) as ch,
              coalesce(nullif(btrim(channel_label), ''), 'ลิงก์ระบบเรา') as sub
         from ${APPS}
        where link_id is not null and created_by_name is null
          and coalesce(channel_label, '') not ilike 'irecruit%'
          and created_at >= $1::date and created_at < $2::date`,
      [regFrom, regTo],
    ),
    siamrajSqlQuery<{ k: string; at: Date | string }>(
      `SELECT RIGHT(REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', ''), 9) AS k, MIN(IH.inform_date) AS at
         FROM hr_recruitment r
         INNER JOIN st_inform_head IH ON IH.inform_no = r.inform_no
        WHERE r.mobile IS NOT NULL AND ${activeInformWhereSql('IH')}
          AND IH.inform_date >= @from AND IH.inform_date < @to
        GROUP BY RIGHT(REPLACE(REPLACE(RTRIM(r.mobile), '-', ''), ' ', ''), 9)`,
      { from: window.from, to: shiftYmd(window.to, 1) },
    ),
  ]);
  const regs: ChannelRegistration[] = [
    ...irec.map((r) => ({ phone9: String(r.k ?? '').trim(), at: iso(r.at), channel: r.ch, sub: r.sub })),
    ...apps.rows.map((r) => ({ phone9: String(r.k ?? '').trim(), at: iso(r.at), channel: r.ch, sub: r.sub })),
  ];
  const inf: ChannelInform[] = informs.map((r) => ({ phone9: String(r.k ?? '').trim(), at: iso(r.at) }));
  const value = buildChannelPlacement(regs, inf, window);
  cache.set(key, { at: Date.now(), value });
  return value;
}
