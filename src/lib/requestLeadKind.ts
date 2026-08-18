/**
 * กฎเดียวของ **ล่วงหน้า / ฉุกเฉิน / ฉุกเฉิน-ย้อนหลัง**
 *
 * แยกออกมาเป็นไฟล์เล็ก ๆ เพราะตอนนี้มีสองฝั่งที่ต้องตัดสินเรื่องเดียวกัน:
 *   · หน้าเว็บ (`jobUrgency.ts`) — ใช้กับใบขอเต็มใบที่มีวันที่ครบ
 *   · ฝั่ง API (`siamrajSqlServerThroughput.ts`) — ติดป้ายให้ drill-down ของ Dashboard
 * ถ้าปล่อยให้ต่างคนต่างเขียน `< 7` เอง วันหนึ่งจะเพี้ยนกันโดยไม่มีใครรู้
 *
 * 🔴 **นับเป็นวันตามปฏิทิน ไม่ใช่ชั่วโมง** — ผู้เรียกต้องส่ง `leadDays` ที่คิดจาก
 * วันที่ (YYYY-MM-DD) ตามปฏิทินกรุงเทพมาแล้ว ไม่ใช่เอา timestamp มาลบกัน
 */

export const URGENCY_LEAD_DAYS = 7;

/** ล่วงหน้า = ขอไว้ล่วงหน้า ≥ 7 วัน · ฉุกเฉิน = ขอกระชั้น < 7 วัน · ย้อนหลัง = วันที่ต้องการอยู่ก่อนวันที่กรอก */
export type RequestLeadKind = 'retroactive' | 'urgent' | 'advance';

export const REQUEST_LEAD_KIND_LABEL: Record<RequestLeadKind, string> = {
  retroactive: 'ฉุกเฉิน/ย้อนหลัง',
  urgent: 'ฉุกเฉิน',
  advance: 'ล่วงหน้า',
};

export const REQUEST_LEAD_KIND_HINT: Record<RequestLeadKind, string> = {
  retroactive: 'วันที่ต้องการอยู่ก่อนวันที่กรอกใบขอ (ขอคนย้อนหลัง)',
  urgent: `วันที่กรอกถึงวันที่ต้องการน้อยกว่า ${URGENCY_LEAD_DAYS} วัน`,
  advance: `วันที่กรอกถึงวันที่ต้องการ ${URGENCY_LEAD_DAYS} วันขึ้นไป`,
};

/**
 * `leadDays` = วันที่ต้องการ − วันที่กรอก (ติดลบ = ขอย้อนหลัง)
 *
 * ⚠️ ไม่รู้วันใดวันหนึ่ง (null/NaN) ให้ตอบ `advance` — ตรงกับพฤติกรรมเดิมของ
 * `computeJobUrgency` ที่ถือว่า "ไม่มีข้อมูล = ยังไม่เร่ง" · **ห้ามเดาเป็นฉุกเฉิน**
 * ไม่งั้นใบที่ ERP กรอกวันไม่ครบจะไปโป่งอยู่ในถังฉุกเฉินทั้งกอง
 */
export function requestLeadKindFromDays(leadDays: number | null | undefined): RequestLeadKind {
  if (leadDays == null || !Number.isFinite(leadDays)) return 'advance';
  if (leadDays < 0) return 'retroactive';
  if (leadDays < URGENCY_LEAD_DAYS) return 'urgent';
  return 'advance';
}

/** จำนวนวันระหว่างสอง YMD (to − from) — คืน null ถ้ารูปแบบไม่ใช่ YYYY-MM-DD */
export function leadDaysBetweenYmd(fromYmd?: string | null, toYmd?: string | null): number | null {
  const a = parseYmdUtc(fromYmd);
  const b = parseYmdUtc(toYmd);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** YYYY-MM-DD → epoch ms ที่เที่ยงคืน UTC (ใช้ลบกันเป็นจำนวนวันเท่านั้น ไม่ใช่เวลาจริง) */
function parseYmdUtc(ymd?: string | null): number | null {
  if (!ymd || typeof ymd !== 'string') return null;
  const t = ymd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const ms = Date.parse(`${t}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** ทางลัดที่ฝั่ง API ใช้: มีแค่สอง YMD ก็ตัดสินได้เลย */
export function requestLeadKindFromYmd(
  requestYmd?: string | null,
  requiredYmd?: string | null,
): RequestLeadKind {
  return requestLeadKindFromDays(leadDaysBetweenYmd(requestYmd, requiredYmd));
}
