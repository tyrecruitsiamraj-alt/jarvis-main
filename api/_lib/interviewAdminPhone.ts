/**
 * เบอร์เจ้าหน้าที่ (`admin_phone`) ที่ส่งไปกับคิวสัมภาษณ์ให้ Lumos — AI โทรกลับเบอร์นี้
 * เมื่อโทรหาผู้สมัครไม่สำเร็จ (เจ้าของสั่ง 26 ส.ค. 2569)
 *
 * ลำดับการหา:
 *   1. ผู้รับผิดชอบใบขอ (เจ้าหน้าที่สรรหา → คัดสรร จาก siamraj_unit_assignments)
 *      ที่มีเบอร์บันทึกไว้ใน users.phone — จับคู่ด้วยชื่อ (เหมือนแพตเทิร์นเดิมของ
 *      job_staff_roster ↔ jobs.recruiter_name/screener_name)
 *   2. หาผู้รับผิดชอบไม่ได้ (ไม่มี assignment / ชื่อไม่ตรงกับ user คนไหน / ไม่มีเบอร์)
 *      → สุ่มเบอร์จาก user ที่ role = 'supervisor' และมีเบอร์
 *   3. ไม่มีใครมีเบอร์เลย → null (ไม่ส่ง admin_phone ไป ดีกว่าส่งเบอร์ผิด)
 *
 * ⚠️ ช่วงทดสอบ: ตั้ง LUMOS_ADMIN_PHONE_OVERRIDE ใน .env จะ **ข้ามลอจิกทั้งหมดด้านบน**
 * คืนเบอร์นั้นเสมอ — ลบ/เว้นว่าง env ตัวนี้ตอนขึ้น production เพื่อกลับไปหาเบอร์จริง
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { toE164Thai } from './thaiPhone.js';

const usersTable = tableInAppSchema('users');
const assignmentsTable = tableInAppSchema('siamraj_unit_assignments');

function testOverridePhone(): string | null {
  const raw = (process.env.LUMOS_ADMIN_PHONE_OVERRIDE || '').trim();
  if (!raw) return null;
  return toE164Thai(raw) || raw;
}

async function activeUserPhoneByFullName(name: string | null): Promise<string | null> {
  const n = (name || '').trim();
  if (!n) return null;
  const { rows } = await dbQuery<{ phone: string | null }>(
    `select phone from ${usersTable}
     where is_active = true and phone is not null and trim(phone) <> ''
       and lower(trim(full_name)) = lower($1)
     limit 1`,
    [n],
  );
  const phone = rows[0]?.phone || null;
  return phone ? toE164Thai(phone) : null;
}

async function randomSupervisorPhone(): Promise<string | null> {
  const { rows } = await dbQuery<{ phone: string | null }>(
    `select phone from ${usersTable}
     where role = 'supervisor' and is_active = true and phone is not null and trim(phone) <> ''
     order by random()
     limit 1`,
  );
  const phone = rows[0]?.phone || null;
  return phone ? toE164Thai(phone) : null;
}

/** ผู้รับผิดชอบของใบขอ (สรรหา → คัดสรร) ตาม request_no — ใช้ตรงตามที่หน้า "ผู้รับผิดชอบ" เก็บ */
async function assignedResponsiblePhone(requestNo: string): Promise<string | null> {
  const { rows } = await dbQuery<{ recruiter_name: string | null; screener_name: string | null }>(
    `select recruiter_name, screener_name from ${assignmentsTable} where request_no = $1 limit 1`,
    [requestNo],
  );
  const a = rows[0];
  if (!a) return null;
  return (await activeUserPhoneByFullName(a.recruiter_name)) || (await activeUserPhoneByFullName(a.screener_name));
}

/** เบอร์เจ้าหน้าที่สำหรับ `admin_phone` ของคิวสัมภาษณ์ — ดูคอมเมนต์หัวไฟล์ */
export async function resolveInterviewAdminPhone(requestNo: string | null): Promise<string | null> {
  const override = testOverridePhone();
  if (override) return override;

  const key = (requestNo || '').trim();
  const assigned = key ? await assignedResponsiblePhone(key) : null;
  return assigned || randomSupervisorPhone();
}
