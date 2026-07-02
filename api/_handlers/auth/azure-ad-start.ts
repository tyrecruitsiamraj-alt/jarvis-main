import { getJwtSecret } from '../../_lib/auth.js';
import {
  buildAzureAuthorizeUrl,
  buildOAuthStartCookies,
  createOAuthState,
  isAzureAdConfigured,
  sanitizeReturnPath,
  azureAuthErrorRedirect,
} from '../../_lib/azureAdAuth.js';
import { sendError, handleApiError, sendRedirect, type ApiReq, type ApiRes } from '../../_lib/http.js';

function getQuery(req: ApiReq, key: string): string {
  const v = req.query?.[key];
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
  return '';
}

export default async function azureAdStartHandler(req: ApiReq, res: ApiRes) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET') {
    return sendError(res, 405, 'Method not allowed');
  }

  if (!getJwtSecret()) {
    return sendError(res, 503, 'Service unavailable', 'AUTH_JWT_SECRET is not configured');
  }

  if (!isAzureAdConfigured()) {
    const returnTo = sanitizeReturnPath(getQuery(req, 'returnTo') || '/login');
    sendRedirect(res, azureAuthErrorRedirect('azure_not_configured', returnTo));
    return;
  }

  try {
    const returnTo = sanitizeReturnPath(getQuery(req, 'returnTo') || '/');
    const state = createOAuthState();
    const cookies = buildOAuthStartCookies(state, returnTo);
    sendRedirect(res, buildAzureAuthorizeUrl(state), cookies);
  } catch (e) {
    return handleApiError(res, e, 'auth/azure-ad-start');
  }
}
