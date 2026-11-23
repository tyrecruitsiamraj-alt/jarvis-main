/**
 * ═══ ใบขออยู่กล่องสถานะทำงานกล่องไหนบน Dashboard — ตัวตัดสินเดียว (เจ้าของ 22 พ.ย. 2569) ═══
 * > "หน้า Dashboard แยกล่วงหน้าออกมาจากดำเนินการสรรหาให้ที" · Choice "กล่องใหม่ข้างกัน" + "ยังไม่ถึงวันต้องการ"
 * > (ค่ำวันเดียวกัน) "ล่วงหน้าแยกออกมาแล้วเป็นอีกแถวที่บอกสถานะ แบบ ชะลอ เริ่มประเมิน รอแจ้งเข้า รอสัมภาษณ์ ฯลฯ"
 *
 * ล่วงหน้า = ใบชนิดล่วงหน้าที่ **วันนี้ยังไม่ถึงวันที่ต้องการคน** (`isAdvanceBeforeRequiredDate`) — ทุกสถานะ
 * แถวบน = ใบที่เหลือแยกตามสถานะ · แถวล่าง "ล่วงหน้า" = ใบล่วงหน้าแยกตามสถานะเดียวกัน · สองแถวรวมกัน = "ทั้งหมด"
 * ถึงวันต้องการแล้วใบย้ายขึ้นแถวบนเอง — ถึงเวลาต้องหาแล้ว
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

/** กล่องสถานะของแถวล่วงหน้า — `work_status_advance_<สถานะ>` · ตัวรวมของแถว = `WORK_STATUS_ADVANCE_ID` */
export const advanceStatusBoxId = (status: string): string => `${WORK_STATUS_ADVANCE_ID}_${status}`;
export const isAdvanceStatusBoxId = (id: string): boolean => id.startsWith(`${WORK_STATUS_ADVANCE_ID}_`);

export function isAdvanceNotDue(job: JobRequest, today: Date = new Date()): boolean {
  return isAdvanceBeforeRequiredDate(job, today);
}

export function workStatusBoxIdOf(job: JobRequest, today: Date = new Date()): string {
  const status = resolveUnitRequestWorkStatus(job.work_status);
  return isAdvanceNotDue(job, today) ? advanceStatusBoxId(status) : `work_status_${status}`;
}

/** ใบนี้นับอยู่ในกล่องนี้ไหม — กล่องรวมแถวล่วงหน้านับทุกสถานะของแถว */
export function jobInWorkStatusBox(job: JobRequest, boxId: string, today: Date = new Date()): boolean {
  const own = workStatusBoxIdOf(job, today);
  return boxId === WORK_STATUS_ADVANCE_ID ? isAdvanceStatusBoxId(own) : own === boxId;
}

/**
 * กล่อง "หาได้แล้ว" / "ยกเลิก" ต่อท้ายสองแถวของสถานะทำงาน (เจ้าของ 23 พ.ย. 2569 "เพิ่มปิดได้กับยกเลิกมาที")
 * เลขมาจากยอดตามช่วงตัวเดียวกับการ์ด หาได้แล้ว/ยกเลิก (`sumCohortDoneByAdvance`) — ไม่ใช่ใบเปิด จึงไม่อยู่ในสมการของกล่อง "ทั้งหมด"
 * คำบนกล่อง = "หาได้แล้ว" (คำของระบบสำหรับอัตราที่หาได้ · ไม่ใช่ "ปิดครบใบขอ")
 */
export type WorkDoneBox = { kind: 'filled' | 'cancelled'; advance: boolean };
export const WORK_DONE_LABEL: Record<WorkDoneBox['kind'], string> = { filled: 'หาได้แล้ว', cancelled: 'ยกเลิก' };
export const workDoneBoxId = (kind: WorkDoneBox['kind'], advance: boolean): string => `work_done_${advance ? 'advance_' : ''}${kind}`;
export function parseWorkDoneBoxId(id: string): WorkDoneBox | null {
  const m = /^work_done_(advance_)?(filled|cancelled)$/.exec(id);
  return m ? { kind: m[2] as WorkDoneBox['kind'], advance: Boolean(m[1]) } : null;
}
