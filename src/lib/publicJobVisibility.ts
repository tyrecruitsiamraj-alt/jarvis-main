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

/**
 * สถานะที่แปลว่าได้ตัวคนแล้ว — ไม่ต้องประกาศหาคนต่อ
 * เพิ่ม `daily_work` + `daily_pay` 20 ส.ค. 2569 — เจ้าของยืนยัน: *"หน้าสาธารณะจะไม่เห็น
 * งานพวกรอแจ้งเข้า ปิดแล้ว หรือเริ่มงาน"* + ถามซ้ำแล้วเคาะ "ซ่อนด้วย"
 * (เดิมสองสถานะนี้ยังโชว์อยู่ ทั้งที่งานเริ่มไปแล้ว — คนสมัครเข้ามาก็ไม่มีที่ลง)
 */
export const HIDDEN_FROM_PUBLIC_WORK_STATUSES: readonly UnitRequestWorkStatus[] = [
  'waiting_start',
  'waiting_inform',
  'daily_work',
  'daily_pay',
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
 * **ใบขอล่วงหน้าออกหน้าสาธารณะได้** — เจ้าของเคาะเย็น 17 ส.ค. 2569:
 * *"ใบขอล่วงหน้าเอาขึ้นไปเลย ถ้าไม่เอาแล้วก็คงปิดไปเอง"*
 *
 * ตอนบ่ายวันเดียวกันเคยปิดไว้ชั่วคราว เพราะเจอว่าใบล่วงหน้า 31 ใบ **25 ใบเกิดวันที่
 * 24 ก.ค. วันเดียว** จากคนบันทึก 10 กว่าคน = วันที่คนซ้อมใช้ฟีเจอร์ใน ERP ชื่อหน่วยงาน
 * เป็นข้อความเล่น ๆ (`ช่วยหนูด้วย` · `so test` · `อะ 10 20 30 40`)
 * → **เจ้าของรับทราบแล้วและสั่งให้เปิด** ใบที่ไม่เอาแล้วจะถูกปิดที่ ERP เอง
 *
 * สองอย่างที่ค้างตอนปิดไว้ **แก้แล้วทั้งคู่** ก่อนเปิดกลับ:
 * 1. อัตราค่าจ้าง — ต่อ `fetchBenefitRatesByJobId` เข้า `withBenefits()` แล้ว
 *    ใบล่วงหน้าจึงได้ชิปสวัสดิการ + รายได้ต่อเดือนตามหน่วยจริง เหมือนใบขอปกติ
 * 2. คีย์ซ้ำ — `withBenefits()` คีย์ด้วย **id เต็ม** แล้ว (เลขที่ใบซ้ำกันจริง 23 ใบ)
 *
 * ⚠️ ค่าเริ่มต้นตอนนี้คือ **เปิด** · ปิดฉุกเฉินได้ด้วย env
 * `PUBLIC_PREQUEST_JOBS_ENABLED=false` (ไม่ต้องแก้โค้ด ไม่ต้อง restart)
 */
export function isPublicPrequestEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  // ไม่ตั้งค่า = เปิด · ปิดต้องเขียนคำว่าปิดชัด ๆ เท่านั้น
  return !(v === 'false' || v === '0' || v === 'no' || v === 'off');
}

/**
 * คำที่ใช้เรียกใบขอล่วงหน้า **บนหน้าจอ** (เจ้าของสั่ง 19 ส.ค. 2569: *"ใบขอไหนมาจากใบพรี
 * ก็ใส่ป้ายแท็กไว้ว่าเป็นใบขอชั่วคราว"*)
 *
 * 🔴 ที่เดียวในระบบ — ใบพรีโผล่หลายหน้า (บอร์ด · รายการ · รายละเอียด · แดชบอร์ด ·
 * รายงานตัวย้ายใบสมัคร) ถ้าแต่ละที่พิมพ์คำเอง จะกลายเป็นของสิ่งเดียวกันแต่เรียกคนละชื่อ
 * ⚠️ นี่คือ **คำบนจอ** เท่านั้น — ฝั่งข้อมูลยังเรียก prequest/`siamraj-pre:` เหมือนเดิม
 */
export const PREQUEST_LABEL = 'ใบขอชั่วคราว';

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
