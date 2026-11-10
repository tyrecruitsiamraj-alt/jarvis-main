/**
 * ═══ คลิกลิงก์สมัครรายวัน → กลุ่มไหนคนเข้ามาดูงานเยอะ (เจ้าของ 10 พ.ย. 2569) ═══
 * > *"Tracking link หน่อยว่าคนคลิกเข้ามาเท่าไหร่ จะได้รู้ด้วยกลุ่มไหนคนเข้ามาดูงานเราเยอะ ต่อไปเวลาเลือกกลุ่ม Auto post ได้เลือกกลุ่มถูก"*
 * Choice "ตอนเลือกกลุ่ม Autopost + ตารางในภาพรวม"
 *
 * - นับ = เปิดลิงก์สมัคร 1 ครั้ง (ที่เดียวกับ `hit_count` · เจ้าหน้าที่เปิดดูไม่นับ) ⇒ ยอดรายวันต่อลิงก์ (175)
 * - รายวันเริ่มเก็บวันที่ขึ้นเว็บ (`CLICKS_SINCE`) ไว้ใช้ทีหลัง · จอตอนนี้ใช้ยอดทั้งหมด `hit_count` (เจ้าของ Choice "แบบ 1 ยอดทั้งหมด ใช้ได้เลย")
 * - So Scraping ไม่ได้เก็บคลิก — ลิงก์ที่โพสต์เป็นลิงก์สมัครของเรา คนกดเข้าระบบเราตรง
 */
import { dbQuery } from './postgres.js';
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

export type LinkClickRow = { label: string; fbGroupId: string | null; clicks: number; appIds: string[] };

/**
 * ยอดทั้งหมดตั้งแต่สร้างลิงก์ ต่อป้ายลิงก์ (เจ้าของ 10 พ.ย. 2569 Choice "แบบ 1 ยอดทั้งหมด ใช้ได้เลย")
 * คลิก = `hit_count` สะสม · กรอก = ใบสมัครที่มาจากลิงก์ป้ายนั้น (ฐานเดียวกัน ไม่ตามปฏิทิน — เดิมคลิกเริ่ม 10 พ.ย. แต่กรอกนับทั้งช่วง เลขย้อนแย้ง)
 * `buSet` = ชุด BU ในสิทธิ์ (null = ไม่กรอง) · ป้ายว่าง = ไม่นับ
 */
export async function loadLinkClicks(opts: { buSet: BuSet }): Promise<LinkClickRow[]> {
  const { rows } = await dbQuery<{ label: string; fb_group_id: string | null; clicks: string; app_ids: string[] | null }>(
    `select btrim(l.channel_label) as label, max(lower(nullif(btrim(l.fb_group_id), ''))) as fb_group_id, sum(l.hit_count)::text as clicks,
            (select array_agg(a.id::text) from ${APPS} a where a.link_id = any(array_agg(l.id))) as app_ids
       from ${LINKS} l
       left join ${POSTINGS} p on p.id = l.posting_id
       left join ${MAP} bm on bm.job_id = p.job_id
      where nullif(btrim(l.channel_label), '') is not null
        and l.channel_label ilike '%facebook group%'
        and ${buMatchSql(linkBuSql, '$1')}
      group by btrim(l.channel_label)`,
    [opts.buSet],
  );
  return rows.map((r) => ({ label: r.label, fbGroupId: r.fb_group_id, clicks: Number(r.clicks) || 0, appIds: r.app_ids ?? [] }));
}

export type FbGroupStat = { clicks: number; apps: number };
export type FbGroupStats = { byId: Record<string, FbGroupStat>; byName: Record<string, FbGroupStat> };

/**
 * กลุ่ม Facebook ยอดทั้งหมด — ป๊อปเลือกกลุ่ม Autopost/Gen link
 * `byId` = รหัสกลุ่ม (`soGroupLinkKey` = fb_group_id ตัวเล็ก · ลิงก์ตั้งแต่ 4 พ.ย.) · `byName` = ชื่อกลุ่มท้ายป้าย (ตัวเล็ก · ลิงก์เก่าที่ไม่มีรหัส)
 * คลิก = `hit_count` สะสม · กรอก = ใบสมัครจากลิงก์นั้น · ทุกใบขอ (ดูภาพรวมของกลุ่ม ไม่ใช่ของใบเดียว)
 */
export async function loadFbGroupStats(): Promise<FbGroupStats> {
  const { rows } = await dbQuery<{ id_key: string | null; name_key: string; clicks: string; apps: string }>(
    `select lower(nullif(btrim(l.fb_group_id), '')) as id_key,
            lower(btrim(regexp_replace(l.channel_label, '^.*facebook group\\s*·\\s*', '', 'i'))) as name_key,
            sum(l.hit_count)::text as clicks,
            (select count(*) from ${APPS} a where a.link_id = any(array_agg(l.id)))::text as apps
       from ${LINKS} l
      where l.channel_label ~* 'facebook group\\s*·\\s*\\S'
      group by 1, 2`,
  );
  const out: FbGroupStats = { byId: {}, byName: {} };
  const add = (bag: Record<string, FbGroupStat>, k: string, c: number, a: number) => {
    const cur = bag[k] ?? { clicks: 0, apps: 0 };
    bag[k] = { clicks: cur.clicks + c, apps: cur.apps + a };
  };
  for (const r of rows) {
    const c = Number(r.clicks) || 0;
    const a = Number(r.apps) || 0;
    if (r.id_key) add(out.byId, r.id_key, c, a);
    else if (r.name_key) add(out.byName, r.name_key, c, a);
  }
  return out;
}
