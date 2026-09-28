/**
 * GET /api/dashboard-trends?section=follow|applicants|releases|requests&from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * ═══ ข้อมูลของแท็บ "Dashboard" ในหน้ากล่องงาน + หน้าติดตาม (อ่านอย่างเดียว · 28 ก.ย. 2569) ═══
 *
 * เจ้าของสั่ง: *"สวมบทบาทเป็นผู้บริหาร … ดูว่าแต่ละวันทีมมีแนวโน้มเติบโตลดลงยังไง … รายวัน สัปดาห์ เดือน ปี"*
 * → Choice: แท็บในสองหน้า (ชื่อ "Dashboard") · ทำครบ 4 ส่วน · ERP อ่านอย่างเดียว + สำเนาฝั่งเรา
 *
 * 🔴 กติกาของเส้นนี้ (ชั้นคู่ขนาน — ไม่แตะเส้น/จอเดิม):
 * 1. **อ่านอย่างเดียว** ทุก section · ไม่มี POST/PATCH
 * 2. **คืนแถวย่อ ไม่คืนข้อมูลบุคคลของผู้สมัคร/ผู้รับสาย** (ไม่มีชื่อ เบอร์ ที่อยู่) — หน้าเว็บแบ่งงวด/มิติเอง
 * 3. สิทธิ์ต่อ section = สิทธิ์ของเส้นเดิมที่ข้อมูลชุดนั้นมาจาก (follow · job-applications · siamraj-unit-requests)
 * 4. **BU ชุดเดียว** = รหัสแผนก (`normalizeTrendBu`) · คนที่ถูกล็อก BU เห็นเฉพาะ BU ตัวเอง (ไม่รู้ BU = ไม่เห็น)
 *    ⚠️ ติดตามไม่ล็อก BU — หน้าติดตามเดิมให้ทุกคนเห็นทุกแถว (ห้ามทำ Dashboard แคบกว่าหน้าที่มันสรุป)
 * 5. ใบขอ (ERP) อ่านผ่านสำเนาในฐาน (`trendSnapshots`) — คิวรีช่วงยาวใช้ ~24 วิ ถามสดทุกครั้งไม่ได้
 */
