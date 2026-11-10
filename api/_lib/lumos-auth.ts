import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApiReq, ApiRes } from './http.js';
import { sendError } from './http.js';
import { logError, logInfo, logWarn } from './logger.js';

export type LumosHandler = (req: ApiReq, res: ApiRes) => Promise<void>;

function getLumosApiKey(): string | null {
  const k = (process.env.LUMOS_API_KEY || '').trim();
  return k || null;
}

/**
 * รหัสชุดใหม่ช่วงสลับ (ตรวจทั้งระบบ 10 พ.ย. 2569 — รหัสเดิมหลุดในเอกสารบน repo สาธารณะ)
 * ตั้ง `LUMOS_API_KEY_NEXT` แล้ว Lumos ใช้ได้ทั้งเก่าและใหม่ · Lumos เปลี่ยนเสร็จ → ย้ายค่าไป `LUMOS_API_KEY` แล้วลบตัวนี้
 */
function getLumosNextApiKey(): string | null {
  const k = (process.env.LUMOS_API_KEY_NEXT || '').trim();
  return k || null;
}

/** เทียบรหัสแบบเวลาคงที่ (กันเดารหัสทีละตัวจากเวลาตอบ) — hash ก่อนให้ยาวเท่ากันเสมอ */
export function sameSecret(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** รหัสที่ Lumos ส่งมาตรงชุดไหน — 'current' | 'next' | null */
export function matchLumosKey(token: string, current: string | null, next: string | null): 'current' | 'next' | null {
  if (current && sameSecret(token, current)) return 'current';
  if (next && sameSecret(token, next)) return 'next';
  return null;
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

    const matched = matchLumosKey(token, apiKey, getLumosNextApiKey());
    if (!matched) {
      logWarn('lumos.auth', { message: 'Invalid API key' });
      return sendError(res, 401, 'Unauthorized', 'Invalid API key');
    }
    // ช่วงสลับรหัส: บอกได้ว่า Lumos ใช้ชุดไหนอยู่ (ไม่จดตัวรหัส)
    if (getLumosNextApiKey()) logInfo('lumos.auth.key', { key: matched });

    return handler(req, res);
  };
}
