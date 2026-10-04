/**
 * ═══ SQL ของหน้าหลัก "ระบบไปกี่ %" — AI โทร vs คนโทร (เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * นิยามเต็มอยู่หัว `src/lib/homeAiShare.ts` · ไฟล์นี้แปลงเป็น SQL โดย **ยืมนิยามเดิมทั้งหมด**:
 * - ผู้สมัคร: "โทรแล้ว" = หลักฐาน E1–E4 ของกล่องงาน (`CALLED_BY_AI_SQL` / `CALLED_BY_STAFF_SQL`
 *   แยกจาก `CALLED_SQL` ตัวเดียวกัน) · ยังไม่โทรแยกด้วย `IN_QUEUE_SQL` / `HELD_OR_CLAIMED_SQL` (ถังของกล่องงาน)
 * - ติดตาม / ดูแลหลังเริ่มงาน: แถว follow_entries ชุดเดียวกัน แยกด้วยหัวข้อ `AFTERCARE_TOPIC`
 *   (หน้าดูแลหลังเริ่มงานใช้โครง Follow เดิม ต่างกันแค่หัวข้อ) · AI = คิวของรอบนั้นมีผล
 *   (join ชุดเดียวกับรายการของหน้าติดตาม) · คน = เจ้าหน้าที่ลงผลของรอบคนโทร (migration 130)
 * - จับคู่งาน: เลน `match` ของ `queueLane` (card-/ir-) + "รับไปโทรเอง" ของหน้านั้น (hold source board/irecruit)
 *   ต่อกันด้วย **เบอร์ + ใบขอ** · hold ของใบสมัคร (`application`) อยู่ก้อนผู้สมัครแล้ว ห้ามนับซ้ำที่นี่
 * - BU: ตัวกลางของหน้าหลัก (`homeBuSql.ts`)
 *
 * พารามิเตอร์ทุกคิวรี: `$1` = จุดเริ่ม (null = ทั้งหมด) · `$2` = จุดจบ (ไม่รวม · ไม่เกินตอนนี้) · `$3` = BU กลาง
 * (null = ทุก BU) · ติดตาม/ดูแลหลังเริ่มงานมี `$4` = หัวข้อของหน้าดูแลหลังเริ่มงาน
 * 🔴 ทุกคอลัมน์ boolean ใน CTE มาจาก `exists`/`is not null`/`coalesce(…, false)` ⇒ ไม่มี NULL มาทำให้
 *    `filter` ข้ามแถวเงียบ ๆ (กับดักตรรกะสามค่าที่ `lumosQueueDefs.ts` เตือนไว้)
 */
import { tableInAppSchema } from './schema.js';
import { queueCancelled, queueLastResultAt, queueOutcome, queuePayloadNameSql, queueReplySql } from './lumosQueueDefs.js';
import {
  CALLED_BY_AI_SQL,
  CALLED_BY_STAFF_SQL,
  HELD_OR_CLAIMED_SQL,
  IN_QUEUE_SQL,
  LATEST_AI_RESULT_LATERAL,
  LATEST_STAFF_RESULT_LATERAL,
  holdEventAtSql,
} from './applicantOverviewSql.js';
import {
  appBuJoin,
  appBuSql,
  followBuJoin,
  followBuSql,
  holdBuJoin,
  holdBuSql,
  queueBuJoins,
  queueBuSql,
} from './homeBuSql.js';
import type { AiShareListKey } from '../../src/lib/homeAiShare.js';

const APPS = tableInAppSchema('public_job_applications');
const FOLLOW = tableInAppSchema('follow_entries');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');

/**
 * รูปผลลัพธ์ — `total` = ยอดรวมก้อนเดียว (การ์ด) · `byDayBu` = แยกวัน (เวลาไทย) × BU (กราฟ) ·
 * `list` = รายชื่อของก้อนเดียว ทีละหน้า (Popup ตอนกดกล่อง · รอบ 17) ·
 * `results` = ผลล่าสุดของงานที่โทรแล้ว แยก AI/คน (แผง "ผลโทร" · รอบ 18 — หน้าเว็บ/เส้นเป็นคนจัดถังด้วยคำพูด)
 * ทุกโหมดใช้ CTE ตัวเดียวกัน ⇒ ผลรวมทุกแถวของ `byDayBu` = ยอดของ `total` · จำนวนชื่อของ `list` = เลขในกล่อง (เทสต์คุม)
 */
