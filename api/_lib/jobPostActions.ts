/**
 * ═══ "ทำอะไรไปแล้ว" ของใบขอ ฝั่งเซิร์ฟเวอร์ (เจ้าของ 13 พ.ย. 2569) ═══
 * ตัวตัดสิน (ลิงก์มาจาก Autopost/โพสต์เอง · กองสถานะ) อยู่ `src/lib/jobPostActions.ts`
 * อ่านอย่างเดียว: ลิงก์สมัคร (`recruit_posting_links`) · คำสั่งไป So Scraping (`job_posting_requests`) · ผลรายกลุ่มจาก So Scraping
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { fetchAllSoPostGroupRows } from './soPostGroups.js';
import { toBangkokYmd } from './businessDate.js';
import { buMatchSql, type BuSet } from './homeBuSql.js';
import { linkBuSql } from './postingLinkHits.js';
import { linkOwnerSql } from './recruitPostings.js';
import {
  EMPTY_JOB_POST_ACTIONS,
  jobPostLinkOrigin,
  manualPostDays,
  summarizeJobPostActions,
  type ManualPostDays,
  type ManualPostLinkInput,
  type JobPostActionsSummary,
  type JobPostLinkInput,
  type JobPostLinkOrigin,
  type JobPostOrderInput,
} from '../../src/lib/jobPostActions.js';
import type { SoPostGroupRow, SoPostGroupStatus } from '../../src/lib/soPostGroups.js';

const LINKS = tableInAppSchema('recruit_posting_links');
const POSTINGS = tableInAppSchema('recruit_postings');
const APPS = tableInAppSchema('public_job_applications');
const ORDERS = tableInAppSchema('job_posting_requests');
const MAP = tableInAppSchema('job_site_map');
const POSTS = tableInAppSchema('recruit_posting_link_posts');
const HITS = tableInAppSchema('recruit_posting_link_hits');
const USERS = tableInAppSchema('users');

/** ช่วงที่ So Scraping มีผลรายกลุ่ม (เส้น post-groups เริ่ม 1 ต.ค. 2569 — ตัวเดียวกับ so-post-summary) */
const SO_POST_FROM = '2026-10-01';

async function loadLinks(jobId?: string) {
  const { rows } = await dbQuery<JobPostLinkInput & { id: string; code: string; channel_label: string | null; fb_group_id: string | null; created_by_name: string | null }>(
    `select l.id::text, p.job_id, l.note, l.created_at, l.hit_count, l.code, l.channel_label, l.fb_group_id, p.created_by_name,
       coalesce(a.n, 0)::int as applicants
     from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id
     left join (select link_id, count(*) as n from ${APPS} where link_id is not null group by link_id) a on a.link_id = l.id
     where p.job_id is not null ${jobId ? 'and p.job_id = $1' : ''}
     order by l.created_at`,
    jobId ? [jobId] : [],
  );
  return rows;
}

async function loadOrders(jobId?: string) {
  const { rows } = await dbQuery<JobPostOrderInput & { request_no: string | null; requested_by_name: string | null; notes: string | null }>(
    `select job_id, request_no, request_type, status, created_at, updated_at, requested_by_name, notes
     from ${ORDERS} ${jobId ? 'where job_id = $1' : ''} order by created_at`,
    jobId ? [jobId] : [],
  );
  return rows;
}

/** ยอดทุกใบ (การ์ด) — `allowJob` = สิทธิ์ BU ของคนดู */
export async function listJobPostActions(allowJob: (jobId: string) => boolean): Promise<Record<string, JobPostActionsSummary>> {
  const [links, orders] = await Promise.all([loadLinks(), loadOrders()]);
  return summarizeJobPostActions(
    links.filter((l) => allowJob(l.job_id)),
    orders.filter((o) => allowJob(o.job_id)),
  );
}

export type JobPostActionsDetail = {
  summary: JobPostActionsSummary;
  links: Array<{ id: string; origin: JobPostLinkOrigin; code: string; channel_label: string | null; created_at: string; created_by_name: string | null; clicks: number; applicants: number }>;
  orders: Array<{ request_type: 'content' | 'scraping'; status: string; created_at: string; requested_by_name: string | null; notes: string | null }>;
  groups: { statuses: SoPostGroupStatus[]; rows: SoPostGroupRow[]; error: string | null };
};

/** รายละเอียดของใบเดียว (ป๊อป) — So Scraping อ่านไม่ได้ = บอกเหตุในแท็บ Autopost ส่วนอื่นยังขึ้น */
export async function getJobPostActions(jobId: string, requestNo: string): Promise<JobPostActionsDetail> {
  const [links, orders] = await Promise.all([loadLinks(jobId), loadOrders(jobId)]);
  const autopostTimes = orders.filter((o) => o.request_type === 'content').map((o) => new Date(o.created_at).getTime());
  let groups: JobPostActionsDetail['groups'] = { statuses: [], rows: [], error: null };
  try {
    const all = await fetchAllSoPostGroupRows({ from: SO_POST_FROM, to: toBangkokYmd(new Date()), bu: null });
    groups = { statuses: all.statuses, rows: all.rows.filter((r) => r.requestNo === requestNo), error: null };
  } catch (e) {
    groups = { statuses: [], rows: [], error: e instanceof Error ? e.message : 'อ่านผลจาก So Scraping ไม่ได้' };
  }
  return {
    summary: summarizeJobPostActions(links, orders)[jobId] ?? structuredClone(EMPTY_JOB_POST_ACTIONS),
    links: links
      .map((l) => ({
        id: l.id,
        origin: jobPostLinkOrigin(l, autopostTimes),
        code: l.code,
        channel_label: l.channel_label,
        created_at: l.created_at,
        created_by_name: l.created_by_name,
        clicks: l.hit_count,
        applicants: l.applicants,
      }))
      .reverse(),
    orders: orders
      .map((o) => ({ request_type: o.request_type, status: o.status, created_at: o.created_at, requested_by_name: o.requested_by_name, notes: o.notes }))
      .reverse(),
    groups,
  };
}

