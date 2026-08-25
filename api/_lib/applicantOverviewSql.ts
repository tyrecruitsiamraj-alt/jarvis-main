/**
 * นิยามตัวเลข Dashboard "ศูนย์คุมงานสรรหา" (เจ้าของสั่ง 15 ส.ค. 2569) — **ที่เดียว**
 *
 * กติกาความเที่ยง (บทเรียน "เลขถูกแต่ตอบผิดคำถาม" + "โทรไปแล้ว 304.7%"):
 * 1. ประชากรเดียว (ใบสมัครใน scope) หั่นเป็นถังที่ไม่ทับกัน — มี sum-check เป็นเทสต์
 * 2. หน่วยนับ = **ใบ** (แถวที่เจ้าของเห็นบนตาราง) ไม่ใช่คน/เบอร์ — กล่องกดแล้วต้องเจอ
 *    แถวเท่ากันเป๊ะ → เงื่อนไขต่อถังอยู่ที่ `bucketCondition()` ใช้ทั้งตัวนับและ drill-down
 * 3. หลักฐาน "โทรแล้ว" = เวลาที่เขียนครั้งเดียว (088) ไม่ใช่สถานะที่ reset ได้
 * 4. **temporal guard**: ผลโทรบนเบอร์เดียวกันจากช่องทางอื่น (card-/ir-/follow-) นับเป็น
 *    หลักฐานของใบ เฉพาะเมื่อเวลาเหตุการณ์ ≥ เวลากรอกใบ — ไม่งั้นใบใหม่ของเบอร์เดิม
 *    เกิดมาพร้อมสถานะ "โทรแล้ว" จากผลเมื่อ 3 เดือนก่อน
 * 5. **ห้ามอ่านจาก status ใบ** — status ขยับจากขั้นที่คนกด (claim ก็ขยับ) ตอบคนละคำถาม
 */
import { tableInAppSchema } from './schema.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const CONTACTS = tableInAppSchema('application_contact_logs');
const ATTENDANCE = tableInAppSchema('application_appointment_results');

/** เบอร์ใน payload คิว — reminder ใช้ recipient_phone · interview ใช้ phone (กับดักซ้ำ) */
const QUEUE_PHONE = `coalesce(payload->>'recipient_phone', payload->>'phone')`;
/** ผลโทรในคิว — coalesce เสมอ (ผลที่คนบันทึก/หลัง retry อยู่ที่ last_outcome) */
const QUEUE_OUTCOME = `coalesce(last_outcome, result->>'outcome')`;
/** เวลาเหตุการณ์ผลในคิว — first_result_at (088 เขียนครั้งเดียว) · แถวเก่า backfill = updated_at */
const QUEUE_EVENT_AT = `coalesce(first_result_at, updated_at)`;
/** เวลาเหตุการณ์ผลของ hold — result_at (088) · แถวเก่า = updated_at/released_at */
const HOLD_EVENT_AT = `coalesce(result_at, updated_at, released_at, held_at)`;

/** ผลที่นับว่า "คุยถึงตัว" (ติดต่อสำเร็จ — รวม declined เพราะติดต่อถึงตัวแล้ว ต้องเขียนอธิบายบนจอ) */
const CONNECTED_OUTCOMES = `('confirmed','acknowledged','declined','reschedule_requested')`;

/**
 * หลักฐาน "ใบ a ถูกโทรแล้ว" — E1 คิวของใบตรง ๆ (app-<id> · เส้น S8) · E2 hold ของใบ
 * (source application) · E3 บันทึกผลติดต่อ · E4 ผลบนเบอร์เดียวกันจากช่องทางอื่น + guard
 * ทุกก้อนอ้าง alias `a` (แถวใบสมัคร) — ใช้ได้ทั้งใน CTE ของ overview และ WHERE ของลิสต์
 */
const CALLED_VIA_APP_QUEUE = `exists (
  select 1 from ${QUEUE} q
   where q.person_ref = 'app-' || a.id::text
     and ${qcol('q', QUEUE_OUTCOME)} is not null
     and ${qcol('q', QUEUE_OUTCOME)} <> 'cancelled')`;

const CALLED_VIA_HOLD_APP = `exists (
  select 1 from ${HOLDS} h
   where h.source = 'application' and h.candidate_ref = a.id::text
     and h.result_outcome is not null)`;

const CALLED_VIA_CONTACT_LOG = `exists (
  select 1 from ${CONTACTS} c where c.application_id = a.id)`;

