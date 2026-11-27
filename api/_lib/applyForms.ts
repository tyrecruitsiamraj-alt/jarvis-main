/**
 * ═══ แบบฟอร์มใบสมัคร — ตัวอ่าน/เขียนฐาน (migration 201 · กติกา `src/lib/applyForms.ts`) ═══
 * ยังไม่รัน 201 = รายการว่าง / ฟอร์มของประกาศเป็นมาตรฐาน — หน้าสมัครกับ Gen link ต้องทำงานต่อได้เสมอ
 */
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import {
  cleanApplyFormFields,
  cleanDepartmentCodes,
  STANDARD_APPLY_FORM_NAME,
  type ApplyForm,
  type ApplyFormField,
} from '../../src/lib/applyForms.js';

const FORMS = tableInAppSchema('apply_forms');
const POSTINGS = tableInAppSchema('recruit_postings');

type Row = {
  id: number;
  name: string;
  department_codes: string[] | null;
  fields: string[] | null;
  is_active: boolean;
  link_count: string | number | null;
};
type Actor = { id: string | null; name: string | null };

function isUndefinedTableOrColumn(e: unknown): boolean {
  const code = typeof e === 'object' && e !== null && 'code' in e ? (e as { code: string }).code : '';
  return code === '42P01' || code === '42703';
}

const mapRow = (r: Row): ApplyForm => ({
  id: Number(r.id),
  name: r.name,
  departmentCodes: cleanDepartmentCodes(r.department_codes ?? []),
  fields: cleanApplyFormFields(r.fields ?? []),
  active: r.is_active === true,
  linkCount: Number(r.link_count) || 0,
});

export async function listApplyForms(): Promise<ApplyForm[]> {
  try {
    const { rows } = await dbQuery<Row>(
      `select f.id, f.name, f.department_codes, f.fields, f.is_active,
              (select count(*) from ${POSTINGS} p where p.apply_form_id = f.id) as link_count
         from ${FORMS} f
        order by f.is_active desc, lower(f.name)`,
    );
    return rows.map(mapRow);
  } catch (e) {
    if (isUndefinedTableOrColumn(e)) return [];
    throw e;
  }
}

async function getApplyForm(id: number): Promise<ApplyForm | null> {
  return (await listApplyForms()).find((f) => f.id === id) ?? null;
}

function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!name) throw new Error('ต้องใส่ชื่อฟอร์ม');
  if (name.toLowerCase() === STANDARD_APPLY_FORM_NAME.toLowerCase()) throw new Error(`ชื่อ "${STANDARD_APPLY_FORM_NAME}" ใช้ไม่ได้ — ซ้ำกับฟอร์มที่มีอยู่แล้ว`);
  return name;
}

function cleanFieldsOrThrow(raw: unknown): ApplyFormField[] {
  const fields = cleanApplyFormFields(raw);
  if (fields.length === 0) throw new Error('ติ๊กช่องเสริมอย่างน้อย 1 ช่อง');
  return fields;
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === '23505';
}

export async function createApplyForm(input: { name: unknown; departmentCodes: unknown; fields: unknown }, actor: Actor): Promise<ApplyForm> {
  const name = cleanName(input.name);
  const fields = cleanFieldsOrThrow(input.fields);
  try {
    const { rows } = await dbQuery<{ id: number }>(
      `insert into ${FORMS} (name, department_codes, fields, created_by, created_by_name, updated_by, updated_by_name)
       values ($1, $2::text[], $3::text[], $4, $5, $4, $5) returning id`,
      [name, cleanDepartmentCodes(input.departmentCodes), fields, actor.id, actor.name],
    );
    return (await getApplyForm(rows[0].id))!;
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error('มีฟอร์มชื่อนี้แล้ว');
    throw e;
  }
}

