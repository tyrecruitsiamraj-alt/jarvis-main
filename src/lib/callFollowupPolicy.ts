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
  /**
   * ═══ โทรซ้ำคนไม่รับสายเป็นรอบ (เจ้าของ 27 ต.ค. 2569 แทนรายการเวลาคงที่ของ 26 ต.ค.) ═══
   * > *"กรอกมาตอนไหนก็โทรเลย ถ้าไม่รับก็โทรซ้ำ 3 รอบ ถ้าไม่รับก็บวกไปอีก 2 ชม แล้วโทรใหม่ ไม่รับก็โทรซ้ำ 3 สาย
   * > ถ้าไม่รับอีกก็ไปรอโทรวันถัดไป คนละเวลา"* · Choice: เว้น 10 นาที · เช้าสลับบ่าย · โทรแค่ 08:00–20:00
   * วันละ `roundsPerDay` รอบ · รอบละ `roundCalls` สาย ห่าง `roundGapMinutes` · รอบห่าง `roundsGapHours` ·
   * ครบวัน ⇒ วันถัดไปเริ่ม `dayAfternoon` ถ้าวันนี้เริ่มเช้า (ก่อนเที่ยง) ไม่งั้น `dayMorning` · ทำ `retryDays` วัน
   * `maxAttempts` = roundCalls × roundsPerDay × retryDays (คิดให้ใน normalize — ห้ามตั้งแยก)
   */
  roundCalls: number;
  roundGapMinutes: number;
  roundsPerDay: number;
  roundsGapHours: number;
  retryDays: number;
  /** ช่วงที่ AI โทรสายผู้สมัครได้ (เวลาไทย HH:MM) — นอกช่วงเลื่อนไปต้นช่วงถัดไป ทั้งสายแรกและสายโทรซ้ำ */
  callFrom: string;
  callTo: string;
  /** เวลาเริ่มของวันถัดไป — เช้า/บ่าย สลับกับวันก่อน */
  dayMorning: string;
  dayAfternoon: string;
};

export const DEFAULT_CALL_FOLLOWUP_POLICY: CallFollowupPolicy = {
  maxAttempts: 18,
  retryGapHours: 24,
  rescheduleDefaultHours: 4,
  quietFromHour: 20,
  quietToHour: 8,
  suppressDays: 30,
  roundCalls: 3,
  roundGapMinutes: 10,
  roundsPerDay: 2,
  roundsGapHours: 2,
  retryDays: 3,
  callFrom: '08:00',
  callTo: '20:00',
  dayMorning: '09:00',
  dayAfternoon: '13:00',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** ขอบของแต่ละช่อง (ตัวกรองเดียวทั้งหน้าตั้งค่า + API) */
export const ROUND_LIMITS = {
  roundCalls: [1, 5],
  roundGapMinutes: [10, 120],
  roundsPerDay: [1, 3],
  roundsGapHours: [1, 6],
  retryDays: [1, 5],
} as const;
/** โทรได้สูงสุดกี่ครั้งต่อคน (รวมครั้งแรก) = เพดานของ สายต่อรอบ × รอบต่อวัน × วัน */
export const MAX_CALL_ATTEMPTS = ROUND_LIMITS.roundCalls[1] * ROUND_LIMITS.roundsPerDay[1] * ROUND_LIMITS.retryDays[1];
/** รวมโทรได้กี่ครั้ง — นิยามเดียวของ maxAttempts */
export function totalCallsOf(p: Pick<CallFollowupPolicy, 'roundCalls' | 'roundsPerDay' | 'retryDays'>): number {
  return p.roundCalls * p.roundsPerDay * p.retryDays;
}
const hhmmOr = (v: unknown, fallback: string): string => (typeof v === 'string' && HHMM.test(v.trim()) ? v.trim() : fallback);

/** กันค่าจาก DB/ผู้ใช้เพี้ยน — เกินขอบเขตที่สมเหตุสมผลใช้ค่าเริ่มต้นของช่องนั้น */
export function normalizeCallFollowupPolicy(raw: unknown): CallFollowupPolicy {
  const out = { ...DEFAULT_CALL_FOLLOWUP_POLICY };
  if (typeof raw !== 'object' || raw === null) return out;
  const src = raw as Record<string, unknown>;
  type NumKey = { [K in keyof CallFollowupPolicy]: CallFollowupPolicy[K] extends number ? K : never }[keyof CallFollowupPolicy];
  const num = (key: NumKey, min: number, max: number) => {
    const v = src[key];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[key] = Math.max(min, Math.min(max, Math.round(v)));
    }
  };
  num('retryGapHours', 1, 168);
  num('rescheduleDefaultHours', 1, 72);
  num('quietFromHour', 0, 23);
  num('quietToHour', 0, 23);
  num('suppressDays', 1, 365);
  for (const k of Object.keys(ROUND_LIMITS) as Array<keyof typeof ROUND_LIMITS>) num(k, ROUND_LIMITS[k][0], ROUND_LIMITS[k][1]);
  out.callFrom = hhmmOr(src.callFrom, out.callFrom);
  out.callTo = hhmmOr(src.callTo, out.callTo);
  if (out.callTo <= out.callFrom) {
    out.callFrom = DEFAULT_CALL_FOLLOWUP_POLICY.callFrom;
    out.callTo = DEFAULT_CALL_FOLLOWUP_POLICY.callTo;
  }
  out.dayMorning = hhmmOr(src.dayMorning, out.dayMorning);
  out.dayAfternoon = hhmmOr(src.dayAfternoon, out.dayAfternoon);
  out.maxAttempts = totalCallsOf(out);
  return out;
}