const CALLED_VIA_PHONE = `(a.phone_e164 is not null and (
  exists (
    select 1 from ${QUEUE} q
     where ${qcol('q', QUEUE_PHONE)} = a.phone_e164
       and ${qcol('q', QUEUE_OUTCOME)} is not null
       and ${qcol('q', QUEUE_OUTCOME)} <> 'cancelled'
       and ${qcol('q', QUEUE_EVENT_AT)} >= a.created_at)
  or exists (
    select 1 from ${HOLDS} h
     where h.phone_e164 = a.phone_e164
       and h.result_outcome is not null
       and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at)
))`;

/** เติม alias ให้นิพจน์คอลัมน์เปล่า (payload->>... → q.payload->>...) */
function qcol(alias: string, expr: string): string {
  return expr
    .replace(/\b(payload|last_outcome|result|first_result_at|updated_at|result_at|released_at|held_at)\b/g, `${alias}.$1`)
    .replace(new RegExp(`${alias}\\.${alias}\\.`, 'g'), `${alias}.`);
}

export const CALLED_SQL = `(${CALLED_VIA_APP_QUEUE} or ${CALLED_VIA_HOLD_APP} or ${CALLED_VIA_CONTACT_LOG} or ${CALLED_VIA_PHONE})`;

/** อยู่ในคิว AI รอผล (pending/delivered ยังไม่มีผล) — เบอร์ตรง หรือแถว app- ของใบ */
export const IN_QUEUE_SQL = `(
  exists (
    select 1 from ${QUEUE} q
     where q.status in ('pending','delivered')
       and ${qcol('q', QUEUE_OUTCOME)} is null
       and (q.person_ref = 'app-' || a.id::text
            or (a.phone_e164 is not null and ${qcol('q', QUEUE_PHONE)} = a.phone_e164)))
)`;

/** มีคนถืองานอยู่ (hold ยังไม่ปล่อย) หรือใบถูกเก็บไปติดต่อ (claim) */
export const HELD_OR_CLAIMED_SQL = `(
  a.claimed_by is not null
  or (a.phone_e164 is not null and exists (
       select 1 from ${HOLDS} h
        where h.phone_e164 = a.phone_e164 and h.released_at is null))
)`;

/** ผลล่าสุดต่อใบ (เทียบเวลาข้ามแหล่ง: log ใบ vs ผลบนเบอร์) → 'success' | 'failed' | null */
const LATEST_CLASS_SQL = `(
  select cls from (
    select case when c.ok then 'success' else 'failed' end as cls, c.created_at as at
      from ${CONTACTS} c where c.application_id = a.id
    union all
    select case when ${qcol('q', QUEUE_OUTCOME)} in ${CONNECTED_OUTCOMES} then 'success' else 'failed' end,
           ${qcol('q', QUEUE_EVENT_AT)}
      from ${QUEUE} q
     where a.phone_e164 is not null and ${qcol('q', QUEUE_PHONE)} = a.phone_e164
       and ${qcol('q', QUEUE_OUTCOME)} is not null and ${qcol('q', QUEUE_OUTCOME)} <> 'cancelled'
       and ${qcol('q', QUEUE_EVENT_AT)} >= a.created_at
    union all
    select case when h.result_outcome in ${CONNECTED_OUTCOMES} then 'success' else 'failed' end,
           ${qcol('h', HOLD_EVENT_AT)}
      from ${HOLDS} h
     where ((h.source = 'application' and h.candidate_ref = a.id::text)
            or (a.phone_e164 is not null and h.phone_e164 = a.phone_e164
                and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at))
       and h.result_outcome is not null
  ) ev order by ev.at desc limit 1
)`;

/** เวลาโทรครั้งแรกของใบ (คำนวณตอนอ่าน — ไม่ stamp บนใบ ดูเหตุผลในหัวไฟล์) */
const FIRST_CALLED_AT_SQL = `(
  select min(at) from (
    select c.created_at as at from ${CONTACTS} c where c.application_id = a.id
    union all
    select ${qcol('q', QUEUE_EVENT_AT)} from ${QUEUE} q
     where (q.person_ref = 'app-' || a.id::text
            or (a.phone_e164 is not null and ${qcol('q', QUEUE_PHONE)} = a.phone_e164
                and ${qcol('q', QUEUE_EVENT_AT)} >= a.created_at))
       and ${qcol('q', QUEUE_OUTCOME)} is not null and ${qcol('q', QUEUE_OUTCOME)} <> 'cancelled'
    union all
    select ${qcol('h', HOLD_EVENT_AT)} from ${HOLDS} h
     where ((h.source = 'application' and h.candidate_ref = a.id::text)
            or (a.phone_e164 is not null and h.phone_e164 = a.phone_e164
                and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at))
       and h.result_outcome is not null
  ) t
)`;

