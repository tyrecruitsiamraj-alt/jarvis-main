/**
 * ═══ สะพาน "ยังเปิดในช่วง" → "เหลือหา" ของ Dashboard โหมดทั้งหมด (เจ้าของ 31 ต.ค. 2569 Choice "เลขเดียว 398 + แตกให้เห็น") ═══
 * เดิมสมการบอก เข้ามา − หาได้แล้ว − ยกเลิก = 295 แต่การ์ดเหลือหาบอก 398 · สองเลขนับคนละชุด:
 *   - 295 = ใบขอ ERP ที่วันต้องการคนอยู่ในช่วงแนวโน้ม แล้วยังไม่ปิด
 *   - 398 = ใบที่ยังเปิดในกล่องงานตอนนี้ทั้งหมด
 * ⇒ แตกส่วนต่างเป็นก้อนที่ชี้ใบได้: ใบขอชั่วคราว · ต้องการคนก่อนช่วง · ต้องการคนหลังช่วง · ใบไม่มีวันเลย (`noRecord`)
 *   ที่เหลือ (ใบเดียวกันแต่ยอดเหลือหาใน ERP กับกล่องงานไม่เท่ากัน) = `adjust` บวกหรือลบ ⇒ สมการลงตัวเสมอ
 * ไฟล์นี้ pure
 */
import type { JobRequest } from '@/types';
import type { ThroughputRecord } from '@/lib/dashboard/throughput';
import { positionBreakdownFromJob } from '@/lib/requestControl';
import { isPrequestJob } from '@/lib/publicJobVisibility';
import { dashboardCohortYmd } from '@/lib/jobUrgency';

export type RemainingBridge = {
  /** เข้ามา − หาได้แล้ว − ยกเลิก ของใบในช่วง */
  inPeriod: number;
  prequest: number;
  before: number;
  after: number;
  noRecord: number;
  /** ใบเดียวกัน ยอดเหลือหาไม่ตรงกัน (+ กล่องงานมากกว่า · − น้อยกว่า) */
  adjust: number;
  /** = การ์ดเหลือหา */
  total: number;
};

const keysOf = (j: JobRequest) =>
  [j.id, j.externalId, j.request_no].map((k) => (k ?? '').trim()).filter(Boolean);

export function buildRemainingBridge(
  openJobs: readonly JobRequest[],
  records: readonly ThroughputRecord[],
  from: string,
  to: string,
  inPeriod: number,
): RemainingBridge {
  const dateOf = new Map<string, string>();
  for (const r of records) {
    for (const k of [r.jobId, r.requestNo]) if (k?.trim()) dateOf.set(k.trim(), r.requestDate);
  }
  const out = { inPeriod, prequest: 0, before: 0, after: 0, noRecord: 0, adjust: 0, total: 0 };
  let inWindow = 0;
  for (const j of openJobs) {
    const units = positionBreakdownFromJob(j).remainingPositions;
    if (units <= 0) continue;
    out.total += units;
    if (isPrequestJob(j)) {
      out.prequest += units;
      continue;
    }
    // ยอด ERP ดึงเฉพาะใบที่วันต้องการคนอยู่ในช่วง — ใบนอกช่วงไม่มีแถว ⇒ ใช้วันของใบเอง (ตัวเดียวกับยอด ERP)
    const day = keysOf(j).map((k) => dateOf.get(k)).find(Boolean) ?? dashboardCohortYmd(j);
    if (!day) out.noRecord += units;
    else if (day < from) out.before += units;
    else if (day > to) out.after += units;
    else inWindow += units;
  }
  out.adjust = inWindow - inPeriod;
  return out;
}
