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
import {
  queueCancelled,
  queueHasResult,
  queueOutcome,
  queuePending,
  queueResultAt,
  queueSentAt,
  queueWaiting,
} from '../_lib/lumosQueueDefs.js';
import { loadAppointmentByPhone } from '../_lib/applicantCallOutcomes.js';
import { loadContactAppointments } from '../_lib/applicationContacts.js';
import { loadLatestAttendanceByApplication } from '../_lib/applicationAttendance.js';
import { toE164Thai } from '../_lib/thaiPhone.js';
import { inTrendScope, loadRequestTrendPayload } from '../_lib/requestTrendRows.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { siteBuSql } from '../_lib/siteBuSql.js';
import { classifyCallMicro, vocabForPersonRef } from '../../src/lib/callMicroOutcome.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import type { FollowEntry } from '../../src/lib/followApi.js';
import { withFollowDayCalls } from '../../src/lib/followDayCall.js';
import { followGroupKey } from '../../src/lib/followGrouping.js';
import { callCategory, dayVerdictOf, followRoundState, staffDayVerdicts, type FollowPlanningRound } from '../../src/lib/followPlanning.js';
import { followRoundSlot } from '../../src/lib/followRoundBuckets.js';
import { FOLLOW_TEAM_REPLACEMENT } from '../../src/lib/followReplacement.js';
import type {
  ApplicantLumos,
  ApplicantTrendRow,
  DashboardTrendSection,
  LumosCallState,
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

/** BU จากรหัสไซต์ในฝั่ง SQL (ตัวกลาง `siteBuSql`) · แปลงเป็นรหัสแผนกต่อฝั่ง Node */
const SITE_BU = siteBuSql;

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

const inScope = inTrendScope;

/** ════ ติดตาม ════ */
async function loadFollow(from: string, to: string): Promise<FollowTrendRow[]> {
  const outcome = queueOutcome('q');
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select f.id::text as id, f.created_at, f.scheduled_at, f.completed_at, f.cancelled_at,
            f.outcome_code, f.call_round, coalesce(f.call_mode, 'ai') as call_mode,
            right(regexp_replace(coalesce(f.recipient_phone, ''), '\\D', '', 'g'), 9) as phone_key,
            f.staff_call_outcome, f.staff_called_at,
            f.topic, f.unit_name, f.site_code,
            f.created_by::text as staff_id,
            coalesce(nullif(btrim(u.nickname), ''), f.created_by_name) as staff_name,
            coalesce(u.department_code, ${SITE_BU('f.site_code')}) as bu,
            q.status as call_status, ${outcome} as call_outcome, q.attempt_count as attempt,
            case when ${outcome} is not null then coalesce(q.first_result_at, q.updated_at) end as result_at,
            f.follow_team, f.group_id::text as group_id, f.recipient_name, f.recipient_phone, f.source_ref,
            q.result->>'summary' as call_summary,
            (select string_agg(x.t->>'text', ' · ' order by x.ord)
               from jsonb_array_elements(
                      case when jsonb_typeof(q.result->'transcript') = 'array' then q.result->'transcript' else '[]'::jsonb end
                    ) with ordinality as x(t, ord)
              where x.t->>'role' = 'candidate' and coalesce(btrim(x.t->>'text'), '') <> '') as call_reply
       from ${FOLLOW} f
       left join ${USERS} u on u.id = f.created_by
       left join ${QUEUE} q
              on q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text
      where f.created_at < ($2::date + 1)
        and (f.created_at >= $1::date
             -- ช่องของแผงนับตามวันนัดโทร ⇒ สายที่ลงก่อนช่วงแต่นัดในช่วงต้องมาด้วย (6 ต.ค. 2569)
             or (f.scheduled_at >= $1::date and f.scheduled_at < ($2::date + 1))
             or f.completed_at >= $1::date
             or f.cancelled_at >= $1::date
             or f.staff_called_at >= $1::date
             or coalesce(q.first_result_at, q.updated_at) >= $1::date)`,
    [from, to],
  );
  /**
   * 🔴 หมวดของสาย + สายที่ คิดด้วยฟังก์ชันกลางตัวเดียวกับหน้าติดตาม (6 ต.ค. 2569 — เจ้าของ "ตัวเลข… ต้องสอดคล้องกัน")
   * อ่านคำตอบจริง (คำพูด + สรุป) · ผลที่คนกดของวันนั้น (dayVerdict) · ลำดับสายในวัน · ไม่ส่งข้อความออกไปหน้าเว็บ
   */
  const now = new Date();
  const entries = withFollowDayCalls(
    rows.map(
      (r) =>
        ({
          id: String(r.id),
          recipient_name: clean(r.recipient_name) ?? '',
          recipient_phone: clean(r.recipient_phone) ?? '',
          topic: clean(r.topic) ?? '',
          group_id: clean(r.group_id),
          source_ref: clean(r.source_ref),
          scheduled_at: iso(r.scheduled_at),
          completed_at: iso(r.completed_at),
          outcome_code: clean(r.outcome_code),
          cancelled: r.cancelled_at != null,
          call_status: clean(r.call_status),
          call_outcome: clean(r.call_outcome),
          call_summary: clean(r.call_summary),
          call_reply: clean(r.call_reply),
          call_round: r.call_round == null ? null : Number(r.call_round),
          call_attempt: r.attempt == null ? null : Number(r.attempt),
          staff_call_outcome: clean(r.staff_call_outcome),
          staff_called_at: iso(r.staff_called_at),
        }) as unknown as FollowEntry,
    ),
  );
  const verdicts = staffDayVerdicts(entries, followGroupKey);
  const derived = new Map(
    entries.map((e) => {
      const round = {
        entry: e,
        state: followRoundState(e, now),
        time: null,
        ymd: null,
        dayVerdict: dayVerdictOf(verdicts, followGroupKey(e), e.scheduled_at),
      } as FollowPlanningRound;
      return [e.id, { category: callCategory(round), slot: followRoundSlot(e) ?? 1 }] as const;
    }),
  );
  return rows.map((r) => ({
    id: String(r.id),
    team: r.follow_team === FOLLOW_TEAM_REPLACEMENT ? ('replacement' as const) : ('main' as const),
    category: derived.get(String(r.id))?.category ?? 'waiting',
    slot: derived.get(String(r.id))?.slot ?? 1,
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
    phoneKey: clean(r.phone_key),
    staffCallOutcome: clean(r.staff_call_outcome),
    staffCalledAt: iso(r.staff_called_at),
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
  /**
   * คิวโทร Lumos ของใบสมัคร = แถวที่ `person_ref = 'app-<id>'` (ตรงตัว · ตัวเดียวกับ "ส่ง AI แล้ว x/y" บนการ์ด)
   * เอาแถวล่าสุด + นับว่าส่งกี่ครั้ง · 🔴 สรุป/ถอดเสียงใช้จัดถังในนี้เท่านั้น ไม่ส่งออก
   */
  const outcome = queueOutcome('q');
  const { rows } = await dbQuery<Record<string, unknown>>(
    `select a.id::text as id, a.created_at, a.referral_source,
            coalesce(nullif(btrim(a.position_interest), ''), nullif(btrim(a.job_title), '')) as position,
            a.province, a.job_id, coalesce(a.is_lead, false) as is_lead, (a.claimed_by is not null) as claimed,
            coalesce(${SITE_BU('m.site_code')}, a.department_code) as bu,
            a.phone,
            lq.state as q_state, lq.outcome as q_outcome, lq.attempt_count as q_attempt,
            lq.created_at as q_created_at, lq.result_at as q_result_at, lq.waiting_since as q_waiting_since,
            lq.summary as q_summary, lq.reply as q_reply, lq.sends as q_sends
       from ${APPS} a
       left join ${MAP} m on m.job_id = a.job_id
       left join lateral (
         select ${outcome} as outcome, q.attempt_count, q.created_at,
                case when ${outcome} is not null then ${queueResultAt('q')} end as result_at,
                case when ${queueCancelled('q')} then 'cancelled'
                     when ${queueHasResult('q')} then 'called'
                     when ${queueWaiting('q')} then 'waiting'
                     else 'pending' end as state,
                case when ${queuePending('q')} then coalesce(q.next_attempt_at, q.created_at)
                     when ${queueWaiting('q')} then ${queueSentAt('q')} end as waiting_since,
                q.result->>'summary' as summary,
                (select string_agg(btrim(x.t->>'text'), ' · ')
                   from jsonb_array_elements(
                          case when jsonb_typeof(q.result->'transcript') = 'array'
                               then q.result->'transcript' else '[]'::jsonb end
                        ) x(t)
                  where x.t->>'role' = 'candidate'
                    and coalesce(btrim(x.t->>'text'), '') <> '') as reply,
                count(*) over () as sends
           from ${QUEUE} q
          where q.person_ref = 'app-' || a.id::text
          order by q.created_at desc
          limit 1
       ) lq on true
      where a.created_at >= $1::date and a.created_at < ($2::date + 1)`,
    [from, to],
  );
  const scoped = rows
    .map((r) => ({ r, bu: normalizeTrendBu(clean(r.bu)) }))
    .filter((x) => inScope(scope, x.bu));
  const phones = scoped.map((x) => String(x.r.phone ?? ''));
  const ids = scoped.map((x) => String(x.r.id));
  // ⚠️ ใช้ตัวอ่านชุดเดียวกับแท็บรายชื่อผู้สมัคร — นัด/มาตามนัด ต้องตรงกับที่แท็บนั้นโชว์
  const [apptByPhone, apptByApp, attendance] = await Promise.all([
    loadAppointmentByPhone(phones),
    loadContactAppointments(ids),
    loadLatestAttendanceByApplication(ids),
  ]);
  return scoped.map(({ r, bu }) => {
    const e164 = toE164Thai(String(r.phone ?? '')) || '';
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
      appointmentAt: appt ? iso(appt) : null,
      attendance: attendance.get(String(r.id))?.result ?? null,
      phoneOk: Boolean(e164),
      lumos: toApplicantLumos(r),
    };
  });
}

/**
 * แถวคิวล่าสุด → สถานะ Lumos — สถานะคิดใน SQL ด้วยนิยามกลาง `lumosQueueDefs` (ยกเลิก → มีผล → รอผล → ยังไม่ถึงมือ)
 * ถังผลจัดด้วยคลังคำ "ถามความสนใจ" (`vocabForPersonRef('app-…')`) ตัวเดียวกับแผง Rate ผลโทร
 */
function toApplicantLumos(r: Record<string, unknown>): ApplicantLumos | null {
  if (r.q_created_at == null && r.q_state == null) return null;
  const raw = clean(r.q_state);
  const state: LumosCallState = raw === 'cancelled' || raw === 'called' || raw === 'waiting' ? raw : 'pending';
  const outcome = clean(r.q_outcome);
  const micro =
    state === 'called'
      ? classifyCallMicro(
          { outcome, summary: clean(r.q_summary), reply: clean(r.q_reply) },
          vocabForPersonRef(`app-${String(r.id)}`),
        )
      : null;
  return {
    state,
    sends: Number(r.q_sends) || 1,
    attempt: r.q_attempt == null ? null : Number(r.q_attempt),
    queuedAt: iso(r.q_created_at),
    waitingSince: iso(r.q_waiting_since),
    resultAt: iso(r.q_result_at),
    outcome,
    micro,
  };
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

/** ════ ใบขอ (ERP ผ่านสำเนา) — ย้ายไป `api/_lib/requestTrendRows.ts` 29 ก.ย. 2569 (หน้าหลักใช้สำเนาชุดเดียวกัน) ════ */
const loadRequests = (from: string, to: string, scope: DepartmentScope): Promise<RequestTrendPayload> =>
  loadRequestTrendPayload(from, to, (bu) => inScope(scope, bu));

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
