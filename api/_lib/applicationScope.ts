import type { UserRole } from './auth.js';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { loadScopedJobIdSet } from './siamrajUnitRequests.js';
import { loadUserDepartmentScope, normalizeDepartmentCode } from './departmentScope.js';

type ScopeUser = { sub: string; role: UserRole };

const applicationsTable = tableInAppSchema('public_job_applications');

/** แถวใบสมัครเท่าที่ต้องใช้ตัดสินสิทธิ์เขียน — job_id + แผนกที่จำไว้ (migration 082) */
export type ApplicationScopeRow = {
  job_id: string | null;
  department_code?: string | null;
  /** คนคีย์ — 'iRecruit' = ดึงมาจาก iRecruit (ใช้ตัดสินคลังกลาง) */
  created_by_name?: string | null;
};

/**
 * ใบที่ดึงจาก iRecruit ที่หาเจ้าหน้าที่ดูแลไม่เจอ (ไม่ผูกใบขอ · ไม่มีแผนก) = คลังกลาง ทุกแผนกเห็น (เจ้าของ 10 พ.ย. 2569)
 * 🔴 ตัวเดียวกับด่านอ่าน (`buildApplicationsListQuery`) — 16 พ.ย. 2569 ด่านเขียนไม่มีข้อนี้ คนที่ไม่ใช่แอดมิน (pakkorn ดู 5 BU)
 *    เปิดป๊อปได้แต่กดบันทึกแล้วขึ้น "ไม่มีสิทธิ์เข้าถึงใบสมัครของแผนกอื่น"
 */
export const isUnassignedIrecruitRow = (row: ApplicationScopeRow): boolean =>
  (row.created_by_name ?? '').trim() === 'iRecruit' && !row.job_id && !(row.department_code ?? '').trim();

/**
 * ใบสมัครนี้อยู่ในสิทธิ์ "เขียน" ของผู้ใช้ไหม — ต้องตรงกับด่านฝั่ง **อ่าน**
 * (buildApplicationsListQuery) เป๊ะ ไม่งั้นเห็นแถวได้แต่กดปุ่มไม่ได้ (403 ทั้งที่แผนกตัวเอง)
 *
 * ⚠️ **ห้ามยึด `loadScopedJobIdSet` อย่างเดียว** — เซ็ตนั้นสร้างจาก **ใบขอที่เปิดอยู่**
 * พอใบขอปิด job_id หลุดจากเซ็ต → ปุ่มเก็บ Lead/เปลี่ยนสถานะ/โหลด CV/เก็บไปโทรเอง
 * กลายเป็น 403 ทั้งที่เป็นแผนกตัวเอง · ต้องยอมอีกทาง: ใบที่ **จำแผนกของตัวเองไว้** (082)
 * และตรงกับแผนกผู้ใช้ (สิทธิ์ไม่ได้ผ่อน — ยังเป็นแผนกเดียวกันเป๊ะ)
 */
export async function isApplicationInWriteScope(
  user: ScopeUser,
  row: ApplicationScopeRow,
): Promise<boolean> {
  const scopedJobIds = await loadScopedJobIdSet(user);
  if (!scopedJobIds) return true; // admin / เห็นทุกแผนก
  if (row.job_id && scopedJobIds.has(row.job_id)) return true;

  const dept = await loadUserDepartmentScope(user);
  if (dept.mode === 'code' && isUnassignedIrecruitRow(row)) return true;
  if (dept.mode === 'code' && row.department_code) {
    // หลาย BU (26 ต.ค. 2569) — ใบที่ประทับ BU ใดก็ได้ในสิทธิ์
    return dept.codes.includes(normalizeDepartmentCode(row.department_code) ?? '');
  }
  return false;
}

