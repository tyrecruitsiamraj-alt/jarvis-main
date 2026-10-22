/**
 * ═══ ยืนยันตัวระบบภายนอกด้วย header `x-api-key` (So Scraping · 22 ต.ค. 2569) ═══
 * key เก็บในฐานเป็น sha256 (`app_integration_keys`) — ไม่ต้องแก้ .env บนเซิร์ฟเวอร์ · ยกเลิก key = ตั้ง `revoked_at`
 * ออก key ใหม่: `node scripts/create-integration-key.mjs <ชื่อ>` (พิมพ์ key ครั้งเดียว เก็บแค่แฮช)
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApiReq, ApiRes } from './http.js';
import { sendError } from './http.js';
import { dbQuery } from './postgres.js';
import { tableInAppSchema } from './schema.js';
import { logWarn } from './logger.js';

export type IntegrationHandler = (req: ApiReq, res: ApiRes) => Promise<void>;

const KEYS = tableInAppSchema('app_integration_keys');
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; hashes: string[] }>();

export const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

async function activeHashes(name: string): Promise<string[]> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.hashes;
  const { rows } = await dbQuery<{ key_sha256: string }>(`select key_sha256 from ${KEYS} where name = $1 and revoked_at is null`, [name]);
  const hashes = rows.map((r) => r.key_sha256);
  cache.set(name, { at: Date.now(), hashes });
  return hashes;
}

/** ตรงกับแฮชไหนสักตัว (เทียบแบบเวลาคงที่) */
export function keyMatches(key: string, hashes: readonly string[]): boolean {
  const got = Buffer.from(sha256Hex(key), 'hex');
  return hashes.some((h) => {
    const want = Buffer.from(h, 'hex');
    return want.length === got.length && timingSafeEqual(want, got);
  });
}

export function withIntegrationKey(name: string, handler: IntegrationHandler): IntegrationHandler {
  return async (req: ApiReq, res: ApiRes) => {
    const raw = req.headers?.['x-api-key'];
    const key = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
    if (!key) return sendError(res, 401, 'Unauthorized', 'ต้องส่ง header x-api-key');
    let hashes: string[];
    try {
      hashes = await activeHashes(name);
    } catch {
      return sendError(res, 503, 'Service Unavailable', 'ยังไม่ได้ตั้งค่า key ของระบบนี้');
    }
    if (hashes.length === 0) return sendError(res, 503, 'Service Unavailable', 'ยังไม่ได้ตั้งค่า key ของระบบนี้');
    if (!keyMatches(key, hashes)) {
      logWarn('integration.auth', { name, message: 'invalid key' });
      return sendError(res, 401, 'Unauthorized', 'x-api-key ไม่ถูกต้อง');
    }
    void touchLastUsed(name);
    return handler(req, res);
  };
}

/** จดเวลาใช้ล่าสุด (หน้าตั้งค่า) — ไม่เกิน 1 ครั้ง/5 นาที/ชื่อ · ล้มก็เงียบ ห้ามทำคำขอหลักล้ม */
const touched = new Map<string, number>();
async function touchLastUsed(name: string): Promise<void> {
  const last = touched.get(name) ?? 0;
  if (Date.now() - last < 5 * 60_000) return;
  touched.set(name, Date.now());
  try {
    await dbQuery(`update ${KEYS} set last_used_at = now() where name = $1 and revoked_at is null`, [name]);
  } catch {
    /* ฐานยังไม่รัน 162 ก็ไม่เป็นไร */
  }
}

/** ล้างแคชหลังออก/ยกเลิก key จากหน้าตั้งค่า (key ใหม่ใช้ได้ทันที · ตัวเก่าใช้ไม่ได้ทันที) */
export function clearIntegrationKeyCache(name?: string): void {
  if (name) cache.delete(name);
  else cache.clear();
}
