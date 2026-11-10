/**
 * ═══ คลิกลิงก์สมัครรายวัน → กลุ่มไหนคนเข้ามาดูงานเยอะ (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 * Choice "ตอนเลือกกลุ่ม Autopost + ตารางในภาพรวม"
 *
 * - นับ = เปิดลิงก์สมัคร 1 ครั้ง (ที่เดียวกับ `hit_count` · เจ้าหน้าที่เปิดดูไม่นับ) ⇒ ยอดรายวันต่อลิงก์ (175)
 * - เริ่มนับวันที่ขึ้นเว็บ (`CLICKS_SINCE`) — ก่อนหน้านี้ไม่มีรายวัน ห้ามเอายอดสะสมมาเดาว่าเป็นของช่วงไหน
 * - ตารางยังไม่มี (ยังไม่รัน 175) = นับไม่ได้ ⇒ คืน null ให้จอขึ้น "—" ไม่ใช่ 0
 */
import { dbQuery, isPgUndefinedTable } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { siteBuSql, trendBuSql } from './siteBuSql.js';
import { buMatchSql, type BuSet } from './homeBuSql.js';

const HITS = tableInAppSchema('recruit_posting_link_hits');
const LINKS = tableInAppSchema('recruit_posting_links');
const POSTINGS = tableInAppSchema('recruit_postings');
const MAP = tableInAppSchema('job_site_map');
const APPS = tableInAppSchema('public_job_applications');

/** วันแรกที่มีคลิกรายวัน (ไทย) — ช่วงที่เริ่มก่อนวันนี้ต้องบอกว่าคลิกนับเฉพาะตั้งแต่วันนี้ */
export const CLICKS_SINCE = '2026-11-10';

/** +1 คลิกของวันนี้ (วันไทย) — พลาดไม่เป็นไร ไม่ให้ล้มการเปิดหน้า */
export async function recordDailyLinkHit(linkId: string): Promise<void> {
  try {
    await dbQuery(
      `insert into ${HITS} (link_id, day, hits) values ($1::uuid, (now() at time zone 'Asia/Bangkok')::date, 1)
       on conflict (link_id, day) do update set hits = ${HITS}.hits + 1, updated_at = now()`,
      [linkId],
    );
  } catch {
    /* ยังไม่มีตาราง/ฐานสะดุด — ยอดสะสมเดิมยังนับอยู่ */
  }
}

/** BU ของลิงก์ = BU ของใบขอที่ประกาศ (ไซต์) ไม่มีค่อยใช้แผนกของประกาศลอย */
const linkBuSql = `${trendBuSql(`coalesce(${siteBuSql('bm.site_code')}, nullif(btrim(p.department_code), ''))`)}`;

export type LinkClickRow = { label: string; fbGroupId: string | null; clicks: number };

/**
 * คลิกต่อลิงก์ในช่วง (วันไทย from–to) — รวมตามป้ายลิงก์ (ป้ายเดียวกัน = ช่องทาง/กลุ่มเดียวกัน ตัวแยกเดียวกับตาราง "รายชื่อมาจากไหน")
 * `buSet` = ชุด BU ในสิทธิ์ (null = ไม่กรอง) · null = ยังไม่มีตาราง
 */
export async function loadLinkClicks(opts: { from: string; to: string; buSet: BuSet }): Promise<LinkClickRow[] | null> {
  try {
    const { rows } = await dbQuery<{ label: string; fb_group_id: string | null; clicks: string }>(
      `select btrim(l.channel_label) as label, max(lower(nullif(btrim(l.fb_group_id), ''))) as fb_group_id, sum(h.hits)::text as clicks
         from ${HITS} h
         join ${LINKS} l on l.id = h.link_id
         left join ${POSTINGS} p on p.id = l.posting_id
         left join ${MAP} bm on bm.job_id = p.job_id
        where h.day between $1::date and $2::date
          and nullif(btrim(l.channel_label), '') is not null
          and ${buMatchSql(linkBuSql, '$3')}
        group by btrim(l.channel_label)`,
      [opts.from, opts.to, opts.buSet],
    );
    return rows.map((r) => ({ label: r.label, fbGroupId: r.fb_group_id, clicks: Number(r.clicks) || 0 }));
  } catch (e) {
    if (isPgUndefinedTable(e)) return null;
    throw e;
  }
}

export type FbGroupStat = { clicks: number; apps: number };

/**
 * กลุ่ม Facebook 30 วันล่าสุด — ป๊อปเลือกกลุ่ม Autopost/Gen link (คีย์ = `soGroupLinkKey` = fb_group_id ตัวเล็ก)
 * คลิก = เปิดลิงก์ของกลุ่มนั้น · กรอก = ใบสมัครที่มาจากลิงก์ของกลุ่มนั้น · ทุกใบขอ (เลือกกลุ่มดูภาพรวมของกลุ่ม ไม่ใช่ของใบเดียว)
 */
export async function loadFbGroupStats30d(): Promise<Record<string, FbGroupStat> | null> {
  const out: Record<string, FbGroupStat> = {};
  try {
    const clicks = await dbQuery<{ k: string; n: string }>(
      `select lower(btrim(l.fb_group_id)) as k, sum(h.hits)::text as n
         from ${HITS} h join ${LINKS} l on l.id = h.link_id
        where nullif(btrim(l.fb_group_id), '') is not null
          and h.day >= (now() at time zone 'Asia/Bangkok')::date - 29
        group by 1`,
    );
    for (const r of clicks.rows) out[r.k] = { clicks: Number(r.n) || 0, apps: 0 };
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
    return null;
  }
  const apps = await dbQuery<{ k: string; n: string }>(
    `select lower(btrim(l.fb_group_id)) as k, count(*)::text as n
       from ${APPS} a join ${LINKS} l on l.id = a.link_id
      where nullif(btrim(l.fb_group_id), '') is not null
        and a.created_at >= now() - interval '30 days'
      group by 1`,
  );
  for (const r of apps.rows) out[r.k] = { clicks: out[r.k]?.clicks ?? 0, apps: Number(r.n) || 0 };
  return out;
}
