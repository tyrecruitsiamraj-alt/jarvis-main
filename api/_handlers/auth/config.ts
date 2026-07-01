import {
  companyEmailRequiredMessage,
  getCompanyEmailDomains,
  isCompanyEmail,
  isCompanyEmailLoginEnforced,
} from '../../_lib/companyEmail.js';
import { isPostmarkConfigured } from '../../_lib/postmark.js';
import { isAzureAdConfigured } from '../../_lib/azureAdAuth.js';
import { sendError, type ApiReq, type ApiRes } from '../../_lib/http.js';

export default async function authConfigHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  const domains = getCompanyEmailDomains();
  const emailLoginEnabled = isPostmarkConfigured();
  const microsoftLogin = isAzureAdConfigured();
  const emailLoginGate = emailLoginEnabled || microsoftLogin;

  return res.status(200).json({
    companyEmailLogin: emailLoginEnabled,
    microsoftLogin,
    /** เมื่อ Postmark หรือ Azure AD พร้อม — หน้า Login เป็นกากบัง Web */
    emailLoginGate,
    companyEmailRequired: isCompanyEmailLoginEnforced(),
    allowedDomains: domains,
    companyEmailHint:
      domains.length > 0 ? companyEmailRequiredMessage() : null,
  });
}

export { isCompanyEmail, companyEmailRequiredMessage };
