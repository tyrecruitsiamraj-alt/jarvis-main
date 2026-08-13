/**
 * สถานะเปิด/ปิดของปุ่มส่งโทร 4 ทางในหน้าเปิดใบขอ — flow ที่เจ้าของกำหนด 13 ส.ค. 2569:
 * "กดไปที่ใบงานจะเจอคนที่ match แล้วเลือกได้ว่า จะส่งโทรทั้งหมดเลยที่ match เจอ /
 *  ส่งบางคนด้วยการติ๊กเลือกแล้วกดส่งให้ AI โทร / เลือกเก็บไปโทรเอง"
 *
 * ⚠️ **ปุ่มที่ใช้ไม่ได้ต้อง disable พร้อมบอกเหตุผล ห้ามซ่อน** — ของเดิมทั้งแถบหายไป
 * เมื่อยังไม่ติ๊กใคร ผู้ใช้จึงไม่รู้ว่ามีทางเลือกอะไรบ้างจนกว่าจะเผลอไปติ๊กถูก
 * invariant `disabled === (reason !== null)` มีเทสต์บังคับ — จะ disable ต้องมีเหตุผลเสมอ
 *
 * แยกจากไฟล์ component เพราะ LumosPanels.tsx ห้าม export non-component
 * (eslint react-refresh · baseline 16 warning)
 */

export type LumosSendActionKey = 'sendAll' | 'sendSelected' | 'queueSelected' | 'holdSelf';

export type LumosSendActionState = {
  /** จำนวนที่ปุ่มนี้จะทำงานด้วย — sendAll ใช้ยอดทั้งใบ ที่เหลือใช้ยอดที่ติ๊ก */
  count: number;
  disabled: boolean;
  /** null เมื่อกดได้ · มีข้อความเสมอเมื่อ disabled (ผู้ใช้ต้องรู้ว่าทำไมกดไม่ได้) */
  reason: string | null;
};

export const LUMOS_SEND_ACTION_KEYS: LumosSendActionKey[] = [
  'sendAll',
  'sendSelected',
  'queueSelected',
  'holdSelf',
];

const NO_TARGET_REASON =
  'ใบนี้ยังไม่มีคนที่ส่งได้ — ไม่มีเบอร์ / ส่งไปแล้ว / มีเจ้าหน้าที่ถืออยู่';
const NO_SELECTION_REASON = 'ติ๊กเลือกคนจากรายชื่อด้านล่างก่อน';

export function lumosSendActionStates(input: {
  /** คนทั้งใบที่ส่งได้จริง (approveAllCount) */
  allCount: number;
  /** คนที่ติ๊กเลือกไว้ (บอร์ด + iRecruit รวมกัน) */
  selectedCount: number;
  sending: boolean;
  creatingBatch: boolean;
  holdingSelf: boolean;
}): Record<LumosSendActionKey, LumosSendActionState> {
  const { allCount, selectedCount, sending, creatingBatch, holdingSelf } = input;
  // กำลังทำงานอยู่ = ปิดทุกปุ่มพร้อมกัน กันยิงซ้อน (ปุ่มพวกนี้โทรหาคนจริง)
  const busyReason = sending
    ? 'กำลังส่งเข้าคิวโทร…'
    : creatingBatch
      ? 'กำลังตั้งคิวโทร…'
      : holdingSelf
        ? 'กำลังเก็บเข้าถังโทรของคุณ…'
        : null;

  const build = (count: number, emptyReason: string): LumosSendActionState => {
    const reason = busyReason ?? (count <= 0 ? emptyReason : null);
    return { count: Math.max(0, count), disabled: reason !== null, reason };
  };

  return {
    // ⚠️ sendAll ผูกกับ allCount เท่านั้น — ไม่เกี่ยวกับการติ๊ก (นั่นคือจุดที่ทำให้
    // "ส่งทั้งหมดที่แมท" กดได้ตั้งแต่ยังไม่ได้ติ๊กใคร ซึ่งเป็นทางที่เจ้าของอยากได้)
    sendAll: build(allCount, NO_TARGET_REASON),
    sendSelected: build(selectedCount, NO_SELECTION_REASON),
    queueSelected: build(selectedCount, NO_SELECTION_REASON),
    holdSelf: build(selectedCount, NO_SELECTION_REASON),
  };
}
