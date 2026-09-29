/**
 * GET /api/team-online?from=&to=&grain=&compare=&bu= — หน้า "ทีม Online" (29 ก.ย. 2569 · อ่านอย่างเดียว)
 *
 * รอบ 1: เจ้าของส่งภาพต้นแบบ → "ทำตามภาพด้วยข้อมูลจริง ดูหลังสวิตช์ก่อน"
 * รอบ 2: ช่วงเวลาเป็นปฏิทินแบบแท็บ Dashboard + เทียบ BU (คนใช้งาน % ของบัญชี · อัตราที่ขอเข้า · Lumos ทุกเลน)
 * + ติดตรงไหนต่อ BU · นิยาม/ตัวประกอบคำตอบอยู่ `src/lib/teamOnline.ts` ที่เดียว
 *
 * - **คนใช้งาน** = คนไม่ซ้ำที่ล็อกอินหรือบันทึกงาน (`ACTIVITY_SOURCES`) · BU = แผนกบนบัญชี · ฐาน % = บัญชีของ BU นั้น
 * - **ใบขอเข้า (อัตรา)** = สำเนา ERP ก้อนเดียวกับ Dashboard · วันที่ขอเข้ามา = `requestAddedYmd`
 * - **Lumos** = ทุกเลน (`queueLane`) · กลุ่มตามวันที่เข้าคิว · จัดสายด้วย `classifyQueueRow` (ตัวเดียวกับ Success Rate ของ Dashboard)
 * - **Success ประกาศ** = ใบที่ Gen link ครั้งแรกในช่วง ที่มีผู้สมัคร ≥ 1 (ไม่นับ Lead = เลขบนการ์ดกล่องงาน)
 * - **ติดตรงไหน** = ใบขอ ERP ที่เข้ามาในช่วง → Gen link → มีผู้สมัคร → AI โทร → สนใจ → นัด → มาตามนัด
 * - **ใบเปิดตอนนี้** = feed เดียวกับกล่องงาน (มี Gen link = เทียบสองคีย์ `buildJobKeyIndex`)
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
import { PREQUEST_ID_PREFIX } from '../_lib/siamrajSqlServerPrequests.js';
import { loadRequestTrendPayload, requestTrendDataFrom } from '../_lib/requestTrendRows.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { queueCancelled, queueOutcome, queueReplySql } from '../_lib/lumosQueueDefs.js';
import { parseBuParam, queueBuJoins, queueBuSql } from '../_lib/homeBuSql.js';
import { siteBuSql, trendBuSql } from '../_lib/siteBuSql.js';
import { logWarn } from '../_lib/logger.js';
import { requestAddedYmd } from '../../src/lib/trends/requestTrends.js';
import { addDays } from '../../src/lib/trends/timeBuckets.js';
import { normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from '../../src/lib/trends/bu.js';
import { jobPositionUnits } from '../../src/lib/jobPositionUnits.js';
import { buildJobKeyIndex, requestNoOf } from '../../src/lib/jobKeyIndex.js';
import { queueLane } from '../../src/lib/officeTeam.js';
import {
  buildBuRows,
  classifyQueueRow,
  coverageOf,
  funnelRows,
  lumosSummary,
  makeLocator,
  postingsSummary,
  requestsSummary,
  teamWindow,
  usersSummary,
  type RawAccount,
  type RawActivity,
  type RawFunnelRequest,
  type RawOpenJob,
  type RawPostingRow,
  type RawQueueRow,
  type RawRequestRow,
  type TeamOnlineResponse,
  type TeamWindow,
} from '../../src/lib/teamOnline.js';
import type { JobRequest } from '@/types';

const USERS = tableInAppSchema('users');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const POSTINGS = tableInAppSchema('recruit_postings');
const APPS = tableInAppSchema('public_job_applications');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTEND = tableInAppSchema('application_appointment_results');
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

const bkkYmd = (col: string) => `to_char(timezone('Asia/Bangkok', ${col}), 'YYYY-MM-DD')`;

/** คนไม่ซ้ำต่อวันไทย ใน [$1, $2) — export ไว้ให้เทสต์อ่านโครงคิวรี */
export function usersSql(): string {
  const union = ACTIVITY_SOURCES.map(
    ([t, u, at]) =>
      `select ${u} as uid, ${at} as at from ${tableInAppSchema(t)}
        where ${u} is not null and ${at} >= $1::timestamptz and ${at} < $2::timestamptz`,
  ).join('\n       union all ');
  return `with ev as (
       ${union}
     )
     select distinct ev.uid::text as uid, ${bkkYmd('ev.at')} as ymd
       from ev
       join ${USERS} u on u.id = ev.uid`;
}

