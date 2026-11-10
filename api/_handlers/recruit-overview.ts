/**
 * GET /api/recruit-overview?month=YYYY-MM | ?from=YYYY-MM-DD&to=YYYY-MM-DD (รายวัน/ช่วง · 5 ต.ค. 2569) — หน้า "ภาพรวมงานสรรหา" แบบ iRecruit (แท็บภาพรวมของกล่องงาน · 30 ก.ย. 2569)
 *
 * เจ้าของ: *"ทำหน้าภาพรวมให้เหมือน iRecruit ต่อเลย"* → Choice "ทั้งหน้าเป็น iRecruit" · "เลือกเดือนแบบ iRecruit" ·
 * นับโทร/ติดต่อสำเร็จแบบ "AI + คน" แล้ว *"บอกว่า มีกี่ใบที่ประกาศไป แล้วมีรายชื่อมาเท่าไหร่ Ai โทรไปให้ทั้งหมดเท่าไหร่
 * เหลือสนใจแล้วคนมาโทรอีกเท่าไหร่ … ต้องบอกด้วยว่า กรอกมาวันนี้โดนโทรวันไหน จะนับเป็นวันต้องครบ 24 ชม"*
 *
 * 🔴 กติกาของเส้นนี้:
 * 1. **อ่านอย่างเดียว** · ไม่มีนิยามใหม่ — ทุกช่องต่อใบมาจาก `applicantOverviewSql.ts` (ตัวเดียวกับกล่องงาน/หน้าหลัก)
 * 2. ประชากร = ใบสมัครที่ไม่ใช่ Lead ตามวันกรอก + BU กลาง `appBuSql` (ชุดเดียวกับหน้าหลัก "ระบบไปกี่ %")
 *    ผู้ใช้ผูกแผนก = BU ของตัวเองเสมอ (`loadMatchingBuScope`)
 * 3. **ไม่คืนชื่อ/เบอร์ผู้สมัคร** — ต่อใบมีแต่ข้อเท็จจริง · ชื่อเจ้าหน้าที่มีแค่ยอดรวมรายคน (อนุญาตบน Dashboard 15 ส.ค. 2569)
 * 4. ก้อนล้มแยกกัน — อ่านไม่ได้ = null + เหตุใน `errors` (ห้ามโชว์ 0 แทน)
 * 5. "ใบที่ประกาศ" ไม่ได้คิดที่เส้นนี้ — หน้าเว็บใช้เลขของหัวกล่องงานตรง ๆ (เจ้าของสั่ง 1 ต.ค. 2569:
 *    *"เปลี่ยนเป็น 7 เหมือนหัวกล่องงาน"*) · เดิมนับใบที่ประกาศในเดือนจาก `job_public_releases` — ถอดแล้ว
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery, isPgUndefinedTable } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadMatchingBuScope, type DepartmentScope } from '../_lib/departmentScope.js';
import { appBuJoin, appBuSql, pickDashboardBu, pickDashboardBuSet } from '../_lib/homeBuSql.js';
import {
  AI_RESULT_AT_SQL,
  AI_RESULT_BY_PHONE_SQL,
  AI_RESULT_BY_REF_SQL,
  AI_RESULT_COUNTED_SQL,
  AI_RESULT_OUTCOME_SQL,
  APPOINTMENT_AT_SQL,
  CALLED_BY_AI_SQL,
  CALLED_BY_STAFF_SQL,
  CALLED_SQL,
  CONNECTED_OUTCOMES,
  FIRST_CALLED_AT_SQL,
  IN_QUEUE_SQL,
  LATEST_AI_RESULT_LATERAL,
  LATEST_ATTENDANCE_SQL,
  LATEST_CONTACT_LATERAL,
  LATEST_STAFF_RESULT_LATERAL,
  OVERVIEW_BUCKETS,
  STAFF_LAST_AT_SQL,
  firstStaffAtSinceSql,
  UPCOMING_7D_NO_RESULT_SQL,
  holdEventAtSql,
} from '../_lib/applicantOverviewSql.js';
import { queueReplySql } from '../_lib/lumosQueueDefs.js';
import { loadBoardPhoneSet } from '../_lib/applicationBoardLink.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { logError } from '../_lib/logger.js';
import { loadStaffDisplay } from '../_lib/staffDisplay.js';
import { INTEREST_VOCAB, classifyCallMicro } from '../../src/lib/callMicroOutcome.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import { emptyRegionCount, regionOfProvince, type Region } from '../../src/lib/bkkRegion.js';
import { boardProvinceOf } from '../../src/lib/boardFilters.js';
import { listSiamrajUnitRequests } from '../_lib/siamrajUnitRequests.js';
import { getUnitAssignmentsMap } from '../_lib/siamrajUnitAssignments.js';
import { publicJobTitle } from '../../src/lib/publicJobTitle.js';
import type { JobRequest } from '../../src/types/index.js';
import { addDays } from '../../src/lib/trends/timeBuckets.js';
import { monthWindow, rangeWindow } from '../../src/lib/recruitOverviewWindow.js';
import { fullDaysSince } from '../../src/lib/fullDays.js';
import { isOverAge } from '../../src/lib/applicantAge.js';
import { isOutOfAreaAnswer } from '../../src/lib/outOfAreaAnswer.js';
import { loadOnlineRequestRows } from '../_lib/homeOnlineSql.js';
import { getUnitNotesMap } from '../_lib/siamrajUnitNotes.js';
import { canonProvinceName } from '../../src/lib/thaiProvinces.js';
import { parseThaiAddressParts } from '../../src/lib/parseThaiJobAddress.js';
import { getDistrictOptionsForProvince } from '../../src/lib/thaiDistricts.js';
import { requestSectorOf, type RecruitRequestRow } from '../../src/lib/recruitRequestTab.js';
import { onlineRequestStateOf, type OnlineRequestRow } from '../../src/lib/homeOnline.js';
import { loadChannelPlacement } from '../_lib/channelPlacementSql.js';
import { loadInformDaysByPhone, loadIrecruitApplicantDays, loadIrecruitRegsByPhone } from '../_lib/applicantSourceSql.js';
import { firstDaySince, informedSince, irecruitSourceAt, phone9Of } from '../../src/lib/applicantSourceMatch.js';
import { SO_LINK_NOTE } from '../../src/lib/soScraping.js';
import type {
  RecruitAiRow,
  RecruitAppFact,
  RecruitAppJob,
  RecruitAttendance,
  RecruitBacklog,
  RecruitOverviewResponse,
  RecruitRequestSummary,
  RecruitRequestDay,
  RecruitRequestItem,
  RecruitStaffRow,
} from '../../src/lib/recruitOverviewTypes.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTEND = tableInAppSchema('application_appointment_results');
const SCREEN = tableInAppSchema('application_screening_results');
const REASONS = tableInAppSchema('recruit_reasons');

/** ผ่าน/ไม่ผ่าน ล่าสุดของใบ (151 · 18 ต.ค. 2569) */
export const LATEST_SCREENING_SQL = `(
    select s.result from ${SCREEN} s
     where s.application_id = a.id
     order by s.appointment_at desc nulls last, s.created_at desc limit 1
  )`;

/** จุดเริ่มของวันไทย (รวม) / วันถัดไป (ไม่รวม) */
const startOfBkk = (ymd: string) => `${ymd}T00:00:00+07:00`;

/**
 * BU ของใบสมัครอยู่ในชุดที่ขอ — `$bu` = `text[]` · null = ไม่กรอง (แอดมิน)
 * ชุด ไม่ใช่ BU เดียว: ผู้ใช้หลาย BU ค่าเริ่มเห็นผลรวมทุก BU ในสิทธิ์ (เจ้าของ 29 ต.ค. 2569 "default คือ ผลรวมของทุก bu")
 */
const buInSql = (bu: string) => `(${bu}::text[] is null or ${appBuSql('a')} = any(${bu}::text[]))`;