export type AiShareSqlMode = 'total' | 'byDayBu' | 'list' | 'results';

/** หน้าของรายชื่อ — `key` = กล่องที่กด · `limit`/`offset` เป็นจำนวนเต็มที่ตรวจแล้วเท่านั้น */
export type AiShareListOpts = { key: AiShareListKey; limit: number; offset: number };

/**
 * เงื่อนไขของแต่ละก้อน — **ตัวเดียวกันทั้งตัวนับและรายชื่อ** (ห้ามเขียนซ้ำที่อื่น ไม่งั้นชื่อใน Popup ไม่เท่าเลขในกล่อง)
 * 4 ก้อนไม่ทับกัน รวมกันเท่าทั้งหมดพอดี (`isBalanced`)
 */
export const SEGMENT_WHERE: Record<AiShareListKey, string> = {
  total: 'true',
  ai: 'ai and not staff',
  staff: 'staff and not ai',
  both: 'ai and staff',
  notCalled: 'not ai and not staff',
};

/** ก้อนของแถวหนึ่งแถว (คอลัมน์ในรายชื่อ) — ไล่ตามเงื่อนไขชุดเดียวกับ `SEGMENT_WHERE` */
const SEGMENT_CASE = `case when ${SEGMENT_WHERE.both} then 'both' when ${SEGMENT_WHERE.ai} then 'ai' when ${SEGMENT_WHERE.staff} then 'staff' else 'notCalled' end`;

const bkkDay = (col: string) => `to_char(timezone('Asia/Bangkok', ${col}), 'YYYY-MM-DD')`;
const outCols = (mode: AiShareSqlMode) => (mode === 'byDayBu' ? 'day, bu,\n         ' : '');
const outGroup = (mode: AiShareSqlMode) => (mode === 'byDayBu' ? '\n   group by day, bu\n   order by day, bu' : '');

/** จำนวนเต็มที่ฝังลง SQL ได้ — นอกช่วง/ไม่ใช่จำนวนเต็ม = โยนทิ้ง (ห้ามต่อสตริงจากค่าที่ไม่ได้ตรวจ) */
function sqlInt(v: number, min: number, max: number, what: string): number {
  if (!Number.isSafeInteger(v) || v < min || v > max) throw new RangeError(`home-ai-share list: ${what} out of range`);
  return v;
}

/**
 * ท้ายคิวรีของรายชื่อ — แถวของก้อนที่กด ใหม่สุดก่อน · `total_rows` = จำนวนแถวทั้งก้อน (ทุกหน้า)
 * CTE ต้องมีคอลัมน์ `id` · `name` · `at` (เวลาของงาน) · `day` · `bu` · `ai` · `staff`
 */
function listSelect(from: string, list: AiShareListOpts | undefined): string {
  if (!list) throw new Error('home-ai-share list: missing list options');
  const where = SEGMENT_WHERE[list.key];
  if (!where) throw new Error('home-ai-share list: unknown segment');
  const limit = sqlInt(list.limit, 1, 200, 'limit');
  const offset = sqlInt(list.offset, 0, 1_000_000, 'offset');
  return `
  select id, name, day, bu,
         ${SEGMENT_CASE} as segment,
         count(*) over ()::int as total_rows
    from ${from}
   where ${where}
   order by at desc, id desc
   limit ${limit} offset ${offset}`;
}

/** คอลัมน์เพิ่มของ CTE เฉพาะโหมดรายชื่อ — โหมดนับไม่แตะ (คิวรีเดิมไม่เปลี่ยน) */
const listCols = (mode: AiShareSqlMode, cols: string) => (mode === 'list' ? `,\n           ${cols}` : '');
/** คอลัมน์/ตารางเพิ่มของ CTE เฉพาะโหมดผลโทร (รอบ 18) — โหมดอื่นไม่แตะ */
const resultCols = (mode: AiShareSqlMode, cols: string) => (mode === 'results' ? `,\n           ${cols}` : '');
const resultJoins = (mode: AiShareSqlMode, joins: string) => (mode === 'results' ? `\n      ${joins}` : '');

