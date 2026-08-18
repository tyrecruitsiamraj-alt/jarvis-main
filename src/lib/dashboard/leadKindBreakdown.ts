import type { ThroughputRecord } from '@/lib/dashboard/throughput';
import {
  REQUEST_LEAD_KIND_LABEL,
  requestLeadKindFromDays,
  type RequestLeadKind,
} from '@/lib/requestLeadKind';

/**
 * แยกยอด **ทั้งหมด / ฉุกเฉิน / ล่วงหน้า** ของใบขอในช่วงที่กรองอยู่
 * (เจ้าของสั่ง 18 ส.ค. 2569: *"เพิ่มกราฟให้หน่อยเพื่อดูว่าทั้งหมดเท่าไหร่
 * ฉุกเฉิน ล่วงหน้าเท่าไหร่ · ข้อมูลต้องเปลี่ยนตาม Filter"*)
 *
 * 🔴 **นับจาก `throughputRecords` ชุดเดียวกับการ์ด KPI และ drill-down** — ผู้เรียกต้องส่ง
 * records ที่ผ่าน `filterThroughputByDepartment` และช่วงเดียวกับที่การ์ดใช้มาแล้ว
 * ไม่งั้นกราฟจะไม่ขยับตามตัวกรอง หรือขยับแต่ได้เลขคนละชุดกับการ์ด
 *
 * 🔴 **"ทั้งหมด" = ผลรวมของสามถัง เสมอ** — ถังแบ่งจาก `leadKind` ซึ่งมีสามค่าและ
 * ครอบคลุมทุกแถว (ไม่รู้วัน = ล่วงหน้า) จึงห้ามมีแถวตกหล่น · มีเทสต์คุมข้อนี้ไว้
 *
 * ⚠️ นับ **ทั้งอัตราและจำนวนใบ** — ใบเดียวมีหลายแถว (ปิด/ยกเลิก/คงเหลือ) ต้องนับใบครั้งเดียว
 */

export type LeadKindSlice = {
  kind: RequestLeadKind;
  label: string;
  positions: number;
  requests: number;
  /** สัดส่วนอัตราเทียบทั้งหมด (0–100 ปัดทศนิยม 1 ตำแหน่ง) · ทั้งหมด = 0 → 0 */
  percent: number;
};

export type LeadKindBreakdown = {
  totalPositions: number;
  totalRequests: number;
  slices: LeadKindSlice[];
  /** อัตราที่ระบุใบไม่ได้ (แถวไม่มีเลขที่ใบ) — ยังนับใน total แต่บอกไว้ให้ไม่หายเงียบ */
  positionsWithoutRequestNo: number;
};

/** ลำดับบนกราฟ — เร่งด่วนสุดอยู่ซ้าย อ่านจากซ้ายไปขวาแล้วเห็นความเสี่ยงก่อน */
export const LEAD_KIND_ORDER: readonly RequestLeadKind[] = ['retroactive', 'urgent', 'advance'];

function inYmdRange(ymd: string, from: string, to: string): boolean {
  return ymd >= from && ymd <= to;
}

export function buildLeadKindBreakdown(
  records: ThroughputRecord[],
  from: string,
  to: string,
): LeadKindBreakdown {
  const positions = new Map<RequestLeadKind, number>();
  const requestSets = new Map<RequestLeadKind, Set<string>>();
  for (const k of LEAD_KIND_ORDER) {
    positions.set(k, 0);
    requestSets.set(k, new Set<string>());
  }

  let totalPositions = 0;
  const allRequests = new Set<string>();
  let positionsWithoutRequestNo = 0;

  for (const r of records) {
    if (!r.requestDate || !inYmdRange(r.requestDate, from, to)) continue;
    const units = Number(r.positionUnits) || 0;
    // แถวเก่าที่ deploy ก่อนมี leadKind — ไม่เดาเป็นฉุกเฉิน (กฎเดียวกับ requestLeadKind)
    const kind = r.leadKind ?? requestLeadKindFromDays(null);

    totalPositions += units;
    positions.set(kind, (positions.get(kind) ?? 0) + units);

    const key = (r.requestNo || '').trim();
    if (key) {
      allRequests.add(key);
      requestSets.get(kind)?.add(key);
    } else {
      positionsWithoutRequestNo += units;
    }
  }

  const slices = LEAD_KIND_ORDER.map((kind) => {
    const p = positions.get(kind) ?? 0;
    return {
      kind,
      label: REQUEST_LEAD_KIND_LABEL[kind],
      positions: p,
      requests: requestSets.get(kind)?.size ?? 0,
      percent: totalPositions > 0 ? Math.round((p / totalPositions) * 1000) / 10 : 0,
    };
  });

  return {
    totalPositions,
    totalRequests: allRequests.size,
    slices,
    positionsWithoutRequestNo,
  };
}

/**
 * ตรวจว่ากราฟกับการ์ดตรงกันไหม — คืนข้อความเตือนถ้าไม่ตรง (`null` = ตรง)
 * เจ้าของสั่ง *"เช็คด้วยว่าข้อมูลตรง ถูกต้องไหม"* → ให้หน้าจอบอกเองเมื่อเพี้ยน
 * แทนที่จะรอคนมาจับได้ทีหลัง
 */
export function leadKindMismatchNote(
  breakdown: LeadKindBreakdown,
  cardPositions: number,
  cardRequests: number,
): string | null {
  const sliceSum = breakdown.slices.reduce((sum, s) => sum + s.positions, 0);
  if (sliceSum !== breakdown.totalPositions) {
    return `ผลรวมสามถัง (${sliceSum.toLocaleString('th-TH')}) ไม่เท่ายอดทั้งหมด (${breakdown.totalPositions.toLocaleString('th-TH')})`;
  }
  if (breakdown.totalPositions !== cardPositions || breakdown.totalRequests !== cardRequests) {
    return `กราฟได้ ${breakdown.totalPositions.toLocaleString('th-TH')} อัตรา · ${breakdown.totalRequests.toLocaleString('th-TH')} ใบ แต่การ์ด「เข้ามา」บอก ${cardPositions.toLocaleString('th-TH')} อัตรา · ${cardRequests.toLocaleString('th-TH')} ใบ`;
  }
  return null;
}
