/**
 * GET /api/staff-activity?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD — งานรายคนต่อวัน (เจ้าของ 18 พ.ย. 2569)
 * GET ...&feed=1 — ความเคลื่อนไหวล่าสุด 30 รายการในช่วง (ภาพรวมแบบ Mobix)
 * GET ...&detail=1&user=<uuid>&kind=<StaffActivityKind>&day=YYYY-MM-DD(ไม่ส่ง = ทั้งช่วง) — รายการของช่องที่กด
 * GET ...&person=1&user=<uuid>&day=YYYY-MM-DD — งานของคนเดียววันเดียว เทียบวันก่อน + 7 วัน (from–to) + ช่องทาง + ใบไหน + คลิก/กรอก (แท็บงานรายคน 20 พ.ย. 2569)
 * อ่านอย่างเดียว · สิทธิ์เดียวกับภาพรวม (`job-applications`) · BU = แผนกของผู้ใช้ (ชุดเลือก BU เดียวกับภาพรวม)
 * แหล่ง: Autopost/Scrap = job_posting_requests · สร้างลิงก์ = recruit_posting_links · ติ๊กโพสต์เอง = recruit_posting_link_posts
 *        ลงผลติดต่อ/นัดได้ = application_contact_logs (วันที่บันทึก)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope } from '../_lib/departmentScope.js';
import { pickDashboardBuSet } from '../_lib/homeBuSql.js';
import { STAFF_NAME_SQL } from '../_lib/staffNameSql.js';
import {
  STAFF_ACTIVITY_KINDS,
  emptyStaffKinds,
  ymdAddDays,
  type StaffActivityFeedItem,
  type StaffActivityItem,
  type StaffActivityKind,
  type StaffActivityRow,
  type StaffKindCounts,
  type StaffPersonDay,
  type StaffPersonJob,
  type StaffPersonSub,
} from '../../src/lib/staffActivity.js';
import { scrapOutcomeOf, type ScrapOutcome } from '../../src/lib/jobPostActions.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const USERS = tableInAppSchema('users');
const ORDERS = tableInAppSchema('job_posting_requests');
const LINKS = tableInAppSchema('recruit_posting_links');
const LINK_POSTS = tableInAppSchema('recruit_posting_link_posts');
const POSTINGS = tableInAppSchema('recruit_postings');
const CONTACTS = tableInAppSchema('application_contact_logs');
const HITS = tableInAppSchema('recruit_posting_link_hits');
const CANCELLATIONS = tableInAppSchema('application_cancellations');
const POSTING_KINDS = tableInAppSchema('recruit_posting_kinds');
/** ผลของการติดต่อ 1 แถว — คำเดียวกันทั้งรายการที่กดและแถวย่อยของแท็บงานรายคน */
const CONTACT_RESULT_SQL = `case when not c.ok then concat_ws(' · ', 'ติดต่อไม่ได้', c.reason_label) when c.appointment_at is not null then 'นัดได้'
            when c.reason_label is not null then concat_ws(' · ', 'นัดหมายไม่สำเร็จ', c.reason_label) else 'ติดต่อได้' end`;
const APPS = tableInAppSchema('public_job_applications');
const bkk = (col: string) => `(${col} at time zone 'Asia/Bangkok')::date`;
/** ลิงก์เป็นงานของผู้รับผิดชอบที่เลือกตอน Gen link › คนกด (190 · เจ้าของ 19 พ.ย. 2569) — คนกดจริงยังอยู่ที่ created_by_user_id */
const LINK_OWNER = 'coalesce(l.responsible_user_id, l.created_by_user_id)';

/** เหตุการณ์ต่อชนิด: [ผู้ใช้, วัน] ในช่วง $1–$2 */
const EVENTS: Record<StaffActivityKind, string> = {
  autopost: `select o.requested_by_user_id as user_id, ${bkk('o.created_at')} as day from ${ORDERS} o where o.request_type = 'content' and ${bkk('o.created_at')} between $1::date and $2::date`,
  scrap: `select o.requested_by_user_id, ${bkk('o.created_at')} from ${ORDERS} o where o.request_type = 'scraping' and ${bkk('o.created_at')} between $1::date and $2::date`,
  links: `select ${LINK_OWNER}, ${bkk('l.created_at')} from ${LINKS} l where ${bkk('l.created_at')} between $1::date and $2::date`,
  manualPosted: `select p.posted_by_user_id, p.day from ${LINK_POSTS} p where p.day between $1::date and $2::date`,
  contacts: `select c.created_by, ${bkk('c.created_at')} from ${CONTACTS} c where ${bkk('c.created_at')} between $1::date and $2::date`,
  appts: `select c.created_by, ${bkk('c.created_at')} from ${CONTACTS} c where c.appointment_at is not null and ${bkk('c.created_at')} between $1::date and $2::date`,
};

