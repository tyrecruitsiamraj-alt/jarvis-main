/**
 * ═══ กติกาตัวส่งซ้ำ "สายที่ส่งไม่ถึง Lumos" — ใบสมัคร + เลน Match (เจ้าของเคาะ 28 ก.ย. 2569) ═══
 *
 * ที่มา: ใบสมัคร 3 ใบค้าง 2–4 วันเพราะ push ตอนกรอกล้มครั้งเดียว และ **Lumos ไม่มาดึงคิวเองแล้ว**
 * → Choice ที่เจ้าของเลือก: *"ตัวส่งซ้ำแบบงานติดตาม — จดว่าส่งไม่ถึง แล้วลองใหม่ทุกนาทีจนถึง (รหัสเดิม
 * ไม่เกิดสายซ้อน) · เกิน 24 ชม. ยังไม่ถึง = เลิกส่ง AI แล้วขึ้นให้เจ้าหน้าที่โทรเอง"* · เลน Match: *"ถ้าอันไหนให้ส่ง
 * ก็ส่งไปเลยแล้วก็เข้าคิวโทร"* · ช่วงห้ามโทร: เจ้าของ **ยกเลิกทั้งระบบ** (migration 125) — โค้ดยังอ่านนโยบายกลางเสมอ
 * ตั้งช่วงห้ามโทรกลับเมื่อไหร่ ตัวส่งซ้ำก็เคารพทันที
 *
 * แยกเป็นไฟล์เปล่า ๆ เพราะเป็นจุดที่ "ผิดแล้วโทรหาคนจริงผิดเวลา" — มีเทสต์คุมทุกเส้น
 * 🔴 ช่วงห้ามโทรใช้นโยบายกลาง (`shiftOutOfQuietHours` · ตั้งค่าได้ที่หน้าตั้งค่า) ไม่ตั้งเลขเอง
 */
import { shiftOutOfQuietHours, type CallFollowupPolicy } from './callFollowupPolicy';

export type LumosPushRetryConfig = {
  /** ปิดได้ด้วย `LUMOS_PUSH_RETRY_ENABLED=false` — **ค่าเริ่มต้นคือเปิด** (ทำสิ่งที่ระบบสั่งไว้แล้วให้สำเร็จ) */
  enabled: boolean;
  intervalMs: number;
  startupDelayMs: number;
  /** ส่งซ้ำได้มากสุดกี่แถวต่อรอบ */
  limit: number;
  /** 🔴 ส่งไม่ถึงเกินกี่นาทีนับจากเวลาที่ควรโทร ⇒ เลิกส่ง AI แล้วโยนให้เจ้าหน้าที่ (เจ้าของ: 24 ชม.) */
  giveUpAfterMinutes: number;
  /** ยิงล่วงหน้าได้กี่นาทีก่อนเวลานัด (นัดไว้ 09:00 ⇒ ยิงได้ตั้งแต่ 08:00) */
  leadMinutes: number;
  /** กำลังส่ง (push_pending) ค้างเกินกี่นาที = ถือว่าล้ม (เครื่องรีสตาร์ตกลางทาง) */
  stalePendingMinutes: number;
};

export const LUMOS_PUSH_RETRY_DEFAULTS: LumosPushRetryConfig = {
  enabled: true,
  intervalMs: 60_000,
  startupDelayMs: 25_000,
  limit: 25,
  giveUpAfterMinutes: 24 * 60,
  leadMinutes: 60,
  stalePendingMinutes: 10,
};

/** นัดเวลาโทรของรอบส่งซ้ำ อย่างน้อยกี่นาทีจากตอนยิง — ตัวเดียวกับ `bumpScheduledAtForward` (Lumos ปัดทิ้งเวลาที่เป็นอดีต) */
export const RETRY_SCHEDULE_FLOOR_MINUTES = 10;

function boolEnv(raw: string | undefined, fallback: boolean): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === '') return fallback;
  if (['false', '0', 'off', 'no'].includes(v)) return false;
  if (['true', '1', 'on', 'yes'].includes(v)) return true;
  return fallback;
}