/** มีนัดจริง — กติกาเดียวกับ list: contact log (086) ชนะ hold (085 คีย์เบอร์) */
export const HAS_APPOINTMENT_SQL = `(
  exists (select 1 from ${CONTACTS} c
           where c.application_id = a.id and c.ok and c.appointment_at is not null)
  or (a.phone_e164 is not null and exists (
       select 1 from ${HOLDS} h
        where h.phone_e164 = a.phone_e164 and h.appointment_at is not null
          and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at))
)`;

/** วันนัดล่าสุดของใบ (contact log ชนะ hold — กติกาเดียวกับ HAS_APPOINTMENT_SQL) */
const APPOINTMENT_AT_SQL = `coalesce(
  (select c.appointment_at from ${CONTACTS} c
    where c.application_id = a.id and c.ok and c.appointment_at is not null
    order by c.created_at desc limit 1),
  (select h.appointment_at from ${HOLDS} h
    where a.phone_e164 is not null and h.phone_e164 = a.phone_e164
      and h.appointment_at is not null and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at
    order by ${qcol('h', HOLD_EVENT_AT)} desc limit 1)
)`;

/**
 * "เลยนัดแล้วยังไม่บันทึกผล" แบบ **expression บน alias `a`** (Phase 7.6)
 *
 * 🔴 เดิมเลขนี้คิดใน CTE ของ `buildAttendanceSummarySql` เท่านั้น จึงเป็นเลขที่
 * **กดดูรายชื่อไม่ได้** (ไม่มี fragment ให้ `?bucket=` ใช้) · ย้ายมาเป็น expression
 * เพื่อให้ตัวนับกับ drill-down ใช้เงื่อนไขเดียวกัน (เทสต์ bucket-parity ครอบให้เอง)
 * ⚠️ `rescheduled` นับเป็น "ยังไม่มีผล" เหมือนเดิม (เลื่อนนัด = ยังไม่รู้ว่ามาหรือไม่มา)
 */
const OVERDUE_NO_RESULT_SQL = `(
  ${APPOINTMENT_AT_SQL} < now()
  and coalesce((
    select r.result from ${ATTENDANCE} r
     where r.application_id = a.id
     order by r.appointment_at desc nulls last, r.created_at desc limit 1
  ), 'rescheduled') = 'rescheduled'
)`;

/**
 * ถังของ drill-down `?bucket=` — เงื่อนไขเดียวกับตัวนับ **ห้ามนิยามซ้ำที่อื่น**
 * (เทสต์ bucket-parity บังคับว่ากล่องกับตารางใช้ fragment ตัวเดียวกัน)
 */
