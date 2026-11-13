/**
 * ═══ "ทำอะไรไปแล้ว" ของใบขอ ฝั่งเซิร์ฟเวอร์ (เจ้าของ 13 พ.ย. 2569) ═══
 * ตัวตัดสิน (ลิงก์มาจาก Autopost/โพสต์เอง · กองสถานะ) อยู่ `src/lib/jobPostActions.ts`
 * อ่านอย่างเดียว: ลิงก์สมัคร (`recruit_posting_links`) · คำสั่งไป So Scraping (`job_posting_requests`) · ผลรายกลุ่มจาก So Scraping
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { fetchAllSoPostGroupRows } from './soPostGroups.js';
import { toBangkokYmd } from './businessDate.js';
import {
  EMPTY_JOB_POST_ACTIONS,
  jobPostLinkOrigin,
  summarizeJobPostActions,
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
