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

/**
 * ไฟล์แนบใบสมัคร (PDF/JPG/PNG) เก็บแบบเข้ารหัส (เจ้าของเคาะ 24 พ.ย. 2569 ตรวจความปลอดภัยลิงก์ — เดิมเก็บไฟล์ดิบ)
 * รูปแบบ = `JENC1` + iv 12 ไบต์ + tag 16 ไบต์ + เนื้อไฟล์ที่เข้ารหัส (AES-256-GCM)
 * ไฟล์เก่าที่ไม่มีหัว `JENC1` = ไฟล์ดิบเดิม คืนตามเดิม (อ่านได้ทั้งสองแบบ)
 */
const ATTACH_MAGIC = Buffer.from('JENC1', 'ascii');
const attachKey = () => createHash('sha256').update(`${secret()}:attachment:v1`).digest();

export function encryptAttachment(plain: Buffer): Buffer {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', attachKey(), iv);
  const enc = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([ATTACH_MAGIC, iv, c.getAuthTag(), enc]);
}

export function isEncryptedAttachment(stored: Buffer): boolean {
  return stored.length > ATTACH_MAGIC.length + 28 && stored.subarray(0, ATTACH_MAGIC.length).equals(ATTACH_MAGIC);
}

/** ถอดไม่ออก (กุญแจเปลี่ยน/ข้อมูลเสีย) = null · ไฟล์เก่าไม่เข้ารหัส = คืนตามเดิม */
export function decryptAttachment(stored: Buffer): Buffer | null {
  if (!isEncryptedAttachment(stored)) return stored;
  try {
    const o = ATTACH_MAGIC.length;
    const iv = stored.subarray(o, o + 12);
    const tag = stored.subarray(o + 12, o + 28);
    const d = createDecipheriv('aes-256-gcm', attachKey(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(stored.subarray(o + 28)), d.final()]);
  } catch {
    return null;
  }
}
