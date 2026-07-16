import type { ApiReq } from './http.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimitsForTests(): void {
  buckets.clear();
}

export function getClientIp(req: ApiReq): string {
  const xff = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',')[0].trim();
  }
  const realIp = req.headers?.['x-real-ip'];
  const rip = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof rip === 'string' && rip.trim()) return rip.trim();
  return 'unknown';
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

/**
 * In-memory rate limiter (per server instance).
 * Suitable for basic abuse protection; use edge/WAF for production scale.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { allowed: true };
}

export function rateLimitOrReject(
  req: ApiReq,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  scope: string,
  max: number,
  windowMs: number,
): boolean {
  const ip = getClientIp(req);
  const result = checkRateLimit(`${scope}:${ip}`, max, windowMs);
  if (result.allowed) return true;
  res.status(429).json({
    error: 'Too many requests',
    message: `คำขอจากเครือข่ายนี้ถี่เกินไป — รอ ${result.retryAfterSec} วินาทีแล้วลองใหม่ (ออฟฟิศใช้ IP ร่วมกันได้)`,
    retryAfterSec: result.retryAfterSec,
  });
  return false;
}
