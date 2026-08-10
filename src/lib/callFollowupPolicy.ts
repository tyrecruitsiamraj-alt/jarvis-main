/**
 * นโยบาย "ได้ผลโทรแล้วทำอะไรต่อ" — pure ทั้งไฟล์ ไม่แตะ DB/เวลาจริง
 * ใช้ร่วมกันทั้งฝั่ง API และหน้าเว็บ (แพตเทิร์นเดียวกับ candidatePriority.ts)
 *
 * ที่มา: Lumos ส่งผลกลับมาครบทุกแบบอยู่แล้ว แต่ระบบเอามาแค่โชว์ ไม่มีใครทำอะไรต่อ
 * ไฟล์นี้คือ "สมอง" ที่ตัดสินว่าโทรซ้ำ · นัดใหม่ · ส่งให้คนตาม · หรือจบ
 *
 * เจ้าของกำหนด (6 ส.ค. 2569): โทรซ้ำสูงสุด 3 ครั้ง เว้น 24 ชม. · ขอเลื่อนใช้เวลาที่เขาบอก
 * ไม่บอกใช้ +4 ชม. · ห้ามโทร 20:00–08:00 · "ไม่หางานแล้ว" พักเบอร์ 30 วัน
 */

/** ผลโทรที่รับได้ — ชุดเดียวกับที่ Lumos ส่งกลับ (ดู api/_handlers/lumos-reminder.ts) */
export const CALL_OUTCOMES = [
  'confirmed',
  'acknowledged',
  'declined',
  'reschedule_requested',
  'wrong_person',
  'no_answer',
  'busy',
  'unresponsive',
  'failed',
  'cancelled',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export function isCallOutcome(v: unknown): v is CallOutcome {
  return typeof v === 'string' && (CALL_OUTCOMES as readonly string[]).includes(v);
}

export type CallFollowupPolicy = {
  /** โทรได้สูงสุดกี่ครั้งต่อคนต่อใบขอ (รวมครั้งแรก) */
  maxAttempts: number;
  /** เว้นกี่ชั่วโมงก่อนโทรซ้ำ (กรณีไม่รับสาย) */
  retryGapHours: number;
  /** ขอเลื่อนแต่ไม่บอกเวลา → นัดใหม่อีกกี่ชั่วโมง */
  rescheduleDefaultHours: number;
  /** ช่วงห้ามโทร (ชั่วโมงตามเวลาไทย) — from ถึงเที่ยงคืน และเที่ยงคืนถึง to */
  quietFromHour: number;
  quietToHour: number;
  /** "ไม่หางานแล้ว" พักเบอร์กี่วัน */
  suppressDays: number;
};

export const DEFAULT_CALL_FOLLOWUP_POLICY: CallFollowupPolicy = {
  maxAttempts: 3,
  retryGapHours: 24,
  rescheduleDefaultHours: 4,
  quietFromHour: 20,
  quietToHour: 8,
  suppressDays: 30,
};

/** กันค่าจาก DB/ผู้ใช้เพี้ยน — เกินขอบเขตที่สมเหตุสมผลใช้ค่าเริ่มต้นของช่องนั้น */
export function normalizeCallFollowupPolicy(raw: unknown): CallFollowupPolicy {
  const out = { ...DEFAULT_CALL_FOLLOWUP_POLICY };
  if (typeof raw !== 'object' || raw === null) return out;
  const src = raw as Record<string, unknown>;
  const num = (key: keyof CallFollowupPolicy, min: number, max: number) => {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = Math.max(min, Math.min(max, Math.round(v)));
    }
  };
  num('maxAttempts', 1, 10);
  num('retryGapHours', 1, 168);
  num('rescheduleDefaultHours', 1, 72);
  num('quietFromHour', 0, 23);
  num('quietToHour', 0, 23);
  num('suppressDays', 1, 365);
  return out;
}

/**
 * มุมคนใช้กับมุมนโยบายเป็นเลขชุดเดียวกันแต่กลับด้าน:
 * คนตั้ง "โทรได้ 08:00–20:00" · นโยบายเก็บ "ห้ามโทร 20:00–08:00"
 * (เก็บเป็น quiet เพราะตรรกะ shiftOutOfQuietHours ใช้แบบนั้นและมีเทสต์คุมอยู่แล้ว)
 * from == to = โทรได้ทั้งวัน (ช่วงเงียบว่าง)
 */
