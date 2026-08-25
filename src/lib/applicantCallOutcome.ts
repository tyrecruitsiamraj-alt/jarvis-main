import { CALL_OUTCOMES, type CallOutcome } from '@/lib/callFollowupPolicy';

/**
 * "ใบสมัครใบไหนนับว่า **สนใจ**" — กติกาเดียวของทั้งระบบ
 *
 * เจ้าของเคาะ 13 ส.ค. 2569: แท็บ "รายชื่อที่สนใจ" ในกล่องงาน = **คนที่ตอบ "สนใจ" ตอนโทร**
 * (ไม่ใช่สถานะใบสมัคร ซึ่งมีแค่ ใหม่/ติดต่อแล้ว/รับเข้าทำงาน/ปฏิเสธ — ไม่มีคำว่าสนใจ)
 *
 * ⚠️ ผลโทรมาได้ 2 ทางและต้องนับรวมกัน: AI (คิว Lumos) กับ คน (ล็อกโทรแล้วบันทึกผล)
 * ทั้งสองใช้ศัพท์ outcome ชุดเดียวกันอยู่แล้ว จึงเทียบตรง ๆ ได้
 */

/** ผลที่แปลว่า "เอางานนี้" — ชุดเดียวกับที่ callFollowupPolicy ถือว่าปิดเรื่องแบบดี */
const INTERESTED: readonly CallOutcome[] = ['confirmed'];

/**
 * ผลที่แปลว่า **ไม่สนใจ** (เจ้าของสั่ง 20 ส.ค. 2569: *"เมื่อ Lumos โทรแล้วให้เอาคนที่สนใจ
 * ไม่สนใจ ไปแยกตามกล่อง"*) — นับเฉพาะคำตอบปฏิเสธชัด ๆ:
 *   declined = บอกไม่เอา · wrong_person = เบอร์ไม่ใช่คนนี้ (ตามไม่ได้แล้ว)
 * ⚠️ no_answer/busy/unresponsive **ไม่ใช่ไม่สนใจ** — แค่ยังติดต่อไม่ได้ ต้องตามต่อ
 */
const NOT_INTERESTED: readonly CallOutcome[] = ['declined', 'wrong_person'];

export type ApplicantCallInfo = {
  /** ผลโทรล่าสุดของเบอร์นี้ (จาก AI หรือคน แล้วแต่ว่าอันไหนใหม่กว่า) */
  outcome: string | null;
  /** เวลาที่ได้ผลนั้น (ISO) */
  at: string | null;
};

/** ผลโทรนี้แปลว่าสนใจงานไหม — ค่าที่ไม่รู้จัก/ว่าง = ไม่ใช่ (ไม่เดาแทนคน) */
export function isInterestedOutcome(outcome: string | null | undefined): boolean {
  if (!outcome) return false;
  return (INTERESTED as readonly string[]).includes(outcome);
}

/** ผลโทรนี้แปลว่าไม่สนใจไหม — ค่าที่ไม่รู้จัก/ว่าง = ไม่ใช่ (ไม่เดาแทนคน) */
export function isNotInterestedOutcome(outcome: string | null | undefined): boolean {
  if (!outcome) return false;
  return (NOT_INTERESTED as readonly string[]).includes(outcome);
}

/**
 * ⚠️ ค่าที่ไม่ใช่ outcome จริงต้องไม่ถูกนับเป็นอะไรทั้งนั้น — ข้อมูลเก่าเคยมี `completed`
 * หลุดมาในคอลัมน์นี้ (เจอจริงตอนทำ funnel หน้า Follow)
 */
export function isKnownOutcome(outcome: string | null | undefined): outcome is CallOutcome {
  return !!outcome && (CALL_OUTCOMES as readonly string[]).includes(outcome);
}