async function loadRows(from: string, to: string, buSet: readonly string[] | null): Promise<StaffActivityRow[]> {
  const union = STAFF_ACTIVITY_KINDS.map((k) => `select '${k}'::text as kind, e.* from (${EVENTS[k]}) e`).join('\nunion all\n');
  const { rows } = await dbQuery<{ user_id: string; name: string; bu: string | null; day: string; kind: StaffActivityKind; n: number; login: string }>(
    `with ev(kind, user_id, day) as (${union})
     select u.id::text as user_id, ${STAFF_NAME_SQL('u', 'u.email')} as name, u.department_code as bu,
            to_char(ev.day, 'YYYY-MM-DD') as day, ev.kind, count(*)::int as n, split_part(u.email, '@', 1) as login
       from ev join ${USERS} u on u.id = ev.user_id
      where ($3::text[] is null or u.department_code = any($3::text[]))
      group by 1, 2, 3, 4, 5, 7`,
    [from, to, buSet ? [...buSet] : null],
  );
  const m = new Map<string, StaffActivityRow>();
  for (const r of rows) {
    const key = `${r.user_id}|${r.day}`;
    const cur = m.get(key) ?? { userId: r.user_id, name: r.name, bu: r.bu, day: r.day, login: r.login, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 };
    cur[r.kind] = r.n;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name, 'th'));
}

/** ใบขอ/กล่องลอยของลิงก์ — คีย์เต็ม (`siamraj-sql:` · `siamraj-pre:` · `standalone:`) ใบขอชั่วคราวเลขซ้ำใบจริงได้ ห้ามใช้เลขเปล่า */
const JOB_KEY = `coalesce(p.job_id, 'standalone:' || p.standalone_kind, '—')`;

/** รายการของช่องที่กด: วัน · หัว · รายละเอียด · ใบสมัคร · เลขใบขอ · เวลาที่ทำ · คีย์ใบขอ (เวลา/คีย์เพิ่ม 20 พ.ย. 2569 แท็บงานรายคน) */
const DETAIL: Record<StaffActivityKind, string> = {
  autopost: `select to_char(${bkk('o.created_at')}, 'YYYY-MM-DD') as day, coalesce(o.request_no, o.job_id) as title,
       concat_ws(' · ', o.job_snapshot->>'account_name', jsonb_array_length(coalesce(o.job_snapshot->'group_ids', '[]'::jsonb)) || ' กลุ่ม', o.status) as sub,
       null::text as application_id, o.request_no, o.created_at as at, o.job_id from ${ORDERS} o
     where o.request_type = 'content' and o.requested_by_user_id = $3 and ${bkk('o.created_at')} between $1::date and $2::date order by o.created_at desc`,
  scrap: `select to_char(${bkk('o.created_at')}, 'YYYY-MM-DD'), coalesce(o.request_no, o.job_id), o.status, null::text, o.request_no, o.created_at, o.job_id from ${ORDERS} o
     where o.request_type = 'scraping' and o.requested_by_user_id = $3 and ${bkk('o.created_at')} between $1::date and $2::date order by o.created_at desc`,
  links: `select to_char(${bkk('l.created_at')}, 'YYYY-MM-DD'), coalesce(split_part(p.job_id, ':', 2), p.standalone_kind, '—'), coalesce(l.channel_label, l.code), null::text,
       nullif(split_part(p.job_id, ':', 2), ''), l.created_at, ${JOB_KEY} from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id
     where ${LINK_OWNER} = $3 and ${bkk('l.created_at')} between $1::date and $2::date order by l.created_at desc`,
  manualPosted: `select to_char(x.day, 'YYYY-MM-DD'), coalesce(split_part(p.job_id, ':', 2), p.standalone_kind, '—'), coalesce(l.channel_label, l.code), null::text,
       nullif(split_part(p.job_id, ':', 2), ''), x.created_at, ${JOB_KEY} from ${LINK_POSTS} x join ${LINKS} l on l.id = x.link_id join ${POSTINGS} p on p.id = l.posting_id
     where x.posted_by_user_id = $3 and x.day between $1::date and $2::date order by x.day desc, x.created_at desc`,
  contacts: `select to_char(${bkk('c.created_at')}, 'YYYY-MM-DD'), coalesce(a.full_name, '—'),
       ${CONTACT_RESULT_SQL},
       c.application_id::text, nullif(split_part(a.job_id, ':', 2), ''), c.created_at, a.job_id from ${CONTACTS} c left join ${APPS} a on a.id = c.application_id
     where c.created_by = $3 and ${bkk('c.created_at')} between $1::date and $2::date order by c.created_at desc`,
  appts: `select to_char(${bkk('c.created_at')}, 'YYYY-MM-DD'), coalesce(a.full_name, '—'), to_char(c.appointment_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
       c.application_id::text, nullif(split_part(a.job_id, ':', 2), ''), c.created_at, a.job_id from ${CONTACTS} c left join ${APPS} a on a.id = c.application_id
     where c.created_by = $3 and c.appointment_at is not null and ${bkk('c.created_at')} between $1::date and $2::date order by c.created_at desc`,
};

