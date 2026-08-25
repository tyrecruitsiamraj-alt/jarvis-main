import {
  companyEmailRequiredMessage,
  getCompanyEmailDomains,
  isCompanyEmail,
  isCompanyEmailLoginEnforced,
} from '../../_lib/companyEmail.js';
import { isPostmarkConfigured } from '../../_lib/postmark.js';
import { isAzureAdConfigured } from '../../_lib/azureAdAuth.js';
import { isDevRoleLoginAllowed, isPublicRegistrationAllowed, isPasswordLoginUiEnabled } from '../../_lib/runtime.js';
import { getJwtSecret } from '../../_lib/auth.js';
import { sendError, type ApiReq, type ApiRes } from '../../_lib/http.js';

export default async function authConfigHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const domains = getCompanyEmailDomains();
  const emailLoginEnabled = isPostmarkConfigured();
  const microsoftLogin = isAzureAdConfigured();
  const emailLoginGate = false;

  return res.status(200).json({
    companyEmailLogin: emailLoginEnabled,
    // email+password login ใช้ได้เมื่อมี JWT secret — ไม่ต้องการ Postmark
    passwordLogin: !!getJwtSecret(),
    /**
     * โชว์ฟอร์มอีเมล+รหัสผ่านบนหน้า Login ไหม — ตั้งต้น "ไม่โชว์" ตามที่เจ้าของสั่ง
     * (เส้น API ยังใช้ได้ตามปกติ · ดู isPasswordLoginUiEnabled)
     */
    passwordLoginUi: isPasswordLoginUiEnabled(),
    microsoftLogin,
    devRoleLogin: isDevRoleLoginAllowed(),
    publicRegister: isPublicRegistrationAllowed(),
    emailLoginGate,
    companyEmailRequired: isCompanyEmailLoginEnforced(),
    allowedDomains: domains,
    companyEmailHint:
      domains.length > 0 ? companyEmailRequiredMessage() : null,
  });
}

export { isCompanyEmail, companyEmailRequiredMessage };
