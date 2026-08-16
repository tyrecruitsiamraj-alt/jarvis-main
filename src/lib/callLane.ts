import type { CallHoldSource } from '@/lib/callHoldsApi';

/**
 * เลนของงานโทร (เจ้าของสั่ง 16 ส.ค. 2569: *"แยกนะ งานสรรหามีหน้าการติดต่อแล้ว
 * งานคัดสรรก็ให้มีหน้าการติดต่อของเขาเอง ไม่ปนกัน"*)
 *
 * แยกด้วย **สถานะคนที่ปลายสาย** ตามนิยามถาวรของสองเลน:
 *   - สรรหา  = คนยังไม่สมัคร → ล็อกที่มาจากฐาน iRecruit
 *   - คัดสรร = คนสมัครแล้ว   → ล็อกของคนบนบอร์ด (`board`) และใบสมัคร (`application`)
 *
 * ⚠️ **ห้ามแยกด้วยว่าใครกดเก็บ** — ระบบยังไม่รู้ว่าใครอยู่ทีมไหน (A4 พักไว้)
 * ตัวที่รู้แน่คือชนิดของคน ซึ่งอยู่ใน `source` ของล็อกอยู่แล้ว
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
  return source === 'irecruit' ? 'recruit' : 'selection';
}

/** กรองล็อกตามเลน — ไม่ส่ง lane = คืนทั้งหมด (พฤติกรรมเดิมของหน้าเก่า) */
export function filterHoldsByLane<T extends { source: CallHoldSource }>(
  holds: T[],
  lane: CallLane | undefined,
): T[] {
  if (!lane) return holds;
  return holds.filter((h) => holdLane(h.source) === lane);
}
