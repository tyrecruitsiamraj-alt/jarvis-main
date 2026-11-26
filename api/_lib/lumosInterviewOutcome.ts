/**
 * แปลศัพท์ผลโทรของ **ช่องสัมภาษณ์** ให้เป็นชุดเดียวกับช่องแจ้งเตือน
 *
 * ที่มา: ตรวจ 17 ส.ค. 2569 เจอว่าสองช่องใช้คนละคำสำหรับเรื่องเดียวกัน
 *   - ช่องแจ้งเตือน (reminder) ส่ง `confirmed` = คุยติดและเขาตอบรับ
 *   - ช่องสัมภาษณ์ (interview) ส่ง `completed` = คุยจบครบทุกคำถาม
 * `completed` **ไม่อยู่ใน `CALL_OUTCOMES`** ตัวตามงานจึงเงียบทั้งชุด: ไม่เด้งแจ้งเตือน
 * ให้เจ้าหน้าที่ · ไม่ปิดลูปโทร · ไม่บังใบขออื่น · แท็บ "รายชื่อที่สนใจ" ว่างตลอด
 * (พิสูจน์ด้วยการยิงผลจริง: แจ้งเตือน 0 ครั้ง · ถูกนับเป็น "ตอบสนใจแล้ว" 0 แถว)
 *
 * แปลที่ **ขอบทางเข้า** จุดเดียว (`lumos-interview.ts`) แล้วปลายทางทั้งหมดทำงานต่อได้เอง
 * โดยไม่ต้องรู้ว่าผลมาจากช่องไหน — ดีกว่าไปไล่เติมคำว่า `completed` ทุกที่ที่เทียบ outcome
 *
 * ⚠️ **ผลดิบที่เก็บลง `result` ยังเป็นคำเดิมของ Lumos** — ที่แปลคือค่าที่ส่งต่อให้
 * ตัวตามงาน (`last_outcome`) เท่านั้น หลักฐานว่าเขาส่งอะไรมาจริงต้องไม่ถูกทับ
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/lumosInterviewOutcome.test.ts`
 */
import { isCallOutcome, type CallOutcome } from '../../src/lib/callFollowupPolicy.js';

/**
 * คำของช่องสัมภาษณ์ที่ต้องแปล — คำอื่น (`declined` · `no_answer` · `busy` ·
 * `unresponsive` · `failed` · `wrong_person`) ตรงกับชุดกลางอยู่แล้ว ปล่อยผ่าน
 */
const INTERVIEW_OUTCOME_ALIAS: Record<string, CallOutcome> = {
  completed: 'confirmed',
  /**
   * 26 พ.ย. 2569 — คำที่ Lumos ส่งมาตั้งแต่ 21 ต.ค. แต่เราไม่เคยรับ (ตอบ 400) ดู `VALID_OUTCOMES` ใน `lumos-interview.ts`
   * `rejected` = ปลายทางไม่รับ ดังราว 65 วิแล้วตัด (ended_reason "SIP 487 … Request Terminated (ring 65s)") = ไม่รับสาย
   * `automated_service` = เข้าระบบฝากข้อความ ("กรุณาฝากข้อความหลังจากได้ยินเสียงสัญญาณ") = ไม่ได้คุยกับคน = ไม่รับสาย
   * `reschedule_requested` อยู่ในชุดกลางอยู่แล้ว ปล่อยผ่าน
   */
  rejected: 'no_answer',
  automated_service: 'no_answer',
};

/**
 * คืนคำที่ระบบตามงานรู้จัก · คำที่แปลไม่ได้และไม่อยู่ในชุดกลาง = `null`
 * (ผู้เรียกต้องข้ามการตามงาน ไม่ใช่เดาแทนคน — กติกาเดิมของ `applyCallFollowupToQueueRow`)
 */
export function normalizeInterviewOutcome(outcome: string | null | undefined, result?: unknown): CallOutcome | null {
  const raw = (outcome ?? '').trim();
  if (!raw) return null;
  // ขอคุยกับเจ้าหน้าที่ (27 พ.ย. 2569) — ดู `isStaffCallbackRequest`
  if (raw === 'declined' && isStaffCallbackRequest(result)) return 'confirmed';
  const alias = INTERVIEW_OUTCOME_ALIAS[raw];
  if (alias) return alias;
  return isCallOutcome(raw) ? raw : null;
}

/**
 * ═══ ผู้สมัครขอคุยกับเจ้าหน้าที่ (เจ้าของ Choice 27 พ.ย. 2569 "ขอคุยเจ้าหน้าที่ → ส่งให้คนโทร") ═══
 * Lumos ส่ง outcome `declined` (ไม่คุยกับ AI ต่อ) แต่แนบ `next_action.type = 'callback_requested'`
 * เช่น "ผู้สมัครขอคุยกับเจ้าหน้าที่ ควรให้คนโทรกลับ" · เดิมเราอ่านแค่ outcome ⇒ ปิดเป็นไม่สนใจ + พักเบอร์ 30 วัน
 * ไม่มีใครโทรกลับ (คุณพันธสัญญา OPL6904029 · 24 พ.ย. 2569 · ตลอดมา 47 ราย)
 * ⇒ ตัวตามงานเห็นเป็น `confirmed` (กล่องสนใจ ให้คนโทรต่อ · ไม่พักเบอร์) · ผลดิบใน `result` ยังเป็น `declined` ตามที่ Lumos ส่ง
 * เฉพาะ `declined` — `reschedule_requested` ที่แนบ callback มา AI นัดโทรใหม่เองตามกติกาเดิมอยู่แล้ว
 */
export function isStaffCallbackRequest(result: unknown): boolean {
  if (!result || typeof result !== 'object') return false;
  const next = (result as { next_action?: unknown }).next_action;
  if (!next || typeof next !== 'object') return false;
  return (next as { type?: unknown }).type === 'callback_requested';
}

/** เหตุผลที่ Lumos แนบมากับคำขอโทรกลับ ("ผู้สมัครขอคุยกับเจ้าหน้าที่ ควรให้คนโทรกลับ") · ไม่มี = '' */
export function callbackReasonOf(result: unknown): string {
  if (!isStaffCallbackRequest(result)) return '';
  const reason = ((result as { next_action: { reason?: unknown } }).next_action).reason;
  return typeof reason === 'string' ? reason.trim() : '';
}