/** ประชากรของทุกก้อน — ไม่ใช่ Lead + BU (ถ้าล็อก) · `$bu` = ตำแหน่งพารามิเตอร์ของ BU */
// ใบที่ยกเลิกข้อมูลแล้วไม่นับ (135) — กติกาเดียวกับหน้าหลัก/รายชื่อผู้สมัคร · กดเลขแล้วเปิดชื่อได้ครบ (QA 18 ต.ค. 2569)
const CANCELLATIONS = tableInAppSchema('application_cancellations');
/** ลิงก์รับสมัคร — ช่องทาง/กลุ่มติดที่ลิงก์ ไม่ได้คัดลอกลงใบสมัคร (19 ต.ค. 2569 · 383 จาก 502 ใบ) */
const POSTING_LINKS = tableInAppSchema('recruit_posting_links');
const JOB_POSTING_REQUESTS = tableInAppSchema('job_posting_requests');
const POSTINGS_TABLE = tableInAppSchema('recruit_postings');
const scopeWhere = (bu: string) =>
  `not coalesce(a.is_lead, false) and not exists (select 1 from ${CANCELLATIONS} cx where cx.application_id = a.id) and ${buInSql(bu)}`;

/** ข้อเท็จจริงต่อใบของช่วง [$1, $2) · $3 = BU · `attendance` = นิพจน์ผลนัด (ตารางยังไม่มี = null) */
export function factsSql(
  attendance: string = LATEST_ATTENDANCE_SQL,
  screening: string = LATEST_SCREENING_SQL,
  /** true = ใบสมัครของใบขอชุดนี้ทุกช่วงเวลา ($1 = job_id[] · $2 = BU) — เส้น 12 ขั้นรายใบขอบนหน้าหลัก (22 ต.ค. 2569) */
  byJobs = false,
): string {
  return `
  select a.id::text as id, a.created_at, a.job_id,
         -- ช่องทางของใบ → ไม่มี = ช่องทางของลิงก์ที่กรอกผ่าน (19 ต.ค. 2569)
         coalesce(nullif(btrim(a.channel_label), ''),
                  (select nullif(btrim(l.channel_label), '') from ${POSTING_LINKS} l where l.id = a.link_id)) as channel_label,
         nullif(btrim(a.referral_source), '') as referral_source,
         -- ลิงก์ที่กรอกผ่าน → Autopost หรือโพสต์เอง (เจ้าของ 9 พ.ย. 2569) · คิดฝั่ง Node (postSourceOf)
         (select l.code from ${POSTING_LINKS} l where l.id = a.link_id) as link_code,
         (select nullif(btrim(l.note), '') from ${POSTING_LINKS} l where l.id = a.link_id) as link_note,
         -- ใครหารายชื่อมา: คนสร้างลิงก์ › ผู้รับผิดชอบ/คนสร้างประกาศ (ลิงก์เก่า) · ไม่มีลิงก์ = คนเพิ่ม/นำเข้า (9 พ.ย. 2569)
         case when a.link_id is not null then
           (select coalesce(nullif(btrim(l.created_by_name), ''), nullif(btrim(pp.responsible_name), ''), nullif(btrim(pp.created_by_name), ''))
              from ${POSTING_LINKS} l left join ${POSTINGS_TABLE} pp on pp.id = l.posting_id where l.id = a.link_id)
         else nullif(btrim(a.created_by_name), '') end as bringer,
         nullif(btrim(a.position_interest), '') as position,
         a.phone_e164, a.age,
         ${CALLED_BY_AI_SQL} as by_ai,
         ${CALLED_BY_STAFF_SQL} as by_staff,
         ${FIRST_CALLED_AT_SQL} as first_called_at,
         air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply, air.at as ai_at,
         str.outcome as staff_outcome, str.at as staff_at,
         ${STAFF_LAST_AT_SQL} as staff_last_at,
         ${firstStaffAtSinceSql('coalesce(air.at, a.created_at)')} as staff_first_at,
         lc.cls as contact_class, lc.src as contact_src,
         lcl.ok as log_ok, lcl.reason_label as log_reason, lcl.created_at as log_at,
         lcl.appointment_at as log_appointment_at,
         ${IN_QUEUE_SQL} as in_queue,
         ${APPOINTMENT_AT_SQL} as appointment_at,
         ${attendance} as attendance,
         ${screening} as screening,
         -- คนที่เก็บไปหน้าการติดต่อ (4 พ.ย. 2569 "แบงค์เก็บไปหน้าการติดต่อ 30 …") — อีเมลแปลงเป็นชื่อเล่นฝั่ง Node
         case when a.claimed_by is not null then coalesce(nullif(btrim(a.claimed_by_name), ''), 'ไม่ระบุชื่อ') end as claimed_by
    from ${APPS} a
    ${appBuJoin('a')}
    ${LATEST_AI_RESULT_LATERAL}
    ${LATEST_STAFF_RESULT_LATERAL}
    ${LATEST_CONTACT_LATERAL}
    left join lateral (
      -- ชื่อเหตุผลปัจจุบันจาก master (แก้ชื่อที่ตั้งค่าแล้วการ์ดเปลี่ยนตาม · QA 18 ต.ค. 2569) · ไม่มี master = ชื่อที่จดไว้ตอนบันทึก
      select c.ok, coalesce(nullif(btrim(rr.name), ''), nullif(btrim(c.reason_label), '')) as reason_label, c.created_at, c.appointment_at
        from ${CONTACTS} c
        left join ${REASONS} rr on rr.id = c.reason_id
       where c.application_id = a.id
       order by c.created_at desc limit 1
    ) lcl on true
   where ${byJobs ? `a.job_id = any($1::text[]) and ${scopeWhere('$2')}` : `a.created_at >= $1::timestamptz and a.created_at < $2::timestamptz
     and ${scopeWhere('$3')}`}`;
}

/** งานค้างตอนนี้ — ทุกใบในขอบเขต (ไม่ขึ้นกับเดือน) · $1 = BU */
export function backlogSql(): string {
  return `
  select a.created_at, a.job_id, (a.phone_e164 is null) as bad_phone,
         ${CALLED_SQL} as called,
         ${IN_QUEUE_SQL} as in_queue,
         air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply, air.at as ai_at,
         ${STAFF_LAST_AT_SQL} as staff_last_at
    from ${APPS} a
    ${appBuJoin('a')}
    ${LATEST_AI_RESULT_LATERAL}
   where ${scopeWhere('$1')}`;
}

/**
 * นัดที่รอบันทึกผล — ถังเดียวกับกล่องงาน (`overdue_no_result`) + นัดใน 7 วันข้างหน้า · $1 = BU
 * 🔴 นับนัดของใบ Lead ด้วย (เจ้าของ Choice 10 ต.ค. 2569 "นับด้วย") — นัดของ Lead ก็ต้องบันทึกผลเหมือนกัน
 * ⇒ เท่ากับปุ่ม "ทุกคน" ของแท็บติดตามนัดหมาย · ก้อนอื่นของภาพรวมยังไม่นับ Lead ตามเดิม (`scopeWhere`)
 */
export function appointmentBacklogSql(): string {
  return `
  select a.job_id,
         count(*) filter (where ${OVERVIEW_BUCKETS.overdue_no_result})::int as overdue,
         count(*) filter (where ${UPCOMING_7D_NO_RESULT_SQL})::int as next7
    from ${APPS} a
    ${appBuJoin('a')}
   where ${buInSql('$1')}
   group by a.job_id`;
}