export const OVERVIEW_BUCKETS = {
  /** เบอร์ใช้กับระบบโทรไม่ได้ (087 generated column) */
  bad_phone: `a.phone_e164 is null`,
  /** โทรแล้ว (มีหลักฐาน E1..E4) */
  called: CALLED_SQL,
  /** อยู่ในคิว AI รอผล */
  in_queue: `(not ${CALLED_SQL} and ${IN_QUEUE_SQL})`,
  /** มีคนถือ/เก็บอยู่ (ยังไม่โทร ไม่อยู่ในคิว) */
  held: `(not ${CALLED_SQL} and not ${IN_QUEUE_SQL} and ${HELD_OR_CLAIMED_SQL})`,
  /** ยังไม่ถูกแตะเลย */
  untouched: `(not ${CALLED_SQL} and not ${IN_QUEUE_SQL} and not ${HELD_OR_CLAIMED_SQL})`,
  /** ติดต่อสำเร็จ (ผลล่าสุด = คุยถึงตัว — รวมปฏิเสธ) */
  contact_success: `(${CALLED_SQL} and ${LATEST_CLASS_SQL} = 'success')`,
  /** ติดต่อไม่สำเร็จ (ผลล่าสุด = ไม่ถึงตัว) */
  contact_failed: `(${CALLED_SQL} and coalesce(${LATEST_CLASS_SQL}, 'failed') = 'failed')`,
  /** สำเร็จ + นัดได้ */
  scheduled: `(${CALLED_SQL} and ${LATEST_CLASS_SQL} = 'success' and ${HAS_APPOINTMENT_SQL})`,
  /** สำเร็จ แต่ยังนัดไม่ได้ */
  success_unscheduled: `(${CALLED_SQL} and ${LATEST_CLASS_SQL} = 'success' and not ${HAS_APPOINTMENT_SQL})`,
  /** ยังไม่ถูกโทรและกรอกมาเกิน 5 วัน (เจ้าของถามเลขนี้ตรง ๆ · ประชากรทุกช่วงเวลา) */
  over5d: `(not ${CALLED_SQL} and a.created_at < now() - interval '5 days')`,
  /**
   * เก็บไปแล้ว (claim) ไม่มีความคืบหน้าหลังเวลาเก็บ เกิน 1 วัน
   *
   * ⚠️ นิยามนี้คือเงื่อนไขเดียวกับที่ worker กันชื่อดอง (callChoiceWorker · Phase 5.7)
   * ใช้ **ถอด claim อัตโนมัติ** — แก้เงื่อนไขที่นี่ = แก้ว่าใครโดนถอด ห้ามนิยามซ้ำที่อื่น
   * "ความคืบหน้า" = dial stamp (095 · เจ้าของเคาะ "เกิน 1 วันไม่ stamp → ถอด")
   * หรือบันทึกผลติดต่อ หรือผลโทรบน hold — อย่างใดอย่างหนึ่งหลังเวลาเก็บ
   */
  claimed_idle: `(
    a.claimed_by is not null and a.claimed_at < now() - interval '1 day'
    and (a.dialed_last_at is null or a.dialed_last_at < a.claimed_at)
    and not exists (select 1 from ${CONTACTS} c
                     where c.application_id = a.id and c.created_at >= a.claimed_at)
    and not (a.phone_e164 is not null and exists (
          select 1 from ${HOLDS} h
           where h.phone_e164 = a.phone_e164 and h.result_outcome is not null
             and ${qcol('h', HOLD_EVENT_AT)} >= a.claimed_at))
  )`,
  /**
   * เลยวันนัดแล้วยังไม่บันทึกผล มา/ไม่มา (Phase 7.6) — กดดูรายชื่อได้
   * ⚠️ ตาราง 089 ยังไม่ migrate → subquery คืน null → coalesce เป็น 'rescheduled'
   *    ⇒ นับเป็น "ยังไม่มีผล" (ถูกต้อง: ยังไม่มีที่เก็บผล = ยังไม่มีผล)
   */
  overdue_no_result: OVERDUE_NO_RESULT_SQL,
  /**
   * กอง "เลือกวิธีโทร" (Phase 5.9) — ใบที่ worker ถอด claim แล้ว ยังไม่มีใครเลือกว่า
   * จะโทรเองหรือส่ง AI · `claimed_by is null` กันแถวที่มีคนกดเก็บใหม่ระหว่างรอ
   * (การเก็บใหม่ = เลือกโทรเองโดยพฤตินัย — patchClaim/patchKeep ล้าง unclaimed_at ให้)
   */
  awaiting_call_choice: `(
    a.unclaimed_at is not null and a.call_choice is null and a.claimed_by is null
  )`,
} as const;

export type OverviewBucket = keyof typeof OVERVIEW_BUCKETS;

export function isOverviewBucket(v: unknown): v is OverviewBucket {
  return typeof v === 'string' && v in OVERVIEW_BUCKETS;
}

/** เงื่อนไข WHERE ของถัง (อ้าง alias a) — ให้ลิสต์ `?bucket=` ใช้ตัวเดียวกับตัวนับ */
export function bucketCondition(bucket: OverviewBucket): string {
  return OVERVIEW_BUCKETS[bucket];
}

/**
 * คิวรีสรุปทั้งแผง — นับทุกถังใน pass เดียวจาก CTE `facts`
 * param: $1 = scoped job ids (text[] หรือ null = เห็นทุกแผนก) · $2 = department code (null ได้)
 */
