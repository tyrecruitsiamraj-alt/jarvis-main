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
};

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
  if (dept.mode === 'code' && row.department_code) {
    return normalizeDepartmentCode(row.department_code) === dept.code;
  }
  return false;
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
    const { rows } = await dbQuery<{ job_id: string | null; department_code: string | null }>(
      `select job_id, department_code from ${applicationsTable} where id = $1 limit 1`,
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