/** ผลงานรายคนของเดือน [$1, $2) · $3 = BU — คืนแถวดิบ (ใบ × คน) ให้นับรายชื่อไม่ซ้ำฝั่ง Node */
export function staffEventsSql(): string {
  return `
  select 'claim'::text as kind, a.id::text as app_id, nullif(btrim(a.claimed_by_name), '') as name,
         null::boolean as reached, false as appt, a.job_id
    from ${APPS} a ${appBuJoin('a')}
   where a.claimed_by is not null and a.claimed_at >= $1::timestamptz and a.claimed_at < $2::timestamptz
     and ${scopeWhere('$3')}
  union all
  select 'log', a.id::text, nullif(btrim(c.created_by_name), ''), c.ok, (c.ok and c.appointment_at is not null), a.job_id
    from ${CONTACTS} c
    join ${APPS} a on a.id = c.application_id
    ${appBuJoin('a')}
   where c.created_at >= $1::timestamptz and c.created_at < $2::timestamptz
     and ${scopeWhere('$3')}
  union all
  select 'hold', a.id::text, nullif(btrim(h.held_by_name), ''), (h.result_outcome in ${CONNECTED_OUTCOMES}),
         (h.appointment_at is not null), a.job_id
    from ${HOLDS} h
    join ${APPS} a on h.source = 'application' and h.candidate_ref = a.id::text
    ${appBuJoin('a')}
   where h.result_outcome is not null
     and ${holdEventAtSql('h')} >= $1::timestamptz and ${holdEventAtSql('h')} < $2::timestamptz
     and ${scopeWhere('$3')}`;
}

/** ผล "มา" ที่บันทึกในเดือน [$1, $2) · $3 = BU */
export function showedSql(): string {
  return `
  select distinct a.id::text as app_id
    from ${ATTEND} r
    join ${APPS} a on a.id = r.application_id
    ${appBuJoin('a')}
   where r.result = 'showed' and r.created_at >= $1::timestamptz and r.created_at < $2::timestamptz
     and ${scopeWhere('$3')}`;
}

/** ผลโทรของ AI ที่ได้ในเดือน [$1, $2) · $3 = BU — หลักฐานชุดเดียวกับ `CALLED_BY_AI_SQL` */
export function aiEventsSql(): string {
  const cols = `a.id::text as app_id, ${AI_RESULT_OUTCOME_SQL} as outcome,
         q.result->>'summary' as summary, ${queueReplySql('q')} as reply,
         ${AI_RESULT_AT_SQL} as at,
         (${AI_RESULT_OUTCOME_SQL} in ${CONNECTED_OUTCOMES}) as reached, a.job_id`;
  /**
   * 🔴 28 ต.ค. 2569 (เจ้าของ "จะเปลี่ยนวันดู โหลดนานมาก") — เดิม join ด้วย "รหัสตรง OR เบอร์ตรง" ก้อนเดียว ใช้ 5.6–9.8 วิ
   * ⇒ กรองผลในช่วงก่อน แล้วแตกเป็น 2 join (รหัสใบ · เบอร์หลังเวลากรอก) รวมด้วย union — หลักฐานชุดเดิม (`AI_RESULT_OF_APP_SQL`)
   */
  return `
  with q as (
    select q.* from ${QUEUE} q
     where ${AI_RESULT_AT_SQL} >= $1::timestamptz and ${AI_RESULT_AT_SQL} < $2::timestamptz
       and ${AI_RESULT_COUNTED_SQL}
  )
  select ${cols}
    from q join ${APPS} a on ${AI_RESULT_BY_REF_SQL}
    ${appBuJoin('a')}
   where ${scopeWhere('$3')}
  union
  select ${cols}
    from q join ${APPS} a on ${AI_RESULT_BY_PHONE_SQL}
    ${appBuJoin('a')}
   where ${scopeWhere('$3')}`;
}

/** วันแรก (ไทย) ที่มีใบสมัครในขอบเขต — ปุ่มถอยเดือนหยุดที่เดือนนี้ · ช่วงเทียบที่ข้อมูลเพิ่งเริ่มกลางช่วงต้องบอก */
export function firstDaySql(): string {
  return `
  select to_char(timezone('Asia/Bangkok', min(a.created_at)), 'YYYY-MM-DD') as first_day
    from ${APPS} a
    ${appBuJoin('a')}
   where ${scopeWhere('$1')}`;
}

const iso = (v: unknown): string | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const text = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s ? s : null;
};

const bool = (v: unknown) => v === true || v === 't' || v === 'true';

const micro = (outcome: unknown, summary: unknown, reply: unknown) =>
  outcome ? classifyCallMicro({ outcome: text(outcome), summary: text(summary), reply: text(reply) }, INTEREST_VOCAB) : null;

const ATTENDANCE_VALUES: readonly RecruitAttendance[] = ['showed', 'no_show', 'rescheduled'];

/** ครบ 24 ชม. ถึงนับเป็น 1 วัน (กติกาเจ้าของ · ตัวนับกลาง `fullDays.ts`) · อ่านเวลาไม่ได้ = 0 */
const fullDays = (fromIso: string | null, now: number) => fullDaysSince(fromIso, new Date(now)) ?? 0;

type Row = Record<string, unknown>;

/** แจ้งเข้า ERP + ช่องทาง iRecruit ต่อเบอร์ (19 ต.ค. 2569) — null = อ่านไม่ได้ */
export type AppSourceMaps = {
  informDays: ReadonlyMap<string, readonly string[]> | null;
  irecruitRegs: ReadonlyMap<string, ReadonlyArray<{ at: string; channel: string; sub?: string | null }>> | null;
  /** วันเป็นผู้สมัครใน iRecruit ต่อเบอร์ (20 ต.ค. 2569) */
  irecruitApplicants?: ReadonlyMap<string, readonly string[]> | null;
  /** รหัสลิงก์ที่ใบสั่ง Autopost เคยใช้ (ลิงก์รุ่นก่อนจด note · 9 พ.ย. 2569) · null = อ่านไม่ได้ */
  autopostCodes?: ReadonlySet<string> | null;
};

/** ลิงก์ของใบ → Autopost / โพสต์เอง · ไม่มีลิงก์ = null · อ่านใบสั่ง Autopost ไม่ได้ + ลิงก์ไม่มี note = null (ไม่เดา) */
export function postSourceOf(code: string | null, note: string | null, autopostCodes: ReadonlySet<string> | null | undefined): 'autopost' | 'manual' | null {
  if (!code) return null;
  if (note === SO_LINK_NOTE.autopost || autopostCodes?.has(code)) return 'autopost';
  if (note === SO_LINK_NOTE.manual) return 'manual';
  return autopostCodes ? 'manual' : null;
}

const IRECRUIT_LABEL = /^irecruit/i;

export function toFact(r: Row, boardPhones: Set<string> | null, sources?: AppSourceMaps): RecruitAppFact {
  const phone = text(r.phone_e164);
  const p9 = phone9Of(phone);
  const createdAt = iso(r.created_at) ?? '';
  const fromIrecruit = IRECRUIT_LABEL.test(text(r.channel_label) ?? '') || IRECRUIT_LABEL.test(text(r.referral_source) ?? '');
  const irec = sources && fromIrecruit ? irecruitSourceAt(sources.irecruitRegs, p9, createdAt) : null;
  const contact = r.contact_class === 'success' || r.contact_class === 'failed' ? r.contact_class : null;
  const src = r.contact_src === 'ai' || r.contact_src === 'staff' ? r.contact_src : null;
  const att = ATTENDANCE_VALUES.find((v) => v === r.attendance) ?? null;
  return {
    // id ใบ (ไม่ใช่ชื่อ/เบอร์) — ให้หน้าเปิดรายชื่อของเลขที่กดได้ (QA 18 ต.ค. 2569 · ชื่อดึงจากเส้นรายชื่อผู้สมัครที่มีสิทธิ์อยู่แล้ว)
    id: text(r.id) ?? undefined,
    createdAt: iso(r.created_at) ?? '',
    jobId: text(r.job_id),
    channelLabel: text(r.channel_label),
    referralSource: text(r.referral_source),
    position: text(r.position),
    phoneOk: Boolean(phone),
    calledByAi: bool(r.by_ai),
    calledByStaff: bool(r.by_staff),
    firstCalledAt: iso(r.first_called_at),
    aiAnswer: micro(r.ai_outcome, r.ai_summary, r.ai_reply),
    aiAnswerAt: iso(r.ai_at),
    staffAnswer: micro(r.staff_outcome, null, null),
    staffAnswerAt: iso(r.staff_at),
    staffLastAt: iso(r.staff_last_at),
    staffFirstAt: iso(r.staff_first_at),
    contact,
    contactBy: contact ? src : null,
    logOk: typeof r.log_ok === 'boolean' ? r.log_ok : null,
    logReason: text(r.log_reason),
    logAt: iso(r.log_at),
    appointmentAt: iso(r.appointment_at),
    attendance: att,
    aiQueued: bool(r.in_queue),
    // นัดไม่สำเร็จ = บันทึกติดต่อสำเร็จ + เหตุผล + ไม่มีวันนัด (ตัวเดียวกับ `isAppointmentFailedLog`)
    appointmentFailed: r.log_ok === true && Boolean(text(r.log_reason)) && !r.log_appointment_at,
    screening: r.screening === 'passed' || r.screening === 'not_passed' ? r.screening : null,
    claimedBy: text(r.claimed_by),
    overAge: isOverAge(r.age as number | string | null),
    aiOutOfArea: Boolean(r.ai_outcome) && isOutOfAreaAnswer(text(r.ai_summary), text(r.ai_reply)),
    onBoard: boardPhones ? Boolean(phone && boardPhones.has(phone)) : null,
    informed: sources ? informedSince(sources.informDays, p9, createdAt) : null,
    sourceChannel: irec?.channel ?? null,
    sourceSub: irec?.sub ?? null,
    irecruitAt: sources ? firstDaySince(sources.irecruitApplicants ?? null, p9, createdAt) : undefined,
    informedAt: sources ? firstDaySince(sources.informDays, p9, createdAt) : undefined,
    postSource: sources ? postSourceOf(text(r.link_code), text(r.link_note), sources.autopostCodes) : undefined,
    bringer: sources ? text(r.bringer) : undefined,
  };
}

