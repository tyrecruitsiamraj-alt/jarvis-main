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

/**
 * 🔴 **ใบขอล่วงหน้าไม่ออกหน้าสาธารณะ** (17 ส.ค. 2569)
 *
 * ตรวจฐานจริงแล้วเจอว่าใบล่วงหน้าที่มีอยู่ 31 ใบ **25 ใบเกิดวันที่ 24 ก.ค. วันเดียว**
 * จากคนบันทึก 10 กว่าคน = **วันที่คนซ้อมใช้ฟีเจอร์ใน ERP ไม่ใช่ใบขอจริง** ชื่อหน่วยงาน
 * เป็นข้อความเล่น ๆ (`ช่วยหนูด้วย` · `หนูติดอยู่ในลิฟท์` · `so test` · `อะ 10 20 30 40`)
 * และหลุดออกหน้าประกาศไปแล้ว **18 ใบ** — มีทั้งใบที่ไม่มีชื่อหน่วยงานเลย (`—`)
 * และใบที่เอาชื่อลูกค้าจริงไปใส่ในใบซ้อม (`SCB ไทยพาณิชย์`)
 *
 * ยังมีของค้างอีกสองอย่างที่ต้องเสร็จก่อนถึงจะเปิดได้:
 * 1. **อัตราค่าจ้าง** — ใบล่วงหน้ายังไม่ได้ต่อ `fetchBenefitRatesByJobId` ทำให้ค่าแรง
 *    **รายวัน** โชว์เป็นก้อนเดียว (`CRM6907001` จ่ายวันละ 15,000 โชว์ "฿15,000"
 *    คนอ่านเข้าใจว่าเงินเดือน)
 * 2. **คีย์ซ้ำ** — เลขที่ใบล่วงหน้าซ้ำกับใบขอปกติ 23 ใบ (คนละบริษัท)
 *
 * ⚠️ ปิดที่หน้าสาธารณะเท่านั้น — **หลังบ้านยังเห็นใบล่วงหน้าครบเหมือนเดิม**
 * เปิดกลับได้ด้วย env `PUBLIC_PREQUEST_JOBS_ENABLED=true` (ไม่ต้องแก้โค้ด)
 */
export function isPublicPrequestEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** ใบล่วงหน้าดูจาก id (`siamraj-pre:`) หรือธง `is_prequest` — เช็คสองทางเพราะบางเส้นส่งมาไม่ครบ */
export function isPrequestJob(job: { id?: unknown; is_prequest?: unknown }): boolean {
  if (job.is_prequest === true) return true;
  return typeof job.id === 'string' && job.id.startsWith('siamraj-pre:');
}

/** ใบนี้ผ่านด่าน "ใบล่วงหน้าห้ามออกสาธารณะ" ไหม */
export function isPublicVisibleByPrequest(
  job: { id?: unknown; is_prequest?: unknown },
  prequestEnabled: boolean,
): boolean {
  return prequestEnabled || !isPrequestJob(job);
}