export function allowedCallWindow(policy: CallFollowupPolicy): { fromHour: number; toHour: number } {
  return { fromHour: policy.quietToHour, toHour: policy.quietFromHour };
}

export function withAllowedCallWindow(
  policy: CallFollowupPolicy,
  fromHour: number,
  toHour: number,
): CallFollowupPolicy {
  return normalizeCallFollowupPolicy({ ...policy, quietToHour: fromHour, quietFromHour: toHour });
}

export type CallFollowupAction =
  /** นัดโทรซ้ำ — ตั้งคิวกลับเป็น pending พร้อม nextAttemptAt */
  | 'retry'
  /** AI เอาไม่อยู่แล้ว — ตกถัง "ต้องคนตาม" ในหน้า Follow */
  | 'needs_human'
  /** จบเรื่องนี้ (สนใจ / ปฏิเสธงานนี้ / เบอร์ผิด) */
  | 'closed'
  /** จบ + พักเบอร์ ไม่โทรอีกทุกใบขอ */
  | 'suppress';

export type CallFollowupDecision = {
  action: CallFollowupAction;
  /** ISO — มีเมื่อ action = retry */
  nextAttemptAt: string | null;
  /** ISO — มีเมื่อ action = suppress */
  suppressUntil: string | null;
  /** เหตุผลอ่านได้ ใช้โชว์ใน timeline */
  reason: string;
};

/** ชั่วโมงตามเวลาไทยของ Date (ไม่พึ่ง timezone ของเครื่อง) */
function bangkokHour(at: Date): number {
  // +07:00 คงที่ ไทยไม่มี DST
  return (at.getUTCHours() + 7) % 24;
}

/**
 * เลื่อนเวลาออกจากช่วงห้ามโทร — ถ้าตกในช่วงเงียบ ให้ไปเป็นเวลาเปิด (quietToHour) ของรอบถัดไป
 * ป้องกันไม่ให้ AI โทรตอนตี 2 เพราะเลข 24 ชม. ไปตกตรงนั้นพอดี
 */
export function shiftOutOfQuietHours(at: Date, policy: CallFollowupPolicy): Date {
  const { quietFromHour, quietToHour } = policy;
  // ช่วงเงียบว่าง (from == to) = ไม่กันเวลา
  if (quietFromHour === quietToHour) return at;

  const inQuiet = (h: number) =>
    quietFromHour > quietToHour
      ? h >= quietFromHour || h < quietToHour // คร่อมเที่ยงคืน เช่น 20 → 8
      : h >= quietFromHour && h < quietToHour;

  let out = new Date(at.getTime());
  // เลื่อนไปข้างหน้าทีละชั่วโมงจนพ้นช่วงเงียบ (สูงสุด 24 รอบ กันวนไม่จบ)
  for (let i = 0; i < 24 && inQuiet(bangkokHour(out)); i += 1) {
    out = new Date(out.getTime() + 60 * 60 * 1000);
  }
  // ตัดให้ลงตัวที่ต้นชั่วโมง — อ่านง่ายและไม่ได้ต้องการความละเอียดระดับนาที
  out.setUTCMinutes(0, 0, 0);
  return out;
}

/**
 * ได้ผลโทรมาแล้วทำอะไรต่อ
 *
 * `attemptCount` = โทรไปแล้วกี่ครั้งรวมครั้งนี้
 * `requestedCallbackAt` = เวลาที่ผู้สมัครบอกว่าให้โทรกลับ (ถ้ามี)
 */