/**
 * ท้ายคิวรีของผลโทร — รายชื่อที่มีผลอย่างน้อยหนึ่งฝั่ง · ฝั่งละผลล่าสุดพร้อมเวลา (หน้าเว็บ/เส้นเลือกผลล่าสุดผลเดียวต่อรายชื่อ)
 * CTE ต้องมี `ai_outcome` `ai_summary` `ai_reply` `ai_at` `staff_outcome` `staff_at`
 */
const resultsSelect = (from: string) => `
  select ai_outcome, ai_summary, ai_reply, ai_at, staff_outcome, staff_at
    from ${from}
   where ai_outcome is not null or staff_outcome is not null`;

/** ผลของคิวแถวนั้น (ฝั่ง AI ของแผงผลโทร) — รหัสผลตัวกลาง + สรุป + คำพูดของผู้รับสาย */
const QUEUE_RESULT_COLS = (q: string) =>
  `${queueOutcome(q)} as outcome, ${q}.result->>'summary' as summary, ${queueReplySql(q)} as reply`;

/** แถวคิวของรอบติดตาม — เงื่อนไขชุดเดียวกับรายการของหน้าติดตาม (`listFollow` ใน `api/_handlers/follow.ts`) */
export const FOLLOW_QUEUE_MATCH = `q.channel = 'reminder' and q.job_ref = 'follow' and q.person_ref = 'follow-' || f.id::text`;

/** AI โทรแล้ว = คิวของรอบนี้มีผลกลับ (รวมไม่รับสาย) ที่ไม่ใช่ยกเลิก — กติกาเดียวกับ E1 ของใบสมัคร */
export const FOLLOW_CALLED_BY_AI_SQL = `exists (
    select 1 from ${QUEUE} q
     where ${FOLLOW_QUEUE_MATCH}
       and ${queueOutcome('q')} is not null
       and ${queueOutcome('q')} <> 'cancelled')`;

/** รอคิว AI = เข้าคิวแล้ว ยังไม่มีผล (รอส่งออก หรือ Lumos รับไปแล้ว) */
export const FOLLOW_WAITING_AI_SQL = `exists (
    select 1 from ${QUEUE} q
     where ${FOLLOW_QUEUE_MATCH}
       and q.status in ('pending', 'delivered')
       and ${queueOutcome('q')} is null)`;

/** หัวข้อติดตามแบบแผน — ตั้งให้ AI โทร (ไม่ระบุ = AI · ตัวเดียวกับ `followCallerOf`) / ตั้งให้คนโทร */
export const FOLLOW_PLAN_AI_SQL = "(f.call_mode is distinct from 'manual')";
export const FOLLOW_PLAN_STAFF_SQL = "(f.call_mode = 'manual')";

/** คนโทรแล้ว = เจ้าหน้าที่ลงผลของสายนี้ (130) · ฐานยังไม่รัน 130 = `false` (ยังไม่มีทางลงผลเลย) */
export function followCalledByStaffSql(staffReady: boolean): string {
  return staffReady ? '(f.staff_called_at is not null)' : 'false';
}

/** ก้อนไหนของแถว follow_entries — หน้าดูแลหลังเริ่มงานคือหัวข้อ `$4` · ที่เหลือทั้งหมดเป็นของหน้าติดตาม */
export type FollowLane = 'follow' | 'aftercare';

const FOLLOW_LANE_WHERE: Record<FollowLane, string> = {
  follow: 'f.topic is distinct from $4::text',
  aftercare: 'f.topic = $4::text',
};

/**
 * หน้าติดตาม / ดูแลหลังเริ่มงาน — หน่วย = สาย (หนึ่งแถว = หนึ่งรอบ) · ไม่นับที่ยกเลิก
 * นับรอบที่ **ถึงคิวโทรในช่วงนั้นแล้ว** (`$2` ไม่เกินตอนนี้ ⇒ แผนล่วงหน้ายังไม่ใช่งาน)
 * รายชื่อ = ชื่อผู้รับสายของรอบนั้น · เวลาของงาน = เวลาถึงคิว
 */
