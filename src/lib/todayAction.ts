/**
 * ═══ "แล้วไงต่อ" ของแต่ละสายวันนี้ ═══
 *
 * > เจ้าของนิยามหน้าแรกไว้ 15 ก.ย. 2569: *"ตัวเลขต้องบอกระดับ micro ใครทำอะไร วันนี้ต้อง
 * > ทำอะไร ทำอะไรเสร็จแล้ว เหลือทำอะไร เสร็จที่ว่าผลคืออะไรต้องมีผลบอกทั้งหมด
 * > เช่น รับสาย รับแล้วไงอะ ไม่ใช่แค่รายงานว่ารับสายแล้วจะรู้ได้ไงว่ายังไงต่อ"*
 *
 * ทุกจอที่ผ่านมาหยุดที่ **สถานะ** ("รับสายแล้ว" · "รู้ผลแล้ว") ซึ่งเป็นกล่องตัน
 * ไฟล์นี้เติมช่องสุดท้ายที่ขาด: **แล้วคนต้องทำอะไรต่อ**
 *
 * 🔴 กติกา:
 * 1. ทุกสายต้องมีคำตอบเสมอ — ไม่มีคำว่า "-" หรือช่องว่าง (ว่าง = คนอ่านต้องเดาเอง)
 * 2. **"ไม่ต้องทำอะไรต่อ" เป็นคำตอบที่ถูกต้อง** ไม่ใช่การยอมแพ้ — สายที่จบดีต้องบอกว่าจบ
 *    ไม่งั้นคนไล่ดูทุกแถวเพื่อหาว่าอันไหนต้องทำ
 * 3. ห้ามเดาความเร่งด่วนเอง — ระดับความสำคัญมาจาก **ผลของสาย** ไม่ใช่จากเวลา
 */
import type { CallMicroOutcome } from '@/lib/callMicroOutcome';

/** สภาพของสายที่ยังไม่มีผลกลับ — คนละเรื่องกับถังผล */
export type PendingKind =
  /** ยังไม่ถึงเวลานัด */
  | 'waiting'
  /** เลยเวลานัดแล้วแต่ยังไม่มีผล */
  | 'overdue'
  /** ไม่ได้ส่งให้ AI เลย */
  | 'not_sent';

export type TodayAction = {
  /** คำสั่งสั้น ๆ ที่คนอ่านแล้วลงมือได้ทันที */
  text: string;
  /**
   * ต้องมีคนลงมือไหม — `false` = สายนี้จบแล้ว
   * (จอใช้แยกว่าแถวไหนควรเด่น แถวไหนควรจาง)
   */
  needsHuman: boolean;
  /** ด่วนแค่ไหน — `high` = เสียคนถ้าไม่ทำวันนี้ */
  level: 'high' | 'normal' | 'done';
};

const DONE: TodayAction = { text: 'ไม่ต้องทำอะไรต่อ', needsHuman: false, level: 'done' };

/**
 * ผลของสาย → สิ่งที่ต้องทำต่อ
 *
 * ⚠️ คำต้องเป็น**คำสั่งที่ทำได้จริงในระบบนี้** — ห้ามเขียนลอย ๆ อย่าง "ติดตามต่อไป"
 * (บทเรียน 13 ก.ย. 2569: เคยเขียนว่า "ส่งโทรรอบถัดไป" ทั้งที่บนจอไม่มีปุ่มชื่อนั้น)
 */
export function actionForResult(bucket: CallMicroOutcome): TodayAction {
  switch (bucket) {
    case 'said_yes':
      return DONE;
    case 'said_no':
      // เสียคนแล้ว — ใบขอนั้นต้องหาคนใหม่ ยิ่งรู้เร็วยิ่งดี
      return { text: 'หาคนแทนวันนี้', needsHuman: true, level: 'high' };
    case 'not_yet':
      return { text: 'ตามซ้ำอีกครั้ง', needsHuman: true, level: 'normal' };
    case 'talked_unclear':
      return { text: 'กดอ่านบทสนทนา แล้วตัดสินใจ', needsHuman: true, level: 'normal' };
    case 'no_pickup':
      return { text: 'โทรเองตอนนี้', needsHuman: true, level: 'high' };
    case 'picked_silent':
      return { text: 'โทรเองตอนนี้', needsHuman: true, level: 'high' };
    case 'wrong_person':
      return { text: 'แก้เบอร์ให้ถูก แล้วตั้งโทรใหม่', needsHuman: true, level: 'high' };
    default:
      return { text: 'กดอ่านบทสนทนา แล้วตัดสินใจ', needsHuman: true, level: 'normal' };
  }
}

/** ยังไม่มีผลกลับ → สิ่งที่ต้องทำต่อ */
export function actionForPending(kind: PendingKind): TodayAction {
  switch (kind) {
    case 'waiting':
      return { text: 'รอ AI โทรตามเวลา', needsHuman: false, level: 'normal' };
    case 'overdue':
      // เลยเวลานัดแล้ว = มีคนรออยู่ปลายสายจริง ๆ
      return { text: 'เลยเวลาแล้วยังเงียบ — โทรเอง', needsHuman: true, level: 'high' };
    case 'not_sent':
      return { text: 'ยังไม่ได้ส่งให้ AI — โทรเอง', needsHuman: true, level: 'high' };
  }
}

/**
 * เรียงแถวบนตาราง — **ของที่ต้องลงมือขึ้นก่อนเสมอ**
 * ด่วน → ปกติ → จบแล้ว · ในระดับเดียวกันเรียงตามเวลานัด
 */
export const ACTION_ORDER: Record<TodayAction['level'], number> = {
  high: 0,
  normal: 1,
  done: 2,
};
