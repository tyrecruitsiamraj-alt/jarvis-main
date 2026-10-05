/**
 * ═══ ข้อความ error บนจอ — ภาษาคน ไม่ใช่ข้อความดิบของเบราว์เซอร์/เซิร์ฟเวอร์ ═══
 *
 * QA 5 ต.ค. 2569: ทุกจุดที่ล้มโชว์ "Internal server error" / "Failed to fetch" ตรง ๆ
 * (production ตอบ `{error:'Internal server error'}` ทุก 500 · dev ได้ข้อความ DB ดิบ)
 *
 * กติกา:
 * - เน็ตหลุด / ต่อไม่ติด ⇒ "ต่อเซิร์ฟเวอร์ไม่ได้"
 * - ข้อความไม่มีตัวอักษรไทย (อังกฤษดิบ · รหัส) ⇒ ใช้ `fallback` ของจุดนั้น
 * - ข้อความไทยจากเซิร์ฟเวอร์ (เช่น "เวลาที่ผ่านมาแล้วตั้งไม่ได้") ⇒ ส่งต่อตามเดิม เพราะบอกเหตุจริง
 */
const NETWORK_PATTERNS = [/failed to fetch/i, /networkerror/i, /load failed/i, /network request failed/i];

export const NETWORK_ERROR_TEXT = 'ต่อเซิร์ฟเวอร์ไม่ได้';

export function friendlyErrorText(e: unknown, fallback: string): string {
  const raw = (e instanceof Error ? e.message : typeof e === 'string' ? e : '').trim();
  if (!raw) return fallback;
  if (NETWORK_PATTERNS.some((p) => p.test(raw))) return NETWORK_ERROR_TEXT;
  return /[฀-๿]/.test(raw) ? raw : fallback;
}
