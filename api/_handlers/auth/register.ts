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
import { isAllowedDepartmentCode } from '../../_lib/departmentScope.js';

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

  if (!rateLimitOrReject(req, res, 'auth:register', 5, 60 * 60 * 1000)) return;

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
      return sendError(res, 400, 'Bad request', 'ต้องเลือกแผนก (LBD หรือ LBA)');
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
    const { rows } = await dbQuery<{
      id: string;
      email: string;
      role: UserRole;
      full_name: string;
      is_active: boolean;
      created_at: string | Date;
      department_code: string | null;
    }>(
      `
      insert into users (email, password_hash, role, full_name, department_code)
      values (lower($1::text), $2, $3, $4, $5)
      returning id, email, role, full_name, is_active, created_at, department_code
    `,
      [email, password_hash, role, full_name, department_code],
    );

    const row = rows[0];
    if (!row) return sendError(res, 500, 'Failed to create user');
    return res.status(201).json({
      user: {
        id: row.id,
        username: row.email,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
        is_active: row.is_active,
        department_code: row.department_code?.trim().toUpperCase() || department_code,
        created_at:
          row.created_at instanceof Date
            ? row.created_at.toISOString().slice(0, 10)
            : String(row.created_at).slice(0, 10),
      },
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
