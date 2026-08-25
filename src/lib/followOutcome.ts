/**
 * ผลปิดงานของรายการติดตาม (migration 095 · ชุดคำใหม่ 101)
 *
 * เจ้าของสั่ง 18 ส.ค. 2569: *"ปุ่มเสร็จสิ้นเมื่อกดแล้วมีให้เลือกว่าเสร็จสิ้นเพราะไปแล้ว
 * ถึงแล้ว หรือ ยกเลิก ลา เลื่อน"* → ชุดที่ให้เลือกตอนนี้คือ 5 คำนี้
 * และเลือกให้ **ใช้ชุดใหม่แทน ของเก่าคงเดิม** (ไม่แปลงข้อมูลย้อนหลัง)
 *
 * 🔴 **แยกสองชุดโดยตั้งใจ**
 * - `FOLLOW_OUTCOMES` = ชุดที่ **หน้าเว็บให้เลือก** (ปุ่มบนลิสต์)
 * - `FOLLOW_OUTCOME_ALL` = ชุดที่ **อ่าน/รับได้** = ใหม่ + เก่า
 *   รายการที่ปิดไปแล้วยังถือรหัสเก่า ต้องมีคำไทยให้โชว์ ไม่งั้นขึ้นเป็นรหัสดิบบนจอ
 *   และ server ต้องรับรหัสเก่าได้ด้วยตอน deploy คาบเกี่ยว (หน้าเว็บเก่าค้างในเบราว์เซอร์คนใช้)
 *
 * ⚠️ ค่าที่นี่ต้องตรงกับ CHECK constraint `follow_entries_outcome_code_check`
 * (migration 101) เป๊ะ ๆ — เพิ่มค่าใหม่ต้องแก้ทั้งสองที่พร้อมกัน ไม่งั้นหน้าเว็บ
 * ส่งค่าที่ฐานไม่รับแล้วได้ 500 (กับดักเดิมของ source/result_scope — เจอมาสองรอบแล้ว)
 * มีเทสต์ parity คุมไว้ที่ `tests/api/followOutcome.test.ts`
 *
 * ⚠️ **คนละเรื่องกับ "ยกเลิก" ที่เป็นปุ่มแยกบนลิสต์** — ปุ่มยกเลิก = ไม่ต้องโทรตามแล้ว
 * (ตัดสายทิ้งก่อนถึงวัน · ไปแตะคิว Lumos) · คำ `cancelled` ที่นี่ = ตามจนจบแล้วและ
 * **งานถูกยกเลิก** · สองอย่างเก็บคนละช่องและนับคนละกอง ห้ามยุบรวม
 */

/** ชุดที่หน้าเว็บให้เลือก — เรียงตามที่เจ้าหน้าที่จะเห็นบนปุ่ม */
export const FOLLOW_OUTCOMES = ['went', 'arrived', 'cancelled', 'leave', 'postponed'] as const;

/** ชุดเก่า (095) — ไม่ให้เลือกใหม่แล้ว แต่ยังต้องอ่านออกและรับได้ */
export const FOLLOW_OUTCOMES_LEGACY = ['done', 'job_cancelled', 'no_show_start', 'other'] as const;

export type FollowOutcome = (typeof FOLLOW_OUTCOMES)[number];
export type FollowOutcomeLegacy = (typeof FOLLOW_OUTCOMES_LEGACY)[number];
export type FollowOutcomeAny = FollowOutcome | FollowOutcomeLegacy;

/** ทุกค่าที่ระบบรับ/อ่านได้ = ใหม่ + เก่า */
export const FOLLOW_OUTCOME_ALL: readonly FollowOutcomeAny[] = [
  ...FOLLOW_OUTCOMES,
  ...FOLLOW_OUTCOMES_LEGACY,
];

export const FOLLOW_OUTCOME_LABEL: Record<FollowOutcomeAny, string> = {
  // ชุดที่ใช้ตอนนี้
  went: 'ไปแล้ว',
  arrived: 'ถึงแล้ว',
  cancelled: 'ยกเลิก',
  leave: 'ลา',
  postponed: 'เลื่อน',
  // ชุดเก่า — โชว์บนรายการที่ปิดไปก่อนหน้านี้
  done: 'เสร็จสิ้น',
  job_cancelled: 'ยกเลิกงาน',
  no_show_start: 'ไม่ไปเริ่มงาน',
  other: 'อื่น ๆ',
};

