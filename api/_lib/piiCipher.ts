/**
 * เข้ารหัสข้อมูลส่วนบุคคลที่ห้ามเก็บตรง ๆ (เลขบัตรประชาชน · เจ้าของ 16 พ.ย. 2569 แบบทดสอบ)
 * - `encryptPii` / `decryptPii` = AES-256-GCM ถอดได้เฉพาะเซิร์ฟเวอร์ (แบบเดียวกับกุญแจ AI ใน aiSettingsStore)
 * - `hashPii` = HMAC-SHA256 ไว้ค้นหา/กันซ้ำ โดยไม่ต้องถอดทุกแถว
 * กุญแจมาจาก AUTH_JWT_SECRET + ชื่อหน้าที่ — คนละตัวกับกุญแจ AI · ห้ามพิมพ์ค่าเดิมลง log
 */
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';

function secret(): string {
  const s = (process.env.AUTH_JWT_SECRET || '').trim();
  if (!s) throw new Error('AUTH_JWT_SECRET is not configured');
  return s;
}

const cipherKey = () => createHash('sha256').update(`${secret()}:pii:v1`).digest();

export function encryptPii(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), enc.toString('base64')].join(':');
}

/** ถอดไม่ออก (กุญแจเปลี่ยน/ข้อมูลเสีย) = null */
export function decryptPii(stored: string | null | undefined): string | null {
  if (!stored) return null;
  try {
    const [v, iv, tag, enc] = stored.split(':');
    if (v !== 'v1' || !iv || !tag || !enc) return null;
    const d = createDecipheriv('aes-256-gcm', cipherKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}

/** `purpose` แยกค่าแฮชของคนละเรื่อง (เลขเดียวกันคนละตาราง ได้คนละค่า) */
export function hashPii(purpose: string, plain: string): string {
  return createHmac('sha256', `${secret()}:pii-hash:v1`).update(`${purpose}:${plain}`).digest('hex');
}