/**
 * จด "โพสต์เองแล้ว" ตอนกดคัดลอกข้อความของกลุ่ม (เจ้าของ 13 พ.ย. 2569 Choice "คัดลอกข้อความ") — (ลิงก์ · วันไทย) ละแถว กดซ้ำวันเดียวกันไม่นับเพิ่ม
 * คืน job_id ของลิงก์ (ให้เส้นเช็กสิทธิ์ BU) · ไม่มีลิงก์ = null
 */
export async function linkJobId(linkId: string): Promise<string | null> {
  const { rows } = await dbQuery<{ job_id: string | null }>(
    `select p.job_id from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id where l.id = $1::uuid`,
    [linkId],
  );
  return rows[0]?.job_id ?? null;
}

export async function recordManualPost(linkId: string, by: { id: string | null; name: string | null }): Promise<void> {
  await dbQuery(
    `insert into ${POSTS} (link_id, day, posted_by_user_id, posted_by_name)
     values ($1::uuid, (now() at time zone 'Asia/Bangkok')::date, $2::uuid, $3)
     on conflict (link_id, day) do nothing`,
    [linkId, by.id, by.name],
  );
}

/**
 * โพสต์เองรายวันของหน้าภาพรวม (การ์ด 6 · 13 พ.ย. 2569) — BU = BU ของใบขอ (`linkBuSql` ตัวเดียวกับตารางคลิกลิงก์)
 * ครั้งที่โพสต์ = วันที่สร้างลิงก์ (ลิงก์ที่ `jobPostLinkOrigin` ตัดสินว่าโพสต์เอง) + วันที่กดคัดลอกข้อความ (`recordManualPost`) · ลิงก์ละวันนับครั้งเดียว
 * คนโพสต์ = คนที่กดคัดลอกวันนั้น (ชื่อเล่น) · ไม่มี = คนสร้างลิงก์ (`linkOwnerSql`)
 * คลิก/กรอก = ของวันนั้นของลิงก์นั้น (คลิกรายวันมีตั้งแต่ 10 พ.ย. 2569 · กรอก = ใบสมัครที่กรอกวันนั้นผ่านลิงก์นั้น)
 */
export async function loadManualPostDays(opts: { from: string; to: string; buSet: BuSet }): Promise<ManualPostDays> {
  const { rows } = await dbQuery<ManualPostLinkInput & { link_id: string; recorded: boolean }>(
    `with ev as (
       select l.id as link_id, (l.created_at at time zone 'Asia/Bangkok')::date as day, false as recorded, null::uuid as by_id, null::text as by_name
         from ${LINKS} l
        where l.created_at >= ($1::date)::timestamp at time zone 'Asia/Bangkok'
          and l.created_at < ($2::date + 1)::timestamp at time zone 'Asia/Bangkok'
       union all
       select x.link_id, x.day, true, x.posted_by_user_id, x.posted_by_name from ${POSTS} x where x.day between $1::date and $2::date
     ), ev1 as (
       select link_id, day, bool_or(recorded) as recorded, max(by_id::text)::uuid as by_id, max(by_name) as by_name from ev group by link_id, day
     )
     select l.id::text as link_id, ev1.recorded, p.job_id, l.note, l.created_at, to_char(ev1.day, 'YYYY-MM-DD') as day,
       coalesce(h.hits, 0)::int as hit_count, l.channel_label, p.title,
       coalesce(nullif(btrim(bu.nickname), ''), nullif(btrim(bu.full_name), ''), nullif(split_part(btrim(ev1.by_name), '@', 1), ''),
                ${linkOwnerSql('l.id', 'p.id')}) as created_by_name,
       (select count(*) from ${APPS} a where a.link_id = l.id
          and (a.created_at at time zone 'Asia/Bangkok')::date = ev1.day)::int as applicants
     from ev1 join ${LINKS} l on l.id = ev1.link_id join ${POSTINGS} p on p.id = l.posting_id
     left join ${MAP} bm on bm.job_id = p.job_id
     left join ${HITS} h on h.link_id = l.id and h.day = ev1.day
     left join ${USERS} bu on bu.id = ev1.by_id
     where p.job_id is not null and ${buMatchSql(linkBuSql, '$3')}`,
    [opts.from, opts.to, opts.buSet],
  );
  const jobIds = [...new Set(rows.map((r) => r.job_id))];
  const times = new Map<string, number[]>();
  if (jobIds.length > 0) {
    const { rows: orders } = await dbQuery<{ job_id: string; created_at: string }>(
      `select job_id, created_at from ${ORDERS} where request_type = 'content' and job_id = any($1::text[])`,
      [jobIds],
    );
    for (const o of orders) times.set(o.job_id, [...(times.get(o.job_id) ?? []), new Date(o.created_at).getTime()]);
  }
  return manualPostDays(rows, times, { from: opts.from, to: opts.to });
}
