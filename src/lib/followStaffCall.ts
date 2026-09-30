/**
 * ═══ ผลโทรที่เจ้าหน้าที่ลงเอง — รอบติดตามที่ตั้งให้ "คนโทร" (migration 130 · 30 ก.ย. 2569) ═══
 *
 * เจ้าของจะใช้หน้าหลักบอก *"ตอนนี้ระบบไปกี่ %"* แล้วเคาะว่านับจาก **โทรจริงที่มีผลบันทึก**
 * แต่รอบที่ตั้งเป็นคนโทร (`call_mode = 'manual'`) ไม่เคยมีที่ลงผล — กดเบอร์แค่เปิดแอปโทร
 * ส่วนปุ่มปิดงานเป็นการปิดทั้งเรื่อง ⇒ Choice **"เพิ่มปุ่มลงผลโทร"** · ไฟล์นี้คือกติกาของปุ่มนั้น
 *
 * - ศัพท์ผล = ชุดเดียวกับผลที่เจ้าหน้าที่ลงในกล่องงาน (`CALL_RESULT_OUTCOMES`) ซึ่งตรงกับ outcome
 *   ของ Lumos ⇒ ปฏิทิน/กล่องนับอ่านผลของคนกับของ AI ได้ด้วยตารางคำ/สีชุดเดิม (เทสต์คุมว่าชุดตรงกัน)
 * - คำบนจอใช้ `followCallOutcomeText` (คำของงานติดตาม เช่น "ยืนยันว่าไป") ไม่ใช่คำของงานหาคน
 * - ตัวตรวจค่าตัวเดียว ใช้ทั้งฟอร์มและ server (`api/_handlers/follow.ts`)
 *
 * ไฟล์นี้ pure — เทสต์ที่ `tests/api/followStaffCall.test.ts`
 */
import { followCallOutcomeText } from '@/lib/callOutcomeTone';

/** เรียงตามที่ต้องเห็นก่อน — ตอบแล้ว (ไป/ไม่ไป/ขอเลื่อน) ก่อน ยกหูไม่ได้ทีหลัง */
export const FOLLOW_STAFF_CALL_OUTCOMES = [
  'confirmed',
  'declined',
  'reschedule_requested',
  'no_answer',
  'wrong_person',
] as const;
export type FollowStaffCallOutcome = (typeof FOLLOW_STAFF_CALL_OUTCOMES)[number];

export const FOLLOW_STAFF_CALL_NOTE_MAX = 300;

export function isFollowStaffCallOutcome(v: unknown): v is FollowStaffCallOutcome {
  return typeof v === 'string' && (FOLLOW_STAFF_CALL_OUTCOMES as readonly string[]).includes(v);
}

/** คำของผลบนปุ่ม/ชิป — คำของงานติดตาม (ชุดเดียวกับผลของ AI ในปฏิทิน) */
export function followStaffCallText(code: string): string {
  return followCallOutcomeText(code);
}

export type FollowStaffCallInput = { outcome: FollowStaffCallOutcome; note: string | null };

/** ตรวจค่าที่จะบันทึก — ค่าที่อ่านไม่ออก = ปฏิเสธ ห้ามเดาเป็นผลใดผลหนึ่ง */
export function validateFollowStaffCall(input: {
  outcome: unknown;
  note?: unknown;
}): { ok: true; value: FollowStaffCallInput } | { ok: false; error: string } {
  const outcome = typeof input.outcome === 'string' ? input.outcome.trim() : '';
  if (!isFollowStaffCallOutcome(outcome)) {
    return { ok: false, error: 'เลือกผลโทรจากรายการที่มีให้' };
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > FOLLOW_STAFF_CALL_NOTE_MAX) {
    return { ok: false, error: `หมายเหตุยาวเกิน ${FOLLOW_STAFF_CALL_NOTE_MAX} ตัวอักษร` };
  }
  return { ok: true, value: { outcome, note: note || null } };
}

/**
 * ลงผลคนโทรได้ไหม — **เฉพาะรอบที่ตั้งเป็นคนโทร** และยังไม่ถูกยกเลิก
 * (รอบของ AI มีผลจาก Lumos อยู่แล้ว · รอบหนึ่งตั้งได้ทางเดียว หน้าหลักจึงไม่มีก้อน "ทั้งสองทาง" ของหน้าติดตาม)
 */
export function canRecordStaffCall(entry: { call_mode?: string | null; cancelled?: boolean }): boolean {
  return entry.call_mode === 'manual' && !entry.cancelled;
}

/**
 * ผลของสายที่ใช้ตัดสินสภาพ/สี/หมวดของรอบ — ผลจาก AI ก่อน ถ้าไม่มีค่อยใช้ผลที่คนลง
 * รอบหนึ่งมีได้แหล่งเดียวอยู่แล้ว (คนลงผลได้เฉพาะรอบคนโทร ซึ่งไม่เคยเข้าคิว AI)
 */
export function effectiveCallOutcome(entry: {
  call_outcome?: string | null;
  staff_call_outcome?: string | null;
}): string | null {
  const ai = (entry.call_outcome ?? '').trim();
  if (ai) return ai;
  const staff = (entry.staff_call_outcome ?? '').trim();
  return staff || null;
}
