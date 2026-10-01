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
import { readUnitRequestListThroughCache } from './siamraj-unit-requests.js';
import { PREQUEST_ID_PREFIX } from '../_lib/siamrajSqlServerPrequests.js';
import { loadRequestTrendPayload, requestTrendDataFrom } from '../_lib/requestTrendRows.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { queueCancelled, queueOutcome, queueReplySql } from '../_lib/lumosQueueDefs.js';
import { appBuJoin, appBuSql, parseBuParam, queueBuJoins, queueBuSql } from '../_lib/homeBuSql.js';
import { HAS_APPOINTMENT_SQL, buildApplicantFactsSql } from '../_lib/applicantOverviewSql.js';
import { siteBuSql, trendBuSql } from '../_lib/siteBuSql.js';
import { logWarn } from '../_lib/logger.js';
import { listReleaseSkips } from '../_lib/jobReleaseSkips.js';
import { ACTIVITY_SOURCES, accountsSql, lastLoginSql } from '../_lib/userActivitySql.js';
import { buildSkipIndex, releaseSkipText, type JobReleaseSkip } from '../../src/lib/jobReleaseSkips.js';
import { requestAddedYmd } from '../../src/lib/trends/requestTrends.js';
import { addDays } from '../../src/lib/trends/timeBuckets.js';
import { normalizeTrendBu, trendBuFromSiteCode, trendBuLabel } from '../../src/lib/trends/bu.js';
import { jobPositionUnits } from '../../src/lib/jobPositionUnits.js';
import { buildCountIndex, buildJobKeyIndex, countFor, requestNoOf } from '../../src/lib/jobKeyIndex.js';
import { buildReleaseIndex } from '../../src/lib/jobReleaseIndex.js';
import { jobRequestDateYmd } from '../../src/lib/jobRequestDate.js';
import { isBoardVisibleJob } from '../../src/lib/jobBoardSearch.js';
import { releaseStepOf, stillSourcing, type ReleaseFacts } from '../../src/lib/boardRelease.js';
import { queueLane } from '../../src/lib/officeTeam.js';
import {
  applicantBacklog,
  applicantsSummary,
  buildBuRows,
  classifyQueueRow,
  coverageOf,
  decisionSummary,
  funnelRows,
  laneRows,
  lumosSummary,
  makeLocator,
  oldestNoApplicantJobs,
  peopleOf,
  postingsSummary,
  requestsSummary,
  teamWindow,
  usersSummary,
  type RawAccount,
  type RawActivity,
  type RawApplicant,
  type PendingWait,
  type RawBoardJob,
  type RawDecisionRequest,
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
const RELEASES = tableInAppSchema('job_public_releases');
const MAP = tableInAppSchema('job_site_map');
const AUDIT = tableInAppSchema('audit_logs');

const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; body: TeamOnlineResponse }>();

/** ร่องรอยการใช้งาน / บัญชี / เข้าระบบล่าสุด — ย้ายไป `api/_lib/userActivitySql.ts` (ตัวเดียวกับหน้าหลัก) · ส่งต่อชื่อเดิมไว้ */
export { ACTIVITY_SOURCES, accountsSql, lastLoginSql };

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
     select ev.uid::text as uid, ${bkkYmd('ev.at')} as ymd, max(ev.at) as last_at
       from ev
       join ${USERS} u on u.id = ev.uid
      group by 1, 2`;
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

/**
 * ติดตรงไหน — ต่อใบ (job_id ฝั่งเรา): มีผู้สมัคร · มีนัด · มาตามนัด (ไม่นับ Lead ทุกขั้น)
 * 🔴 "มีนัด" = `HAS_APPOINTMENT_SQL` ตัวกลางของศูนย์คุมงานสรรหา (บันทึกติดต่อ/คนถือที่มีวันนัด)
 *    ผล `confirmed` ของสาย AI ช่องทาง interview **ไม่ใช่นัด** — เป็นผลสัมภาษณ์ทางโทรศัพท์ (มีคะแนน/จุดเด่น/ข้อกังวล)
 *    (รอบก่อนผมนับรวมเป็นนัด = ผิด · แก้ 29 ก.ย. 2569)
 */
export function funnelJobsSql(): string {
  return `select a.job_id,
         count(*)::int as applicants,
         count(*) filter (where ${HAS_APPOINTMENT_SQL})::int as appointed,
         count(*) filter (where exists (
           select 1 from ${ATTEND} r where r.application_id = a.id and r.result = 'showed'))::int as showed
    from ${APPS} a
   where a.job_id is not null and not coalesce(a.is_lead, false)
   group by a.job_id`;
}

/** ติดตรงไหน — สายของผู้สมัครแต่ละใบ (เลนหน้าสาธารณะ) ให้จัดถัง "AI โทรแล้ว / มีคนสนใจ" ด้วยตัวกลาง */
export function funnelCallsSql(): string {
  return `select a.job_id, q.person_ref, ${queueCancelled('q')} as cancelled, ${queueOutcome('q')} as outcome,
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