/**
 * สัญญาณที่ตัดสิน "สนใจ / ไม่สนใจ" ต่อใบ — มาได้ **สองทาง** ที่ต้องเทียบเวลากัน:
 *   ① ผลโทร (AI ในคิว / คนบันทึกผลบนล็อก) → `last_call_outcome` + `last_call_at`
 *   ② บันทึกผลติดต่อของเจ้าหน้าที่ (contact log 086) → `last_contact_ok` + `last_contact_at`
 *
 * 🔴 เจ้าของสั่ง 23 ส.ค. 2569 (Phase 5.11): **ผลติดต่อ `ok=false` นับเป็น "ไม่สนใจ"**
 * เดิมมุมมองรายชื่ออ่านแค่ทาง ① → คนที่เจ้าหน้าที่กดว่า "ติดต่อไม่สำเร็จ" หล่นอยู่ใน
 * "ทั้งหมด" เฉย ๆ ไม่เข้าถังไหน แล้วก็ถูกไล่โทรซ้ำวนไปเรื่อย
 *
 * ⚠️ **อันที่ใหม่กว่าชนะ** (แพตเทิร์นเดียวกับ `LATEST_CLASS_SQL` ฝั่ง dashboard) —
 * ปฏิเสธเมื่อวานแล้ววันนี้โทรติดว่าเอางาน ต้องอ่านว่าสนใจ ไม่ใช่ค้างเป็นไม่สนใจตลอดไป
 */
export type ApplicantInterestSignals = {
  last_call_outcome?: string | null;
  last_call_at?: string | null;
  /** ผลติดต่อล่าสุดที่เจ้าหน้าที่บันทึก (086) — false = ติดต่อไม่สำเร็จ/ไม่เอางาน */
  last_contact_ok?: boolean | null;
  last_contact_at?: string | null;
};

/** เวลาของสัญญาณ (ms) — อ่านไม่ได้/ไม่มี = -1 (แพ้ทุกอย่างที่มีเวลาจริง) */
function stamp(iso: string | null | undefined): number {
  if (!iso) return -1;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -1 : t;
}

/** สัญญาณไหนใหม่กว่า — 'contact' | 'call' | null (ไม่มีทั้งคู่) */
function newerSignal(a: ApplicantInterestSignals): 'contact' | 'call' | null {
  const hasContact = typeof a.last_contact_ok === 'boolean';
  const hasCall = Boolean(a.last_call_outcome);
  if (!hasContact && !hasCall) return null;
  if (hasContact && !hasCall) return 'contact';
  if (!hasContact && hasCall) return 'call';
  // มีทั้งคู่ — เทียบเวลา · เสมอ/ไม่มีเวลา ให้ contact log ชนะ (บันทึกเจาะจงใบนี้ตรง ๆ)
  return stamp(a.last_call_at) > stamp(a.last_contact_at) ? 'call' : 'contact';
}

/** ใบนี้อ่านว่า "สนใจ" ไหม — สัญญาณล่าสุดต้องเป็นผลโทรที่ตอบว่าเอางาน */
export function isInterestedApplicant(a: ApplicantInterestSignals): boolean {
  return newerSignal(a) === 'call' && isInterestedOutcome(a.last_call_outcome);
}

/** ใบนี้อ่านว่า "ไม่สนใจ" ไหม — ปฏิเสธตอนโทร **หรือ** ผลติดต่อล่าสุด ok=false */
export function isNotInterestedApplicant(a: ApplicantInterestSignals): boolean {
  const s = newerSignal(a);
  if (s === 'contact') return a.last_contact_ok === false;
  if (s === 'call') return isNotInterestedOutcome(a.last_call_outcome);
  return false;
}

/**
 * แยกใบสมัครเป็น "ทั้งหมด / สนใจ / ไม่สนใจ" ด้วยสัญญาณที่แนบมากับแต่ละใบ
 * ⚠️ สนใจ+ไม่สนใจ ≠ ทั้งหมด — คนที่ยังไม่ถูกโทร/ยังติดต่อไม่ได้อยู่แค่ใน "ทั้งหมด"
 */
export function splitInterested<T extends ApplicantInterestSignals>(
  items: T[],
): { all: T[]; interested: T[]; notInterested: T[] } {
  return {
    all: items,
    interested: items.filter(isInterestedApplicant),
    notInterested: items.filter(isNotInterestedApplicant),
  };
}
