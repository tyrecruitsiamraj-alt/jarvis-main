/**
 * ฐานใหม่ So Recruit — ใบ "สนใจ" (Lead) ที่ยังว่าง (R2b · เจ้าของเคาะ 16 ส.ค. 2569)
 *
 * "ใบสนใจ" = คนกรอกหน้าสาธารณะว่าสนใจงาน — **ยังไม่ใช่ใบสมัคร** (ใบสมัครจริง =
 * ชื่อขึ้นถังบนบอร์ด ERP) จึงเป็นกองของ **เลนสรรหา** เต็มตัว
 *
 * "ว่าง" ที่นี่ = ยังไม่จบเรื่อง:
 *   - ไม่ถูกปิดไปแล้ว (`status <> 'rejected'` · `converted` = ได้ใบสมัครแล้ว ออกจากกอง)
 *   - มีเบอร์ที่แปลง E.164 ได้ (`phone_e164` — generated column 087)
 * ⚠️ **ไม่กรอง `claimed_by`** — คนเก็บไปติดต่อเองยังส่ง AI โทรเสนองานอื่นได้
 * ตัวกันโทรทับอยู่ที่ล็อกเบอร์ใน `insertQueueItems` ที่เดียว (ห้ามกันสองที่ให้ตรรกะแตก)
 *
 * ตัวกรอง "ขึ้นบอร์ดแล้ว" (= ได้ใบสมัครแล้ว → เป็นงานของคัดสรร) ทำใน JS ด้วยเบอร์
 * ที่ผู้เรียก เพราะบอร์ดอยู่คนละฐาน (SQL Server) — เช็คใน SQL pg ไม่ได้
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const APPS = tableInAppSchema('public_job_applications');

export type SoRecruitLeadRow = {
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
};

/** SQL อ่านใบสนใจที่ยังว่าง — pure (เทสต์อ่านโครงได้) · $1 = limit */
export function buildSoRecruitLeadsSql(): string {
  return `
    select a.id::text as id,
           a.full_name,
           a.phone,
           a.phone_e164,
           a.position_interest,
           a.job_title,
           a.province,
           a.district,
           a.gender,
           a.age,
           a.license_types,
           a.created_at
      from ${APPS} a
     where a.phone_e164 is not null
       and coalesce(a.status, 'new') not in ('rejected', 'converted')
     order by a.created_at desc
     limit $1`;
}

export const SO_RECRUIT_LEAD_MAX = 800;

/**
 * ใบสนใจที่ยังว่าง (ล่าสุดก่อน) · ตาราง/คอลัมน์ยังไม่ migrate → คืน [] ไม่ throw
 * (กองนี้เป็นของเสริม — ขาดไปต้องไม่ทำให้ปุ่ม "หาคนเพิ่ม" ทั้งปุ่มพัง)
 */
export async function listSoRecruitLeadsForMatch(limit = SO_RECRUIT_LEAD_MAX): Promise<SoRecruitLeadRow[]> {
  const capped = Math.min(Math.max(Math.floor(limit) || 1, 1), SO_RECRUIT_LEAD_MAX);
  try {
    const { rows } = await dbQuery<SoRecruitLeadRow>(buildSoRecruitLeadsSql(), [capped]);
    return rows;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return [];
    throw e;
  }
}