const isoOf = (v: Date | string | null | undefined): string | null =>
  v === null || v === undefined ? null : v instanceof Date ? v.toISOString() : String(v);

async function loadActivity(w: TeamWindow) {
  const [act, acc, since, logins] = await Promise.all([
    dbQuery<{ uid: string; ymd: string; last_at?: Date | string | null }>(usersSql(), [
      startOf(w.fetchFrom),
      startOf(addDays(w.fetchTo, 1)),
    ]),
    dbQuery<{
      id: string;
      dept: string;
      role: string;
      active: boolean;
      created_ymd: string | null;
      display_name: string | null;
      lanes?: string[] | null;
    }>(accountsSql()),
    sinceYmd(`select ${bkkYmd('min(created_at)')} as ymd from ${AUDIT}`),
    dbQuery<{ uid: string; last_at: Date | string | null }>(lastLoginSql()),
  ]);
  const accounts: Array<RawAccount & { name: string }> = acc.rows.map((r) => ({
    id: r.id,
    bu: r.dept ? (normalizeTrendBu(r.dept) ?? '') : '',
    role: r.role,
    active: !!r.active,
    createdYmd: r.created_ymd,
    lanes: Array.isArray(r.lanes) ? r.lanes : [],
    name: r.display_name ?? '—',
  }));
  const activity: RawActivity[] = act.rows.map((r) => ({ uid: r.uid, ymd: r.ymd, lastAt: isoOf(r.last_at) }));
  const lastLogin = new Map<string, string>();
  for (const r of logins.rows) {
    const at = isoOf(r.last_at);
    if (at) lastLogin.set(r.uid, at);
  }
  return { activity, accounts, since, lastLogin };
}

/**
 * ใบสมัคร **ทุกวันที่สมัคร** — ข้อเท็จจริงรายใบจากนิพจน์กลางของศูนย์คุมงานสรรหา (ไม่มีชื่อ/เบอร์)
 * ช่วงที่ดูคิดจากวันที่สมัครฝั่งตัวคิด · งานค้างตอนนี้ (`applicantBacklog`) ต้องนับทั้งกองให้ตรงหน้ารายชื่อ
 */
async function loadApplicants(w: TeamWindow): Promise<RawApplicant[]> {
  const { rows } = await dbQuery<{
    id: string;
    job_id: string | null;
    ymd: string;
    created_at: Date | string;
    is_lead: boolean;
    referral_source: string | null;
    bu: string | null;
    called: boolean;
    in_queue: boolean;
    held_or_claimed: boolean;
    latest_class: 'success' | 'failed' | null;
    has_appointment: boolean;
    wait_hours: number | string | null;
  }>(buildApplicantFactsSql(appBuSql('a'), appBuJoin('a')), ['2000-01-01T00:00:00+07:00', startOf(addDays(w.today, 1))]);
  return rows.map((r) => ({
    id: r.id,
    jobId: r.job_id,
    ymd: r.ymd,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    lead: !!r.is_lead,
    source: r.referral_source,
    bu: r.bu ? normalizeTrendBu(r.bu) : null,
    called: !!r.called,
    inQueue: !!r.in_queue,
    held: !!r.held_or_claimed,
    latestClass: r.latest_class,
    hasAppointment: !!r.has_appointment,
    waitHours: r.wait_hours === null ? null : Number(r.wait_hours),
  }));
}

