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
 * แยกใบสมัครเป็น "ทั้งหมด / สนใจ / ไม่สนใจ" ด้วยผลโทรที่แนบมากับแต่ละใบ
 * ⚠️ สนใจ+ไม่สนใจ ≠ ทั้งหมด — คนที่ยังไม่ถูกโทร/ยังติดต่อไม่ได้อยู่แค่ใน "ทั้งหมด"
 */
export function splitInterested<T extends { last_call_outcome?: string | null }>(
  items: T[],
): { all: T[]; interested: T[]; notInterested: T[] } {
  return {
    all: items,
    interested: items.filter((a) => isInterestedOutcome(a.last_call_outcome)),
    notInterested: items.filter((a) => isNotInterestedOutcome(a.last_call_outcome)),
  };
}
