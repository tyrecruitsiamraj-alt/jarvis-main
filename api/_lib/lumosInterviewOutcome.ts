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
};

/**
 * คืนคำที่ระบบตามงานรู้จัก · คำที่แปลไม่ได้และไม่อยู่ในชุดกลาง = `null`
 * (ผู้เรียกต้องข้ามการตามงาน ไม่ใช่เดาแทนคน — กติกาเดิมของ `applyCallFollowupToQueueRow`)
 */
export function normalizeInterviewOutcome(outcome: string | null | undefined): CallOutcome | null {
  const raw = (outcome ?? '').trim();
  if (!raw) return null;
  const alias = INTERVIEW_OUTCOME_ALIAS[raw];
  if (alias) return alias;
  return isCallOutcome(raw) ? raw : null;
}
