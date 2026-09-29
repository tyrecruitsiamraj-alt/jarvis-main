/**
 * GET /api/team-online?period=today|week|month|year&bu= — หน้า "ทีม Online" (29 ก.ย. 2569 · อ่านอย่างเดียว)
 *
 * เจ้าของ: *"หน้าหลัก ฉันจะเริ่มแก้ใหม่ … อันนี้ฉันจะเริ่มจากทีม Online"* + ภาพต้นแบบ → Choice
 * "ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน" · นิยาม/ตัวประกอบคำตอบอยู่ `src/lib/teamOnline.ts` ที่เดียว
 *
 * - **คนใช้งาน** = เจ้าหน้าที่ที่ล็อกอินหรือบันทึกงานในช่วงนั้น (ร่องรอยจาก `ACTIVITY_SOURCES`) — ทุก BU เสมอ
 * - **ใบขอเข้า** = สำเนา ERP ก้อนเดียวกับแท็บ Dashboard (`loadRequestTrendPayload`) · วันที่ขอเข้ามา = `requestAddedYmd`
 * - **Lumos** = เลนหน้าสาธารณะ (`app-`) · จัดถังผลด้วย `aiCallSteps` ตัวเดียวกับหน้าหลัก
 * - **Success ประกาศ** = ใบที่ Gen link (ประกาศแรกของใบ) ในช่วง ที่มีผู้สมัคร ≥ 1 (ไม่นับ Lead = เลขบนการ์ดกล่องงาน)
 * - **ต่อ BU** = ทุก BU ตามสิทธิ์ + ใบเปิดตอนนี้จาก feed เดียวกับกล่องงาน (มี Gen link = เทียบสองคีย์ `buildJobKeyIndex`)
 *
 * 🔴 กติกา: BU กลาง = ชุดรหัสแผนก (`parseBuParam`) · ผู้ใช้ถูกล็อกแผนก = BU ของตัวเองเสมอ ·
 * ตัวนับล้วน ไม่คืนข้อมูลบุคคล (`withAuth`) · ก้อนล้มแยกกัน (null + เหตุ — ห้าม 0 ปลอม)
 */