/** 🔴 เช็คว่างก่อนแปลงเลข — `Number('') === 0` (บั๊กจริงของ followPushRetryPolicy 12 ก.ย. 2569) */
function intEnv(raw: string | undefined, fallback: number, min: number, max: number): number {
  const t = (raw ?? '').trim();
  if (t === '') return fallback;
  const n = Number(t);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export function readLumosPushRetryConfig(env: Record<string, string | undefined>): LumosPushRetryConfig {
  const d = LUMOS_PUSH_RETRY_DEFAULTS;
  return {
    enabled: boolEnv(env.LUMOS_PUSH_RETRY_ENABLED, d.enabled),
    intervalMs: intEnv(env.LUMOS_PUSH_RETRY_INTERVAL_MS, d.intervalMs, 10_000, 900_000),
    startupDelayMs: intEnv(env.LUMOS_PUSH_RETRY_STARTUP_MS, d.startupDelayMs, 0, 600_000),
    limit: intEnv(env.LUMOS_PUSH_RETRY_LIMIT, d.limit, 1, 200),
    giveUpAfterMinutes: intEnv(env.LUMOS_PUSH_RETRY_GIVE_UP_MIN, d.giveUpAfterMinutes, 60, 7 * 24 * 60),
    leadMinutes: intEnv(env.LUMOS_PUSH_RETRY_LEAD_MIN, d.leadMinutes, 0, 240),
    stalePendingMinutes: intEnv(env.LUMOS_PUSH_RETRY_STALE_MIN, d.stalePendingMinutes, 2, 120),
  };
}

/** เวลานี้อยู่ในช่วงห้ามโทรไหม — ตัดสินด้วยตัวกลาง (เลื่อนแล้วได้เวลาที่ช้ากว่า = อยู่ในช่วงห้าม) */
export function isQuietAt(at: Date, policy: CallFollowupPolicy): boolean {
  return shiftOutOfQuietHours(at, policy).getTime() > at.getTime();
}

/**
 * นัดเวลาโทรของรอบส่งซ้ำ — ช้าสุดระหว่าง "เวลานัดเดิม" กับ "อีก 10 นาที" แล้วเลื่อนให้พ้นช่วงห้ามโทร
 * (นัด 09:00 ไว้ ⇒ 09:00 · ยิงตอน 14:00 โดยไม่มีนัด ⇒ 14:10 · ได้ 19:55 ⇒ ยังไม่เข้าช่วงห้าม ใช้ได้)
 */
export function retryScheduledAt(dueAt: Date | null, now: Date, policy: CallFollowupPolicy): Date {
  const floor = new Date(now.getTime() + RETRY_SCHEDULE_FLOOR_MINUTES * 60_000);
  const base = dueAt && dueAt.getTime() > floor.getTime() ? dueAt : floor;
  return isQuietAt(base, policy) ? shiftOutOfQuietHours(base, policy) : base;
}

export type LumosPushRetryDecision =
  | { action: 'push'; scheduledAt: Date }
  | { action: 'wait'; reason: 'quiet_hours' | 'not_due_yet' }
  | { action: 'give_up' };

/**
 * แถวนี้รอบนี้ทำอะไร — `dueAt` = เวลาที่สายนี้ควรโทร (`next_attempt_at` → เวลาเข้าคิว)
 *
 * 1. ส่งไม่ถึงเกินเพดานนับจากเวลาที่ควรโทร ⇒ เลิก (โยนให้เจ้าหน้าที่) — เช็คก่อนทุกอย่าง
 * 2. ตอนนี้อยู่ในช่วงห้ามโทร (ถ้านโยบายมีช่วงห้าม) ⇒ รอ (**ไม่ยิงเลย** — ต่อให้ Lumos ไม่เคารพเวลานัด ก็ไม่มีสายในช่วงห้ามจากตัวนี้)
 * 3. ยังไกลจากเวลานัดเกินช่วงยิงล่วงหน้า ⇒ รอ
 * 4. นอกนั้นยิง พร้อมเวลานัดที่พ้นช่วงห้ามโทรแล้ว
 */
export function decideLumosPushRetry(
  dueAt: Date,
  cfg: LumosPushRetryConfig,
  policy: CallFollowupPolicy,
  now: Date = new Date(),
): LumosPushRetryDecision {
  const lateMinutes = (now.getTime() - dueAt.getTime()) / 60_000;
  if (lateMinutes > cfg.giveUpAfterMinutes) return { action: 'give_up' };
  if (isQuietAt(now, policy)) return { action: 'wait', reason: 'quiet_hours' };
  if (dueAt.getTime() - now.getTime() > cfg.leadMinutes * 60_000) return { action: 'wait', reason: 'not_due_yet' };
  return { action: 'push', scheduledAt: retryScheduledAt(dueAt, now, policy) };
}