/**
 * ความเคลื่อนไหวล่าสุด (ภาพรวม · เจ้าของ 18 พ.ย. 2569 แบบ Mobix) — งานที่บันทึกล่าสุดในช่วง ทุกคนใน BU
 * เรื่อง · ใคร · กับอะไร · รายละเอียด · เวลา (กรุงเทพ)
 */
async function loadFeed(from: string, to: string, buSet: readonly string[] | null): Promise<StaffActivityFeedItem[]> {
  const who = (u: string, raw: string) => STAFF_NAME_SQL(u, raw);
  const { rows } = await dbQuery<{ at: string; kind: string; who: string; subject: string | null; detail: string | null; application_id: string | null; request_no: string | null }>(
    `select * from (
       select o.created_at as at, case when o.request_type = 'scraping' then 'สั่ง Scrap' else 'สั่ง Autopost' end as kind, ${who('u', 'o.requested_by_name')} as who,
              coalesce(o.request_no, o.job_id) as subject,
              case when o.request_type = 'scraping' then o.status
                   else concat_ws(' · ', o.job_snapshot->>'account_name', jsonb_array_length(coalesce(o.job_snapshot->'group_ids', '[]'::jsonb)) || ' กลุ่ม') end as detail,
              null::text as application_id, o.request_no, u.department_code as bu
         from ${ORDERS} o join ${USERS} u on u.id = o.requested_by_user_id
        where ${bkk('o.created_at')} between $1::date and $2::date
       union all
       select l.created_at, 'สร้างลิงก์โพสต์เอง', ${who('u', 'l.created_by_name')}, coalesce(nullif(split_part(p.job_id, ':', 2), ''), p.standalone_kind), coalesce(l.channel_label, l.code),
              null, nullif(split_part(p.job_id, ':', 2), ''), u.department_code
         from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id join ${USERS} u on u.id = ${LINK_OWNER}
        where ${bkk('l.created_at')} between $1::date and $2::date
       union all
       select c.created_at,
              case when not c.ok then 'ติดต่อไม่ได้' when c.appointment_at is not null then 'นัดได้' when c.reason_label is not null then 'นัดหมายไม่สำเร็จ' else 'ติดต่อได้' end,
              ${who('u', 'c.created_by_name')}, a.full_name,
              case when c.appointment_at is not null then to_char(c.appointment_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI') else c.reason_label end,
              c.application_id::text, nullif(split_part(a.job_id, ':', 2), ''), u.department_code
         from ${CONTACTS} c join ${USERS} u on u.id = c.created_by left join ${APPS} a on a.id = c.application_id
        where ${bkk('c.created_at')} between $1::date and $2::date
     ) e
     where ($3::text[] is null or e.bu = any($3::text[]))
     order by e.at desc limit 30`,
    [from, to, buSet ? [...buSet] : null],
  );
  return rows.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, who: r.who, subject: r.subject, detail: r.detail, applicationId: r.application_id, requestNo: r.request_no }));
}

async function loadDetail(from: string, to: string, userId: string, kind: StaffActivityKind): Promise<StaffActivityItem[]> {
  const { rows } = await dbQuery<{ day: string; title: string; sub: string | null; application_id: string | null; request_no: string | null; at: string | null; job_id: string | null }>(
    `select * from (${DETAIL[kind]}) d(day, title, sub, application_id, request_no, at, job_id) limit 2000`,
    [from, to, userId],
  );
  return rows.map((r) => ({ day: r.day, title: r.title, sub: r.sub, applicationId: r.application_id, requestNo: r.request_no, at: r.at ? new Date(r.at).toISOString() : null, jobId: r.job_id }));
}

