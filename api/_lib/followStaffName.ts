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

export async function staffNameOfPhone(phone: string | null): Promise<string | null> {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 9) return null;
  try {
    const { rows } = await dbQuery<{ name: string }>(
      `select name from ${staffTable}
        where right(regexp_replace(phone, '\\D', '', 'g'), 9) = $1
        order by created_at desc limit 1`,
      [digits.slice(-9)],
    );
    return rows[0]?.name?.trim() || null;
  } catch {
    // ตารางยังไม่ migrate / ค้นไม่ได้ = ไม่มีชื่อ — ห้ามทำให้สร้างรายการล้ม
    return null;
  }
}
