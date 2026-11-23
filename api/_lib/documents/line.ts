/**
 * ยืนยันบัญชี LINE ของคนที่เปิดลิงก์ส่งเอกสาร (เจ้าของ 22 พ.ย. 2569)
 *
 * ID token จากหน้าเว็บส่งให้ LINE ตรวจที่เซิร์ฟเวอร์ (`/oauth2/v2.1/verify`) — ไม่เชื่อชื่อ/รูป/รหัสบัญชีที่ browser ส่งมาเอง
 * ตรวจ ผู้ออก (iss) · ช่อง (aud = LINE Login channel ของเรา) · รหัสบัญชี (sub) · อายุ (exp) · ชื่อ · รูปต้องเป็น https ของ LINE
 * ใช้สิทธิ์ openid + profile เท่านั้น — ไม่ขอสิทธิ์ส่งข้อความ ไม่ใช้ Messaging API
 * LINE ยืนยัน "บัญชี" ไม่ได้ยืนยันว่าเป็นเจ้าของบัตรประชาชน
 * 🔴 ห้ามพิมพ์ ID token ลง log
 */
import { DocError, isLineMockAllowed } from './core.js';

export type VerifiedLineProfile = {
  userId: string;
  displayName: string;
  pictureUrl: string | null;
  channelId: string;
  verifiedAt: string;
};

const LINE_VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const LINE_ISSUER = 'https://access.line.me';
export const LINE_USER_ID_RE = /^U[a-f0-9]{32}$/i;

/** รูปโปรไฟล์ต้องเป็น https จากโดเมนรูปของ LINE เท่านั้น · อย่างอื่น = ไม่มีรูป (ไม่ใส่รูปแทน) */
export function safeLinePicture(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'profile.line-scdn.net' || u.hostname.endsWith('.line-scdn.net')) ? u.href : null;
  } catch {
    return null;
  }
}

function claimsToProfile(d: Record<string, unknown>, channelId: string): VerifiedLineProfile {
  if (
    d.iss !== LINE_ISSUER ||
    String(d.aud) !== channelId ||
    typeof d.sub !== 'string' ||
    !LINE_USER_ID_RE.test(d.sub) ||
    typeof d.exp !== 'number' ||
    d.exp <= Date.now() / 1000 ||
    typeof d.name !== 'string' ||
    !d.name.trim()
  ) {
    throw new DocError(401, 'invalid_line_claims', 'LINE ยืนยันบัญชีนี้ไม่ผ่าน เข้าสู่ระบบ LINE ใหม่แล้วเปิดลิงก์อีกครั้ง');
  }
  return {
    userId: d.sub,
    displayName: d.name.trim().slice(0, 255),
    pictureUrl: safeLinePicture(d.picture),
    channelId,
    verifiedAt: new Date().toISOString(),
  };
}

/** โทเคนจำลองของเครื่องทดสอบ: `mock.<base64url ของ {"sub","name","picture"}>` — ใช้ได้เมื่อ `isLineMockAllowed()` เท่านั้น */
const MOCK_PREFIX = 'mock.';
export const MOCK_CHANNEL_ID = 'mock-channel';

export async function verifyLineIdToken(
  idToken: unknown,
  channelId: string,
  fetcher: typeof fetch = fetch,
): Promise<VerifiedLineProfile> {
  if (typeof idToken !== 'string' || idToken.length < 32 || idToken.length > 16_000) {
    throw new DocError(400, 'invalid_token', 'เข้าสู่ระบบ LINE ใหม่แล้วเปิดลิงก์อีกครั้ง');
  }
  if (idToken.startsWith(MOCK_PREFIX)) {
    if (!isLineMockAllowed()) throw new DocError(401, 'line_verification_failed', 'LINE ไม่ยืนยันบัญชีนี้ เข้าสู่ระบบ LINE ใหม่');
    let claims: Record<string, unknown>;
    try {
      claims = JSON.parse(Buffer.from(idToken.slice(MOCK_PREFIX.length), 'base64url').toString('utf8')) as Record<string, unknown>;
    } catch {
      throw new DocError(400, 'invalid_token', 'เข้าสู่ระบบ LINE ใหม่แล้วเปิดลิงก์อีกครั้ง');
    }
    return claimsToProfile({ iss: LINE_ISSUER, aud: MOCK_CHANNEL_ID, exp: Date.now() / 1000 + 600, ...claims }, MOCK_CHANNEL_ID);
  }
  if (!/^\d+$/.test(channelId)) throw new DocError(503, 'line_not_configured', 'ระบบส่งเอกสารยังตั้งค่าไม่ครบ ติดต่อเจ้าหน้าที่ที่ส่งลิงก์นี้');
  let response: Response;
  try {
    response = await fetcher(LINE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new DocError(503, 'line_unreachable', 'ติดต่อ LINE ไม่ได้ ลองเปิดลิงก์อีกครั้ง');
  }
  if (!response.ok) {
    throw new DocError(response.status === 429 ? 429 : 401, 'line_verification_failed', 'LINE ไม่ยืนยันบัญชีนี้ เข้าสู่ระบบ LINE ใหม่');
  }
  const d = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!d) throw new DocError(401, 'line_verification_failed', 'LINE ไม่ยืนยันบัญชีนี้ เข้าสู่ระบบ LINE ใหม่');
  return claimsToProfile(d, channelId);
}
