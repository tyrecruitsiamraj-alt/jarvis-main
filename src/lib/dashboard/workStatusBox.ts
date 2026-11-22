/**
 * ═══ ใบขออยู่กล่องสถานะทำงานกล่องไหนบน Dashboard — ตัวตัดสินเดียว (เจ้าของ 22 พ.ย. 2569) ═══
 * > "หน้า Dashboard แยกล่วงหน้าออกมาจากดำเนินการสรรหาให้ที" · Choice "กล่องใหม่ข้างกัน" + "ยังไม่ถึงวันต้องการ"
 *
 * กล่อง "ล่วงหน้า" = ใบสถานะ ดำเนินการ ที่เป็นชนิดล่วงหน้า **และวันนี้ยังไม่ถึงวันที่ต้องการคน** (`isAdvanceBeforeRequiredDate`)
 * ถึงวันต้องการแล้วใบย้ายกลับกล่อง "กำลังดำเนินการสรรหา" เอง — ถึงเวลาต้องหาแล้ว
 * ใบสถานะอื่น (พัก · รอสัมภาษณ์ ฯลฯ) อยู่กล่องของสถานะนั้นเหมือนเดิม ไม่ว่าล่วงหน้าหรือไม่
 * สองกล่องรวมกัน = เลขเดิมของ "กำลังดำเนินการสรรหา" · "ทั้งหมด" ไม่เปลี่ยน
 *
 * เลขบนกล่อง (`buildWorkStatusKpis`) กับรายการตอนกดกล่อง (SupervisorDashboard) เรียกตัวนี้ตัวเดียว — เลขกับรายการจึงเท่ากันเสมอ
 * 🔴 นี่คือกล่องของหน้า Dashboard เท่านั้น — ก้อนใบขอหน้าภาพรวม (`workStatusOfRemaining`) และตัวกรองกล่องงานยังนับตามสถานะล้วน
 */
import { isAdvanceBeforeRequiredDate } from '@/lib/jobUrgency';
import { resolveUnitRequestWorkStatus } from '@/lib/unitRequestWorkStatus';
import type { JobRequest } from '@/types';

export const WORK_STATUS_ADVANCE_ID = 'work_status_advance';
export const WORK_STATUS_ADVANCE_LABEL = 'ล่วงหน้า';
/** บรรทัดรองของกล่อง — บอกว่าล่วงหน้าแบบไหน (กราฟข้างล่างใช้คำว่าล่วงหน้ากับใบชนิดล่วงหน้าทุกใบ เลขจึงไม่เท่ากัน) */
export const WORK_STATUS_ADVANCE_HINT = 'ยังไม่ถึงวันต้องการ';

export function workStatusBoxIdOf(job: JobRequest, today: Date = new Date()): string {
  const status = resolveUnitRequestWorkStatus(job.work_status);
  if (status === 'in_progress' && isAdvanceBeforeRequiredDate(job, today)) return WORK_STATUS_ADVANCE_ID;
  return `work_status_${status}`;
}
