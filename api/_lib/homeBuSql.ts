/**
 * ═══ BU ของแต่ละแถวฝั่ง SQL (ชุดรหัสแผนก) — ตัวเดียวของหน้าหลัก (29 ก.ย. 2569) ═══
 *
 * เจ้าของเคาะหน้าหลักโฉม 3 ก้อน: **"BU เดียวคุมทั้งหน้า"** — เดิมแต่ละเส้นหา BU เอง บางเส้นไม่มีเลย
 * (office-floor ทั้งบริษัท · ติดตามเทียบรหัสแผนกกับตัวเลือกจากไซต์ ⇒ LM ไม่มีวันตรง LML)
 * ⇒ ยกกติกาเดิมทุกข้อมาไว้ที่เดียว แล้วแปลงเป็น BU กลาง (`trendBuSql` = ชุดรหัสแผนกของ Dashboard)
 *
 * กติกา (ของเดิมทั้งหมด ไม่มีข้อใหม่):
 * - ใบสมัคร = ไซต์ของใบขอ (`job_site_map` ผ่าน `a.job_id`) → แผนกบนใบสมัคร (ทางถอย)
 * - คิวโทร = งานติดตาม: แผนกของคนคีย์ → ไซต์ของรายการ · ที่เหลือ: ไซต์ของใบขอ (`job_ref`) → แผนกบนใบสมัคร
 *   (ตัวเดียวกับยอดส่ง Lumos ทั้งระบบ `office-team`)
 * - งานติดตาม = แผนกของคนคีย์ → ไซต์ของรายการ (เจ้าของเคาะ 15 ก.ย. 2569 · `home-kpis`)
 * - คนรับไปโทร (hold) = ไซต์ของใบขอ · ดูแลหลังเริ่มงาน = ไซต์ของรายการ
 * ไม่รู้ BU = NULL ⇒ กรอง BU แล้วหลุดออก (ถูกต้อง — ตอบไม่ได้ว่าอยู่ BU นี้ ห้ามเดา)
 *
 * แต่ละตัวมาคู่กับ join ที่ต้องต่อท้าย `from` ของตารางนั้น (alias ไม่ชนกัน) · ทุกตารางที่ join มีคีย์ไม่ซ้ำ
 * (`job_site_map.job_id` PK · id ของใบสมัคร/ติดตาม/ผู้ใช้) ⇒ ไม่ทำให้แถวงอก
 */
import { tableInAppSchema } from './schema.js';
import { siteBuSql, trendBuOfSiteSql, trendBuSql } from './siteBuSql.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';

const MAP = tableInAppSchema('job_site_map');
const APPS = tableInAppSchema('public_job_applications');
const FOLLOW = tableInAppSchema('follow_entries');
const USERS = tableInAppSchema('users');

/**
 * รหัส BU ที่รับจาก query → BU กลาง (ชุดแผนก) — ตัวอักษรล้วน 2–4 ตัว (ชุดไซต์ `LML` หรือแผนก `LM` ก็ได้)
 * อย่างอื่น/ไม่ส่ง = `null` = ไม่กรอง (เส้นเดิมตอบเหมือนเดิมเป๊ะ)
 */
export function parseBuParam(raw: unknown): string | null {
  const v = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  return /^[A-Z]{2,4}$/.test(v) ? normalizeTrendBu(v) : null;
}

/** ใบสมัคร — ต่อท้าย `from <apps> a` */
export const appBuJoin = (a = 'a') => `left join ${MAP} ${a}_bm on ${a}_bm.job_id = ${a}.job_id`;
export const appBuSql = (a = 'a') =>
  trendBuSql(`coalesce(${siteBuSql(`${a}_bm.site_code`)}, nullif(btrim(${a}.department_code), ''))`);

/** งานติดตาม — ต่อท้าย `from <follow_entries> f` */
export const followBuJoin = (f = 'f') => `left join ${USERS} ${f}_bu on ${f}_bu.id = ${f}.created_by`;
export const followBuSql = (f = 'f') =>
  trendBuSql(`coalesce(nullif(btrim(${f}_bu.department_code), ''), ${siteBuSql(`${f}.site_code`)})`);

/** คิวโทร — ต่อท้าย `from <queue> q` */
export const queueBuJoins = (q = 'q') =>
  [
    `left join ${MAP} ${q}_bm on ${q}_bm.job_id = ${q}.job_ref`,
    `left join ${APPS} ${q}_ba on ${q}.person_ref = 'app-' || ${q}_ba.id::text`,
    `left join ${FOLLOW} ${q}_bf on ${q}.person_ref = 'follow-' || ${q}_bf.id::text`,
    `left join ${USERS} ${q}_bu on ${q}_bu.id = ${q}_bf.created_by`,
  ].join('\n       ');
export const queueBuSql = (q = 'q') =>
  trendBuSql(`case
      when ${q}.job_ref = 'follow' or ${q}.person_ref like 'follow-%'
        then coalesce(nullif(btrim(${q}_bu.department_code), ''), ${siteBuSql(`${q}_bf.site_code`)})
      else coalesce(${siteBuSql(`${q}_bm.site_code`)}, nullif(btrim(${q}_ba.department_code), ''))
    end`);

/** คนรับไปโทร — ต่อท้าย `from <holds> h` */
export const holdBuJoin = (h = 'h') => `left join ${MAP} ${h}_bm on ${h}_bm.job_id = ${h}.job_id`;
export const holdBuSql = (h = 'h') => trendBuOfSiteSql(`${h}_bm.site_code`);

/** ดูแลหลังเริ่มงาน — มีรหัสไซต์ในแถวเอง ไม่ต้อง join */
export const aftercareBuSql = (p = 'p') => trendBuOfSiteSql(`${p}.site_code`);

const QUEUE = tableInAppSchema('lumos_dispatch_queue');

/**
 * id ของแถวที่อยู่ BU นี้ — ใช้ต่อท้ายคิวรีเดิมเป็น `id in (...)` ได้โดยไม่แตะ alias/คอลัมน์ของคิวรีนั้น
 * (เงื่อนไขคิวของบางเส้นเขียนคอลัมน์ไม่มี alias — ต่อ join ตรง ๆ เสี่ยงชื่อคอลัมน์ชนกับตารางที่ join)
 * `param` = ตำแหน่งพารามิเตอร์ของ BU เช่น `'$1'`
 */
export const queueIdsOfBuSql = (param: string) =>
  `(select qb.id from ${QUEUE} qb ${queueBuJoins('qb')} where ${queueBuSql('qb')} = ${param})`;
export const appIdsOfBuSql = (param: string) =>
  `(select ab.id from ${APPS} ab ${appBuJoin('ab')} where ${appBuSql('ab')} = ${param})`;
