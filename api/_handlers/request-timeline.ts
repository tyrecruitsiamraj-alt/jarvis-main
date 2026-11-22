/**
 * GET /api/request-timeline?jobs=<id ใบขอเต็ม>,<id>,...(คั่นด้วยจุลภาค ไม่เกิน 30 ใบ)&events=1 — ใบขอทำอะไรไปแล้ว (แท็บ Scale ลง · เจ้าของ 20 พ.ย. 2569)
 * ผู้บริหารถามย้อนกลับ: ใบที่ปิดได้ ปิดเพราะทำอะไร · ใบที่ยกเลิก ทำอะไรไปแล้วบ้าง · ตั้งแต่ขอถึงวันนี้ ใครทำอะไรวันไหน
 * id ใบขอ = คีย์เต็ม `siamraj-sql:<เลขที่ใบ>` หรือ `siamraj-pre:<เลขที่ใบ>` (ใบขอชั่วคราว) — ได้จาก `jobId` ของ `/api/recruit-stuck`
 * ต่อใบ (นับทุกช่วงเวลาของใบ ไม่ขึ้นกับช่วงวันที่): `done.work` = Gen link · โพสต์แล้ว · Autopost · Scrap · ลงผลติดต่อ · ลงนัด
 *   `done.chain` = รายชื่อ → AI โทรแล้ว → AI สนใจ → คนโทรต่อ ติดต่อได้ → นัดได้ → มา → แจ้งเข้า (ตัวนับเดียวกับแท็บ Scale ลง)
 * `events=1` = เหตุการณ์ไล่ตามวัน (วันไทย · ชนิด · ใครทำ · ช่องทาง/ผล · จำนวน) — ไม่มีชื่อ/เบอร์ผู้สมัคร
 * อ่านอย่างเดียว · สิทธิ์เดียวกับภาพรวม (`job-applications`) · ใบนอก BU ที่ผู้ถามเห็น = null
 * BU ของใบ = ไซต์ของใบขอ (`job_site_map`) › BU ของประกาศ › สมุดใบขอ ERP (ใบขอชั่วคราวที่ยังไม่มีประกาศ — ฝั่งเราไม่ได้เก็บ BU) · ไม่รู้ BU = ไม่เห็น
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope, loadUserDepartmentScope } from '../_lib/departmentScope.js';
import { inBuSet, pickDashboardBuSet } from '../_lib/homeBuSql.js';
import { siteBuSql, trendBuSql } from '../_lib/siteBuSql.js';
import { loadPenaltyLedgerRaw } from '../_lib/siamrajPenaltyLedgerSql.js';
import { logError } from '../_lib/logger.js';
import { ledgerJobIdOf } from '../../src/lib/requestPenaltyLedger.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import { STAFF_NAME_SQL } from '../_lib/staffNameSql.js';
import { CHANNEL_SQL, CONTACT_RESULT_SQL, LINK_OWNER, SCRAP_OUTCOME_LABEL, bkk } from './staff-activity.js';
import { loadFactsForJobs } from './recruit-overview.js';
import { scrapOutcomeOf } from '../../src/lib/jobPostActions.js';
import { ATTENDANCE_LABEL, isAttendanceResult } from '../../src/lib/appointmentAttendance.js';
import { aiAnswerOf, aiStage, buildRecruitJourney } from '../../src/lib/recruitJourney.js';
import { bkkDayOf, scaleChain, scaleChannelOf } from '../../src/lib/overviewScale.js';
import type { RecruitAppFact } from '../../src/lib/recruitOverviewTypes.js';
import {
  REQUEST_TIMELINE_MAX,
  emptyRequestWork,
  mergeRequestEvents,
  type RequestEvent,
  type RequestEventKind,
  type RequestTimelineJob,
  type RequestTimelineResponse,
  type RequestWork,
} from '../../src/lib/requestTimeline.js';

const USERS = tableInAppSchema('users');
const ORDERS = tableInAppSchema('job_posting_requests');
const LINKS = tableInAppSchema('recruit_posting_links');
const LINK_POSTS = tableInAppSchema('recruit_posting_link_posts');
const POSTINGS = tableInAppSchema('recruit_postings');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTEND = tableInAppSchema('application_appointment_results');
const APPS = tableInAppSchema('public_job_applications');
const SITE_MAP = tableInAppSchema('job_site_map');

const JOB_ID = /^siamraj-(sql|pre):[^,]{1,60}$/;
const day = (col: string) => `to_char(${bkk(col)}, 'YYYY-MM-DD')`;
const who = (raw: string) => STAFF_NAME_SQL('u', raw);

/**
 * SQL เหตุการณ์ของใบ (อ่านอย่างเดียว) · $1 = id ใบขอ (text[]) — แยกออกมาให้ตรวจกับฐานจริงในธุรกรรมอ่านอย่างเดียวได้
 * งาน 4 ชนิด + ลงผลติดต่อ = แหล่งเดียวกับ `/api/staff-activity` (ลิงก์เป็นงานของผู้รับผิดชอบ `LINK_OWNER` · ผลติดต่อ `CONTACT_RESULT_SQL`)
 * `extra` = ในนั้นลงวันนัดกี่ครั้ง (เฉพาะแถวลงผลติดต่อ)
 */
