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

/**
 * "ถึงวันแล้ว" = ใบที่ยังไม่ปิดและถึงวันต้องการคนแล้ว ทุกสถานะ (เจ้าของ 27 พ.ย. 2569 · คงเหลือ = ถึงวันแล้ว + ล่วงหน้า)
 * กล่องนำของแถวสถานะ + ช่องซ้ายในกล่อง "คงเหลือ" · เลข = คงเหลือ − ล่วงหน้า (DashboardShell)
 */
export const WORK_STATUS_DUE_ID = 'work_status_due';
export const WORK_STATUS_DUE_LABEL = 'ถึงวันแล้ว';
/** กล่องรวมใบที่ยังไม่ปิดบนแถวบน (id เดิม `work_status_total`) */
// คำบนจอชุดกลาง `uiWords.ts`: ยอดที่ยังต้องหา = "เหลือหา" (เจ้าของพิมพ์ "คงเหลือ" 27 พ.ย. — กติกา 31 ต.ค. ให้ใช้คำกลาง)
export const WORK_REMAIN_LABEL = 'เหลือหา';

/** ใบนี้นับอยู่ในกล่องนี้ไหม — กล่องรวมแถวล่วงหน้านับทุกสถานะของแถว · ถึงวันแล้ว = ทุกสถานะที่ไม่ใช่ล่วงหน้า */
export function jobInWorkStatusBox(job: JobRequest, boxId: string, today: Date = new Date()): boolean {
  const own = workStatusBoxIdOf(job, today);
  if (boxId === WORK_STATUS_DUE_ID) return !isAdvanceStatusBoxId(own);
  return boxId === WORK_STATUS_ADVANCE_ID ? isAdvanceStatusBoxId(own) : own === boxId;
}

/**
 * กล่อง "หาได้แล้ว" / "ยกเลิก" ต่อท้ายสองแถวของสถานะทำงาน (เจ้าของ 23 พ.ย. 2569 "เพิ่มปิดได้กับยกเลิกมาที")
 * เลขมาจากยอดตามช่วงตัวเดียวกับการ์ด หาได้แล้ว/ยกเลิก (`sumCohortDoneByAdvance`) — ไม่ใช่ใบเปิด จึงไม่อยู่ในสมการของกล่อง "ทั้งหมด"
 */
export type WorkDoneBox = { kind: 'filled' | 'cancelled'; advance: boolean };
// คำบนกล่อง = "ปิดแล้ว" (เจ้าของเลือกเอง 23 พ.ย. 2569 · นับอัตราที่หาคนได้แล้ว)
export const WORK_DONE_LABEL: Record<WorkDoneBox['kind'], string> = { filled: 'ปิดแล้ว', cancelled: 'ยกเลิก' };
export const workDoneBoxId = (kind: WorkDoneBox['kind'], advance: boolean): string => `work_done_${advance ? 'advance_' : ''}${kind}`;
export function parseWorkDoneBoxId(id: string): WorkDoneBox | null {
  const m = /^work_done_(advance_)?(filled|cancelled)$/.exec(id);
  return m ? { kind: m[2] as WorkDoneBox['kind'], advance: Boolean(m[1]) } : null;
}

/**
 * แถวบนสุดของสถานะทำงาน (เจ้าของ 23 พ.ย. 2569 "แยกมาเป็น 3 กล่องว่า ทั้งหมดเท่าไหร่ ปิดแล้วเท่าไหร่ ยกเลิกเท่าไหร่"):
 * ใบขอทั้งหมด · ปิดแล้ว · ยกเลิก — ใบขอทั้งหมด = "ทั้งหมด" ของแถวสถานะ (ยังต้องหา) + ปิดแล้ว + ยกเลิก
 * แถวล่วงหน้าแบบเดียวกัน · กด "ใบขอทั้งหมด" = เทียบรายเดือน · กด ปิดแล้ว/ยกเลิก = รายการใบของช่วง
 */
export const WORK_TOP_TOTAL_LABEL = 'ใบขอทั้งหมด';
/**
 * กล่องที่ 4 ของแถวบน (เจ้าของ 23 พ.ย. 2569 "เอาเป็น ใบขอทั้งหมด ปิด ยกเลิก ยังไม่ปิด แล้วยังไม่ปิดนี่แหละแยกลงมา" · Choice แบบ ก)
 * = กล่องแรกของแถวสถานะเดิม (ทั้งหมด / ล่วงหน้า) ย้ายขึ้นมา ⇒ แถวสถานะเหลือแต่สถานะ ไม่มีเลขซ้ำ
 */
export const WORK_OPEN_LABEL = 'ยังไม่ปิด';
export const workTopTotalId = (advance: boolean): string => (advance ? 'work_top_advance_total' : 'work_top_total');
export function parseWorkTopTotalId(id: string): { advance: boolean } | null {
  return id === 'work_top_total' ? { advance: false } : id === 'work_top_advance_total' ? { advance: true } : null;
}