import { sendError, withAuth, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { checkApiAccess, type ApiResource } from '../_lib/rbac.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadUserDepartmentScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { queueOutcome } from '../_lib/lumosQueueDefs.js';
import {
  loadAppointmentByPhone,
  loadLatestCallOutcomeByPhone,
  loadLatestCallStateByPhone,
} from '../_lib/applicantCallOutcomes.js';
import { loadContactAppointments } from '../_lib/applicationContacts.js';
import { loadLatestAttendanceByApplication } from '../_lib/applicationAttendance.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import { getSiamrajDbSource, listSiamrajThroughput } from '../_lib/siamrajUnitRequests.js';
import { listSiamrajSqlServerInformDays } from '../_lib/siamrajSqlServerInforms.js';
import { readThroughSnapshot } from '../_lib/trendSnapshots.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { bucketOfCall } from '../../src/lib/callOutcomeBuckets.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import type {
  ApplicantTrendRow,
  DashboardTrendSection,
  FollowTrendRow,
  InformTrendRow,
  ReleaseTrendRow,
  RequestTrendPayload,
  RequestTrendRow,
} from '../../src/lib/trends/types.js';

const FOLLOW = tableInAppSchema('follow_entries');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const USERS = tableInAppSchema('users');
const APPS = tableInAppSchema('public_job_applications');
const MAP = tableInAppSchema('job_site_map');
const RELEASES = tableInAppSchema('job_public_releases');

/** BU จากรหัสไซต์ในฝั่ง SQL — ต้องตรงกับ `buFromSiteCode` (`src/lib/homeBu.ts`) · แปลงเป็นรหัสแผนกต่อฝั่ง Node */
const SITE_BU = (col: string) =>
  `case when ${col} ~ '^[0-9]{2}[A-Za-z]{3}' then upper(substring(${col} from 3 for 3)) end`;

const SECTION_RESOURCE: Record<DashboardTrendSection, ApiResource> = {
  follow: 'follow',
  applicants: 'job-applications',
  releases: 'siamraj-unit-requests',
  requests: 'siamraj-unit-requests',
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const addDaysYmd = (ymd: string, days: number): string =>
  new Date(Date.parse(`${ymd}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * ช่วงยาวสุดที่ขอได้ — 7 ปี: ปุ่ม "ปี" ดู 3 ปี + ช่วงก่อนที่ยาวเท่ากันอีก 3 ปี (+ เศษปีปัจจุบัน)
 * ⚠️ เดิมตั้ง 5 ปี ⇒ กดปุ่ม "ปี" แล้วเส้นตอบ 400 การ์ดปล่อยประกาศ/ผู้สมัครขึ้น "—" (เจอตอนตรวจ 28 ก.ย. 2569)
 */
const MAX_SPAN_DAYS = 366 * 7;

const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const clean = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

function getQuery(req: AuthedReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim();
  return '';
}

function inScope(scope: DepartmentScope, bu: string | null): boolean {
  if (scope.mode === 'all') return true;
  if (scope.mode === 'none') return false;
  return bu === scope.code;
}

/** ════ ติดตาม ════ */
async function loadFollow(from: string, to: string): Promise<FollowTrendRow[]> {
  const outcome = queueOutcome('q');
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select f.id::text as id, f.created_at, f.scheduled_at, f.completed_at, f.cancelled_at,
            f.outcome_code, f.call_round, coalesce(f.call_mode, 'ai') as call_mode,
            f.topic, f.unit_name, f.site_code,
            f.created_by::text as staff_id,
            coalesce(nullif(btrim(u.nickname), ''), f.created_by_name) as staff_name,
            coalesce(u.department_code, ${SITE_BU('f.site_code')}) as bu,
            q.status as call_status, ${outcome} as call_outcome, q.attempt_count as attempt,
            case when ${outcome} is not null then coalesce(q.first_result_at, q.updated_at) end as result_at
       from ${FOLLOW} f
       left join ${USERS} u on u.id = f.created_by
       left join ${QUEUE} q
              on q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
      where f.created_at < ($2::date + 1)
        and (f.created_at >= $1::date
             or f.completed_at >= $1::date
             or f.cancelled_at >= $1::date
             or coalesce(q.first_result_at, q.updated_at) >= $1::date)`,
    [from, to],
  );
  return rows.map((r) => ({
    id: String(r.id),
    createdAt: iso(r.created_at),
    scheduledAt: iso(r.scheduled_at),
    resultAt: iso(r.result_at),
    completedAt: iso(r.completed_at),
    cancelledAt: iso(r.cancelled_at),
    outcomeCode: clean(r.outcome_code),
    // ยกเลิกการติดตาม = ยกเลิกในคิวด้วย (ตัวเดียวกับหน้ารายการ)
    callStatus: r.cancelled_at != null ? 'cancelled' : clean(r.call_status),
    callOutcome: clean(r.call_outcome),
    attempt: r.attempt == null ? null : Number(r.attempt),
    callRound: r.call_round == null ? null : Number(r.call_round),
    callMode: r.call_mode === 'manual' ? 'manual' : 'ai',
    topic: clean(r.topic),
    unitName: clean(r.unit_name),
    siteCode: clean(r.site_code),
    staffId: clean(r.staff_id),
    staffName: clean(r.staff_name),
    bu: normalizeTrendBu(clean(r.bu)),
  }));
}

/** ════ ผู้สมัคร ════ */
async function loadApplicants(from: string, to: string, scope: DepartmentScope): Promise<ApplicantTrendRow[]> {
  if (scope.mode === 'none') return [];
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select a.id::text as id, a.created_at, a.referral_source,
            coalesce(nullif(btrim(a.position_interest), ''), nullif(btrim(a.job_title), '')) as position,
            a.province, a.job_id, coalesce(a.is_lead, false) as is_lead, (a.claimed_by is not null) as claimed,
            coalesce(${SITE_BU('m.site_code')}, a.department_code) as bu,
            a.phone
       from ${APPS} a
       left join ${MAP} m on m.job_id = a.job_id
      where a.created_at >= $1::date and a.created_at < ($2::date + 1)`,
    [from, to],
  );
  const scoped = rows
    .map((r) => ({ r, bu: normalizeTrendBu(clean(r.bu)) }))
    .filter((x) => inScope(scope, x.bu));
  const phones = scoped.map((x) => String(x.r.phone ?? ''));
  const ids = scoped.map((x) => String(x.r.id));
  // ⚠️ ใช้ตัวอ่านชุดเดียวกับแท็บรายชื่อผู้สมัคร — ผลโทร/นัด/มาตามนัด ต้องตรงกับที่แท็บนั้นโชว์
  const [outcomes, states, apptByPhone, apptByApp, attendance] = await Promise.all([
    loadLatestCallOutcomeByPhone(phones),
    loadLatestCallStateByPhone(phones),
    loadAppointmentByPhone(phones),
    loadContactAppointments(ids),
    loadLatestAttendanceByApplication(ids),
  ]);
  return scoped.map(({ r, bu }) => {
    const e164 = toE164Thai(String(r.phone ?? '')) || '';
    const out = outcomes.get(e164);
    const st = states.get(e164);
    const hasCall = Boolean(out || st);
    const appt = apptByApp.get(String(r.id))?.at ?? apptByPhone.get(e164) ?? null;
    return {
      id: String(r.id),
      createdAt: iso(r.created_at),
      channel: clean(r.referral_source),
      position: clean(r.position),
      province: clean(r.province),
      bu,
      jobId: clean(r.job_id),
      isLead: Boolean(r.is_lead),
      claimed: Boolean(r.claimed),
      callBucket: hasCall ? bucketOfCall(st?.status ?? null, out?.outcome ?? null) : null,
      callOutcome: out?.outcome ?? null,
      callAt: out?.at ? iso(out.at) : null,
      appointmentAt: appt ? iso(appt) : null,
      attendance: attendance.get(String(r.id))?.result ?? null,
    };
  });
}

/** ════ ปล่อยประกาศ ════ */
async function loadReleases(from: string, to: string, scope: DepartmentScope): Promise<ReleaseTrendRow[]> {
  if (scope.mode === 'none') return [];
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select r.job_id, r.request_no, r.released_at, r.released_by::text as staff_id,
            coalesce(nullif(btrim(u.nickname), ''), r.released_by_name) as staff_name,
            ${SITE_BU('m.site_code')} as bu
       from ${RELEASES} r
       left join ${USERS} u on u.id = r.released_by
       left join ${MAP} m on m.job_id = r.job_id
      where r.released_at >= $1::date and r.released_at < ($2::date + 1)`,
    [from, to],
  );
  return rows
    .map((r) => ({
      jobId: String(r.job_id),
      requestNo: clean(r.request_no),
      releasedAt: iso(r.released_at) ?? '',
      staffId: clean(r.staff_id),
      staffName: clean(r.staff_name),
      bu: normalizeTrendBu(clean(r.bu)),
    }))
    .filter((r) => r.releasedAt && inScope(scope, r.bu));
}

/** ════ ใบขอ (ERP ผ่านสำเนา) ════ */

/** สำเนาสดพอ 30 นาที · ส่งของเก่าพร้อมดึงใหม่เบื้องหลังได้ถึง 2 วัน (ของเก่าบอกอายุตรง ๆ เสมอ) */
const REQUEST_TTL_MS = 30 * 60_000;
const REQUEST_MAX_STALE_MS = 48 * 60 * 60_000;

async function loadRequestSnapshot(from: string, to: string): Promise<{ requests: RequestTrendRow[]; informs: InformTrendRow[] }> {
  const [records, informs] = await Promise.all([
    listSiamrajThroughput({ from, to, departmentScope: { mode: 'all' } }),
    listSiamrajSqlServerInformDays({ from, to }),
  ]);
  const requests: RequestTrendRow[] = [];
  for (const x of records) {
    if (!x.requestNo || !x.kind || !(x.positionUnits > 0)) continue;
    requests.push({
      requestNo: x.requestNo,
      cohortDate: x.requestDate,
      submittedDate: x.submittedDate ?? null,
      closureDate: x.isOpen ? null : x.closureDate,
      kind: x.kind,
      positions: x.positionUnits,
      departmentCode: normalizeTrendBu(x.departmentCode ?? null),
      siteCode: x.siteCode ?? null,
      unitName: x.unitName ?? null,
      lifecycleKind: x.lifecycleKind ?? null,
      leadKind: x.leadKind ?? null,
    });
  }
  return { requests, informs };
}

async function loadRequests(from: string, to: string, scope: DepartmentScope): Promise<RequestTrendPayload> {
  if (getSiamrajDbSource() !== 'sqlserver') {
    throw Object.assign(new Error('ข้อมูลใบขอไม่ได้ต่อกับ ERP (SQL Server) — ดู Dashboard ใบขอไม่ได้'), { status: 503 });
  }
  // 🔴 คีย์ผูกกับวันเริ่มเท่านั้น — ปลายช่วงคือ "วันนี้" เสมอ (ไม่งั้นคีย์เปลี่ยนทุกวันแล้วต้องรอ ERP ใหม่ทุกวัน)
  const key = `requests:v1:${from}`;
  const outcome = await readThroughSnapshot(key, () => loadRequestSnapshot(from, to), {
    ttlMs: REQUEST_TTL_MS,
    maxStaleMs: REQUEST_MAX_STALE_MS,
    rowCount: (v) => v.requests.length + v.informs.length,
  });
  const { requests, informs } = outcome.value;
  return {
    range: { from, to },
    requests: requests.filter((r) => inScope(scope, r.departmentCode)),
    informs: informs.filter((r) => inScope(scope, normalizeTrendBu(r.departmentCode))),
    fetchedAt: new Date(outcome.fetchedAt).toISOString(),
    ageSeconds: Math.max(0, Math.round((Date.now() - outcome.fetchedAt) / 1000)),
    source: outcome.source,
  };
}

function isSection(v: string): v is DashboardTrendSection {
  return v === 'follow' || v === 'applicants' || v === 'releases' || v === 'requests';
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  const section = getQuery(req, 'section');
  if (!isSection(section)) {
    return sendError(res, 400, 'Bad request', 'section ต้องเป็น follow / applicants / releases / requests');
  }
  const access = checkApiAccess(req.user.role, SECTION_RESOURCE[section], 'GET');
  if (!access.ok) return sendError(res, 403, 'Forbidden', access.message);

  const from = getQuery(req, 'from');
  const today = toBangkokYmd(new Date());
  const to = getQuery(req, 'to') || today;
  if (!YMD_RE.test(from) || !YMD_RE.test(to) || from > to) {
    return sendError(res, 400, 'Bad request', 'ต้องระบุ from/to เป็น YYYY-MM-DD และ from ≤ to');
  }
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
  if (spanDays > MAX_SPAN_DAYS) {
    return sendError(res, 400, 'Bad request', 'ช่วงวันยาวเกิน 7 ปี');
  }

  try {
    res.setHeader?.('Cache-Control', 'no-store');
    if (section === 'follow') {
      return res.status(200).json({ section, range: { from, to }, rows: await loadFollow(from, to) });
    }
    const scope = await loadUserDepartmentScope(req.user);
    if (section === 'applicants') {
      return res.status(200).json({ section, range: { from, to }, rows: await loadApplicants(from, to, scope) });
    }
    if (section === 'releases') {
      return res.status(200).json({ section, range: { from, to }, rows: await loadReleases(from, to, scope) });
    }
    /**
     * ใบขอ: ปลายช่วง = วันนี้ + ครึ่งปี เสมอ (ดูคอมเมนต์ที่คีย์สำเนา)
     * 🔴 ต้องเลยวันนี้ไป — งวดของใบคือ "วันที่ต้องการคน" ใบล่วงหน้าที่กรอกวันนี้แต่ต้องการเดือนหน้า
     * จะหายจากทั้ง "ขอเข้ามา" และ "เหลือหา" ถ้าตัดที่วันนี้
     */
    const payload = await loadRequests(from, addDaysYmd(today, 183), scope);
    res.setHeader?.('x-data-age-seconds', String(payload.ageSeconds));
    return res.status(200).json({ section, ...payload });
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 503) return sendError(res, 503, 'Service unavailable', (e as Error).message);
    return handleApiError(res, e, 'dashboard-trends', { userId: req.user?.sub });
  }
}

export default withAuth(handler);
