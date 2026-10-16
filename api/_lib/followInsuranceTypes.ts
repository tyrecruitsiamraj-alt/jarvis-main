/**
 * "ประเภทประกัน" — ตัวเลือก dropdown ขั้น 4 ฟอร์มเพิ่มคนติดตาม (migration 149 · เจ้าของสั่ง 16 ต.ค. 2569)
 * > *"ประเภทประกัน ทำเป็น Dropdown ดังนี้ ขอหน้า Ui ไว้เพิ่มในอนาคตด้วย ณ ตอนนี้เอาแค่นี้"*
 *
 * แพตเทิร์นเดียวกับ `followTopics.ts` — เพิ่มได้ที่ "ตั้งค่าตัวเลือก" ของหน้าติดตาม (supervisor+) · ไม่มีลบ/แก้
 * (ค่าเก็บเป็นข้อความใน `follow_entries.insurance_type` · ลบตัวเลือกไม่ทำให้รายการเก่าหาย)
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';

const typesTable = tableInAppSchema('follow_insurance_types');

export type FollowInsuranceType = {
  id: string;
  name: string;
  sort_order: number;
  created_by_name: string | null;
  created_at: string;
};

/**
 * ชุดตั้งต้นตามที่เจ้าของสั่ง (ตัวเดียวกับ seed ใน 149) — ใช้ตอนฐานยังไม่รัน 149
 * ⚠️ dropdown ต้องขึ้นได้เสมอ: deploy รัน migration หลังโค้ดขึ้นเล็กน้อย ระหว่างนั้นห้ามว่าง
 */
export const DEFAULT_FOLLOW_INSURANCE_TYPES = ['PA', 'PA+PL', 'PA+PL+ทิพยะ', 'PA+ทิพยะ'] as const;

/** ตรวจ body ของ POST — pure เพื่อคุมด้วย unit test */
export function parseInsuranceTypeInput(raw: unknown): { error: string | null; value: { name: string } | null } {
  if (typeof raw !== 'object' || raw === null) return { error: 'Invalid JSON body', value: null };
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim() : '';
  if (!name) return { error: 'กรุณากรอกประเภทประกัน', value: null };
  if (name.length > 80) return { error: 'ประเภทประกันยาวเกินไป (ไม่เกิน 80 ตัวอักษร)', value: null };
  return { error: null, value: { name } };
}

/** 42P01 undefined_table — โค้ดใหม่ขึ้นก่อน migration 149 */
export function isUndefinedTable(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '42P01';
}

/** เรียงตาม sort_order แล้วชื่อ — ชุดตั้งต้นของระบบอยู่บนสุดตามลำดับที่เจ้าของสั่ง */
export async function listFollowInsuranceTypes(): Promise<FollowInsuranceType[]> {
  try {
    const { rows } = await dbQuery<FollowInsuranceType>(
      `select id, name, sort_order, created_by_name, created_at
         from ${typesTable}
        order by sort_order asc, name asc`,
    );
    return rows;
  } catch (e) {
    if (!isUndefinedTable(e)) throw e;
    return DEFAULT_FOLLOW_INSURANCE_TYPES.map((name, i) => ({
      id: `default-${i + 1}`,
      name,
      sort_order: (i + 1) * 10,
      created_by_name: 'ชุดตั้งต้นของระบบ',
      created_at: '2026-10-16T00:00:00.000Z',
    }));
  }
}

export async function createFollowInsuranceType(
  name: string,
  by: { sub: string; email: string | null },
): Promise<FollowInsuranceType> {
  const { rows } = await dbQuery<FollowInsuranceType>(
    `insert into ${typesTable} (name, created_by, created_by_name)
     values ($1, $2, $3)
     returning id, name, sort_order, created_by_name, created_at`,
    [name, by.sub, by.email],
  );
  return rows[0];
}
