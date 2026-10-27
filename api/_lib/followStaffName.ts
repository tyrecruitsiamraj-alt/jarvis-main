/**
 * ชื่อเจ้าหน้าที่จากเบอร์ — บทติดตามแนะนำตัวด้วยชื่อคนตาม (เจ้าของสั่ง 1 ก.ย. 2569:
 * *"สวัสดีค่ะ ...(ชื่อเจ้าของงาน)... จากสยามราชธานีนะคะ"*)
 *
 * 🔴 **ไม่เพิ่มคอลัมน์ในใบติดตาม** — ฟอร์มเก็บแค่เบอร์ (คนเลือกจาก dropdown ที่มีชื่ออยู่แล้ว)
 * เทียบด้วย **เลข 9 ตัวท้าย** เพราะเบอร์ในสองตารางเขียนคนละรูป (0812345678 / +66812345678)
 * ⚠️ หาไม่เจอ = คืน null แล้วบททักทายโดยไม่เอ่ยชื่อ **ห้ามเดาชื่อ**
 *
 * อยู่ที่ `_lib` เพราะมีสามที่เรียก (handler ติดตาม · ปลดบัญชีห้ามโทร · ตัวส่งซ้ำ)
 * — เคยอยู่ใน `_handlers/follow.ts` แล้วตัวส่งซ้ำต้อง import handler เข้ามาทั้งก้อน
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const staffTable = tableInAppSchema('follow_staff_contacts');
const usersTable = tableInAppSchema('users');

/**
 * 🔴 27 ต.ค. 2569: หน้าผู้ใช้งาน (ชื่อเล่น + เบอร์) มาก่อน · ความจำเดิม (`follow_staff_contacts`) เป็นทางถอย
 * เจ้าของเจอ AI แนะนำตัวว่า "ครีม" กับเบอร์ของอ้อแอ้ — ความจำเดิมมีแถว ครีม = เบอร์อ้อแอ้ (คีย์ผิด 11 ก.ย.)
 * และตัวนี้อ่านแต่ความจำเดิม ไม่เคยดูหน้าผู้ใช้งาน (จอใช้หน้าผู้ใช้งานก่อนอยู่แล้ว — `staffNameForPhone`)
 * เบอร์เดียวมีหลายชื่อเล่นในหน้าผู้ใช้งาน = ไม่เดา ไปดูความจำเดิมแทน
 */
export async function staffNameOfPhone(phone: string | null): Promise<string | null> {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  const last9 = digits.slice(-9);
  try {
    const { rows } = await dbQuery<{ name: string }>(
      `select distinct btrim(nickname) as name from ${usersTable}
        where is_active and coalesce(btrim(nickname), '') <> ''
          and right(regexp_replace(coalesce(phone, ''), '\\D', '', 'g'), 9) = $1`,
      [last9],
    );
    if (rows.length === 1 && rows[0].name) return rows[0].name;
  } catch {
    // อ่านหน้าผู้ใช้งานไม่ได้ = ใช้ความจำเดิมตามเดิม
  }
  try {
    const { rows } = await dbQuery<{ name: string }>(
      `select name from ${staffTable}
        where right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1
        order by created_at desc limit 1`,
      [last9],
    );
    return rows[0]?.name?.trim() || null;
  } catch {
    // ตารางยังไม่ migrate / ค้นไม่ได้ = ไม่มีชื่อ — ห้ามทำให้สร้างรายการล้ม
    return null;
  }
}
