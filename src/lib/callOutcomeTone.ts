import type { ToneKey } from '@/lib/designTokens';
import type { CallOutcome } from '@/lib/callFollowupPolicy';

/**
 * โทนสีของ "ผลโทร" — แหล่งเดียวของทั้งระบบ (กติกาเดียวกับ PROPOSAL_STATUS_TONE ฯลฯ:
 * สีของสถานะประกาศที่ lib เดียว ห้ามทำตารางสีในไฟล์หน้า)
 *
 * เดิมแต่ละหน้าประกาศ map ของตัวเอง 4 ที่ แล้วเพี้ยนกันจริง:
 * "ไม่รับสาย" เป็นสีเทาใน funnel/งานโทร แต่เป็นเหลืองบนหน้าหลัก/การ์ด Matching
 * เจ้าของกวาดเจอเอง (10 ส.ค. 2569) — เห็นสีเดียวกันต้องแปลว่าเรื่องเดียวกันทุกหน้า
 *
 * ทิศทางที่เคาะ: เห็นปุ๊บรู้ว่าต้องทำอะไรต่อ
 *   เขียว = จบดี (สนใจ/รับทราบ)         · แดง = จบไม่ดี (ปฏิเสธ)
 *   เหลือง = ยังไม่จบ รอโทรซ้ำ (ไม่รับ/ไม่ว่าง/ไม่ตอบ/ขอเลื่อน/โทรไม่สำเร็จ)
 *   ส้ม = AI เอาไม่อยู่ ต้องคนตาม (เบอร์ผิด — ชุดเดียวกับถัง needs_human)
 *   เทา = ไม่ใช่ผลการโทร (คนกดยกเลิกเอง)
 */
export const CALL_OUTCOME_TONE: Record<CallOutcome, ToneKey> = {
  confirmed: 'success',
  acknowledged: 'success',
  declined: 'danger',
  reschedule_requested: 'warn',
  no_answer: 'warn',
  busy: 'warn',
  unresponsive: 'warn',
  failed: 'warn',
  wrong_person: 'orange',
  cancelled: 'neutral',
};

/**
 * ป้ายไทยของผลโทร — อยู่คู่กับโทนที่นี่ที่เดียวด้วยเหตุผลเดียวกัน
 * (เดิมเป็น local ใน CallFunnelPanel ไฟล์ไหนอยากใช้ต้องก๊อป แล้วคำจะเพี้ยนกันเอง
 * แบบเดียวกับที่สีเคยเพี้ยนมาแล้ว)
 */
export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  confirmed: 'สนใจ',
  acknowledged: 'รับทราบ',
  declined: 'ไม่สนใจ',
  reschedule_requested: 'ขอเลื่อน',
  wrong_person: 'เบอร์ผิด',
  no_answer: 'ไม่รับสาย',
  busy: 'สายไม่ว่าง',
  unresponsive: 'ไม่ตอบ',
  failed: 'โทรไม่สำเร็จ',
  cancelled: 'ยกเลิก',
};
