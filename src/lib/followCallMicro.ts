/**
 * ═══ ผลโทรละเอียดของ **งานติดตาม** — หน้ากากบางของเครื่องยนต์กลาง ═══
 *
 * เจ้าของสั่ง 13 ก.ย. 2569: *"อยากรู้แบบ micro รับสายเท่าไหร่ ไม่รับเท่าไหร่ รับแล้ววาง
 * รับแล้วคุยแต่ไป รับแล้วคุยแต่ไม่ไป อยากรู้ละเอียดระดับนั้น เพื่อทำ Success Rate"*
 * แล้ว 15 ก.ย. 2569: *"ทำไว้สำหรับการโทรอันอื่น ๆ ในอนาคตด้วยนะ"*
 *
 * ⇒ **ตรรกะการอ่านคำย้ายไป `callMicroOutcome.ts`** (เครื่องยนต์ + คลังคำของแต่ละงาน)
 * ไฟล์นี้เหลือหน้าที่เดียว: แปลชื่อถังกลางเป็น **คำของงานติดตาม** ให้จอเดิมใช้ต่อได้
 *
 * | ถังกลาง | คำของงานติดตาม |
 * | --- | --- |
 * | `said_yes` | `said_going` — บอกว่าไป |
 * | `said_no` | `said_not_going` — บอกว่าไม่ไป |
 * | `not_yet` | `getting_ready` — ยังเตรียมตัวอยู่ |
 *
 * 🔴 **ห้ามเขียนกติกาการอ่านคำซ้ำที่นี่** — สองที่เพี้ยนกันเมื่อไหร่ = สองจอเถียงกันเอง
 */
import type { ToneKey } from '@/lib/designTokens';
import {
  addCallMicro,
  callMicroRates,
  classifyCallMicro,
  emptyCallMicroSummary,
  FOLLOW_VOCAB,
  type CallMicroInput,
  type CallMicroOutcome,
} from '@/lib/callMicroOutcome';

export { stripQuestionClauses } from '@/lib/callMicroOutcome';

export type FollowMicroOutcome =
  /** ไม่มีใครรับสาย */
  | 'no_pickup'
  /** รับแล้ว แต่ไม่ใช่เจ้าตัว */
  | 'wrong_person'
  /** รับแล้วเงียบหรือวางไปเลย */
  | 'picked_silent'
  /** คุยแล้ว บอกว่าไป */
  | 'said_going'
  /** คุยแล้ว บอกว่าไม่ไป */
  | 'said_not_going'
  /** คุยแล้ว ยังเตรียมตัวอยู่ที่บ้าน */
  | 'getting_ready'
  /** คุยแล้ว แต่ไม่บอกว่าไปหรือไม่ไป — ต้องคนอ่านเอง */
  | 'talked_unclear';

/** ถังกลาง → ถังของงานติดตาม (ที่เดียวที่แปลชื่อ) */
const FROM_CORE: Record<CallMicroOutcome, FollowMicroOutcome> = {
  no_pickup: 'no_pickup',
  wrong_person: 'wrong_person',
  picked_silent: 'picked_silent',
  said_yes: 'said_going',
  said_no: 'said_not_going',
  not_yet: 'getting_ready',
  talked_unclear: 'talked_unclear',
};

export const FOLLOW_MICRO_LABEL: Record<FollowMicroOutcome, string> = {
  no_pickup: 'ไม่รับสาย',
  wrong_person: 'ไม่ใช่เจ้าตัว',
  picked_silent: 'รับแล้วเงียบ/วางสาย',
  said_going: 'คุยแล้ว บอกว่าไป',
  said_not_going: 'คุยแล้ว บอกว่าไม่ไป',
  getting_ready: 'คุยแล้ว ยังเตรียมตัวอยู่',
  talked_unclear: 'คุยแล้ว แต่ไม่บอกว่าไปหรือไม่ไป',
};

/**
 * โทนสีของแต่ละถัง — **พูดภาษาเดียวกับสีที่ใช้อยู่ทั้งระบบ**
 * เขียว = จบดี · แดง = จบไม่ดี · เหลือง = ยังไม่จบ ต้องตามต่อ · ส้ม = คนต้องเข้าไปจัดการ
 * (กติกาเดียวกับ `CALL_OUTCOME_TONE` — ห้ามตั้งสีใหม่ให้เรื่องเดิม)
 */