const SCRAP_OUTCOME_LABEL: Record<ScrapOutcome, string> = { done: 'สำเร็จ', waiting: 'รอ', failed: 'ไม่สำเร็จ', cancelled: 'ยกเลิก' };
/** ช่องทางของลิงก์ = 2 ชั้นแรกของป้าย ("Facebook · Facebook Group · <ชื่อกลุ่ม>" → "Facebook · Facebook Group") */
const CHANNEL_SQL = `coalesce(nullif(concat_ws(' · ', nullif(btrim(split_part(l.channel_label, ' · ', 1)), ''), nullif(btrim(split_part(l.channel_label, ' · ', 2)), '')), ''), 'ไม่ระบุช่องทาง')`;
/** ใบสมัครที่นับ — ตัด Lead และใบที่ยกเลิกข้อมูล (กติกาเดียวกับภาพรวม) */
const APP_COUNTED = `not coalesce(a.is_lead, false) and not exists (select 1 from ${CANCELLATIONS} cx where cx.application_id = a.id)`;

/** SQL ของแท็บงานรายคน (อ่านอย่างเดียว) — แยกออกมาให้ตรวจกับฐานจริงในธุรกรรมอ่านอย่างเดียวได้ */
export function personDaySql(): Record<'counts' | 'chans' | 'results' | 'jobs', string> {
  const union = STAFF_ACTIVITY_KINDS.map((k) => `select '${k}'::text as kind, e.* from (${EVENTS[k]}) e`).join('\nunion all\n');
  return {
    counts: `with ev(kind, user_id, day) as (${union})
       select to_char(ev.day, 'YYYY-MM-DD') as day, ev.kind, count(*)::int as n from ev where ev.user_id = $3::uuid group by 1, 2`,
    chans: `select 'links'::text as kind, ${CHANNEL_SQL} as label, count(*)::int as n, null::int as extra
         from ${LINKS} l where ${LINK_OWNER} = $2::uuid and ${bkk('l.created_at')} = $1::date group by 2
       union all
       select 'manualPosted', ${CHANNEL_SQL}, count(*)::int, null
         from ${LINK_POSTS} x join ${LINKS} l on l.id = x.link_id where x.posted_by_user_id = $2::uuid and x.day = $1::date group by 2
       union all
       select 'scrap', o.status, count(*)::int, null
         from ${ORDERS} o where o.request_type = 'scraping' and o.requested_by_user_id = $2::uuid and ${bkk('o.created_at')} = $1::date group by 2
       union all
       select 'autopost', coalesce(nullif(btrim(o.job_snapshot->>'account_name'), ''), 'ไม่ระบุบัญชี'), count(*)::int,
              sum(jsonb_array_length(coalesce(o.job_snapshot->'group_ids', '[]'::jsonb)))::int
         from ${ORDERS} o where o.request_type = 'content' and o.requested_by_user_id = $2::uuid and ${bkk('o.created_at')} = $1::date group by 2
       union all
       select 'contacts', ${CONTACT_RESULT_SQL}, count(*)::int, null
         from ${CONTACTS} c where c.created_by = $2::uuid and ${bkk('c.created_at')} = $1::date group by 2`,
    results: `select 'clicks'::text as what, to_char(h.day, 'YYYY-MM-DD') as day, coalesce(sum(h.hits), 0)::int as n
         from ${HITS} h join ${LINKS} l on l.id = h.link_id where ${LINK_OWNER} = $3::uuid and h.day in ($1::date, $2::date) group by 2
       union all
       select 'applicants', to_char(${bkk('a.created_at')}, 'YYYY-MM-DD'), count(*)::int
         from ${APPS} a join ${LINKS} l on l.id = a.link_id
        where ${LINK_OWNER} = $3::uuid and ${bkk('a.created_at')} in ($1::date, $2::date) and ${APP_COUNTED} group by 2`,
    jobs: `with w(job, kind, n) as (
         select coalesce(o.job_id, o.request_no, '—'), case when o.request_type = 'scraping' then 'scrap' else 'autopost' end, 1
           from ${ORDERS} o where o.requested_by_user_id = $2::uuid and ${bkk('o.created_at')} = $1::date
         union all
         select ${JOB_KEY}, 'links', 1 from ${LINKS} l left join ${POSTINGS} p on p.id = l.posting_id
          where ${LINK_OWNER} = $2::uuid and ${bkk('l.created_at')} = $1::date
         union all
         select ${JOB_KEY}, 'manualPosted', 1 from ${LINK_POSTS} x join ${LINKS} l on l.id = x.link_id left join ${POSTINGS} p on p.id = l.posting_id
          where x.posted_by_user_id = $2::uuid and x.day = $1::date
         union all
         select ${JOB_KEY}, 'clicks', h.hits from ${HITS} h join ${LINKS} l on l.id = h.link_id left join ${POSTINGS} p on p.id = l.posting_id
          where ${LINK_OWNER} = $2::uuid and h.day = $1::date
         union all
         select ${JOB_KEY}, 'applicants', 1 from ${APPS} a join ${LINKS} l on l.id = a.link_id left join ${POSTINGS} p on p.id = l.posting_id
          where ${LINK_OWNER} = $2::uuid and ${bkk('a.created_at')} = $1::date and ${APP_COUNTED}
       )
       select w.job, w.kind, sum(w.n)::int as n, max(k.label) as kind_label
         from w left join ${POSTING_KINDS} k on w.job = 'standalone:' || k.code
        group by 1, 2`,
  };
}