/** ใบยังเปิด (`onlineRequestStateOf`) — แถวที่ไม่มีช่องอัตรา (เทสต์/ข้อมูลเก่า) = ถือว่าเปิด */
type ReqStateRow = { releasedAt: string | null; applications: number; filled?: number; cancelled?: number; remaining?: number };
const isOpenRequest = (r: ReqStateRow) =>
  typeof r.remaining !== 'number' || onlineRequestStateOf({ filled: r.filled ?? 0, cancelled: r.cancelled ?? 0, remaining: r.remaining }) === 'open';

/**
 * สรุปใบขอ — ประกาศแล้ว/ยังไม่ประกาศ · ในใบที่ประกาศ มีคนสมัครกี่ใบ กรอกมากี่คน
 * + ยังไม่ประกาศแยก ใบยังเปิด / ปิดไปแล้ว (เจ้าของ 27 ต.ค. 2569 การ์ด "แนวโน้มใบขอ") — ตัวแบ่งเดียวกับการ์ดกดลงลึก
 */
export function toRequestSummary(rows: ReadonlyArray<ReqStateRow>): RecruitRequestSummary {
  const released = rows.filter((r) => r.releasedAt);
  const withApps = released.filter((r) => r.applications > 0);
  const notReleasedOpen = rows.filter((r) => !r.releasedAt && isOpenRequest(r)).length;
  return {
    total: rows.length,
    released: released.length,
    notReleased: rows.length - released.length,
    notReleasedOpen,
    notReleasedClosed: rows.length - released.length - notReleasedOpen,
    releasedWithApps: withApps.length,
    releasedNoApps: released.length - withApps.length,
    appsOnReleased: withApps.reduce((n, r) => n + r.applications, 0),
  };
}

/**
 * ใบขอรายใบ + id ผู้สมัครของใบ — การ์ดกดลงลึกแท็บใบขอ (เจ้าของ 21 ต.ค. 2569 ไอเดีย "กดที่มีคนกรอกก็เห็นว่ามีชื่ออะไรบ้าง")
 * ผู้สมัครไม่นับที่ยกเลิกข้อมูล (ฐานเดียวกับ `applications`) · อ่าน id ไม่ได้ = รายการว่าง (เลขยังอยู่)
 */
async function loadRequestList(
  rows: ReadonlyArray<
    { jobId: string | null; requestNo: string; unitName: string | null; position: string | null; day: string; releasedAt: string | null; applications: number } & Pick<
      OnlineRequestRow,
      'filled' | 'cancelled' | 'remaining'
    >
  >,
): Promise<RecruitRequestItem[]> {
  const jobIds = rows.map((r) => r.jobId).filter((j): j is string => !!j);
  const ids = new Map<string, string[]>();
  if (jobIds.length > 0) {
    try {
      const { rows: apps } = await dbQuery<{ job_id: string; ids: string[] }>(
        `select a.job_id, array_agg(a.id::text order by a.created_at desc) as ids
           from ${APPS} a
          where a.job_id = any($1::text[])
            and not exists (select 1 from ${CANCELLATIONS} c where c.application_id = a.id)
          group by a.job_id`,
        [jobIds],
      );
      for (const r of apps) ids.set(r.job_id, r.ids ?? []);
    } catch (e) {
      logError('recruit-overview: requestList ids', e);
    }
  }
  return rows.map((r) => ({
    jobId: r.jobId,
    requestNo: r.requestNo,
    unitName: r.unitName,
    position: r.position,
    day: r.day,
    released: !!r.releasedAt,
    open: onlineRequestStateOf(r) === 'open',
    applications: r.applications,
    appIds: (r.jobId && ids.get(r.jobId)) || [],
  }));
}

/**
 * ใบขอรายใบของแท็บใบขอ (29 ต.ค. 2569) — พื้นที่ + ประเภทงาน + ความเร่ง (นิยามอยู่ `recruitRequestTab.ts`)
 * จังหวัด: ที่เจ้าหน้าที่แก้ในใบ › อ่านจากที่อยู่หน้างาน › จังหวัดของไซต์ใน ERP
 *   (ไซต์ธนาคารผูกสำนักงานใหญ่ กทม. แต่หน้างานอยู่สาขา เช่น SCB สาขาแก่งคอย สระบุรี)
 * อำเภอ/ตำบล: ที่แก้ในใบ › อ่านจากที่อยู่ — อำเภอต้องมีจริงในจังหวัดนั้น ไม่งั้น "ไม่ระบุ" (กันคำเพี้ยน "เขตธุรกิจ SME")
 * อ่านที่แก้ในใบไม่ได้ = ใช้ของ ERP ต่อ (ข้อมูลเสริม ห้ามทำทั้งก้อนล้ม)
 */
const bareDistrict = (d: string) => d.replace(/^(เขต|อำเภอ|อ\.)\s*/u, '').trim();
/** ชื่ออำเภอตามรายชื่อทางการของจังหวัด · ไม่เจอ: ที่เจ้าหน้าที่พิมพ์เอง = ใช้ตามนั้น · ที่อ่านจากที่อยู่ = ทิ้ง (กันคำเพี้ยน) */
function officialDistrict(raw: string | null | undefined, official: readonly string[], typed: boolean): string | null {
  const d = (raw ?? '').trim();
  if (!d) return null;
  const hit = official.find((o) => o === d || bareDistrict(o) === bareDistrict(d));
  return hit ?? (typed ? d : null);
}
/** ตำบล/แขวง ไม่มีคำนำหน้า — ที่แก้ในใบกับที่อ่านจากที่อยู่สะกดไม่เหมือนกัน */
const bareSubdistrict = (v: string | null | undefined) => (v ?? '').replace(/^(ตำบล|แขวง|ต\.)\s*/u, '').trim() || null;