export function buildFollowAiShareSql(
  staffReady: boolean,
  lane: FollowLane,
  mode: AiShareSqlMode = 'total',
  list?: AiShareListOpts,
): string {
  /**
   * 🔴 หัวข้อ "ติดตาม" นับแบบ **แผน** ชุดเดียวกับหน้าติดตาม (เจ้าของสั่ง 4 ต.ค. 2569: *"ทั้งหมดเท่าไหร่ AI โทรทั้ง 2 รายการ
   * รวมเท่าไหร่ … ตอนนี้มีแค่หน้ารายชื่อติดตาม 31 ก็ต้องได้ 31 · แยกดูรายวัน สัปดาห์ เดือน ก็ต้องได้ผลรวมตามช่วงนั้น"*)
   * ทั้งหมด = ทุกสายในช่วง (สองแท็บรวม · รวมยกเลิกเหมือนเลข "ทั้งหมด" ของหน้าติดตาม) · AI/คน = ตั้งให้ใครโทร
   * ⇒ ไม่มี "ทั้งสองทาง" / "ยังไม่โทร" · ช่วงจบ = ปลายช่วงที่เลือกจริง (หน้าเรียกส่งปลายช่วงไม่ตัดที่ตอนนี้)
   * ดูแลหลังเริ่มงาน + แผงผลโทร ยังนับแบบเดิม (ใครโทรไปแล้ว)
   */
  const plan = lane === 'follow' && mode !== 'results';
  return `
  with f0 as (
    select f.call_mode,
           /* ทีมของสาย (131) — หน้าแรกแยก "ติดตามคนเริ่มงาน / ติดตามส่งคนแทน" (เจ้าของสั่ง 4 ต.ค. 2569) */
           (f.follow_team = 'replacement') as replacement,
           ${plan ? FOLLOW_PLAN_AI_SQL : FOLLOW_CALLED_BY_AI_SQL} as ai,
           ${plan ? FOLLOW_PLAN_STAFF_SQL : followCalledByStaffSql(staffReady)} as staff,
           ${FOLLOW_WAITING_AI_SQL} as waiting_ai,
           ${bkkDay('f.scheduled_at')} as day,
           ${followBuSql('f')} as bu${listCols(mode, "f.id::text as id,\n           nullif(btrim(f.recipient_name), '') as name,\n           f.scheduled_at as at")}${resultCols(
             mode,
             `air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply, air.at as ai_at,\n           case when ${followCalledByStaffSql(staffReady)} then nullif(btrim(${staffReady ? 'f.staff_call_outcome' : 'null::text'}), '') end as staff_outcome,\n           ${staffReady ? 'f.staff_called_at' : 'null::timestamptz'} as staff_at`,
           )}
      from ${FOLLOW} f
      ${followBuJoin('f')}${resultJoins(
        mode,
        `left join lateral (
        select ${QUEUE_RESULT_COLS('q')}, ${queueLastResultAt('q')} as at
          from ${QUEUE} q
         where ${FOLLOW_QUEUE_MATCH}
           and ${queueOutcome('q')} is not null
           and ${queueOutcome('q')} <> 'cancelled'
         order by ${queueLastResultAt('q')} desc nulls last
         limit 1
      ) air on true`,
      )}
     where ${plan ? 'true' : 'f.cancelled_at is null'}
       and ${FOLLOW_LANE_WHERE[lane]}
       and ($1::timestamptz is null or f.scheduled_at >= $1::timestamptz)
       and ($2::timestamptz is null or f.scheduled_at < $2::timestamptz)
       and ($3::text is null or ${followBuSql('f')} = $3::text)
  )${
    mode === 'results'
      ? resultsSelect('f0')
      : mode === 'list'
      ? listSelect('f0', list)
      : `
  select ${outCols(mode)}count(*)::int                                                         as total,
         count(*) filter (where ${SEGMENT_WHERE.ai})::int                                      as ai,
         count(*) filter (where ${SEGMENT_WHERE.staff})::int                                   as staff,
         count(*) filter (where ${SEGMENT_WHERE.both})::int                                    as both,
         count(*) filter (where ${SEGMENT_WHERE.notCalled})::int                               as not_called,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and waiting_ai)::int                as waiting_ai,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and call_mode = 'manual')::int      as waiting_staff,
         count(*) filter (where replacement)::int                                              as team_replacement,
         count(*) filter (where replacement and ${SEGMENT_WHERE.ai})::int                      as team_replacement_ai
    from f0${outGroup(mode)}`
  }`;
}