/** บัญชีทุกบัญชี (ฐานของ % คนใช้งาน) — แผนก · บทบาท · เปิดใช้อยู่ไหม · วันที่สร้าง */
export function accountsSql(): string {
  return `select u.id::text as id, coalesce(nullif(btrim(u.department_code), ''), '') as dept, u.role,
                 coalesce(u.is_active, false) as active, ${bkkYmd('u.created_at')} as created_ymd
            from ${USERS} u`;
}

/** แถวคิวทุกเลนที่เข้าคิวใน [$1, $2) — ผล/ยกเลิก/คำตอบในสาย ตัวกลาง `lumosQueueDefs` · BU ตัวเดียวกับยอดส่ง Lumos */
export function queueSql(): string {
  return `select ${bkkYmd('q.created_at')} as ymd,
         ${queueBuSql('q')} as bu,
         q.job_ref, q.person_ref,
         ${queueCancelled('q')} as cancelled,
         ${queueOutcome('q')} as outcome,
         q.result->>'summary' as summary, ${queueReplySql('q')} as reply
    from ${QUEUE} q
    ${queueBuJoins('q')}
   where q.created_at >= $1::timestamptz and q.created_at < $2::timestamptz`;
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
    select fp.job_id, ${bkkYmd('fp.first_at')} as ymd,
           ${trendBuSql(`coalesce(${siteBuSql('m.site_code')}, fp.dept)`)} as bu,
           (select count(*)::int from ${APPS} a
             where a.job_id = fp.job_id and not coalesce(a.is_lead, false)) as applicants
      from fp
      left join ${MAP} m on m.job_id = fp.job_id`;
}

/** ติดตรงไหน — ต่อใบ (job_id ฝั่งเรา): มีผู้สมัคร · มีนัด · มาตามนัด (ไม่นับ Lead ทุกขั้น) */
export function funnelJobsSql(): string {
  return `select a.job_id,
         count(*)::int as applicants,
         count(*) filter (where exists (
           select 1 from ${CONTACTS} c where c.application_id = a.id and c.appointment_at is not null))::int as appointed,
         count(*) filter (where exists (
           select 1 from ${ATTEND} r where r.application_id = a.id and r.result = 'showed'))::int as showed
    from ${APPS} a
   where a.job_id is not null and not coalesce(a.is_lead, false)
   group by a.job_id`;
}

/**
 * ติดตรงไหน — สายของผู้สมัครแต่ละใบ (เลนหน้าสาธารณะ) ให้จัดถัง "AI โทรแล้ว / มีคนสนใจ" ด้วยตัวกลาง
 * + นัดที่ Lumos ยืนยันแล้ว (ช่องทางสัมภาษณ์ ผล `confirmed`) — นัดส่วนใหญ่ของระบบอยู่ตรงนี้ ไม่ใช่บันทึกติดต่อของเจ้าหน้าที่
 */
export function funnelCallsSql(): string {
  return `select a.job_id, q.person_ref, q.channel, ${queueCancelled('q')} as cancelled, ${queueOutcome('q')} as outcome,
         q.result->>'summary' as summary, ${queueReplySql('q')} as reply
    from ${QUEUE} q
    join ${APPS} a on q.person_ref = 'app-' || a.id::text
   where not coalesce(a.is_lead, false) and a.job_id is not null`;
}

const startOf = (ymd: string) => `${ymd}T00:00:00+07:00`;

async function sinceYmd(sql: string): Promise<string | null> {
  const { rows } = await dbQuery<{ ymd: string | null }>(sql);
  return rows[0]?.ymd ?? null;
}

async function loadActivity(w: TeamWindow) {
  const [act, acc, since] = await Promise.all([
    dbQuery<RawActivity>(usersSql(), [startOf(w.fetchFrom), startOf(addDays(w.fetchTo, 1))]),
    dbQuery<{ id: string; dept: string; role: string; active: boolean; created_ymd: string | null }>(accountsSql()),
    sinceYmd(`select ${bkkYmd('min(created_at)')} as ymd from ${AUDIT}`),
  ]);
  const accounts: RawAccount[] = acc.rows.map((r) => ({
    id: r.id,
    bu: r.dept ? (normalizeTrendBu(r.dept) ?? '') : '',
    role: r.role,
    active: !!r.active,
    createdYmd: r.created_ymd,
  }));
  return { activity: act.rows, accounts, since };
}

async function loadRequests() {
  const today = toBangkokYmd(new Date());
  // ปลายช่วง = วันนี้ + 183 วัน (ใบล่วงหน้า) — ก้อนเดียวกับแท็บ Dashboard/หน้าหลัก ⇒ ไม่ยิง ERP เพิ่ม
  const payload = await loadRequestTrendPayload(requestTrendDataFrom(today), addDays(today, 183), () => true);
  const rows: RawRequestRow[] = payload.requests.map((r) => ({
    requestNo: r.requestNo,
    ymd: requestAddedYmd(r),
    bu: r.departmentCode ? normalizeTrendBu(r.departmentCode) : null,
    positions: Number(r.positions) || 0,
  }));
  return { rows, since: payload.range.from, stale: payload.source === 'stale', ageSeconds: payload.ageSeconds };
}

async function loadQueue(w: TeamWindow) {
  const [q, since] = await Promise.all([
    dbQuery<{
      ymd: string | null;
      bu: string | null;
      job_ref: string | null;
      person_ref: string | null;
      cancelled: boolean;
      outcome: string | null;
      summary: string | null;
      reply: string | null;
    }>(queueSql(), [startOf(w.fetchFrom), startOf(addDays(w.fetchTo, 1))]),
    sinceYmd(`select ${bkkYmd('min(created_at)')} as ymd from ${QUEUE}`),
  ]);
  const rows: RawQueueRow[] = q.rows.map((r) => ({
    ymd: r.ymd,
    bu: r.bu,
    lane: queueLane(r.person_ref ?? '', r.job_ref ?? ''),
    cancelled: !!r.cancelled,
    outcome: r.outcome,
    summary: r.summary,
    reply: r.reply,
    personRef: r.person_ref ?? '',
  }));
  return { rows, since };
}

async function loadPostings() {
  const { rows } = await dbQuery<{ job_id: string; ymd: string | null; bu: string | null; applicants: number }>(postingsSql());
  const out: RawPostingRow[] = [];
  for (const r of rows) {
    if (r.ymd) out.push({ jobId: r.job_id, ymd: r.ymd, bu: r.bu, applicants: Number(r.applicants) || 0 });
  }
  const since = out.reduce<string | null>((m, r) => (!m || r.ymd < m ? r.ymd : m), null);
  return { rows: out, since };
}

type FunnelJob = { applicants: boolean; aiCalled: boolean; interested: boolean; appointed: boolean; showed: boolean };

async function loadFunnelJobs(): Promise<{ byJob: Map<string, FunnelJob>; showedRecorded: boolean }> {
  const [jobs, calls, showedAny] = await Promise.all([
    dbQuery<{ job_id: string; applicants: number; appointed: number; showed: number }>(funnelJobsSql()),
    dbQuery<{
      job_id: string;
      person_ref: string;
      channel: string | null;
      cancelled: boolean;
      outcome: string | null;
      summary: string | null;
      reply: string | null;
    }>(funnelCallsSql()),
    dbQuery<{ has: boolean }>(`select exists(select 1 from ${ATTEND} where result = 'showed') as has`),
  ]);
  const byJob = new Map<string, FunnelJob>();
  const jobOf = (id: string): FunnelJob => {
    let j = byJob.get(id);
    if (!j) {
      j = { applicants: false, aiCalled: false, interested: false, appointed: false, showed: false };
      byJob.set(id, j);
    }
    return j;
  };
  for (const r of jobs.rows) {
    const j = jobOf(r.job_id);
    j.applicants = Number(r.applicants) > 0;
    j.appointed = Number(r.appointed) > 0;
    j.showed = Number(r.showed) > 0;
  }
  for (const r of calls.rows) {
    const c = classifyQueueRow({
      ymd: null,
      bu: null,
      lane: 'public',
      cancelled: !!r.cancelled,
      outcome: r.outcome,
      summary: r.summary,
      reply: r.reply,
      personRef: r.person_ref,
    });
    const j = jobOf(r.job_id);
    if (c.called) j.aiCalled = true;
    if (c.success) j.interested = true;
    if (!r.cancelled && r.channel === 'interview' && (r.outcome ?? '').trim() === 'confirmed') j.appointed = true;
  }
  // ผล "มาตามนัด" ยังไม่เคยถูกบันทึกเลย (วัด 29 ก.ย. 2569: 0 แถว) = ไม่มีข้อมูล ห้ามอ่านเป็น "ติดตรงนี้"
  return { byJob, showedRecorded: !!showedAny.rows[0]?.has };
}

const jobBu = (j: { site_code?: unknown }) => trendBuFromSiteCode(String(j.site_code ?? ''));

/** ใบเปิดตอนนี้ (feed เดียวกับกล่องงาน) + มี Gen link ไหม + Gen link นานแล้วยังไม่มีผู้สมัครไหม */
function openJobsOf(feed: readonly JobRequest[], postings: readonly RawPostingRow[], today: string): RawOpenJob[] {
  const idx = buildJobKeyIndex(postings.map((p) => [p.jobId, p] as const));
  const staleBefore = addDays(today, -STALE_POSTING_DAYS);
  return feed.map((j) => {
    const p = idx.get(String(j.id));
    return {
      id: String(j.id),
      bu: jobBu(j),
      positions: jobPositionUnits(j),
      hasLink: !!p,
      staleNoApplicants: !!p && p.applicants === 0 && p.ymd < staleBefore,
    };
  });
}

/**
 * ติดตรงไหน — ใบขอ ERP ที่เข้ามาในช่วง จับกับของฝั่งเราด้วย id เต็ม `siamraj-sql:<เลขที่>`
 * 🔴 เลขที่ที่ชนกับใบขอล่วงหน้าที่ยังเปิดอยู่ (`siamraj-pre:<เลขที่เดียวกัน>`) = ไม่จับคู่ (ประกาศของใบล่วงหน้าก็เก็บ `siamraj-sql:`)
 *    — กติกาเดียวกับ `buildJobKeyIndex` ของกล่องงาน: ยอมพลาดดีกว่าเอาของอีกใบมาแปะ
 */
export function funnelRequestsOf(
  w: TeamWindow,
  requests: readonly RawRequestRow[],
  postings: readonly RawPostingRow[],
  jobs: ReadonlyMap<string, FunnelJob>,
  preNos: ReadonlySet<string>,
): RawFunnelRequest[] {
  const at = makeLocator(w);
  const linked = new Set(postings.map((p) => p.jobId));
  const seen = new Map<string, RawFunnelRequest>();
  for (const r of requests) {
    if (at(r.ymd)?.side !== 'cur' || seen.has(r.requestNo)) continue;
    const id = `siamraj-sql:${r.requestNo}`;
    const ambiguous = preNos.has(r.requestNo);
    const j = ambiguous ? undefined : jobs.get(id);
    seen.set(r.requestNo, {
      requestNo: r.requestNo,
      bu: r.bu,
      genLink: !ambiguous && linked.has(id),
      applicants: !!j?.applicants,
      aiCalled: !!j?.aiCalled,
      interested: !!j?.interested,
      appointed: !!j?.appointed,
      showed: !!j?.showed,
    });
  }
  return [...seen.values()];
}

const settle = <T,>(p: Promise<T>) =>
  p.then(
    (v) => ({ ok: true as const, v }),
    (e: unknown) => ({ ok: false as const, e }),
  );

const why = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function buildTeamOnline(
  query: { from?: unknown; to?: unknown; grain?: unknown; compare?: unknown },
  scope: DepartmentScope,
  bu: string | null,
  now = new Date(),
): Promise<TeamOnlineResponse> {
  const today = toBangkokYmd(now);
  const w = teamWindow(query, today);
  const forcedBu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : null;
  const body: TeamOnlineResponse = {
    generated_at: now.toISOString(),
    scope: scope.mode,
    forced_bu: forcedBu,
    bu,
    window: w,
    bu_options: [],
    users: null,
    requests: null,
    lumos: null,
    postings: null,
    funnel: null,
    byBu: null,
    errors: {},
  };
  if (scope.mode === 'none') {
    const msg = 'บัญชีนี้ยังไม่ได้ผูกแผนก — ยังดูตัวเลขไม่ได้';
    body.errors = { users: msg, requests: msg, lumos: msg, postings: msg, funnel: msg, byBu: msg };
    return body;
  }

  const [actR, reqR, queueR, postR, feedR, funnelR] = await Promise.all([
    settle(loadActivity(w)),
    settle(loadRequests()),
    settle(loadQueue(w)),
    settle(loadPostings()),
    settle(listSiamrajUnitRequests({ limit: 500, departmentScope: scope }) as Promise<JobRequest[]>),
    settle(loadFunnelJobs()),
  ]);

  // ผู้ใช้ถูกล็อกแผนก = เห็นแค่ BU ตัวเอง ทุกก้อน (ต่อ BU ก็แถวเดียว) · ไม่ล็อก = ทุก BU
  const inScope = (b: string | null) => !forcedBu || b === forcedBu;
  const inPage = (b: string | null) => inScope(b) && (!bu || b === bu);
  const labelOf = (b: string) => (b ? trendBuLabel(b) : 'ไม่ระบุ BU');

  const requests = reqR.ok ? reqR.v.rows.filter((r) => inScope(r.bu)) : null;
  const queue = queueR.ok ? queueR.v.rows.filter((r) => inScope(r.bu)) : null;
  const postings = postR.ok ? postR.v.rows.filter((r) => inScope(r.bu)) : null;
  const openJobs = postR.ok && feedR.ok ? openJobsOf(feedR.v, postR.v.rows, today).filter((j) => inScope(j.bu)) : null;

  /** BU ทั้งหมดที่รู้จักตามสิทธิ์ — BU ที่ยังไม่มีบัญชี/ยังไม่ส่ง Lumos ขึ้นเป็นแถวให้เห็น (ไม่หายเงียบ) */
  const knownBus = new Set<string>();
  const addBu = (b: string | null | undefined) => {
    if (b && inScope(b)) knownBus.add(b);
  };
  if (forcedBu) knownBus.add(forcedBu);
  // เฉพาะ BU ที่มีงานในช่วงนี้/ตอนนี้จริง — BU ที่นาน ๆ มีใบทีเดียว (CR · IO) ไม่ต้องขึ้นแถวว่างทุกช่วง
  const at = makeLocator(w);
  requests?.forEach((r) => at(r.ymd)?.side === 'cur' && addBu(r.bu));
  openJobs?.forEach((j) => addBu(j.bu));
  queue?.forEach((r) => at(r.ymd)?.side === 'cur' && addBu(r.bu));
  if (actR.ok) actR.v.accounts.forEach((a) => addBu(a.bu));

  if (actR.ok) {
    const accounts = forcedBu ? actR.v.accounts.filter((a) => a.bu === forcedBu) : actR.v.accounts;
    const perBu = usersSummary(w, accounts, actR.v.activity, labelOf, knownBus);
    // ยอดรวมบนการ์ด "คนใช้งาน · ทุก BU" = ทุกบัญชีเสมอ (ตามป้าย)
    const all = forcedBu ? usersSummary(w, actR.v.accounts, actR.v.activity, labelOf) : perBu;
    body.users = { total: all.total, accounts: all.accounts, coverage: coverageOf(w, actR.v.since), byBu: perBu.byBu };
  } else body.errors.users = 'อ่านการใช้งานของเจ้าหน้าที่ไม่ได้';

  if (reqR.ok && requests) {
    const page = requestsSummary(w, requests.filter((r) => inPage(r.bu)), labelOf);
    const perBu = requestsSummary(w, requests, labelOf, knownBus);
    body.requests = {
      positions: page.positions,
      requests: page.requests,
      coverage: coverageOf(w, reqR.v.since),
      stale: reqR.v.stale,
      ageSeconds: reqR.v.ageSeconds,
      byBu: perBu.byBu,
    };
  } else body.errors.requests = 'อ่านใบขอจาก ERP ไม่ได้ตอนนี้';

  if (queueR.ok && queue) {
    const page = lumosSummary(w, queue.filter((r) => inPage(r.bu)), labelOf);
    const perBu = lumosSummary(w, queue, labelOf, knownBus);
    body.lumos = {
      total: page.total,
      prev: page.prev,
      called: page.called,
      lanes: page.lanes,
      coverage: coverageOf(w, queueR.v.since),
      byBu: perBu.byBu,
    };
  } else body.errors.lumos = 'อ่านคิวโทร Lumos ไม่ได้';

  if (postR.ok && postings) {
    body.postings = {
      ...postingsSummary(w, postings.filter((r) => inPage(r.bu))),
      coverage: coverageOf(w, postR.v.since),
    };
  } else body.errors.postings = 'อ่านตารางประกาศ/Gen link ไม่ได้';

  if (reqR.ok && requests && postR.ok && funnelR.ok && feedR.ok) {
    const preNos = new Set(
      feedR.v.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX)).map((j) => requestNoOf(String(j.id))),
    );
    body.funnel = funnelRows(
      funnelRequestsOf(w, requests, postR.v.rows, funnelR.v.byJob, preNos),
      labelOf,
      knownBus,
      funnelR.v.showedRecorded ? new Set() : new Set(['showed'] as const),
    );
  } else {
    body.errors.funnel = !reqR.ok ? 'อ่านใบขอจาก ERP ไม่ได้ตอนนี้' : 'อ่านข้อมูลผู้สมัคร/ประกาศไม่ได้';
  }

  if (openJobs && postings) {
    body.byBu = buildBuRows(w, { labelOf, postings, openJobs, extraBus: knownBus });
    body.bu_options = body.byBu
      .filter((r) => r.bu !== '')
      .map((r) => ({ bu: r.bu, label: r.label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'th'));
  } else body.errors.byBu = feedR.ok ? 'อ่านตารางประกาศ/Gen link ไม่ได้' : 'อ่านใบขอที่เปิดอยู่ไม่ได้';

  for (const [k, r] of [
    ['users', actR],
    ['requests', reqR],
    ['lumos', queueR],
    ['postings', postR],
    ['feed', feedR],
    ['funnel', funnelR],
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
    const q = req.query ?? {};
    const query = { from: q.from, to: q.to, grain: q.grain, compare: q.compare };
    const scope: DepartmentScope = await loadMatchingBuScope(req.user);
    const bu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : parseBuParam(q.bu);
    const cacheKey = JSON.stringify([scope, query, bu]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const body = await buildTeamOnline(query, scope, bu);
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'team-online GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
