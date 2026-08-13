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
/** ติ๊กไว้แล้วแต่ทุกคนที่ติ๊กทำทางนี้ไม่ได้ — ต้องบอกให้ชัด ไม่ใช่บอกให้ไปติ๊ก(ซ้ำ) */
const ALL_SENT_REASON = 'คนที่ติ๊กไว้ถูกส่งเข้าคิว AI ไปแล้วทั้งหมด';
const ALL_HELD_REASON = 'คนที่ติ๊กไว้มีเจ้าหน้าที่ถืออยู่แล้วทั้งหมด';

export function lumosSendActionStates(input: {
  /** คนทั้งใบที่ส่งได้จริง (approveAllCount) */
  allCount: number;
  /** คนที่ติ๊กเลือกไว้ (บอร์ด + iRecruit รวมกัน) */
  selectedCount: number;
  /**
   * ในจำนวนที่ติ๊ก มีกี่คนที่ **ส่งเข้าคิว AI ได้จริง** (ยังไม่เคยเข้าคิวใบนี้)
   * ไม่ส่งมา = ถือว่าเท่ากับ selectedCount (พฤติกรรมเดิม)
   *
   * ⚠️ เจ้าของทัก 13 ส.ค. 2569 ว่า "มันกดติ๊กเลือกไม่ได้" — เดิมช่องติ๊กถูกปิด
   * ถ้าคนนั้นถูกส่ง AI ไปแล้ว ทำให้ **เก็บไปโทรเองก็ทำไม่ได้ด้วย** ทั้งที่เป็นคนละเรื่อง
   * ตอนนี้ติ๊กได้ทุกคนที่มีเบอร์ แล้วแยกที่ปุ่มแทนว่าอันไหนทำได้กับใครบ้าง
   */
  selectedSendable?: number;
  /** ในจำนวนที่ติ๊ก มีกี่คนที่ **เก็บเข้าถังโทรของตัวเองได้** (ยังไม่มีใครถือ) */
  selectedHoldable?: number;
  sending: boolean;
  creatingBatch: boolean;
  holdingSelf: boolean;
}): Record<LumosSendActionKey, LumosSendActionState> {
  const { allCount, selectedCount, sending, creatingBatch, holdingSelf } = input;
  const selectedSendable = input.selectedSendable ?? selectedCount;
  const selectedHoldable = input.selectedHoldable ?? selectedCount;
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

  // ติ๊กแล้วแต่ทำทางนี้ไม่ได้สักคน ต้องบอกเหตุผลที่ตรง ไม่ใช่ไล่ให้ไปติ๊กอีก
  const selectedReason = (usable: number, allUnusableReason: string) =>
    selectedCount <= 0 ? NO_SELECTION_REASON : usable <= 0 ? allUnusableReason : NO_SELECTION_REASON;

  return {
    // ⚠️ sendAll ผูกกับ allCount เท่านั้น — ไม่เกี่ยวกับการติ๊ก (นั่นคือจุดที่ทำให้
    // "ส่งทั้งหมดที่แมท" กดได้ตั้งแต่ยังไม่ได้ติ๊กใคร ซึ่งเป็นทางที่เจ้าของอยากได้)
    sendAll: build(allCount, NO_TARGET_REASON),
    sendSelected: build(selectedSendable, selectedReason(selectedSendable, ALL_SENT_REASON)),
    queueSelected: build(selectedSendable, selectedReason(selectedSendable, ALL_SENT_REASON)),
    holdSelf: build(selectedHoldable, selectedReason(selectedHoldable, ALL_HELD_REASON)),
  };
}