/**
 * ผู้สมัครในกล่องงาน — หน่วย = ใบ · ตามวันสมัคร · ไม่นับ Lead (ตัวเดียวกับเลขบนการ์ดกล่องงาน)
 * รายชื่อ = ชื่อบนใบสมัคร · เวลาของงาน = เวลาสมัคร
 */
export function buildApplicantAiShareSql(mode: AiShareSqlMode = 'total', list?: AiShareListOpts): string {
  return `
  with a0 as (
    select ${CALLED_BY_AI_SQL} as ai,
           ${CALLED_BY_STAFF_SQL} as staff,
           ${IN_QUEUE_SQL} as in_queue,
           ${HELD_OR_CLAIMED_SQL} as held,
           ${bkkDay('a.created_at')} as day,
           ${appBuSql('a')} as bu${listCols(mode, "a.id::text as id,\n           nullif(btrim(a.full_name), '') as name,\n           a.created_at as at")}${resultCols(
             mode,
             'air.outcome as ai_outcome, air.summary as ai_summary, air.reply as ai_reply, air.at as ai_at,\n           str.outcome as staff_outcome, str.at as staff_at',
           )}
      from ${APPS} a
      ${appBuJoin('a')}${resultJoins(mode, `${LATEST_AI_RESULT_LATERAL}\n      ${LATEST_STAFF_RESULT_LATERAL}`)}
     where not coalesce(a.is_lead, false)
       and ($1::timestamptz is null or a.created_at >= $1::timestamptz)
       and a.created_at < $2::timestamptz
       and ($3::text is null or ${appBuSql('a')} = $3::text)
  )${
    mode === 'results'
      ? resultsSelect('a0')
      : mode === 'list'
      ? listSelect('a0', list)
      : `
  select ${outCols(mode)}count(*)::int                                                                        as total,
         count(*) filter (where ${SEGMENT_WHERE.ai})::int                                                     as ai,
         count(*) filter (where ${SEGMENT_WHERE.staff})::int                                                  as staff,
         count(*) filter (where ${SEGMENT_WHERE.both})::int                                                   as both,
         count(*) filter (where ${SEGMENT_WHERE.notCalled})::int                                              as not_called,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and in_queue)::int                                 as waiting_ai,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and not in_queue and held)::int                    as held,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and not in_queue and not held)::int                as untouched
    from a0${outGroup(mode)}`
  }`;
}

/** เลนจับคู่งานของคิว — ชุดเดียวกับ `queueLane()` = 'match' (`src/lib/officeTeam.ts`) */
export const MATCH_QUEUE_WHERE = `(q.person_ref like 'card-%' or q.person_ref like 'ir-%') and coalesce(q.job_ref, '') <> 'follow'`;

/** "รับไปโทรเอง" ของหน้าจับคู่งาน — hold ของใบสมัครนับอยู่ก้อนผู้สมัครแล้ว */
export const MATCH_HOLD_WHERE = `h.source in ('board', 'irecruit')`;

/**
 * จับคู่งาน — หน่วย = **คน ต่อหนึ่งใบขอ** (เบอร์ + ใบขอ) · สายที่ยกเลิกไม่นับ
 * ต่อสองแหล่งด้วยเบอร์ + ใบขอ ⇒ คนที่ AI โทรแล้วเจ้าหน้าที่โทรต่อ = ทั้งสองทาง (นับครั้งเดียว)
 * วันของงาน = วันที่ส่งเข้าคิว (ตัวเดียวกับยอดส่ง Lumos ของหน้าทีม Online) · วันที่เจ้าหน้าที่รับไป
 * รายชื่อ = ชื่อแรกที่มีของคู่นั้น (payload ของคิว / ชื่อบน hold) · 🔴 กุญแจแถว = md5 ของคู่ ห้ามส่งเบอร์ออกไป
 */
