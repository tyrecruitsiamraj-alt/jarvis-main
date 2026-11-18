/**
 * GET /api/staff-activity?from=YYYY-MM-DD&to=YYYY-MM-DD&bu=LBD — งานรายคนต่อวัน (เจ้าของ 18 พ.ย. 2569)
 * GET ...&feed=1 — ความเคลื่อนไหวล่าสุด 30 รายการในช่วง (ภาพรวมแบบ Mobix)
 * GET ...&detail=1&user=<uuid>&kind=<StaffActivityKind>&day=YYYY-MM-DD(ไม่ส่ง = ทั้งช่วง) — รายการของช่องที่กด
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
import { STAFF_ACTIVITY_KINDS, type StaffActivityFeedItem, type StaffActivityItem, type StaffActivityKind, type StaffActivityRow } from '../../src/lib/staffActivity.js';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;
const USERS = tableInAppSchema('users');
const ORDERS = tableInAppSchema('job_posting_requests');
const LINKS = tableInAppSchema('recruit_posting_links');
const LINK_POSTS = tableInAppSchema('recruit_posting_link_posts');
const POSTINGS = tableInAppSchema('recruit_postings');
const CONTACTS = tableInAppSchema('application_contact_logs');
const APPS = tableInAppSchema('public_job_applications');
const bkk = (col: string) => `(${col} at time zone 'Asia/Bangkok')::date`;

/** เหตุการณ์ต่อชนิด: [ผู้ใช้, วัน] ในช่วง $1–$2 */
const EVENTS: Record<StaffActivityKind, string> = {
  autopost: `select o.requested_by_user_id as user_id, ${bkk('o.created_at')} as day from ${ORDERS} o where o.request_type = 'content' and ${bkk('o.created_at')} between $1::date and $2::date`,
  scrap: `select o.requested_by_user_id, ${bkk('o.created_at')} from ${ORDERS} o where o.request_type = 'scraping' and ${bkk('o.created_at')} between $1::date and $2::date`,
  links: `select l.created_by_user_id, ${bkk('l.created_at')} from ${LINKS} l where ${bkk('l.created_at')} between $1::date and $2::date`,
  manualPosted: `select p.posted_by_user_id, p.day from ${LINK_POSTS} p where p.day between $1::date and $2::date`,
  contacts: `select c.created_by, ${bkk('c.created_at')} from ${CONTACTS} c where ${bkk('c.created_at')} between $1::date and $2::date`,
  appts: `select c.created_by, ${bkk('c.created_at')} from ${CONTACTS} c where c.appointment_at is not null and ${bkk('c.created_at')} between $1::date and $2::date`,
};

async function loadRows(from: string, to: string, buSet: readonly string[] | null): Promise<StaffActivityRow[]> {
  const union = STAFF_ACTIVITY_KINDS.map((k) => `select '${k}'::text as kind, e.* from (${EVENTS[k]}) e`).join('\nunion all\n');
  const { rows } = await dbQuery<{ user_id: string; name: string; bu: string | null; day: string; kind: StaffActivityKind; n: number }>(
    `with ev(kind, user_id, day) as (${union})
     select u.id::text as user_id, ${STAFF_NAME_SQL('u', 'u.email')} as name, u.department_code as bu,
            to_char(ev.day, 'YYYY-MM-DD') as day, ev.kind, count(*)::int as n
       from ev join ${USERS} u on u.id = ev.user_id
      where ($3::text[] is null or u.department_code = any($3::text[]))
      group by 1, 2, 3, 4, 5`,
    [from, to, buSet ? [...buSet] : null],
  );
  const m = new Map<string, StaffActivityRow>();
  for (const r of rows) {
    const key = `${r.user_id}|${r.day}`;
    const cur = m.get(key) ?? { userId: r.user_id, name: r.name, bu: r.bu, day: r.day, autopost: 0, scrap: 0, links: 0, manualPosted: 0, contacts: 0, appts: 0 };
    cur[r.kind] = r.n;
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.day.localeCompare(a.day) || a.name.localeCompare(b.name, 'th'));
}