export async function toRequestRows(rows: readonly OnlineRequestRow[]): Promise<RecruitRequestRow[]> {
  let notes: Awaited<ReturnType<typeof getUnitNotesMap>> = new Map();
  try {
    notes = await getUnitNotesMap(rows.map((r) => r.requestNo));
  } catch (e) {
    logError('recruit-overview: ที่อยู่ที่แก้ในใบ', e);
  }
  return rows.map((r) => {
    const fo = notes.get(r.requestNo)?.field_overrides ?? null;
    const addr = r.erp?.workAddr ?? '';
    const erpProv = r.erp?.province ? canonProvinceName(r.erp.province) || r.erp.province : null;
    const fromAddr = parseThaiAddressParts(addr);
    const province = fo?.province || fromAddr.province || erpProv;
    // อ่านซ้ำโดยต่อจังหวัดท้าย ให้ตัวอ่านเทียบชื่ออำเภอกับรายชื่อจริงของจังหวัดนั้นได้
    const parts = province && !addr.includes(province) ? parseThaiAddressParts(`${addr} จังหวัด${province}`) : fromAddr;
    const official = province ? getDistrictOptionsForProvince(province) : [];
    // ชื่อตามรายชื่อทางการ ("ปทุมวัน" ที่แก้ในใบ = "เขตปทุมวัน") ไม่งั้นเขตเดียวกันแตกเป็นสองแถว
    const district = officialDistrict(fo?.district, official, true) ?? officialDistrict(parts.district, official, false);
    return {
      requestNo: r.requestNo,
      jobId: r.jobId,
      day: r.day,
      unitName: r.unitName,
      position: r.position,
      siteCode: r.siteCode ?? null,
      siteName: r.erp?.siteName ?? null,
      sector: requestSectorOf(r.industry, r.erp?.customerGroup, r.sector),
      province,
      district,
      subdistrict: bareSubdistrict(fo?.subdistrict) || (district ? bareSubdistrict(parts.subdistrict) : null),
      leadKind: r.leadKind ?? null,
      subtype: r.subtype ?? null,
      requested: r.requested,
      filled: r.filled,
      cancelled: r.cancelled,
      remaining: r.remaining,
      released: Boolean(r.releasedAt),
      applications: r.applications,
    };
  });
}

