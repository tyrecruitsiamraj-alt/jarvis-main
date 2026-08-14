/**
 * ลำดับความสำคัญของคิวโทร — "คนที่ AI ให้คะแนนดีกว่า ได้โทรก่อน"
 *
 * เจ้าของเคาะแล้วว่าใช้ **tier ของ AI** (เขียว/เหลือง/แดง) ไม่ใช่ % บนการ์ด
 * เหตุผล: tier คิดฝั่ง server อยู่แล้วทั้งเส้น auto และเส้นคนติ๊กเลือก ส่วน % คิดฝั่ง
 * เบราว์เซอร์ (`scoreCandidatePriority`) ซึ่งฝั่ง API ไม่มี ต้องให้หน้าเว็บส่งมาตอนกดส่ง
 *
 * เลขน้อย = ได้ก่อน (เรียง asc) — เก็บเป็นเลขไม่ใช่ตัวอักษรเพื่อให้ ORDER BY ในฐาน
 * ตรงกับความหมายโดยไม่ต้องมี CASE ยาว ๆ ในคิวรีที่แก้ยาก
 */

export type MatchTier = 'green' | 'yellow' | 'red';

/**
 * ลำดับของแถวที่ **ไม่มี tier** — คิวเก่าก่อน migration 084 · งานจากหน้า Follow
 * (คนกรอกเอง ไม่ได้ผ่าน AI แมท) · คนที่เจ้าหน้าที่ติ๊กเลือกเองจากฝั่ง iRecruit
 *
 * ⚠️ **จงใจให้เท่ากับเหลือง (2) ไม่ใช่ท้ายแถว** — "ไม่มีคะแนนจาก AI" ไม่ได้แปลว่า
 * "คนไม่ดี" · ถ้าดันไปท้ายแถว งานเตือนจากหน้า Follow (ซึ่งมักด่วนกว่าเพื่อน)
 * กับคนที่เจ้าหน้าที่เลือกเองจะถูกถ่วงทันทีที่เปิดใช้ ทั้งที่ไม่มีใครสั่ง
 * เสมอกันแล้วให้ **ลำดับเข้าคิว** ตัดสินต่อ = พฤติกรรมเดิมเป๊ะสำหรับแถวที่ไม่มีคะแนน
 *
 * ⚠️ **ห้ามปล่อยเป็น NULL ในคิวรี** — row comparison ที่มี NULL ให้ผลเป็น NULL
 * (ไม่ใช่ true) → ตัวกัน "หนึ่งเบอร์ = หนึ่งใบขอที่กำลังเสนอ" หลุด แล้วคนเดียว
 * จะโดนหลายสายพร้อมกัน · คิวรีจึงอ่านด้วย `coalesce(match_rank, <ค่านี้>)` เสมอ
 */
export const MATCH_RANK_UNKNOWN = 2;

const RANK_BY_TIER: Record<MatchTier, number> = {
  green: 1,
  yellow: 2,
  red: 3,
};

/** tier → ลำดับในคิว · ค่าที่ไม่รู้จัก/ไม่มี = ระดับกลาง (ดู MATCH_RANK_UNKNOWN) */
export function matchRankFromTier(tier: string | null | undefined): number {
  if (tier === 'green' || tier === 'yellow' || tier === 'red') return RANK_BY_TIER[tier];
  return MATCH_RANK_UNKNOWN;
}

/** ป้ายอธิบายลำดับ — ใช้ตอนอยากโชว์ว่าทำไมคนนี้ถูกโทรก่อน */
export function matchRankLabel(tier: string | null | undefined): string {
  if (tier === 'green') return 'AI ให้เขียว — โทรก่อน';
  if (tier === 'yellow') return 'AI ให้เหลือง';
  if (tier === 'red') return 'AI ให้แดง — ไว้ท้ายคิว';
  return 'ไม่มีคะแนนจาก AI — อยู่ระดับกลางเท่าเหลือง';
}