export async function updateApplyForm(
  id: number,
  patch: { name?: unknown; departmentCodes?: unknown; fields?: unknown; active?: unknown },
  actor: Actor,
): Promise<{ before: ApplyForm; after: ApplyForm } | null> {
  const before = await getApplyForm(id);
  if (!before) return null;
  const name = patch.name === undefined ? before.name : cleanName(patch.name);
  const fields = patch.fields === undefined ? before.fields : cleanFieldsOrThrow(patch.fields);
  const depts = patch.departmentCodes === undefined ? before.departmentCodes : cleanDepartmentCodes(patch.departmentCodes);
  const active = typeof patch.active === 'boolean' ? patch.active : before.active;
  try {
    await dbQuery(
      `update ${FORMS}
          set name = $2, department_codes = $3::text[], fields = $4::text[], is_active = $5,
              updated_by = $6, updated_by_name = $7, updated_at = now()
        where id = $1`,
      [id, name, depts, fields, active, actor.id, actor.name],
    );
  } catch (e) {
    if (isUniqueViolation(e)) throw new Error('มีฟอร์มชื่อนี้แล้ว');
    throw e;
  }
  return { before, after: (await getApplyForm(id))! };
}

/** ลบได้เฉพาะฟอร์มที่ยังไม่มีลิงก์ใช้ — มีแล้ว = 'in_use' (ให้กดเลิกใช้แทน · ลิงก์เดิมยังเปิดได้) */
export async function deleteApplyForm(id: number): Promise<'deleted' | 'in_use' | 'not_found'> {
  const form = await getApplyForm(id);
  if (!form) return 'not_found';
  if (form.linkCount > 0) return 'in_use';
  // ลบแบบมีเงื่อนไขในคำสั่งเดียว — มีคนเพิ่ง Gen link ด้วยฟอร์มนี้ระหว่างนั้น = ไม่ลบ
  const { rows } = await dbQuery<{ id: number }>(
    `delete from ${FORMS} f where f.id = $1
        and not exists (select 1 from ${POSTINGS} p where p.apply_form_id = f.id)
      returning f.id`,
    [id],
  );
  return rows.length > 0 ? 'deleted' : 'in_use';
}

/**
 * ฟอร์มที่ใช้ตอน Gen link ได้จริง — เปิดใช้อยู่ + BU ตรง · ไม่ผ่าน = null (ฟอร์มมาตรฐาน)
 * ไม่เชื่อค่าที่หน้าเว็บส่งมา (ยิงตรงได้)
 */
export async function resolveApplyFormForBu(rawId: unknown, bu: string | null | undefined): Promise<number | null> {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const form = await getApplyForm(id);
  if (!form || !form.active) return null;
  const code = (bu ?? '').trim().toUpperCase();
  if (form.departmentCodes.length > 0 && !form.departmentCodes.includes(code)) return null;
  return id;
}

/** ช่องเสริมของประกาศ — ฟอร์มที่เลิกใช้แล้วลิงก์เดิมยังใช้ช่องเดิม · ไม่มี/อ่านไม่ได้ = [] (ฟอร์มมาตรฐาน) */
export async function applyFieldsOfPosting(postingId: string | null | undefined): Promise<ApplyFormField[]> {
  if (!postingId) return [];
  try {
    const { rows } = await dbQuery<{ fields: string[] | null }>(
      `select f.fields from ${POSTINGS} p join ${FORMS} f on f.id = p.apply_form_id where p.id::text = $1 limit 1`,
      [postingId],
    );
    return cleanApplyFormFields(rows[0]?.fields ?? []);
  } catch (e) {
    if (isUndefinedTableOrColumn(e)) return [];
    throw e;
  }
}

/** ตั้งฟอร์มให้ประกาศที่เพิ่งสร้าง — ยังไม่รัน 201 = ข้าม (ลิงก์ยังใช้ได้ เป็นฟอร์มมาตรฐาน) */
export async function setPostingApplyForm(postingId: string, formId: number | null): Promise<void> {
  if (formId === null) return;
  try {
    await dbQuery(`update ${POSTINGS} set apply_form_id = $2 where id::text = $1`, [postingId, formId]);
  } catch (e) {
    if (!isUndefinedTableOrColumn(e)) throw e;
  }
}