/**
 * งานของคนเดียวในวันเดียว เทียบวันก่อน + 7 วัน (แท็บงานรายคน · เจ้าของ 20 พ.ย. 2569) — อ่านอย่างเดียว
 * ทำอะไร = `EVENTS` ชุดเดียวกับตารางรายคน (นิยามเดียว) · ช่องทาง/ผล · ใบไหน · คลิก/กรอก ของลิงก์ที่คนนี้รับผิดชอบ (`LINK_OWNER`)
 * `from`–`to` = 7 วันที่วาดแท่ง · `day` = วันที่ดู (อยู่ในช่วง) · วันก่อนหน้าอ่านเพิ่มถ้าอยู่นอกช่วง
 */
async function loadPersonDay(from: string, to: string, day: string, userId: string): Promise<StaffPersonDay> {
  const prevDay = ymdAddDays(day, -1);
  const lo = prevDay < from ? prevDay : from;
  const sql = personDaySql();
  const [counts, chans, results, jobs] = await Promise.all([
    dbQuery<{ day: string; kind: StaffActivityKind; n: number }>(sql.counts, [lo, to, userId]),
    dbQuery<{ kind: StaffActivityKind; label: string; n: number; extra: number | null }>(sql.chans, [day, userId]),
    dbQuery<{ what: 'clicks' | 'applicants'; day: string; n: number }>(sql.results, [day, prevDay, userId]),
    dbQuery<{ job: string; kind: string; n: number; kind_label: string | null }>(sql.jobs, [day, userId]),
  ]);

  const byDay = new Map<string, StaffKindCounts>();
  for (const r of counts.rows) {
    const cur = byDay.get(r.day) ?? emptyStaffKinds();
    cur[r.kind] = r.n;
    byDay.set(r.day, cur);
  }
  const week: StaffPersonDay['week'] = [];
  for (let d = from; d <= to; d = ymdAddDays(d, 1)) week.push({ day: d, ...(byDay.get(d) ?? emptyStaffKinds()) });

  const channels = Object.fromEntries(STAFF_ACTIVITY_KINDS.map((k) => [k, [] as StaffPersonSub[]])) as StaffPersonDay['channels'];
  const scrap = new Map<ScrapOutcome, number>();
  for (const r of chans.rows) {
    if (r.kind === 'scrap') scrap.set(scrapOutcomeOf(r.label), (scrap.get(scrapOutcomeOf(r.label)) ?? 0) + r.n);
    else if (r.kind === 'autopost') channels.autopost.push({ label: `${r.label} · ${r.extra ?? 0} กลุ่ม`, n: r.n });
    else channels[r.kind].push({ label: r.label, n: r.n });
  }
  for (const k of ['done', 'waiting', 'failed', 'cancelled'] as const) if (scrap.get(k)) channels.scrap.push({ label: SCRAP_OUTCOME_LABEL[k], n: scrap.get(k) as number });
  for (const k of STAFF_ACTIVITY_KINDS) if (k !== 'scrap') channels[k].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'th'));

  const res = (what: 'clicks' | 'applicants', d: string) => results.rows.find((r) => r.what === what && r.day === d)?.n ?? 0;

  const jobMap = new Map<string, StaffPersonJob>();
  for (const r of jobs.rows) {
    const no = r.job.slice(r.job.indexOf(':') + 1);
    const label = r.job.startsWith('standalone:') ? `กล่องลอย · ${r.kind_label ?? no}` : r.job.startsWith('siamraj-pre:') ? `${no} · ใบขอชั่วคราว` : no;
    const cur = jobMap.get(r.job) ?? { jobId: r.job, label, autopost: 0, scrap: 0, links: 0, manualPosted: 0, clicks: 0, applicants: 0 };
    if (r.kind in cur && r.kind !== 'jobId' && r.kind !== 'label') (cur as unknown as Record<string, number>)[r.kind] = r.n;
    jobMap.set(r.job, cur);
  }
  const work = (j: StaffPersonJob) => j.autopost + j.scrap + j.links + j.manualPosted;
  return {
    day,
    prevDay,
    week,
    cur: byDay.get(day) ?? emptyStaffKinds(),
    prev: byDay.get(prevDay) ?? emptyStaffKinds(),
    channels,
    results: { clicks: res('clicks', day), clicksPrev: res('clicks', prevDay), applicants: res('applicants', day), applicantsPrev: res('applicants', prevDay) },
    jobs: [...jobMap.values()].sort((a, b) => work(b) - work(a) || b.applicants - a.applicants || b.clicks - a.clicks || a.label.localeCompare(b.label, 'th')),
  };
}