/** คำอธิบายใต้ปุ่ม — ให้คนกดถูกช่องตั้งแต่ครั้งแรก ไม่ต้องมาแก้ทีหลัง */
export const FOLLOW_OUTCOME_HINT: Record<FollowOutcome, string> = {
  went: 'ไปตามนัดแล้ว (ออกจากบ้าน/เดินทางแล้ว)',
  arrived: 'ถึงหน่วยงานแล้ว เริ่มงานได้',
  cancelled: 'ยกเลิก — ไม่ไปแล้ว/งานถูกยกเลิก',
  leave: 'ลา วันนี้ไม่ไป แต่ยังไม่หลุด',
  postponed: 'เลื่อนไปวันอื่น',
};

/**
 * ผลที่แปลว่า **คนหลุดจากงาน** — ใช้ทำสถิติต้นเหตุ (ML ขั้น 2)
 * ⚠️ `leave` / `postponed` ไม่นับ: ลา/เลื่อนแล้วยังกลับมาได้
 * ⚠️ `other` ไม่นับเพราะไม่รู้ว่าเรื่องอะไร · `went` / `arrived` / `done` คือจบดี
 */
export const FOLLOW_OUTCOME_LOST: readonly FollowOutcomeAny[] = [
  'cancelled',
  'job_cancelled',
  'no_show_start',
];

/** ค่าที่ **ส่งเข้ามาใหม่ได้** — รับทั้งชุดใหม่และชุดเก่า (กัน deploy คาบเกี่ยว) */
export function isFollowOutcome(v: unknown): v is FollowOutcomeAny {
  return typeof v === 'string' && (FOLLOW_OUTCOME_ALL as readonly string[]).includes(v);
}

/** ค่าที่อยู่ในชุดที่หน้าเว็บให้เลือกตอนนี้ (ไม่รวมของเก่า) */
export function isCurrentFollowOutcome(v: unknown): v is FollowOutcome {
  return typeof v === 'string' && (FOLLOW_OUTCOMES as readonly string[]).includes(v);
}

export function isLostOutcome(v: unknown): boolean {
  return isFollowOutcome(v) && (FOLLOW_OUTCOME_LOST as readonly string[]).includes(v);
}

/**
 * ผลที่แปลว่า **ไปจบดี** — ชุดใหม่ `went`/`arrived` + ของเก่า `done`
 *
 * 🔴 **แหล่งเดียวของทั้งระบบ** (เพิ่ม 23 ส.ค. 2569 · Phase 7)
 * เดิมนิยามนี้ถูกเขียนซ้ำสองที่แล้ว**ไม่ตรงกัน**: `followListFilter` รับครบ 3 ค่า
 * แต่ `followRoundBuckets` ช่อง "ไป" เช็คแค่ `'done'` ⇒ **เลขช่อง "ไป" บนแผงรอบ
 * ต่ำกว่าจริง** ทุกครั้งที่ปิดงานด้วยคำใหม่ (ซึ่งคือทุกครั้งตั้งแต่ migration 101)
 * ⚠️ `leave`/`postponed` ไม่นับ (ยังกลับมาได้) · `other` ไม่นับ (ไม่รู้ว่าเรื่องอะไร)
 */
export const FOLLOW_OUTCOME_SUCCESS: readonly FollowOutcomeAny[] = ['went', 'arrived', 'done'];

export function isSuccessOutcome(v: unknown): boolean {
  return isFollowOutcome(v) && (FOLLOW_OUTCOME_SUCCESS as readonly string[]).includes(v);
}

/**
 * ผลที่ต้องบังคับให้ใส่หมายเหตุ — เหลือแค่ของเก่า `other`
 * ชุดใหม่ทั้ง 5 คำชัดในตัวเองอยู่แล้ว (เจ้าของไม่ได้ขอ "อื่น ๆ" ในชุดใหม่)
 * หมายเหตุยังใส่ได้ทุกคำ แค่ไม่บังคับ
 */
export function requiresNote(v: FollowOutcomeAny): boolean {
  return v === 'other';
}
