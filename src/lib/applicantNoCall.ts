/**
 * ═══ ปุ่ม "ไม่โทร" + เหตุผล (เจ้าของ 26 พ.ย. 2569) ═══
 * > *"เอาเป็นปุ่มคำว่าไม่โทรแล้วกัน แล้วเดี๋ยวพอเลือกเหตุผลจะได้โยนเข้ากล่องนั้นๆไป"* · Choice "ตรง ทำเลย"
 * เหตุผลที่ box = 'own' ได้กล่องของตัวเอง (`nocall:<id>`) · เพิ่มเหตุผลใหม่จากหน้าจอ = มีกล่องใหม่เอง
 * box อื่น = ไปกล่องที่มีอยู่แล้ว (เบอร์โทรผิด · อายุเกิน · ได้งานแล้ว)
 */
export const NO_CALL_BOXES = ['own', 'bad_data', 'over_age', 'employed'] as const;
export type NoCallBox = (typeof NO_CALL_BOXES)[number];

export type NoCallReason = { id: number; label: string; box: NoCallBox; active: boolean; sort: number };

export const NO_CALL_BOX_LABEL: Record<NoCallBox, string> = {
  own: 'กล่องของเหตุผลนี้',
  bad_data: 'เบอร์โทรผิด',
  over_age: 'อายุเกิน',
  employed: 'ได้งานแล้ว',
};

/** กล่องของเหตุผลที่ได้กล่องตัวเอง */
export type NoCallView = `nocall:${number}`;
export const noCallViewOf = (reasonId: number): NoCallView => `nocall:${reasonId}`;
export const isNoCallView = (v: string | null | undefined): v is NoCallView => !!v && /^nocall:\d+$/.test(v);
export const noCallReasonIdOf = (v: NoCallView): number => Number(v.slice('nocall:'.length));

/** กล่องที่ใบไปอยู่เมื่อกดไม่โทร · เหตุผลไม่รู้จัก (เพิ่งเลิกใช้/โหลดไม่ขึ้น) = กล่องของเหตุผลนั้นเอง */
export function noCallTarget(reasonId: number, reasons: readonly NoCallReason[]): NoCallView | Exclude<NoCallBox, 'own'> {
  const r = reasons.find((x) => x.id === reasonId);
  return !r || r.box === 'own' ? noCallViewOf(reasonId) : r.box;
}

/** เหตุผลที่ได้กล่องของตัวเอง — กล่องบนจอ (รวมที่เลิกใช้แล้วถ้ายังมีใบค้าง ผู้เรียกตัดสิน) */
export const ownBoxReasons = (reasons: readonly NoCallReason[]): NoCallReason[] =>
  reasons.filter((r) => r.box === 'own').sort((a, b) => a.sort - b.sort || a.id - b.id);
