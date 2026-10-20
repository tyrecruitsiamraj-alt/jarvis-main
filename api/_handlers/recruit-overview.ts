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
import { appBuJoin, appBuSql } from '../_lib/homeBuSql.js';
import {
  AI_RESULT_AT_SQL,
  AI_RESULT_OF_APP_SQL,
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
  UPCOMING_7D_NO_RESULT_SQL,
  holdEventAtSql,
} from '../_lib/applicantOverviewSql.js';
import { queueReplySql } from '../_lib/lumosQueueDefs.js';
import { loadBoardPhoneSet } from '../_lib/applicationBoardLink.js';
import { toBangkokYmd } from '../_lib/businessDate.js';
import { logError } from '../_lib/logger.js';
import { INTEREST_VOCAB, classifyCallMicro } from '../../src/lib/callMicroOutcome.js';
import { normalizeTrendBu } from '../../src/lib/trends/bu.js';
import { addDays } from '../../src/lib/trends/timeBuckets.js';
import { monthWindow, rangeWindow } from '../../src/lib/recruitOverviewWindow.js';
import { fullDaysSince } from '../../src/lib/fullDays.js';
import { isOverAge } from '../../src/lib/applicantAge.js';
import { isOutOfAreaAnswer } from '../../src/lib/outOfAreaAnswer.js';
import { loadOnlineRequestRows } from '../_lib/homeOnlineSql.js';
import { loadChannelPlacement } from '../_lib/channelPlacementSql.js';
import { loadInformDaysByPhone, loadIrecruitApplicantDays, loadIrecruitRegsByPhone } from '../_lib/applicantSourceSql.js';
import { firstDaySince, informedSince, irecruitChannelAt, phone9Of } from '../../src/lib/applicantSourceMatch.js';
import type {
  RecruitAiRow,
  RecruitAppFact,
  RecruitAttendance,
  RecruitBacklog,
  RecruitOverviewResponse,
  RecruitRequestSummary,
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

/** ประชากรของทุกก้อน — ไม่ใช่ Lead + BU (ถ้าล็อก) · `$bu` = ตำแหน่งพารามิเตอร์ของ BU */
// ใบที่ยกเลิกข้อมูลแล้วไม่นับ (135) — กติกาเดียวกับหน้าหลัก/รายชื่อผู้สมัคร · กดเลขแล้วเปิดชื่อได้ครบ (QA 18 ต.ค. 2569)
const CANCELLATIONS = tableInAppSchema('application_cancellations');
/** ลิงก์รับสมัคร — ช่องทาง/กลุ่มติดที่ลิงก์ ไม่ได้คัดลอกลงใบสมัคร (19 ต.ค. 2569 · 383 จาก 502 ใบ) */
const POSTING_LINKS = tableInAppSchema('recruit_posting_links');
const scopeWhere = (bu: string) =>
  `not coalesce(a.is_lead, false) and not exists (select 1 from ${CANCELLATIONS} cx where cx.application_id = a.id) and (${bu}::text is null or ${appBuSql('a')} = ${bu}::text)`;

/** ข้อเท็จจริงต่อใบของช่วง [$1, $2) · $3 = BU · `attendance` = นิพจน์ผลนัด (ตารางยังไม่มี = null) */
export function factsSql(attendance: string = LATEST_ATTENDANCE_SQL, screening: string = LATEST_SCREENING_SQL): string {
  return `
  select a.id::text as id, a.created_at, a.job_id,
         -- ช่องทางของใบ → ไม่มี = ช่องทางของลิงก์ที่กรอกผ่าน (19 ต.ค. 2569)
         coalesce(nullif(btrim(a.channel_label), ''),
                  (select nullif(btrim(l.channel_label), '') from ${POSTING_LINKS} l where l.id = a.link_id)) as channel_label,
         nullif(btrim(a.referral_source), '') as referral_source,
         nullif(btrim(a.position_interest), '') as position,
         a.phone_e164, a.age,
         ${CALLED_BY_AI_SQL} as by_ai,
         ${CALLED_BY_STAFF_SQL} as by_staff,
         ${FIRST_CALLED_AT_SQL} as first_called_at,
         air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply, air.at as ai_at,
         str.outcome as staff_outcome, str.at as staff_at,
         ${STAFF_LAST_AT_SQL} as staff_last_at,
         lc.cls as contact_class, lc.src as contact_src,
         lcl.ok as log_ok, lcl.reason_label as log_reason, lcl.created_at as log_at,
         lcl.appointment_at as log_appointment_at,
         ${IN_QUEUE_SQL} as in_queue,
         ${APPOINTMENT_AT_SQL} as appointment_at,
         ${attendance} as attendance,
         ${screening} as screening
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
   where a.created_at >= $1::timestamptz and a.created_at < $2::timestamptz
     and ${scopeWhere('$3')}`;
}

/** งานค้างตอนนี้ — ทุกใบในขอบเขต (ไม่ขึ้นกับเดือน) · $1 = BU */
export function backlogSql(): string {
  return `
  select a.created_at, (a.phone_e164 is null) as bad_phone,
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
  select count(*) filter (where ${OVERVIEW_BUCKETS.overdue_no_result})::int as overdue,
         count(*) filter (where ${UPCOMING_7D_NO_RESULT_SQL})::int as next7
    from ${APPS} a
    ${appBuJoin('a')}
   where ($1::text is null or ${appBuSql('a')} = $1::text)`;
}

/** ผลงานรายคนของเดือน [$1, $2) · $3 = BU — คืนแถวดิบ (ใบ × คน) ให้นับรายชื่อไม่ซ้ำฝั่ง Node */
export function staffEventsSql(): string {
  return `
  select 'claim'::text as kind, a.id::text as app_id, nullif(btrim(a.claimed_by_name), '') as name,
         null::boolean as reached, false as appt
    from ${APPS} a ${appBuJoin('a')}
   where a.claimed_by is not null and a.claimed_at >= $1::timestamptz and a.claimed_at < $2::timestamptz
     and ${scopeWhere('$3')}
  union all
  select 'log', a.id::text, nullif(btrim(c.created_by_name), ''), c.ok, (c.ok and c.appointment_at is not null)
    from ${CONTACTS} c
    join ${APPS} a on a.id = c.application_id
    ${appBuJoin('a')}
   where c.created_at >= $1::timestamptz and c.created_at < $2::timestamptz
     and ${scopeWhere('$3')}
  union all
  select 'hold', a.id::text, nullif(btrim(h.held_by_name), ''), (h.result_outcome in ${CONNECTED_OUTCOMES}),
         (h.appointment_at is not null)
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
  return `
  select a.id::text as app_id, ${AI_RESULT_OUTCOME_SQL} as outcome,
         q.result->>'summary' as summary, ${queueReplySql('q')} as reply,
         ${AI_RESULT_AT_SQL} as at,
         (${AI_RESULT_OUTCOME_SQL} in ${CONNECTED_OUTCOMES}) as reached
    from ${APPS} a
    ${appBuJoin('a')}
    join ${QUEUE} q on ${AI_RESULT_OF_APP_SQL}
   where ${AI_RESULT_AT_SQL} >= $1::timestamptz and ${AI_RESULT_AT_SQL} < $2::timestamptz
     and ${scopeWhere('$3')}`;
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
  irecruitRegs: ReadonlyMap<string, ReadonlyArray<{ at: string; channel: string }>> | null;
  /** วันเป็นผู้สมัครใน iRecruit ต่อเบอร์ (20 ต.ค. 2569) */
  irecruitApplicants?: ReadonlyMap<string, readonly string[]> | null;
};

const IRECRUIT_LABEL = /^irecruit/i;

export function toFact(r: Row, boardPhones: Set<string> | null, sources?: AppSourceMaps): RecruitAppFact {
  const phone = text(r.phone_e164);
  const p9 = phone9Of(phone);
  const createdAt = iso(r.created_at) ?? '';
  const fromIrecruit = IRECRUIT_LABEL.test(text(r.channel_label) ?? '') || IRECRUIT_LABEL.test(text(r.referral_source) ?? '');
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
    overAge: isOverAge(r.age as number | string | null),
    aiOutOfArea: Boolean(r.ai_outcome) && isOutOfAreaAnswer(text(r.ai_summary), text(r.ai_reply)),
    onBoard: boardPhones ? Boolean(phone && boardPhones.has(phone)) : null,
    informed: sources ? informedSince(sources.informDays, p9, createdAt) : null,
    sourceChannel: sources && fromIrecruit ? irecruitChannelAt(sources.irecruitRegs, p9, createdAt) : null,
    irecruitAt: sources ? firstDaySince(sources.irecruitApplicants ?? null, p9, createdAt) : undefined,
    informedAt: sources ? firstDaySince(sources.informDays, p9, createdAt) : undefined,
  };
}

/** สรุปใบขอ — ประกาศแล้ว/ยังไม่ประกาศ · ในใบที่ประกาศ มีคนสมัครกี่ใบ กรอกมากี่คน */
export function toRequestSummary(rows: ReadonlyArray<{ releasedAt: string | null; applications: number }>): RecruitRequestSummary {
  const released = rows.filter((r) => r.releasedAt);
  const withApps = released.filter((r) => r.applications > 0);
  return {
    total: rows.length,
    released: released.length,
    notReleased: rows.length - released.length,
    releasedWithApps: withApps.length,
    releasedNoApps: released.length - withApps.length,
    appsOnReleased: withApps.reduce((n, r) => n + r.applications, 0),
  };
}

/** งานค้างจากแถวดิบ — อายุเป็นวันเต็ม (ครบ 24 ชม. = 1 วัน) นับจาก `now` */
export function toBacklog(rows: Row[], appointments: RecruitBacklog['appointments'], now: number): RecruitBacklog {
  const uncalled = { total: 0, d0_3: 0, d4_7: 0, over7: 0, inQueue: 0, badPhone: 0 };
  const waitingStaff = { total: 0, d0: 0, d1_3: 0, over3: 0 };
  for (const r of rows) {
    if (!bool(r.called)) {
      uncalled.total += 1;
      const d = fullDays(iso(r.created_at), now);
      if (d <= 3) uncalled.d0_3 += 1;
      else if (d <= 7) uncalled.d4_7 += 1;
      else uncalled.over7 += 1;
      if (bool(r.in_queue)) uncalled.inQueue += 1;
      if (bool(r.bad_phone)) uncalled.badPhone += 1;
      continue;
    }
    if (micro(r.ai_outcome, r.ai_summary, r.ai_reply) !== 'said_yes') continue;
    const aiAt = iso(r.ai_at);
    const staffAt = iso(r.staff_last_at);
    if (staffAt && aiAt && staffAt >= aiAt) continue;
    waitingStaff.total += 1;
    const d = fullDays(aiAt, now);
    if (d === 0) waitingStaff.d0 += 1;
    else if (d <= 3) waitingStaff.d1_3 += 1;
    else waitingStaff.over3 += 1;
  }
  return { uncalled, waitingStaff, appointments };
}

const NO_NAME = 'ไม่ระบุชื่อ';
const USERS = tableInAppSchema('users');

/** อีเมล (ตัวเล็ก) → ชื่อเล่น → ชื่อจริง (กติกาเดียวกับ created_by_display หน้าติดตาม) · อ่านไม่ได้ = ใช้อีเมลเดิม */
async function loadStaffDisplay(): Promise<(email: string) => string | null> {
  try {
    const { rows } = await dbQuery<{ email: string; name: string | null }>(
      `select lower(btrim(email)) as email, coalesce(nullif(btrim(nickname), ''), nullif(btrim(full_name), '')) as name
         from ${USERS} where email is not null`,
    );
    const map = new Map(rows.map((r) => [r.email, r.name]));
    return (email) => map.get(email) ?? null;
  } catch (e) {
    logError('recruit-overview: users', e);
    return () => null;
  }
}

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
async function loadFacts(params: unknown[]): Promise<Row[]> {
  try {
    return (await dbQuery<Row>(factsSql(), params)).rows;
  } catch (e) {
    if (!isPgUndefinedTable(e)) throw e;
    // ผลนัด (089) หรือผ่าน/ไม่ผ่าน (151) ยังไม่ migrate — ลองตัดทีละอย่าง
    try {
      return (await dbQuery<Row>(factsSql(LATEST_ATTENDANCE_SQL, 'null::text'), params)).rows;
    } catch (e2) {
      if (!isPgUndefinedTable(e2)) throw e2;
      return (await dbQuery<Row>(factsSql('null::text', 'null::text'), params)).rows;
    }
  }
}

export async function buildRecruitOverview(
  monthParam: unknown,
  scope: DepartmentScope,
  now: Date,
  /** ช่วงที่เลือกเอง (รายวัน/ช่วง · 5 ต.ค. 2569) — ค่าผิด/ไม่ส่ง = แบบเดือน */
  range?: { from: unknown; to: unknown },
): Promise<RecruitOverviewResponse> {
  const today = toBangkokYmd(now);
  const window = (range ? rangeWindow(range.from, range.to, today) : null) ?? monthWindow(monthParam, today);
  const bu = scope.mode === 'code' ? normalizeTrendBu(scope.code) : null;
  const body: RecruitOverviewResponse = {
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

  const bothRange = [startOfBkk(window.prevFrom), startOfBkk(addDays(window.to, 1)), bu];
  const monthRange = [startOfBkk(window.from), startOfBkk(addDays(window.to, 1)), bu];
  const nowMs = now.getTime();

  const [boardR, factsR, backlogR, apptR, staffR, showedR, aiR, firstR, everR, chR, reqR, informR, irecR, irAppR] = await Promise.all([
    settle('รายชื่อบนบอร์ด', loadBoardPhoneSet),
    settle('ใบสมัคร', () => loadFacts(bothRange)),
    settle('งานค้าง', async () => (await dbQuery<Row>(backlogSql(), [bu])).rows),
    settle('นัดที่รอผล', async () => {
      try {
        const r = (await dbQuery<Row>(appointmentBacklogSql(), [bu])).rows[0] ?? {};
        return { overdue: Number(r.overdue ?? 0), next7: Number(r.next7 ?? 0) };
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
    settle('วันแรกของข้อมูล', async () => text((await dbQuery<Row>(firstDaySql(), [bu])).rows[0]?.first_day)),
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
    settle('ใบขอ', async () =>
      toRequestSummary(
        await loadOnlineRequestRows({ from: window.from, to: window.to, bu, departmentScope: scope }),
      ),
    ),
    // ช่องทาง → แจ้งเข้า (เจ้าของ 19 ต.ค. 2569 "จับได้ถึงแจ้งเข้า") — แจ้งเข้าตั้งแต่ต้นช่วงเทียบ · iRecruit ย้อน 60 วัน
    settle('ใบแจ้งเข้า ERP', () => loadInformDaysByPhone(window.prevFrom)),
    settle('ช่องทาง iRecruit', () => loadIrecruitRegsByPhone(window.prevFrom, window.to)),
    // ผู้สมัครใน iRecruit (ขั้นคีย์เข้า iRecruit หลังมาตามนัด · 20 ต.ค. 2569)
    settle('ผู้สมัคร iRecruit', () => loadIrecruitApplicantDays(window.prevFrom)),
  ]);

  // บอร์ด ERP อ่านไม่ได้ = ไม่รู้ว่าได้ใบสมัครหรือยัง (null) — ไม่ใช่ "ยังไม่ได้"
  const boardPhones = boardR.ok ? boardR.value : null;
  if (!boardR.ok || boardPhones === null) body.errors.board = 'อ่านรายชื่อบนบอร์ด ERP ไม่ได้ — ยอดได้ใบสมัครเช็คไม่ได้ชั่วคราว';

  const sources: AppSourceMaps = {
    informDays: informR.ok ? informR.value : null,
    irecruitRegs: irecR.ok ? irecR.value : null,
    irecruitApplicants: irAppR.ok ? irAppR.value : null,
  };
  if (!informR.ok) body.errors.informs = informR.error;
  if (factsR.ok) body.apps = factsR.value.map((r) => toFact(r, boardPhones, sources));
  else {
    body.apps = null;
    body.errors.apps = factsR.error;
  }

  if (backlogR.ok && apptR.ok) body.backlog = toBacklog(backlogR.value, apptR.value, nowMs);
  else body.errors.backlog = !backlogR.ok ? backlogR.error : (apptR as { error: string }).error;

  if (staffR.ok && showedR.ok) body.staff = toStaffRows(staffR.value, showedR.value, await loadStaffDisplay());
  else {
    body.staff = null;
    body.errors.staff = !staffR.ok ? staffR.error : (showedR as { error: string }).error;
  }
  if (aiR.ok) body.ai = toAiRow(aiR.value);
  else {
    body.ai = null;
    body.errors.staff = body.errors.staff ?? aiR.error;
  }

  if (chR.ok) body.channelPlacement = chR.value;
  else {
    body.channelPlacement = null;
    body.errors.channels = chR.error;
  }
  if (reqR.ok) body.requests = reqR.value;
  else {
    body.requests = null;
    body.errors.requests = reqR.error;
  }

  body.firstDay = firstR.ok ? firstR.value : null;
  body.attendanceEverRecorded = everR.ok ? everR.value : false;
  return body;
}

async function handler(req: AuthedReq, res: ApiRes) {
  if ((req.method || 'GET').toUpperCase() !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scope = await loadMatchingBuScope(req.user);
    const month = typeof req.query?.month === 'string' ? req.query.month.trim() : undefined;
    const from = typeof req.query?.from === 'string' ? req.query.from.trim() : undefined;
    const to = typeof req.query?.to === 'string' ? req.query.to.trim() : undefined;
    const body = await buildRecruitOverview(month, scope, new Date(), from && to ? { from, to } : undefined);
    res.setHeader?.('Cache-Control', 'no-store');
    return res.status(200).json(body);
  } catch (e) {
    return handleApiError(res, e, 'recruit-overview', { userId: req.user?.sub });
  }
}

export default withRbac(handler, 'job-applications');