export function buildMatchingAiShareSql(mode: AiShareSqlMode = 'total', list?: AiShareListOpts): string {
  const qOut = queueOutcome('q');
  return `
  with ev as (
    select coalesce(coalesce(q.payload->>'recipient_phone', q.payload->>'phone'), 'ref:' || q.person_ref) as person,
           q.job_ref as job,
           (${qOut} is not null and ${qOut} <> 'cancelled') as ai_done,
           false as staff_done,
           (q.status in ('pending', 'delivered') and ${qOut} is null) as ai_waiting,
           false as staff_holding,
           q.created_at as at,
           ${queueBuSql('q')} as bu${listCols(mode, `${queuePayloadNameSql('q')} as name`)}${resultCols(
             mode,
             `${QUEUE_RESULT_COLS('q')},\n           ${queueLastResultAt('q')} as result_at`,
           )}
      from ${QUEUE} q
      ${queueBuJoins('q')}
     where ${MATCH_QUEUE_WHERE}
       and not ${queueCancelled('q')}
    union all
    select h.phone_e164 as person,
           h.job_id as job,
           false as ai_done,
           (h.result_outcome is not null) as staff_done,
           false as ai_waiting,
           (h.released_at is null and h.result_outcome is null) as staff_holding,
           h.held_at as at,
           ${holdBuSql('h')} as bu${listCols(mode, "nullif(btrim(h.candidate_name), '') as name")}${resultCols(
             mode,
             `h.result_outcome as outcome, null::text as summary, null::text as reply,\n           ${holdEventAtSql('h')} as result_at`,
           )}
      from ${HOLDS} h
      ${holdBuJoin('h')}
     where ${MATCH_HOLD_WHERE}
  ),
  pairs as (
    select person, job,
           bool_or(ai_done) as ai,
           bool_or(staff_done) as staff,
           bool_or(ai_waiting) as waiting_ai,
           bool_or(staff_holding) as holding,
           -- วัน/BU ของคู่ = งานแรกในช่วง (คนเดียวกันใบเดียวกันนับวันเดียว BU เดียว)
           ${bkkDay('min(at)')} as day,
           (array_agg(bu order by at))[1] as bu${listCols(
             mode,
             "md5(coalesce(person, '') || '|' || coalesce(job, '')) as id,\n           (array_agg(name order by at) filter (where name is not null))[1] as name,\n           min(at) as at",
           )}${resultCols(
             mode,
             [
               '(array_agg(outcome order by result_at desc nulls last) filter (where ai_done))[1] as ai_outcome',
               '(array_agg(summary order by result_at desc nulls last) filter (where ai_done))[1] as ai_summary',
               '(array_agg(reply order by result_at desc nulls last) filter (where ai_done))[1] as ai_reply',
               '(array_agg(result_at order by result_at desc nulls last) filter (where ai_done))[1] as ai_at',
               '(array_agg(outcome order by result_at desc nulls last) filter (where staff_done))[1] as staff_outcome',
               '(array_agg(result_at order by result_at desc nulls last) filter (where staff_done))[1] as staff_at',
             ].join(',\n           '),
           )}
      from ev
     where ($1::timestamptz is null or at >= $1::timestamptz)
       and at < $2::timestamptz
       and ($3::text is null or bu = $3::text)
     group by person, job
  )${
    mode === 'results'
      ? resultsSelect('pairs')
      : mode === 'list'
      ? listSelect('pairs', list)
      : `
  select ${outCols(mode)}count(*)::int                                                                  as total,
         count(*) filter (where ${SEGMENT_WHERE.ai})::int                                               as ai,
         count(*) filter (where ${SEGMENT_WHERE.staff})::int                                            as staff,
         count(*) filter (where ${SEGMENT_WHERE.both})::int                                             as both,
         count(*) filter (where ${SEGMENT_WHERE.notCalled})::int                                        as not_called,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and waiting_ai)::int                         as waiting_ai,
         count(*) filter (where ${SEGMENT_WHERE.notCalled} and not waiting_ai and holding)::int         as holding
    from pairs${outGroup(mode)}`
  }`;
}