/** ใบขอรายวัน (วันที่ใบเข้ามา) — กราฟรายวันของแท็บใบขอ (21 ต.ค. 2569) */
export function toRequestDays(rows: ReadonlyArray<ReqStateRow & { day: string }>): RecruitRequestDay[] {
  const by = new Map<string, RecruitRequestDay>();
  for (const r of rows) {
    const d =
      by.get(r.day) ?? { day: r.day, total: 0, released: 0, releasedWithApps: 0, releasedNoApps: 0, notReleasedOpen: 0, notReleasedClosed: 0 };
    by.set(r.day, d);
    d.total += 1;
    if (r.releasedAt) {
      d.released += 1;
      if (r.applications > 0) d.releasedWithApps += 1;
      else d.releasedNoApps += 1;
    } else if (isOpenRequest(r)) d.notReleasedOpen += 1;
    else d.notReleasedClosed += 1;
  }
  return [...by.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** ใบขอของแถวดิบ · '' = ใบสมัครที่ไม่ผูกใบขอ */
const jobKeyOf = (r: Row) => (typeof r.job_id === 'string' && r.job_id ? r.job_id : '');
export function groupByJob(rows: readonly Row[]): Map<string, Row[]> {
  const m = new Map<string, Row[]>();
  for (const r of rows) {
    const k = jobKeyOf(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

/**
 * งานค้างแยกต่อใบขอ — หน้าเว็บรวมเฉพาะใบที่ผ่านตัวกรอง (เจ้าของ 4 พ.ย. 2569 "ให้การ์ดที่เหลือเปลี่ยนตามตัวกรองด้วย")
 * ตัวนับเดียวกับ `toBacklog` ทีละใบ (ใบสมัครหนึ่งใบอยู่ใบขอเดียว ⇒ รวมทุกใบ = ยอดรวมเดิม) · เก็บเฉพาะใบที่มีงานค้าง
 */
export function backlogByJob(rows: Row[], apptRows: Row[] | null, now: number, regionOf: (jobId: string | null) => Region): Record<string, RecruitBacklog> {
  const byJob = groupByJob(rows);
  const apptByJob = apptRows ? groupByJob(apptRows) : null;
  const out: Record<string, RecruitBacklog> = {};
  for (const k of new Set([...byJob.keys(), ...(apptByJob?.keys() ?? [])])) {
    const b = toBacklog(byJob.get(k) ?? [], apptByJob ? (apptByJob.get(k) ?? []) : null, now, regionOf);
    if (b.uncalled.total || b.waitingStaff.total || b.appointments?.overdue || b.appointments?.next7) out[k] = b;
  }
  return out;
}

/** งานค้างจากแถวดิบ — อายุเป็นวันเต็ม (ครบ 24 ชม. = 1 วัน) นับจาก `now` */
/**
 * @param apptRows นัดที่รอผลแยกต่อใบขอ (`appointmentBacklogSql`) · null = ตารางผลนัดยังไม่พร้อม
 * @param regionOf ใบขอ → กรุงเทพ+ปริมณฑล / ต่างจังหวัด / ไม่ระบุ (28 ต.ค. 2569 · ไม่ส่ง = ไม่ระบุทั้งหมด)
 */
export function toBacklog(
  rows: Row[],
  apptRows: Row[] | null,
  now: number,
  regionOf: (jobId: string | null) => Region = () => 'unknown',
): RecruitBacklog {
  const uncalled = { total: 0, d0_3: 0, d4_7: 0, over7: 0, inQueue: 0, badPhone: 0 };
  const waitingStaff = { total: 0, d0: 0, d1_3: 0, over3: 0 };
  const regions = { uncalled: emptyRegionCount(), waitingStaff: emptyRegionCount(), appointments: apptRows ? emptyRegionCount() : null };
  const regionRows = {
    uncalled: { d0_3: emptyRegionCount(), d4_7: emptyRegionCount(), over7: emptyRegionCount() },
    waitingStaff: { d0: emptyRegionCount(), d1_3: emptyRegionCount(), over3: emptyRegionCount() },
    appointments: apptRows ? { overdue: emptyRegionCount(), next7: emptyRegionCount() } : null,
  };
  const jobOf = (r: Row) => (typeof r.job_id === 'string' && r.job_id ? r.job_id : null);
  for (const r of rows) {
    if (!bool(r.called)) {
      uncalled.total += 1;
      const reg = regionOf(jobOf(r));
      regions.uncalled[reg] += 1;
      const d = fullDays(iso(r.created_at), now);
      const k = d <= 3 ? 'd0_3' : d <= 7 ? 'd4_7' : 'over7';
      uncalled[k] += 1;
      regionRows.uncalled[k][reg] += 1;
      if (bool(r.in_queue)) uncalled.inQueue += 1;
      if (bool(r.bad_phone)) uncalled.badPhone += 1;
      continue;
    }
    if (micro(r.ai_outcome, r.ai_summary, r.ai_reply) !== 'said_yes') continue;
    const aiAt = iso(r.ai_at);
    const staffAt = iso(r.staff_last_at);
    if (staffAt && aiAt && staffAt >= aiAt) continue;
    waitingStaff.total += 1;
    const reg = regionOf(jobOf(r));
    regions.waitingStaff[reg] += 1;
    const d = fullDays(aiAt, now);
    const k = d === 0 ? 'd0' : d <= 3 ? 'd1_3' : 'over3';
    waitingStaff[k] += 1;
    regionRows.waitingStaff[k][reg] += 1;
  }
  let appointments: RecruitBacklog['appointments'] = null;
  if (apptRows) {
    appointments = { overdue: 0, next7: 0 };
    for (const a of apptRows) {
      const overdue = Number(a.overdue ?? 0);
      const next7 = Number(a.next7 ?? 0);
      appointments.overdue += overdue;
      appointments.next7 += next7;
      const reg = regionOf(jobOf(a));
      regions.appointments![reg] += overdue + next7;
      regionRows.appointments!.overdue[reg] += overdue;
      regionRows.appointments!.next7[reg] += next7;
    }
  }
  return { uncalled, waitingStaff, appointments, regions, regionRows };
}

/**
 * ใบขอ → กรุงเทพ+ปริมณฑล / ต่างจังหวัด (28 ต.ค. 2569) — จังหวัดของงาน `boardProvinceOf` ตัวเดียวกับการ์ดงานตามจังหวัด
 * จากสำเนาใบขอ (ใบล่าสุด 2,000 ใบ ทุกสถานะ) · อ่านไม่ได้ = ไม่ระบุทั้งหมด (การ์ดยังขึ้นยอดรวมได้)
 * + เลขที่ใบ/ตำแหน่ง/หน่วยงาน ของการ์ด "แยกตามเจ้าหน้าที่สรรหา" (4 พ.ย. 2569) จากสำเนาชุดเดียวกัน
 */
type JobIndex = { regionOf: (jobId: string | null) => Region; jobs: Map<string, JobRequest> };
async function loadJobIndex(): Promise<JobIndex> {
  try {
    const list = (await listSiamrajUnitRequests({ limit: 2000, mode: 'all' })) as unknown as JobRequest[];
    const jobs = new Map(list.map((j) => [String(j.id), j]));
    const map = new Map(list.map((j) => [String(j.id), regionOfProvince(boardProvinceOf(j))]));
    return { regionOf: (jobId) => (jobId ? (map.get(jobId) ?? 'unknown') : 'unknown'), jobs };
  } catch (e) {
    logError('recruit-overview: จังหวัดของงาน', e);
    return { regionOf: () => 'unknown', jobs: new Map() };
  }
}

const PREQUEST_PREFIX = 'siamraj-pre:';
const SQL_PREFIX = 'siamraj-sql:';
const trimOrNull = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** คีย์ของตารางผู้รับผิดชอบ — ใบล่วงหน้าใช้ id เต็ม · ใบจริงใช้เลขที่ใบ (ตัวเดียวกับหน้ากล่องงาน) */
const assignmentKeyOf = (jobId: string | null, requestNo: string | null) => (jobId?.startsWith(PREQUEST_PREFIX) ? jobId : requestNo ?? jobId ?? '');

/** เจ้าหน้าที่สรรหาของใบขอรายใบ — ตัวกรองเจ้าหน้าที่ของหน้าภาพรวม (4 พ.ย. 2569) · อ่านไม่ได้ = ไม่ใส่ (ตัวกรองยังใช้ได้กับใบที่มี) */
export async function attachRequestRecruiters(rows: RecruitRequestRow[]): Promise<void> {
  try {
    const map = await getUnitAssignmentsMap(rows.map((r) => assignmentKeyOf(r.jobId, r.requestNo)));
    for (const r of rows) r.recruiter = trimOrNull(map.get(assignmentKeyOf(r.jobId, r.requestNo))?.recruiter_name);
  } catch (e) {
    logError('recruit-overview: เจ้าหน้าที่สรรหาของใบขอ (รายใบ)', e);
  }
}

/**
 * jobId ของใบสมัคร → ใบขอ + เจ้าหน้าที่สรรหา (เจ้าของ 4 พ.ย. 2569 "เป็นงานใครเท่าไหร่ แล้วเป็นงานไหนบ้าง")
 * เจ้าหน้าที่ = `siamraj_unit_assignments.recruiter_name` คีย์เดียวกับหน้ากล่องงาน (ใบล่วงหน้าใช้ id เต็ม · ใบจริงใช้เลขที่ใบ)
 * ใบที่ไม่อยู่ในสำเนา = เลขที่ใบจาก id · ตำแหน่ง/หน่วยงานว่าง (ไม่เดา)
 */
export async function loadAppJobs(jobIds: readonly string[], jobs: ReadonlyMap<string, JobRequest>): Promise<Record<string, RecruitAppJob>> {
  const ids = [...new Set(jobIds.filter(Boolean))];
  const base = ids.map((id) => {
    const j = jobs.get(id);
    const no = trimOrNull(j?.request_no) ?? (id.startsWith(SQL_PREFIX) ? id.slice(SQL_PREFIX.length) : id.startsWith(PREQUEST_PREFIX) ? id.slice(PREQUEST_PREFIX.length) : null);
    return { id, no, j };
  });
  const assigned = await getUnitAssignmentsMap(base.map((b) => assignmentKeyOf(b.id, b.no)));
  const out: Record<string, RecruitAppJob> = {};
  for (const b of base) {
    out[b.id] = {
      requestNo: b.no,
      unitName: trimOrNull(b.j?.work_site_name) ?? trimOrNull(b.j?.unit_name),
      // ชื่อตำแหน่งแบบหน้าประกาศ (ตัวเดียวกับการ์ดงานสรรหา) — ตำแหน่ง ERP ส่วนมากขึ้นแค่ "พนักงาน"
      position: b.j ? trimOrNull(publicJobTitle(b.j)) : null,
      recruiter: trimOrNull(assigned.get(assignmentKeyOf(b.id, b.no))?.recruiter_name) ?? trimOrNull(b.j?.recruiter_name),
    };
  }
  return out;
}

const NO_NAME = 'ไม่ระบุชื่อ';
/** แถวดิบ (ใบ × คน) → ยอดรายชื่อไม่ซ้ำต่อคน เรียงนัดได้มากสุดก่อน */
/**
 * @param displayOf อีเมลของเจ้าหน้าที่ → ชื่อเล่น/ชื่อจริง (QA 18 ต.ค. 2569: ตารางเคยขึ้นอีเมล) · ไม่รู้จัก = คงค่าเดิม
 */
export function toStaffRows(
  events: Row[],
  showed: ReadonlySet<string>,
  displayOf: (email: string) => string | null = () => null,
): RecruitStaffRow[] {
  type Acc = { claimed: Set<string>; called: Set<string>; reached: Set<string>; appointed: Set<string> };
  const by = new Map<string, Acc>();
  for (const e of events) {
    const raw = text(e.name);
    const name = raw ? (raw.includes('@') ? (displayOf(raw.toLowerCase()) ?? raw) : raw) : NO_NAME;
    const id = String(e.app_id);
    const acc = by.get(name) ?? { claimed: new Set(), called: new Set(), reached: new Set(), appointed: new Set() };
    if (e.kind === 'claim') acc.claimed.add(id);
    else {
      acc.called.add(id);
      if (bool(e.reached)) acc.reached.add(id);
      if (bool(e.appt)) acc.appointed.add(id);
    }
    by.set(name, acc);
  }
  return [...by.entries()]
    .map(([name, a]) => ({
      name,
      claimed: a.claimed.size,
      called: a.called.size,
      reached: a.reached.size,
      appointed: a.appointed.size,
      showed: [...a.appointed].filter((id) => showed.has(id)).length,
    }))
    .sort((x, y) => y.appointed - x.appointed || y.called - x.called || y.claimed - x.claimed || x.name.localeCompare(y.name, 'th'));
}

/**
 * ผลโทรของ AI ในเดือน → รายชื่อไม่ซ้ำ · ติดต่อสำเร็จ/ตอบว่าสนใจ = **ผลล่าสุดในเดือน** ของรายชื่อนั้น
 * (หลักเดียวกับการ์ด "ติดต่อสำเร็จ" ที่อ่านผลล่าสุด — ติดแล้วโทรซ้ำไม่ติด นับตามผลหลัง)
 */
export function toAiRow(events: Row[]): RecruitAiRow {
  const latest = new Map<string, Row>();
  for (const e of events) {
    const id = String(e.app_id);
    const prev = latest.get(id);
    if (!prev || String(iso(e.at) ?? '') > String(iso(prev.at) ?? '')) latest.set(id, e);
  }
  let reached = 0;
  let saidYes = 0;
  for (const e of latest.values()) {
    if (bool(e.reached)) reached += 1;
    if (micro(e.outcome, e.summary, e.reply) === 'said_yes') saidYes += 1;
  }
  return { called: latest.size, reached, saidYes };
}

type Settled<T> = { ok: true; value: T } | { ok: false; error: string };

async function settle<T>(what: string, run: () => Promise<T>): Promise<Settled<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (e) {
    logError(`recruit-overview: ${what}`, e);
    return { ok: false, error: `อ่าน${what}ไม่ได้` };
  }
}

/** ผลนัดยังไม่ migrate (089) = อ่านต่อได้ แค่ไม่มีผลนัด */
async function loadFacts(params: unknown[], byJobs = false): Promise<Row[]> {
  try {
    return (await dbQuery<Row>(factsSql(LATEST_ATTENDANCE_SQL, LATEST_SCREENING_SQL, byJobs), params)).rows;
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
    // ผลนัด (089) หรือผ่าน/ไม่ผ่าน (151) ยังไม่ migrate — ลองตัดทีละอย่าง
    try {
      return (await dbQuery<Row>(factsSql(LATEST_ATTENDANCE_SQL, 'null::text', byJobs), params)).rows;
    } catch (e2) {
      if (!isPgUndefinedTable(e2)) throw e2;
      return (await dbQuery<Row>(factsSql('null::text', 'null::text', byJobs), params)).rows;
    }
  }
}

/** ใบสมัครของใบขอชุดนี้ทุกช่วงเวลา (ไม่นับ Lead/ยกเลิกข้อมูล) — นิยามเดียวกับภาพรวมงานสรรหา (`toFact`) */
export async function loadFactsForJobs(jobIds: readonly string[], bu: string | null): Promise<RecruitAppFact[]> {
  const buSet = bu ? [bu] : null;
  if (jobIds.length === 0) return [];
  return (await loadFacts([jobIds, buSet], true)).map((r) => toFact(r, null));
}

export async function buildRecruitOverview(
  monthParam: unknown,
  scope: DepartmentScope,
  now: Date,
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — ค่าผิด/ไม่ส่ง = แบบเดือน */
  range?: { from: unknown; to: unknown; all?: boolean },
  /** BU ที่ขอ — ผู้ใช้หลาย BU สลับได้ทีละ BU (26 ต.ค. 2569) · แอดมิน/BU เดียวไม่ใช้ */
  requestedBu?: unknown,
): Promise<RecruitOverviewResponse> {
  const today = toBangkokYmd(now);
  const window = (range ? rangeWindow(range.from, range.to, today, range.all === true) : null) ?? monthWindow(monthParam, today);
  /**
   * แอดมินเห็นทุก BU เหมือนเดิม · BU เดียว = ล็อก
   * หลาย BU = ค่าเริ่ม **ผลรวมทุก BU ในสิทธิ์** แล้วเลือกดูทีละ BU ได้ (เจ้าของ 29 ต.ค. 2569 "default คือ ผลรวมของทุก bu แล้วฉันไปแยกดูเอง")
   * `bu` = BU ที่เลือก (null = รวม) · `buSet` = ชุดที่ใช้กรองจริง (null = ไม่กรอง · แอดมิน)
   */
  // ตัวเลือกชุดเดียวกับหน้าหลัก (`pickDashboardBuSet`) · แอดมินไม่ส่ง BU = ทุก BU · ส่ง = BU นั้น (หน้าหลักของแอดมินเลือก BU ได้)
  const picked = pickDashboardBuSet(scope, requestedBu);
  const bu = picked.bu;
  const buSet = picked.buSet;
  const body: RecruitOverviewResponse = {
    buChoices: picked.choices,
    version: 1,
    generatedAt: now.toISOString(),
    today,
    window,
    bu,
    firstDay: null,
    apps: [],
    backlog: null,
    staff: [],
    ai: { called: 0, reached: 0, saidYes: 0 },
    attendanceEverRecorded: false,
    errors: {},
  };
  if (scope.mode === 'none') return body;

  const bothRange = [startOfBkk(window.prevFrom), startOfBkk(addDays(window.to, 1)), buSet];
  const monthRange = [startOfBkk(window.from), startOfBkk(addDays(window.to, 1)), buSet];
  const nowMs = now.getTime();

  // จังหวัดของงาน (การ์ดงานค้าง) — วิ่งพร้อมก้อนอื่น ครั้งแรกหลังสำเนาใบขอหมดอายุใช้ ~4 วิ (28 ต.ค. 2569)
  const jobIndexP = loadJobIndex();
  const [boardR, factsR, backlogR, apptR, staffR, showedR, aiR, firstR, everR, chR, reqR, informR, irecR, irAppR, apCodesR] = await Promise.all([
    settle('รายชื่อบนบอร์ด', loadBoardPhoneSet),
    settle('ใบสมัคร', () => loadFacts(bothRange)),
    settle('งานค้าง', async () => (await dbQuery<Row>(backlogSql(), [buSet])).rows),
    settle('นัดที่รอผล', async () => {
      try {
        // แยกต่อใบขอ (28 ต.ค. 2569) — รวมยอด + แยกกรุงเทพ/ต่างจังหวัดฝั่ง Node
        return (await dbQuery<Row>(appointmentBacklogSql(), [buSet])).rows;
      } catch (e) {
        if (isPgUndefinedTable(e)) return null;
        throw e;
      }
    }),
    settle('ผลงานรายคน', async () => (await dbQuery<Row>(staffEventsSql(), monthRange)).rows),
    settle('ผลมาตามนัด', async () => {
      try {
        return new Set((await dbQuery<Row>(showedSql(), monthRange)).rows.map((r) => String(r.app_id)));
      } catch (e) {
        if (isPgUndefinedTable(e)) return new Set<string>();
        throw e;
      }
    }),
    settle('ผลโทรของ AI', async () => (await dbQuery<Row>(aiEventsSql(), monthRange)).rows),
    settle('วันแรกของข้อมูล', async () => text((await dbQuery<Row>(firstDaySql(), [buSet])).rows[0]?.first_day)),
    settle('ผลนัด', async () => {
      try {
        return bool((await dbQuery<Row>(`select exists (select 1 from ${ATTEND}) as any_row`)).rows[0]?.any_row);
      } catch (e) {
        if (isPgUndefinedTable(e)) return false;
        throw e;
      }
    }),
    // ใบขอที่เข้ามาในช่วง (เจ้าของ 19 ต.ค. 2569 ภาพรวมข้อ 1) — ฐานเดียวกับ "ใบขอเข้ามา · ประกาศแล้ว" ของหน้าหลัก
    // ช่องทางที่ได้คนลงงาน (เจ้าของ 19 ต.ค. 2569) — นับตามวันแจ้งเข้า · ไม่กรอง BU/วันในสัปดาห์
    settle('ช่องทางลงงาน', () => loadChannelPlacement({ from: window.from, to: window.to })),
    // ใบขอช่วงก่อน + ช่วงนี้ อ่านทีเดียว แล้วแบ่ง (เจ้าของ 21 ต.ค. 2569 "อยากได้เป็นกราฟเชิงเปรียบเทียบว่า เพิ่มขึ้นลดลง")
    settle('ใบขอ', () => loadOnlineRequestRows({ from: window.prevFrom, to: window.to, bu: buSet, departmentScope: scope })),
    // ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 "จับได้ถึงแจ้งเข้า") — แจ้งเข้าตั้งแต่ต้นช่วงเทียบ · iRecruit ย้อน 60 วัน
    settle('ใบแจ้งเข้า ERP', () => loadInformDaysByPhone(window.prevFrom)),
    settle('ช่องทาง iRecruit', () => loadIrecruitRegsByPhone(window.prevFrom, window.to)),
    // ผู้สมัครใน iRecruit (ขั้นคีย์เข้า iRecruit หลังมาตามนัด · 20 ต.ค. 2569)
    settle('ผู้สมัคร iRecruit', () => loadIrecruitApplicantDays(window.prevFrom)),
    // ลิงก์ของใบสั่ง Autopost ทุกใบ — แยกผู้สมัครที่มาจาก Autopost กับโพสต์เอง (9 พ.ย. 2569)
    settle('ลิงก์ Autopost', async () =>
      new Set(
        (
          await dbQuery<{ code: string }>(
            `select distinct gl->>'link_code' as code from ${JOB_POSTING_REQUESTS} p, jsonb_array_elements(coalesce(p.job_snapshot->'group_links', '[]'::jsonb)) gl
              where p.request_type = 'content'
             union select p.job_snapshot->>'link_code' from ${JOB_POSTING_REQUESTS} p where p.request_type = 'content' and p.job_snapshot->>'link_code' is not null`,
          )
        ).rows.map((r) => r.code).filter(Boolean),
      ),
    ),
  ]);

  // บอร์ด ERP อ่านไม่ได้ = ไม่รู้ว่าได้ใบสมัครหรือยัง (null) — ไม่ใช่ "ยังไม่ได้"
  const boardPhones = boardR.ok ? boardR.value : null;
  if (!boardR.ok || boardPhones === null) body.errors.board = 'อ่านรายชื่อบนบอร์ด ERP ไม่ได้ — ยอดได้ใบสมัครเช็คไม่ได้ชั่วคราว';

  const sources: AppSourceMaps = {
    informDays: informR.ok ? informR.value : null,
    irecruitRegs: irecR.ok ? irecR.value : null,
    irecruitApplicants: irAppR.ok ? irAppR.value : null,
    autopostCodes: apCodesR.ok ? apCodesR.value : null,
  };
  if (!informR.ok) body.errors.informs = informR.error;
  if (factsR.ok) {
    const apps = factsR.value.map((r) => toFact(r, boardPhones, sources));
    // ชื่อคนเก็บที่เป็นอีเมล → ชื่อเล่น (กติกาเดียวกับตารางผลงานรายคน)
    if (apps.some((a) => a.claimedBy?.includes('@') || a.bringer?.includes('@'))) {
      const displayOf = await loadStaffDisplay();
      for (const a of apps) {
        if (a.claimedBy?.includes('@')) a.claimedBy = displayOf(a.claimedBy.toLowerCase()) ?? a.claimedBy;
        if (a.bringer?.includes('@')) a.bringer = displayOf(a.bringer.toLowerCase()) ?? a.bringer;
      }
    }
    body.apps = apps;
  } else {
    body.apps = null;
    body.errors.apps = factsR.error;
  }
  if (body.apps) {
    try {
      // ใบของงานค้าง/ผลงานรายคน/แจ้งเข้า ด้วย — ตัวกรองเจ้าหน้าที่ใช้กับการ์ดพวกนั้นได้ (4 พ.ย. 2569)
      const placementJobs = Object.keys((chR.ok ? chR.value.byRequest : null) ?? {}).map((rq) => `${SQL_PREFIX}${rq}`);
      body.appJobs = await loadAppJobs(
        [
          ...body.apps.map((a) => a.jobId).filter((j): j is string => !!j),
          ...(backlogR.ok ? backlogR.value.map((r) => jobKeyOf(r)) : []),
          ...(apptR.ok && apptR.value ? apptR.value.map((r) => jobKeyOf(r)) : []),
          ...(staffR.ok ? staffR.value.map((r) => jobKeyOf(r)) : []),
          ...(aiR.ok ? aiR.value.map((r) => jobKeyOf(r)) : []),
          ...placementJobs,
        ].filter(Boolean),
        (await jobIndexP).jobs,
      );
    } catch (e) {
      logError('recruit-overview: เจ้าหน้าที่สรรหาของใบขอ', e);
      body.appJobs = null;
      body.errors.appJobs = 'อ่านเจ้าหน้าที่สรรหาของใบขอไม่ได้';
    }
  }

  if (backlogR.ok && apptR.ok) {
    const regionOf = (await jobIndexP).regionOf;
    body.backlog = toBacklog(backlogR.value, apptR.value, nowMs, regionOf);
    body.backlogByJob = backlogByJob(backlogR.value, apptR.value, nowMs, regionOf);
  }
  else body.errors.backlog = !backlogR.ok ? backlogR.error : (apptR as { error: string }).error;

  if (staffR.ok && showedR.ok) {
    const displayOf = await loadStaffDisplay();
    body.staff = toStaffRows(staffR.value, showedR.value, displayOf);
    body.staffByJob = Object.fromEntries([...groupByJob(staffR.value)].map(([k, rows]) => [k, toStaffRows(rows, showedR.value, displayOf)]));
  }
  else {
    body.staff = null;
    body.errors.staff = !staffR.ok ? staffR.error : (showedR as { error: string }).error;
  }
  if (aiR.ok) {
    body.ai = toAiRow(aiR.value);
    body.aiByJob = Object.fromEntries([...groupByJob(aiR.value)].map(([k, rows]) => [k, toAiRow(rows)]));
  }
  else {
    body.ai = null;
    body.errors.staff = body.errors.staff ?? aiR.error;
  }

  if (chR.ok) body.channelPlacement = chR.value;
  else {
    body.channelPlacement = null;
    body.errors.channels = chR.error;
  }
  if (reqR.ok) {
    // ใบขอเข้ามา = ทุกใบที่ส่งเข้ามาในช่วง ตัวเดียวกับหน้าหลัก (งานสรรหา · ทีม Online) — เจ้าของ 21 ต.ค. 2569 โหวตข้อ B "เลขเดียวกันทุกหน้า"
    // ใบที่จบแล้วไม่โชว์ว่ายังไม่ประกาศ: แยกเป็น "ไม่ได้ประกาศ (จบไปแล้ว)" นับอย่างเดียว (`recruitDrill`) · เปิด/จบ = `onlineRequestStateOf`
    const inRange = (from: string, to: string) => reqR.value.filter((r) => r.day >= from && r.day <= to);
    body.requests = toRequestSummary(inRange(window.from, window.to));
    body.requestsPrev = toRequestSummary(inRange(window.prevFrom, window.prevTo));
    body.requestDays = toRequestDays(reqR.value);
    body.requestList = await loadRequestList(inRange(window.from, window.to));
    const [rowsCur, rowsPrev] = await Promise.all([toRequestRows(inRange(window.from, window.to)), toRequestRows(inRange(window.prevFrom, window.prevTo))]);
    await attachRequestRecruiters([...rowsCur, ...rowsPrev]);
    body.requestRows = rowsCur;
    // ช่วงก่อน — การ์ดแนวโน้มใบขอคิดเทียบจากใบชุดเดียวกับการ์ดบน + ตัวกรอง (QA 30 ต.ค. 2569)
    body.requestRowsPrev = rowsPrev;
  } else {
    body.requests = null;
    body.requestsPrev = null;
    body.requestDays = null;
    body.requestList = null;
    body.requestRows = null;
    body.requestRowsPrev = null;
    body.errors.requests = reqR.error;
  }

  body.firstDay = firstR.ok ? firstR.value : null;
  body.attendanceEverRecorded = everR.ok ? everR.value : false;
  return body;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NAMES_MAX = 100;

/**
 * ชื่อ/เบอร์ของใบสมัครตาม id — ป๊อปรายชื่อของภาพรวม (29 ต.ค. 2569 แท็บการติดต่อ: คนที่เจ้าหน้าที่คนอื่นเก็บไปแล้ว
 * ไม่อยู่ในลิสต์ผู้สมัครของผู้ใช้ ป๊อปเลยขึ้น "เปิดชื่อไม่ได้") · อ่านอย่างเดียว · ในขอบเขต BU ของผู้ใช้เท่านั้น
 */
export async function loadApplicantNames(ids: readonly string[], scope: DepartmentScope): Promise<Row[]> {
  const clean = [...new Set(ids.filter((id) => UUID_RE.test(id)))].slice(0, NAMES_MAX);
  if (clean.length === 0 || scope.mode === 'none') return [];
  const picked = pickDashboardBu(scope, null);
  const allowed = scope.mode === 'all' ? null : (picked.choices ?? (picked.bu ? [picked.bu] : []));
  const { rows } = await dbQuery<Row>(
    `select a.id::text as id, a.full_name, a.phone, a.unit_name, a.job_title, a.position_interest, a.created_at
       from ${APPS} a ${appBuJoin('a')}
      where a.id = any($1::uuid[])
        and ($2::text[] is null or ${appBuSql('a')} = any($2::text[]))`,
    [clean, allowed],
  );
  return rows;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scope = await loadMatchingBuScope(req.user);
    if (typeof req.query?.names === 'string') {
      const rows = await loadApplicantNames(req.query.names.split(','), scope);
      res.setHeader?.('Cache-Control', 'no-store');
      return res.status(200).json({ rows });
    }
    const month = typeof req.query?.month === 'string' ? req.query.month.trim() : undefined;
    const from = typeof req.query?.from === 'string' ? req.query.from.trim() : undefined;
    const to = typeof req.query?.to === 'string' ? req.query.to.trim() : undefined;
    const body = await buildRecruitOverview(month, scope, new Date(), from && to ? { from, to, all: req.query?.all === '1' } : undefined, req.query?.bu);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'recruit-overview', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