const DETAIL: Record<StaffActivityKind, string> = {
  autopost: `select to_char(${bkk('o.created_at')}, 'YYYY-MM-DD') as day, coalesce(o.request_no, o.job_id) as title,
       concat_ws(' · ', o.job_snapshot->>'account_name', jsonb_array_length(coalesce(o.job_snapshot->'group_ids', '[]'::jsonb)) || ' กลุ่ม', o.status) as sub,
       null::text as application_id, o.request_no from ${ORDERS} o
     where o.request_type = 'content' and o.requested_by_user_id = $3 and ${bkk('o.created_at')} between $1::date and $2::date order by o.created_at desc`,
  scrap: `select to_char(${bkk('o.created_at')}, 'YYYY-MM-DD'), coalesce(o.request_no, o.job_id), o.status, null::text, o.request_no from ${ORDERS} o
     where o.request_type = 'scraping' and o.requested_by_user_id = $3 and ${bkk('o.created_at')} between $1::date and $2::date order by o.created_at desc`,
  links: `select to_char(${bkk('l.created_at')}, 'YYYY-MM-DD'), coalesce(split_part(p.job_id, ':', 2), p.standalone_kind, '—'), coalesce(l.channel_label, l.code), null::text,
       nullif(split_part(p.job_id, ':', 2), '') from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id
     where l.created_by_user_id = $3 and ${bkk('l.created_at')} between $1::date and $2::date order by l.created_at desc`,
  manualPosted: `select to_char(x.day, 'YYYY-MM-DD'), coalesce(split_part(p.job_id, ':', 2), p.standalone_kind, '—'), coalesce(l.channel_label, l.code), null::text,
       nullif(split_part(p.job_id, ':', 2), '') from ${LINK_POSTS} x join ${LINKS} l on l.id = x.link_id join ${POSTINGS} p on p.id = l.posting_id
     where x.posted_by_user_id = $3 and x.day between $1::date and $2::date order by x.day desc, x.created_at desc`,
  contacts: `select to_char(${bkk('c.created_at')}, 'YYYY-MM-DD'), coalesce(a.full_name, '—'),
       case when not c.ok then concat_ws(' · ', 'ติดต่อไม่ได้', c.reason_label) when c.appointment_at is not null then 'นัดได้'
            when c.reason_label is not null then concat_ws(' · ', 'นัดหมายไม่สำเร็จ', c.reason_label) else 'ติดต่อได้' end,
       c.application_id::text, nullif(split_part(a.job_id, ':', 2), '') from ${CONTACTS} c left join ${APPS} a on a.id = c.application_id
     where c.created_by = $3 and ${bkk('c.created_at')} between $1::date and $2::date order by c.created_at desc`,
  appts: `select to_char(${bkk('c.created_at')}, 'YYYY-MM-DD'), coalesce(a.full_name, '—'), to_char(c.appointment_at at time zone 'Asia/Bangkok', 'DD/MM HH24:MI'),
       c.application_id::text, nullif(split_part(a.job_id, ':', 2), '') from ${CONTACTS} c left join ${APPS} a on a.id = c.application_id
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
         from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id join ${USERS} u on u.id = l.created_by_user_id
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
  const { rows } = await dbQuery<{ day: string; title: string; sub: string | null; application_id: string | null; request_no: string | null }>(
    `select * from (${DETAIL[kind]}) d(day, title, sub, application_id, request_no) limit 2000`,
    [from, to, userId],
  );
  return rows.map((r) => ({ day: r.day, title: r.title, sub: r.sub, applicationId: r.application_id, requestNo: r.request_no }));
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
    if (String(one(req.query?.detail) ?? '') === '1') {
      const user = String(one(req.query?.user) ?? '');
      const kind = String(one(req.query?.kind) ?? '') as StaffActivityKind;
      const day = String(one(req.query?.day) ?? '');
      if (!UUID.test(user) || !STAFF_ACTIVITY_KINDS.includes(kind)) return sendError(res, 400, 'bad_request', 'ข้อมูลไม่ครบ');
      if (day && !DAY.test(day)) return sendError(res, 400, 'bad_request', 'วันที่ไม่ถูกต้อง');
      // คนนอก BU ในสิทธิ์ = ไม่เห็นรายการ
      if (buSet !== null) {
        const { rows } = await dbQuery<{ ok: boolean }>(`select department_code = any($2::text[]) as ok from ${USERS} where id = $1`, [user, [...buSet]]);
        if (!rows[0]?.ok) return res.status(200).json({ items: [] });
      }
      return res.status(200).json({ items: await loadDetail(day || from, day || to, user, kind) });
    }
    return res.status(200).json({ rows: await loadRows(from, to, buSet) });
  } catch (e) {
    return handleApiError(res, e, 'staff-activity', { userId: req.user?.sub });
  }
}

export default withRbac(staffActivityHandler, 'job-applications');
