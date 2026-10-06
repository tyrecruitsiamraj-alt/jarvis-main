/**
 * ═══ ช่องทางของลิงก์ที่ Gen → ช่อง "เห็นประกาศจากช่องทางไหน" ในใบสมัคร (เจ้าของ 6 ต.ค. 2569) ═══
 * > *"Link ที่ Gen ต้อง Lock ช่องทางด้วยสิ่ ทำไมพอจะกรอกแล้วต้องเลือกช่องทางอีก เช่น เลือกว่า facebook …
 * >  ต้องล็อคไว้เลย"* (เคยสั่งไว้แล้ว 2 ต.ค.: "ถ้าเจนลิงก์ ช่องทางต้องมาตามที่เจน")
 *
 * ลิงก์มีช่องทาง = ล็อกตามลิงก์ (ผู้สมัครเลือกเองไม่ได้ · ฝั่ง API บันทึกตามลิงก์เสมอ ไม่เชื่อค่าจากหน้าเว็บ)
 * ลิงก์กลาง (ไม่ระบุช่องทาง) = ผู้สมัครเลือกเองได้ตามเดิม
 * ช่องทางจริง (6 ต.ค.): Facebook Group/Page/Ads · LINE OA · Tiktok · ป้าย/ใบปลิว — ตัวเลือกในฟอร์มมี 5 ค่า ไม่มี LINE ⇒ อื่นๆ
 * ไฟล์นี้ pure — ใช้ทั้งหน้าเว็บและ API · เทสต์ที่ `tests/api/referralChannel.test.ts`
 */
export type ReferralSourceKey = 'facebook' | 'tiktok' | 'instagram' | 'flyer' | 'other';

/** ชื่อช่องทางของลิงก์ → ค่าในใบสมัคร · ไม่มีชื่อช่องทาง = null (ไม่ล็อก) */
export function referralSourceOfChannel(label: string | null | undefined): ReferralSourceKey | null {
  const t = (label ?? '').trim().toLowerCase();
  if (!t) return null;
  if (/facebook|เฟซบุ๊ก|เฟสบุ๊ค|\bfb\b/u.test(t)) return 'facebook';
  if (/tiktok|tik tok|ติ๊กต็อก/u.test(t)) return 'tiktok';
  if (/instagram|ไอจี|\big\b/u.test(t)) return 'instagram';
  if (/ใบปลิว|ป้าย|flyer/u.test(t)) return 'flyer';
  return 'other';
}