/**
 * ตอบว่า "สนใจ" ใบไหนแล้ว → บังใบอื่นของคนคนนั้นกี่วัน
 *
 * เจ้าของกำหนดกติกาไว้ว่า "รู้แล้วว่าสนใจใบ A → บังใบอื่นจนกว่าใบ A จะจบ"
 * แต่ระบบไม่มีสัญญาณ "ใบ A จบแล้ว" ที่เชื่อถือได้ (การจองอยู่คนละตาราง และ
 * ใบที่เงียบหายไปเฉย ๆ ก็ไม่มีใครมาปิด) — บังแบบไม่มีเพดานจึงแปลว่า
 * **คนที่ตอบว่าสนใจแล้วดีลไม่จบ จะหายออกจากระบบเงียบ ๆ ตลอดไป**
 * ซึ่งแย่กว่าการเสนองานซ้ำ จึงต้องมีเพดานเวลาเสมอ
 *
 * ⚠️ **ตัวเลขนี้เจ้าของยังไม่เคาะ** — 7 วันเป็นค่าที่เสนอไว้ (ยาวพอให้เจ้าหน้าที่
 * ตามดีลจนจบ สั้นพอที่คนจะไม่หายไปทั้งเดือน) แก้ที่นี่ที่เดียว
 */
export const CONFIRMED_FOCUS_DAYS = 7;

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

export const RETRY_LEAD_MINUTES = 10;
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const MIN = 60_000;
const BKK = 7 * 60 * MIN;
/** เวลา HH:MM (ไทย) ของวันเดียวกับ `at` (ไทย) + `dayOffset` วัน */
function bkkDayAt(at: Date, hhmm: string, dayOffset = 0): Date {
  const b = new Date(at.getTime() + BKK);
  const m = minutesOf(hhmm);
  return new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + dayOffset, Math.floor(m / 60), m % 60) - BKK);
}
const bkkMinuteOfDay = (at: Date) => {
  const b = new Date(at.getTime() + BKK);
  return b.getUTCHours() * 60 + b.getUTCMinutes();
};

