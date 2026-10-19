/**
 * ═══ ใบขอปิดแล้ว = ลิงก์สมัครปิดรับ (เจ้าของ 19 ต.ค. 2569 · Choice "ปิดลิงก์ + AI โทรบททักทาย") ═══
 *
 * เจอจริง: OPL6909022 ปิด 4 ก.ย. แต่มีคนกรอกผ่านลิงก์ 8–11 ต.ค. 6 คน · OPL6907072 ปิด 14 ก.ค. กรอก 16 ต.ค. 1 คน
 * ⇒ ประกาศ (`recruit_postings.status`) ไม่รู้ว่าใบขอใน ERP ปิดแล้ว ลิงก์จึงรับใบต่อ แล้ว AI ไม่โทร (หาใบเปิดไม่เจอ)
 * 🔴 ตอบ "ปิด" เฉพาะเมื่ออ่านใบขอได้และสถานะเป็น closed — อ่านไม่ได้/ไม่เจอ = ไม่ปิด (คนจริงกำลังจะสมัคร ห้ามทำลิงก์ล่ม)
 */
import { getSiamrajUnitRequestById, isSiamrajUnitRequestsEnabled } from './siamrajUnitRequests.js';
import { logWarn } from './logger.js';

export async function isRequestClosedForApply(jobId: string | null | undefined): Promise<boolean> {
  const id = (jobId ?? '').trim();
  if (!id || !isSiamrajUnitRequestsEnabled()) return false;
  try {
    const item = (await getSiamrajUnitRequestById(id, undefined, { includeClosed: true })) as { status?: string } | null;
    return item?.status === 'closed';
  } catch (e) {
    logWarn('requestClosedForApply: อ่านใบขอไม่ได้ — ถือว่ายังเปิด', { jobId: id, error: e instanceof Error ? e.message : String(e) });
    return false;
  }
}

export const REQUEST_CLOSED_APPLY_MESSAGE = 'ตำแหน่งนี้ปิดรับสมัครแล้ว';
