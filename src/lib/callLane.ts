import type { CallHoldSource } from '@/lib/callHoldsApi';

/**
 * เลนของงานโทร (เจ้าของสั่ง 16 ส.ค. 2569: *"แยกนะ งานสรรหามีหน้าการติดต่อแล้ว
 * งานคัดสรรก็ให้มีหน้าการติดต่อของเขาเอง ไม่ปนกัน"*)
 *
 * แยกด้วย **สถานะคนที่ปลายสาย** ตามนิยามถาวร (เจ้าของย้ำอีกรอบ 16 ส.ค. เย็น):
 *   - สรรหา  = ก่อนขึ้นถัง To do → ฐาน iRecruit (ยังไม่สมัคร) **และใบจากหน้าสาธารณะ**
 *     (กรอกมาแล้ว Lumos โทรถามสนใจ/ไม่สนใจ — ยังเป็นงานสรรหาจนกว่าจะขึ้นบอร์ด)
 *   - คัดสรร = สมัครแล้วจริง = **ชื่อขึ้นถัง To do บนบอร์ด ERP** → ล็อก `board` เท่านั้น
 *
 * ⚠️ เวอร์ชันแรก (เช้า 16 ส.ค.) เคยจัด `application` เป็นคัดสรร — ผิดนิยาม
 * "ได้ใบสมัคร = ชื่อขึ้นถัง To do" · ใบจากหน้าสาธารณะเป็นแค่ความสนใจ ยังเป็นของสรรหา
 * ⚠️ **ห้ามแยกด้วยว่าใครกดเก็บ** — ระบบยังไม่รู้ว่าใครอยู่ทีมไหน (A4 พักไว้)
 */
export type CallLane = 'recruit' | 'selection';

export const CALL_LANE_LABEL: Record<CallLane, string> = {
  recruit: 'การติดต่อ (สรรหา)',
  selection: 'การติดต่อ (คัดสรร)',
};

export const CALL_LANE_HINT: Record<CallLane, string> = {
  recruit: 'คนที่ยังไม่สมัคร — โทรเสนองานแล้วตามเก็บใบสมัคร',
  selection: 'คนที่สมัครแล้ว — โทรคัดกรอง นัดสัมภาษณ์ พาไปถึงวันเริ่มงาน',
};

/** ล็อกนี้เป็นงานของเลนไหน — ตัดสินจากชนิดคน ไม่ใช่คนที่กดเก็บ */
export function holdLane(source: CallHoldSource): CallLane {
  return source === 'board' ? 'selection' : 'recruit';
}

/** กรองล็อกตามเลน — ไม่ส่ง lane = คืนทั้งหมด (พฤติกรรมเดิมของหน้าเก่า) */
export function filterHoldsByLane<T extends { source: CallHoldSource }>(
  holds: T[],
  lane: CallLane | undefined,
): T[] {
  if (!lane) return holds;
  return holds.filter((h) => holdLane(h.source) === lane);
}