/**
 * แผนกที่จำไว้บนใบที่เจ้าหน้าที่คีย์/นำเข้าเอง (11 ต.ค. 2569 · เจ้าของแจ้งนำเข้า Excel ไม่ได้)
 *
 * เดิมผู้ใช้ที่ถูกล็อก BU (59 จาก 61 คน) โดน 403 ทันทีเพราะใบไม่ผูกใบขอแล้วจะมองไม่เห็นใบตัวเอง ·
 * ใบจำแผนกไว้ได้อยู่แล้ว (082) และด่านอ่าน/เขียนเทียบ `department_code` ให้ ⇒ ประทับแผนกของคนคีย์แทนการกัน
 * - เห็นทุกแผนก = null (เหมือนเดิม) · ล็อก BU = แผนกตัวเอง (สิทธิ์ไม่ได้ผ่อน — แผนกเดียวกันเป๊ะ)
 * - ล็อกแต่ไม่รู้แผนก = ห้ามคีย์ (คีย์แล้วไม่มีใครในแผนกเห็น)
 */
export async function staffEntryDepartment(
  user: ScopeUser,
): Promise<{ ok: true; code: string | null } | { ok: false }> {
  const dept = await loadUserDepartmentScope(user);
  if (dept.mode === 'all') return { ok: true, code: null };
  if (dept.mode === 'code') return { ok: true, code: dept.code };
  return { ok: false };
}

/**
 * โหลดแถวสำหรับตัดสินสิทธิ์ · คืน null ถ้าไม่พบใบ (ให้ handler ตอบ 404 แยกจาก 403)
 * · ตารางหาย (42P01) → null · คอลัมน์ department_code ยังไม่มี (42703) → ถอยอ่าน job_id
 */
export async function loadApplicationScopeRowOrNull(
  applicationId: string,
): Promise<ApplicationScopeRow | null> {
  const id = (applicationId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { rows } = await dbQuery<{ job_id: string | null; department_code: string | null; created_by_name: string | null }>(
      `select job_id, department_code, created_by_name from ${applicationsTable} where id = $1 limit 1`,
      [id],
    );
    return rows[0] ?? null;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === '42P01') return null;
    if (code !== '42703') throw e;
    const { rows } = await dbQuery<{ job_id: string | null }>(
      `select job_id from ${applicationsTable} where id = $1 limit 1`,
      [id],
    );
    return rows[0] ? { job_id: rows[0].job_id } : null;
  }
}

/**
 * โหลดแถวสำหรับตัดสินสิทธิ์เมื่อมีแค่ application id (เช่น "เก็บไปโทรเอง" ฝั่งใบสมัคร)
 * · ถ้าคอลัมน์ department_code ยังไม่ migrate (082) → ถอยไปใช้ job_id ที่ส่งมาแทน
 * · id ไม่ใช่ uuid / ไม่พบแถว → คืน job_id ที่ส่งมา (ให้ด่านเดิมตัดสินตามใบขอ)
 */
export async function loadApplicationScopeRow(
  applicationId: string,
  fallbackJobId: string | null,
): Promise<ApplicationScopeRow> {
  const id = (applicationId || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { job_id: fallbackJobId };
  try {
    const { rows } = await dbQuery<{ job_id: string | null; department_code: string | null; created_by_name: string | null }>(
      `select job_id, department_code, created_by_name from ${applicationsTable} where id = $1 limit 1`,
      [id],
    );
    if (rows[0]) return rows[0];
  } catch (e) {
    // 42703 = ยังไม่รัน 082 (ไม่มี department_code) · 42P01 = ยังไม่มีตาราง — ถอยไป job_id
    const code = (e as { code?: string })?.code;
    if (code !== '42703' && code !== '42P01') throw e;
    try {
      const { rows } = await dbQuery<{ job_id: string | null }>(
        `select job_id from ${applicationsTable} where id = $1 limit 1`,
        [id],
      );
      if (rows[0]) return { job_id: rows[0].job_id };
    } catch {
      /* ตารางหาย — ถอยไป fallback */
    }
  }
  return { job_id: fallbackJobId };
}