export function requestEventsSql(): string {
  return `select e.job_id, e.day, e.kind, e.who, e.detail, e.n, e.extra from (
       select p.job_id, ${day('l.created_at')} as day, 'links'::text as kind, ${who('l.created_by_name')} as who, ${CHANNEL_SQL} as detail, count(*)::int as n, 0 as extra
         from ${LINKS} l join ${POSTINGS} p on p.id = l.posting_id left join ${USERS} u on u.id = ${LINK_OWNER}
        where p.job_id = any($1::text[]) group by 1, 2, 4, 5
       union all
       select p.job_id, to_char(x.day, 'YYYY-MM-DD'), 'manualPosted', ${who('x.posted_by_name')}, ${CHANNEL_SQL}, count(*)::int, 0
         from ${LINK_POSTS} x join ${LINKS} l on l.id = x.link_id join ${POSTINGS} p on p.id = l.posting_id left join ${USERS} u on u.id = x.posted_by_user_id
        where p.job_id = any($1::text[]) group by 1, 2, 4, 5
       union all
       select o.job_id, ${day('o.created_at')}, case when o.request_type = 'scraping' then 'scrap' else 'autopost' end, ${who('o.requested_by_name')}, o.status, count(*)::int, 0
         from ${ORDERS} o left join ${USERS} u on u.id = o.requested_by_user_id
        where o.job_id = any($1::text[]) and o.request_type in ('content', 'scraping') group by 1, 2, 3, 4, 5
       union all
       select a.job_id, ${day('c.created_at')}, 'contacts', ${who('c.created_by_name')}, ${CONTACT_RESULT_SQL}, count(*)::int, (count(*) filter (where c.appointment_at is not null))::int
         from ${CONTACTS} c join ${APPS} a on a.id = c.application_id left join ${USERS} u on u.id = c.created_by
        where a.job_id = any($1::text[]) group by 1, 2, 4, 5
       union all
       select a.job_id, ${day('r.created_at')}, 'attendance', ${who('r.recorded_by_name')}, r.result, count(*)::int, 0
         from ${ATTEND} r join ${APPS} a on a.id = r.application_id left join ${USERS} u on u.id = r.recorded_by
        where a.job_id = any($1::text[]) group by 1, 2, 4, 5
     ) e`;
}

/**
 * SQL ใบที่อยู่ใน BU ที่ผู้ถามเห็น · $1 = id ใบ · $2 = ชุด BU
 * BU ของใบ = ไซต์ของใบขอ (`job_site_map` ตัวเดียวกับหน้าหลัก) › BU ของประกาศของใบ (ใบขอชั่วคราวไม่มีรหัสไซต์)
 * ตรวจกับฐานจริง 21 พ.ย. 2569: ใบขอจริง 398/398 ได้ BU จากไซต์ ตรงกับ ERP ทุกใบ · ใบขอชั่วคราว 16/20 ได้จากประกาศ ตรงกับ ERP ทุกใบ
 */
export function requestVisibleSql(): string {
  return `with j as (
       select t.job_id,
              coalesce(
                (select ${siteBuSql('m.site_code')} from ${SITE_MAP} m where m.job_id = t.job_id),
                (select nullif(btrim(p.department_code), '') from ${POSTINGS} p
                  where p.job_id = t.job_id and nullif(btrim(p.department_code), '') is not null order by p.created_at limit 1)
              ) as code
         from unnest($1::text[]) as t(job_id)
     )
     select j.job_id from j where ${trendBuSql('j.code')} = any($2::text[])`;
}

/**
 * ใบที่ผู้ถามเห็น — `buSet` null = เห็นทุก BU (ไม่ต้องถาม) · ว่าง = ไม่เห็นเลย
 * ใบที่ฝั่งเราไม่รู้ BU (ใบขอชั่วคราวที่ยังไม่มีประกาศ) ถามสมุดใบขอ ERP ที่กรองตามสิทธิ์ของผู้ถามแล้ว (มีแคช) — อ่านไม่ได้ = ถือว่าไม่เห็น
 */
