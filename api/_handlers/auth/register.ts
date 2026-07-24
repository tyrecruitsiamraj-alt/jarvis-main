import { dbQuery } from '../../_lib/postgres.js';
import { hashPassword, getJwtSecret } from '../../_lib/auth.js';
import {
  type ApiReq,
  sendError,
  handleApiError,
  type ApiRes,
} from '../../_lib/http.js';
import { readJsonBody, getString } from '../../_lib/body.js';
import type { UserRole } from '../../_lib/auth.js';
import { isPublicRegistrationAllowed } from '../../_lib/runtime.js';
import { rateLimitOrReject } from '../../_lib/rateLimit.js';
import {
  companyEmailRequiredMessage,
  isCompanyEmail,
  isCompanyEmailLoginEnforced,
} from '../../_lib/companyEmail.js';
import { isValidEnglishName } from '../../_lib/englishName.js';
import { APP_DEPARTMENT_CODES, isAllowedDepartmentCode } from '../../_lib/departmentScope.js';
import { tableInAppSchema } from '../../_lib/schema.js';

const usersTable = tableInAppSchema('users');

const GENERIC_REGISTER_DISABLED =
  'การสมัครสมาชิกด้วยตนเองปิดใช้งาน — ติดต่อผู้ดูแลระบบเพื่อขอบัญชี';

async function registerHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'POST') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!isPublicRegistrationAllowed()) {
    return sendError(res, 403, 'Forbidden', GENERIC_REGISTER_DISABLED);
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  // เพดานรวมต่อ IP สูง — ออฟฟิศสมัครพร้อมกันได้
  if (!rateLimitOrReject(req, res, 'auth:register:office', 120, 60 * 60 * 1000)) return;

  try {
    const raw = await readJsonBody(req);
    if (typeof raw !== 'object' || raw === null) {
      return sendError(res, 400, 'Bad request', 'Invalid JSON body');
    }
    const body = raw as Record<string, unknown>;
    const email = getString(body.email)?.toLowerCase();
    const password = getString(body.password);
    const first_name = getString(body.first_name);
    const last_name = getString(body.last_name);
    const legacyFull = getString(body.full_name);
    const department_code_raw = getString(body.department_code);
    const role: UserRole = 'staff';

    if (!isAllowedDepartmentCode(department_code_raw)) {
      return sendError(
        res,
        400,
        'Bad request',
        `ต้องเลือกแผนก (${APP_DEPARTMENT_CODES.join(', ')})`,
      );
    }
    const department_code = department_code_raw.trim().toUpperCase();

    let full_name: string;
    if (first_name && last_name) {
      full_name = `${first_name} ${last_name}`.replace(/\s+/g, ' ').trim();
    } else if (legacyFull) {
      full_name = legacyFull;
    } else {
      return sendError(
        res,
        400,
        'Bad request',
        'first_name and last_name are required',
      );
    }

    if (!email || !password) {
      return sendError(res, 400, 'Bad request', 'email and password are required');
    }

    // จำกัดต่ออีเมล — กันสมัครซ้ำถี่ๆ
    if (!rateLimitOrReject(req, res, `auth:register:user:${email}`, 8, 60 * 60 * 1000)) return;

    if (!isValidEnglishName(first_name ?? '')) {
      return sendError(res, 400, 'Bad request', 'first_name must use English letters only');
    }
    if (!isValidEnglishName(last_name ?? '')) {
      return sendError(res, 400, 'Bad request', 'last_name must use English letters only');
    }
    if (isCompanyEmailLoginEnforced() && !isCompanyEmail(email)) {
      return sendError(res, 400, 'Bad request', companyEmailRequiredMessage());
    }
    if (password.length < 8) {
      return sendError(res, 400, 'Bad request', 'password must be at least 8 characters');
    }

    const password_hash = await hashPassword(password);
    // ⚠ สมัครเอง = สร้างบัญชีแบบ "รออนุมัติ" (is_active=false) — กันคนนอกที่ไม่ได้เป็นเจ้าของ
    // อีเมล @company จริง ปั๊มบัญชี staff แล้วเข้าถึงข้อมูลได้ทันที ต้องให้ admin อนุมัติก่อน
    // (admin เปิดใช้งานได้ที่หน้าจัดการผู้ใช้ → PATCH /api/app-users is_active=true)
    // ไม่ออก session ให้ตอนสมัคร — บัญชียัง login ไม่ได้จนกว่าจะถูกอนุมัติ
    const { rows } = await dbQuery<{ id: string }>(
      `
      insert into ${usersTable} (email, password_hash, role, full_name, department_code, is_active)
      values (lower($1::text), $2, $3, $4, $5, false)
      returning id
    `,
      [email, password_hash, role, full_name, department_code],
    );

    const row = rows[0];
    if (!row) return sendError(res, 500, 'Failed to create user');

    return res.status(200).json({
      pending: true,
      message: 'สมัครสำเร็จ — บัญชีของคุณรอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/unique|duplicate/i.test(msg)) {
      return sendError(res, 409, 'Conflict', 'Email already registered');
    }
    return handleApiError(res, e, 'auth/register');
  }
}

export default registerHandler;