/** ทะเบียนปล่อยใบ — ชุดเดียวกับที่กล่องงานใช้แยกเลน "ปล่อยแล้ว / ยังไม่ปล่อย" */
async function loadReleases() {
  const { rows } = await dbQuery<{ job_id: string; request_no: string | null }>(
    `select job_id, request_no from ${RELEASES} where released_at is not null`,
  );
  return rows;
}

/**
 * ใบเปิดในมุมกล่องงาน — **ตัวคิดเดียวกับกล่องงาน**: ใบที่กล่องงานโชว์ (`isBoardVisibleJob`) ·
 * ปล่อยแล้ว = ทะเบียนปล่อย (`buildReleaseIndex`) · มีลิงก์ = ประกาศ (`buildJobKeyIndex`) ·
 * ผู้สมัคร = ใบสมัครไม่นับ Lead (`buildCountIndex` · ตัวเดียวกับเลขบนการ์ด) · ยังต้องหาคน = `stillSourcing` · ขั้น = `releaseStepOf`
 */
function boardJobsOf(
  feed: readonly JobRequest[],
  releases: ReadonlyArray<{ job_id: string; request_no: string | null }>,
  postings: readonly RawPostingRow[],
  applicantCounts: Readonly<Record<string, number>>,
  today: string,
): RawBoardJob[] {
  const released = buildReleaseIndex(releases);
  const linked = buildJobKeyIndex(postings.map((p) => [p.jobId, true] as const));
  const counts = buildCountIndex(applicantCounts);
  const facts: ReleaseFacts = {
    hasLink: (j) => linked.has(String(j.id)),
    isReleased: (j) => released.has(String(j.id)),
    applicants: (j) => countFor(counts, String(j.id)),
  };
  return feed.filter(isBoardVisibleJob).map((j) => {
    const ymd = jobRequestDateYmd(j as { request_date?: string; submittedAt?: string; created_at?: string });
    const isReleased = facts.isReleased(j);
    return {
      id: String(j.id),
      externalId: j.externalId ? String(j.externalId) : null,
      requestNo: String(j.request_no ?? requestNoOf(String(j.id))),
      unit: String(j.unit_name ?? ''),
      bu: jobBu(j),
      positions: jobPositionUnits(j),
      ageDays: ymd ? Math.max(0, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 86_400_000)) : null,
      released: isReleased,
      sourcing: stillSourcing(j),
      applicants: facts.applicants(j),
      step: isReleased ? null : releaseStepOf(j, facts),
    };
  });
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
    kind: r.kind,
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

/** ต่อใบ: `count` = ใบสมัครไม่นับ Lead (ตัวเดียวกับเลขบนการ์ดกล่องงาน) · ที่เหลือ = ขั้นที่มีอย่างน้อยหนึ่งคนถึงแล้ว */
type FunnelJob = { count: number; applicants: boolean; aiCalled: boolean; interested: boolean; appointed: boolean; showed: boolean };