export function buildOverviewSql(): string {
  return `
  with a0 as (
    select a.* from ${APPS} a
    where ($1::text[] is null or a.job_id = any($1::text[])
           or ($2::text is not null and a.department_code = $2::text))
  ),
  facts as (
    select a.id, a.phone, a.phone_e164, a.created_at, a.is_lead,
           a.claimed_by, a.claimed_by_name, a.claimed_at,
           ${CALLED_SQL.replace(/\ba\./g, 'a.')} as called,
           ${IN_QUEUE_SQL} as in_queue,
           ${HELD_OR_CLAIMED_SQL} as held_or_claimed,
           ${LATEST_CLASS_SQL} as latest_class,
           ${HAS_APPOINTMENT_SQL} as has_appointment,
           ${FIRST_CALLED_AT_SQL} as first_called_at,
           (${CALLED_VIA_APP_QUEUE} or ${CALLED_VIA_HOLD_APP} or ${CALLED_VIA_CONTACT_LOG}) as called_directly
    from a0 a
  )
  select
    count(*)::int                                                as total,
    count(distinct coalesce(phone_e164, phone))::int             as distinct_phones,
    count(*) filter (where is_lead)::int                         as leads,
    count(*) filter (where phone_e164 is null)::int              as invalid_phone,
    count(*) filter (where called)::int                          as called,
    count(*) filter (where called and not called_directly)::int  as called_via_other,
    count(*) filter (where not called and in_queue)::int         as in_queue_awaiting,
    count(*) filter (where not called and not in_queue and held_or_claimed)::int as held_or_claimed,
    count(*) filter (where not called and not in_queue and not held_or_claimed)::int as untouched,
    count(*) filter (where called and latest_class = 'success')::int as contact_success,
    count(*) filter (where called and coalesce(latest_class,'failed') = 'failed')::int as contact_failed,
    count(*) filter (where called and latest_class = 'success' and has_appointment)::int as scheduled,
    count(*) filter (where called and latest_class = 'success' and not has_appointment)::int as success_unscheduled,
    count(*) filter (where not called and created_at < now() - interval '5 days')::int as over5d_uncalled,
    count(*) filter (where not called and created_at >= now() - interval '3 days')::int  as uncalled_age_0_3,
    count(*) filter (where not called and created_at <  now() - interval '3 days'
                       and created_at >= now() - interval '7 days')::int as uncalled_age_4_7,
    count(*) filter (where not called and created_at < now() - interval '7 days')::int as uncalled_age_over7,
    percentile_cont(0.5) within group (order by extract(epoch from (first_called_at - created_at)) / 3600.0)
      filter (where first_called_at is not null)                 as wait_median_hours,
    percentile_cont(0.9) within group (order by extract(epoch from (first_called_at - created_at)) / 3600.0)
      filter (where first_called_at is not null)                 as wait_p90_hours,
    count(*) filter (where first_called_at is not null)::int     as wait_sample
  from facts`;
}

/** breakdown "ใครเก็บแล้วยังไม่โทร" รายคน (เจ้าของเคาะ: โชว์บน dashboard ให้ทุกคนเห็น) */
export function buildClaimedIdleSql(): string {
  return `
  select a.claimed_by_name as name,
         count(*)::int as n,
         min(a.claimed_at) as oldest_claimed_at
  from ${APPS} a
  where ($1::text[] is null or a.job_id = any($1::text[])
         or ($2::text is not null and a.department_code = $2::text))
    and ${OVERVIEW_BUCKETS.claimed_idle}
  group by a.claimed_by_name
  order by n desc, oldest_claimed_at asc
  limit 50`;
}

/** สรุปกอง "เลือกวิธีโทร" (Phase 5.9) — นับแยกเพราะคอลัมน์ 104 อาจยังไม่ migrate */
export function buildAwaitingChoiceSql(): string {
  return `
  select count(*)::int as n,
         min(a.unclaimed_at) as oldest_unclaimed_at
  from ${APPS} a
  where ($1::text[] is null or a.job_id = any($1::text[])
         or ($2::text is not null and a.department_code = $2::text))
    and ${OVERVIEW_BUCKETS.awaiting_call_choice}`;
}

/** ผลติดตามนัด (089) — นับแยกเพราะตารางอาจยังไม่ migrate (คืน null + ธง ไม่ใช่ 0) */
export function buildAttendanceSummarySql(): string {
  return `
  with sched as (
    select a.id,
           coalesce(
             (select c.appointment_at from ${CONTACTS} c
               where c.application_id = a.id and c.ok and c.appointment_at is not null
               order by c.created_at desc limit 1),
             (select h.appointment_at from ${HOLDS} h
               where h.phone_e164 = a.phone_e164 and h.appointment_at is not null
                 and ${qcol('h', HOLD_EVENT_AT)} >= a.created_at
               order by ${qcol('h', HOLD_EVENT_AT)} desc limit 1)
           ) as appointment_at
    from ${APPS} a
    where ($1::text[] is null or a.job_id = any($1::text[])
           or ($2::text is not null and a.department_code = $2::text))
      and ${HAS_APPOINTMENT_SQL}
  ),
  latest as (
    select distinct on (r.application_id) r.application_id, r.result
    from ${ATTENDANCE} r
    order by r.application_id, r.appointment_at desc, r.created_at desc
  )
  select
    count(*) filter (where l.result = 'showed')::int  as showed,
    count(*) filter (where l.result = 'no_show')::int as no_show,
    count(*) filter (where s.appointment_at < now()
                       and (l.result is null or l.result = 'rescheduled'))::int as overdue_no_result,
    count(*) filter (where s.appointment_at >= now()
                       and (l.result is null or l.result = 'rescheduled'))::int as upcoming
  from sched s left join latest l on l.application_id = s.id`;
}