export const FOLLOW_MICRO_TONE: Record<FollowMicroOutcome, ToneKey> = {
  no_pickup: 'warn',
  wrong_person: 'orange',
  picked_silent: 'neutral',
  said_going: 'success',
  said_not_going: 'danger',
  getting_ready: 'warn',
  talked_unclear: 'neutral',
};

/** คำอธิบายใต้ป้าย — ถังพวกนี้ชื่อใกล้กัน คนใหม่ต้องมีคำช่วยแยก */
export const FOLLOW_MICRO_HINT: Record<FollowMicroOutcome, string> = {
  no_pickup: 'AI โทรแล้วไม่มีใครรับ — ยังไม่ได้คุยกับใครเลย',
  wrong_person: 'มีคนรับ แต่บอกว่าไม่ใช่คนที่เราตามหา — เบอร์ผิดหรือคนละคน',
  picked_silent: 'รับสายแต่ไม่ตอบคำถาม หรือวางไปก่อน — ยังไม่รู้คำตอบ',
  said_going: 'ตอบว่าไป/กำลังเดินทาง/ถึงแล้ว',
  said_not_going: 'ตอบว่าไม่ไป/ยังไม่ได้ไป/ยกเลิก — ต้องหาคนแทนทันที',
  getting_ready: 'ยังอยู่บ้าน กำลังเตรียมตัว — ยังไม่ออกเดินทาง ควรตามซ้ำ',
  talked_unclear: 'คุยกันแล้วแต่คำตอบไม่ชัด — ต้องกดอ่านคำที่เขาพูดเอง',
};

export type FollowMicroInput = CallMicroInput;

/** จัดถังหนึ่งสายด้วยคลังคำของงานติดตาม — `null` = ยังไม่มีผล/ยกเลิก (ห้ามเอาไปหาร) */
export function classifyFollowCall(input: FollowMicroInput): FollowMicroOutcome | null {
  const core = classifyCallMicro(input, FOLLOW_VOCAB);
  return core ? FROM_CORE[core] : null;
}

export type FollowMicroSummary = Record<FollowMicroOutcome, number> & {
  /** สายที่มีผลกลับแล้วทั้งหมด (ไม่รวมยกเลิก/ยังไม่มีผล) */
  withResult: number;
  /** มีคนรับ — ทุกถังยกเว้นไม่รับสาย */
  pickedUp: number;
  /** ได้คุยเรื่องของเราจริง — ไม่รวมไม่รับ · ไม่ใช่เจ้าตัว · รับแล้วเงียบ */
  talked: number;
};

export function summarizeFollowMicro(calls: readonly FollowMicroInput[]): FollowMicroSummary {
  const core = emptyCallMicroSummary();
  for (const c of calls) addCallMicro(core, classifyCallMicro(c, FOLLOW_VOCAB));
  return {
    no_pickup: core.no_pickup,
    wrong_person: core.wrong_person,
    picked_silent: core.picked_silent,
    said_going: core.said_yes,
    said_not_going: core.said_no,
    getting_ready: core.not_yet,
    talked_unclear: core.talked_unclear,
    withResult: core.withResult,
    pickedUp: core.pickedUp,
    talked: core.talked,
  };
}

export type FollowMicroRates = {
  reachRate: number | null;
  talkRate: number | null;
  successRate: number | null;
};

/**
 * 🔴 ฐานของสามอัตราไม่เหมือนกัน — ต้องเขียนฐานกำกับข้างตัวเลขบนจอทุกตัว
 * นิยามอยู่ที่ `callMicroOutcome.callMicroRates` **ที่เดียว**
 */
export function followMicroRates(s: FollowMicroSummary): FollowMicroRates {
  return callMicroRates({
    no_pickup: s.no_pickup,
    wrong_person: s.wrong_person,
    picked_silent: s.picked_silent,
    said_yes: s.said_going,
    said_no: s.said_not_going,
    not_yet: s.getting_ready,
    talked_unclear: s.talked_unclear,
    withResult: s.withResult,
    pickedUp: s.pickedUp,
    talked: s.talked,
  });
}
