import type { ApiReq, ApiRes } from './http.js';
import { sendError } from './http.js';
import { logError, logWarn } from './logger.js';

export type LumosHandler = (req: ApiReq, res: ApiRes) => Promise<void>;

function getLumosApiKey(): string | null {
  const k = (process.env.LUMOS_API_KEY || '').trim();
  return k || null;
}

/**
 * Middleware: ตรวจสอบ API key จาก Lumos ผ่าน Authorization: Bearer <key>
 * ตั้งค่า LUMOS_API_KEY ใน environment variables
 */
export function withLumosAuth(handler: LumosHandler): LumosHandler {
  return async (req: ApiReq, res: ApiRes) => {
    const apiKey = getLumosApiKey();
    if (!apiKey) {
      logError('lumos.auth', { message: 'LUMOS_API_KEY is not configured' });
      return sendError(res, 503, 'Service Unavailable', 'Lumos integration is not configured');
    }

    const authHeader =
      typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      logWarn('lumos.auth', { message: 'Missing Authorization header' });
      return sendError(res, 401, 'Unauthorized', 'Missing Authorization: Bearer <api_key> header');
    }

    if (token !== apiKey) {
      logWarn('lumos.auth', { message: 'Invalid API key' });
      return sendError(res, 401, 'Unauthorized', 'Invalid API key');
    }

    return handler(req, res);
  };
}
