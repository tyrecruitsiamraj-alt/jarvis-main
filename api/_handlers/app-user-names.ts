/**
 * `GET /api/app-user-names` — ชื่อผู้ใช้ที่ยังใช้งานอยู่ สำหรับช่อง "ผู้รับผิดชอบ" (11 ต.ค. 2569)
 *
 * เจ้าของแจ้งว่าป๊อปนำเข้า Excel ใช้ไม่ได้ — ต้นเหตุหนึ่งคือช่องผู้รับผิดชอบโหลดจาก `/api/app-users`
 * ซึ่งเปิดเฉพาะ admin ⇒ หัวหน้า/เจ้าหน้าที่ได้ลิสต์ว่าง เลือกไม่ได้ ปุ่มนำเข้ากดไม่ได้ตลอด
 *
 * ส่งแค่ `{ id, name }` (ไม่มีอีเมล/สิทธิ์/เบอร์) · ทุก role ที่ล็อกอินอ่านได้ (rbac `app-user-names`)
 * คนล็อก BU เห็นคนในแผนกเดียวกัน + คนที่ไม่ผูกแผนก (แอดมิน) · ล็อกแต่ไม่รู้แผนก = ลิสต์ว่าง
 * `name` = `full_name` ค่าเดียวกับที่ป๊อปเดิมเก็บลง `responsible_name` (ห้ามเปลี่ยนเป็นชื่อเล่น — ตัวกรองเทียบชื่อนี้)
 */
import { withRbac, sendError, handleApiError, type ApiRes, type AuthedReq } from '../_lib/http.js';
import { dbQuery } from '../_lib/postgres.js';
import { tableInAppSchema } from '../_lib/schema.js';
import { loadUserDepartmentScope } from '../_lib/departmentScope.js';

const usersTable = tableInAppSchema('users');

async function handler(req: AuthedReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendError(res, 405, 'Method not allowed');
  }
  try {
    const scope = await loadUserDepartmentScope(req.user);
    if (scope.mode === 'none') return res.status(200).json({ users: [] });
    const params: string[] = [];
    let where = `is_active and coalesce(trim(full_name), '') <> ''`;
    if (scope.mode === 'code') {
      params.push(scope.code);
      where += ` and (upper(trim(department_code)) = $1 or department_code is null)`;
    }
    const { rows } = await dbQuery<{ id: string; name: string }>(
      `select id, trim(full_name) as name from ${usersTable} where ${where} order by trim(full_name) asc`,
      params,
    );
    return res.status(200).json({ users: rows });
  } catch (e) {
    return handleApiError(res, e, 'app-user-names');
  }
}

export default withRbac(handler, 'app-user-names');
