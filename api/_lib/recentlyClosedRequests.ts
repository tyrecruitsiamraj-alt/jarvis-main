/**
 * ═══ ใบขอที่เพิ่งปิด/ยกเลิก/Stop ใน ERP ต้องหายจากจอทันที (เจ้าของ 19 ต.ค. 2569 "ถ้าปิดก็คือปิด") ═══
 *
 * เหตุ: รายการใบขอใช้สำเนา (`unitRequestCache` — สด 90 วิ · ตอบของเก่าได้ถึง 10 นาทีระหว่างโหลดใหม่)
 * ⇒ OPL6909079 Stop ตอน 18:43 แต่ยังโชว์ต่ออีกพักหนึ่ง
 * แก้: ทุกครั้งที่ตอบจากสำเนา ถาม ERP สั้น ๆ เฉพาะสถานะของใบในสำเนา (คีย์หลัก request_no) แล้วตัดใบที่ปิดออก
 * กติกาปิดชุดเดียวกับ `isOpenStaffingRow` ส่วนที่ไม่ต้องนับใบแจ้งเข้า: status ≠ A · is_stop ≠ N · มี stop_no · แจ้งเข้าครบ (Y)
 * ผลจำไว้ 15 วิ (หลายคนเปิดพร้อมกันไม่ยิง ERP ซ้ำ) · ถาม ERP ไม่ได้ = ไม่ตัด (ตอบสำเนาตามเดิม ไม่ทำให้จอว่าง)
 */
import { siamrajSqlQuery } from './siamrajSqlServer.js';
import { logWarn } from './logger.js';

const MEMO_MS = 15_000;
const SAFE_NO = /^[A-Za-z0-9-]{3,32}$/;
let memo: { at: number; key: string; closed: Set<string> } | null = null;

export type ClosedSignalRow = {
  no: string;
  status: string | null;
  is_stop: string | null;
  stop_no: string | null;
  is_inform_all: string | null;
};

/** ตรรกะล้วน — ใบนี้ปิดแล้วหรือยังจากธงในหัวใบขอ (ส่วนเดียวกับ `isOpenStaffingRow`) */
export function isClosedBySignals(r: Omit<ClosedSignalRow, 'no'>): boolean {
  const status = (r.status ?? '').trim().toUpperCase();
  const stop = (r.is_stop ?? 'N').trim().toUpperCase() || 'N';
  return status !== 'A' || stop !== 'N' || Boolean((r.stop_no ?? '').trim()) || (r.is_inform_all ?? '').trim().toUpperCase() === 'Y';
}

/** request_no ที่ปิดแล้วในชุดที่ส่งมา · ถามไม่ได้ = ชุดว่าง */
export async function loadClosedRequestNos(requestNos: readonly string[]): Promise<Set<string>> {
  const nos = [...new Set(requestNos.map((n) => n.trim()).filter((n) => SAFE_NO.test(n)))].sort();
  if (nos.length === 0) return new Set();
  const key = nos.join(',');
  if (memo && memo.key === key && Date.now() - memo.at < MEMO_MS) return memo.closed;
  try {
    const list = nos.map((n) => `'${n}'`).join(',');
    const rows = await siamrajSqlQuery<ClosedSignalRow>(
      `SELECT RTRIM(request_no) AS no, status, is_stop, stop_no, is_inform_all
         FROM st_request_head
        WHERE request_no IN (${list})`,
      {},
    );
    const closed = new Set(rows.filter(isClosedBySignals).map((r) => String(r.no).trim()));
    memo = { at: Date.now(), key, closed };
    return closed;
  } catch (e) {
    logWarn('recentlyClosedRequests.failed', { message: e instanceof Error ? e.message : String(e) });
    return new Set();
  }
}
