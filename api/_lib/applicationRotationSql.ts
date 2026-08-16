/**
 * "หาคนเพิ่มส่ง AI ทันที" — กติกากันโทรซ้ำ (เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * ตัดคนที่ **ถูกติดต่อเรื่องงานนั้นภายใน N วัน** (default 30) — นับจากเหตุการณ์ล่าสุด
 * เรื่องงานนั้น 3 แหล่ง (job-scoped ไม่ใช่ per-person เหมือน CALLED_SQL ของ overview):
 *   1. คิว Lumos: job_ref = งานนั้น + เบอร์ตรง + มีผล (ไม่ cancelled)
 *   2. hold: job_id = งานนั้น + result_outcome ไม่ null
 *   3. contact log: log ของใบสมัครที่ job_id = งานนั้น + เบอร์เดียวกัน
 * เวลาใช้ first_result_at/result_at (088 เขียนครั้งเดียว) — ห้าม updated_at/created_at เดี่ยว
 * (เหตุผลเดียวกับ applicantOverviewSql: updated_at ขยับทุกครั้งที่แตะแถว)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

export const ROTATION_COOLDOWN_DAYS = 30;

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const HOLDS = tableInAppSchema('candidate_call_holds');
const CONTACTS = tableInAppSchema('application_contact_logs');
const APPS = tableInAppSchema('public_job_applications');

const QUEUE_PHONE = `coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`;
const QUEUE_OUTCOME = `coalesce(q.last_outcome, q.result->>'outcome')`;
const QUEUE_EVENT_AT = `coalesce(q.first_result_at, q.updated_at)`;
const HOLD_EVENT_AT = `coalesce(h.result_at, h.updated_at, h.released_at, h.held_at)`;

/**
 * SQL คืนเบอร์ (E.164) ที่ถูกติดต่อเรื่อง job นี้ตั้งแต่ $cutoff — pure (เทสต์อ่านโครง)
 * param: $1 = jobId · $2 = phones text[] · $3 = cutoff timestamptz
 */
export function buildContactedAboutJobSql(): string {
  return `
    select distinct ${QUEUE_PHONE} as phone
      from ${QUEUE} q
     where q.job_ref = $1
       and ${QUEUE_PHONE} = any($2::text[])
       and ${QUEUE_OUTCOME} is not null and ${QUEUE_OUTCOME} <> 'cancelled'
       and ${QUEUE_EVENT_AT} >= $3::timestamptz
    union
    select distinct h.phone_e164 as phone
      from ${HOLDS} h
     where h.job_id = $1
       and h.phone_e164 = any($2::text[])
       and h.result_outcome is not null
       and ${HOLD_EVENT_AT} >= $3::timestamptz
    union
    select distinct a.phone_e164 as phone
      from ${CONTACTS} c
      join ${APPS} a on a.id = c.application_id
     where c.job_id = $1
       and a.phone_e164 = any($2::text[])
       and c.created_at >= $3::timestamptz`;
}

/**
 * SQL คืนเบอร์ที่ถูกติดต่อ **เรื่องงานไหนก็ได้** ตั้งแต่ $cutoff (R2b เลนสรรหา)
 * param: $1 = phones text[] · $2 = cutoff timestamptz
 *
 * ใช้กับกอง "ใบสนใจ" ของฐานใหม่เท่านั้น (เจ้าของ: *ใบสนใจที่ว่าง / ไม่สนใจงานอื่น
 * เว้น 30 วัน*) — คนกลุ่มนี้แค่ทิ้งเบอร์ไว้ว่าสนใจ ยังไม่ได้สมัครงานใบไหน
 * ถ้าใช้ cooldown ต่องานแบบเลนคัดสรร คนคนเดียวจะโดนโทรวันเดียวกันจากหลายใบขอ
 */
export function buildContactedAnyJobSql(): string {
  return `
    select distinct ${QUEUE_PHONE} as phone
      from ${QUEUE} q
     where ${QUEUE_PHONE} = any($1::text[])
       and ${QUEUE_OUTCOME} is not null and ${QUEUE_OUTCOME} <> 'cancelled'
       and ${QUEUE_EVENT_AT} >= $2::timestamptz
    union
    select distinct h.phone_e164 as phone
      from ${HOLDS} h
     where h.phone_e164 = any($1::text[])
       and h.result_outcome is not null
       and ${HOLD_EVENT_AT} >= $2::timestamptz
    union
    select distinct a.phone_e164 as phone
      from ${CONTACTS} c
      join ${APPS} a on a.id = c.application_id
     where a.phone_e164 = any($1::text[])
       and c.created_at >= $2::timestamptz`;
}

