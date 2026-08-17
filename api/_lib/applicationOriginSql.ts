/**
 * "คนนี้มาจากไหน" ของใบสมัครในเลนคัดสรร (เจ้าของสั่ง 16 ส.ค. 2569:
 * *"ใบขอเข้ามาก็ยังหาคนให้เอง แต่แยกให้หน่อยว่าอันไหนมาจากการสมัครใหม่
 * อันไหนมาจาก AI หาให้"*)
 *
 * 3 ที่มา:
 *   - `self_apply`  — ผู้สมัครกรอกเข้ามาเอง (ลิงก์ประกาศ/หน้าสาธารณะ)
 *   - `ai_found`    — **AI ไปหามาให้** แล้วโทรก่อน ค่อยได้ใบสมัคร
 *   - `staff_added` — เจ้าหน้าที่คีย์เข้าระบบเอง (คนโทรเข้ามาสมัครทางโทรศัพท์ ฯลฯ)
 *
 * ⚠️ **ห้ามอ่านจากคอลัมน์ `source`** — ค่า default คือ `'apply_page'` ทุกแถว
 * (ทั้งใบที่คนกรอกเองและใบที่เจ้าหน้าที่คี่ย์) วัดจากฐานจริง 16 ส.ค. = แยกไม่ได้เลย
 *
 * ⚠️ **ต้องมี temporal guard** — นับว่า "AI หาให้" เฉพาะเมื่อ AI ถูกส่งไปตามคนนี้
 * **ก่อน** ใบสมัครจะเกิด · ไม่งั้นคนที่กรอกใบสมัครเข้ามาเอง แล้ววันหลัง AI ไปเจอ
 * เบอร์เดียวกันในฐาน iRecruit จะถูกตีตราย้อนหลังว่า "AI หาให้" ทั้งที่เขามาเอง
 * (บทเรียนเดียวกับ applicantOverviewSql — ผลของเบอร์เดิมข้ามใบ)
 *
 * ⚠️ นับเฉพาะคิวที่ person_ref เป็น `ir-`/`card-` = คนที่ **ยังไม่ได้สมัคร** แล้ว AI
 * ไปตามมา · `app-` คือโทรหาคนที่สมัครมาแล้ว (ผลของการสมัคร ไม่ใช่ต้นทาง)
 */
import { tableInAppSchema } from './schema.js';

export const APPLICATION_ORIGINS = ['self_apply', 'ai_found', 'staff_added'] as const;
export type ApplicationOrigin = (typeof APPLICATION_ORIGINS)[number];

const QUEUE = tableInAppSchema('lumos_dispatch_queue');
const QUEUE_PHONE = `coalesce(q.payload->>'recipient_phone', q.payload->>'phone')`;

/**
 * นิพจน์ SQL ของ "ที่มา" — **ไม่มี param** โดยตั้งใจ (ต่อท้าย select list ได้เลย
 * โดยไม่ทำให้จำนวน param ที่ pg นับเพี้ยน — บทเรียน 'bind message supplies N parameters')
 * อ้าง alias `a` = ตารางใบสมัคร ต้องตั้ง alias ที่ FROM เสมอ
 */
export function applicationOriginExpr(alias = 'a'): string {
  return `case
    when exists (
      select 1 from ${QUEUE} q
       where q.job_ref = ${alias}.job_id
         and (q.person_ref like 'ir-%' or q.person_ref like 'card-%')
         and ${QUEUE_PHONE} = ${alias}.phone_e164
         and q.created_at <= ${alias}.created_at
    ) then 'ai_found'
    when ${alias}.created_by_name is not null then 'staff_added'
    else 'self_apply'
  end`;
}

/** คอลัมน์ `origin` สำหรับต่อท้าย select list */
export function applicationOriginColumn(alias = 'a'): string {
  return `${applicationOriginExpr(alias)} as origin`;
}

export function isApplicationOrigin(v: unknown): v is ApplicationOrigin {
  return typeof v === 'string' && (APPLICATION_ORIGINS as readonly string[]).includes(v);
}
