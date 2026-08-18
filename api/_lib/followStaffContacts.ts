/**
 * สมุดรายชื่อ+เบอร์เจ้าหน้าที่ผู้ติดตาม (migration 099 · เจ้าของสั่ง 18 ส.ค. 2569 ค่ำ)
 *
 * เบอร์ในนี้คือ "เบอร์ที่ AI บอกให้ผู้สมัครโทรกลับ" — ไม่ใช่เบอร์ที่ระบบโทรออก
 * จึงใช้กติกาเดียวกับ `staff_phone` ของ parseFollowInput: ไม่บังคับ E.164
 * (เบอร์บ้าน/เบอร์ต่อภายในใช้ได้) แต่ต้องมีตัวเลขอย่างน้อย 8 ตัวให้โทรกลับได้จริง
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const contactsTable = tableInAppSchema('follow_staff_contacts');

export type FollowStaffContact = {
  id: string;
  name: string;
  phone: string;
  created_by_name: string | null;
  created_at: string;
};

export type ParsedStaffContact = { name: string; phone: string };

/** ตรวจ body ของ POST — pure เพื่อคุมด้วย unit test (กติกาเลข ≥8 ตัวเดียวกับ staff_phone) */
export function parseStaffContactInput(
  raw: unknown,
): { error: string | null; value: ParsedStaffContact | null } {
  const fail = (message: string) => ({ error: message, value: null });
  if (typeof raw !== 'object' || raw === null) return fail('Invalid JSON body');
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  if (!name) return fail('กรุณากรอกชื่อเจ้าหน้าที่');
  if ((phone.match(/\d/g) ?? []).length < 8) {
    return fail('เบอร์เจ้าหน้าที่ไม่ถูกต้อง — ใส่เบอร์ที่ผู้สมัครโทรกลับได้จริง');
  }
  return { error: null, value: { name, phone } };
}

/** รายชื่อทั้งหมด เรียงตามชื่อ — ตารางเล็ก (หลักสิบ) ไม่ต้องแบ่งหน้า */
export async function listStaffContacts(): Promise<FollowStaffContact[]> {
  const { rows } = await dbQuery<FollowStaffContact>(
    `select id, name, phone, created_by_name, created_at
       from ${contactsTable}
      order by name asc, created_at asc`,
  );
  return rows;
}

/** 23505 unique_violation — ชื่อ+เบอร์คู่นี้มีอยู่แล้ว */
export function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505';
}

export async function createStaffContact(
  input: ParsedStaffContact,
  by: { sub: string; email: string | null },
): Promise<FollowStaffContact> {
  const { rows } = await dbQuery<FollowStaffContact>(
    `insert into ${contactsTable} (name, phone, created_by, created_by_name)
     values ($1, $2, $3, $4)
     returning id, name, phone, created_by_name, created_at`,
    [input.name, input.phone, by.sub, by.email],
  );
  return rows[0];
}