/**
 * เบอร์ที่ต้องข้ามเพราะเพิ่งถูกติดต่อ **เรื่องงานไหนก็ได้** (Set E.164)
 * ตารางยังไม่ migrate (42P01/42703) → คืน Set ว่าง (ไม่บล็อกการส่งทั้งก้อน)
 */
export async function phonesContactedAnyJob(
  phones: string[],
  days = ROTATION_COOLDOWN_DAYS,
  now: Date = new Date(),
): Promise<Set<string>> {
  const uniq = [...new Set(phones.filter(Boolean))];
  if (uniq.length === 0) return new Set();
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  try {
    const { rows } = await dbQuery<{ phone: string | null }>(buildContactedAnyJobSql(), [
      uniq,
      cutoff,
    ]);
    const out = new Set<string>();
    for (const r of rows) if (r.phone) out.add(r.phone);
    return out;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return new Set();
    throw e;
  }
}

/**
 * SQL คืนเบอร์ที่ **เคยปฏิเสธงานนี้** — ถาวร ไม่มีหน้าต่างเวลา (เจ้าของสั่ง 16 ส.ค. 2569:
 * *"จะไม่เอาคนที่ลงงานแล้วและเคยปฏิเสธงานนั้นๆ มา match แล้วส่งให้ Lumos โทร"*)
 * param: $1 = jobId · $2 = phones text[]
 *
 * ⚠️ ต่างจาก cooldown 30 วันข้างบนสองอย่าง: (1) **ไม่มี cutoff** — ปฏิเสธเมื่อไหร่ก็ตาม
 * = ไม่เสนอใบนั้นอีกตลอด (2) นับเฉพาะ outcome `declined` เท่านั้น ไม่ใช่ทุกการติดต่อ
 * · แหล่งผลมี 2 ทาง (คิว AI + ถังที่คนรับไปโทร) — contact log ไม่มีคอลัมน์ outcome ตรง
 * จึงไม่นับ (ผลจากคนถูกเขียนลง holds อยู่แล้ว)
 */
export function buildDeclinedThisJobSql(): string {
  return `
    select distinct ${QUEUE_PHONE} as phone
      from ${QUEUE} q
     where q.job_ref = $1
       and ${QUEUE_PHONE} = any($2::text[])
       and ${QUEUE_OUTCOME} = 'declined'
    union
    select distinct h.phone_e164 as phone
      from ${HOLDS} h
     where h.job_id = $1
       and h.phone_e164 = any($2::text[])
       and h.result_outcome = 'declined'`;
}

/**
 * เบอร์ที่เคยปฏิเสธงานนี้ (Set E.164) — ใช้กันเสนอซ้ำถาวรที่คอขวดเข้าคิว
 * ตารางยังไม่ migrate (42P01/42703) → Set ว่าง · error อื่นโยนต่อ (ผู้เรียกตัดสินใจ)
 */
export async function phonesDeclinedThisJob(
  jobId: string,
  phones: string[],
): Promise<Set<string>> {
  const uniq = [...new Set(phones.filter(Boolean))];
  if (!jobId.trim() || uniq.length === 0) return new Set();
  try {
    const { rows } = await dbQuery<{ phone: string | null }>(buildDeclinedThisJobSql(), [
      jobId,
      uniq,
    ]);
    const out = new Set<string>();
    for (const r of rows) if (r.phone) out.add(r.phone);
    return out;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return new Set();
    throw e;
  }
}

/**
 * เบอร์ที่ต้องข้ามเพราะเพิ่งติดต่อเรื่องงานนี้ (Set E.164) · phones ว่าง = Set ว่าง
 * days = หน้าต่าง cooldown (default 30) · now ฉีดได้เพื่อเทสต์
 */
export async function phonesContactedAboutJob(
  jobId: string,
  phones: string[],
  days = ROTATION_COOLDOWN_DAYS,
  now: Date = new Date(),
): Promise<Set<string>> {
  const uniq = [...new Set(phones.filter(Boolean))];
  if (!jobId.trim() || uniq.length === 0) return new Set();
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  const { rows } = await dbQuery<{ phone: string | null }>(buildContactedAboutJobSql(), [
    jobId,
    uniq,
    cutoff,
  ]);
  const out = new Set<string>();
  for (const r of rows) if (r.phone) out.add(r.phone);
  return out;
}
