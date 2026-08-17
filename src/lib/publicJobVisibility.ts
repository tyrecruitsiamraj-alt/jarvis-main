import { isUnitRequestWorkStatus, type UnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';

/**
 * "ใบไหนควรโชว์บนหน้าสาธารณะ" (เจ้าของสั่ง 17 ส.ค. 2569: *"หน้าสาธารณะโชว์เฉพาะ
 * ใบขอที่ยังต้องการคน ใบไหนบอกรอคนเริ่มงานไม่ต้องเอามาโชว์"* · เคาะเพิ่มว่า
 * **รอเริ่มงาน + รอแจ้งเข้า** ทั้งสองสถานะให้ซ่อน)
 *
 * ทำไมต้องซ่อน: สองสถานะนี้แปลว่า**ได้ตัวคนแล้ว** เหลือแค่รอวันเริ่ม/รอเอกสารแจ้งเข้า
 * ปล่อยประกาศไว้ = คนนอกสมัครเข้ามาแล้วไม่มีที่ลง เสียเวลาทั้งสองฝ่าย และเราต้องมา
 * ตอบปฏิเสธทีหลัง
 *
 * ⚠️ **ไม่ใช่การปิดใบขอ** — ใบยังเปิดอยู่ในระบบหลังบ้านตามเดิม แค่ไม่โฆษณาต่อ
 * ถ้าคนที่นัดไว้ไม่มา เจ้าหน้าที่เปลี่ยนสถานะกลับ ประกาศก็โผล่กลับมาเอง
 *
 * ⚠️ ใบที่**ยังไม่เคยตั้งสถานะ** (`work_status` ว่าง) ถือว่ายังหาคนอยู่ → โชว์
 * ห้ามตีความว่า "ไม่รู้ = ซ่อน" ไม่งั้นประกาศหายเกือบหมดในวันที่ตารางสถานะยังว่าง
 *
 * ไฟล์นี้ pure — ใช้ร่วมทั้งฝั่ง API และหน้าเว็บ · เทสต์ที่ `tests/api/publicJobVisibility.test.ts`
 */

/** สถานะที่แปลว่าได้ตัวคนแล้ว — ไม่ต้องประกาศหาคนต่อ */
export const HIDDEN_FROM_PUBLIC_WORK_STATUSES: readonly UnitRequestWorkStatus[] = [
  'waiting_start',
  'waiting_inform',
];

export function isHiddenFromPublicByWorkStatus(status: unknown): boolean {
  if (!isUnitRequestWorkStatus(status)) return false;
  return (HIDDEN_FROM_PUBLIC_WORK_STATUSES as readonly string[]).includes(status);
}

/** ใบนี้ยังควรโชว์บนหน้าสาธารณะไหม — ดูจากสถานะงานที่เจ้าหน้าที่ตั้งไว้ */
export function isPublicVisibleByWorkStatus(job: { work_status?: unknown }): boolean {
  return !isHiddenFromPublicByWorkStatus(job.work_status);
}