/** เลื่อนเข้าช่วงที่โทรได้ (`callFrom`–`callTo` เวลาไทย) — ก่อนช่วง = ต้นช่วงวันนั้น · เลยช่วง = ต้นช่วงวันถัดไป */
export function clampToCallWindow(at: Date, policy: CallFollowupPolicy = DEFAULT_CALL_FOLLOWUP_POLICY): Date {
  const m = bkkMinuteOfDay(at);
  if (m < minutesOf(policy.callFrom)) return bkkDayAt(at, policy.callFrom);
  if (m >= minutesOf(policy.callTo)) return bkkDayAt(at, policy.callFrom, 1);
  return at;
}

/**
 * เวลาโทรซ้ำหลังสายที่ `attemptCount` ไม่ติด (นับรวมสายนี้) — ดูหัวข้อใน `CallFollowupPolicy`
 * เช่น 3 สาย/รอบ เว้น 10 นาที · 2 รอบห่าง 2 ชม.: กรอก 09:00 → 09:00 · 09:10 · 09:20 → 11:20 · 11:30 · 11:40 → พรุ่งนี้ 13:00 …
 * ทุกเวลาอยู่ในช่วงโทรได้ (`clampToCallWindow`) และห่างจากตอนนี้อย่างน้อย `RETRY_LEAD_MINUTES`
 */
export function nextRetryAt(now: Date, attemptCount: number, policy: CallFollowupPolicy = DEFAULT_CALL_FOLLOWUP_POLICY): Date {
  const perDay = policy.roundCalls * policy.roundsPerDay;
  const pos = ((Math.max(1, Math.trunc(attemptCount)) - 1) % perDay) + 1;
  let at: Date;
  if (pos % policy.roundCalls !== 0) {
    at = new Date(now.getTime() + policy.roundGapMinutes * MIN);
  } else if (pos < perDay) {
    at = new Date(now.getTime() + policy.roundsGapHours * 60 * MIN);
  } else {
    // ครบวัน — สายแรกของวันนี้ ≈ ตอนนี้ − (ช่วงห่างรอบ + ช่วงห่างในรอบทั้งหมด) · เริ่มเช้า ⇒ พรุ่งนี้บ่าย · ไม่งั้นพรุ่งนี้เช้า
    const spanMin = (policy.roundsPerDay - 1) * policy.roundsGapHours * 60 + policy.roundsPerDay * (policy.roundCalls - 1) * policy.roundGapMinutes;
    const dayStart = new Date(now.getTime() - spanMin * MIN);
    const startedMorning = bkkMinuteOfDay(dayStart) < 12 * 60;
    at = bkkDayAt(now, startedMorning ? policy.dayAfternoon : policy.dayMorning, 1);
  }
  const floor = new Date(now.getTime() + RETRY_LEAD_MINUTES * MIN);
  return clampToCallWindow(at.getTime() < floor.getTime() ? floor : at, policy);
}

/**
 * ได้ผลโทรมาแล้วทำอะไรต่อ
 *
 * `attemptCount` = โทรไปแล้วกี่ครั้งรวมครั้งนี้
 * `requestedCallbackAt` = เวลาที่ผู้สมัครบอกว่าให้โทรกลับ (ถ้ามี)
 * ไม่รับสาย/ไม่ติด ⇒ โทรซ้ำเป็นรอบตามนโยบาย (`nextRetryAt`)
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
      const at = nextRetryAt(now, attemptCount, policy);
      const atBkk = new Date(at.getTime() + 7 * 3_600_000);
      const sameDay = atBkk.getUTCDate() === new Date(now.getTime() + 7 * 3_600_000).getUTCDate();
      const hhmm = `${String(atBkk.getUTCHours()).padStart(2, '0')}:${String(atBkk.getUTCMinutes()).padStart(2, '0')}`;
      return {
        action: 'retry',
        nextAttemptAt: iso(at),
        suppressUntil: null,
        reason: `ยังไม่ติด — โทรซ้ำครั้งที่ ${attemptCount + 1}/${policy.maxAttempts} ${sameDay ? 'วันนี้' : 'พรุ่งนี้'} ${hhmm}`,
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
