/**
 * ═══ ตัวช่วยของ log การยิง HTTP ไปหา Lumos (เจ้าของสั่ง 11 ก.ย. 2569) ═══
 *
 * > *"ให้ทำ log ในระหว่างที่ http client ยิงไปที่ Server Lumos อย่างละเอียดทุก End point
 * >  โดยให้บอก Http Status, Request และ Response เพื่อให้ฉันนำมา debug"*
 *
 * แยกส่วน **ตัดสินใจ** ออกมาเป็นฟังก์ชันเปล่า ๆ (ระดับ log · การปิดบังความลับ · การตัดความยาว)
 * เพราะจุดที่พลาดแล้วเจ็บที่สุดของงาน log คือ **คีย์หลุดลงไฟล์ log** — ต้องมีเทสต์คุม
 */

export type LumosHttpLogLevel =
  /** ปิดสนิท */
  | 'off'
  /** เฉพาะหัวข้อ: method · path · status · เวลาที่ใช้ (ไม่มีเนื้อ body) */
  | 'basic'
  /** เต็ม: หัวข้อ + body ของทั้งขาส่งและขาตอบ (ค่าเริ่มต้น — ที่เจ้าของสั่ง) */
  | 'full';

export type LumosHttpLogConfig = {
  level: LumosHttpLogLevel;
  /** ตัด body ที่ยาวเกินนี้ (ตัวอักษร) — กัน log บวมจนหาอะไรไม่เจอ */
  maxChars: number;
};

export const LUMOS_HTTP_LOG_DEFAULTS: LumosHttpLogConfig = {
  level: 'full',
  maxChars: 4000,
};

export function readLumosHttpLogConfig(
  env: Record<string, string | undefined>,
): LumosHttpLogConfig {
  const raw = (env.LUMOS_HTTP_LOG ?? '').trim().toLowerCase();
  const level: LumosHttpLogLevel =
    raw === 'off' || raw === 'basic' || raw === 'full'
      ? raw
      : // ค่ามั่ว/ไม่ตั้ง = ใช้ค่าเริ่มต้น **ห้ามปิดเงียบ** (ปิดเงียบ = กลับไปไม่รู้อะไรเลย)
        LUMOS_HTTP_LOG_DEFAULTS.level;

  // ⚠️ เช็คว่างก่อนแปลง — `Number('') === 0` ไม่ใช่ NaN (บั๊กเดียวกับ followPushRetryPolicy
  // 12 ก.ย. 2569: ไม่ได้ตั้ง env แต่ body ใน log โดนตัดเหลือ 200 ตัวอักษรแทนที่จะเป็น 4000)
  const rawChars = (env.LUMOS_HTTP_LOG_MAX_CHARS ?? '').trim();
  const n = rawChars === '' ? Number.NaN : Number(rawChars);
  const maxChars = Number.isFinite(n)
    ? Math.min(Math.max(Math.trunc(n), 200), 100_000)
    : LUMOS_HTTP_LOG_DEFAULTS.maxChars;

  return { level, maxChars };
}

/**
 * 🔴 **ปิดบังความลับก่อนลง log เสมอ**
 *
 * ปิดสองชั้นเพราะคีย์โผล่ได้สองทาง: อยู่ในหัว `Authorization` ตรง ๆ และอาจถูกสะท้อนกลับมา
 * ในข้อความ error ของปลายทาง · ปิดเฉพาะหัวอย่างเดียวไม่พอ
 *
 * ⚠️ `secret` สั้นกว่า 8 ตัวอักษรจะ **ไม่ถูกแทนที่** — ค่าสั้นเกินไปมีโอกาสไปตรงกับ
 * ข้อความปกติแล้วทำให้ log อ่านไม่รู้เรื่อง (และคีย์จริงไม่มีทางสั้นขนาดนั้น)
 */
export function redactSecrets(text: string, secrets: ReadonlyArray<string | undefined>): string {
  let out = text;
  for (const s of secrets) {
    const v = (s ?? '').trim();
    if (v.length < 8) continue;
    out = out.split(v).join('***');
  }
  return out;
}

/** ตัดความยาวแล้วบอกตรง ๆ ว่าตัดไปเท่าไหร่ — ห้ามตัดเงียบจนคนอ่านเข้าใจว่านี่คือทั้งหมด */
export function truncateForLog(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}…[ตัดอีก ${text.length - maxChars} ตัวอักษร]`;
}

/**
 * หัวที่เอาลง log ได้ — `Authorization` ถูกแทนที่ **ไม่ใช่ลบทิ้ง**
 * (ต้องเห็นว่ามีหัวนี้ส่งไปจริงไหม เวลาไล่เคส 401)
 */
export function safeHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = /^authorization$/i.test(k) ? 'Bearer ***' : v;
  }
  return out;
}

/** หัวของฝั่งตอบที่ช่วยไล่ปัญหาได้จริง — ไม่เอาทั้งก้อนเพราะรกเปล่า ๆ */
const RESPONSE_HEADERS_OF_INTEREST = [
  'content-type',
  'x-request-id',
  'x-correlation-id',
  'retry-after',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
] as const;

export function pickResponseHeaders(get: (name: string) => string | null): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of RESPONSE_HEADERS_OF_INTEREST) {
    const v = get(name);
    if (v != null && v !== '') out[name] = v;
  }
  return out;
}

/** รหัสสั้น ๆ ไว้จับคู่บรรทัด "ส่ง" กับ "ตอบ" ของคำขอเดียวกันใน log */
export function newRequestId(): string {
  return Math.random().toString(16).slice(2, 10).padStart(8, '0');
}
