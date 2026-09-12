/**
 * กติกาของตัว **ส่งซ้ำไปหา Lumos** (เจ้าของสั่ง 11 ก.ย. 2569)
 *
 * > *"ฉันต้องการแค่เพิ่มแล้วต้องไปโผล่ที่ lumos ถ้าผิดที่เราก็แก้ดิ"*
 *
 * วัดจริงวันนั้น: 12 จาก 42 สาย **ไม่เคยถึง Lumos** เพราะต่อไม่ติดเป็นช่วงสั้น ๆ
 * (ช่วงเสียยาวหลายสิบวินาที · retry ในคำขอเดียวครอบแค่ 1.2 วินาที จึงไม่ทัน)
 * ⇒ ทางแก้คือ **ส่งซ้ำทีหลัง** ไม่ใช่ลองให้ถี่ขึ้นในวินาทีเดียวกัน
 *
 * แยกกติกาออกมาเป็นไฟล์เปล่า ๆ เพราะเป็นจุดที่ "ผิดแล้วโทรหาคนจริงผิดเวลา"
 * — ต้องมีเทสต์คุมทุกเส้น ไม่ใช่ฝังอยู่ใน worker ที่เทสต์ยาก
 */

export type FollowPushRetryConfig = {
  /** ปิดได้ด้วย `FOLLOW_PUSH_RETRY_ENABLED=false` — **ค่าเริ่มต้นคือเปิด** */
  enabled: boolean;
  /** ห่างกันกี่มิลลิวินาทีต่อรอบ */
  intervalMs: number;
  /** รอหลังบูตก่อนเดินรอบแรก */
  startupDelayMs: number;
  /** ส่งซ้ำได้มากสุดกี่รายการต่อรอบ */
  limit: number;
  /**
   * 🔴 **เลยเวลานัดมาแล้วเกินกี่นาที ให้เลิกส่งซ้ำ**
   *
   * สายติดตามถามว่า "ไปทำงานหรือยัง" — โทรช้าไปครึ่งชั่วโมงยังมีความหมาย
   * แต่โทรช้าไปครึ่งวันคือไปกวนเขาเปล่า ๆ · เลยกำหนดแล้วปล่อยให้ป้าย
   * "ส่งไม่ถึง Lumos" ค้างไว้ให้คนตัดสินใจเอง **ห้ามส่งซ้ำไม่จำกัด**
   */
  maxLateMinutes: number;
};

export const FOLLOW_PUSH_RETRY_DEFAULTS: FollowPushRetryConfig = {
  enabled: true,
  intervalMs: 60_000,
  startupDelayMs: 20_000,
  limit: 25,
  maxLateMinutes: 120,
};

function boolEnv(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '') return fallback;
  if (['false', '0', 'off', 'no'].includes(v)) return false;
  if (['true', '1', 'on', 'yes'].includes(v)) return true;
  return fallback;
}

function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const t = (raw ?? '').trim();
  /**
   * 🔴 ต้องเช็คว่างก่อนแปลงเลข — `Number('') === 0` ไม่ใช่ NaN!
   * บั๊กจริง 12 ก.ย. 2569: ไม่ได้ตั้ง env เลยแต่ worker ขึ้น `maxLateMinutes: 0`
   * (ทุกค่ากลายเป็น 0 แล้วถูกบีบลงค่าต่ำสุด) — ตัวส่งซ้ำเลยเลิกส่งทันทีที่เลยเวลานัด
   * ทั้งที่ค่าเริ่มต้นควรเป็น 120 นาที
   */
  if (t === '') return fallback;
  const n = Number(t);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export function readFollowPushRetryConfig(
  env: Record<string, string | undefined>,
): FollowPushRetryConfig {
  const d = FOLLOW_PUSH_RETRY_DEFAULTS;
  return {
    enabled: boolEnv(env.FOLLOW_PUSH_RETRY_ENABLED, d.enabled),
    intervalMs: intEnv(env.FOLLOW_PUSH_RETRY_INTERVAL_MS, d.intervalMs, 10_000, 900_000),
    startupDelayMs: intEnv(env.FOLLOW_PUSH_RETRY_STARTUP_MS, d.startupDelayMs, 0, 600_000),
    limit: intEnv(env.FOLLOW_PUSH_RETRY_LIMIT, d.limit, 1, 200),
    maxLateMinutes: intEnv(env.FOLLOW_PUSH_RETRY_MAX_LATE_MIN, d.maxLateMinutes, 0, 1440),
  };
}

export type FollowPushRetryCandidate = {
  id: string;
  /** เวลานัดของสายนั้น (ISO) — `null` = ไม่ได้ตั้งเวลา */
  scheduledAt: string | null;
};

/**
 * สายนี้ยังควรส่งซ้ำอยู่ไหม
 *
 * ⚠️ **ไม่มีเวลานัด = ส่งซ้ำ** — ไม่รู้ว่าสายไหน ปล่อยให้ถึง Lumos ไว้ก่อนดีกว่าทิ้ง
 * (ฝั่ง push มี `bumpScheduledAtForward` ดันเวลาที่ผ่านมาแล้วไปข้างหน้าให้อยู่แล้ว)
 */
export function shouldRetryFollowPush(
  candidate: FollowPushRetryCandidate,
  cfg: FollowPushRetryConfig,
  now: Date = new Date(),
): boolean {
  if (!candidate.scheduledAt) return true;
  const at = new Date(candidate.scheduledAt).getTime();
  if (Number.isNaN(at)) return true;
  const lateMinutes = (now.getTime() - at) / 60_000;
  // ยังไม่ถึงเวลานัด (lateMinutes ติดลบ) = ส่งซ้ำได้แน่นอน
  return lateMinutes <= cfg.maxLateMinutes;
}
