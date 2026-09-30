/**
 * ═══ ร่องรอยการใช้งานของเจ้าหน้าที่ — ตัวเดียวของหน้าทีม Online กับหน้าหลัก (ย้ายมาจาก team-online 30 ก.ย. 2569) ═══
 *
 * ระบบไม่มีบันทึก "เปิดดู" ⇒ นับจาก **เข้าระบบ** (`audit_logs` ชุด `AUTH_SESSION_AUDIT_ACTIONS`)
 * + **งานที่บันทึก** (ใครทำ · เมื่อไหร่) ในตารางข้างล่าง
 * - หน้าทีม Online: คนใช้งานต่อวัน · Online ล่าสุด
 * - หน้าหลัก: ใคร Online ตอนนี้ (ใช้งานใน 30 นาทีล่าสุด — เจ้าของเคาะ 30 ก.ย. 2569) · เข้าระบบล่าสุดวันไหน
 *
 * 🔴 ห้ามใส่คู่ `updated_by`/`updated_at` ของตารางที่ระบบเขียนเองด้วย (เช่น `follow_entries` ที่ผล Lumos
 *    ขยับ `updated_at`) — เวลาจะเป็นของระบบแต่ชื่อเป็นของคนแก้ล่าสุด ⇒ นับคนที่ไม่ได้ใช้งานจริง
 * 🔴 เข้าระบบต้องนับ **ทุกทาง** (Microsoft เป็นทางหลักแล้ว) — ดู `authActions.ts`
 */
import { tableInAppSchema } from './schema.js';
import { AUTH_SESSION_AUDIT_ACTIONS } from './authActions.js';

const USERS = tableInAppSchema('users');
const AUDIT = tableInAppSchema('audit_logs');

const bkkYmd = (col: string) => `to_char(timezone('Asia/Bangkok', ${col}), 'YYYY-MM-DD')`;

/** [ตาราง, คอลัมน์ผู้ใช้, คอลัมน์เวลา] */
export const ACTIVITY_SOURCES: ReadonlyArray<readonly [table: string, user: string, at: string]> = [
  ['audit_logs', 'user_id', 'created_at'],
  ['application_contact_logs', 'created_by', 'created_at'],
  ['application_appointment_results', 'recorded_by', 'created_at'],
  ['candidate_call_holds', 'held_by_user_id', 'held_at'],
  ['candidate_call_holds', 'held_by_user_id', 'result_at'],
  ['candidate_proposals', 'proposed_by_user_id', 'created_at'],
  ['candidate_screening', 'screened_by_user_id', 'updated_at'],
  ['follow_entries', 'created_by', 'created_at'],
  ['follow_entries', 'completed_by', 'completed_at'],
  ['job_posting_requests', 'requested_by_user_id', 'created_at'],
  ['job_public_releases', 'released_by', 'released_at'],
  ['recruit_postings', 'created_by_user_id', 'created_at'],
  ['selection_progress', 'updated_by', 'updated_at'],
  ['short_links', 'created_by', 'created_at'],
  ['siamraj_unit_assignments', 'updated_by_user_id', 'updated_at'],
  ['siamraj_unit_notes', 'updated_by_user_id', 'updated_at'],
  ['siamraj_unit_work_status_history', 'updated_by_user_id', 'created_at'],
  ['public_job_applications', 'claimed_by', 'claimed_at'],
  ['public_job_applications', 'lead_by', 'lead_at'],
  ['lumos_call_batches', 'created_by_user_id', 'created_at'],
];

/**
 * เข้าระบบสำเร็จล่าสุดของแต่ละคน **ทุกช่วงเวลา · ทุกทาง** (รหัสผ่าน · ลิงก์อีเมล · Microsoft)
 * ⚠️ ล็อกเริ่มเก็บ 1 ก.ค. 2569 ⇒ ไม่มีแถว = "ยังไม่เคยเข้าระบบ" นับตั้งแต่วันนั้น
 */
export function lastLoginSql(): string {
  const actions = AUTH_SESSION_AUDIT_ACTIONS.map((a) => `'${a}'`).join(', ');
  return `select user_id::text as uid, max(created_at) as last_at
            from ${AUDIT}
           where action in (${actions}) and user_id is not null
           group by 1`;
}

/**
 * ร่องรอยล่าสุดของแต่ละคนตั้งแต่ `$1` (เข้าระบบ หรือ บันทึกงาน) — หน้าหลักใช้ตัดสินว่าใคร Online ตอนนี้
 * กรองเวลาก่อนรวมทุกตาราง ⇒ อ่านแค่ของสามสิบนาทีล่าสุด ไม่ไล่ทั้งตาราง
 */
export function recentActivitySql(): string {
  const union = ACTIVITY_SOURCES.map(
    ([t, u, at]) =>
      `select ${u} as uid, ${at} as at from ${tableInAppSchema(t)}
        where ${u} is not null and ${at} >= $1::timestamptz`,
  ).join('\n       union all ');
  return `with ev as (
       ${union}
     )
     select ev.uid::text as uid, max(ev.at) as last_at
       from ev
      group by 1`;
}

/** บัญชีทุกบัญชี — แผนก · บทบาท · เปิดใช้อยู่ไหม · วันที่สร้าง · ชื่อที่โชว์ · สายงาน */
export function accountsSql(): string {
  return `select u.id::text as id, coalesce(nullif(btrim(u.department_code), ''), '') as dept, u.role,
                 coalesce(u.is_active, false) as active, ${bkkYmd('u.created_at')} as created_ymd,
                 coalesce(nullif(btrim(u.nickname), ''), nullif(btrim(u.full_name), ''), u.email) as display_name,
                 coalesce(u.job_lanes, '{}'::text[]) as lanes
            from ${USERS} u`;
}