import { withAuth, sendError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { respondServiceError } from '../_lib/domainErrors.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { loadRequestTrendPayload, requestTrendDataFrom } from '../_lib/requestTrendRows.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { queueActive, queueLastResultAt, queueOutcome, queueReplySql } from '../_lib/lumosQueueDefs.js';
import { parseBuParam, queueBuJoins, queueBuSql } from '../_lib/homeBuSql.js';
import { siteBuSql, trendBuSql } from '../_lib/siteBuSql.js';
import { logWarn } from '../_lib/logger.js';
import { requestAddedYmd } from '../../src/lib/trends/requestTrends.js';
import { normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from '../../src/lib/trends/bu.js';
import { jobPositionUnits } from '../../src/lib/jobPositionUnits.js';
import { buildJobKeyIndex } from '../../src/lib/jobKeyIndex.js';
import {
  SQL_BUCKET_FORMAT,
  buildBuRows,
  callsSummary,
  coverageOf,
  isTeamPeriod,
  postingsSummary,
  requestsCount,
  teamOnlineWindow,
  usersCount,
  type RawCallRow,
  type RawOpenJob,
  type RawPostingRow,
  type RawRequestRow,
  type RawUserRow,
  type TeamOnlineResponse,
  type TeamPeriod,
  type TeamWindow,
} from '../../src/lib/teamOnline.js';
import type { JobRequest } from '@/types';

const USERS = tableInAppSchema('users');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const POSTINGS = tableInAppSchema('recruit_postings');
const APPS = tableInAppSchema('public_job_applications');
const MAP = tableInAppSchema('job_site_map');
const AUDIT = tableInAppSchema('audit_logs');

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: TeamOnlineResponse }>();

/** Gen link เกินกี่วันแล้วยังไม่มีผู้สมัคร = งานต้องทำ */
const STALE_POSTING_DAYS = 7;

/**
 * ร่องรอยการใช้งานของเจ้าหน้าที่ — [ตาราง, คอลัมน์ผู้ใช้, คอลัมน์เวลา]
 * ระบบไม่มีบันทึก "เปิดดู" ⇒ นับจากล็อกอิน (`audit_logs`) + งานที่บันทึก (ใครทำ · เมื่อไหร่)
 * 🔴 ห้ามใส่คู่ `updated_by`/`updated_at` ของตารางที่ระบบเขียนเองด้วย (เช่น `follow_entries` ที่ผล Lumos
 *    ขยับ `updated_at`) — เวลาจะเป็นของระบบแต่ชื่อเป็นของคนแก้ล่าสุด ⇒ นับคนที่ไม่ได้ใช้งานจริง
 */
export const ACTIVITY_SOURCES: ReadonlyArray<readonly [table: string, user: string, at: string]> = [
  ['audit_logs', 'user_id', 'created_at'],
  ['application_contact_logs', 'created_by', 'created_at'],
  ['application_appointment_results', 'recorded_by', 'created_at'],
  ['candidate_call_holds', 'held_by_user_id', 'held_at'],
  ['candidate_call_holds', 'held_by_user_id', 'result_at'],
  ['candidate_proposals', 'proposed_by_user_id', 'created_at'],
  ['candidate_screening', 'screened_by_user_id', 'updated_at'],
  ['follow_entries', 'created_by', 'created_at'],
  ['follow_entries', 'completed_by', 'completed_at'],
  ['job_posting_requests', 'requested_by_user_id', 'created_at'],
  ['job_public_releases', 'released_by', 'released_at'],
  ['recruit_postings', 'created_by_user_id', 'created_at'],
  ['selection_progress', 'updated_by', 'updated_at'],
  ['short_links', 'created_by', 'created_at'],
  ['siamraj_unit_assignments', 'updated_by_user_id', 'updated_at'],
  ['siamraj_unit_notes', 'updated_by_user_id', 'updated_at'],
  ['siamraj_unit_work_status_history', 'updated_by_user_id', 'created_at'],
  ['public_job_applications', 'claimed_by', 'claimed_at'],
  ['public_job_applications', 'lead_by', 'lead_at'],
  ['lumos_call_batches', 'created_by_user_id', 'created_at'],
];

/**
 * คนไม่ซ้ำต่อช่วงย่อยของสองช่วง — พารามิเตอร์ `[prevStart, prevEnd, รูปแบบช่วงย่อย, start, now]`
 * (export ไว้ให้เทสต์อ่านโครงคิวรี)
 */
export function usersSql(): string {
  const union = ACTIVITY_SOURCES.map(
    ([t, u, at]) =>
      `select ${u} as uid, ${at} as at from ${tableInAppSchema(t)}
        where ${u} is not null and ${at} >= $1::timestamptz and ${at} < $5::timestamptz`,
  ).join('\n       union all ');
  return `with ev as (
       ${union}
     )
     select distinct ev.uid::text as uid,
            to_char(timezone('Asia/Bangkok', ev.at), $3) as bucket,
            (ev.at >= $4::timestamptz) as cur
       from ev
       join ${USERS} u on u.id = ev.uid
      where (ev.at >= $1::timestamptz and ev.at < $2::timestamptz)
         or (ev.at >= $4::timestamptz and ev.at < $5::timestamptz)`;
}

/** แถวคิวเลนหน้าสาธารณะที่มีผล (ไม่นับยกเลิก) ตั้งแต่ `$1` — BU ติดมากับแถว (ตัวเดียวกับยอดส่ง Lumos) */
export function callsSql(): string {
  const last = queueLastResultAt('q');
  return `select coalesce(nullif(btrim(q_ba.phone_e164), ''), nullif(btrim(q.payload->>'phone'), ''), 'q:' || q.id::text) as who,
         ${queueBuSql('q')} as bu,
         q.person_ref, ${queueOutcome('q')} as outcome,
         q.result->>'summary' as summary, ${queueReplySql('q')} as reply,
         q.first_result_at as first_at, ${last} as last_at
    from ${QUEUE} q
    ${queueBuJoins('q')}
   where q.person_ref like 'app-%' and q.job_ref <> 'follow'
     and ${queueActive('q')}
     and ${queueOutcome('q')} is not null
     and (${last} >= $1::timestamptz or q.first_result_at >= $1::timestamptz)`;
}

/**
 * ใบที่ Gen link แล้วทั้งหมด (ประกาศแรกของใบ) + ผู้สมัครของใบ — ชุดเล็ก (หลักสิบใบ) โหลดทั้งก้อน
 * BU = ไซต์ของใบขอ (`job_site_map`) → แผนกบนประกาศ (ทางถอย) · ผู้สมัคร = ไม่นับ Lead (ตัวเดียวกับการ์ดกล่องงาน)
 */
export function postingsSql(): string {
  return `with fp as (
      select p.job_id, min(p.created_at) as first_at,
             (array_agg(nullif(btrim(p.department_code), '') order by p.created_at))[1] as dept
        from ${POSTINGS} p
       where p.job_id is not null and btrim(p.job_id) <> ''
       group by p.job_id
    )
    select fp.job_id, fp.first_at,
           ${trendBuSql(`coalesce(${siteBuSql('m.site_code')}, fp.dept)`)} as bu,
           (select count(*)::int from ${APPS} a
             where a.job_id = fp.job_id and not coalesce(a.is_lead, false)) as applicants
      from fp
      left join ${MAP} m on m.job_id = fp.job_id`;
}

const addDaysYmd = (ymd: string, days: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const isoOf = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

async function loadUsers(w: TeamWindow) {
  const [rows, since] = await Promise.all([
    dbQuery<RawUserRow>(usersSql(), [w.prevStart, w.prevEnd, SQL_BUCKET_FORMAT[w.grain], w.start, w.now]),
    dbQuery<{ at: Date | string | null }>(`select min(created_at) as at from ${AUDIT}`),
  ]);
  return { ...usersCount(w, rows.rows), coverage: coverageOf(w, isoOf(since.rows[0]?.at)) };
}

async function loadRequests() {
  const today = toBangkokYmd(new Date());
  // ปลายช่วง = วันนี้ + 183 วัน (ใบล่วงหน้า) — ก้อนเดียวกับแท็บ Dashboard/หน้าหลัก ⇒ ไม่ยิง ERP เพิ่ม
  const payload = await loadRequestTrendPayload(requestTrendDataFrom(today), addDaysYmd(today, 183), () => true);
  const rows: RawRequestRow[] = payload.requests.map((r) => ({
    requestNo: r.requestNo,
    day: requestAddedYmd(r),
    bu: r.departmentCode ? normalizeTrendBu(r.departmentCode) : null,
  }));
  return { rows, since: `${payload.range.from}T00:00:00+07:00`, stale: payload.source === 'stale' };
}

async function loadCalls(w: TeamWindow) {
  const [rows, since] = await Promise.all([
    dbQuery<{
      who: string;
      bu: string | null;
      person_ref: string;
      outcome: string | null;
      summary: string | null;
      reply: string | null;
      first_at: Date | string | null;
      last_at: Date | string | null;
    }>(callsSql(), [w.prevStart]),
    dbQuery<{ at: Date | string | null }>(`select min(first_result_at) as at from ${QUEUE} where person_ref like 'app-%'`),
  ]);
  const out: RawCallRow[] = rows.rows.map((r) => ({
    who: r.who,
    bu: r.bu,
    personRef: r.person_ref,
    outcome: r.outcome,
    summary: r.summary,
    reply: r.reply,
    firstAt: isoOf(r.first_at),
    lastAt: isoOf(r.last_at),
  }));
  return { rows: out, since: isoOf(since.rows[0]?.at) };
}

async function loadPostings() {
  const { rows } = await dbQuery<{ job_id: string; first_at: Date | string; bu: string | null; applicants: number }>(
    postingsSql(),
  );
  const out: RawPostingRow[] = [];
  for (const r of rows) {
    const firstAt = isoOf(r.first_at);
    if (firstAt) out.push({ jobId: r.job_id, firstAt, bu: r.bu, applicants: Number(r.applicants) || 0 });
  }
  const since = out.reduce<string | null>((m, r) => (!m || r.firstAt < m ? r.firstAt : m), null);
  return { rows: out, since };
}

/** ใบเปิดตอนนี้ (feed เดียวกับกล่องงาน) + มี Gen link ไหม + Gen link นานแล้วยังไม่มีผู้สมัครไหม */
const jobBu = (j: { site_code?: unknown }) => trendBuFromSiteCode(String(j.site_code ?? ''));

function openJobsOf(feed: readonly JobRequest[], postings: readonly RawPostingRow[], now: Date): RawOpenJob[] {
  const idx = buildJobKeyIndex(postings.map((p) => [p.jobId, p] as const));
  const staleBefore = now.getTime() - STALE_POSTING_DAYS * 86_400_000;
  return feed.map((j) => {
    const p = idx.get(String(j.id));
    return {
      id: String(j.id),
      bu: jobBu(j),
      positions: jobPositionUnits(j),
      hasLink: !!p,
      staleNoApplicants: !!p && p.applicants === 0 && Date.parse(p.firstAt) < staleBefore,
    };
  });
}

const settle = <T,>(p: Promise<T>) =>
  p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );

const why = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function buildTeamOnline(
  period: TeamPeriod,
  scope: DepartmentScope,
  bu: string | null,
  now = new Date(),
): Promise<TeamOnlineResponse> {
  const w = teamOnlineWindow(period, now);
  const forcedBu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : null;
  const body: TeamOnlineResponse = {
    generated_at: now.toISOString(),
    period,
    scope: scope.mode,
    forced_bu: forcedBu,
    bu,
    window: w,
    bu_options: [],
    users: null,
    requestsIn: null,
    lumos: null,
    postings: null,
    byBu: null,
    errors: {},
  };
  if (scope.mode === 'none') {
    const msg = 'บัญชีนี้ยังไม่ได้ผูกแผนก — ยังดูตัวเลขไม่ได้';
    body.errors = { users: msg, requestsIn: msg, lumos: msg, postings: msg, byBu: msg };
    return body;
  }

  const [usersR, reqR, callsR, postR, feedR] = await Promise.all([
    settle(loadUsers(w)),
    settle(loadRequests()),
    settle(loadCalls(w)),
    settle(loadPostings()),
    settle(listSiamrajUnitRequests({ limit: 500, departmentScope: scope }) as Promise<JobRequest[]>),
  ]);

  // ผู้ใช้ถูกล็อกแผนก = เห็นแค่ BU ตัวเอง ทุกก้อน (ต่อ BU ก็แถวเดียว) · ไม่ล็อก = ทุก BU
  const inScope = (b: string | null) => !forcedBu || b === forcedBu;
  const inPage = (b: string | null) => inScope(b) && (!bu || b === bu);

  if (usersR.ok) body.users = usersR.v;
  else body.errors.users = 'อ่านการใช้งานของเจ้าหน้าที่ไม่ได้';

  const requests = reqR.ok ? reqR.v.rows.filter((r) => inScope(r.bu)) : null;
  if (reqR.ok && requests) {
    body.requestsIn = {
      ...requestsCount(w, requests.filter((r) => inPage(r.bu))),
      dateOnly: true,
      coverage: coverageOf(w, reqR.v.since),
      stale: reqR.v.stale,
    };
  } else body.errors.requestsIn = 'อ่านใบขอจาก ERP ไม่ได้ตอนนี้';

  const calls = callsR.ok ? callsR.v.rows.filter((r) => inScope(r.bu)) : null;
  if (callsR.ok && calls) {
    body.lumos = { ...callsSummary(w, calls.filter((r) => inPage(r.bu))), coverage: coverageOf(w, callsR.v.since) };
  } else body.errors.lumos = 'อ่านคิวโทร Lumos ไม่ได้';

  const postings = postR.ok ? postR.v.rows.filter((r) => inScope(r.bu)) : null;
  if (postR.ok && postings) {
    body.postings = {
      ...postingsSummary(w, postings.filter((r) => inPage(r.bu))),
      coverage: coverageOf(w, postR.v.since),
    };
  } else body.errors.postings = 'อ่านตารางประกาศ/Gen link ไม่ได้';

  if (postR.ok && postings && feedR.ok) {
    const openJobs = openJobsOf(feedR.v, postR.v.rows, now).filter((j) => inScope(j.bu));
    const labelOf = (b: string) => (b ? trendBuLabel(b) : 'ไม่ระบุ BU');
    body.byBu = buildBuRows(w, { labelOf, requests, postings, calls, openJobs });
    body.bu_options = body.byBu
      .filter((r) => r.bu !== '')
      .map((r) => ({ bu: r.bu, label: r.label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'th'));
  } else body.errors.byBu = feedR.ok ? 'อ่านตารางประกาศ/Gen link ไม่ได้' : 'อ่านใบขอที่เปิดอยู่ไม่ได้';

  for (const [k, r] of [
    ['users', usersR],
    ['requestsIn', reqR],
    ['lumos', callsR],
    ['postings', postR],
    ['feed', feedR],
  ] as const) {
    if (!r.ok) logWarn(`team-online: ก้อน ${k} อ่านไม่ได้`, { reason: why(r.e) });
  }
  return body;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    return sendError(res, 405, 'Method not allowed', 'Read-only');
  }
  try {
    const rawPeriod = typeof req.query?.period === 'string' ? req.query.period : 'today';
    const period: TeamPeriod = isTeamPeriod(rawPeriod) ? rawPeriod : 'today';
    const scope: DepartmentScope = await loadMatchingBuScope(req.user);
    const bu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : parseBuParam(req.query?.bu);
    const cacheKey = JSON.stringify([scope, period, bu]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const body = await buildTeamOnline(period, scope, bu);
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'team-online GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
