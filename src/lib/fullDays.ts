/**
 * ═══ นับวันแบบ "ครบ 24 ชม. = 1 วัน" — ตัวเดียวของฝั่งผู้สมัครทั้งหมด (เจ้าของเคาะ 30 ก.ย. 2569) ═══
 *
 * > *"จะนับเป็นวันต้องครบ 24 ชม นะถึงจะนับเป็น 1 วัน"* (หน้าภาพรวม) → Choice ให้ตาราง "สมัครมาแล้ว" + หัวข้อกรอง
 * > "สมัครมาแล้ว" นับแบบเดียวกัน ("ครบ 24 ชม. เหมือนภาพรวม")
 *
 * กรอก 21:00 ตอนนี้ 10:00 วันถัดไป = 0 วัน (ยังไม่ครบ 24 ชม.) · 🔴 กติกาเก่า "ข้ามเที่ยงคืน = 1 วัน" (17 ส.ค. 2569) เลิกแล้ว
 * ⚠️ ของที่เป็น "วันที่ตามปฏิทิน" จริง ๆ (นัดวันนี้ / 7 วันข้างหน้า · ช่วงวันที่สมัคร) ไม่ใช้ตัวนี้
 * ไฟล์นี้ไม่มี import — เส้น API ใช้ร่วมได้
 */
export const DAY_MS = 86_400_000;

const timeOf = (iso: string | null | undefined): number => {
  const raw = (iso ?? '').trim();
  return raw ? new Date(raw).getTime() : Number.NaN;
};

/** วันเต็มระหว่างสองเวลา · อ่านไม่ได้ / ถอยหลัง = null */
export function fullDaysBetween(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  const a = timeOf(fromIso);
  const b = timeOf(toIso);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.floor((b - a) / DAY_MS);
}

/** ผ่านมาแล้วกี่วันเต็มนับถึง `now` · อ่านไม่ได้ = null (คนละความหมายกับ 0) · เวลาล้ำหน้านาฬิกาเล็กน้อย = 0 */
export function fullDaysSince(iso: string | null | undefined, now: Date): number | null {
  const t = timeOf(iso);
  if (!Number.isFinite(t) || !Number.isFinite(now.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}