/** คนอยู่ใน BU ที่ผู้ถามเห็นไหม · `buSet` null = เห็นทุก BU */
async function userInBu(user: string, buSet: readonly string[] | null): Promise<boolean> {
  if (buSet === null) return true;
  const { rows } = await dbQuery<{ ok: boolean }>(`select department_code = any($2::text[]) as ok from ${USERS} where id = $1`, [user, [...buSet]]);
  return Boolean(rows[0]?.ok);
}

export async function staffActivityHandler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const from = String(one(req.query?.from) ?? '');
  const to = String(one(req.query?.to) ?? '');
  if (!DAY.test(from) || !DAY.test(to) || from > to) return sendError(res, 400, 'bad_request', 'ช่วงวันที่ไม่ถูกต้อง');
  try {
    const scope = await loadMatchingBuScope(req.user);
    const { buSet } = pickDashboardBuSet(scope, one(req.query?.bu) ?? null);
    res.setHeader?.('Cache-Control', 'no-store');
    if (buSet !== null && buSet.length === 0) return res.status(200).json({ rows: [] });
    if (String(one(req.query?.feed) ?? '') === '1') return res.status(200).json({ items: await loadFeed(from, to, buSet) });
    if (String(one(req.query?.person) ?? '') === '1') {
      const user = String(one(req.query?.user) ?? '');
      const day = String(one(req.query?.day) ?? '');
      if (!UUID.test(user) || !DAY.test(day) || day < from || day > to) return sendError(res, 400, 'bad_request', 'ข้อมูลไม่ครบ');
      // 7 วันพอ — กันช่วงยาวที่ทำให้อ่านหนัก
      if (ymdAddDays(from, 31) < to) return sendError(res, 400, 'bad_request', 'ช่วงวันที่ยาวเกินไป');
      if (!(await userInBu(user, buSet))) return res.status(200).json({ person: null });
      return res.status(200).json({ person: await loadPersonDay(from, to, day, user) });
    }
    if (String(one(req.query?.detail) ?? '') === '1') {
      const user = String(one(req.query?.user) ?? '');
      const kind = String(one(req.query?.kind) ?? '') as StaffActivityKind;
      const day = String(one(req.query?.day) ?? '');
      if (!UUID.test(user) || !STAFF_ACTIVITY_KINDS.includes(kind)) return sendError(res, 400, 'bad_request', 'ข้อมูลไม่ครบ');
      if (day && !DAY.test(day)) return sendError(res, 400, 'bad_request', 'วันที่ไม่ถูกต้อง');
      // คนนอก BU ในสิทธิ์ = ไม่เห็นรายการ
      if (!(await userInBu(user, buSet))) return res.status(200).json({ items: [] });
      return res.status(200).json({ items: await loadDetail(day || from, day || to, user, kind) });
    }
    return res.status(200).json({ rows: await loadRows(from, to, buSet) });
  } catch (e) {
    return handleApiError(res, e, 'staff-activity', { userId: req.user?.sub });
  }
}

export default withRbac(staffActivityHandler, 'job-applications');