export function resolveCallFollowup(input: {
  outcome: CallOutcome;
  attemptCount: number;
  now: Date;
  requestedCallbackAt?: string | null;
  /** ไม่สนใจงานนี้ (job) หรือไม่หางานแล้ว (all) — ใช้เฉพาะ outcome = declined */
  declinedScope?: 'job' | 'all' | null;
  policy?: CallFollowupPolicy;
}): CallFollowupDecision {
  const policy = input.policy ?? DEFAULT_CALL_FOLLOWUP_POLICY;
  const { outcome, attemptCount, now } = input;

  const iso = (d: Date) => d.toISOString();
  const plusHours = (h: number) => new Date(now.getTime() + h * 60 * 60 * 1000);

  switch (outcome) {
    // ── คุยติดและได้คำตอบ → จบเรื่องนี้ ────────────────────────────────────
    case 'confirmed':
    case 'acknowledged':
      return {
        action: 'closed',
        nextAttemptAt: null,
        suppressUntil: null,
        reason: 'ผู้สมัครรับทราบ/สนใจ — ส่งต่อให้เจ้าหน้าที่ดำเนินการ',
      };

    case 'declined':
      // ไม่หางานแล้ว = พักเบอร์ ไม่โทรอีกทุกใบขอ · ไม่เอางานนี้ = จบแค่ใบนี้
      if (input.declinedScope === 'all') {
        return {
          action: 'suppress',
          nextAttemptAt: null,
          suppressUntil: iso(new Date(now.getTime() + policy.suppressDays * 24 * 60 * 60 * 1000)),
          reason: `ไม่หางานแล้ว — พักเบอร์ ${policy.suppressDays} วัน ไม่โทรอีกทุกใบขอ`,
        };
      }
      return {
        action: 'closed',
        nextAttemptAt: null,
        suppressUntil: null,
        reason: 'ไม่สนใจงานนี้ — ใบขออื่นยังเสนอได้',
      };

    // เบอร์ผิด/คนผิด: โทรซ้ำไปก็เจอคนเดิม ต้องคนไปหาเบอร์ใหม่
    case 'wrong_person':
      return {
        action: 'needs_human',
        nextAttemptAt: null,
        suppressUntil: null,
        reason: 'เบอร์ผิด/ไม่ใช่เจ้าตัว — ต้องให้คนหาเบอร์ใหม่',
      };

    // ── ขอเลื่อน → นัดใหม่ตามเวลาที่เขาบอก ────────────────────────────────
    case 'reschedule_requested': {
      if (attemptCount >= policy.maxAttempts) {
        return {
          action: 'needs_human',
          nextAttemptAt: null,
          suppressUntil: null,
          reason: `ขอเลื่อนครบ ${policy.maxAttempts} ครั้งแล้ว — ให้คนโทรปิดเอง`,
        };
      }
      const asked = input.requestedCallbackAt ? new Date(input.requestedCallbackAt) : null;
      const valid = asked && !Number.isNaN(asked.getTime()) && asked.getTime() > now.getTime();
      const base = valid ? (asked as Date) : plusHours(policy.rescheduleDefaultHours);
      return {
        action: 'retry',
        nextAttemptAt: iso(shiftOutOfQuietHours(base, policy)),
        suppressUntil: null,
        reason: valid
          ? 'ผู้สมัครขอให้โทรกลับตามเวลาที่นัด'
          : `ขอเลื่อนแต่ไม่ระบุเวลา — นัดใหม่อีก ${policy.rescheduleDefaultHours} ชม.`,
      };
    }

    // ── ไม่รับสาย/สายไม่ว่าง/โทรไม่สำเร็จ → โทรซ้ำจนครบเพดาน ──────────────
    case 'no_answer':
    case 'busy':
    case 'unresponsive':
    case 'failed': {
      if (attemptCount >= policy.maxAttempts) {
        return {
          action: 'needs_human',
          nextAttemptAt: null,
          suppressUntil: null,
          reason: `โทรครบ ${policy.maxAttempts} ครั้งแล้วยังไม่ติด — ต้องให้คนตาม`,
        };
      }
      return {
        action: 'retry',
        nextAttemptAt: iso(shiftOutOfQuietHours(plusHours(policy.retryGapHours), policy)),
        suppressUntil: null,
        reason: `ยังไม่ติด — โทรซ้ำครั้งที่ ${attemptCount + 1}/${policy.maxAttempts} อีก ${policy.retryGapHours} ชม.`,
      };
    }

    // ยกเลิกโดยคน → ไม่ต้องตามต่อ
    case 'cancelled':
      return {
        action: 'closed',
        nextAttemptAt: null,
        suppressUntil: null,
        reason: 'ถูกยกเลิก',
      };
  }
}

/** ป้ายภาษาไทยของสถานะการตามงาน — ใช้ในหน้า Follow */
export const FOLLOWUP_STATE_LABEL = {
  retry_scheduled: 'นัดโทรซ้ำแล้ว',
  needs_human: 'ต้องคนตาม',
  closed: 'จบแล้ว',
} as const;

export type FollowupState = keyof typeof FOLLOWUP_STATE_LABEL;