async function visibleJobs(ids: readonly string[], buSet: readonly string[] | null, user: AuthedReq['user']): Promise<string[]> {
  if (buSet === null) return [...ids];
  if (buSet.length === 0) return [];
  const seen = new Set((await dbQuery<{ job_id: string }>(requestVisibleSql(), [ids, [...buSet]])).rows.map((r) => r.job_id));
  if (ids.some((id) => !seen.has(id))) {
    try {
      const ledger = await loadPenaltyLedgerRaw(await loadUserDepartmentScope(user));
      for (const r of ledger.rows) if (inBuSet(normalizeTrendBu(r.bu), buSet)) seen.add(ledgerJobIdOf(r));
    } catch (e) {
      logError('request-timeline: อ่าน BU ของใบขอจากสมุดใบขอไม่ได้', e);
    }
  }
  return ids.filter((id) => seen.has(id));
}

type EventRow = { job_id: string; day: string; kind: string; who: string | null; detail: string | null; n: number; extra: number };
const WORK_KINDS: readonly RequestEventKind[] = ['links', 'manualPosted', 'autopost', 'scrap', 'contacts'];
/** คำตอบกับ AI — คำเดียวกับขั้น "AI โทรแล้ว" ของภาพรวม */
const AI_LABEL = new Map((buildRecruitJourney([]).find((s) => s.key === 'ai')?.parts ?? []).map((p) => [p.key, p.label]));

/** แถวจากฐาน + ใบสมัครของใบ → คำตอบต่อใบ (ไม่แตะฐาน) */
export function shapeRequestTimeline(ids: readonly string[], rows: readonly EventRow[], facts: readonly RecruitAppFact[], withEvents: boolean): Record<string, RequestTimelineJob> {
  const out: Record<string, RequestTimelineJob> = {};
  for (const id of ids) {
    const work: RequestWork = emptyRequestWork();
    const events: RequestEvent[] = [];
    for (const r of rows) {
      if (r.job_id !== id) continue;
      const kind = r.kind as RequestEventKind;
      const n = Number(r.n) || 0;
      if (WORK_KINDS.includes(kind)) work[kind as keyof RequestWork] += n;
      if (kind === 'contacts') work.appts += Number(r.extra) || 0;
      const detail =
        kind === 'autopost' || kind === 'scrap' ? SCRAP_OUTCOME_LABEL[scrapOutcomeOf(r.detail ?? '')] : kind === 'attendance' ? (isAttendanceResult(r.detail) ? ATTENDANCE_LABEL[r.detail] : null) : r.detail?.trim() || null;
      events.push({ day: r.day, kind, who: r.who?.trim() || null, detail, n });
    }
    const mine = facts.filter((f) => f.jobId === id);
    if (withEvents) {
      const add = (kind: RequestEventKind, d: string | null | undefined, actor: string | null, detail: string | null) => {
        if (d) events.push({ day: d, kind, who: actor, detail, n: 1 });
      };
      for (const f of mine) {
        add('names', bkkDayOf(f.createdAt), null, scaleChannelOf(f));
        if (aiStage(f) === 'called' && f.aiAnswerAt) add('ai', bkkDayOf(f.aiAnswerAt), 'AI', AI_LABEL.get(aiAnswerOf(f)) ?? null);
        if (f.informed === true) add('informed', f.informedAt, null, null);
      }
    }
    out[id] = { done: { work, chain: scaleChain(mine).map((c) => c.value) }, events: withEvents ? mergeRequestEvents(events) : null };
  }
  return out;
}

export async function requestTimelineHandler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') return sendError(res, 405, 'Method not allowed');
  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  // หลายใบ = ค่าเดียวคั่นด้วยจุลภาค (ตัวอ่าน query ของ server เก็บค่าสุดท้ายของคีย์ที่ซ้ำ — ส่ง job= ซ้ำหลายตัวไม่ได้)
  const ids = [...new Set(String(one(req.query?.jobs) ?? '').split(',').map((v) => v.trim()).filter(Boolean))];
  if (ids.length === 0 || ids.length > REQUEST_TIMELINE_MAX || ids.some((id) => !JOB_ID.test(id))) return sendError(res, 400, 'bad_request', 'ใบขอไม่ถูกต้อง');
  const withEvents = String(one(req.query?.events) ?? '') === '1';
  try {
    const scope = await loadMatchingBuScope(req.user);
    const { buSet } = pickDashboardBuSet(scope, null);
    res.setHeader?.('Cache-Control', 'no-store');
    const visible = await visibleJobs(ids, buSet, req.user);
    const jobs: RequestTimelineResponse['jobs'] = Object.fromEntries(ids.map((id) => [id, null]));
    if (visible.length) {
      const [events, facts] = await Promise.all([dbQuery<EventRow>(requestEventsSql(), [visible]), loadFactsForJobs(visible, null)]);
      Object.assign(jobs, shapeRequestTimeline(visible, events.rows, facts, withEvents));
    }
    return res.status(200).json({ jobs } satisfies RequestTimelineResponse);
  } catch (e) {
    return handleApiError(res, e, 'request-timeline', { userId: req.user?.sub });
  }
}

export default withRbac(requestTimelineHandler, 'job-applications');