async function loadFunnelJobs(): Promise<{ byJob: Map<string, FunnelJob>; showedRecorded: boolean }> {
  const [jobs, calls, showedAny] = await Promise.all([
    dbQuery<{ job_id: string; applicants: number; appointed: number; showed: number }>(funnelJobsSql()),
    dbQuery<{
      job_id: string;
      person_ref: string;
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
      j = { count: 0, applicants: false, aiCalled: false, interested: false, appointed: false, showed: false };
      byJob.set(id, j);
    }
    return j;
  };
  for (const r of jobs.rows) {
    const j = jobOf(r.job_id);
    j.count = Number(r.applicants) || 0;
    j.applicants = j.count > 0;
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
  }
  // ผล "มาตามนัด" ยังไม่เคยถูกบันทึกเลย (วัด 29 ก.ย. 2569: 0 แถว) = ไม่มีข้อมูล ห้ามอ่านเป็น "ติดตรงนี้"
  return { byJob, showedRecorded: !!showedAny.rows[0]?.has };
}

const jobBu = (j: { site_code?: unknown }) => trendBuFromSiteCode(String(j.site_code ?? ''));

/** ใบเปิดตอนนี้ (feed เดียวกับกล่องงาน) — เหลือหาต่อ BU (รวมแล้วเท่าหัวกล่องงาน) */
/**
 * ใบเปิดตอนนี้ — **ชุดเดียวกับหัวกล่องงาน** (`isBoardVisibleJob`)
 * 🔴 feed ส่งใบที่ RM รับทราบแล้วมาด้วย (`status: 'closed'`) — ไม่กรองแล้ว "ใบเปิด/เหลือหา" เกินหัวกล่องงาน (แก้ 29 ก.ย. 2569 รอบ 4)
 */
function openJobsOf(feed: readonly JobRequest[]): RawOpenJob[] {
  return feed.filter(isBoardVisibleJob).map((j) => ({ id: String(j.id), bu: jobBu(j), positions: jobPositionUnits(j) }));
}

/**
 * อนุมัติแล้ว · รอดำเนินการ · ไม่อนุมัติ ของใบขอ ERP (รอบ 5) — **หนึ่งแถว ERP หนึ่งแถว** (อัตรารวมต้องเท่าการ์ด "อัตราที่ขอเข้า")
 * - id ของใบ = `siamraj-sql:<เลขที่>` · เลขที่ชนใบล่วงหน้าที่เปิดอยู่ = จับเฉพาะ id เต็ม (ไม่ถอยไปเลขที่ใบ — กติกาเดียวกับ `funnelRequestsOf`)
 * - ไม่ปล่อย (และยังไม่ขึ้นหน้าสาธารณะ) → ไม่อนุมัติ · มี Gen link → อนุมัติ · ที่เหลือ → รอ
 * - รออะไร: อัตราที่ ERP บอกว่าหาได้แล้ว/ยกเลิก → บอกตามนั้น · ยังเหลือ + อยู่ในกล่องงาน → ขั้นที่ติด (`releaseStepOf` ของ `boardJobsOf`)
 *   หรือ "มีคนเริ่มงานแล้ว" (ไม่ใช่ `stillSourcing`) · ยังเหลือแต่ไม่อยู่ในกล่องงาน → "ไม่อยู่ในกล่องงานแล้ว"
 */
export function decisionRequestsOf(
  requests: readonly RawRequestRow[],
  src: {
    postings: readonly RawPostingRow[];
    releases: ReadonlyArray<{ job_id: string; request_no: string | null }>;
    skips: readonly JobReleaseSkip[];
    boardJobs: readonly RawBoardJob[];
    applicants: (jobId: string) => number;
    preNos: ReadonlySet<string>;
  },
): RawDecisionRequest[] {
  const linked = new Set(src.postings.map((p) => p.jobId));
  const skipIdx = buildSkipIndex(src.skips);
  const skipExact = new Map(src.skips.map((x) => [x.job_id, x]));
  const releasedIdx = buildReleaseIndex(src.releases);
  const releasedExact = new Set(src.releases.map((r) => r.job_id));
  const jobs = new Map(src.boardJobs.map((j) => [j.id, j]));
  return requests.map((r): RawDecisionRequest => {
    const id = `siamraj-sql:${r.requestNo}`;
    const ambiguous = src.preNos.has(r.requestNo);
    const skip = ambiguous ? skipExact.get(id) : skipIdx.get(id);
    const released = ambiguous ? releasedExact.has(id) : releasedIdx.has(id);
    const genLink = !ambiguous && linked.has(id);
    const decision = skip && !released ? 'rejected' : genLink ? 'approved' : 'pending';
    let wait: PendingWait | null = null;
    if (decision === 'pending') {
      const job = jobs.get(id);
      wait =
        r.kind === 'filled'
          ? 'filled'
          : r.kind === 'cancelled'
            ? 'cancelled'
            : !job
              ? 'closed'
              : job.released
                ? 'publish' // ขึ้นหน้าสาธารณะแล้วแต่ยังไม่มีลิงก์สมัคร = เหลือขั้นสร้างลิงก์
                : !job.sourcing
                  ? 'started'
                  : (job.step ?? 'info');
    }
    return {
      requestNo: r.requestNo,
      ymd: r.ymd,
      bu: r.bu,
      positions: r.positions,
      decision,
      wait,
      reason: decision === 'rejected' && skip ? skip.reason : null,
      reasonText: decision === 'rejected' && skip ? releaseSkipText(skip) : null,
      applicants: decision === 'approved' ? src.applicants(id) : 0,
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
  /** รายชื่อคนใช้งาน — เฉพาะหัวหน้า/admin (เจ้าของเคาะ 29 ก.ย. 2569) · ตัดสินฝั่ง server เท่านั้น */
  canSeePeople = false,
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
    applicants: null,
    lanes: null,
    people: null,
    decisions: null,
    byBu: null,
    errors: {},
  };
  if (scope.mode === 'none') {
    const msg = 'บัญชีนี้ยังไม่ได้ผูกแผนก — ยังดูตัวเลขไม่ได้';
    body.errors = { users: msg, requests: msg, lumos: msg, postings: msg, funnel: msg, byBu: msg, applicants: msg, lanes: msg, decisions: msg };
    return body;
  }

  const [actR, reqR, queueR, postR, feedR, funnelR, appsR, relR, skipR] = await Promise.all([
    settle(loadActivity(w)),
    settle(loadRequests()),
    settle(loadQueue(w)),
    settle(loadPostings()),
    /**
     * 🔴 feed ตัวเดียวกับกล่องงาน (สำเนาร่วม + ของแนบ: สถานะทำงาน · หมายเหตุ · ผู้รับผิดชอบ · สวัสดิการ)
     * เดิมเรียก `listSiamrajUnitRequests` ดิบ ⇒ ไม่มี `work_status` ⇒ ทุกใบเป็น "ยังต้องหาคน" (วัด 320 แทน 221)
     * และบางครั้งได้ของแนบติดมาจากสำเนาที่กล่องงานแนบไว้แล้ว ⇒ เลขแกว่งตามว่าใครเปิดกล่องงานก่อน (แก้ 29 ก.ย. 2569 รอบ 4)
     */
    settle(readUnitRequestListThroughCache({ limit: 500, departmentScope: scope }).then((o) => o.value as JobRequest[])),
    settle(loadFunnelJobs()),
    settle(loadApplicants(w)),
    settle(loadReleases()),
    settle(listReleaseSkips()),
  ]);

  // ผู้ใช้ถูกล็อกแผนก = เห็นแค่ BU ตัวเอง ทุกก้อน (ต่อ BU ก็แถวเดียว) · ไม่ล็อก = ทุก BU
  const inScope = (b: string | null) => !forcedBu || b === forcedBu;
  const inPage = (b: string | null) => inScope(b) && (!bu || b === bu);
  const labelOf = (b: string) => (b ? trendBuLabel(b) : 'ไม่ระบุ BU');

  const requests = reqR.ok ? reqR.v.rows.filter((r) => inScope(r.bu)) : null;
  const queue = queueR.ok ? queueR.v.rows.filter((r) => inScope(r.bu)) : null;
  const postings = postR.ok ? postR.v.rows.filter((r) => inScope(r.bu)) : null;
  const openJobs = feedR.ok ? openJobsOf(feedR.v).filter((j) => inScope(j.bu)) : null;

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

  // ── ผู้สมัคร: มาจากไหน · มาแล้วยังไง ──
  if (appsR.ok) {
    const apps = appsR.v.filter((r) => inScope(r.bu));
    const pageApps = apps.filter((r) => inPage(r.bu));
    const page = applicantsSummary(w, pageApps, labelOf, [], now.getTime());
    const perBu = applicantsSummary(w, apps, labelOf, knownBus, now.getTime());
    body.applicants = {
      total: page.total,
      leads: page.leads,
      stages: page.stages,
      over5d: page.over5d,
      waitMedianHours: page.waitMedianHours,
      sources: page.sources,
      coverage: coverageOf(w, apps.reduce<string | null>((m, r) => (!m || r.ymd < m ? r.ymd : m), null)),
      byBu: perBu.byBu,
      backlog: applicantBacklog(pageApps, now.getTime()),
      backlogScope: applicantBacklog(apps, now.getTime()),
    };
  } else body.errors.applicants = 'อ่านใบสมัครไม่ได้';

  // ── ใบเปิดในมุมกล่องงาน: เลน + ใบยังไม่มีผู้สมัครแยกอายุ ──
  const boardJobs =
    feedR.ok && postR.ok && relR.ok && funnelR.ok
      ? boardJobsOf(
          feedR.v,
          relR.v,
          postR.v.rows,
          Object.fromEntries([...funnelR.v.byJob].map(([jobId, j]) => [jobId, j.count])),
          today,
        )
      : null;
  if (boardJobs) {
    const jobs = boardJobs.filter((j) => inScope(j.bu));
    const pageJobs = jobs.filter((j) => inPage(j.bu));
    const allOf = (list: typeof jobs) => laneRows(list.map((j) => ({ ...j, bu: 'ALL' })), () => 'ทั้งหมด', ['ALL'])[0];
    body.lanes = {
      total: allOf(pageJobs),
      scope: allOf(jobs),
      byBu: laneRows(jobs, labelOf, knownBus),
      oldest: oldestNoApplicantJobs(pageJobs),
    };
  } else body.errors.lanes = feedR.ok ? 'อ่านทะเบียนประกาศ/Gen link ไม่ได้' : 'อ่านใบขอที่เปิดอยู่ไม่ได้';

  // ── อัตราที่ขอเข้า: อนุมัติแล้ว (Gen link) · รอดำเนินการ · ไม่อนุมัติ (ไม่ปล่อย + เหตุผล) ──
  if (reqR.ok && requests && postR.ok && relR.ok && funnelR.ok && feedR.ok && boardJobs) {
    const preNos = new Set(
      feedR.v.filter((j) => String(j.id).startsWith(PREQUEST_ID_PREFIX)).map((j) => requestNoOf(String(j.id))),
    );
    const rows = decisionRequestsOf(requests, {
      postings: postR.v.rows,
      releases: relR.v,
      skips: skipR.ok ? skipR.v : [],
      boardJobs,
      applicants: (jobId) => funnelR.v.byJob.get(jobId)?.count ?? 0,
      preNos,
    });
    const page = decisionSummary(w, rows.filter((r) => inPage(r.bu)), labelOf);
    const perBu = decisionSummary(w, rows, labelOf, knownBus);
    body.decisions = { total: page.total, byBu: perBu.byBu, skipsReady: skipR.ok };
  } else body.errors.decisions = !reqR.ok ? 'อ่านใบขอจาก ERP ไม่ได้ตอนนี้' : 'อ่าน Gen link/ทะเบียนประกาศ/กล่องงานไม่ได้';

  // ── รายชื่อคนใช้งาน (เฉพาะหัวหน้า/admin) ──
  if (canSeePeople && actR.ok) {
    const accounts = actR.v.accounts.filter((a) => inScope(a.bu || null) || (!forcedBu && a.bu === ''));
    body.people = peopleOf(w, accounts, actR.v.activity, actR.v.lastLogin);
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
    ['applicants', appsR],
    ['releases', relR],
    ['releaseSkips', skipR],
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
    const cacheKey = JSON.stringify([scope, query, bu, req.user.role]);
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);

    const canSeePeople = req.user.role === 'admin' || req.user.role === 'supervisor';
    const body = await buildTeamOnline(query, scope, bu, new Date(), canSeePeople);
    cache.set(cacheKey, { at: Date.now(), body });
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    respondServiceError(res, e, 'team-online GET', { userId: req.user.sub });
  }
}

export default withAuth(handler);
