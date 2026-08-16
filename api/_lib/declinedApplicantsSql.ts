/**
 * กอง "คนที่เคยตอบไม่สนใจ" ของเลนคัดสรร (เจ้าของสั่ง 16 ส.ค. 2569:
 * *"มีใบขอมาก็ยังไปเข้าคิวหาคนที่มีเหมือนเดิม แต่ไปหาจากกล่องคนที่ไม่สนใจงานนะ"*)
 *
 * คนกลุ่มนี้ **สมัครกับเราแล้ว** (มีใบสมัครจริง) แค่ปฏิเสธงานที่เคยเสนอไป
 * จึงยังเป็นงานของ**เลนคัดสรร** ไม่ใช่สรรหา — เขาไม่ต้องกรอกใบสมัครใหม่
 * งานคนละที่ คนละค่าแรง คนละเวลา เขาอาจตอบต่างออกไป
 *
 * นิยาม "ไม่สนใจ" = ผลโทรล่าสุด `declined` (ชุดเดียวกับ `isClosedByCallOutcome`
 * ที่หน้า RM ใช้แบ่งแท็บ "คนที่ไม่สนใจ") · ผลมาได้ทั้งจาก AI และจากคนโทรเอง
 *
 * 🔴 **ห้ามเอาคนที่ปฏิเสธ "ใบขอใบนี้" มาเสนอใบเดิมซ้ำ** — เขาตอบไปแล้วว่าไม่เอา
 * งานนี้ · ตัดที่คิวรีด้วย `$1` (jobId) ไม่ใช่ไปหวังพึ่ง cooldown 30 วัน
 * ซึ่งจะปล่อยผ่านทันทีที่พ้นเดือน แล้วโทรถามงานเดิมซ้ำหน้าตาเฉย
 *
 * ⚠️ คนที่บอกว่า "ไม่หางานแล้ว" / เบอร์เสีย ถูกกันที่รายการพักเบอร์ตอนเข้าคิว
 * (คอขวดเดียวใน insertQueueItems) — ที่นี่ไม่ต้องกันซ้ำ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const APPS = tableInAppSchema('public_job_applications');
const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');

export type DeclinedApplicantRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  phone_e164: string | null;
  position_interest: string | null;
  job_title: string | null;
  province: string | null;
  district: string | null;
  gender: string | null;
  age: number | null;
  license_types: string[] | null;
  created_at: string | null;
  /** ใบขอที่เขาเคยปฏิเสธ — ไว้โชว์ว่าเคยถูกเสนออะไรไปแล้ว */
  declined_job_id: string | null;
};

/**
 * ผลโทรล่าสุดต่อเบอร์ รวมสองทาง (คิว AI + ถังที่คนรับไปโทร) แล้วเอาอันใหม่สุด
 * — ต้องรวมทั้งสองทาง ไม่งั้นคนที่เจ้าหน้าที่โทรเองแล้วเขาปฏิเสธจะไม่เข้ากองนี้เลย
 */
const LATEST_OUTCOME_CTE = `
  events as (
    select coalesce(q.payload->>'recipient_phone', q.payload->>'phone') as phone,
           coalesce(q.last_outcome, q.result->>'outcome') as outcome,
           coalesce(q.first_result_at, q.updated_at) as at,
           q.job_ref as job_id
      from ${QUEUE} q
     where coalesce(q.last_outcome, q.result->>'outcome') is not null
    union all
    select h.phone_e164 as phone, h.result_outcome as outcome,
           coalesce(h.result_at, h.updated_at) as at, h.job_id
      from ${HOLDS} h
     where h.result_outcome is not null
  ),
  latest as (
    select distinct on (phone) phone, outcome, at, job_id
      from events
     where phone is not null
     order by phone, at desc nulls last
  )`;

/**
 * SQL ของกองคนที่ปฏิเสธงานอื่น — pure (เทสต์อ่านโครง)
 * param: $1 = jobId ที่กำลังหาคนให้ · $2 = limit
 */
export function buildDeclinedApplicantsSql(): string {
  return `
    with ${LATEST_OUTCOME_CTE}
    select a.id::text as id, a.full_name, a.phone, a.phone_e164,
           a.position_interest, a.job_title, a.province, a.district,
           a.gender, a.age, a.license_types, a.created_at,
           l.job_id as declined_job_id
      from ${APPS} a
      join latest l on l.phone = a.phone_e164
     where a.phone_e164 is not null
       and l.outcome = 'declined'
       and coalesce(l.job_id, '') <> $1
       and coalesce(a.status, 'new') <> 'converted'
     order by l.at desc
     limit $2`;
}

export const DECLINED_POOL_MAX = 600;

/**
 * โหลดกองคนที่เคยปฏิเสธงานอื่น · ตาราง/คอลัมน์ยังไม่ migrate = คืน [] ไม่ throw
 * (กองเสริม — ขาดไปต้องไม่ทำให้เส้นคัดสรรทั้งเส้นพัง)
 */
export async function listDeclinedApplicantsForJob(
  jobId: string,
  limit = DECLINED_POOL_MAX,
): Promise<DeclinedApplicantRow[]> {
  const id = (jobId || '').trim();
  if (!id) return [];
  const capped = Math.min(Math.max(Math.floor(limit) || 1, 1), DECLINED_POOL_MAX);
  try {
    const { rows } = await dbQuery<DeclinedApplicantRow>(buildDeclinedApplicantsSql(), [id, capped]);
    return rows;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return [];
    throw e;
  }
}
